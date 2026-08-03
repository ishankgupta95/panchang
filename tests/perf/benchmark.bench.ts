import { bench, describe } from 'vitest';
import { getDailyPanchang, getInstantPanchang } from '../../src/index';

const PUNE       = { latitude: 18.5204,  longitude: 73.8567  };
const NYC        = { latitude: 40.7128,  longitude: -74.0060 };
const DELHI      = { latitude: 28.6139,  longitude: 77.2090  };

const DATE_SUMMER = new Date('2025-07-04');
const DATE_WINTER = new Date('2025-01-14');
const DATE_EOY    = new Date('2025-12-31');

// ── Section narrowing (the main cost lever) ──────────────────────────────────

describe('getDailyPanchang — section narrowing', () => {
  bench('all sections + end-times (default shape)', () => {
    getDailyPanchang(DATE_SUMMER, PUNE, { timezone: 330 });
  });

  bench('without festivals (the costliest section)', () => {
    getDailyPanchang(DATE_SUMMER, PUNE, {
      timezone: 330,
      sections: ['eclipse', 'moonTimes', 'lunarWindows'],
    });
  });

  bench('no optional sections', () => {
    getDailyPanchang(DATE_SUMMER, PUNE, { timezone: 330, sections: [] });
  });

  bench('no optional sections, no end-times', () => {
    getDailyPanchang(DATE_SUMMER, PUNE, {
      timezone: 330,
      sections: [],
      computeEndTimes: false,
    });
  });
});

// ── Fast mode (names only, no end-time binary search) ─────────────────────────

describe('getDailyPanchang — fast mode (computeEndTimes: false)', () => {
  bench('Pune summer', () => {
    getDailyPanchang(DATE_SUMMER, PUNE, { timezone: 330, computeEndTimes: false });
  });

  bench('Pune winter', () => {
    getDailyPanchang(DATE_WINTER, PUNE, { timezone: 330, computeEndTimes: false });
  });

  bench('NYC (negative longitude)', () => {
    getDailyPanchang(DATE_SUMMER, NYC, { timezone: -240, computeEndTimes: false });
  });
});

// ── Full mode (with end-time binary search) ───────────────────────────────────

describe('getDailyPanchang — full mode (computeEndTimes: true)', () => {
  bench('Pune summer', () => {
    getDailyPanchang(DATE_SUMMER, PUNE, { timezone: 330, computeEndTimes: true });
  });

  bench('Pune winter', () => {
    getDailyPanchang(DATE_WINTER, PUNE, { timezone: 330, computeEndTimes: true });
  });

  bench('Delhi year-end', () => {
    getDailyPanchang(DATE_EOY, DELHI, { timezone: 330, computeEndTimes: true });
  });

  bench('NYC (negative longitude)', () => {
    getDailyPanchang(DATE_SUMMER, NYC, { timezone: -240, computeEndTimes: true });
  });
});

// ── High precision mode ───────────────────────────────────────────────────────

describe('getDailyPanchang — high precision', () => {
  bench('Pune full precision', () => {
    getDailyPanchang(DATE_WINTER, PUNE, {
      timezone: 330,
      computeEndTimes: true,
      precision: 'high',
    });
  });
});

// ── Instant mode ──────────────────────────────────────────────────────────────

describe('getInstantPanchang', () => {
  const moment = new Date('2025-07-04T06:00:00Z');

  bench('Pune instant', () => {
    getInstantPanchang(moment, PUNE);
  });

  bench('NYC instant', () => {
    getInstantPanchang(moment, NYC);
  });
});
