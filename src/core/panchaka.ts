/**
 * Panchaka Detection
 *
 * Panchaka is active when the Moon is in the last 5 nakshatras:
 * Dhanishta (3rd–4th pada), Shatabhisha, Purva Bhadrapada,
 * Uttara Bhadrapada, and Revati.
 *
 * This corresponds to sidereal Moon longitude >= 300°
 * (= Dhanishta 3rd pada start: 22 × (360/27) + (360/27)/2 ≈ 300°).
 */
export function computePanchaka(siderealMoon: number): boolean {
  return siderealMoon >= 300.0;
}
