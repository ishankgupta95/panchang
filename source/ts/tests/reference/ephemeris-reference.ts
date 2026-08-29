// Frozen, untruncated reference: geocentric apparent, true ecliptic of date. It
// duplicates `src/astronomy/`'s frame layer on purpose; sharing blinds the test.
import {
  readVsop87d, readElp2000, readNutation,
  type VsopBody, type VsopSeries,
} from './catalog';
import {
  NUTATION_PSI, NUTATION_PSI_ARGS, NUTATION_EPS, NUTATION_EPS_ARGS,
} from '../../src/astronomy/series/nutation-iau2000';

const ARCSEC_TO_RAD = Math.PI / 648000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const TURN_ARCSEC = 1_296_000;

const KM_PER_LIGHT_DAY = 299_792.458 * 86_400;
const AU_KM = 149_597_870.7;

// IAU 2006 (Capitaine, Wallace & Chapront 2003), arcseconds. Precession-only: the
// ±2.650545″ of some tables is GCRS bias, and ELP's J2000 is the dynamical equinox.
function precessionAngles(t: number): { zeta: number; z: number; theta: number } {
  return {
    zeta: (2306.083227 + (0.2988499 + (0.01801828 + (-0.000005971 + -0.0000003173 * t) * t) * t) * t) * t,
    z: (2306.077181 + (1.0927348 + (0.01826837 + (-0.000028596 + -0.0000002904 * t) * t) * t) * t) * t,
    theta: (2004.191903 + (-0.4294934 + (-0.04182264 + (-0.000007089 + -0.0000001274 * t) * t) * t) * t) * t,
  };
}

export function meanObliquityArcsec(t: number): number {
  return 84381.406
    + (-46.836769 + (-0.0001831 + (0.00200340 + (-0.000000576 + -0.0000000434 * t) * t) * t) * t) * t;
}
const EPS0_ARCSEC = 84381.406;

type Vec3 = [number, number, number];

const rotX = (v: Vec3, a: number): Vec3 => {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
};
const rotY = (v: Vec3, a: number): Vec3 => {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]];
};
const rotZ = (v: Vec3, a: number): Vec3 => {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]];
};

// IERS Conventions 2003, radians; order matches the multiplier columns of
// tables 5.3a/5.3b.
export function fundamentalArguments(t: number): number[] {
  const poly = (c0: number, c1: number, c2: number, c3: number, c4: number): number =>
    ((c0 + (c1 + (c2 + (c3 + c4 * t) * t) * t) * t) % TURN_ARCSEC) * ARCSEC_TO_RAD;
  return [
    poly(485868.249036, 1717915923.2178, 31.8792, 0.051635, -0.00024470),   // l   Moon anomaly
    poly(1287104.79305, 129596581.0481, -0.5532, 0.000136, -0.00001149),    // l'  Sun anomaly
    poly(335779.526232, 1739527262.8478, -12.7512, -0.001037, 0.00000417),  // F   Moon argument of latitude
    poly(1072260.70369, 1602961601.2090, -6.3706, 0.006593, -0.00003169),   // D   Moon elongation
    poly(450160.398036, -6962890.5431, 7.4722, 0.007702, -0.00005939),      // Ω   Moon ascending node
    4.402608842 + 2608.7903141574 * t,   // Mercury
    3.176146697 + 1021.3285546211 * t,   // Venus
    1.753470314 + 628.3075849991 * t,    // Earth
    6.203480913 + 334.0612426700 * t,    // Mars
    0.599546497 + 52.9690962641 * t,     // Jupiter
    0.874016757 + 21.3299104960 * t,     // Saturn
    5.481293872 + 7.4781598567 * t,      // Uranus
    5.311886287 + 3.8133035638 * t,      // Neptune
    (0.02438175 + 0.00000538691 * t) * t, // p_A, general precession in longitude
  ];
}

