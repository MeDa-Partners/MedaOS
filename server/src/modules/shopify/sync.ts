import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import { orderEvents, orders, syncState, ventures } from '../../db/schema';
import { env } from '../../config/env';
import { ShopifyClient } from './client';
import { mapShopifyOrder, ShopifyOwnedOrderFields } from './mapper';
import { shopifyCredentialsFromEnv } from './token';
import { ShopifyOrder } from './shopify.types';
import { plannedVerificationAt } from '../orders/deadlines';
import { getDeadlineSettings } from '../orders/settings.service';
import { createShiftOwnerLookup } from '../orders/shifts.service';

/**
 * Shopify → orders sync.
 *
 * Cursor rules (spec §4.3): read everything with updated_at ≥ cursor − 2 min, upsert it, and move
 * the cursor to the run's start time only if every page succeeded. On any error the cursor stays
 * put and the next run redoes the whole window — that is what makes lost orders impossible.
 */

const PROVIDER = 'shopify';
const OVERLAP_MS = 2 * 60 * 1000;
const LEASE = sql`now() + interval '10 minutes'`;
const DEFAULT_BACKFILL_MS = 24 * 60 * 60 * 1000;

/**
 * Columns refreshed from Shopify when an order already exists. Exactly the mapper's output:
 * team-owned columns, stage and task id are never in this list (tested in shopify.test.ts).
 */
export const SHOPIFY_OWNED_KEYS = [
  'shopifyUpdatedAt',
  'rawPayload',
  'orderNumber',
  'orderDate',
  'customerName',
  'phone',
  'address',
  'city',
  'state',
  'pincode',
  'products',
  'totalQty',
  'totalAmount',
  'paymentMethod',
  'channel',
  'financialStatus',
  'fulfillmentStatus',
] as const satisfies readonly Exclude<keyof ShopifyOwnedOrderFields, 'shopifyOrderId'>[];

/** Skips an older payload arriving after a newer one. */
const NEWER_PAYLOAD_ONLY = sql.raw(`"orders"."shopify_updated_at" < excluded."shopify_updated_at"`);

/** INSERT … ON CONFLICT (venture_id, shopify_order_id) DO UPDATE SET <Shopify-owned only> WHERE newer. */
export function buildUpsert(ventureId: string, rows: ShopifyOwnedOrderFields[]) {
  const set = Object.fromEntries(SHOPIFY_OWNED_KEYS.map((k) => [k, sql.raw(`excluded."${orders[k].name}"`)]));
  return db
    .insert(orders)
    .values(rows.map((r) => ({ ...r, ventureId })))
    .onConflictDoUpdate({
      target: [orders.ventureId, orders.shopifyOrderId],
      set: { ...set, updatedAt: sql`now()` },
      setWhere: NEWER_PAYLOAD_ONLY,
    })
    .returning({ id: orders.id, inserted: sql<boolean>`(xmax = 0)` });
}

/** Same order twice in one page → keep the newest, or Postgres rejects the batch. */
function latestPerOrder(page: ShopifyOrder[]): ShopifyOwnedOrderFields[] {
  const byId = new Map<number, ShopifyOwnedOrderFields>();
  for (const o of page) {
    const row = mapShopifyOrder(o);
    const seen = byId.get(row.shopifyOrderId);
    if (!seen || seen.shopifyUpdatedAt! < row.shopifyUpdatedAt!) byId.set(row.shopifyOrderId, row);
  }
  return [...byId.values()];
}

/**
 * One page of orders. New COD orders are inserted; any order we already hold is refreshed even if
 * it is no longer COD (e.g. the customer paid online), so the team never works from stale data.
 * Prepaid orders we don't hold are skipped.
 */
async function applyPage(ventureId: string, page: ShopifyOrder[]): Promise<number> {
  const rows = latestPerOrder(page);
  const cod = rows.filter((r) => r.paymentMethod === 'COD');
  const notCod = rows.filter((r) => r.paymentMethod !== 'COD');

  let written = 0;
  if (cod.length) {
    const result = await buildUpsert(ventureId, cod);
    written += result.length;
    const created = result.filter((r) => r.inserted);
    if (created.length) {
      await db.insert(orderEvents).values(
        created.map((r) => ({ ventureId, orderId: r.id, step: 'intake', event: 'received' }))
      );
    }
  }

  if (notCod.length) {
    const held = await db
      .select({ shopifyOrderId: orders.shopifyOrderId })
      .from(orders)
      .where(and(eq(orders.ventureId, ventureId), inArray(orders.shopifyOrderId, notCod.map((r) => r.shopifyOrderId))));
    const heldIds = new Set(held.map((h) => h.shopifyOrderId));
    for (const row of notCod.filter((r) => heldIds.has(r.shopifyOrderId))) {
      const { shopifyOrderId, ...fields } = row;
      const updated = await db
        .update(orders)
        .set({ ...fields, updatedAt: new Date() })
        .where(
          and(
            eq(orders.ventureId, ventureId),
            eq(orders.shopifyOrderId, shopifyOrderId),
            lt(orders.shopifyUpdatedAt, row.shopifyUpdatedAt!)
          )
        )
        .returning({ id: orders.id });
      written += updated.length;
    }
  }
  return written;
}

/** TSK-001 … TSK-999, then TSK-1000 onwards: at least three digits, never truncated. */
export function formatTaskId(seq: number): string {
  return `TSK-${String(seq).padStart(3, '0')}`;
}

