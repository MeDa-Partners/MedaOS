/**
 * Planned times (deadlines) for the two steps. Pure functions; all wall-clock maths is in
 * Asia/Kolkata (UTC+05:30, no daylight saving). Office hours run every day: no weekly off, no
 * holidays (spec v2 §5).
 *
 *   Verification: arrived inside office hours → arrival + 5 min.
 *                 arrived outside → 11:00 the same morning (before opening) or the next
 *                 morning (after closing).
 *   Portal:       verification completed + 30 min, no office-hours clamping.
 *
 * The numbers come from process_settings so a change of hours needs no code change.
 */

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

export interface DeadlineSettings {
  /** Minutes after midnight IST. */
  officeStartMinute: number;
  officeEndMinute: number;
  overnightDeadlineMinute: number;
  verificationTatMinutes: number;
  portalTatMinutes: number;
}

/** 09:00–18:00, overnight batch due 11:00, 5 min in-hours, 30 min portal. */
export const DEFAULT_DEADLINE_SETTINGS: DeadlineSettings = {
  officeStartMinute: 9 * 60,
  officeEndMinute: 18 * 60,
  overnightDeadlineMinute: 11 * 60,
  verificationTatMinutes: 5,
  portalTatMinutes: 30,
};

/** 'HH:MM' or 'HH:MM:SS' (a Postgres `time`) → minutes after midnight. */
export function parseTimeOfDay(value: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/.exec(value.trim());
  if (!m) throw new Error(`Invalid time of day: "${value}"`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Milliseconds since IST midnight, and the UTC instant of that midnight. */
function istDay(at: Date): { msIntoDay: number; midnight: number } {
  const ist = at.getTime() + IST_OFFSET_MS;
  const dayStartIst = Math.floor(ist / DAY_MS) * DAY_MS;
  return { msIntoDay: ist - dayStartIst, midnight: dayStartIst - IST_OFFSET_MS };
}

export function plannedVerificationAt(arrivedAt: Date, s: DeadlineSettings = DEFAULT_DEADLINE_SETTINGS): Date {
  if (!(s.officeStartMinute < s.officeEndMinute)) throw new Error('Office hours must start before they end');
  const { msIntoDay, midnight } = istDay(arrivedAt);
  const start = s.officeStartMinute * MIN_MS;
  const end = s.officeEndMinute * MIN_MS;

  if (msIntoDay >= start && msIntoDay < end) {
    return new Date(arrivedAt.getTime() + s.verificationTatMinutes * MIN_MS);
  }
  const day = msIntoDay >= end ? midnight + DAY_MS : midnight;
  return new Date(day + s.overnightDeadlineMinute * MIN_MS);
}

export function plannedPortalAt(verificationCompletedAt: Date, s: DeadlineSettings = DEFAULT_DEADLINE_SETTINGS): Date {
  return new Date(verificationCompletedAt.getTime() + s.portalTatMinutes * MIN_MS);
}

/** Positive minutes late, else 0. Uses `now` while the step is still open. */
export function delayMinutes(planned: Date, actual: Date | null, now = new Date()): number {
  return Math.max(0, Math.floor(((actual ?? now).getTime() - planned.getTime()) / MIN_MS));
}