export function nutationReference(t: number): { dpsi: number; deps: number } {
  const args = fundamentalArguments(t);
  const { psi, eps } = readNutation();
  const sum = (terms: typeof psi): number => {
    let total = 0;
    for (const term of terms) {
      let arg = 0;
      for (let k = 0; k < 14; k++) {
        const m = term.mult[k]!;
        if (m !== 0) arg += m * args[k]!;
      }
      const v = term.sinCoef * Math.sin(arg) + term.cosCoef * Math.cos(arg);
      total += term.power === 0 ? v : v * t;
    }
    return total / 1e6; // table is in microarcseconds
  };
  return { dpsi: sum(psi), deps: sum(eps) };
}

// Reads `NUTATION_*` from `src/` on purpose: the arithmetic is under test, not
// the coefficients, so both sides must start from identical numbers.
export function truncatedNutationDirectReference(t: number): { dpsi: number; deps: number } {
  const args = fundamentalArguments(t);
  const sum = (coefficients: Float64Array, multipliers: Int8Array): number => {
    let total = 0;
    for (let i = 0, m = 0; i < coefficients.length; i += 3, m += 14) {
      let arg = 0;
      for (let k = 0; k < 14; k++) {
        const mult = multipliers[m + k] as number;
        if (mult !== 0) arg += mult * (args[k] as number);
      }
      const value = (coefficients[i] as number) * Math.sin(arg)
        + (coefficients[i + 1] as number) * Math.cos(arg);
      total += coefficients[i + 2] === 0 ? value : value * t;
    }
    return total;
  };
  return {
    dpsi: sum(NUTATION_PSI, NUTATION_PSI_ARGS),
    deps: sum(NUTATION_EPS, NUTATION_EPS_ARGS),
  };
}

// Heliocentric spherical, mean dynamical ecliptic of date: radians, radians, AU.
export function vsopReference(body: VsopBody, jdTt: number): [number, number, number] {
  const tau = (jdTt - 2451545.0) / 365250;
  const series: VsopSeries = readVsop87d().get(body)!;
  const out: number[] = [];
  for (const variable of [1, 2, 3] as const) {
    let total = 0;
    const powers = series[variable];
    for (let power = 0; power < powers.length; power++) {
      const terms = powers[power];
      if (!terms) continue;
      let s = 0;
      for (const { A, B, C } of terms) s += A * Math.cos(B + C * tau);
      total += s * tau ** power;
    }
    out.push(total);
  }
  return out as [number, number, number];
}

