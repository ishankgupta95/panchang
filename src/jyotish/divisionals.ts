import { navamsaFromBasis } from './charts';
import { computeNatalBasis, grahaList, type NatalBasis } from './natalBasis';
import { resolveMasaName } from '../i18n/resolver';
import { normalize360 } from '../utils/angle';
import type { BirthChartOptions } from '../types/options';
import type { GeoLocation } from '../types/location';
import type { Divisional, DivisionalChart, PlanetPlacement } from '../types/jyotish';

/**
 * Compute a divisional (varga) chart. Each rashi in the natal frame is split
 * into N segments per the classical rule for that varga; each segment maps
 * to a target rashi, producing the divisional positions for the lagna and
 * the 9 grahas.
 *
 * Supported divisionals (rules per BPHS Ch. 6):
 *   - **D2 Hora** — wealth. Sign split in 2 halves of 15°. Odd signs:
 *     1st half → Leo (Sun's hora), 2nd half → Cancer (Moon's hora). Even
 *     signs reversed.
 *   - **D3 Drekkana** — siblings. Sign split in 3 segments of 10°. 1st →
 *     same sign; 2nd → 5th from itself; 3rd → 9th from itself.
 *   - **D7 Saptamsa** — children. Sign split in 7 segments of ~4.286°.
 *     Odd signs start from itself; even signs from the 7th from itself.
 *   - **D9 Navamsa** — partner / dharma. Delegates to {@link computeNavamsa}
 *     so the same algorithm covers the standalone API and the unified one.
 *   - **D10 Dasamsa** — career. Sign split in 10 segments of 3°. Odd signs
 *     start from itself; even signs from the 9th from itself.
 *   - **D12 Dwadasamsa** — parents. Sign split in 12 segments of 2°30'.
 *     Sequential start from itself in zodiacal order regardless of parity.
 *   - **D30 Trimsamsa** — misfortune. Non-uniform 5/5/8/7/5° (odd signs)
 *     and 5/7/8/5/5° (even signs) split. Each segment maps to one of the
 *     five non-luminary lords' signs (no Sun / Moon segments).
 *
 * Each chart is whole-sign anchored to its own divisional lagna. Houses
 * 1..12 are derived as `((divRashi − divLagnaRashi + 12) % 12) + 1`.
 *
 * @param birthDate Instant of birth in UTC.
 * @param location  Geographic location of birth.
 * @param divisional Which varga to compute.
 * @param options   Birth-chart options (`ayanamsa`, `language`, `nodeType`).
 *
 * @example
 * ```typescript
 * const d10 = computeDivisionalChart(
 *   new Date('1995-08-15T05:30:00Z'),
 *   { latitude: 28.6139, longitude: 77.2090 },
 *   'D10',
 * );
 * d10.lagnaRashi.name;          // career-chart lagna
 * d10.planets[4].rashi.name;    // Jupiter's dasamsa rashi
 * ```
 */
export function computeDivisionalChart(
  birthDate: Date,
  location: GeoLocation,
  divisional: Divisional,
  options: BirthChartOptions = {},
): DivisionalChart {
  return divisionalChartFromBasis(
    computeNatalBasis(birthDate, location, options),
    divisional,
  );
}

/**
 * Divisional chart derived from an already-resolved {@link NatalBasis}.
 *
 * @internal Lets a caller that needs several vargas at one instant —
 * `computeShadbala` needs six — pay for the planetary positions once.
 */
export function divisionalChartFromBasis(
  basis: NatalBasis,
  divisional: Divisional,
): DivisionalChart {
  if (divisional === 'D9') return navamsaFromBasis(basis);

  const { lang } = basis;
  const transform = transformFor(divisional);
  const divLagnaLon = transform(basis.lagna.siderealLongitude);
  const divLagnaRashi = Math.floor(divLagnaLon / 30);

  const planets: PlanetPlacement[] = grahaList(basis).map(({ key, pos }) => {
    const dLon = transform(pos.siderealLongitude);
    const dRashi = Math.floor(dLon / 30);
    return {
      planet: key,
      longitude: dLon,
      rashi: { index: dRashi, name: resolveMasaName(dRashi, lang) },
      degreeInRashi: dLon - dRashi * 30,
      house: ((dRashi - divLagnaRashi + 12) % 12) + 1,
      isRetrograde: pos.isRetrograde,
    };
  });

  return {
    divisional,
    lagnaRashi: { index: divLagnaRashi, name: resolveMasaName(divLagnaRashi, lang) },
    planets,
  };
}

