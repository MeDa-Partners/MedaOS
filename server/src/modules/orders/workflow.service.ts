import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { NewOrder, NewOrderEvent, orderEvents, orders, userMemberships, users } from '../../db/schema';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors';
import {
  Actor,
  canEditStep,
  canReassignOrder,
  listSectionHolders,
  loadAuthority,
  MembershipRef,
} from '../../utils/access';
import { FinalResponse, OrderStep, ScanOutcome, SCAN_GOOD_TO_GO } from './orders.types';
import { BulkReassignInput, FollowUpUpdate, PortalUpdate, ReassignInput, VerificationUpdate } from './orders.validation';
import { routeAfterVerification, stageAfterPortal } from './routing';
import { plannedPortalAt } from './deadlines';
import { getDeadlineSettings } from './settings.service';
import { createShiftOwnerLookup, loadShiftsContext, STEP_SECTION } from './shifts.service';

/**
 * Everything that changes an order after the sync created it: the verification and portal steps,
 * the follow-up, and reassignment. Each change locks the order row, checks the access rules in
 * utils/access.ts, and writes the timeline (order_events) in the same transaction.
 */

const STAGE_TEXT: Record<string, string> = {
  new: 'new',
  verification_pending: 'waiting for verification',
  portal_pending: 'waiting for the portal step',
  done: 'done',
  closed: 'closed',
};

const PENDING_STAGE: Record<OrderStep, string> = { verification: 'verification_pending', portal: 'portal_pending' };
const STEP_LABEL: Record<OrderStep, string> = { verification: 'Verification & Calls', portal: 'Portal Actions' };

const money = (v: number | null | undefined) => (v === undefined ? undefined : v === null ? null : v.toFixed(2));

async function lockOrder(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], ventureId: string, id: string) {
  const [order] = await tx
    .select()
    .from(orders)
    .where(and(eq(orders.ventureId, ventureId), eq(orders.id, id)))
    .for('update');
  if (!order) throw new NotFoundError('Order not found');
  return order;
}

async function membershipRef(ventureId: string, userId: string | null): Promise<MembershipRef | null> {
  if (!userId) return null;
  const [m] = await db
    .select({ userId: userMemberships.userId, departmentId: userMemberships.departmentId, teamId: userMemberships.teamId })
    .from(userMemberships)
    .where(and(eq(userMemberships.ventureId, ventureId), eq(userMemberships.userId, userId)))
    .limit(1);
  return m ? { ...m, ventureId } : null;
}

/** Hard rule: a step's owner must be active in the venture and able to open that step's section. */
export async function assertCanOwnStep(ventureId: string, step: OrderStep, userId: string) {
  const holder = (await listSectionHolders(ventureId, STEP_SECTION[step])).find((h) => h.userId === userId);
  if (!holder) {
    throw new BadRequestError(
      `That person can't own ${STEP_LABEL[step]} orders: they must be active in this venture and have the ${STEP_LABEL[step]} section.`
    );
  }
  return holder;
}

async function userName(userId: string | null): Promise<string> {
  if (!userId) return 'Unassigned';
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.name ?? 'Unknown';
}

