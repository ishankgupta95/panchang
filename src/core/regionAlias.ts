import type { FestivalRegion, LegacyFestivalRegion } from '../types/options';

/**
 * Pre-v2.1 → canonical region mapping. See `LegacyFestivalRegion` for
 * rationale; removal scheduled for v3.
 */
const LEGACY_REGION_ALIASES: Record<LegacyFestivalRegion, FestivalRegion> = {
  'tamil':       'tamil-nadu',
  'bengal':      'west-bengal',
  'north-india': 'all',
};

/** One-shot warning guard — we warn once per legacy value per process. */
const warned = new Set<string>();

/**
 * Resolve a user-supplied region (possibly a pre-v2.1 alias) to a canonical
 * {@link FestivalRegion}. Unknown values fall through untouched — TypeScript
 * should already reject them at the call site, but a runtime caller passing
 * a stale string gets predictable behaviour (the festival filter simply
 * treats it as a narrow region that matches no rule).
 *
 * Emits `console.warn` once per distinct legacy value seen, so long-running
 * callers aren't spammed per-day.
 */
export function resolveRegionAlias(
  region: FestivalRegion | LegacyFestivalRegion | undefined,
): FestivalRegion {
  if (region === undefined) return 'all';
  if (region in LEGACY_REGION_ALIASES) {
    const legacy = region as LegacyFestivalRegion;
    const canonical = LEGACY_REGION_ALIASES[legacy];
    if (!warned.has(legacy)) {
      warned.add(legacy);
      console.warn(
        `[panchang-ts] FestivalRegion '${legacy}' is deprecated; use '${canonical}'. ` +
        `Legacy value will be removed in v3.`,
      );
    }
    return canonical;
  }
  return region as FestivalRegion;
}

/** Test-only hook: clear the one-shot warning set between specs. */
export function __resetRegionAliasWarnings(): void {
  warned.clear();
}