// ── Per-divisional longitude transforms ───────────────

function transformFor(divisional: Exclude<Divisional, 'D9'>): (lon: number) => number {
  switch (divisional) {
    case 'D2':  return horaLongitude;
    case 'D3':  return drekkanaLongitude;
    case 'D7':  return saptamsaLongitude;
    case 'D10': return dasamsaLongitude;
    case 'D12': return dwadasamsaLongitude;
    case 'D30': return trimsamsaLongitude;
  }
}

/**
 * D2 Hora — sign split in 2 halves of 15°.
 *
 * Odd signs (Aries 0, Gemini 2, Leo 4, Libra 6, Sagittarius 8, Aquarius 10):
 *   - 0–15°  → Sun's hora (Leo, rashi 4)
 *   - 15–30° → Moon's hora (Cancer, rashi 3)
 *
 * Even signs reversed.
 */
function horaLongitude(siderealLon: number): number {
  const rashi = Math.floor(siderealLon / 30);
  const degInRashi = siderealLon - rashi * 30;
  const isOddSign = rashi % 2 === 0;     // Aries (0) is the 1st sign → odd
  const isFirstHalf = degInRashi < 15;
  const goesToSun = isOddSign === isFirstHalf;
  const targetRashi = goesToSun ? 4 /* Leo */ : 3 /* Cancer */;
  // Position within the 15° half is scaled to fill 30° in the target rashi.
  const degInHalf = isFirstHalf ? degInRashi : degInRashi - 15;
  const degInTargetRashi = (degInHalf / 15) * 30;
  return normalize360(targetRashi * 30 + degInTargetRashi);
}

const DREKKANA_SPAN = 10;
const DREKKANA_OFFSETS = [0, 4, 8] as const;

/**
 * D3 Drekkana — sign split in 3 segments of 10°.
 *   - 1st (0–10°)  → same sign (offset 0)
 *   - 2nd (10–20°) → 5th from itself (offset 4)
 *   - 3rd (20–30°) → 9th from itself (offset 8)
 */
function drekkanaLongitude(siderealLon: number): number {
  const rashi = Math.floor(siderealLon / 30);
  const degInRashi = siderealLon - rashi * 30;
  const idx = Math.min(2, Math.floor(degInRashi / DREKKANA_SPAN));
  const targetRashi = (rashi + DREKKANA_OFFSETS[idx]!) % 12;
  const degInSeg = degInRashi - idx * DREKKANA_SPAN;
  const degInTargetRashi = (degInSeg / DREKKANA_SPAN) * 30;
  return normalize360(targetRashi * 30 + degInTargetRashi);
}

const SAPTAMSA_SPAN = 30 / 7;

/**
 * D7 Saptamsa — sign split in 7 segments of 30/7° ≈ 4.286°.
 *   - Odd signs:  1st segment → same sign;  segments increment from there.
 *   - Even signs: 1st segment → 7th from itself; segments increment.
 *
 * The 7th from an even sign is the opposite sign (e.g. Taurus → Scorpio),
 * and after 7 segments the cycle has wrapped one zodiac, returning to the
 * original sign — matching the classical 7-saptamsa enumeration.
 */
function saptamsaLongitude(siderealLon: number): number {
  const rashi = Math.floor(siderealLon / 30);
  const degInRashi = siderealLon - rashi * 30;
  const idx = Math.min(6, Math.floor(degInRashi / SAPTAMSA_SPAN));
  const startOffset = rashi % 2 === 0 ? 0 : 6;
  const targetRashi = (rashi + startOffset + idx) % 12;
  const degInSeg = degInRashi - idx * SAPTAMSA_SPAN;
  const degInTargetRashi = (degInSeg / SAPTAMSA_SPAN) * 30;
  return normalize360(targetRashi * 30 + degInTargetRashi);
}

const DASAMSA_SPAN = 3;

/**
 * D10 Dasamsa — sign split in 10 segments of 3°.
 *   - Odd signs:  1st segment → same sign.
 *   - Even signs: 1st segment → 9th from itself (offset 8).
 */
