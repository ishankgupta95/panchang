import { computeRashiChart } from './charts';
import type { BirthChartOptions } from '../types/options';
import type { GeoLocation } from '../types/location';
import type { BirthChart } from '../types/jyotish';

/**
 * Cast a **Prashna** (horary) chart for the moment a question is asked.
 *
 * Prashna is the classical Vedic / KP horary technique: a chart cast
 * for the precise moment a sincere question reaches the astrologer,
 * with the *querent's* current location (not their natal location) as
 * the geographic anchor. Analysis proceeds on the resulting chart in
 * the same way as a natal chart — houses, planets, dignity, dashas all
 * apply to the question being asked rather than the native's life.
 *
 * **Implementation.** This function is a thin intent-named wrapper over
 * {@link computeRashiChart} — the casting logic is identical (sidereal
 * lagna + bhava cusps + 9 graha placements at the supplied moment and
 * location). The named accessor exists for two reasons:
 *
 *   1. **Caller intent.** A Prashna chart is conceptually distinct from
 *      a natal chart — the same returned shape, but a different
 *      analytical context. The dedicated function makes that intent
 *      explicit at the call site.
 *   2. **Future hooks for Prashna-specific layers.** Significator
 *      analysis, Ruling Planets (RP), and KP horary 1..249 number
 *      mapping are deferred to a later phase. When they ship, this
 *      module is the natural home for them, and existing
 *      `computePrashnaChart` callers will pick them up additively.
 *
 * The returned shape is identical to a natal `BirthChart` — same
 * `lagna`, `bhava`, and `planets`. KP-style cuspal sub-lord and
 * significator analyses run on the result via {@link computeKpSubLord}
 * and {@link computeKpSignificators} (already in the public API since
 * Step 33-3).
 *
 * **Default house system.** When the caller does not specify
 * `options.houseSystem`, this function defaults to `'placidus-kp'` —
 * the cuspal scheme KP horary practice uses. Pass an explicit
 * `houseSystem` to override (e.g. `'whole-sign'` for traditional
 * Vedic Prashna).
 *
 * **Default ayanamsa.** Defaults to `'krishnamurti'` (the canonical KP
 * ayanamsa) since Prashna analysis is most commonly anchored on the KP
 * cuspal sub-lord layer. Pass an explicit `options.ayanamsa` to
 * override (e.g. `'lahiri'` for traditional Vedic Prashna).
 *
 * @param questionMoment UTC instant the question was asked.
 * @param location       Querent's location (or astrologer's, depending
 *                       on tradition).
 * @param options        Standard `BirthChartOptions` — ayanamsa,
 *                       language, house system, node type.
 * @returns              {@link BirthChart} — same shape as a natal chart.
 *
 * @example
 * ```typescript
 * import { computePrashnaChart, computeKpCuspalSubLords } from 'panchang-ts';
 *
 * // Question asked at a specific moment from Mumbai.
 * const chart = computePrashnaChart(
 *   new Date('2026-05-09T14:30:00Z'),
 *   { latitude: 19.0760, longitude: 72.8777 },
 * );
 * chart.lagna.rashi.name;   // ascendant of the prashna
 * chart.planets[1].house;   // Moon's house — primary significator
 *                           // of the querent's mind in Prashna
 *
 * // KP cuspal sub-lord analysis on the prashna cusps:
 * const cusps = computeKpCuspalSubLords(
 *   new Date('2026-05-09T14:30:00Z'),
 *   { latitude: 19.0760, longitude: 72.8777 },
 * );
 * ```
 *
 * **Sources.** B. Suryanarain Rao, *Prasna Marga* (translation Sagar
 * Publications); K.S. Krishnamurti, *Horary Astrology* (KP Reader VI);
 * Sanjay Rath, *Horary Astrology* (srath.com).
 *
 * **Out of scope** (deferred to a later phase):
 * - **Ruling Planets (RP)** — the 5-fold lord set (lagna sign-lord,
 *   lagna star-lord, Moon sign-lord, Moon star-lord, day-lord) used
 *   to refine timing in KP horary.
 * - **Horary number mapping** — the KP 1..249 number → cusp sub-lord
 *   table that lets a querent supply a number instead of a moment.
 * - **Significator-driven event timing** — the Vedic Prashna analytical
 *   layer that walks dasha lords against significator sets.
 *
 * Each of those is purely additive on top of the chart this function
 * returns and can be added without breaking the chart-only API.
 */
export function computePrashnaChart(
  questionMoment: Date,
  location: GeoLocation,
  options: BirthChartOptions = {},
): BirthChart {
  // Default to Placidus-KP houses + Krishnamurti ayanamsa since Prashna
  // analysis (especially KP-style) is anchored on cuspal sub-lords.
  // Caller can override either via `options`.
  const prashnaOptions: BirthChartOptions = {
    houseSystem: 'placidus-kp',
    ayanamsa: 'krishnamurti',
    ...options,
  };
  return computeRashiChart(questionMoment, location, prashnaOptions);
}
