/**
 * A `PT_MODULE` backed by a JSON responses file, so the vcompare scoring
 * harnesses can score a Go implementation. A missing key throws: their
 * `if (!r) continue` paths would score a partial file as skipped rows.
 *
 *   VCOMPARE_RESPONSES=go/parity/out/vcompare-go.json \
 *   PT_MODULE=source/go/parity/vcompare-adapter.cjs \
 *     node generate/notes/vcompare/almanac.mjs
 */
'use strict';

const { readFileSync } = require('node:fs');
const { KEYS, resolveTarget } = require('./vcompare-keys.cjs');

const path = resolveTarget(process.env.VCOMPARE_RESPONSES || 'source/go/parity/out/vcompare-go.json');
const responses = JSON.parse(readFileSync(path, 'utf8'));

const api = {};
for (const [name, keyOf] of Object.entries(KEYS)) {
  api[name] = (...args) => {
    const table = responses[name];
    if (!table) throw new Error(`vcompare-adapter: ${path} has no "${name}" section`);
    const key = keyOf(args);
    if (!(key in table)) {
      throw new Error(`vcompare-adapter: ${path} has no "${name}" response for key ${key}`);
    }
    return table[key];
  };
}

module.exports = api;
