import { buildEqualSlots, VARA_CHALDEAN_START } from '../utils/slots';
import type { HoraSlot, Unlocalized, UnlocalizedInfo } from '../types/elements';

/** Planet indices are Chaldean order: Sun(0), Venus(1), Mercury(2), Moon(3), Saturn(4), Jupiter(5), Mars(6). */
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
  const firstNight = (firstDay + 12) % 7;

  return {
    day:   buildHoras(sunrise, dayMs,   firstDay,   nameFn, 12),
    night: buildHoras(sunset,  nightMs, firstNight, nameFn, 12),
  };
}