function dasamsaLongitude(siderealLon: number): number {
  const rashi = Math.floor(siderealLon / 30);
  const degInRashi = siderealLon - rashi * 30;
  const idx = Math.min(9, Math.floor(degInRashi / DASAMSA_SPAN));
  const startOffset = rashi % 2 === 0 ? 0 : 8;
  const targetRashi = (rashi + startOffset + idx) % 12;
  const degInSeg = degInRashi - idx * DASAMSA_SPAN;
  const degInTargetRashi = (degInSeg / DASAMSA_SPAN) * 30;
  return normalize360(targetRashi * 30 + degInTargetRashi);
}

const DWADASAMSA_SPAN = 30 / 12; // 2.5°

/**
 * D12 Dwadasamsa — sign split in 12 segments of 2°30'.
 * Sequential start from itself in zodiacal order regardless of parity:
 *   - 1st → same sign;  2nd → next sign;  …;  12th → 12th from itself.
 */
function dwadasamsaLongitude(siderealLon: number): number {
  const rashi = Math.floor(siderealLon / 30);
  const degInRashi = siderealLon - rashi * 30;
  const idx = Math.min(11, Math.floor(degInRashi / DWADASAMSA_SPAN));
  const targetRashi = (rashi + idx) % 12;
  const degInSeg = degInRashi - idx * DWADASAMSA_SPAN;
  const degInTargetRashi = (degInSeg / DWADASAMSA_SPAN) * 30;
  return normalize360(targetRashi * 30 + degInTargetRashi);
}

// D30 segment boundaries (cumulative degrees from rashi start) and target
// rashis for each segment. Per BPHS, the lord sequence is Mars/Saturn/
// Jupiter/Mercury/Venus in odd signs and reversed in even signs; each
// lord's segment is placed in their odd-sign rulership for odd signs and
// even-sign rulership for even signs. (Sun and Moon do not appear in the
// trimsamsa scheme.)
const TRIMSA_ODD_BOUNDARIES = [0, 5, 10, 18, 25, 30] as const;
const TRIMSA_ODD_RASHIS = [
  0,  // 0–5°   → Mars     (Aries)
  10, // 5–10°  → Saturn   (Aquarius)
  8,  // 10–18° → Jupiter  (Sagittarius)
  2,  // 18–25° → Mercury  (Gemini)
  6,  // 25–30° → Venus    (Libra)
] as const;
const TRIMSA_EVEN_BOUNDARIES = [0, 5, 12, 20, 25, 30] as const;
const TRIMSA_EVEN_RASHIS = [
  1,  // 0–5°   → Venus    (Taurus)
  5,  // 5–12°  → Mercury  (Virgo)
  11, // 12–20° → Jupiter  (Pisces)
  9,  // 20–25° → Saturn   (Capricorn)
  7,  // 25–30° → Mars     (Scorpio)
] as const;

/**
 * D30 Trimsamsa — non-uniform 5-segment split per parity. The segments map
 * to the five non-luminary lord signs (Mars, Saturn, Jupiter, Mercury,
 * Venus) with each lord's odd-or-even rulership selected to match the
 * source sign's parity.
 */
function trimsamsaLongitude(siderealLon: number): number {
  const rashi = Math.floor(siderealLon / 30);
  const degInRashi = siderealLon - rashi * 30;
  const isOdd = rashi % 2 === 0;
  const boundaries = isOdd ? TRIMSA_ODD_BOUNDARIES : TRIMSA_EVEN_BOUNDARIES;
  const rashis = isOdd ? TRIMSA_ODD_RASHIS : TRIMSA_EVEN_RASHIS;
  let segIdx = 4;
  for (let i = 0; i < 5; i++) {
    if (degInRashi < boundaries[i + 1]!) { segIdx = i; break; }
  }
  const targetRashi = rashis[segIdx]!;
  const segStart = boundaries[segIdx]!;
  const segWidth = boundaries[segIdx + 1]! - segStart;
  const degInSeg = degInRashi - segStart;
  const degInTargetRashi = (degInSeg / segWidth) * 30;
  return normalize360(targetRashi * 30 + degInTargetRashi);
}

// ── Test-only exports ─────────────────────────────────

/** @internal */
export const _horaLongitudeForTest = horaLongitude;
/** @internal */
export const _drekkanaLongitudeForTest = drekkanaLongitude;
/** @internal */
export const _saptamsaLongitudeForTest = saptamsaLongitude;
/** @internal */
export const _dasamsaLongitudeForTest = dasamsaLongitude;
/** @internal */
export const _dwadasamsaLongitudeForTest = dwadasamsaLongitude;
/** @internal */
export const _trimsamsaLongitudeForTest = trimsamsaLongitude;
