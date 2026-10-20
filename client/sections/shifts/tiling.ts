/**
 * Live warning while editing shifts: do the rows cover all 24 hours exactly once?
 * Mirrors the server's check (server/src/modules/orders/shifts.service.ts), which is the one
 * that decides on save. A shift with start > end crosses midnight; start = end covers the day.
 */

const DAY = 24 * 60;
const toMin = (t: string) => {
  const m = /^(\d{2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function covers(start: number, end: number, minute: number) {
  if (start === end) return true;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

function ranges(minutes: number[]): string {
  const out: string[] = [];
  let from = -1;
  let prev = -2;
  for (const m of [...minutes, -1]) {
    if (m !== prev + 1) {
      if (from >= 0) out.push(`${hhmm(from)}–${hhmm(prev + 1)}`);
      from = m;
    }
    prev = m;
  }
  return out.join(', ');
}

export function shiftProblems(rows: { name: string; startTime: string; endTime: string }[]): string[] {
  if (rows.length === 0) return ['Add at least one shift.'];
  const problems: string[] = [];
  if (rows.length > 5) problems.push('A step can have at most 5 shifts.');
  if (rows.some((r) => !r.name.trim())) problems.push('Every shift needs a name.');
  const parsed = rows.map((r) => ({ start: toMin(r.startTime), end: toMin(r.endTime) }));
  if (parsed.some((p) => Number.isNaN(p.start) || Number.isNaN(p.end))) return [...problems, 'Every shift needs a start and end time.'];

  const count = Array.from({ length: DAY }, (_, m) => parsed.filter((p) => covers(p.start, p.end, m)).length);
  const gaps = count.flatMap((c, m) => (c === 0 ? [m] : []));
  const overlaps = count.flatMap((c, m) => (c > 1 ? [m] : []));
  if (gaps.length) problems.push(`Not covered by any shift: ${ranges(gaps)}.`);
  if (overlaps.length) problems.push(`Shifts overlap at ${ranges(overlaps)}.`);
  return problems;
}
