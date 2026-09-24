import type { FestivalRegion, LegacyFestivalRegion } from '../types/options';

const LEGACY_REGION_ALIASES: Record<LegacyFestivalRegion, FestivalRegion> = {
  'tamil':       'tamil-nadu',
  'bengal':      'west-bengal',
  'north-india': 'all',
};

const warned = new Set<string>();

export function resolveRegionAlias(
  region: FestivalRegion | LegacyFestivalRegion | undefined,
): FestivalRegion {
  if (region === undefined) return 'all';
  if (Object.prototype.hasOwnProperty.call(LEGACY_REGION_ALIASES, region)) {
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

export function __resetRegionAliasWarnings(): void {
  warned.clear();
}