export const workflowService = {
  /** Steps 1 & 2: scan outcome, call result and the details captured on the call. */
  async updateVerification(ventureId: string, id: string, actor: Actor, input: VerificationUpdate): Promise<void> {
    const [auth, ctx, settings, portalOwnerAt] = await Promise.all([
      loadAuthority(actor),
      loadShiftsContext(ventureId),
      getDeadlineSettings(ventureId),
      createShiftOwnerLookup(ventureId, 'portal'),
    ]);

    await db.transaction(async (tx) => {
      const o = await lockOrder(tx, ventureId, id);
      if (o.stage !== 'verification_pending') {
        throw new ConflictError(`This order is no longer waiting for verification (it is ${STAGE_TEXT[o.stage] ?? o.stage}).`);
      }
      if (!canEditStep(auth, ctx, o.verificationAssignee)) {
        throw new ForbiddenError("Only this order's verification owner, a head or an admin can update it.");
      }

      const scan = (input.scanOutcome ?? o.scanOutcome) as ScanOutcome | null;
      const response = (input.finalResponse ?? o.finalResponse) as FinalResponse | null;
      if (input.finalResponse && !scan) {
        throw new BadRequestError("Set the scan outcome before the customer's final response.");
      }
      if (input.finalResponse && scan !== SCAN_GOOD_TO_GO) {
        throw new BadRequestError('This scan outcome cancels the order, so there is no customer response to record.');
      }

      const now = new Date();
      const set: Partial<NewOrder> = { updatedAt: now };
      const events: NewOrderEvent[] = [];
      const event = (step: string, name: string, note: string | null, byUser: string | null = actor.id) =>
        events.push({ ventureId, orderId: o.id, step, event: name, note, byUser, at: now });

      if (input.collectedAmount !== undefined) set.collectedAmount = money(input.collectedAmount);
      if (input.balanceAmount !== undefined) set.balanceAmount = money(input.balanceAmount);
      if (input.addressConfirmed !== undefined) set.addressConfirmed = input.addressConfirmed;
      if (input.newAddress !== undefined) set.newAddress = input.newAddress || null;
      if (input.crmRemarks !== undefined) set.crmRemarks = input.crmRemarks || null;
      if (input.finalResponse) set.finalResponse = input.finalResponse;
      if (input.scanOutcome && input.scanOutcome !== o.scanOutcome) {
        set.scanOutcome = input.scanOutcome;
        set.scanAt = now;
        event('verification', 'scanned', input.scanOutcome);
      }

      const route = routeAfterVerification(scan, response);
      if (route) {
        set.stage = route.stage;
        set.portalAction = route.portalAction;
        set.followUpRequired = route.followUpRequired;
        set.verificationActualAt = now;
        event('verification', 'completed', response ?? scan);
        if (route.stage === 'portal_pending') {
          const { owner, reason } = portalOwnerAt(now);
          set.portalAssignee = owner?.userId ?? null;
          set.portalPlannedAt = plannedPortalAt(now, settings);
          event(
            'portal',
            owner ? 'assigned' : 'unassigned',
            owner ? `${owner.userName} (${owner.shiftName})` : `Waiting for a head to assign: ${reason}`,
            null
          );
        }
      }

      await tx.update(orders).set(set).where(eq(orders.id, o.id));
      if (events.length) await tx.insert(orderEvents).values(events);
    });
  },

  /** Step 3: the portal action and marking it done in ClickPost. */
  async updatePortal(ventureId: string, id: string, actor: Actor, input: PortalUpdate): Promise<void> {
    const [auth, ctx] = await Promise.all([loadAuthority(actor), loadShiftsContext(ventureId)]);

    await db.transaction(async (tx) => {
      const o = await lockOrder(tx, ventureId, id);
      if (o.stage !== 'portal_pending') {
        throw new ConflictError(`This order is not waiting for the portal step (it is ${STAGE_TEXT[o.stage] ?? o.stage}).`);
      }
      if (!canEditStep(auth, ctx, o.portalAssignee)) {
        throw new ForbiddenError("Only this order's portal owner, a head or an admin can update it.");
      }

      const action = input.portalAction ?? o.portalAction;
      if (input.portalDone && !action) throw new BadRequestError('Choose the portal action before marking it done.');

      const now = new Date();
      const set: Partial<NewOrder> = { updatedAt: now };
      if (input.portalAction) set.portalAction = input.portalAction;
      if (input.adminRemarks !== undefined) set.adminRemarks = input.adminRemarks || null;
      if (input.portalDone) {
        set.portalDone = true;
        set.portalActualAt = now;
        set.stage = stageAfterPortal(o.followUpRequired);
      }

      await tx.update(orders).set(set).where(eq(orders.id, o.id));
      if (input.portalDone) {
        await tx.insert(orderEvents).values({ ventureId, orderId: o.id, step: 'portal', event: 'completed', note: action, byUser: actor.id, at: now });
      }
    });
  },

  /** Soft Refused follow-up: anyone holding the Orders section (checked by the route). */
  async updateFollowUp(ventureId: string, id: string, actor: Actor, input: FollowUpUpdate): Promise<void> {
    await db.transaction(async (tx) => {
      const o = await lockOrder(tx, ventureId, id);
      if (!o.followUpRequired) throw new ConflictError('This order does not need a follow-up.');

      const now = new Date();
      const set: Partial<NewOrder> = { updatedAt: now };
      if (input.followUpNotes !== undefined) set.followUpNotes = input.followUpNotes || null;
      if (input.followUpDone !== undefined) set.followUpDone = input.followUpDone;

      await tx.update(orders).set(set).where(eq(orders.id, o.id));
      if (input.followUpDone !== undefined && input.followUpDone !== o.followUpDone) {
        await tx.insert(orderEvents).values({
          ventureId,
          orderId: o.id,
          step: 'follow_up',
          event: input.followUpDone ? 'done' : 'reopened',
          note: input.followUpNotes || o.followUpNotes || null,
          byUser: actor.id,
          at: now,
        });
      }
    });
  },

  /** Change who owns the step an order is waiting on. */
  async reassign(ventureId: string, id: string, actor: Actor, input: ReassignInput): Promise<void> {
    const [auth, ctx] = await Promise.all([loadAuthority(actor), loadShiftsContext(ventureId)]);
    const toRef = input.userId ? (await assertCanOwnStep(ventureId, input.step, input.userId)).membership : null;
    const ownerColumn = input.step === 'verification' ? 'verificationAssignee' : 'portalAssignee';

    await db.transaction(async (tx) => {
      const o = await lockOrder(tx, ventureId, id);
      if (o.stage !== PENDING_STAGE[input.step]) {
        throw new ConflictError(`Only an order waiting on ${STEP_LABEL[input.step]} can be reassigned for it.`);
      }
      const fromId = o[ownerColumn];
      if (fromId === input.userId) return;
      if (!canReassignOrder(auth, ctx, await membershipRef(ventureId, fromId), toRef)) {
        throw new ForbiddenError("You can't move this order to that person.");
      }

      await tx.update(orders).set({ [ownerColumn]: input.userId, updatedAt: new Date() }).where(eq(orders.id, o.id));
      await tx.insert(orderEvents).values({
        ventureId,
        orderId: o.id,
        step: input.step,
        event: 'reassigned',
        note: `${await userName(fromId)} → ${await userName(input.userId)}`,
        byUser: actor.id,
      });
    });
  },

  /** Move all of one person's (or the unassigned) pending orders for a step to someone else. */
  async bulkReassign(ventureId: string, actor: Actor, input: BulkReassignInput): Promise<{ moved: number }> {
    const [auth, ctx] = await Promise.all([loadAuthority(actor), loadShiftsContext(ventureId)]);
    const to = await assertCanOwnStep(ventureId, input.step, input.toUserId);
    if (input.fromUserId === input.toUserId) return { moved: 0 };
    if (!canReassignOrder(auth, ctx, await membershipRef(ventureId, input.fromUserId), to.membership)) {
      throw new ForbiddenError("You can't move these orders to that person.");
    }

    const owner = input.step === 'verification' ? orders.verificationAssignee : orders.portalAssignee;
    const ownerColumn = input.step === 'verification' ? 'verificationAssignee' : 'portalAssignee';
    const note = `${await userName(input.fromUserId)} → ${to.name} (bulk)`;

    return db.transaction(async (tx) => {
      const moved = await tx
        .update(orders)
        .set({ [ownerColumn]: input.toUserId, updatedAt: new Date() })
        .where(
          and(
            eq(orders.ventureId, ventureId),
            eq(orders.stage, PENDING_STAGE[input.step]),
            input.fromUserId ? eq(owner, input.fromUserId) : isNull(owner)
          )
        )
        .returning({ id: orders.id });
      if (moved.length) {
        await tx.insert(orderEvents).values(
          moved.map((m) => ({ ventureId, orderId: m.id, step: input.step, event: 'reassigned', note, byUser: actor.id }))
        );
      }
      return { moved: moved.length };
    });
  },
};

