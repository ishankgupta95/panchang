/**
 * Negative tests for `gate.mjs` and `tables-gate.mjs`.
 *
 *   node --test go/parity/
 *
 * The gates run as subprocesses because the exit code is as much under test as
 * the arithmetic. Perturbations have to be exact doubles: `doc(1)` against
 * `doc(1 + 1e-12)` fails a 1e-12 pin, since `(1 + 1e-12) - 1` is 1.0000889e-12;
 * basing the leaf at 0 makes every delta the literal itself.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = `${process.platform}/${process.arch}`;

function run(script, args) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [join(HERE, script), ...args], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

function scratch(t) {
  const d = mkdtempSync(join(tmpdir(), 'parity-gate-'));
  t.after(() => rmSync(d, { recursive: true, force: true }));
  return d;
}

const doc = (deg, iso, extra = {}) => JSON.stringify({ s: { deg, when: iso, name: 'x', ...extra } });

/** `hostKey` pins a host nobody runs on, so the gate falls back to bands-only. */
function bandsFor(bytes, over = {}) {
  const block = {
    invariants: 0,
    timeLeaves: 0,
    numericLeaves: 1,
    changedNumericValues: 1,
    worstNumericLeaf: 's.deg',
    worstNumericAbs: 1e-12,
    worstNumericPath: 's.deg',
    bytes,
    ...over.pins,
  };
  return JSON.stringify({
    bands: { invariants: 0, instantMs: 1, numericAbs: 1e-9 },
    stages: {
      t: { tsLabel: 'ts-t', goLabel: 'go-t', pins: { [over.hostKey ?? HOST]: block } },
    },
    tables: { files: 0, byteIdentical: [], maskedIdentical: [], maskedKeys: ['obscuration'], numericAbs: 1e-9, pins: {} },
  });
}

/** Byte pins come from the documents just written, so the size pin never trips first. */
function gate(t, { ts, go, over = {}, flags = [] }) {
  const d = scratch(t);
  writeFileSync(join(d, 'ts.json'), ts);
  writeFileSync(join(d, 'go.json'), go);
  const bytes = over.bytes ?? { ts: Buffer.byteLength(ts), go: Buffer.byteLength(go) };
  writeFileSync(join(d, 'bands.json'), bandsFor(bytes, over));
  return run('gate.mjs', ['t', join(d, 'ts.json'), join(d, 'go.json'), `--bands=${join(d, 'bands.json')}`, ...flags]);
}

const T0 = '2025-01-01T00:00:00.000Z';

test('gate: a clean pair passes', (t) => {
  const r = gate(t, { ts: doc(0, T0), go: doc(1e-12, T0) });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /parity gate: OK/);
});

test('gate: a changed string is an invariant breach', (t) => {
  const r = gate(t, { ts: doc(0, T0), go: JSON.stringify({ s: { deg: 0, when: T0, name: 'y' } }) });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL {4}\[BAND\] invariants/);
});

test('gate: a dropped key is an invariant breach', (t) => {
  const r = gate(t, { ts: doc(0, T0, { extra: 2 }), go: doc(0, T0) });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL {4}\[BAND\] invariants/);
});

test('gate: a reordered ROOT key set is an invariant breach', (t) => {
  // The root is the level a Set-union walk is easiest to leave uncompared.
  const r = gate(t, {
    ts: JSON.stringify({ s: { deg: 0, when: T0, name: 'x' }, z: 1 }),
    go: JSON.stringify({ z: 1, s: { deg: 0, when: T0, name: 'x' } }),
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL {4}\[BAND\] invariants/);
});

test('gate: a regex-valid but unparseable instant is an invariant breach, not a swallowed NaN', (t) => {
  // Month 13 passes the ISO regex but Date.parse gives NaN, and a NaN delta
  // can never breach a band.
  const r = gate(t, { ts: doc(0, T0), go: doc(0, '2025-13-01T00:00:00.000Z') });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL {4}\[BAND\] invariants/);
});

test('gate: a signed-zero split is an invariant breach the numeric band cannot see', (t) => {
  // -0 === 0 returns before the numeric branch, yet the two serialize
  // differently. Hand-built because JSON.stringify erases -0, Go does not.
  const r = gate(t, { ts: doc(0, T0), go: `{"s":{"deg":-0,"when":"${T0}","name":"x"}}` });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL {4}\[BAND\] invariants/);
});

test('gate: an instant past 1 ms is a band breach', (t) => {
  const r = gate(t, { ts: doc(0, T0), go: doc(0, '2025-01-01T00:00:00.002Z') });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL {4}\[BAND\] published instants/);
});