// The constants block of `elp82b.f`, verbatim: `w`, `eart`, `peri` the mean-longitude
// polynomials, `p` the planetary mean longitudes, `delnu`…`delep` the DE200/LE200 fit.
const ELP = (() => {
  const rad = 648000 / Math.PI, deg = Math.PI / 180, c1 = 60, c2 = 3600;
  const ath = 384747.9806743165, a0 = 384747.9806448954;
  const am = 0.074801329518, alfa = 0.002571881335;
  const dtasm = (2 * alfa) / (3 * am);

  // Indices follow the FORTRAN: w[i][k], k = 1…5 are the polynomial powers.
  const w: number[][] = [[], [], [], []];
  const eart: number[] = [], peri: number[] = [];
  w[1]![1] = (218 + 18 / c1 + 59.95571 / c2) * deg;
  w[2]![1] = (83 + 21 / c1 + 11.67475 / c2) * deg;
  w[3]![1] = (125 + 2 / c1 + 40.39816 / c2) * deg;
  eart[1] = (100 + 27 / c1 + 59.22059 / c2) * deg;
  peri[1] = (102 + 56 / c1 + 14.42753 / c2) * deg;
  w[1]![2] = 1732559343.73604 / rad;
  w[2]![2] = 14643420.2632 / rad;
  w[3]![2] = -6967919.3622 / rad;
  eart[2] = 129597742.2758 / rad;
  peri[2] = 1161.2283 / rad;
  w[1]![3] = -5.8883 / rad; w[2]![3] = -38.2776 / rad; w[3]![3] = 6.3622 / rad;
  eart[3] = -0.0202 / rad; peri[3] = 0.5327 / rad;
  w[1]![4] = 0.6604e-2 / rad; w[2]![4] = -0.45047e-1 / rad; w[3]![4] = 0.7625e-2 / rad;
  eart[4] = 0.9e-5 / rad; peri[4] = -0.138e-3 / rad;
  w[1]![5] = -0.3169e-4 / rad; w[2]![5] = 0.21301e-3 / rad; w[3]![5] = -0.3586e-4 / rad;
  eart[5] = 0.15e-6 / rad; peri[5] = 0;

  const preces = 5029.0966 / rad;
  const p: number[][] = [[], [], [], [], [], [], [], [], []];
  p[1]![1] = (252 + 15 / c1 + 3.25986 / c2) * deg;
  p[2]![1] = (181 + 58 / c1 + 47.28305 / c2) * deg;
  p[3]![1] = eart[1]!;
  p[4]![1] = (355 + 25 / c1 + 59.78866 / c2) * deg;
  p[5]![1] = (34 + 21 / c1 + 5.34212 / c2) * deg;
  p[6]![1] = (50 + 4 / c1 + 38.89694 / c2) * deg;
  p[7]![1] = (314 + 3 / c1 + 18.01841 / c2) * deg;
  p[8]![1] = (304 + 20 / c1 + 55.19575 / c2) * deg;
  p[1]![2] = 538101628.68898 / rad; p[2]![2] = 210664136.43355 / rad; p[3]![2] = eart[2]!;
  p[4]![2] = 68905077.59284 / rad; p[5]![2] = 10925660.42861 / rad; p[6]![2] = 4399609.65932 / rad;
  p[7]![2] = 1542481.19393 / rad; p[8]![2] = 786550.32074 / rad;

  const delnu = 0.55604 / rad / w[1]![2]!;
  const dele = 0.01789 / rad;
  const delg = -0.08066 / rad;
  const delnp = -0.06424 / rad / w[1]![2]!;
  const delep = -0.12879 / rad;

  const del: number[][] = [[], [], [], [], []];
  for (let i = 1; i <= 5; i++) {
    del[1]![i] = w[1]![i]! - eart[i]!;
    del[4]![i] = w[1]![i]! - w[3]![i]!;
    del[3]![i] = w[1]![i]! - w[2]![i]!;
    del[2]![i] = eart[i]! - peri[i]!;
  }
  del[1]![1] = del[1]![1]! + Math.PI;
  const zeta = [0, w[1]![1]!, w[1]![2]! + preces];

  return { rad, deg, ath, a0, am, dtasm, w, p, del, zeta, delnu, dele, delg, delnp, delep };
})();

// `elp82b.f`'s closing precession matrix: ecliptic of date → ELP inertial J2000.
const ELP_P = [0.10180391e-4, 0.47020439e-6, -0.5417367e-9, -0.2507948e-11, 0.463486e-14];
const ELP_Q = [-0.113469002e-3, 0.12372674e-6, 0.1265417e-8, -0.1371808e-11, -0.320334e-14];

