// Loader for the shared `testdata/` tree, which the Go tests read too.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TESTDATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'testdata');

export function testDataPath(...segments: string[]): string {
  return join(TESTDATA_DIR, ...segments);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readTestData<T = any>(...segments: string[]): T {
  return JSON.parse(readFileSync(testDataPath(...segments), 'utf8')) as T;
}

export function readTestDataText(...segments: string[]): string {
  return readFileSync(testDataPath(...segments), 'utf8');
}