test('gate: an instant of exactly 1 ms is inside the band but breaks the pin', (t) => {
  const r = gate(t, { ts: doc(0, T0), go: doc(0, '2025-01-01T00:00:00.001Z') });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /ok {6}\[BAND\] published instants/);
  assert.match(r.out, /FAIL {4}\[PIN\] shifted-instant leaf pin: 1 vs 0/);
});

test('gate: a numeric leaf past 1e-9 is a band breach', (t) => {
  const r = gate(t, { ts: doc(0, T0), go: doc(1e-8, T0) });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL {4}\[BAND\] numeric leaves/);
});

test('gate: a numeric leaf inside the band but above its pin is a pin breach', (t) => {
  const r = gate(t, { ts: doc(0, T0), go: doc(1e-10, T0) });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /ok {6}\[BAND\] numeric leaves/);
  assert.match(r.out, /FAIL {4}\[PIN\] worst numeric \|Δ\| pin/);
});

test('gate: a second differing numeric leaf breaks the leaf-count pin', (t) => {
  const r = gate(t, {
    ts: doc(0, T0, { deg2: 0 }), go: doc(1e-12, T0, { deg2: 1e-12 }),
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL {4}\[PIN\] numeric leaf count/);
});

test('gate: an extra changed value under one leaf breaks the changed-values pin', (t) => {
  const r = gate(t, {
    ts: JSON.stringify({ s: { deg: 0, when: T0, name: 'x' }, s2: { deg: 0, when: T0, name: 'x' } }),
    go: JSON.stringify({ s: { deg: 1e-12, when: T0, name: 'x' }, s2: { deg: 1e-12, when: T0, name: 'x' } }),
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL {4}\[PIN\] changed numeric values/);
});

test('gate: a smaller delta is a tightening, not a failure', (t) => {
  const r = gate(t, { ts: doc(0, T0), go: doc(1e-15, T0) });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /NOTICE {2}worst numeric \|Δ\| TIGHTENED/);
});

test('gate: the worst leaf changing identity is a pin breach', (t) => {
  const r = gate(t, {
    ts: doc(0, T0), go: doc(1e-12, T0),
    over: { pins: { worstNumericLeaf: 'somethingElse', worstNumericPath: 's.other' } },
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL {4}\[PIN\] worst numeric leaf/);
  assert.match(r.out, /FAIL {4}\[PIN\] worst numeric path/);
});

test('gate: a wrong byte pin for this host fails', (t) => {
  const r = gate(t, { ts: doc(0, T0), go: doc(1e-12, T0), over: { bytes: { ts: 1, go: 1 } } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL {4}\[PIN\] TS document bytes/);
});

test('gate: an unmeasured host asserts the bands and only reports the pins', (t) => {
  const r = gate(t, { ts: doc(0, T0), go: doc(1e-12, T0), over: { hostKey: 'plan9/vax' } });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /NOTICE {2}.* has no pin block/);
  assert.match(r.out, /ok {6}\[BAND\] invariants/);
  assert.match(r.out, /"bytes": \{ "ts": \d+, "go": \d+ \}/);
  assert.doesNotMatch(r.out, /\[PIN\]/);
});

test('gate: an unmeasured host still fails on a band breach', (t) => {
  const r = gate(t, { ts: doc(0, T0), go: doc(1e-8, T0), over: { hostKey: 'plan9/vax' } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL {4}\[BAND\] numeric leaves/);
});

test('gate: --allow-pin-drift waives a pin breach but never a band breach', (t) => {
  const pinOnly = gate(t, { ts: doc(0, T0), go: doc(1e-10, T0), flags: ['--allow-pin-drift'] });
  assert.equal(pinOnly.code, 0, pinOnly.out);
  assert.match(pinOnly.out, /waived {2}\[PIN\] worst numeric \|Δ\| pin/);

  const bandBreach = gate(t, { ts: doc(0, T0), go: doc(1e-8, T0), flags: ['--allow-pin-drift'] });
  assert.equal(bandBreach.code, 1, bandBreach.out);
  assert.match(bandBreach.out, /FAIL {4}\[BAND\] numeric leaves/);
});

test('gate: an unknown stage and a missing dump both exit 2, not 0', (t) => {
  const d = scratch(t);
  writeFileSync(join(d, 'bands.json'), bandsFor({ ts: 1, go: 1 }));
  writeFileSync(join(d, 'ts.json'), doc(0, T0));
  assert.equal(run('gate.mjs', ['nope', `--bands=${join(d, 'bands.json')}`]).code, 2);
  assert.equal(run('gate.mjs', ['t', join(d, 'ts.json'), join(d, 'absent.json'), `--bands=${join(d, 'bands.json')}`]).code, 2);
});

const ECLIPSE = (obsc) => `{
  "entries": [
    {
      "description": "a partial eclipse",
      "obscuration": ${obsc},
      "magnitude": 0.5
    }
  ]
}
`;
const FESTIVAL = (name) => `{\n  "entries": [\n    { "name": "${name}" }\n  ]\n}\n`;

function tablesBands(over = {}) {
  return JSON.stringify({
    bands: { invariants: 0, instantMs: 1, numericAbs: 1e-9 },
    stages: {},
    tables: {
      files: 2,
      byteIdentical: ['festivals-*.json'],
      maskedIdentical: ['eclipses-*.json'],
      maskedKeys: ['obscuration', 'magnitude'],
      numericAbs: 1e-9,
      pins: { byteIdenticalFiles: 1, maskedFiles: 1, differingLines: 1, worstAbs: 1e-12 },
      ...over,
    },
  });
}

function tablesGate(t, { tsFiles, goFiles, bands = tablesBands(), flags = [] }) {
  const d = scratch(t);
  mkdirSync(join(d, 'ts'));
  mkdirSync(join(d, 'go'));
  for (const [n, body] of Object.entries(tsFiles)) writeFileSync(join(d, 'ts', n), body);
  for (const [n, body] of Object.entries(goFiles)) writeFileSync(join(d, 'go', n), body);
  writeFileSync(join(d, 'bands.json'), bands);
  return run('tables-gate.mjs', [join(d, 'ts'), join(d, 'go'), `--bands=${join(d, 'bands.json')}`, ...flags]);
}

const cleanTS = { 'festivals-2025.json': FESTIVAL('Holi'), 'eclipses-2025.json': ECLIPSE('0.10930542700759627') };
const cleanGO = { 'festivals-2025.json': FESTIVAL('Holi'), 'eclipses-2025.json': ECLIPSE('0.10930542700759006') };

test('tables: the amended eclipse row passes on a masked-only difference', (t) => {
  const r = tablesGate(t, { tsFiles: cleanTS, goFiles: cleanGO });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /table byte gate: OK/);
});

test('tables: a byte-identical format that is not identical fails', (t) => {
  const r = tablesGate(t, { tsFiles: cleanTS, goFiles: { ...cleanGO, 'festivals-2025.json': FESTIVAL('Holī') } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FAIL {4}\[BAND\] festivals-2025\.json byte-identical/);
});

test('tables: a difference outside the masked keys fails', (t) => {
  const moved = ECLIPSE('0.10930542700759006').replace('a partial eclipse', 'a total eclipse');
  const r = tablesGate(t, { tsFiles: cleanTS, goFiles: { ...cleanGO, 'eclipses-2025.json': moved } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /differs outside the masked keys/);
});

test('tables: a masked value past the numeric band fails', (t) => {
  const r = tablesGate(t, { tsFiles: cleanTS, goFiles: { ...cleanGO, 'eclipses-2025.json': ECLIPSE('0.2') } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /outside the numeric band/);
});

test('tables: a file matching neither list is unclassified, not silently passed', (t) => {
  const ts = { ...cleanTS, 'newformat-2025.json': FESTIVAL('x') };
  const go = { ...cleanGO, 'newformat-2025.json': FESTIVAL('x') };
  const r = tablesGate(t, { tsFiles: ts, goFiles: go, bands: tablesBands({ files: 3 }) });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /newformat-2025\.json is unclassified/);
});

test('tables: differing file sets exit 2, not 0', (t) => {
  const r = tablesGate(t, { tsFiles: cleanTS, goFiles: { 'festivals-2025.json': FESTIVAL('Holi') } });
  assert.equal(r.code, 2, r.out);
});

test('tables: one more byte-identical file is a tightening, one fewer is a breach', (t) => {
  const tighter = tablesGate(t, {
    tsFiles: cleanTS, goFiles: cleanGO,
    bands: tablesBands({ pins: { byteIdenticalFiles: 0, maskedFiles: 1, differingLines: 1, worstAbs: 1e-12 } }),
  });
  assert.equal(tighter.code, 0, tighter.out);
  assert.match(tighter.out, /NOTICE {2}byte-identical files TIGHTENED/);

  const worse = tablesGate(t, {
    tsFiles: cleanTS, goFiles: cleanGO,
    bands: tablesBands({ pins: { byteIdenticalFiles: 2, maskedFiles: 1, differingLines: 1, worstAbs: 1e-12 } }),
  });
  assert.equal(worse.code, 1, worse.out);
  assert.match(worse.out, /FAIL {4}\[PIN\] byte-identical files pin/);
});
