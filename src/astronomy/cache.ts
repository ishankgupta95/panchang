import { getSiderealMoonLongitude } from './moon';
import { getSiderealSunLongitude } from './sun';
import type { AyanamsaType } from '../types/options';

const BUCKET_MS = 60_000;

export class LongitudeCache {
  private moonCache = new Map<number, number>();
  private sunCache = new Map<number, number>();
  private readonly ayanamsaType: AyanamsaType;

  public hits = 0;
  public misses = 0;

  constructor(ayanamsaType: AyanamsaType) {
    this.ayanamsaType = ayanamsaType;
  }

  getMoon(date: Date): number {
    const bucket = Math.floor(date.getTime() / BUCKET_MS);
    const cached = this.moonCache.get(bucket);
    if (cached !== undefined) {
      this.hits++;
      return cached;
    }
    this.misses++;
    const lon = getSiderealMoonLongitude(date, this.ayanamsaType);
    this.moonCache.set(bucket, lon);
    return lon;
  }

  getSun(date: Date): number {
    const bucket = Math.floor(date.getTime() / BUCKET_MS);
    const cached = this.sunCache.get(bucket);
    if (cached !== undefined) {
      this.hits++;
      return cached;
    }
    this.misses++;
    const lon = getSiderealSunLongitude(date, this.ayanamsaType);
    this.sunCache.set(bucket, lon);
    return lon;
  }

  get size(): number {
    return this.moonCache.size + this.sunCache.size;
  }
}
