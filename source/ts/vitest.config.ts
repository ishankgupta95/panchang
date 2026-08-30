import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The slowest honest test runs ~156 s, and coverage instrumentation costs ~3.5x on top.
    testTimeout: 600_000,
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
