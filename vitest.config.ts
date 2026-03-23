import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
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
