
import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';

const UJJAIN = { latitude: 23.1765, longitude: 75.7885 };
const TZ = 'Asia/Kolkata';

function istDay(dateStr: string): Date {
  return new Date(`${dateStr}T06:30:00Z`);
}

function adhikaFor(dateStr: string): boolean {
  const r = getDailyPanchang(istDay(dateStr), UJJAIN, { timezone: TZ });
  if (!r) throw new Error(`no panchang for ${dateStr}`);
  return r.calendar.chandramasa.isAdhika;
}

describe('Adhika Masa: Adhik Jyeshtha 2026 (Ujjain, IST)', () => {
  const adhikaDays = [
    '2026-05-17', '2026-05-18', '2026-05-22', '2026-05-25',
    '2026-05-30', '2026-06-05', '2026-06-10', '2026-06-14', '2026-06-15',
  ];
  it.each(adhikaDays)('%s is Adhika (true)', (d) => {
    expect(adhikaFor(d)).toBe(true);
  });

  const nijaDays = ['2026-05-15', '2026-05-16', '2026-06-16', '2026-06-20'];
  it.each(nijaDays)('%s is not Adhika (false)', (d) => {
    expect(adhikaFor(d)).toBe(false);
  });

  it('the reported date 2026-05-30 is Adhika (the original bug)', () => {
    expect(adhikaFor('2026-05-30')).toBe(true);
  });

  it('isAdhika is stable across the whole window (no day-to-day flicker)', () => {
    for (let day = 17; day <= 31; day++) {
      expect(adhikaFor(`2026-05-${String(day).padStart(2, '0')}`)).toBe(true);
    }
    for (let day = 1; day <= 15; day++) {
      expect(adhikaFor(`2026-06-${String(day).padStart(2, '0')}`)).toBe(true);
    }
  });

  it('the Adhika month is named Jyeshtha (amanta)', () => {
    const r = getDailyPanchang(istDay('2026-05-30'), UJJAIN, {
      timezone: TZ,
      masaSystem: 'amanta',
    });
    expect(r!.calendar.chandramasa.name).toContain('Jyeshtha');
    expect(r!.calendar.chandramasa.isAdhika).toBe(true);
  });

  it.each([
    ['2026-05-20', 'Shukla'],
    ['2026-05-31', 'Shukla'],
    ['2026-06-10', 'Krishna'],
    ['2026-06-14', 'Krishna'],
  ])('purnimanta on %s (%s) is Adhika Jyeshtha', (d) => {
    const r = getDailyPanchang(istDay(d), UJJAIN, { timezone: TZ });
    expect(r!.calendar.chandramasa.purnimantaName).toBe('Adhika Jyeshtha');
    expect(r!.calendar.chandramasa.purnimantaIndex).toBe(r!.calendar.chandramasa.amantaIndex);
  });

  it('purnimanta returns to plain Jyeshtha in the Nija month (2026-06-20)', () => {
    const r = getDailyPanchang(istDay('2026-06-20'), UJJAIN, { timezone: TZ });
    expect(r!.calendar.chandramasa.purnimantaName).toBe('Jyeshtha');
    expect(r!.calendar.chandramasa.isAdhika).toBe(false);
  });
});
