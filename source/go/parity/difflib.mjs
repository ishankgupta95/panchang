/**
 * One classifier for both `diff.mjs` and `gate.mjs`: every recorded band was
 * measured through it, so a second copy would silently assert other bands.
 */

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
/** The zone is an invariant even where the instant is allowed to move. */
const ISO_OFFSET = /(Z|[+-]\d{2}:\d{2})$/;

function note(map, leaf, delta, path, b, a) {
  let e = map.get(leaf);
  if (!e) { e = { max: 0, count: 0, worstPath: '', worstBefore: null, worstAfter: null }; map.set(leaf, e); }
  e.count++;
  if (Math.abs(delta) > Math.abs(e.max)) {
    e.max = delta; e.worstPath = path; e.worstBefore = b; e.worstAfter = a;
  }
}

function leafName(path) {
  const parts = path.split('.').filter((p) => !/^\d+$/.test(p) && !p.includes('|'));
  return parts.slice(-2).join('.') || path;
}

/** `max` is signed; every caller comparing it to a band must take `Math.abs`. */
export function compare(before, after) {
  const invariants = [];
  const numeric = new Map();
  const times = new Map();

  function walk(b, a, path) {
    if (b === a) {
      // `-0 === 0`, but the two serialize differently: a wire break no band sees.
      if (typeof b === 'number' && !Object.is(b, a)) {
        invariants.push({ path: `${path}.<signed-zero>`, before: Object.is(b, -0) ? '-0' : '0', after: Object.is(a, -0) ? '-0' : '0' });
      }
      return;
    }
    if (b === null || a === null || b === undefined || a === undefined) {
      invariants.push({ path, before: b, after: a });
      return;
    }
    if (typeof b !== typeof a) { invariants.push({ path, before: b, after: a }); return; }

    if (typeof b === 'number') {
      if (b !== a) note(numeric, leafName(path), a - b, path, b, a);
      return;
    }
    if (typeof b === 'string') {
      if (ISO.test(b) && ISO.test(a)) {
        if (ISO_OFFSET.exec(b)[0] !== ISO_OFFSET.exec(a)[0]) {
          invariants.push({ path: `${path}.<offset>`, before: b, after: a });
          return;
        }
        const d = Date.parse(a) - Date.parse(b);
        if (Number.isNaN(d)) {
          // A NaN delta can never breach a band, so a regex-valid but
          // unparseable instant (month 13) would be waved through as a time delta.
          invariants.push({ path: `${path}.<unparseable-instant>`, before: b, after: a });
        } else if (d !== 0) note(times, leafName(path), d, path, b, a);
      } else if (b !== a) {
        invariants.push({ path, before: b, after: a });
      }
      return;
    }
    if (typeof b === 'boolean') { invariants.push({ path, before: b, after: a }); return; }

    if (Array.isArray(b) !== Array.isArray(a)) { invariants.push({ path, before: 'array?', after: 'array?' }); return; }
    if (Array.isArray(b)) {
      if (b.length !== a.length) {
        invariants.push({ path: `${path}.length`, before: b.length, after: a.length });
        return;
      }
      for (let i = 0; i < b.length; i++) walk(b[i], a[i], `${path}.${i}`);
      return;
    }
    const kb = Object.keys(b), ka = Object.keys(a);
    if (kb.join(',') !== ka.join(',')) {
      invariants.push({ path: `${path}.<keys>`, before: kb.join(','), after: ka.join(',') });
      return;
    }
    for (const k of kb) walk(b[k], a[k], `${path}.${k}`);
  }

  // The union walk below never checks root key order, a zero-tolerance invariant.
  const rb = Object.keys(before).join(','), ra = Object.keys(after).join(',');
  if (rb !== ra) invariants.push({ path: '<root>.<keys>', before: rb, after: ra });
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) walk(before[k], after[k], k);

  return { invariants, numeric, times };
}

export function bySeverity(map) {
  return [...map.entries()].sort((x, y) => Math.abs(y[1].max) - Math.abs(x[1].max));
}