/**
 * Numbers every order that has no task id yet, continuing from the venture's highest number,
 * in order-date order. Runs inside the sync, which holds the lease, so numbers cannot collide
 * (the unique index on (venture_id, task_seq) backs that up).
 */
async function assignTaskIds(ventureId: string): Promise<void> {
  await db.execute(sql`
    UPDATE ${orders} AS o
    SET task_seq = s.n,
        task_id = 'TSK-' || lpad(s.n::text, greatest(3, length(s.n::text)), '0')
    FROM (
      SELECT id,
             (SELECT coalesce(max(task_seq), 0) FROM ${orders} WHERE venture_id = ${ventureId})
               + row_number() OVER (ORDER BY order_date, shopify_order_id) AS n
      FROM ${orders}
      WHERE venture_id = ${ventureId} AND task_seq IS NULL
    ) AS s
    WHERE o.id = s.id
  `);
}

/**
 * Moves every order still at stage 'new' into verification (spec v2 §6.5): owner = the
 * verification shift covering the order's Shopify creation time (not the sync time, so a late
 * sync can't shift an order into the wrong shift), planned time from the venture's settings.
 * Runs after every sync, so an order inserted by a run that then crashed is routed next time.
 */
async function routeNewOrders(ventureId: string): Promise<void> {
  const fresh = await db
    .select({ id: orders.id, orderDate: orders.orderDate })
    .from(orders)
    .where(and(eq(orders.ventureId, ventureId), eq(orders.stage, 'new')));
  if (!fresh.length) return;

  const settings = await getDeadlineSettings(ventureId);
  const ownerAt = await createShiftOwnerLookup(ventureId, 'verification');

  for (const order of fresh) {
    const { owner, reason } = ownerAt(order.orderDate);
    const planned = plannedVerificationAt(order.orderDate, settings);
    await db.transaction(async (tx) => {
      const moved = await tx
        .update(orders)
        .set({
          stage: 'verification_pending',
          verificationAssignee: owner?.userId ?? null,
          verificationPlannedAt: planned,
          updatedAt: new Date(),
        })
        .where(and(eq(orders.id, order.id), eq(orders.stage, 'new')))
        .returning({ id: orders.id });
      if (!moved.length) return;
      await tx.insert(orderEvents).values({
        ventureId,
        orderId: order.id,
        step: 'verification',
        event: owner ? 'assigned' : 'unassigned',
        note: owner ? `${owner.userName} (${owner.shiftName})` : `Waiting for a head to assign: ${reason}`,
      });
    });
  }
}

async function ensureState(ventureId: string) {
  await db.insert(syncState).values({ ventureId, provider: PROVIDER }).onConflictDoNothing();
  const [state] = await db
    .select()
    .from(syncState)
    .where(and(eq(syncState.ventureId, ventureId), eq(syncState.provider, PROVIDER)))
    .limit(1);
  return state;
}

/** Atomic "take the lease if nobody holds it". Works through any connection pooler. */
async function acquireLease(stateId: string): Promise<boolean> {
  const taken = await db
    .update(syncState)
    .set({ lockedUntil: LEASE })
    .where(and(eq(syncState.id, stateId), or(isNull(syncState.lockedUntil), lt(syncState.lockedUntil, sql`now()`))))
    .returning({ id: syncState.id });
  return taken.length > 0;
}

export type SyncResult =
  | { status: 'ok'; ordersSynced: number; mode: 'incremental' | 'backfill' }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; error: string };

export async function runShopifySync(ventureId: string, client: ShopifyClient): Promise<SyncResult> {
  const state = await ensureState(ventureId);
  if (!(await acquireLease(state.id))) return { status: 'skipped', reason: 'another sync is running' };

  const runAt = new Date();
  const mode = state.lastSyncedAt ? 'incremental' : 'backfill';
  const params: Record<string, string> = state.lastSyncedAt
    ? { updated_at_min: new Date(state.lastSyncedAt.getTime() - OVERLAP_MS).toISOString() }
    : { created_at_min: env.SHOPIFY_BACKFILL_FROM ?? new Date(runAt.getTime() - DEFAULT_BACKFILL_MS).toISOString() };

  let written = 0;
  try {
    for await (const page of client.orderPages(params)) {
      written += await applyPage(ventureId, page);
      await db.update(syncState).set({ lockedUntil: LEASE }).where(eq(syncState.id, state.id));
    }
    await assignTaskIds(ventureId);
    await routeNewOrders(ventureId);
    // Every page succeeded: only now may the cursor move.
    await db
      .update(syncState)
      .set({ lastSyncedAt: runAt, lastRunAt: runAt, lastError: null, ordersSynced: written, lockedUntil: null, updatedAt: new Date() })
      .where(eq(syncState.id, state.id));
    return { status: 'ok', ordersSynced: written, mode };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(syncState)
      .set({ lastRunAt: runAt, lastError: message.slice(0, 2000), lockedUntil: null, updatedAt: new Date() })
      .where(eq(syncState.id, state.id));
    return { status: 'error', error: message };
  }
}

/** The configured venture's sync, using credentials from env. */
export async function runConfiguredShopifySync(): Promise<SyncResult> {
  const [venture] = await db
    .select({ id: ventures.id })
    .from(ventures)
    .where(eq(ventures.slug, env.SHOPIFY_VENTURE_SLUG))
    .limit(1);
  if (!venture) return { status: 'skipped', reason: `venture "${env.SHOPIFY_VENTURE_SLUG}" not found` };
  return runShopifySync(venture.id, new ShopifyClient(shopifyCredentialsFromEnv()));
}
