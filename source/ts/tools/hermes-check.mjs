// Parsing is a static check and compiles no bytecode, but Hermes runs this
// same parser internally, so it catches every JS-syntax incompatibility a
// bytecode compile would.

import { readFileSync, statSync } from 'node:fs';
import { parse } from 'hermes-parser';

const BUNDLE = 'dist/index.cjs';

console.log('=== Hermes JS-Syntax Compatibility Check ===');

let src;
try {
  src = readFileSync(BUNDLE, 'utf8');
} catch (e) {
  console.error(`❌ Could not read ${BUNDLE}: ${e.message}`);
  console.error('   Did you run `npm run build` first?');
  process.exit(1);
}

const sizeKB = (statSync(BUNDLE).size / 1024).toFixed(2);
console.log(`Parsing ${BUNDLE} (${sizeKB} KB) with hermes-parser…`);

try {
  parse(src, { sourceType: 'script' });
  console.log('✅ Hermes JS-syntax check PASSED');
  console.log(`   Bundle: ${BUNDLE} (${sizeKB} KB) parses cleanly with the Hermes frontend.`);
  process.exit(0);
} catch (e) {
  console.error('❌ Hermes JS-syntax check FAILED');
  console.error(`   ${e.message}`);
  console.error('   The bundle uses syntax Hermes does not accept.');
  process.exit(1);
}
