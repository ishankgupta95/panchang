import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  target: 'es2020',
  outDir: 'dist',
  treeshake: true,
  minify: false,
  noExternal: ['astronomy-engine'],
});
