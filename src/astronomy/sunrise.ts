// TODO: Phase 2 — implement after installing astronomy-engine
import { PanchangError } from '../types/errors';
import type { GeoLocation } from '../types/location';

export function computeSunrise(_searchFromUtc: Date, location: GeoLocation, _limitDays: number = 2): Date {
  // Placeholder — replace with astronomy-engine call in Phase 2:
  // import { Body, SearchRiseSet, MakeTime, Observer } from 'astronomy-engine';
  // const observer = new Observer(location.latitude, location.longitude, location.elevation ?? 0);
  // const result = SearchRiseSet(Body.Sun, observer, +1, MakeTime(searchFromUtc), limitDays);
  void location;
  throw new PanchangError('Not implemented yet — install astronomy-engine first', 'NO_SUNRISE');
}

export function computeSunset(_searchFromUtc: Date, location: GeoLocation, _limitDays: number = 2): Date {
  void location;
  throw new PanchangError('Not implemented yet — install astronomy-engine first', 'NO_SUNSET');
}
