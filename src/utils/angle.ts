/** Normalize angle to [0, 360). */
export function normalize360(degrees: number): number {
  const r = degrees % 360;
  // Handle -0 from JS modulo (e.g. -360 % 360 = -0)
  if (r === 0) return 0;
  return r < 0 ? r + 360 : r;
}

export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}
