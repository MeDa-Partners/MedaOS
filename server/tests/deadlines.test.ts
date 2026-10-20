import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DEADLINE_SETTINGS,
  delayMinutes,
  parseTimeOfDay,
  plannedPortalAt,
  plannedVerificationAt,
} from '../src/modules/orders/deadlines';

// 19 Oct 2026 is a Monday.
const ist = (s: string) => new Date(`${s}+05:30`);

describe('plannedVerificationAt — worked examples from spec v2 §5.1', () => {
  it.each([
    ['Mon 10:15', '2026-10-19T10:15:00', '2026-10-19T10:20:00'],
    ['Mon 17:58', '2026-10-19T17:58:00', '2026-10-19T18:03:00'],
    ['Mon 18:30', '2026-10-19T18:30:00', '2026-10-20T11:00:00'],
    ['Tue 03:00', '2026-10-20T03:00:00', '2026-10-20T11:00:00'],
    ['Tue 08:45', '2026-10-20T08:45:00', '2026-10-20T11:00:00'],
  ])('%s', (_label, arrived, planned) => {
    expect(plannedVerificationAt(ist(arrived)).getTime()).toBe(ist(planned).getTime());
  });

  it('treats office start as in-hours and office end as after-hours', () => {
    expect(plannedVerificationAt(ist('2026-10-19T09:00:00')).getTime()).toBe(ist('2026-10-19T09:05:00').getTime());
    expect(plannedVerificationAt(ist('2026-10-19T18:00:00')).getTime()).toBe(ist('2026-10-20T11:00:00').getTime());
  });

  it('uses IST wall-clock time, whatever the server timezone', () => {
    // 23:30 IST Monday = 18:00 UTC Monday. Must roll to Tuesday 11:00 IST.
    expect(plannedVerificationAt(new Date('2026-10-19T18:00:00Z')).getTime()).toBe(ist('2026-10-20T11:00:00').getTime());
    // 00:30 IST Tuesday = 19:00 UTC Monday. Same-morning batch: Tuesday 11:00 IST.
    expect(plannedVerificationAt(new Date('2026-10-19T19:00:00Z')).getTime()).toBe(ist('2026-10-20T11:00:00').getTime());
  });

  it('follows the venture settings', () => {
    const s = { ...DEFAULT_DEADLINE_SETTINGS, officeStartMinute: 600, officeEndMinute: 1200, overnightDeadlineMinute: 720, verificationTatMinutes: 10 };
    expect(plannedVerificationAt(ist('2026-10-19T19:00:00'), s).getTime()).toBe(ist('2026-10-19T19:10:00').getTime());
    expect(plannedVerificationAt(ist('2026-10-19T09:30:00'), s).getTime()).toBe(ist('2026-10-19T12:00:00').getTime());
  });
});

describe('plannedPortalAt', () => {
  it('is verification completed + 30 minutes, with no office-hours clamping', () => {
    expect(plannedPortalAt(ist('2026-10-19T17:50:00')).getTime()).toBe(ist('2026-10-19T18:20:00').getTime());
    expect(plannedPortalAt(ist('2026-10-19T23:45:00')).getTime()).toBe(ist('2026-10-20T00:15:00').getTime());
  });
});

describe('delayMinutes', () => {
  it('is positive minutes late, using now while the step is open', () => {
    const planned = ist('2026-10-19T12:00:00');
    expect(delayMinutes(planned, ist('2026-10-19T13:30:00'))).toBe(90);
    expect(delayMinutes(planned, ist('2026-10-19T11:00:00'))).toBe(0);
    expect(delayMinutes(planned, null, ist('2026-10-19T12:10:00'))).toBe(10);
  });
});

describe('parseTimeOfDay', () => {
  it('reads HH:MM and Postgres time values', () => {
    expect(parseTimeOfDay('09:00')).toBe(540);
    expect(parseTimeOfDay('18:00:00')).toBe(1080);
    expect(() => parseTimeOfDay('24:00')).toThrow();
  });
});
