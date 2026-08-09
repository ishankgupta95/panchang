import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/calendar/festivalsTable.ts',
    'src/calendar/eclipsesTable.ts',
    'src/calendar/moonPhasesTable.ts',
    'src/muhurta/muhurtaTable.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  target: 'es2020',
  outDir: 'dist',
  treeshake: true,
  minify: false,
  // No `noExternal` any more: as of v5 the package has **no runtime
  // dependencies at all**, so there is nothing left to bundle in. The entry it
  // named — `astronomy-engine` — is a devDependency now, used only by the Tier 0
  // tests that measure the baseline this library was held to.
});
