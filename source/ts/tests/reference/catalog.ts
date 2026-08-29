import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'testdata', 'ephemeris');

function readBundle(file: string): Map<string, string[]> {
  const text = gunzipSync(readFileSync(join(SOURCE_DIR, `${file}.gz`))).toString('utf8');
  const out = new Map<string, string[]>();
  let current: string[] | undefined;
  for (const line of text.split('\n')) {
    const header = /^===== (\S+) =====$/.exec(line);
    if (header) {
      current = [];
      out.set(header[1]!, current);
      continue;
    }
    if (current && line.trim()) current.push(line);
  }
  return out;
}

const number = (s: string): number => {
  const v = Number(s.trim());
  if (!Number.isFinite(v)) throw new Error(`unparseable coefficient field ${JSON.stringify(s)}`);
  return v;
};

// VSOP87D: Bretagnon & Francou 1988, VizieR VI/81.

/** `A·cos(B + C·τ)`, τ in Julian millennia TDB. */
export interface VsopTerm { A: number; B: number; C: number }

/** `series[variable][power]`: variable 1 = L, 2 = B, 3 = R; power is the exponent of τ. */
export type VsopSeries = Record<1 | 2 | 3, VsopTerm[][]>;

export type VsopBody = 'ear' | 'mer' | 'ven' | 'mar' | 'jup' | 'sat';

let vsopCache: Map<VsopBody, VsopSeries> | undefined;

export function readVsop87d(): Map<VsopBody, VsopSeries> {
  if (vsopCache) return vsopCache;
  vsopCache = new Map();
  for (const [name, lines] of readBundle('vsop87d.txt')) {
    const body = name.slice('VSOP87D.'.length) as VsopBody;
    const series: VsopSeries = { 1: [], 2: [], 3: [] };
    let variable: 1 | 2 | 3 = 1;
    let power = 0;
    for (const line of lines) {
      if (line.includes('VSOP87 VERSION')) {
        // " VSOP87 VERSION D4    EARTH     VARIABLE 1 (LBR)       *T**0    559 TERMS …"
        variable = Number(line.slice(41, 42)) as 1 | 2 | 3;
        power = Number(line.slice(59, 60));
        series[variable][power] = [];
        continue;
      }
      // Columns 80-131, skipping the S/K pair (vsop87.f, `4x,3f18.11,f14.11,f20.11`).
      series[variable][power]!.push({
        A: number(line.slice(79, 97)),
        B: number(line.slice(97, 111)),
        C: number(line.slice(111, 131)),
      });
    }
    vsopCache.set(body, series);
  }
  return vsopCache;
}

export interface VsopCheck { body: string; jd: number; l: number; b: number; r: number }

export function readVsop87Check(): VsopCheck[] {
  const text = gunzipSync(readFileSync(join(SOURCE_DIR, 'vsop87.chk.txt.gz'))).toString('utf8');
  const lines = text.split('\n');
  const out: VsopCheck[] = [];
  for (let i = 0; i < lines.length; i++) {
    const head = /VSOP87D\s+(\w+)\s+JD([\d.]+)/.exec(lines[i]!);
    if (!head) continue;
    const f = lines[i + 1]!.trim().split(/\s+/);
    out.push({ body: head[1]!, jd: Number(head[2]), l: Number(f[1]), b: Number(f[4]), r: Number(f[7]) });
  }
  return out;
}

// ELP2000-82B: Chapront-Touzé & Chapront, VizieR VI/79.

/** `ilu` are the Delaunay multipliers. */
export interface ElpMainTerm { ilu: [number, number, number, number]; coef: number[] }
export interface ElpPertTerm { iz: number; ilu: [number, number, number, number]; pha: number; a: number }
export interface ElpPlanetTerm { ipla: number[]; pha: number; a: number }

export interface ElpTables {
  main: Record<number, ElpMainTerm[]>;
  pert: Record<number, ElpPertTerm[]>;
  planet: Record<number, ElpPlanetTerm[]>;
}

let elpCache: ElpTables | undefined;

/**
 * `elp82b.f`'s FORMAT statements verbatim, less the unused trailing `per`:
 *   1001  format (4i3,2x,f13.5,6(2x,f10.2))          files 1-3
 *   1002  format (5i3,1x,f9.5,1x,f9.5,1x,f9.3)       files 4-9, 22-36
 *   1003  format (11i3,1x,f9.5,1x,f9.5,1x,f9.3)      files 10-21
 */
export function readElp2000(): ElpTables {
  if (elpCache) return elpCache;
  const tables: ElpTables = { main: {}, pert: {}, planet: {} };
  for (const [name, lines] of readBundle('elp2000-82b.txt')) {
    const file = Number(name.slice(3));
    const rows = lines.slice(1); // drop the title line
    if (file <= 3) {
      tables.main[file] = rows.map((l) => {
        const coef: number[] = [0, number(l.slice(14, 27))];
        for (let k = 0; k < 6; k++) coef.push(number(l.slice(29 + k * 12, 39 + k * 12)));
        return {
          ilu: [number(l.slice(0, 3)), number(l.slice(3, 6)), number(l.slice(6, 9)), number(l.slice(9, 12))],
          coef,
        };
      });
    } else if (file <= 9 || file >= 22) {
      tables.pert[file] = rows.map((l) => ({
        iz: number(l.slice(0, 3)),
        ilu: [number(l.slice(3, 6)), number(l.slice(6, 9)), number(l.slice(9, 12)), number(l.slice(12, 15))],
        pha: number(l.slice(15, 25)),
        a: number(l.slice(25, 35)),
      }));
    } else {
      tables.planet[file] = rows.map((l) => {
        const ipla: number[] = [];
        for (let i = 0; i < 11; i++) ipla.push(number(l.slice(i * 3, i * 3 + 3)));
        return { ipla, pha: number(l.slice(33, 43)), a: number(l.slice(43, 53)) };
      });
    }
  }
  elpCache = tables;
  return tables;
}

// IAU 2000A nutation: IERS Conventions (2010) ch. 5, tables 5.3a / 5.3b.

/** Microarcseconds; `mult` is the table's column order: l, l', F, D, Ω, the eight planets, p_A. */
export interface NutationTerm { sinCoef: number; cosCoef: number; mult: number[]; power: 0 | 1 }

let nutCache: { psi: NutationTerm[]; eps: NutationTerm[] } | undefined;

export function readNutation(): { psi: NutationTerm[]; eps: NutationTerm[] } {
  if (nutCache) return nutCache;
  const bundle = readBundle('iers-nutation.txt');
  const parse = (lines: string[]): NutationTerm[] => {
    const out: NutationTerm[] = [];
    let power: 0 | 1 = 0;
    for (const line of lines) {
      const j = /^j\s*=\s*([01])/.exec(line.trim());
      if (j) { power = Number(j[1]) as 0 | 1; continue; }
      const f = line.trim().split(/\s+/);
      if (f.length !== 17 || !/^\d+$/.test(f[0]!)) continue;
      const a = Number(f[1]), b = Number(f[2]);
      const mult = f.slice(3).map(Number);
      if (!Number.isFinite(a) || !Number.isFinite(b) || mult.some((m) => !Number.isFinite(m))) continue;
      // 5.3a heads its columns "A_i  A''_i" and 5.3b "B''_i  B_i", but in both
      // column 2 multiplies sin(ARG) and column 3 cos(ARG).
      out.push({ sinCoef: a, cosCoef: b, mult, power });
    }
    return out;
  };
  nutCache = {
    psi: parse(bundle.get('tab5.3a')!),
    eps: parse(bundle.get('tab5.3b')!),
  };
  return nutCache;
}
