import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { assignmentShifts, orders, userMemberships, users } from '../../db/schema';
import { parseTimeOfDay } from './deadlines';
import { ORDER_STEPS, OrderStep } from './orders.types';
import { SaveShiftsInput } from './orders.validation';
import { BadRequestError, ForbiddenError } from '../../utils/errors';
import { Actor, canEditShifts, listSectionHolders, loadAuthority, loadSectionRef, ShiftsContext } from '../../utils/access';

/**
 * Shift-based assignment (spec v2 §4). An order is assigned once, when it enters a step, to the
 * owner of the shift covering its arrival time (Asia/Kolkata). Shifts of a step must tile all
 * 24 hours; a shift whose start is after its end crosses midnight and is one row.
 */

export const MAX_SHIFTS_PER_STEP = 5;
const DAY_MINUTES = 24 * 60;
const IST_OFFSET_MIN = 330;

export interface ShiftTimes {
  name: string;
  /** 'HH:MM' or 'HH:MM:SS'. */
  startTime: string;
  endTime: string;
}

/** Minute of the day (0–1439) in Asia/Kolkata. */
export function istMinuteOfDay(at: Date): number {
  const minutes = Math.floor(at.getTime() / 60000) + IST_OFFSET_MIN;
  return ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

/** start < end: [start, end). start > end: crosses midnight. start = end: all day. */
export function shiftCovers(shift: ShiftTimes, minute: number): boolean {
  const start = parseTimeOfDay(shift.startTime);
  const end = parseTimeOfDay(shift.endTime);
  if (start === end) return true;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

/** The shift covering `arrivedAt`, or null when none does (misconfigured). */
export function findShift<T extends ShiftTimes>(shifts: T[], arrivedAt: Date): T | null {
  const minute = istMinuteOfDay(arrivedAt);
  return shifts.find((s) => shiftCovers(s, minute)) ?? null;
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Groups consecutive minutes into "HH:MM–HH:MM" ranges. */
function ranges(minutes: number[]): string[] {
  const out: string[] = [];
  let from = -1;
  let prev = -2;
  for (const m of [...minutes, -1]) {
    if (m !== prev + 1) {
      if (from >= 0) out.push(`${hhmm(from)}–${hhmm((prev + 1) % DAY_MINUTES)}`);
      from = m;
    }
    prev = m;
  }
  return out;
}

/**
 * Problems with a step's shifts, as messages a head can act on; empty when valid.
 * Valid = 1 to 5 named shifts that together cover every minute of the day exactly once.
 */
export function validateShiftTiling(shifts: ShiftTimes[]): string[] {
  const errors: string[] = [];
  if (shifts.length === 0) return ['Add at least one shift.'];
  if (shifts.length > MAX_SHIFTS_PER_STEP) errors.push(`A step can have at most ${MAX_SHIFTS_PER_STEP} shifts.`);

  const parsed: { name: string; start: number; end: number }[] = [];
  for (const s of shifts) {
    if (!s.name.trim()) errors.push('Every shift needs a name.');
    try {
      parsed.push({ name: s.name.trim() || 'Unnamed shift', start: parseTimeOfDay(s.startTime), end: parseTimeOfDay(s.endTime) });
    } catch {
      errors.push(`"${s.name || 'Unnamed shift'}" has an invalid time. Use HH:MM.`);
    }
  }
  if (errors.length) return errors;

  const coveredBy: string[][] = Array.from({ length: DAY_MINUTES }, () => []);
  for (const s of parsed) {
    for (let m = 0; m < DAY_MINUTES; m++) {
      if (shiftCovers({ name: s.name, startTime: hhmm(s.start), endTime: hhmm(s.end) }, m)) coveredBy[m].push(s.name);
    }
  }

  const gaps = coveredBy.flatMap((names, m) => (names.length === 0 ? [m] : []));
  if (gaps.length) errors.push(`Not covered by any shift: ${ranges(gaps).join(', ')}.`);

  const overlapMinutes = coveredBy.flatMap((names, m) => (names.length > 1 ? [m] : []));
  if (overlapMinutes.length) {
    const who = [...new Set(overlapMinutes.flatMap((m) => coveredBy[m]))].join(', ');
    errors.push(`Shifts overlap at ${ranges(overlapMinutes).join(', ')} (${who}).`);
  }
  return errors;
}

export interface ShiftOwner {
  userId: string;
  userName: string;
  shiftName: string;
}

/**
 * Loads a step's shifts once and returns a lookup for arrival times. The owner counts only if
 * they are still active and still in the venture; otherwise the order stays unassigned and shows
 * up in the Shifts screen's unassigned count, never silently dropped.
 */
export async function createShiftOwnerLookup(ventureId: string, step: OrderStep) {
  const rows = await db
    .select({
      name: assignmentShifts.name,
      startTime: assignmentShifts.startTime,
      endTime: assignmentShifts.endTime,
      userId: users.id,
      userName: users.name,
      userStatus: users.status,
      membershipId: userMemberships.id,
    })
    .from(assignmentShifts)
    .leftJoin(users, eq(users.id, assignmentShifts.assigneeUserId))
    .leftJoin(
      userMemberships,
      and(eq(userMemberships.userId, assignmentShifts.assigneeUserId), eq(userMemberships.ventureId, ventureId))
    )
    .where(and(eq(assignmentShifts.ventureId, ventureId), eq(assignmentShifts.step, step)))
    .orderBy(asc(assignmentShifts.sortOrder));

  return (arrivedAt: Date): { owner: ShiftOwner | null; reason?: string } => {
    const shift = findShift(rows, arrivedAt);
    if (!shift) return { owner: null, reason: 'no shift covers this time' };
    if (!shift.userId) return { owner: null, reason: `shift "${shift.name}" has no owner` };
    if (shift.userStatus !== 'active' || !shift.membershipId) {
      return { owner: null, reason: `${shift.userName}, owner of "${shift.name}", is inactive or not in this venture` };
    }
    return { owner: { userId: shift.userId, userName: shift.userName!, shiftName: shift.name } };
  };
}

/** Where the `shifts` section lives in this venture: the context for the order-work rules in access.ts. */
export async function loadShiftsContext(ventureId: string): Promise<ShiftsContext> {
  const ref = await loadSectionRef(ventureId, 'shifts');
  return { departmentId: ref?.departmentId ?? null, shiftsSectionId: ref?.id ?? null };
}

/** The section a step's owner must hold. */
export const STEP_SECTION: Record<OrderStep, string> = { verification: 'verification', portal: 'portal-actions' };

// ───────────── Shifts screen (GET / PUT /shifts) ─────────────

export interface StepShiftsView {
  shifts: { id: string; name: string; startTime: string; endTime: string; assigneeUserId: string | null; assigneeName: string | null }[];
  /** People who may own this step: active in the venture and able to open its section. */
  candidates: { userId: string; name: string }[];
  /** Orders waiting on this step with nobody owning them. */
  unassigned: number;
  /** Pending orders per owner, for "move all of X's pending orders to Y". */
  pendingByOwner: { userId: string; name: string; pending: number }[];
  /** Problems with the saved shifts (gaps, overlaps); empty when they tile 24 hours. */
  problems: string[];
}

const HHMM = (t: string) => t.slice(0, 5);
const PENDING_STAGE: Record<OrderStep, string> = { verification: 'verification_pending', portal: 'portal_pending' };

export async function getShiftsOverview(ventureId: string, actor: Actor) {
  const [auth, ctx] = await Promise.all([loadAuthority(actor), loadShiftsContext(ventureId)]);

  const steps = {} as Record<OrderStep, StepShiftsView>;
  for (const step of ORDER_STEPS) {
    const owner = step === 'verification' ? orders.verificationAssignee : orders.portalAssignee;
    const [rows, candidates, pending] = await Promise.all([
      db
        .select({
          id: assignmentShifts.id,
          name: assignmentShifts.name,
          startTime: assignmentShifts.startTime,
          endTime: assignmentShifts.endTime,
          assigneeUserId: assignmentShifts.assigneeUserId,
          assigneeName: users.name,
        })
        .from(assignmentShifts)
        .leftJoin(users, eq(users.id, assignmentShifts.assigneeUserId))
        .where(and(eq(assignmentShifts.ventureId, ventureId), eq(assignmentShifts.step, step)))
        .orderBy(asc(assignmentShifts.sortOrder)),
      listSectionHolders(ventureId, STEP_SECTION[step]),
      db
        .select({ userId: owner, name: users.name, pending: sql<number>`count(*)::int` })
        .from(orders)
        .leftJoin(users, eq(users.id, owner))
        .where(and(eq(orders.ventureId, ventureId), eq(orders.stage, PENDING_STAGE[step])))
        .groupBy(owner, users.name),
    ]);
    const shifts = rows.map((r) => ({ ...r, startTime: HHMM(r.startTime), endTime: HHMM(r.endTime) }));
    steps[step] = {
      shifts,
      candidates: candidates.map((c) => ({ userId: c.userId, name: c.name })),
      unassigned: pending.find((p) => p.userId === null)?.pending ?? 0,
      pendingByOwner: pending.filter((p) => p.userId !== null).map((p) => ({ userId: p.userId!, name: p.name ?? 'Unknown', pending: p.pending })),
      problems: shifts.length ? validateShiftTiling(shifts) : [],
    };
  }

  return { steps, capabilities: { canEditShifts: canEditShifts(auth, ctx) } };
}

/**
 * Replaces a step's shifts. Rejected unless they tile 24 hours and every owner may hold the step.
 * Orders already assigned keep their owner (use bulk reassign to move them): changing a shift
 * must not silently move work someone has started.
 */
export async function saveShifts(ventureId: string, actor: Actor, input: SaveShiftsInput) {
  const [auth, ctx] = await Promise.all([loadAuthority(actor), loadShiftsContext(ventureId)]);
  if (!canEditShifts(auth, ctx)) throw new ForbiddenError('Only a department head, a team head with Shifts, or an admin can edit shifts.');

  const problems = validateShiftTiling(input.shifts);
  if (problems.length) throw new BadRequestError(problems.join(' '), problems);

  const holders = new Set((await listSectionHolders(ventureId, STEP_SECTION[input.step])).map((h) => h.userId));
  const badOwner = input.shifts.find((s) => s.assigneeUserId && !holders.has(s.assigneeUserId));
  if (badOwner) {
    throw new BadRequestError(
      `The owner of "${badOwner.name}" can't take these orders: they must be active in this venture and have the step's section.`
    );
  }

  await db.transaction(async (tx) => {
    await tx.delete(assignmentShifts).where(and(eq(assignmentShifts.ventureId, ventureId), eq(assignmentShifts.step, input.step)));
    if (input.shifts.length) {
      await tx.insert(assignmentShifts).values(
        input.shifts.map((s, i) => ({ ventureId, step: input.step, name: s.name, startTime: s.startTime, endTime: s.endTime, assigneeUserId: s.assigneeUserId, sortOrder: i }))
      );
    }
  });
  return getShiftsOverview(ventureId, actor);
}
