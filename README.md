# panchang-ts

[![npm version](https://img.shields.io/npm/v/panchang-ts)](https://www.npmjs.com/package/panchang-ts)

Pure TypeScript Hindu Panchang (almanac), Jyotish, and Birth Chart calculations.
Zero native dependencies. Works offline in React Native (Hermes), Node.js, and browsers.

**Fast** (~0.1 ms names-only, ~0.5 ms full) | **Typed** (full TypeScript types) | **Offline** (pure JS math, no network) | **6,912 tests**

---

## Install

```bash
npm install panchang-ts
# or
pnpm add panchang-ts
# or
yarn add panchang-ts
```

---

## Features at a Glance

Every category below is implemented end-to-end, cross-verified against reference panchang
sources, and exposed through the public API. Click a row to jump to its usage example.

| Category | Features | Jump to |
|----------|----------|---------|
| **Pancha Anga (5 limbs)** | Tithi, Nakshatra, Yoga, Karana, Vara — with all transitions through the day | [↓](#1-pancha-anga--the-five-limbs) |
| **Lunar Calendar** | Chandra Masa (Purnimanta + Amanta), Adhika (leap-month) detection, Vikram Samvat, Shaka Samvat | [↓](#2-lunar-calendar) |
| **Solar Calendar** | Saura Masa, Surya Nakshatra, Sankranti (transit-based) | [↓](#3-solar-calendar) |
| **Sun & Moon** | Sunrise, Sunset, Moonrise, Moonset, Chandra Rashi (Moon sign) | [↓](#4-sun--moon) |
| **Auspicious Muhurta** | Brahma, Abhijit, Vijaya, Godhuli, Nishita, Madhyahna, Pratah / Sayahna Sandhya, Amrit Kala | [↓](#5-auspicious-muhurta) |
| **Inauspicious Periods** | Rahu Kalam, Gulika Kalam, Yamaganda, Dur Muhurta, Varjyam, Ganda Mula, Bhadra Kala, Panchaka | [↓](#6-inauspicious-periods) |
| **Time-Slot Systems** | Choghadiya (16), Gowri Panchangam / Nalla Neram (16), Hora (24), Do Ghati (30), Panchaka Rahita | [↓](#7-time-slot-systems) |
| **Special Yogas** | Anandadi (28-name cycle), Amrit Siddhi, Sarvartha Siddhi, Ravi / Guru Pushya, Dwipushkar, Tripushkar, Jwalamukhi, Aadal, Vidaal, Ravi | [↓](#8-special-yogas) |
| **Festivals (80+)** | Ekadashi (Smarta + Vaishnava split), Pradosha, Sankranti variants, classical festivals (Diwali, Holi, Shivaratri…), regional festivals across 21 states + Nepal | [↓](#9-festivals) |
| **Eclipses (Grahan)** | Solar + lunar detection, subtype, magnitude, observer-horizon visibility, sutak window | [↓](#10-eclipses) |
| **Planetary Positions** | All 9 grahas (sidereal) with rashi, nakshatra, pada, retrograde — mean or true Rahu/Ketu | [↓](#11-planetary-positions) |
| **Vimshottari Dasha** | Maha → Antar → Pratyantar (3-level) breakdown from birth | [↓](#12-vimshottari-dasha) |
| **Personal Transits** | Chandra Balam, Tarabala (9-tara cycle), Sade Sati (Saturn arc) | [↓](#13-personal-transits) |
| **Birth Chart (Kundli)** | Lagna (sidereal), Bhava under 3 house systems, D1 (Rashi), D9 (Navamsa), Planetary Dignity | [↓](#14-birth-chart-kundli) |
| **Compatibility & Doshas** | Ashtakoot Guna Milan (36-point), Mangal Dosha (Manglik) | [↓](#15-compatibility--doshas) |
| **Localization** | English + Hindi (Devanagari) on every returned name | [↓](#16-localization) |
| **Configuration** | 5 ayanamsas (Lahiri, Raman, KP, True Chitrapaksha, Thirukanitham), 2 masa systems, 3 house systems, 21 regional festival scopes | [↓](#17-configuration) |

---

## Used By

- [dharmagya.app](https://dharmagya.app) — Daily Panchang and Hindu calendar

---

## Quick Start

```typescript
import { getDailyPanchang } from 'panchang-ts';

const result = getDailyPanchang(
  new Date(2025, 0, 14),                      // January 14, 2025
  { latitude: 23.1765, longitude: 75.7885 },  // Ujjain, India
  { timezone: 330 },                          // IST = UTC+5:30 = 330 minutes
);
// result is `DailyPanchangResult | null` — null only at polar latitudes
// where sunrise can't be computed. Anywhere else, narrow with `if (!result) return;`

console.log(result.tithis[0].name);           // "Krishna Chaturdashi"
console.log(result.nakshatras[0].name);       // "Mrigashira"
console.log(result.vara.name);                // "Mangalawara"
console.log(result.chandramasa.name);         // "Magha"
console.log(result.samvat.vikramSamvat);      // 2081
```

### Reading Output Times

All `Date` objects in the result are **offset-adjusted** to the requested timezone. Always
read time components via `getUTC*` methods — `.getHours()` would use your system zone:

```typescript
const sunrise = result.sunrise;
const h = sunrise.getUTCHours();    // 7
const m = sunrise.getUTCMinutes();  // 4
// → Sunrise at 07:04 local time

function fmt(d: Date) {
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  return `${h}:${String(m).padStart(2, '0')}`;
}
fmt(result.rahuKalam.start); // "09:04"
```

`moonrise` and `moonset` can be `null` — the Moon occasionally does not rise or set on a
given calendar day, which is normal.

### `getDailyPanchang` vs `getInstantPanchang`

| Use case | Recommended | Why |
|----------|-------------|-----|
| "What Panchang elements are active right now?" | `getInstantPanchang` | Single-moment snapshot; no sunrise needed |
| Birth chart / muhurta picking at a specific instant | `getInstantPanchang` | Exact element at that UTC moment |
| Daily calendar / almanac row for a date | `getDailyPanchang` | Lists all element transitions for the day |
| Today's festivals & observances | `getDailyPanchang` | Full canonical-time festival refinement |
| Rahu Kalam / Choghadiya / Gowri / Hora / muhurtas | `getDailyPanchang` | Computed from sunrise, sunset, day length |
| Eclipse detection with sutak window | `getDailyPanchang` | Overlapping the day needs the day window |

`getInstantPanchang` does emit `festivals`, but evaluates rules against the elements at the
given instant only. It does not run canonical-time refinements (madhyahna / pradosha /
nishita / chandrodaya), transit-based Sankranti, Ekadashi viddha (Smarta/Vaishnava split),
or Bhadra-aware Raksha Bandhan exclusion. For reliable festival dating, use
`getDailyPanchang`.

---

# Feature Reference

Each section below shows how to access one feature category. Every feature is also
returned as a field on the unified `DailyPanchangResult` from `getDailyPanchang(…)` if you
prefer one call over the per-feature helpers.

## 1. Pancha Anga — the Five Limbs

Tithi, Nakshatra, Yoga, Karana, Vara — with start / end times for every transition during
the Hindu day.

```typescript
import { getDailyPanchang } from 'panchang-ts';

const r = getDailyPanchang(date, location, { timezone: 330 })!;

// Tithis active during the day (usually 1-2)
r.tithis.forEach(t => {
  console.log(t.name, t.paksha, t.completionPercentage, t.endTime);
});

// Nakshatras (with pada)
r.nakshatras.forEach(n => console.log(n.name, n.pada, n.endTime));

// Yogas (27-name lunisolar cycle)
r.yogas.forEach(y => console.log(y.name, y.endTime));

// Karanas (half-tithi; usually 2-4 per day)
r.karanas.forEach(k => console.log(k.name, k.type, k.endTime));

// Vara (weekday)
console.log(r.vara.name, r.vara.englishName);  // "Mangalawara", "Tuesday"
```

For a single-instant snapshot use `getInstantPanchang`:

```typescript
import { getInstantPanchang } from 'panchang-ts';

const i = getInstantPanchang(new Date(), location)!;
console.log(i.tithi.name, i.nakshatra.name, i.yoga.name, i.karana.name, i.vara.name);
```

## 2. Lunar Calendar

Chandra Masa with **Purnimanta** (North Indian, default) and **Amanta** (South Indian)
naming, **Adhika** (leap-month) detection, **Vikram** and **Shaka** samvat year numbers.

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330, masaSystem: 'purnimanta' })!;

console.log(r.chandramasa.name);           // "Magha"   (active system)
console.log(r.chandramasa.amantaName);     // "Pausha"  (South Indian)
console.log(r.chandramasa.purnimantaName); // "Magha"   (North Indian)
console.log(r.chandramasa.isAdhika);       // false (true during leap months)

console.log(r.samvat.vikramSamvat);        // 2081
console.log(r.samvat.shakaSamvat);         // 1946
```

## 3. Solar Calendar

Saura Masa (solar month), Surya Nakshatra (the Sun's nakshatra, ~13–14 day transit),
Sankranti (solar-month boundary, transit-based — emitted as a festival).

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330 })!;

console.log(r.masa.name);              // "Makara" (current solar month)
console.log(r.suryaNakshatra.name);    // "Uttara Ashadha"
console.log(r.chandraRashi.name);      // "Mithuna" (Moon sign)

// Sankranti and its regional variants emit through r.festivals — see §9.
```

## 4. Sun & Moon

Sunrise, sunset, moonrise, moonset (Meeus apparent-upper-limb), plus Chandra Rashi
(Moon's zodiac sign).

```typescript
import { getSunrise, getSunset, getMoonrise, getMoonset } from 'panchang-ts';

const loc = { latitude: 28.6139, longitude: 77.2090 };  // New Delhi

const sunrise = getSunrise(localMidnightUtc, loc);
const sunset  = getSunset(sunrise, loc);

// Moonrise / moonset can be null on days the Moon doesn't rise/set
const moonrise = getMoonrise(localMidnightUtc, loc);
const moonset  = getMoonset(localMidnightUtc, loc);

// Or read all of them off the daily result:
const r = getDailyPanchang(date, loc, { timezone: 330 })!;
console.log(r.sunrise, r.sunset, r.moonrise, r.moonset, r.nextSunrise);
console.log(r.dayDurationMinutes, r.nightDurationMinutes);
```

## 5. Auspicious Muhurta

Classical auspicious time windows: Brahma, Abhijit, Vijaya, Godhuli, Nishita, Madhyahna,
Pratah / Sayahna Sandhya, and nakshatra-keyed Amrit Kala.

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330 })!;

r.brahmaMuhurta;     // two muhurtas before sunrise
r.abhijitMuhurta;    // 8th day-muhurta — universally auspicious
r.vijayaMuhurta;     // 11th day-muhurta — auspicious for success
r.godhuliMuhurta;    // "cow-dust" — sunset muhurta
r.nishitaMuhurta;    // midnight muhurta (Shivaratri)
r.madhyahna;         // solar noon ±24 min
r.pratahSandhya;     // dawn twilight, ends *at* sunrise
r.sayahnaSandhya;    // dusk twilight, starts *at* sunset
r.amritKala;         // nakshatra-specific window (null when nakshatra has none)

// Direct helpers:
import {
  computeBrahmaMuhurta, computeAbhijitMuhurta, computeVijayaMuhurta,
  computeGodhuliMuhurta, computeNishitaMuhurta, computeMadhyahna,
  computePratahSandhya, computeSayahnaSandhya, computeAmritKala,
} from 'panchang-ts';
```

`pratahSandhya` and `sayahnaSandhya` are asymmetric — width = `nightDuration / 10`
(~62–81 min depending on season), matching DrikPanchang within ±2 min.

## 6. Inauspicious Periods

Rahu Kalam, Gulika Kalam, Yamaganda, Dur Muhurta (2 windows), Varjyam (BPHS-keyed
~96-min forbidden window), Ganda Mula (Moon in root nakshatras), Bhadra Kala (Vishti
karana with earth/heaven/paatal location), Panchaka.

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330 })!;

r.rahuKalam;       // { start, end }
r.gulikaKalam;     // { start, end }
r.yamaganda;       // { start, end }
r.durMuhurta;      // [TimePeriod, TimePeriod] — two ~48-min windows
r.varjyam;         // { start, end } | null
r.gandaMula;       // { active: boolean, severity: 'mild' | 'severe' | null, ... }
r.bhadra;          // { start, end, location: 'earth'|'heaven'|'paatal', isActive } | null
r.panchaka;        // boolean — Moon in last 5 nakshatras

// Direct helpers (varaIndex: 0=Sun ... 6=Sat):
import {
  computeRahuKalam, computeGulikaKalam, computeYamaganda,
  computeVarjyam, computeGandaMula,
} from 'panchang-ts';

const rahu = computeRahuKalam(sunrise, sunset, varaIndex);
```

## 7. Time-Slot Systems

Four parallel slot systems covering the Hindu day:

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330 })!;

// Choghadiya — 8 day + 8 night slots, each named (Amrit, Kaal, Shubh, Rog, ...) and rated
r.choghadiya.day.forEach(s => console.log(s.name, s.qualityName, s.start, s.end));
r.choghadiya.night.forEach(s => console.log(s.name, s.qualityName));

// Gowri Panchangam (Tamil "Nalla Neram") — 8 day + 8 night slots
r.gowriPanchangam.day.forEach(s => console.log(s.name, s.qualityName));

// Hora — 12 day + 12 night planetary hours (Chaldean order)
r.hora.day.forEach(h => console.log(h.planet, h.start, h.end));

// Do Ghati Muhurta — 15 day + 15 night ~48-min deity-keyed slots (no vara rotation)
r.doGhatiMuhurta.day.forEach(g => console.log(g.name, g.start, g.end));

// Panchaka Rahita — slices of the day FREE of Panchaka ([] when Panchaka pervades)
r.panchakaRahita.forEach(slice => console.log(slice.start, slice.end));
```

## 8. Special Yogas

Auspicious / inauspicious yogas formed by Vara × Tithi × Nakshatra combinations and
Moon-from-Sun nakshatra-distance rules. The 28-name **Anandadi Yoga** cycle is also
returned at sunrise.

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330 })!;

// Anandadi Yoga (Vara × Nakshatra cycle of 28 names)
console.log(r.anandadiYoga.name);   // "Ananda"

// Special yogas active today
r.specialYogas.forEach(y => {
  console.log(y.name, y.type);
  // type: 'amrit_siddhi' | 'sarvartha_siddhi' | 'ravi_pushya' | 'guru_pushya'
  //     | 'dwipushkar' | 'tripushkar'   ← actions doubled / tripled
  //     | 'jwalamukhi'                  ← inauspicious (Muhurta-chintamani 6.32)
  //     | 'aadal' | 'vidaal' | 'ravi'   ← Moon-from-Sun nakshatra-distance rules
});
```

## 9. Festivals

**80+ festivals** spanning pan-Indian, regional, and classical observances:

- **Ekadashi** — 26 named variants (Putrada, Shat Tila, Nirjala, Devshayani, …) with
  **Smarta / Vaishnava split** via Dashami-viddha rule; Smarta fast emits a `deferralDate`
  for Dwadashi.
- **Pradosha** — 7 weekday-qualified variants (Som, Bhauma, Shani, …) on both pakshas.
- **Sankranti** — transit-based detection plus regional variants (Pongal, Vishu, Baisakhi,
  Pohela Boishakh, Bohag / Magh / Kati Bihu, Uttarayan, Ayyappa Makara Jyothi, Raja
  Sankranti, Harela, Sair, Singh Sankranti). **Lohri** fires on the Hindu day immediately
  preceding Makara Sankranti under Punjab / Haryana / Himachal scopes.
- **Canonical-time classical festivals** — Ganesh Chaturthi (madhyahna), Shivaratri
  (nishita), Diwali, Holi, Raksha Bandhan (Bhadra-aware), Karva Chauth (chandrodaya),
  Janmashtami, Dussehra, Navaratri, Ram Navami, Hanuman Jayanti, Akshaya Tritiya &
  Parashurama Jayanti (madhyahna-vyapini), Makar Sankranti.
- **Regional festivals** — Gudi Padwa, Gangaur, Karaga, Bonalu, Varamahalakshmi,
  Bathukamma, Hariyali / Kajari / Hartalika Teej, Govardhan Puja, Bhai Dooj, Phagli,
  Jagannath Rath Yatra, Raja Parba 3-day arc.
- **Regional & seasonal** — Chhath (4-day sequence), Vat Savitri, Upakarma, Onam.
- **Monthly observances** — Masik Shivaratri, Vinayaka Chaturthi, Masik Karthigai, Pushya
  days, Shravan Somvar, and other month + weekday patterns.

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330 })!;

r.festivals.forEach(f => {
  console.log(f.name, f.type, f.deferralDate);
  // type: 'major' | 'minor' | 'ekadashi'
  //     | 'smarta_ekadashi' | 'vaishnava_ekadashi'   ← Smarta sets deferralDate
  //     | 'pradosha' | 'sankranti' | 'eclipse'
});
```

### Regional festival scoping

The `region` option scopes regional festival variants to one Indian state. Pan-Indian
festivals (Diwali, Holi, Raksha Bandhan, the canonical `sankranti` event) emit regardless.

```typescript
// Default — every regional variant emits on Makar Sankranti day:
const all = getDailyPanchang(jan14, chennai, { timezone: 330 })!;
all.festivals.map(f => f.name);
// → ["Sankranti", "Makar Sankranti", "Pongal", "Uttarayan",
//    "Magh Bihu", "Ayyappa Makara Jyothi"]

// Scope to Tamil Nadu — drops Bihu/Ayyappa/Uttarayan:
const tn = getDailyPanchang(jan14, chennai, { timezone: 330, region: 'tamil-nadu' })!;
tn.festivals.map(f => f.name);
// → ["Sankranti", "Makar Sankranti", "Pongal"]

// Lohri fires on the Hindu day BEFORE Makara transit, scoped to Punjab/Haryana/Himachal
const lohri = getDailyPanchang(jan13, amritsar, { timezone: 330, region: 'punjab' })!;
lohri.festivals.some(f => f.name === 'Lohri');  // true
```

`FestivalRegion` covers 21 Indian states + `'nepal'` + `'all'` (default). See
[Types](#types--exports) for the full slug list.

## 10. Eclipses

Solar / lunar eclipse detection with subtype, magnitude, observer-horizon visibility, and
classical pre-eclipse **sutak** impurity window.

```typescript
const r = getDailyPanchang(date, loc, { timezone: 330 })!;

if (r.eclipse) {
  console.log(r.eclipse.kind);                 // 'solar' | 'lunar'
  console.log(r.eclipse.subtype);              // 'partial' | 'total' | 'annular' | 'penumbral'
  console.log(r.eclipse.magnitude);            // 0..1 fraction of disc obscured at peak
  console.log(r.eclipse.visibleFromLocation);  // body above horizon at peak?
  console.log(r.eclipse.start, r.eclipse.peak, r.eclipse.end);
  console.log(r.eclipse.sutakStart, r.eclipse.sutakEnd);
  // Sutak: 12 h (4 prahara) before solar, 9 h (3 prahara) before lunar
}

// Or look ahead:
import { getUpcomingSolarEclipse, getUpcomingLunarEclipse } from 'panchang-ts';
const next = getUpcomingSolarEclipse(new Date(), loc, /* withinDays */ 365);
```

## 11. Planetary Positions

All 9 grahas (Sun → Saturn + Rahu / Ketu) — geocentric, sidereal — with rashi, nakshatra,
pada, retrograde flag. Optional `nodeType: 'true'` upgrades Rahu / Ketu from mean node
(±2° worst-case) to Meeus's dominant periodic correction (~±0.6°).

```typescript
import { computePlanetaryPositions, GRAHA_ABBR } from 'panchang-ts';

const grahas = computePlanetaryPositions(new Date(), 'lahiri');
console.log(grahas.jupiter.rashi.name);       // "Dhanu"
console.log(grahas.jupiter.degreeInRashi);    // 18.42
console.log(grahas.jupiter.nakshatra.name);   // "Purva Ashadha"
console.log(grahas.jupiter.nakshatra.pada);   // 3
console.log(grahas.saturn.isRetrograde);      // true / false
console.log(GRAHA_ABBR['Jupiter']);           // "Ju"

// True node (more accurate Rahu / Ketu)
const grahasTrue = computePlanetaryPositions(new Date(), 'lahiri', undefined, 'true');
```

## 12. Vimshottari Dasha

Maha → Antar → Pratyantar (3-level) breakdown, derived from a birth moment alone or from
an explicit Moon longitude.

```typescript
import {
  computeVimshottariDasha, computeVimshottariDashaFromBirth,
  computeVimshottariPratyantar, getSiderealMoonLongitude,
} from 'panchang-ts';

// Convenience: from birth date alone (Moon longitude derived)
const dasha = computeVimshottariDashaFromBirth(birthDate, 'lahiri');
console.log(dasha.currentMahaDashaLord);                // "Rahu"
console.log(dasha.mahaDashas[0]!.antarDashas[0]!.lord); // "Rahu"

// Or pass an explicit Moon sidereal longitude
const moonLon = getSiderealMoonLongitude(birthDate, 'lahiri');
const dasha2  = computeVimshottariDasha(birthDate, moonLon);

// Pratyantar — third-level sub-sub-periods within an Antardasha
const firstAntar  = dasha.mahaDashas[0]!.antarDashas[0]!;
const pratyantars = computeVimshottariPratyantar(firstAntar);  // PratyantarDasha[9]
```

## 13. Personal Transits

Daily transit-based favorability relative to the native's birth Moon. Pass `janmaRashi`
or `janmaNakshatra` to `getDailyPanchang` and the corresponding field is added to the
result; or call the helpers directly.

```typescript
const r = getDailyPanchang(date, loc, {
  timezone: 330,
  janmaRashi: 3,        // 0 = Mesha ... 11 = Meena
  janmaNakshatra: 0,    // 0 = Ashwini ... 26 = Revati
})!;

r.chandraBalam!;  // { house, quality: 'strong' | 'weak', name, englishName }
r.tarabala!;      // { taraIndex, name, englishName, quality }

// Direct helpers:
import { computeChandraBalam, computeTarabala, computeSadeSati } from 'panchang-ts';

computeChandraBalam(3 /* janma */, 6 /* transit Moon rashi */);
computeTarabala(0 /* janma nakshatra */, 4 /* transit Moon nakshatra */);

// Sade Sati — Saturn currently transiting 12th, 1st, or 2nd from natal Moon
const sadeSati = computeSadeSati(natalMoonRashiIndex, new Date());
// → { active, phase: 1|2|3|null, currentArcStart, currentArcEnd, nextArcStart }
```

## 14. Birth Chart (Kundli)

Sidereal **Lagna**, **Bhava** under three house systems, **D1 (Rashi)** and **D9
(Navamsa)** charts placing all 9 grahas, and **Planetary Dignity**.

```typescript
import {
  computeLagna, computeBhava, computeRashiChart, computeNavamsa,
  computeDignity,
} from 'panchang-ts';

const birth = new Date('1995-08-15T05:30:00Z');
const loc   = { latitude: 28.6139, longitude: 77.2090 };

// 1. Lagna (sidereal ascendant)
const lagna = computeLagna(birth, loc, 'lahiri', 'en');
//   → { siderealLongitude, rashi, degreeInRashi, nakshatra, pada }

// 2. Bhava (12 houses)
//   - 'whole-sign'  (default classical Vedic) — each rashi is one house
//   - 'equal'       — each house spans 30° starting at lagna's exact degree
//   - 'placidus-kp' — true cuspal positions; throws PanchangError('CIRCUMPOLAR') > ±66.5°
const houses = computeBhava(birth, loc, { houseSystem: 'whole-sign' });

// 3. D1 (Rashi) chart — lagna + bhava + 9 grahas with house placement
const d1 = computeRashiChart(birth, loc, { houseSystem: 'whole-sign' });
d1.planets.find(p => p.planet === 'Jupiter')?.house;          // e.g. 5
d1.planets.find(p => p.planet === 'Saturn')?.isRetrograde;

// 4. D9 (Navamsa) chart — classical sign-based per-rashi-type rule
const d9 = computeNavamsa(birth, loc);

// 5. Planetary dignity (BPHS Ch.3-4)
computeDignity('Mars',    0);   // 'moolatrikona' (Aries)
computeDignity('Mars',    9);   // 'exalted' (Capricorn)
computeDignity('Sun',     6);   // 'debilitated' (Libra)
```

Birth-chart helpers accept the full ayanamsa set including `'true-chitra'` (True
Chitrapaksha) and `'thirukanitham'` (Tamil-Vakya). Pass via `options.ayanamsa` or the
ayanamsa positional arg.

## 15. Compatibility & Doshas

**Ashtakoot Guna Milan** (36-point marriage compatibility) and **Mangal Dosha** (Manglik
affliction with cancellations).

```typescript
import { computeAshtakoot, computeMangalDosha } from 'panchang-ts';

// Ashtakoot — from natal Moons
const match = computeAshtakoot(
  { rashi: 4, nakshatra: 9 },   // boy:  Simha / Magha
  { rashi: 0, nakshatra: 1 },   // girl: Mesha / Bharani
);
// → { totalScore: 0..36, koots: KootScore[8], cancellations: string[] }
// Koots in canonical order: Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot, Nadi
// (max scores 1, 2, 3, 4, 5, 6, 7, 8 respectively)

// Mangal Dosha — checks Mars from lagna, Moon, and Venus
const mangal = computeMangalDosha(d1);
// → { afflicted, fromLagna, fromMoon, fromVenus, cancellations }
```

**Documented limitations** — Mangal Dosha cancellations only cover Mars in own sign
(Aries / Scorpio) or exalted (Capricorn); other classical cancellations (mutual Mangalik,
Mars-Jupiter aspect, Mars-Saturn conjunction) are not applied. Ashtakoot Vashya koot is
simplified to single-vashya per rashi.

## 16. Localization

All returned display names respect the `language` option. **English** and **Hindi
(Devanagari)** are supported.

```typescript
const hi = getDailyPanchang(date, loc, { timezone: 330, language: 'hi' })!;

console.log(hi.tithis[0].name);              // "कृष्ण चतुर्दशी"
console.log(hi.vara.name);                   // "मंगलवार"
console.log(hi.chandramasa.name);            // "माघ"
console.log(hi.choghadiya.day[0].name);      // "अमृत"

// englishName is always English on Vara / Tarabala / Chandra Balam
console.log(hi.vara.englishName);            // "Tuesday"
```

## 17. Configuration

```typescript
const r = getDailyPanchang(date, loc, {
  timezone: 330,                          // number (UTC offset in min) or IANA string
  ayanamsa: 'lahiri',                     // 'lahiri' | 'raman' | 'krishnamurti'
                                          //   | 'true-chitra' | 'thirukanitham'
  language: 'en',                         // 'en' | 'hi'
  masaSystem: 'purnimanta',               // 'purnimanta' | 'amanta'
  region: 'all',                          // 21 state slugs + 'nepal' + 'all'
  computeEndTimes: true,                  // false → ~5x speedup, names only
  precision: 'standard',                  // 'standard' (15 iter) | 'high' (25 iter)
  janmaRashi: undefined,                  // pass to add r.chandraBalam
  janmaNakshatra: undefined,              // pass to add r.tarabala
});
```

**Timezone handling** — `timezone` accepts either a number (UTC offset in minutes, e.g.
`330` for IST) or an IANA zone name (e.g. `'America/New_York'`). IANA strings need `Intl`,
which older Hermes versions don't fully support — pass a number on those targets. DST
resolves automatically for IANA zones via the reference date.

---

## Types & Exports

<details>
<summary><strong>Core Types</strong> — GeoLocation, TimePeriod</summary>

```typescript
interface GeoLocation {
  latitude: number;    // -90 to 90
  longitude: number;   // -180 to 180
  elevation?: number;  // metres, default 0
}

interface TimePeriod {
  start: Date;
  end: Date;
}
```
</details>

<details>
<summary><strong>Pancha Anga</strong> — TithiInfo, NakshatraInfo, YogaInfo, KaranaInfo, VaraInfo</summary>

```typescript
interface TithiInfo {
  index: number;               // 0-29
  name: string;                // e.g. "Shukla Pratipada"
  paksha: string;              // "Shukla"/"Krishna" (en), "शुक्ल"/"कृष्ण" (hi)
  number: number;              // 1-15 within the paksha
  completionPercentage: number;
  endTime: Date | null;
}

interface NakshatraInfo {
  index: number;               // 0-26
  name: string;
  pada: number;                // 1-4
  degreesInNakshatra: number;
  completionPercentage: number;
  endTime: Date | null;
}

interface DailyTithiInfo extends TithiInfo {
  startTime: Date | null;      // null when isActiveAtSunrise is true
  isActiveAtSunrise: boolean;
}

// DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo follow the same pattern.

interface VaraInfo {
  index: number;       // 0 = Sunday ... 6 = Saturday
  name: string;        // e.g. "Raviwara" (localized)
  shortName: string;   // e.g. "Ravi" (localized)
  englishName: string; // e.g. "Sunday" (always English)
}

interface KaranaInfo {
  index: number;
  name: string;
  completionPercentage: number;
  endTime: Date | null;
  type: 'fixed' | 'movable';
}

// endTime / startTime are null when computeEndTimes: false.
```
</details>

<details>
<summary><strong>Lunar Calendar</strong> — ChandraMasaInfo, SamvatInfo, MasaInfo, RashiInfo</summary>

```typescript
interface ChandraMasaInfo {
  index: number;            // 0 = Chaitra ... 11 = Phalguna (in the active system)
  name: string;             // follows masaSystem option
  isAdhika: boolean;        // true = leap/intercalary month
  system: 'purnimanta' | 'amanta';
  amantaIndex: number;
  amantaName: string;
  purnimantaIndex: number;
  purnimantaName: string;
}

interface SamvatInfo {
  vikramSamvat: number;  // e.g. 2081
  shakaSamvat: number;   // e.g. 1946
}

interface MasaInfo {
  index: number;  // 0 = Mesha ... 11 = Meena (solar month)
  name: string;
}

interface RashiInfo {
  index: number;  // 0 = Mesha ... 11 = Meena
  name: string;
}
```
</details>

<details>
<summary><strong>Time Slots</strong> — Choghadiya, Gowri, Hora, Do Ghati</summary>

```typescript
type ChoghadiyaQuality = 'auspicious' | 'inauspicious' | 'neutral';

interface ChoghadiyaSlot extends TimePeriod {
  index: number;
  name: string;              // e.g. "Amrit", "Kaal" (localized)
  quality: ChoghadiyaQuality;
  qualityName: string;       // localized: "Auspicious", "शुभ"
}

interface ChoghadiyaInfo {
  day: ChoghadiyaSlot[];     // 8 slots (sunrise -> sunset)
  night: ChoghadiyaSlot[];   // 8 slots (sunset -> next sunrise)
}

// GowriSlot / GowriInfo mirror Choghadiya.

interface HoraSlot extends TimePeriod {
  planet: string;       // "Sun", "Venus", "Mercury", ...
  planetIndex: number;  // 0-6 in Chaldean order
}

interface HoraInfo {
  day: HoraSlot[];      // 12 slots (sunrise -> sunset)
  night: HoraSlot[];    // 12 slots (sunset -> next sunrise)
}

interface DoGhatiInfo {
  day: DoGhatiSlot[];   // 15 ~48-min deity-keyed slots
  night: DoGhatiSlot[]; // 15 ~48-min deity-keyed slots
}
```
</details>

<details>
<summary><strong>Special Yogas & Festivals</strong></summary>

```typescript
interface SpecialYogaInfo {
  name: string;
  type:
    | 'amrit_siddhi' | 'sarvartha_siddhi' | 'ravi_pushya' | 'guru_pushya'
    | 'dwipushkar'   // Bhadra-tithi + vara + nakshatra ∈ {Mrig, Chitra, Dhan} — doubled
    | 'tripushkar'   // same Bhadra rules + nakshatra ∈ {Krit, Punar, U.Phal, Vish, U.Ash, P.Bhad} — tripled
    | 'jwalamukhi'   // inauspicious — tithi × nakshatra (Muhurta-chintamani 6.32)
    | 'aadal'        // auspicious — Moon-from-Sun nakshatra distance
    | 'vidaal'       // inauspicious — Moon-from-Sun nakshatra distance
    | 'ravi';        // auspicious — Moon-from-Sun nakshatra distance (27-scheme)
}

interface FestivalInfo {
  name: string;
  type:
    | 'major' | 'minor'
    | 'ekadashi' | 'smarta_ekadashi' | 'vaishnava_ekadashi'
    | 'pradosha' | 'sankranti' | 'eclipse';
  description?: string;
  /** Smarta-only: when Ekadashi is Dashami-viddha, the Dwadashi fast date. */
  deferralDate?: Date;
}

type FestivalRegion =
  | 'all'             // default — emits every regional variant
  // South
  | 'tamil-nadu' | 'kerala' | 'karnataka' | 'andhra-pradesh' | 'telangana'
  // East
  | 'west-bengal' | 'odisha' | 'assam' | 'bihar' | 'jharkhand'
  // West
  | 'gujarat' | 'maharashtra' | 'goa' | 'rajasthan'
  // North / Central
  | 'punjab' | 'haryana' | 'himachal-pradesh' | 'uttarakhand'
  | 'uttar-pradesh' | 'madhya-pradesh'
  // Neighbour
  | 'nepal';

// Pre-v2.1 identifiers — accepted with a one-shot deprecation warning. Removed in v3.
//   'tamil'       → 'tamil-nadu'
//   'bengal'      → 'west-bengal'
//   'north-india' → 'all'
type LegacyFestivalRegion = 'tamil' | 'bengal' | 'north-india';
```

**Region-scoped festivals** (non-exhaustive):

| Region | Festival names (keys) |
|---|---|
| `tamil-nadu` | pongal, puthandu, varamahalakshmi |
| `kerala` | vishu, ayyappa_makara_jyothi, onam |
| `karnataka` | karaga, varamahalakshmi |
| `andhra-pradesh` | varamahalakshmi |
| `telangana` | bonalu, varamahalakshmi, bathukamma_start, bathukamma_saddula |
| `west-bengal` | pohela_boishakh, bhai_dooj |
| `odisha` | singh_sankranti, raja_pahili, raja_sankranti, raja_basi |
| `assam` | bohag_bihu, magh_bihu, kati_bihu |
| `bihar` | singh_sankranti, hariyali_teej, govardhan_puja, bhai_dooj |
| `gujarat` | uttarayan, govardhan_puja, bhai_dooj |
| `maharashtra` | gudi_padwa, hartalika_teej, bhai_dooj |
| `goa` | gudi_padwa |
| `rajasthan` | gangaur, hariyali_teej, kajari_teej, hartalika_teej, govardhan_puja, bhai_dooj |
| `punjab` | baisakhi, lohri, govardhan_puja |
| `haryana` | baisakhi, lohri, govardhan_puja, bhai_dooj |
| `himachal-pradesh` | sair, phagli, lohri |
| `uttarakhand` | harela |
| `uttar-pradesh` | hariyali_teej, kajari_teej, hartalika_teej, govardhan_puja, bhai_dooj |
| `madhya-pradesh` | hariyali_teej, kajari_teej, hartalika_teej |
| `nepal` | singh_sankranti, bhai_dooj |
</details>

<details>
<summary><strong>Eclipses (Grahan)</strong> — EclipseInfo</summary>

```typescript
type EclipseSubtype = 'partial' | 'total' | 'annular' | 'penumbral';

interface EclipseInfo {
  kind: 'solar' | 'lunar';
  subtype: EclipseSubtype;
  start: Date;              // UTC — observable phase begins
  peak: Date;               // UTC — greatest eclipse
  end: Date;                // UTC — observable phase ends
  visibleFromLocation: boolean;
  magnitude: number;        // fraction of disc obscured at peak, [0, 1]
  sutakStart: Date;         // 12 h before solar / 9 h before lunar
  sutakEnd: Date;           // coincides with eclipse end (moksha)
  description: string;
}
```
</details>

<details>
<summary><strong>Bhadra Kala</strong> — BhadraInfo</summary>

```typescript
interface BhadraInfo {
  start: Date;
  end: Date;
  /** 'earth' = malefic for all work; 'heaven' / 'paatal' = non-terrestrial, milder. */
  location: 'earth' | 'heaven' | 'paatal';
  /** True when Bhadra is active at some point during the Hindu day window. */
  isActive: boolean;
}
```
</details>

<details>
<summary><strong>Jyotish</strong> — Graha positions, Vimshottari Dasha, Chandra Balam, Tarabala</summary>

```typescript
type GrahaName = 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter'
               | 'Venus' | 'Saturn' | 'Rahu' | 'Ketu';

interface GrahaPosition {
  planet: GrahaName;
  siderealLongitude: number;   // degrees [0, 360)
  rashi: RashiInfo;
  degreeInRashi: number;       // [0, 30)
  nakshatra: NakshatraInfo;
  isRetrograde: boolean;       // always false for Sun/Moon; always true for Rahu/Ketu
}

interface PlanetaryPositions {
  sun: GrahaPosition; moon: GrahaPosition; mars: GrahaPosition;
  mercury: GrahaPosition; jupiter: GrahaPosition; venus: GrahaPosition;
  saturn: GrahaPosition; rahu: GrahaPosition; ketu: GrahaPosition;
}

type DashaLord = 'Ketu' | 'Venus' | 'Sun' | 'Moon' | 'Mars'
              | 'Rahu' | 'Jupiter' | 'Saturn' | 'Mercury';

interface AntarDasha   { lord: DashaLord; startDate: Date; endDate: Date; }
interface MahaDasha    { lord: DashaLord; startDate: Date; endDate: Date;
                         years: number; antarDashas: AntarDasha[]; }
interface VimshottariDashaResult {
  currentMahaDashaLord: DashaLord;
  currentIndex: number;
  mahaDashas: MahaDasha[];   // 9-entry sequence starting from birth
}

interface ChandraBalamInfo {
  house: number;                       // 1 = janma rashi; 12 = rashi before janma
  quality: 'strong' | 'weak';          // Shubha houses = 1,3,6,7,10,11
  englishName: string;                 // "Shubha" | "Ashubha"
  name: string;                        // localized
}

interface TarabalaInfo {
  taraIndex: number;                   // 0..8 in the 9-tara cycle from janma nakshatra
  englishName: string;                 // "Janma" | "Sampat" | "Vipat" | "Kshema" | "Pratyari"
                                       // | "Sadhaka" | "Vadha" | "Mitra" | "Ati-Mitra"
  name: string;
  quality: 'auspicious' | 'inauspicious';
}
```
</details>

### Full export list

```typescript
// Primary entry points
getDailyPanchang, getInstantPanchang

// Astronomy
getSunrise, getSunset, getMoonrise, getMoonset
getSiderealSunLongitude, getSiderealMoonLongitude, getAyanamsa

// Inauspicious / Muhurta
computeRahuKalam, computeGulikaKalam, computeYamaganda
computeVarjyam, computeGandaMula, computeAnandadiYoga
computePanchakaRahita, computeDoGhati, computeGowriPanchangam
computeAbhijitMuhurta, computeBrahmaMuhurta, computeVijayaMuhurta
computeGodhuliMuhurta, computeNishitaMuhurta, computeAmritKala
computeMadhyahna, computePratahSandhya, computeSayahnaSandhya

// Eclipses
getUpcomingSolarEclipse, getUpcomingLunarEclipse, getEclipseDuringDay

// Jyotish
computePlanetaryPositions, GRAHA_ABBR
computeVimshottariDasha, computeVimshottariDashaFromBirth, computeVimshottariPratyantar
computeChandraBalam, computeTarabala
computeLagna, computeBhava, computeRashiChart, computeNavamsa
computeAshtakoot, computeMangalDosha, computeSadeSati, computeDignity

// Errors
PanchangError
```

---

## React Native / Hermes

Works with Expo and bare React Native (Hermes engine). Pass `timezone` as a **number** —
IANA timezone strings (`'Asia/Kolkata'`) require `Intl`, which older Hermes versions don't
fully support.

**Two-pass rendering** for smooth UI:

```typescript
import { getDailyPanchang } from 'panchang-ts';
import { InteractionManager } from 'react-native';

// Pass 1 — instant, names only (~0.1 ms on Node, <100 ms on Hermes)
const fast = getDailyPanchang(date, location, {
  timezone: 330,
  computeEndTimes: false,
});
setState(fast); // show names immediately

// Pass 2 — background, full with end-times (~0.5 ms on Node, <500 ms on Hermes)
InteractionManager.runAfterInteractions(() => {
  const full = getDailyPanchang(date, location, { timezone: 330 });
  setState(full); // update with transition times
});
```

---

## Accuracy

6,912 tests passing across 74 files, including fixtures cross-verified against reference
panchang calculations spanning 2025–2026 across 10 Indian cities, plus New York, London,
Sydney, Dubai, and Singapore (diaspora fixtures cover DST transitions on
`America/New_York`).

| Element | Accuracy | Validation |
|---------|----------|------------|
| Sunrise / Sunset | ≤29 s observed vs reference minute-midpoint (±45 s tolerance) | 16 assertions |
| Moonrise / Moonset | Meeus apparent-upper-limb (refraction + parallax); ~3–5 min vs simpler-horizon authorities is expected | Strict fixtures |
| Tithi, Nakshatra, Yoga, Karana names | Exact match vs reference | Strict fixtures |
| Tithi / Nakshatra / Yoga / Karana end-times | ±3 min tolerance, max 2.01 min observed | 20 assertions |
| Ayanamsa | ±0.005° vs Swiss Ephemeris | Unit tests |
| Planetary positions (Sun–Saturn) | ±0.02° vs reference sidereal | Fixtures |
| Planetary positions (Rahu/Ketu, mean node) | ≤0.5° typical; ±2° tolerance | Fixtures |
| Planetary positions (Rahu/Ketu, true node) | ≤0.6° typical (Meeus periodic correction) | Fixtures |
| Rashi / Nakshatra / Retrograde flag | Exact match vs reference | Fixtures |
| Festival dates | 12 cross-verified festivals (2025–2026) — see caveats below | Fixtures |
| Choghadiya / Hora / Gowri slots | Derived from sunrise/sunset — inherits ±2 min | — |
| Madhyahna midpoint, Anandadi Yoga, Ganda Mula active flag | Exact match across 50 reference fixtures | Cross-verify suite |
| Pratah / Sayahna Sandhya start + end | ±2 min across all 50 fixtures | Cross-verify suite |
| Varjyam start + end | ±2 min on every emit (transition days return `null` by design) | Cross-verify suite |
| Lagna sidereal longitude | Cross-checked against Jagannath Hora reference charts | Birth-chart fixtures |
| D1 (Rashi) & D9 (Navamsa) house placements | Exact match vs reference for 9-graha placement | Birth-chart fixtures |
| Ashtakoot Guna Milan total score | ±1 point per pair across 30+ matched pairs | Match fixtures |
| Sade Sati arc start / end | ±1–2 days vs authoritative ephemerides | Saturn-transit fixtures |

**Detection sourcing notes.** **Aadal / Vidaal** follow the classical Moon-from-Sun
nakshatra-distance rule (AstroShastra, HoraSarvam, Ernst Wilhelm), NOT the popular
Tamil-Vakya weekday rule used by some online panchangs — output may differ from sites that
use the weekday rule. **Varjyam** emits the sunrise-anchored nakshatra's window only —
printed panchangs may show a second window on nakshatra-transition days. **Do Ghati
Muhurta** does not rotate by weekday: the same 30-name deity-keyed sequence applies every
day, verified against multiple reference sources for distinct weekdays.

### Festival Detection — Documented Tradeoff

The library uses **tithi-at-sunrise** to resolve a festival to a calendar day. Some
traditional panchang authorities apply other classical rules (tithi-at-midnight,
madhyahna-vyapini, kshaya-tithi handling) for certain festivals; where those rules pick a
different day, our output can drift ±1 day. This is a rule-choice tradeoff, not a
computation bug.

| Alternative classical rule | Festivals affected |
|----------------------------|--------------------|
| Tithi-at-midnight | Krishna Janmashtami, Maha Shivaratri, Diwali / Lakshmi Puja |
| Madhyahna-vyapini (tithi overlapping noon) | Ganesh Chaturthi on edge years, Akshaya Tritiya 2026 |
| Kshaya-tithi handling (tithi never at sunrise) | Ugadi 2026-03-19 (Pratipada is Kshaya) |

If strict parity with a specific panchang authority matters for your use case, cross-check
the above festival set for the target year. Everything else — Holi, Ugadi (non-Kshaya
years), Rama Navami, Raksha Bandhan, Ganesh Chaturthi (normal years), Navaratri,
Dussehra, Karva Chauth, Hanuman Jayanti — matches the canonical date across 2025 and 2026
fixtures.

---

## Performance

| Mode | Node.js | Hermes (budget Android) |
|------|---------|------------------------|
| Names-only (`computeEndTimes: false`) | ~0.1 ms | <100 ms |
| Full with end-times | ~0.5 ms | <500 ms |

Birth-chart helpers are independent — calling them does not add work to
`getDailyPanchang`.

---

## Error Handling

```typescript
import { PanchangError } from 'panchang-ts';

try {
  getDailyPanchang(date, location, options);
} catch (e) {
  if (e instanceof PanchangError) {
    console.error(e.code);    // e.g. 'INVALID_LATITUDE', 'INVALID_TIMEZONE'
    console.error(e.message);
  }
}
```

Error codes: `INVALID_DATE`, `INVALID_LATITUDE`, `INVALID_LONGITUDE`, `INVALID_ELEVATION`,
`INVALID_TIMEZONE`, `INVALID_AYANAMSA`, `TIMEZONE_RESOLUTION_FAILED`, `NO_SUNRISE`,
`NO_SUNSET`, `SEARCH_DIVERGED`, `CIRCUMPOLAR` (Placidus-KP houses above ±66.5°).

**Polar locations (no sunrise / no sunset):** `getDailyPanchang` and `getInstantPanchang`
return `null` rather than throwing — the Hindu day is undefined when sunrise can't be
computed. The low-level `getSunrise` / `getSunset` primitives still throw
`PanchangError(NO_SUNRISE)` / `PanchangError(NO_SUNSET)` for direct callers who need the
precise reason. `getMoonrise` / `getMoonset` return `null` (normal for the Moon).

---

## Compatibility

| Environment | Support |
|-------------|---------|
| Node.js 18+ | Supported |
| React Native (Hermes) | Supported (pass `timezone` as number) |
| Expo (managed + bare) | Supported |
| Browser (modern) | Supported (ESM build) |
| Browser (legacy / IE) | Not supported |

---

## Acknowledgements

[astronomy-engine](https://github.com/cosinekitty/astronomy) by Don Cross — the sole
runtime dependency. MIT licensed.

## License

MIT
