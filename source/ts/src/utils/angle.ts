export function normalize360(degrees: number): number {
  let r = degrees % 360;
  if (r < 0) r += 360;
  if (r >= 360) r -= 360;
  return r === 0 ? 0 : r;
}

export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}
