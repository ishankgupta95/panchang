import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Only the 8,655 tests that declare no timeout of their own inherit this, and the slowest
    // of those measures 15 s (~53 s under coverage). The 26 slower tests set their own.
    testTimeout: 120_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/i18n/**', 'src/**/*.test.ts'],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
      },
    },
    benchmark: {
      include: ['tests/perf/**/*.bench.ts'],
    },
  },
});
