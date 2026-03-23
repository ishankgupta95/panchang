export interface GeoLocation {
  /** Latitude in decimal degrees. Range: -90 to 90. */
  latitude: number;
  /** Longitude in decimal degrees. Range: -180 to 180. */
  longitude: number;
  /** Elevation in meters above sea level. Default: 0. */
  elevation?: number;
}