// `elp82b.f` up to but not including its final rotation, `prec` fixed at zero:
// radians and km, ecliptic of date, longitude from the inertial J2000 origin.
export function elpSphericalReference(jdTt: number): { lon: number; lat: number; dist: number } {
  const tables = readElp2000();
  const t = [0, 1, 0, 0, 0, 0];
  t[2] = (jdTt - 2451545.0) / 36525.0;
  t[3] = t[2]! * t[2]!;
  t[4] = t[3]! * t[2]!;
  t[5] = t[4]! * t[2]!;
  const r = [0, 0, 0, 0];
  const { del, zeta, p, dtasm, am, delnu, dele, delg, delnp, delep, deg, rad, w, a0, ath } = ELP;

  for (let file = 1; file <= 36; file++) {
    const iv = ((file - 1) % 3) + 1;

    if (file <= 3) {
      for (const { ilu, coef } of tables.main[file]!) {
        const tgv = coef[2]! + dtasm * coef[6]!;
        let a = coef[1]!;
        if (file === 3) a = a - (2 * a * delnu) / 3;
        a = a + tgv * (delnp - am * delnu) + coef[3]! * delg + coef[4]! * dele + coef[5]! * delep;
        let y = 0;
        for (let k = 1; k <= 5; k++) {
          for (let i = 1; i <= 4; i++) y += ilu[i - 1]! * del[i]![k]! * t[k]!;
        }
        if (iv === 3) y += Math.PI / 2;
        r[iv] = r[iv]! + a * Math.sin(y % (2 * Math.PI));
      }
    } else if (file <= 9 || file >= 22) {
      // Earth figure, tides, relativity, solar eccentricity.
      for (const { iz, ilu, pha, a } of tables.pert[file]!) {
        let x = a;
        if (file >= 7 && file <= 9) x *= t[2]!;
        if (file >= 25 && file <= 27) x *= t[2]!;
        if (file >= 34 && file <= 36) x *= t[3]!;
        let y = pha * deg;
        for (let k = 1; k <= 2; k++) {
          y += iz * zeta[k]! * t[k]!;
          for (let i = 1; i <= 4; i++) y += ilu[i - 1]! * del[i]![k]! * t[k]!;
        }
        r[iv] = r[iv]! + x * Math.sin(y % (2 * Math.PI));
      }
    } else {
      // Tables 1 and 2 index their multipliers differently: `ific.ge.16`.
      for (const { ipla, pha, a } of tables.planet[file]!) {
        let x = a;
        if (file >= 13 && file <= 15) x *= t[2]!;
        if (file >= 19 && file <= 21) x *= t[2]!;
        let y = pha * deg;
        if (file < 16) {
          for (let k = 1; k <= 2; k++) {
            y += (ipla[8]! * del[1]![k]! + ipla[9]! * del[3]![k]! + ipla[10]! * del[4]![k]!) * t[k]!;
            for (let i = 1; i <= 8; i++) y += ipla[i - 1]! * p[i]![k]! * t[k]!;
          }
        } else {
          for (let k = 1; k <= 2; k++) {
            for (let i = 1; i <= 4; i++) y += ipla[i + 6]! * del[i]![k]! * t[k]!;
            for (let i = 1; i <= 7; i++) y += ipla[i - 1]! * p[i]![k]! * t[k]!;
          }
        }
        r[iv] = r[iv]! + x * Math.sin(y % (2 * Math.PI));
      }
    }
  }

  return {
    lon: r[1]! / rad + w[1]![1]! + w[1]![2]! * t[2]! + w[1]![3]! * t[3]! + w[1]![4]! * t[4]! + w[1]![5]! * t[5]!,
    lat: r[2]! / rad,
    dist: (r[3]! * a0) / ath,
  };
}

// The p/q matrix carries the ecliptic plane back to J2000 but holds no rotation
// about the pole, so IAU 2006 precession must follow to move the origin to date.
function elpToEclipticOfDate(lon: number, lat: number, dist: number, t: number): Vec3 {
  const cl = dist * Math.cos(lat);
  const x1 = cl * Math.cos(lon), x2 = cl * Math.sin(lon), x3 = dist * Math.sin(lat);
  let pw = (ELP_P[0]! + (ELP_P[1]! + (ELP_P[2]! + (ELP_P[3]! + ELP_P[4]! * t) * t) * t) * t) * t;
  let qw = (ELP_Q[0]! + (ELP_Q[1]! + (ELP_Q[2]! + (ELP_Q[3]! + ELP_Q[4]! * t) * t) * t) * t) * t;
  const ra = 2 * Math.sqrt(1 - pw * pw - qw * qw);
  const pwqw = 2 * pw * qw, pw2 = 1 - 2 * pw * pw, qw2 = 1 - 2 * qw * qw;
  pw *= ra; qw *= ra;
  let v: Vec3 = [
    pw2 * x1 + pwqw * x2 + pw * x3,
    pwqw * x1 + qw2 * x2 - qw * x3,
    -pw * x1 + qw * x2 + (pw2 + qw2 - 1) * x3,
  ];
  // Ecliptic J2000 → equatorial J2000 → equatorial of date → ecliptic of date.
  const { zeta, z, theta } = precessionAngles(t);
  v = rotX(v, EPS0_ARCSEC * ARCSEC_TO_RAD);
  v = rotZ(v, zeta * ARCSEC_TO_RAD);
  v = rotY(v, -theta * ARCSEC_TO_RAD);
  v = rotZ(v, z * ARCSEC_TO_RAD);
  v = rotX(v, -meanObliquityArcsec(t) * ARCSEC_TO_RAD);
  return v;
}

