/**
 * Regression tests for Adhika Masa (intercalary lunar month) detection.
 *
 * Guards against the mean-motion bug where `chandramasa.isAdhika` flickered
 * day-to-day within a single Adhika month and read `false` on most days. The
 * fix derives the month identity from the *actual* bounding new moons (see
 * `src/astronomy/newMoon.ts`).
 *
 * Reference: Adhik (Mal/Purushottam) Maas 2026 is **Adhik Jyeshtha**, running
 * 17 May 2026 → 15 June 2026 (drikpanchang / pandit consensus). The Mithuna
 * Sankranti (15 Jun ~12:44 IST) lands after the closing Amavasya (15 Jun
 * ~08:24 IST), so 15 Jun (before its sunrise-to-sunrise day flips to Nija) is
 * still the last Adhika day.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';

// Ujjain — the location named in the original bug report.
const UJJAIN = { latitude: 23.1765, longitude: 75.7885 };
const TZ = 'Asia/Kolkata';

// Use a mid-day UTC instant so the local (IST) calendar date is unambiguous.
function istDay(dateStr: string): Date {
  return new Date(`${dateStr}T06:30:00Z`);
}

function adhikaFor(dateStr: string): boolean {
  const r = getDailyPanchang(istDay(dateStr), UJJAIN, { timezone: TZ });
  if (!r) throw new Error(`no panchang for ${dateStr}`);
  return r.chandramasa.isAdhika;
}

describe('Adhika Masa — Adhik Jyeshtha 2026 (Ujjain, IST)', () => {
  // Every day strictly inside the Adhika month must report true — no flicker.
  const adhikaDays = [
    '2026-05-17', '2026-05-18', '2026-05-22', '2026-05-25',
    '2026-05-30', '2026-06-05', '2026-06-10', '2026-06-14', '2026-06-15',
  ];
  it.each(adhikaDays)('%s is Adhika (true)', (d) => {
    expect(adhikaFor(d)).toBe(true);
  });

  // Days just outside the Adhika month must report false.
  const nijaDays = ['2026-05-15', '2026-05-16', '2026-06-16', '2026-06-20'];
  it.each(nijaDays)('%s is not Adhika (false)', (d) => {
    expect(adhikaFor(d)).toBe(false);
  });

  it('the reported date 2026-05-30 is Adhika (the original bug)', () => {
    expect(adhikaFor('2026-05-30')).toBe(true);
  });

  it('isAdhika is stable across the whole window (no day-to-day flicker)', () => {
    // Walk every IST day from the first Adhika day to its last and assert the
    // flag never drops to false mid-month.
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
    expect(r!.chandramasa.name).toContain('Jyeshtha');
    expect(r!.chandramasa.isAdhika).toBe(true);
  });
});
