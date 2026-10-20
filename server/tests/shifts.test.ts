import { describe, it, expect } from 'vitest';
import { findShift, istMinuteOfDay, shiftCovers, validateShiftTiling } from '../src/modules/orders/shifts.service';

const ist = (s: string) => new Date(`${s}+05:30`);
const day = { name: 'Day Shift', startTime: '09:00', endTime: '18:00' };
const night = { name: 'Night Shift', startTime: '18:00', endTime: '09:00' };

describe('findShift', () => {
  it('picks the day shift inside its window, start inclusive and end exclusive', () => {
    expect(findShift([day, night], ist('2026-10-19T09:00:00'))?.name).toBe('Day Shift');
    expect(findShift([day, night], ist('2026-10-19T17:59:59'))?.name).toBe('Day Shift');
    expect(findShift([day, night], ist('2026-10-19T18:00:00'))?.name).toBe('Night Shift');
  });

  it('treats a shift crossing midnight as two windows', () => {
    expect(findShift([day, night], ist('2026-10-19T23:30:00'))?.name).toBe('Night Shift');
    expect(findShift([day, night], ist('2026-10-20T03:00:00'))?.name).toBe('Night Shift');
    expect(findShift([day, night], ist('2026-10-20T08:59:00'))?.name).toBe('Night Shift');
  });

  it('returns null when no shift covers the time', () => {
    expect(findShift([day], ist('2026-10-19T20:00:00'))).toBeNull();
  });

  it('reads the time in IST', () => {
    expect(istMinuteOfDay(new Date('2026-10-19T03:30:00Z'))).toBe(9 * 60); // 09:00 IST
    expect(istMinuteOfDay(new Date('2026-10-19T18:30:00Z'))).toBe(0); // midnight IST
  });

  it('a shift with equal start and end covers the whole day', () => {
    expect(shiftCovers({ name: 'All day', startTime: '00:00', endTime: '00:00' }, 900)).toBe(true);
  });
});

describe('validateShiftTiling', () => {
  it('accepts shifts that cover 24 hours exactly once', () => {
    expect(validateShiftTiling([day, night])).toEqual([]);
    expect(validateShiftTiling([{ name: 'All day', startTime: '00:00', endTime: '00:00' }])).toEqual([]);
    expect(
      validateShiftTiling([
        { name: 'A', startTime: '06:00', endTime: '14:00' },
        { name: 'B', startTime: '14:00', endTime: '22:00' },
        { name: 'C', startTime: '22:00', endTime: '06:00' },
      ])
    ).toEqual([]);
  });

  it('reports gaps with their times', () => {
    expect(validateShiftTiling([day, { name: 'Night Shift', startTime: '19:00', endTime: '09:00' }])).toEqual([
      'Not covered by any shift: 18:00–19:00.',
    ]);
  });

  it('reports overlaps with the shifts involved', () => {
    expect(validateShiftTiling([day, { name: 'Night Shift', startTime: '17:00', endTime: '09:00' }])).toEqual([
      'Shifts overlap at 17:00–18:00 (Day Shift, Night Shift).',
    ]);
  });

  it('allows at most 5 shifts, and needs names and valid times', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ name: `S${i}`, startTime: `0${i}:00`, endTime: `0${i + 1}:00` }));
    expect(validateShiftTiling(six)[0]).toBe('A step can have at most 5 shifts.');
    expect(validateShiftTiling([{ name: '', startTime: '00:00', endTime: '00:00' }])).toEqual(['Every shift needs a name.']);
    expect(validateShiftTiling([{ name: 'X', startTime: '25:00', endTime: '09:00' }])[0]).toContain('invalid time');
    expect(validateShiftTiling([])).toEqual(['Add at least one shift.']);
  });
});
