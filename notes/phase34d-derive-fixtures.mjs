#!/usr/bin/env node
/**
 * Phase 34d fixture derivation. Loads AstroSage R-tier natal positions and
 * applies the canonical drik-panchang rule set (Phase 34a research) to compute
 * expected Mangal Dosha and Kaal Sarp Dosha verdicts. No library involvement —
 * this is pure arithmetic on the published natal positions.
 *
 * Run with: node notes/phase34d-derive-fixtures.mjs
 *
 * Output is for human review + transcription into
 * tests/fixtures/drik-parity/charts.json. The file's "expected" values should
 * be CITED back to this script for auditability.
 */

import { readFileSync } from 'node:fs';

const RASHI_NAMES = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];
const RASHI_IDX = Object.fromEntries(RASHI_NAMES.map((n, i) => [n, i]));

const SUBTYPE_BY_HOUSE = [
  'anant', 'kulik', 'vasuki', 'shankhpal', 'padma', 'mahapadma',
  'takshak', 'karkotak', 'shankhachud', 'ghatak', 'vishdhar', 'sheshnag',
];

const NAK_NAMES = [
  'Ashvini', 'Bharani', 'Krittika', 'Rohini', 'Mrigasira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta',
  'Satabhisa', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];
const NAK_IDX = Object.fromEntries(NAK_NAMES.map((n, i) => [n, i]));

const SELECTED = [
  'Narendra Modi', 'Sachin Tendulkar', 'Ratan Tata', 'Mukesh Ambani',
  'Sonia Gandhi', 'Salman Khan', 'Bill Clinton', 'Hillary Clinton',
  'Barack Obama', 'Donald Trump', 'Mark Zuckerberg', 'Priyanka Chopra',
];

function houseFrom(refRashi, planetRashi) {
  return ((planetRashi - refRashi + 12) % 12) + 1;
}

function siderealLongitude(rashi, degreeInRashi) {
  return rashi * 30 + degreeInRashi;
}

function deriveMangal(chart) {
  const r = chart;
  const lagnaR = RASHI_IDX[r.lagna.rashi];
  const moonR = RASHI_IDX[r.moon.rashi];
  const venusR = RASHI_IDX[r.venus.rashi];
  const marsR = RASHI_IDX[r.mars.rashi];
  const jupiterR = RASHI_IDX[r.jupiter.rashi];

  const fromLagnaHouse = houseFrom(lagnaR, marsR);
  const fromMoonHouse = houseFrom(moonR, marsR);
  const fromVenusHouse = houseFrom(venusR, marsR);

  const flagged = new Set([1, 2, 4, 7, 8, 12]);
  const fromLagnaAfflicted = flagged.has(fromLagnaHouse);
  const fromMoonAfflicted = flagged.has(fromMoonHouse);
  const fromVenusAfflicted = flagged.has(fromVenusHouse);

  const flaggedCount = (fromLagnaAfflicted ? 1 : 0)
                     + (fromMoonAfflicted ? 1 : 0)
                     + (fromVenusAfflicted ? 1 : 0);
  const severity = flaggedCount === 0 ? 'none'
                 : flaggedCount === 3 ? 'purna' : 'anshik';

  let afflicted = flaggedCount > 0;
  const cancellations = [];

  if (afflicted) {
    // Mars own (0 = Aries / 7 = Scorpio) or exalted (9 = Capricorn)
    if (marsR === 0 || marsR === 7) {
      cancellations.push(`Mars in own sign ${marsR === 0 ? 'Aries' : 'Scorpio'}`);
      afflicted = false;
    } else if (marsR === 9) {
      cancellations.push('Mars exalted in Capricorn');
      afflicted = false;
    }

    // Same-rashi conjunctions (whole-sign house equals same-rashi)
    if (marsR === jupiterR) {
      cancellations.push(`Mars conjunct Jupiter in ${RASHI_NAMES[marsR]}`);
      afflicted = false;
    }
    if (marsR === moonR) {
      cancellations.push(`Mars conjunct Moon in ${RASHI_NAMES[marsR]}`);
      afflicted = false;
    }
    if (marsR === venusR) {
      cancellations.push(`Mars conjunct Venus in ${RASHI_NAMES[marsR]}`);
      afflicted = false;
    }

    // Jupiter's 5/7/9 sign-aspect onto Mars
    const marsFromJupiter = ((marsR - jupiterR + 12) % 12) + 1;
    if ([5, 7, 9].includes(marsFromJupiter)) {
      cancellations.push(`Mars aspected by Jupiter (${marsFromJupiter}th aspect)`);
      afflicted = false;
    }
  }

  return {
    afflicted,
    severity,
    fromLagna: { afflicted: fromLagnaAfflicted, house: fromLagnaHouse },
    fromMoon: { afflicted: fromMoonAfflicted, house: fromMoonHouse },
    fromVenus: { afflicted: fromVenusAfflicted, house: fromVenusHouse },
    cancellations,
  };
}

