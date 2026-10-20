import { and, asc, desc, eq, ilike, inArray, isNotNull, lt, or, sql, SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db';
import { orderEvents, orders, users } from '../../db/schema';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { Actor, canEditShifts, canEditStep, loadAuthority } from '../../utils/access';
import { ListOrdersQuery, OrderScope, OrderView } from './orders.validation';
import { OrderCapabilities, OrderDetail, OrderListItem, OrderListResult } from './orders.types';
import { loadShiftsContext } from './shifts.service';

const verifier = alias(users, 'verifier');
const portalUser = alias(users, 'portal_user');

/** The step an order is waiting on decides whose name shows as "assignee". */
const currentAssigneeName = sql<string | null>`CASE WHEN ${orders.stage} = 'portal_pending' THEN ${portalUser.name} ELSE ${verifier.name} END`;

const OPEN_STAGES = ['verification_pending', 'portal_pending'];

/** Planned time of the step the order is waiting on (null once nothing is pending). */
const openPlannedAt = sql`CASE ${orders.stage} WHEN 'verification_pending' THEN ${orders.verificationPlannedAt} WHEN 'portal_pending' THEN ${orders.portalPlannedAt} END`;

/** Waiting on a step whose planned time has passed — the "Delayed" tab (amber). */
const openStepOverdue = sql`(${openPlannedAt}) < now()`;

/**
 * Minutes late, shown only when positive (spec v2 §5.3): for an open step now − planned; for a
 * finished order the worst of its completed steps' actual − planned.
 */
const delayMinutes = sql<number | null>`CASE
  WHEN ${openStepOverdue} THEN floor(extract(epoch FROM now() - (${openPlannedAt})) / 60)::int
  WHEN ${orders.stage} IN ('verification_pending', 'portal_pending') THEN NULL
  ELSE nullif(greatest(0, floor(extract(epoch FROM greatest(
    ${orders.verificationActualAt} - ${orders.verificationPlannedAt},
    ${orders.portalActualAt} - ${orders.portalPlannedAt}
  )) / 60))::int, 0)
END`;

/** 'overdue' = open and past its deadline (amber); 'late' = completed after its deadline (red). */
const delayStatus = (stage: string, minutes: number | null) =>
  minutes && minutes > 0 ? (OPEN_STAGES.includes(stage) ? ('overdue' as const) : ('late' as const)) : null;

const TRUE = sql`true`;

/**
 * The saved-view tabs of each screen, in display order, with their filters.
 *  - orders: everything, read-only.
 *  - verification / portal: the work queue for that step ("all" = every order waiting on it).
 */
function scopeViews(scope: OrderScope, userId: string): Partial<Record<OrderView, SQL>> {
  if (scope === 'verification' || scope === 'portal') {
    const pendingStage = scope === 'verification' ? 'verification_pending' : 'portal_pending';
    const owner = scope === 'verification' ? orders.verificationAssignee : orders.portalAssignee;
    const planned = scope === 'verification' ? orders.verificationPlannedAt : orders.portalPlannedAt;
    const actual = scope === 'verification' ? orders.verificationActualAt : orders.portalActualAt;
    return {
      my_pending: and(eq(orders.stage, pendingStage), eq(owner, userId))!,
      all: eq(orders.stage, pendingStage),
      delayed: and(eq(orders.stage, pendingStage), lt(planned, sql`now()`))!,
      completed: isNotNull(actual),
    };
  }
  return {
    all: TRUE,
    my_pending: or(
      and(eq(orders.verificationAssignee, userId), eq(orders.stage, 'verification_pending')),
      and(eq(orders.portalAssignee, userId), eq(orders.stage, 'portal_pending'))
    )!,
    delayed: openStepOverdue,
    converted: inArray(orders.finalResponse, ['Prepaid Converted', 'Semi-Prepaid']),
    cancelled: eq(orders.portalAction, 'Order Cancelled in Portal'),
    // The sheet's Sales Team tab: Soft Refused orders, cancelled, waiting for a follow-up call.
    follow_up: and(eq(orders.followUpRequired, true), eq(orders.stage, 'closed'))!,
  };
}

/** Work queues: soonest deadline first. Completed: most recent first. Orders: newest first. */
function scopeOrder(scope: OrderScope, view: OrderView): SQL[] {
  if (scope !== 'orders') {
    const planned = scope === 'verification' ? orders.verificationPlannedAt : orders.portalPlannedAt;
    const actual = scope === 'verification' ? orders.verificationActualAt : orders.portalActualAt;
    return view === 'completed' ? [desc(actual)] : [sql`${planned} ASC NULLS LAST`, asc(orders.taskSeq)];
  }
  if (view === 'follow_up') return [asc(orders.followUpDone), desc(orders.orderDate)];
  return [desc(orders.orderDate), desc(orders.taskSeq)];
}

function searchFilter(search?: string): SQL | undefined {
  if (!search) return undefined;
  const term = `%${search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  return or(
    ilike(orders.taskId, term),
    ilike(orders.orderNumber, term),
    ilike(orders.customerName, term),
    ilike(orders.phone, term)
  );
}

export const ordersService = {
  async list(ventureId: string, userId: string, query: ListOrdersQuery): Promise<OrderListResult> {
    const views = scopeViews(query.scope, userId);
    const viewFilter = views[query.view];
    if (!viewFilter) throw new BadRequestError(`The "${query.view}" view is not available here.`);
    const where = and(eq(orders.ventureId, ventureId), viewFilter, searchFilter(query.search));

    // A step screen shows that step's owner; the Orders screen shows whoever owns the current step.
    const ownerName =
      query.scope === 'verification' ? verifier.name : query.scope === 'portal' ? portalUser.name : currentAssigneeName;

    // Tab counts ignore the active tab but honour the search box.
    const countColumns = Object.fromEntries(
      Object.entries(views).map(([name, filter]) => [name, sql<number>`count(*) FILTER (WHERE ${filter})::int`])
    );

    const [rows, [counts]] = await Promise.all([
      db
        .select({
          id: orders.id,
          taskId: orders.taskId,
          orderNumber: orders.orderNumber,
          orderDate: orders.orderDate,
          customerName: orders.customerName,
          phone: orders.phone,
          products: orders.products,
          totalAmount: orders.totalAmount,
          stage: orders.stage,
          assigneeName: ownerName,
          plannedAt: sql<Date | null>`${openPlannedAt}`.mapWith(orders.verificationPlannedAt),
          delayMinutes,
          followUpRequired: orders.followUpRequired,
          followUpDone: orders.followUpDone,
        })
        .from(orders)
        .leftJoin(verifier, eq(verifier.id, orders.verificationAssignee))
        .leftJoin(portalUser, eq(portalUser.id, orders.portalAssignee))
        .where(where)
        .orderBy(...scopeOrder(query.scope, query.view))
        .limit(query.limit)
        .offset(query.offset),
      db
        .select(countColumns)
        .from(orders)
        .where(and(eq(orders.ventureId, ventureId), searchFilter(query.search))),
    ]);

    return {
      orders: rows.map(
        (r): OrderListItem => ({
          ...r,
          orderDate: r.orderDate.toISOString(),
          plannedAt: r.plannedAt?.toISOString() ?? null,
          totalAmount: Number(r.totalAmount),
          delayStatus: delayStatus(r.stage, r.delayMinutes),
        })
      ),
      views: Object.keys(views) as OrderView[],
      counts: counts as Record<string, number>,
    };
  },

  async get(ventureId: string, id: string, actor: Actor): Promise<OrderDetail> {
    const [row] = await db
      .select({
        order: orders,
        verificationAssigneeName: verifier.name,
        portalAssigneeName: portalUser.name,
        delayMinutes,
      })
      .from(orders)
      .leftJoin(verifier, eq(verifier.id, orders.verificationAssignee))
      .leftJoin(portalUser, eq(portalUser.id, orders.portalAssignee))
      .where(and(eq(orders.ventureId, ventureId), eq(orders.id, id)))
      .limit(1);
    if (!row) throw new NotFoundError('Order not found');

    const events = await db
      .select({
        id: orderEvents.id,
        step: orderEvents.step,
        event: orderEvents.event,
        at: orderEvents.at,
        note: orderEvents.note,
        byUserName: users.name,
      })
      .from(orderEvents)
      .leftJoin(users, eq(users.id, orderEvents.byUser))
      .where(and(eq(orderEvents.ventureId, ventureId), eq(orderEvents.orderId, id)))
      .orderBy(asc(orderEvents.at));

    const o = row.order;
    const iso = (d: Date | null) => d?.toISOString() ?? null;
    const num = (v: string | null) => (v === null ? null : Number(v));

    // What this person may do with this order. The client shows forms from these flags only.
    const [auth, ctx] = await Promise.all([loadAuthority(actor), loadShiftsContext(ventureId)]);
    const pendingStep = o.stage === 'verification_pending' ? 'verification' : o.stage === 'portal_pending' ? 'portal' : null;
    const capabilities: OrderCapabilities = {
      canEditVerification: o.stage === 'verification_pending' && canEditStep(auth, ctx, o.verificationAssignee),
      canEditPortal: o.stage === 'portal_pending' && canEditStep(auth, ctx, o.portalAssignee),
      canEditFollowUp: o.followUpRequired,
      /** Which step may be reassigned (the one the order is waiting on), or null. */
      reassignStep: pendingStep && canEditShifts(auth, ctx) ? pendingStep : null,
    };

    return {
      id: o.id,
      taskId: o.taskId,
      shopifyOrderId: String(o.shopifyOrderId),
      orderNumber: o.orderNumber,
      orderDate: o.orderDate.toISOString(),
      customerName: o.customerName,
      phone: o.phone,
      address: o.address,
      city: o.city,
      state: o.state,
      pincode: o.pincode,
      products: o.products,
      totalQty: o.totalQty,
      totalAmount: Number(o.totalAmount),
      paymentMethod: o.paymentMethod,
      channel: o.channel,
      financialStatus: o.financialStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      cancelledInShopify: !!(o.rawPayload as { cancelled_at?: string | null } | null)?.cancelled_at,
      stage: o.stage,
      scanOutcome: o.scanOutcome,
      scanAt: iso(o.scanAt),
      finalResponse: o.finalResponse,
      collectedAmount: num(o.collectedAmount),
      balanceAmount: num(o.balanceAmount),
      addressConfirmed: o.addressConfirmed,
      newAddress: o.newAddress,
      screenshotUrl: o.screenshotUrl,
      crmRemarks: o.crmRemarks,
      portalAction: o.portalAction,
      portalDone: o.portalDone,
      adminRemarks: o.adminRemarks,
      followUpRequired: o.followUpRequired,
      followUpDone: o.followUpDone,
      followUpNotes: o.followUpNotes,
      verificationAssignee: o.verificationAssignee ? { id: o.verificationAssignee, name: row.verificationAssigneeName ?? '' } : null,
      verificationPlannedAt: iso(o.verificationPlannedAt),
      verificationActualAt: iso(o.verificationActualAt),
      portalAssignee: o.portalAssignee ? { id: o.portalAssignee, name: row.portalAssigneeName ?? '' } : null,
      portalPlannedAt: iso(o.portalPlannedAt),
      portalActualAt: iso(o.portalActualAt),
      delayMinutes: row.delayMinutes,
      delayStatus: delayStatus(o.stage, row.delayMinutes),
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      timeline: events.map((e) => ({
        id: e.id,
        step: e.step,
        event: e.event,
        at: e.at.toISOString(),
        note: e.note,
        byUserName: e.byUserName,
      })),
      capabilities,
    };
  },
};

