declare const __DEV__: boolean | undefined;

/**
 * Wrap a function call with timing. Only logs when __DEV__ is true.
 */
export function withTiming<T>(label: string, fn: () => T): { result: T; ms: number } {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const start = Date.now();
    const result = fn();
    const ms = Date.now() - start;
    console.log(`[panchang-ts] ${label}: ${ms}ms`);
    return { result, ms };
  }
  return { result: fn(), ms: 0 };
}