function deriveKaalSarp(chart) {
  const lagnaR = RASHI_IDX[chart.lagna.rashi];
  const rahuR = RASHI_IDX[chart.rahu.rashi];
  const ketuR = RASHI_IDX[chart.ketu.rashi];

  const rahuLon = siderealLongitude(rahuR, chart.rahu.degree);
  const rahuHouse = houseFrom(lagnaR, rahuR);
  const ketuHouse = houseFrom(lagnaR, ketuR);

  const visible = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];
  const distances = visible.map((p) => {
    const planetR = RASHI_IDX[chart[p].rashi];
    const lon = siderealLongitude(planetR, chart[p].degree);
    return ((lon - rahuLon) % 360 + 360) % 360;
  });

  let inForward = 0, inBackward = 0;
  for (const d of distances) {
    if (d > 0 && d < 180) inForward++;
    else if (d > 180 && d < 360) inBackward++;
  }
  const total = 7;
  const afflicted = inForward === total || inBackward === total;
  const partial = !afflicted && (inForward === total - 1 || inBackward === total - 1);

  return {
    afflicted,
    subtype: afflicted ? SUBTYPE_BY_HOUSE[rahuHouse - 1] : null,
    partial,
    rahuHouse,
    ketuHouse,
  };
}

function deriveNakshatraIndex(chart) {
  // Moon nakshatra index from canonical AstroSage Moon nakshatra name.
  const moonNak = chart.moon.nakshatra;
  // AstroSage spelling: "Uttara Phalguni", "Purva Ashadha", "Mrigasira",
  // "Ashvini", "Satabhisa", "Dhanishta" — match against NAK_NAMES.
  if (moonNak in NAK_IDX) return NAK_IDX[moonNak];
  // Try a couple of common aliases
  const aliases = {
    'Ashwini': 'Ashvini',
    'Mrigshira': 'Mrigasira',
    'Mrigashira': 'Mrigasira',
    'Sata Bhisha': 'Satabhisa',
    'Shatabhisha': 'Satabhisa',
    'Dhanishtha': 'Dhanishta',
  };
  const alias = aliases[moonNak];
  if (alias && alias in NAK_IDX) return NAK_IDX[alias];
  throw new Error(`Unknown nakshatra: ${moonNak}`);
}

const data = JSON.parse(readFileSync(new URL('../tests/fixtures/astrosage-charts.json', import.meta.url), 'utf8'));

console.log(JSON.stringify({
  charts: data.charts
    .filter((c) => SELECTED.includes(c.name))
    .map((c) => ({
      name: c.name,
      natalMoonRashi: RASHI_IDX[c.moon.rashi],
      natalMoonRashiName: c.moon.rashi,
      natalMoonNakshatra: deriveNakshatraIndex(c),
      natalMoonNakshatraName: c.moon.nakshatra,
      natalLagnaRashi: RASHI_IDX[c.lagna.rashi],
      mangal: deriveMangal(c),
      kaalSarp: deriveKaalSarp(c),
    })),
}, null, 2));
