import { buildEqualSlots, VARA_CHALDEAN_START } from '../utils/slots';
import type { HoraSlot, Unlocalized, UnlocalizedInfo } from '../types/elements';

/**
 * First daytime Hora planet index (Chaldean order) by weekday (Sun=0 … Sat=6).
 * Chaldean order: Sun(0), Venus(1), Mercury(2), Moon(3), Saturn(4), Jupiter(5), Mars(6).
 *   Sunday    → Sun     (0)
 *   Monday    → Moon    (3)
 *   Tuesday   → Mars    (6)
 *   Wednesday → Mercury (2)
 *   Thursday  → Jupiter (5)
 *   Friday    → Venus   (1)
 *   Saturday  → Saturn  (4)
 */
const DAY_FIRST_HORA = VARA_CHALDEAN_START;

function buildHoras(
  reference: Date,
  durationMs: number,
  firstPlanetIndex: number,
  nameFn: (planetIndex: number) => string,
  count: number,
): Unlocalized<HoraSlot>[] {
  return buildEqualSlots(reference, durationMs, count, (i, start, end) => {
    const planetIndex = (firstPlanetIndex + i) % 7;
    return { start, end, planetIndex, planet: nameFn(planetIndex) };
  });
}

/**
 * Compute the 24 planetary Horas for a day (12 daytime + 12 nighttime).
 *
 * Each half is divided into 12 equal periods, each ruled by a planet cycling
 * through the Chaldean sequence (Sun → Venus → Mercury → Moon → Saturn →
 * Jupiter → Mars → Sun …).  The planet ruling the 1st daytime hora matches
 * the lord of the weekday.  The 1st nighttime hora continues the sequence
 * from where daytime left off.
 *
 * @param sunrise     UTC sunrise Date.
 * @param sunset      UTC sunset Date.
 * @param nextSunrise UTC next-day sunrise Date.
 * @param varaIndex   Weekday index: 0 = Sunday, 6 = Saturday.
 * @param nameFn      Callback returning the translated planet name for a
 *                    Chaldean index (0=Sun, 1=Venus, 2=Mercury, 3=Moon,
 *                    4=Saturn, 5=Jupiter, 6=Mars).
 */
export function computeHora(
  sunrise: Date,
  sunset: Date,
  nextSunrise: Date,
  varaIndex: number,
  nameFn: (planetIndex: number) => string,
): UnlocalizedInfo<HoraSlot> {
  const dayMs   = sunset.getTime()      - sunrise.getTime();
  const nightMs = nextSunrise.getTime() - sunset.getTime();
  const firstDay   = DAY_FIRST_HORA[varaIndex]!;
  // Nighttime starts 12 positions after the first day hora
  const firstNight = (firstDay + 12) % 7;

  return {
    day:   buildHoras(sunrise, dayMs,   firstDay,   nameFn, 12),
    night: buildHoras(sunset,  nightMs, firstNight, nameFn, 12),
  };
}
