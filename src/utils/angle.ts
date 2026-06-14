/** Normalize angle to [0, 360). */
export function normalize360(degrees: number): number {
  let r = degrees % 360;
  if (r < 0) r += 360;
  // Floating-point guard: a tiny negative input (e.g. -1e-15) yields
  // r + 360 === 360 exactly, which would violate the [0, 360) contract and
  // produce an out-of-range index (e.g. nakshatra 27). Collapse it to 0.
  if (r >= 360) r -= 360;
  // Collapse -0 (e.g. -360 % 360 === -0) to +0.
  return r === 0 ? 0 : r;
}

export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}
