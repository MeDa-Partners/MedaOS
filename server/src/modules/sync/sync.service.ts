import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { syncState, ventures } from '../../db/schema';
import { NotFoundError } from '../../utils/errors';
import { env } from '../../config/env';

/** The Orders screen shows a red banner past this: a sync that dies silently is worse than one that fails loudly. */
export const STALE_AFTER_MS = 15 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SyncHealth {
  provider: 'shopify';
  configured: boolean;
  scheduleEnabled: boolean;
  /** Start time of the last fully successful run (also the sync cursor). */
  lastSuccessAt: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  ordersSynced: number;
  /** True when there has been no successful run in the last 15 minutes. */
  stale: boolean;
}

export async function getSyncHealth(ventureIdOrSlug: string, now = new Date()): Promise<SyncHealth> {
  const [venture] = await db
    .select({ id: ventures.id })
    .from(ventures)
    .where(UUID_RE.test(ventureIdOrSlug) ? eq(ventures.id, ventureIdOrSlug) : eq(ventures.slug, ventureIdOrSlug))
    .limit(1);
  if (!venture) throw new NotFoundError('Venture not found');

  const [state] = await db
    .select()
    .from(syncState)
    .where(and(eq(syncState.ventureId, venture.id), eq(syncState.provider, 'shopify')))
    .limit(1);

  const lastSuccess = state?.lastSyncedAt ?? null;
  return {
    provider: 'shopify',
    configured: !!(env.SHOPIFY_SHOP_DOMAIN && env.SHOPIFY_CLIENT_ID && env.SHOPIFY_CLIENT_SECRET),
    scheduleEnabled: env.SHOPIFY_SYNC_ENABLED,
    lastSuccessAt: lastSuccess?.toISOString() ?? null,
    lastRunAt: state?.lastRunAt?.toISOString() ?? null,
    lastError: state?.lastError ?? null,
    ordersSynced: state?.ordersSynced ?? 0,
    stale: !lastSuccess || now.getTime() - lastSuccess.getTime() > STALE_AFTER_MS,
  };
}