export interface ApparentPosition {
  lonDeg: number;
  latDeg: number;
  /** AU for the Sun and planets, km for the Moon. */
  distance: number;
}

const norm360 = (d: number): number => ((d % 360) + 360) % 360;

// VSOP87D is already of date, so the corrections are light-time, nutation in
// longitude, and the VSOP87 to FK5 offset of -0.09033″ (Bretagnon & Francou 1988).
export function sunApparentReference(jdTt: number): ApparentPosition {
  const t = (jdTt - 2451545.0) / 36525;
  const [, , r0] = vsopReference('ear', jdTt);
  const tau = (r0 * AU_KM) / KM_PER_LIGHT_DAY;
  const [L, B, R] = vsopReference('ear', jdTt - tau);
  const { dpsi } = nutationReference(t);
  const lonDeg = L * RAD_TO_DEG + 180;
  const latDeg = -B * RAD_TO_DEG;
  return {
    lonDeg: norm360(lonDeg + dpsi / 3600 - 0.09033 / 3600),
    latDeg: latDeg + (0.03916 / 3600) * (Math.cos(lonDeg * DEG_TO_RAD) - Math.sin(lonDeg * DEG_TO_RAD)),
    distance: R,
  };
}

// No stellar-aberration term, deliberately: the observer's velocity is shared by
// the Moon and cancels against the barycentric part of the light-time term.
export function moonApparentReference(jdTt: number): ApparentPosition {
  const first = elpSphericalReference(jdTt);
  const tau = first.dist / KM_PER_LIGHT_DAY;
  // Position at the retarded epoch, nutation at the observation epoch; the
  // equinox mismatch that buys is worth 2 × 10⁻⁶″.
  const retarded = (jdTt - tau - 2451545.0) / 36525;
  const s = elpSphericalReference(jdTt - tau);
  const v = elpToEclipticOfDate(s.lon, s.lat, s.dist, retarded);
  const { dpsi } = nutationReference((jdTt - 2451545.0) / 36525);
  return {
    lonDeg: norm360(Math.atan2(v[1], v[0]) * RAD_TO_DEG + dpsi / 3600),
    latDeg: Math.asin(v[2] / Math.hypot(v[0], v[1], v[2])) * RAD_TO_DEG,
    distance: Math.hypot(v[0], v[1], v[2]),
  };
}

// The Earth is read at the retarded epoch too: to first order, reading the
// observer τ earlier is annual aberration.
export function planetApparentReference(body: VsopBody, jdTt: number): ApparentPosition {
  const t = (jdTt - 2451545.0) / 36525;
  let tau = 0;
  let geo: Vec3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const earth = sphericalToRect(vsopReference('ear', jdTt - tau));
    const planet = sphericalToRect(vsopReference(body, jdTt - tau));
    geo = [planet[0] - earth[0], planet[1] - earth[1], planet[2] - earth[2]];
    tau = (Math.hypot(geo[0], geo[1], geo[2]) * AU_KM) / KM_PER_LIGHT_DAY;
  }
  const { dpsi } = nutationReference(t);
  const lonDeg = Math.atan2(geo[1], geo[0]) * RAD_TO_DEG;
  const distance = Math.hypot(geo[0], geo[1], geo[2]);
  return {
    lonDeg: norm360(lonDeg + dpsi / 3600 - 0.09033 / 3600),
    latDeg: Math.asin(geo[2] / distance) * RAD_TO_DEG,
    distance,
  };
}

function sphericalToRect([L, B, R]: [number, number, number]): Vec3 {
  const cb = R * Math.cos(B);
  return [cb * Math.cos(L), cb * Math.sin(L), R * Math.sin(B)];
}
