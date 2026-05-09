# panchang-ts

[![npm version](https://img.shields.io/npm/v/panchang-ts)](https://www.npmjs.com/package/panchang-ts)

Pure TypeScript Hindu Panchang (almanac), Jyotish, and Birth Chart calculations.
Zero native dependencies. Works offline in React Native (Hermes), Node.js, and browsers.

**Fast** (~0.1 ms names-only, ~0.5 ms full) | **Typed** (full TypeScript types) | **Offline** (pure JS math, no network) | **7,156 tests**

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
| **Birth Chart (Kundli)** | Lagna (sidereal), Bhava under 3 house systems, D1 / D2 / D3 / D7 / D9 / D10 / D12 / D30 charts, Planetary Dignity | [↓](#14-birth-chart-kundli) |
| **Compatibility & Doshas** | Ashtakoot Guna Milan (36-point), Pathu Porutham (Tamil 10-fold), Mangal Dosha, Kaal Sarp Dosha (12 subtypes), Pitru Dosha | [↓](#15-compatibility--doshas) |
| **Aspects & Strength** | Drishti (graha aspects), Shadbala (six-fold strength), Ashtakavarga (Bhinnashtaka + Sarvashtaka), Yogas (25 named), Karakas, Bhava Bala, Argala | [↓](#16-aspects--strength) |
| **Annual & Sensitive Layers** | Varshaphala (Tajik annual chart + 27 Sahams), Tithi Pravesha, Arudha padas, Hora/Ghati/Bhava/Sripati lagnas, Upagrahas (Gulika, Mandi, Dhuma, Vyatipata, Parivesha, Indrachapa, Upaketu) | [↓](#16-aspects--strength) |
| **KP & Prashna** | KP sub-lord at any longitude, cuspal sub-lords (Placidus-KP), KP significators, Prashna (horary) chart | [↓](#16-aspects--strength) |
| **Dasha Systems** | Vimshottari (Maha→Antar→Pratyantar), Ashtottari, Yogini, Chara (Jaimini), Narayan (Jaimini with padi direction) | [↓](#17-dasha-systems) |
| **Muhurta Engine** | Configurable scoring + 13 stock occasions (vivah, griha pravesh, namakarana, …) | [↓](#18-muhurta-engine) |
| **Calendar Conversion** | Gregorian↔Hindu, Kali Yuga year, Hindu New Year, yearly Ekadashi / Sankranti / festival listings | [↓](#19-calendar-conversion) |
| **Localization** | English + Hindi (Devanagari) on every returned name | [↓](#20-localization) |
| **Configuration** | 5 ayanamsas (Lahiri, Raman, KP, True Chitrapaksha, Thirukanitham), 2 masa systems, 3 house systems, 21 regional festival scopes | [↓](#21-configuration) |

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

Sidereal **Lagna**, **Bhava** under three house systems, **D1 (Rashi)** + six classical
divisional charts (**D2 Hora**, **D3 Drekkana**, **D7 Saptamsa**, **D9 Navamsa**, **D10
Dasamsa**, **D12 Dwadasamsa**, **D30 Trimsamsa**) placing all 9 grahas, and **Planetary
Dignity**.

```typescript
import {
  computeLagna, computeBhava, computeRashiChart, computeNavamsa,
  computeDivisionalChart, computeDignity,
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

// 5. Divisional charts (D2/D3/D7/D10/D12/D30) via the unified API
const d10 = computeDivisionalChart(birth, loc, 'D10');   // career
const d30 = computeDivisionalChart(birth, loc, 'D30');   // misfortune
//   → { divisional: 'D10', lagnaRashi, planets[] }

// 6. Planetary dignity (BPHS Ch.3-4)
computeDignity('Mars',    0);   // 'moolatrikona' (Aries)
computeDignity('Mars',    9);   // 'exalted' (Capricorn)
computeDignity('Sun',     6);   // 'debilitated' (Libra)
```

The seven divisional kinds are: **D2 Hora** (wealth), **D3 Drekkana** (siblings),
**D7 Saptamsa** (children), **D9 Navamsa** (partner / dharma), **D10 Dasamsa** (career),
**D12 Dwadasamsa** (parents), **D30 Trimsamsa** (misfortune). Each follows its classical
per-rashi-type mapping per BPHS Ch. 6; D30 uses the non-uniform 5-segment split with
Mars / Saturn / Jupiter / Mercury / Venus rulership (no Sun / Moon segments).

Birth-chart helpers accept the full ayanamsa set including `'true-chitra'` (True
Chitrapaksha) and `'thirukanitham'` (Tamil-Vakya). Pass via `options.ayanamsa` or the
ayanamsa positional arg.

## 15. Compatibility & Doshas

**Ashtakoot Guna Milan** (36-point marriage compatibility), **Pathu Porutham**
(Tamil 10-fold counterpart — see ["Pathu Porutham" in §16](#pathu-porutham-tamil-10-fold-marriage-matching)),
**Mangal Dosha** (Manglik with cancellations), **Kaal Sarp Dosha** (12 named subtypes
by Rahu's house), and **Pitru Dosha** (ancestral affliction triggers).

```typescript
import {
  computeAshtakoot, computeMangalDosha,
  computeKaalSarp, computePitruDosha,
} from 'panchang-ts';

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

// Kaal Sarp Dosha — all 7 visible planets between Rahu and Ketu axis
const ksd = computeKaalSarp(d1);
// → { afflicted, subtype, partial, rahuHouse, ketuHouse }
// subtype is one of: anant, kulik, vasuki, shankhpal, padma, mahapadma,
// takshak, karkotak, shankhachud, ghatak, vishdhar, sheshnag — by Rahu's house.

// Pitru Dosha — Sun + Rahu/Ketu in same house, OR Sun + Saturn in 9th
const pitru = computePitruDosha(d1);
// → { afflicted, reasons: string[] }
```

**Documented limitations** — Mangal Dosha cancellations only cover Mars in own sign
(Aries / Scorpio) or exalted (Capricorn); other classical cancellations (mutual Mangalik,
Mars-Jupiter aspect, Mars-Saturn conjunction) are not applied. Ashtakoot Vashya koot is
simplified to single-vashya per rashi. Pitru Dosha surfaces the two highest-frequency
classical triggers (Sun + node, Sun + Saturn in 9th); the full BPHS catalog of triggers
(debilitated 9th lord, 9th lord in dusthana, etc.) is out of scope.

## 16. Aspects & Strength

**Drishti** (planetary aspects per BPHS Ch. 26) and **Shadbala** (six-fold strength per
BPHS Ch. 27).

```typescript
import { computeAspects, computeShadbala } from 'panchang-ts';

// Aspects — every graha aspects the 7th house from itself; malefics gain
// extra special aspects (Mars 4 + 8, Jupiter 5 + 9, Saturn 3 + 10).
const aspects = computeAspects(d1);
// → { Sun: [houses…], Moon: [...], …, Saturn: [...], Rahu: [...], Ketu: [...] }
//
// Default treats Rahu/Ketu with the 7th-only BPHS-literal rule. Pass
// { nodeAspects: '5-and-9' } to extend nodes with Jupiter-like 5/9 aspects
// (BV Raman / KP convention).

// Shadbala — 7 visible grahas, 6 components per planet, in Virupas (60 V = 1 Rupa).
const bala = computeShadbala(birth, loc);
// → { Sun: { sthana, dig, kala, chesta, naisargika, drik, total }, Moon: …, … }
//
// Components implemented at the simplified-model level used by ProKerala /
// PyJHora — Uchcha-only Sthana, Dig from directional cusp, Nathonatha + Paksha
// for Kala, retrograde-bucket Chesta, fixed Naisargika rank, weighted Drik.
```

Both functions return additive surface — they do **not** modify the
`getDailyPanchang` / birth-chart pipelines. Call them on demand.

### Ashtakavarga

**Ashtakavarga** (BPHS Ch. 66) — per-graha 12-rashi bindu grids
(Bhinnashtaka) and the summed Sarvashtaka grid. Each cell counts how many
of the 8 contributors (the 7 visible grahas + the lagna) donate a benefic
dot to that rashi for the given receiver.

```typescript
import { computeRashiChart, computeAshtakavarga } from 'panchang-ts';

const chart = computeRashiChart(birth, loc);
const av = computeAshtakavarga(chart);

av.sarvashtaka;
// → 12-cell grid (Mesha … Meena), each 0..56, total 336.

av.bhinnashtaka.Jupiter;
// → Jupiter's 12-cell grid; total = 56 (chart-invariant per BPHS).
//   Other invariant totals: Sun=47, Moon=49, Mars=39, Mercury=54,
//   Venus=52, Saturn=39.

// Opt in to Trikona + Ekadhipatya Sodhana reductions (BPHS Ch. 67):
const reduced = computeAshtakavarga(chart, { reductions: true });
reduced.reduced!.sarvashtaka;          // post-reduction Sarvashtaka
reduced.reduced!.bhinnashtaka.Jupiter; // post-reduction Bhinnashtaka
```

The BENEFIC_OFFSETS lookup table is the canonical BPHS Ch. 66 form used by
every public Ashtakavarga calculator (ProKerala, AstroSage, PyJHora). Rahu
and Ketu are not Ashtakavarga receivers or contributors in the classical
Parashara scheme.

### Yogas (named classical combinations)

**Yogas** (BPHS Chs. 36–43) — detect ~25 classical combinations from a
natal chart against a fixed declarative catalog. Each entry returns a
`name`, a `type` (one of `mahapurusha | lunar | solar | raja | dhana |
special | cancellation | negative`), and one-or-more `reasons[]` strings
describing why the rule matched.

```typescript
import { computeRashiChart, computeNavamsa, computeYogas } from 'panchang-ts';

const chart = computeRashiChart(birth, loc);
const yogas = computeYogas(chart);
// → [{ name: 'Gajakesari', type: 'lunar',
//      reasons: ['Jupiter in 4th from Moon (kendra)'] }, …]

// Filter by type — restricts evaluation to a subset of the catalog.
const raja = computeYogas(chart, { types: ['raja', 'dhana'] });

// Vargottama needs the D9 — pass it via options.
const d9 = computeNavamsa(birth, loc);
const all = computeYogas(chart, { navamsa: d9 });
```

The catalog covers Pancha Mahapurusha (Ruchaka / Bhadra / Hamsa / Malavya
/ Sasha), lunar yogas (Gajakesari, Sunapha, Anapha, Durudhura, Kemadruma),
solar yogas (Budha-Aditya, Veshi, Vasi, Ubhayachari), Raja yogas (generic
kendra/trikona-lord rule, Dharma-Karmadhipati, Vipareeta Raja, Lakshmi),
Dhana yogas (2–11, 5–9, Vasumati), Vargottama, Yogakaraka, Neecha Bhanga,
and Daridra. Yoga names are English/transliterated proper nouns and are
intentionally **not** locale-resolved — `'Gajakesari'` reads the same in
`'en'` and `'hi'`.

Adding a new yoga is a data-only change in
[src/jyotish/yogasCatalog.ts](src/jyotish/yogasCatalog.ts) — the engine
is a thin loop over the catalog. Each rule receives the chart plus
precomputed `dignity` / `aspects` (and optionally a D9 chart) and returns
a `YogaMatch | null`.

### Jaimini Karakas

**Karakas** (Jaimini *Upadesa Sutras* Ch. 1, Parashara variant) — the 7
Chara Karakas ranked by descending degree-in-rashi of the visible grahas.
Atmakaraka (highest) signifies the Self; Darakaraka (lowest) signifies
spouse.

```typescript
import { computeRashiChart, computeJaiminiKarakas } from 'panchang-ts';

const chart = computeRashiChart(birth, loc);
const k = computeJaiminiKarakas(chart);
k.Atmakaraka;     // graha at the highest degree-in-rashi (e.g. 'Saturn')
k.Amatyakaraka;   // 2nd-highest
k.Darakaraka;     // graha at the lowest degree-in-rashi
```

The 7 visible grahas are ranked — Rahu and Ketu are not included (this is
the **7-Karaka Parashara variant**, not the reversed-Rahu 8-Karaka Jaimini
variant). On the rare exact tie in degree-in-rashi, the canonical order
Sun → Moon → Mars → Mercury → Jupiter → Venus → Saturn breaks the tie
(stable sort) — the earlier graha wins the more-significant Karaka role.

Karaka names are English/transliterated proper nouns and intentionally
**not** locale-resolved.

### Bhava Bala

**Bhava Bala** (BPHS Ch. 27) — four-source house strength for the 12 bhavas
of a natal chart, in Virupas (60 V = 1 Rupa). Built on top of `computeShadbala`
— the natural-strength table, drishti weights, and benefic/malefic
classification are all shared.

```typescript
import { computeBhavaBala } from 'panchang-ts';

const bhavaBala = computeBhavaBala(birth, loc);
bhavaBala.houses.length;             // 12 (one entry per bhava, index 0 = bhava 1)
bhavaBala.houses[0].total;           // 1st-bhava total in Virupas
bhavaBala.houses[9].bhavadhipati;    // 10th-bhava lord's Shadbala total
// → each entry: { bhavadhipati, dik, drik, sthana, total }
```

`bhavadhipati` is the total Shadbala of the rashi-lord of the bhava cusp;
`dik` is a fixed directional value from a simplified cardinal-anchor table
(cardinal bhavas anchor at 60 / 0 / 15 / 30 V; intermediates linearly
interpolated around the wheel — not the canonical BPHS Ch. 27 numbers);
`drik` is the net aspect strength on the cusp from the 7 visible grahas
(benefics +, malefics −, clamped ≥ 0); `sthana` sums the natural strength
of grahas occupying the bhava (Mercury counted as benefic per BPHS — the
"associated benefic" nuance is intentionally out of scope). Rahu and Ketu
do not contribute. `total` is the arithmetic sum of the four components.

### Varshaphala (Tajik annual horoscope)

**Varshaphala** is the Tajik solar-return chart for a given age of the
native, with the classical analytical layer — Muntha, year lord
(Varsha Pati), and the 27 core Sahams — already computed.

```typescript
import { computeVarshaphala } from 'panchang-ts';

const birth = new Date('1995-08-15T05:30:00Z');
const loc   = { latitude: 28.6139, longitude: 77.2090 };

const varsha = computeVarshaphala(birth, 30, loc);   // 30th solar return
varsha.solarReturnInstant;       // exact UTC moment Sun returns to natal lon
varsha.varshaLagna.rashi.name;   // ascendant rashi at the SR instant
varsha.muntha.rashi;             // (natalLagnaRashi + 30) mod 12
varsha.muntha.lord;              // rashi-lord of muntha rashi
varsha.muntha.house;             // muntha's house from varsha lagna (1..12)
varsha.yearLord;                 // strongest of 4 candidates by Shadbala
varsha.isDayBirth;               // Sun above horizon at SR instant?

// 27 Sahams (Punya, Vidya, …, Tapas) — each: { longitude, rashi, rashiName, house }
varsha.sahams.Punya.longitude;
varsha.sahams.Punya.house;       // Punya's house from varsha lagna
varsha.sahams.Vivaha.rashi;      // Vivaha (marriage) Saham rashi
```

**Solar-return search.** A Newton-style refinement around `birth +
N × 365.25636 days` finds the UTC instant where sidereal Sun returns
to its natal longitude (within 0.0001° / ~9 arcseconds). Convergence
is 3–5 iterations on cooperative inputs.

**Year lord (Varsha Pati).** Picked as the planet with the highest
total Shadbala among:
1. Varsha lagna lord
2. Muntha lord
3. Lord of the Sun's rashi at the varsha instant
4. Triraashi Pati (3-rashi-trine ruler) of the varsha lagna's element,
   per the Tajik day/night table (fire→Sun day / Jupiter night;
   earth→Venus / Moon; air→Saturn / Mercury; water→Venus / Mars)

**Sahams scope.** This is the **27-Saham core set** — Punya, Vidya,
Yasas, Mitra, Karma, Vivaha, Putra, Roga, Marana, Rajya, Raja, Bandhu,
Dharma, Gnati, Apamrityu, Bhratri, Matri, Pitri, Sama, Bandhana,
Karyasiddhi, Vyapara, Sastra, Asha, Labha, Susha, Tapas. The extended
50-Saham list (Mahaprasna, Adhana, Krodha, Kali, …) is deferred to a
later release. Day/night X-Y operand swap follows **Neelakantha**'s
*Tajika Neelakanthi*; 9 Sahams (Punya, Vidya, Karma, Putra, Roga,
Gnati, Bhratri, Matri, Pitri) flip on night birth. Other Tajik
commentators (Hari Hara) define different swap subsets — documented
in [src/jyotish/sahamsTables.ts](src/jyotish/sahamsTables.ts).

**Sourcing:** Neelakantha *Tajika Neelakanthi* (1587 CE); B.V. Raman
*Annual Horoscope*; Sanjay Rath *Crux of Vedic Astrology* Tajik
appendix; PVR Narasimha Rao *Tajik notes* (Saptarishis Astrology).
Saham names are English/transliterated proper nouns and intentionally
**not** locale-resolved (same convention as Yoga names).

### Tithi Pravesha (annual soli-lunar return)

**Tithi Pravesha** is the South-Indian annual chart cast at the moment
in year-N when *both* (a) the sidereal Sun is in its natal sidereal
sign **and** (b) the Sun-Moon angular separation equals the natal
separation. The tithi is preserved exactly — `praveshTithi` always
equals `natalTithi`.

```typescript
import { computeTithiPravesha } from 'panchang-ts';

const tp = computeTithiPravesha(
  new Date('1995-08-15T05:30:00Z'),
  30,                                            // 30th annual cycle
  { latitude: 28.6139, longitude: 77.2090 },     // New Delhi
);
tp.praveshInstant;                  // exact UTC moment
tp.natalTithi === tp.praveshTithi;  // always true
tp.varshaLagna.rashi.name;          // ascendant at pravesha
tp.planets;                         // 9-graha placements
tp.bhava.houses;                    // 12 cusps under configured house system
```

**Algorithm.** The implementation follows **PVR Narasimha Rao's
redefinition** (Saptarishis Astrology) rather than the older calendar-
anniversary heuristic:

1. Compute the natal Sun-Moon angular separation `Δ_natal`.
2. Locate the **solar-return instant** for the requested year (re-uses
   the Varshaphala Newton search).
3. Newton-iterate on the Moon-Sun phase deviation until
   `(Moon − Sun) mod 360°` equals `Δ_natal` to better than 0.0001°.
4. If Sun's rashi at that instant differs from natal Sun's rashi
   (closest tithi-match landed across a sign boundary), shift by one
   synodic month (~29.5 days) toward the solar-return centre and
   re-iterate. Adjacent tithi-matches are 29.53 days apart and the
   Sun-in-natal-sign window is 30.4 days wide, so exactly one
   neighbour falls in the natal sign for every fixture.

The pravesha instant can therefore be up to ~30 days before or after
the calendar anniversary depending on where the natal moon was in the
synodic cycle.

**Sourcing:** Sanjay Rath, *Tithi Pravesha* (srath.com); PVR Narasimha
Rao, *Re-Defining Tithi Pravesha Chart* (Saptarishis Astrology Vol. 8).

### Arudha Lagna + 12 Arudha Padas

The **Arudha pada** of a bhava is the rashi reached by counting from the
bhava's lord the same number of houses as the lord is from the bhava
itself. Each Arudha is the *image / reflection* of its bhava — Bhava 1's
Arudha is **Arudha Lagna (AL)**, the social / public-facing self
(distinct from Lagna, which is the inner / soul-rooted self).

```typescript
import { computeRashiChart, computeArudhas } from 'panchang-ts';

const chart = computeRashiChart(
  new Date('1995-08-15T05:30:00Z'),
  { latitude: 28.6139, longitude: 77.2090 },
);
const arudhas = computeArudhas(chart);
arudhas.length;                   // 12
arudhas[0]!.bhava;                // 1 — this is Arudha Lagna (AL)
arudhas[0]!.arudhaRashi;          // 0..11
arudhas[0]!.arudhaRashiName;      // localized rashi name
arudhas[0]!.arudhaLord;           // rashi-lord of arudha rashi
arudhas[6]!.bhava;                // 7 — Darapada (spouse pada)
```

**Algorithm.** Per Jaimini *Upadesa Sutras* Ch. 1 (Sanjay Rath
commentary):

1. For each bhava `B`, find the rashi the bhava's lord *occupies*.
2. Compute `D` = inclusive distance from the bhava to its lord (1..12,
   so lord-in-own-bhava → D=1).
3. Standard rule: count another `D` houses from the lord →
   `arudha = (lordRashi + D − 1) mod 12`.
4. **Two exceptions** to avoid the Arudha collapsing onto the bhava
   itself or its 7th:
   - `D == 1` (lord in own bhava) → Arudha = **10th** from lord
     (`lordRashi + 9 mod 12`).
   - `D == 7` (lord in 7th from bhava) → Arudha = **4th** from lord
     (`lordRashi + 3 mod 12`).

`arudhaLord` is the rashi-lord of the *Arudha rashi itself* (not the
original bhava's lord) — useful for analysing the pada's significations
directly.

**Sourcing:** Jaimini, *Upadesa Sutras* Ch. 1; Sanjay Rath, *Jaimini
Maharishi's Upadesa Sutras* (commentary); BPHS Ch. 29.

### Special Lagnas (Hora / Ghati / Bhava / Sripati)

Time-derived sensitive lagnas used in classical timing analysis. Each
advances at a different rate from the sunrise on or before the birth
instant.

```typescript
import {
  computeHoraLagna, computeGhatiLagna, computeBhavaLagna, computeSripatiLagna,
} from 'panchang-ts';

const birth = new Date('1995-08-15T05:30:00Z');
const loc   = { latitude: 28.6139, longitude: 77.2090 };

const hora    = computeHoraLagna(birth, loc);     // 1 rashi / 2 hours from sunrise
const ghati   = computeGhatiLagna(birth, loc);    // 1 rashi / 1 ghatika (24 min)
const bhava   = computeBhavaLagna(birth, loc);    // 1 rashi / 5 ghatikas (2 hours)
const sripati = computeSripatiLagna(birth, loc);  // Sripati cusp 1 = natal lagna
hora.rashi.name;       // each returns a `LagnaInfo` with rashi / nakshatra / pada
```

| Lagna | Rate | Period |
|-------|------|--------|
| Hora | 15°/hour (1 rashi / 2 hours) | 24 hours |
| Ghati | 75°/hour (1 rashi / 24 min) | 4 h 48 min |
| Bhava | 15°/hour (1 rashi / 2 hours) | 24 hours |
| Sripati | n/a (= natal lagna) | n/a |

> **Note.** Hora and Bhava Lagna are numerically identical under this
> library's rate convention (both 15°/hour from sunrise, per
> *Phaladeepika* Ch. 1). They remain separate accessors because
> classical commentaries treat them as conceptually distinct timing
> anchors. Some BPHS recensions give Hora a faster 30°/hour rate (1
> rashi/hour); the library follows the slower rate documented in PLAN
> spec.

**Sourcing:** BPHS Ch. 4; *Phaladeepika* Ch. 1; Sripati, *Sripati Paddhati*.

### Upagrahas (sub-grahas as positions)

The 7 upagrahas are sensitive points used in Vedic and Tajik analysis.
The library returns each one as a **longitude** + rashi + house — the
position-form, distinct from Phase-2 Gulika *Kalam* (the time-form).

```typescript
import { computeUpagrahas } from 'panchang-ts';

const u = computeUpagrahas(
  new Date('1995-08-15T05:30:00Z'),
  { latitude: 28.6139, longitude: 77.2090 },
);
u.gulika.longitude;     // sidereal degrees
u.gulika.rashi;         // 0..11
u.gulika.rashiName;     // localized
u.gulika.house;         // whole-sign from natal lagna
u.mandi.longitude;      // Saturn-segment midpoint
u.dhuma.longitude;      // Sun + 133°20'
u.upaketu.longitude;    // Sun + ~150° (after the chain)
```

**Gulika & Mandi.** Day birth: divide sunrise → sunset into 8 equal
segments; the day-lord rotation Sun → Moon → Mars → Mercury → Jupiter
→ Venus → Saturn places Saturn at one segment per weekday. Gulika is
the **rising ascendant at the *start*** of Saturn's segment; Mandi is
the **rising ascendant at the *midpoint***. Night birth: same procedure
on the sunset → next-sunrise window, with the rotation starting from
the planet 5 weekdays from the day-lord (Phaladeepika Ch. 5).

**Sun-derived upagrahas.** Fixed offsets from sidereal Sun:

| Upagraha | Formula |
|----------|---------|
| Dhuma | `Sun + 133°20'` |
| Vyatipata | `360° − Dhuma` |
| Parivesha | `Vyatipata + 180°` |
| Indrachapa | `360° − Parivesha` |
| Upaketu | `Indrachapa + 16°40'` |

`Dhuma + Vyatipata ≡ 360°` and `Parivesha + Indrachapa ≡ 360°` are
structural invariants that hold for every chart.

**Sourcing:** BPHS Ch. 5; Sanjay Rath, *Brihat Nakshatra* (upagraha
section); Phaladeepika Ch. 5.

### Argala (Jaimini intervention)

Per-bhava arc-influence rules from Jaimini *Upadesa Sutras* Ch. 1 and
BPHS Ch. 51. Planets in the 2nd, 4th, or 11th from a bhava form
**Argala** (intervention / help); planets in the 3rd, 10th, or 12th
form **Virodhargala** (counter-intervention).

```typescript
import { computeRashiChart, computeArgala } from 'panchang-ts';

const chart = computeRashiChart(
  new Date('1995-08-15T05:30:00Z'),
  { latitude: 28.6139, longitude: 77.2090 },
);
const argala = computeArgala(chart);
argala[0]!.bhava;             // 1
argala[0]!.argala;            // PlanetPlacement[] in 2nd / 4th / 11th from lagna
argala[0]!.virodhargala;      // PlanetPlacement[] in 3rd / 10th / 12th from lagna
```

**Structural invariant.** Each planet contributes to **exactly 6 of
the 12 bhavas** — 3 Argala + 3 Virodhargala. The 2/4/11 and 3/10/12
offsets are mutually exclusive, so a planet's house position
deterministically partitions the bhava wheel into a 6-cell influence
set.

All 9 grahas (Sun..Saturn + Rahu + Ketu) participate. Benefic / malefic
distinction is not applied — the caller can filter the returned lists
by graha if their tradition requires it. The 5th-from-bhava ("primary
Argala") and 9th ("primary Virodhargala") are not included in this
simplified BPHS Ch. 51 form.

**Sourcing:** Jaimini, *Upadesa Sutras* Ch. 1; BPHS Ch. 51.

### Pathu Porutham (Tamil 10-fold marriage matching)

Tamil/Kerala marriage compatibility test, scored across **10 koots**.
Used instead of Ashtakoot in Tamil Nadu, Kerala, and parts of Karnataka.
Each koot is binary-scored (pass / fail) per the AstroVed / Drik Tamil
convention; the aggregate score is the count of passing koots in 0..10.
Three koots (Yoni, Rajju, Vedha) are **strong vetoes** — if any fails,
`recommended` flips to false regardless of the count.

```typescript
import { computePathuPorutham } from 'panchang-ts';

const result = computePathuPorutham(
  { rashi: 4, nakshatra: 9 },   // Boy:  Magha / Leo
  { rashi: 0, nakshatra: 1 },   // Girl: Bharani / Aries
);
result.totalPasses;             // 0..10
result.recommended;             // boolean (no veto + ≥5 passes)
result.poruthams[4]!.name;      // 'Yoni' (a veto-level koot)
result.poruthams[8]!.veto;      // true if Rajju fails
```

**Koot catalog:**

| Koot           | Tests                                               | Veto |
|----------------|-----------------------------------------------------|:----:|
| Dina           | Boy→Girl nakshatra distance mod 9 ∈ {1, 3, 5, 7}    | no   |
| Gana           | Reuses Phase 29 NAKSHATRA_GANA — Manushya↔Rakshasa fails | no |
| Mahendra       | Distance ∈ {4, 7, 10, 13, 16, 19, 22, 25}           | no   |
| Sthree Deergha | Boy→Girl nakshatra distance > 9                     | no   |
| Yoni           | Reuses Phase 29 NAKSHATRA_YONI / YONI_SCORE         | yes  |
| Rashi          | Distance not in doshic set ({2,12}, {6,8})          | no   |
| Rashyathipathi | Rashi-lord friendship (Naisargika Maitri)           | no   |
| Vasya          | Reuses Phase 29 RASHI_VASHYA / VASHYA_SCORE         | no   |
| Rajju          | Same Rajju (Pada/Kati/Nabhi/Kantha/Sira) fails      | yes  |
| Vedha          | Same Vedha pair fails                               | yes  |

Pathu Porutham and Ashtakoot consume the same `NatalMoon` shape
(`{ rashi, nakshatra }`) — call both side-by-side to surface both
North-Indian and South-Indian compatibility views.

**Sources.** *Jathaka Tatva* (Tamil); AstroVed.com 10-Porutham reference;
ProKerala's free Pathu Porutham implementation; drikpanchang.com Tamil
porutham panel.

### Narayan Dasha (Jaimini sign-dasha with padi direction)

Jaimini sign-based dasha that incorporates the **vishama-pada / sama-pada**
parity rule per Sanjay Rath's *Narayana Dasa* (Sagar Publications). Cycle
direction depends on which parity-class the lagna's rashi falls into:

  - **Vishama-pada** lagna in {Aries, Taurus, Gemini, Libra, Scorpio,
    Sagittarius} → cycle proceeds **forward** (zodiacal).
  - **Sama-pada** lagna in {Cancer, Leo, Virgo, Capricorn, Aquarius,
    Pisces} → cycle proceeds **backward** (anti-zodiacal).

```typescript
import { computeNarayanDasha } from 'panchang-ts';

const narayan = computeNarayanDasha(
  new Date('1995-08-15T05:30:00Z'),
  { latitude: 28.6139, longitude: 77.2090 },
);
narayan.direction;            // 'forward' | 'backward'
narayan.startingRashi;        // lagna rashi (0..11)
narayan.mahaDashas[0]!.rashi; // same as startingRashi
narayan.mahaDashas[0]!.lord;  // sign-lord of starting rashi
narayan.mahaDashas[0]!.years; // 7, 8, or 9 per modality
```

Years per rashi follow the same Movable 9 / Fixed 8 / Dual 7 scheme as
Chara Dasha. The Mahadasha sequence covers ~96 years (sum of all 12
rashi durations). Lord assignment is the rashi's natural lord (Mars for
Aries / Scorpio, Venus for Taurus / Libra, etc.). Antardasha breakdown
is not exposed — the Mahadasha alone is the dominant Jaimini timing
layer for Narayan analysis.

**Difference from Chara Dasha** (already shipped): Chara always advances
forward from lagna; Narayan applies the parity-based direction. For
vishama-pada lagnas the two systems' Mahadasha sequence is identical.

**Sources.** Sanjay Rath, *Narayana Dasa* (Sagar Publications);
*Jaimini Upadesa Sutras* Ch. 2.

### KP sub-lord layer

K.S. Krishnamurti's KP-Paddhati uses a 9-fold subdivision of each
nakshatra (243 sub-divisions across the zodiac), proportional to the
Vimshottari dasha years of the 9 planets. The sub-lord at any longitude
is one of the 9 KP planets (Sun..Saturn + Rahu + Ketu).

```typescript
import {
  computeKpSubLord, computeKpCuspalSubLords, computeKpSignificators,
  computeRashiChart,
} from 'panchang-ts';

// 1. Sub-lord at any sidereal longitude.
const info = computeKpSubLord(45.5);  // 15°30' Taurus
info.signLord;   // 'Venus' (rashi lord of Taurus)
info.starLord;   // 'Moon'  (nakshatra lord of Rohini)
info.subLord;    // KP sub-lord — depends on degree

// 2. Cuspal sub-lords for the 12 Placidus-KP cusps.
const cusps = computeKpCuspalSubLords(
  new Date('1995-08-15T05:30:00Z'),
  { latitude: 28.6139, longitude: 77.2090 },
);
cusps.cusps[0]!.subLord;  // sub-lord of cusp 1 (ascendant)
cusps.cusps[6]!.subLord;  // sub-lord of cusp 7 (descendant)

// 3. Significators — for each planet, the houses it signifies via the
// 4-fold KP rule (occupant + star-lord-occupant + owner + star-lord-owner).
const chart = computeRashiChart(birth, location);
const sig = computeKpSignificators(chart);
sig.byPlanet.Sun;   // [houses Sun signifies]
sig.byHouse[10];    // [planets that signify the 10th house]
```

`computeKpCuspalSubLords` always uses the Placidus-KP house system —
the cuspal scheme KP analysis is built on. Whole-sign and equal-house
cusps fall on rashi boundaries by construction and lose the cuspal-sub-
lord granularity that drives KP timing analysis.

**Sources.** K.S. Krishnamurti, *Krishnamurti Paddhati* (5 vols);
KP Astrology online references.

### Prashna foundation (horary chart)

Cast a chart for the precise moment a question is asked, with the
querent's location as the geographic anchor. Prashna analysis proceeds
on the resulting chart in the same way as a natal chart — houses,
planets, dignity, dashas all apply to the question being asked.

```typescript
import { computePrashnaChart, computeKpCuspalSubLords } from 'panchang-ts';

// Question asked at a specific UTC moment from Mumbai.
const chart = computePrashnaChart(
  new Date('2026-05-09T14:30:00Z'),
  { latitude: 19.0760, longitude: 72.8777 },
);
chart.lagna.rashi.name;   // ascendant of the prashna
chart.bhava.system;       // 'placidus-kp' (KP horary anchor) by default
chart.planets[1]!.house;  // Moon's house — primary mind significator

// KP cuspal sub-lord analysis on the prashna cusps:
const cusps = computeKpCuspalSubLords(
  new Date('2026-05-09T14:30:00Z'),
  { latitude: 19.0760, longitude: 72.8777 },
);
```

The returned shape is identical to a natal `BirthChart`. The dedicated
function is intent-named so callers' analysis context is explicit at
the call site, and so future Prashna-specific layers (Ruling Planets,
horary numbers 1..249, significator-driven event timing) can land
additively in this module.

**Default house system.** Defaults to `'placidus-kp'` — KP horary's
standard cuspal scheme. Pass `{ houseSystem: 'whole-sign' }` for
traditional Vedic Prashna.

**Out of scope** (deferred to a later phase):
- Ruling Planets (5-fold lord set used to refine timing in KP horary).
- Horary number mapping (KP 1..249 number → cusp sub-lord table).
- Significator-driven event timing (dasha-walk against significator sets).

**Sources.** B. Suryanarain Rao, *Prasna Marga*; K.S. Krishnamurti,
*Horary Astrology* (KP Reader VI); Sanjay Rath, *Horary Astrology*
(srath.com).

## 17. Dasha Systems

Five classical dasha systems are exposed:

```typescript
import {
  computeVimshottariDashaFromBirth, computeVimshottariPratyantar,
  computeAshtottariDasha, computeYoginiDasha, computeCharaDasha,
  computeNarayanDasha,
} from 'panchang-ts';

const birth = new Date('1995-08-15T05:30:00Z');
const loc   = { latitude: 28.6139, longitude: 77.2090 };

// 1. Vimshottari (120-year, 9-lord) — already in v1; pratyantar (3-level) added in v3
const vim = computeVimshottariDashaFromBirth(birth);
const pratyantars = computeVimshottariPratyantar(vim.mahaDashas[0].antarDashas[0]);

// 2. Ashtottari (108-year, 8-lord, no Ketu) — used when Moon in Krishna Paksha
const moonLon = /* sidereal Moon longitude */ 145.7;
const ash = computeAshtottariDasha(birth, moonLon);
//   → mahaDashas[0..7], lord cycle Sun(6)→Moon(15)→Mars(8)→Mercury(17)→
//     Saturn(10)→Jupiter(19)→Rahu(12)→Venus(21)

// 3. Yogini (36-year, 8 yoginis with planetary lords)
const yog = computeYoginiDasha(birth, moonLon);
yog.mahaDashas[0].yogini;   // 'Dhanya' (Magha → nakshatra 10, 10 % 8 = 2)
yog.mahaDashas[0].lord;     // 'Jupiter' (Dhanya's planet)

// 4. Chara (Jaimini, sign-based, 9-8-7 years per modality, forward only)
const cha = computeCharaDasha(birth, loc);
cha.mahaDashas[0].rashi;    // lagna's rashi
cha.mahaDashas[0].lord;     // sign-lord planet
cha.mahaDashas[0].years;    // 9 (movable) | 8 (fixed) | 7 (dual)

// 5. Narayan (Jaimini, sign-based, parity-based direction per Sanjay Rath)
const nar = computeNarayanDasha(birth, loc);
nar.direction;              // 'forward' (vishama-pada) | 'backward' (sama-pada)
nar.startingRashi;          // lagna rashi
nar.mahaDashas[0].rashi;    // == startingRashi
nar.mahaDashas[1].rashi;    // depends on direction
```

**Sourcing:** Vimshottari per Parashara (BPHS Ch. 51); Ashtottari per Satya Acharya;
Yogini per Sanjay Rath (1999) / Charak; Chara per Jaimini Sutras Ch. 1 (9-8-7 years
variant); Narayan per Sanjay Rath, *Narayana Dasa* (Sagar Publications) — vishama /
sama-pada parity rule. Documented limitations: Chara uses the forward zodiacal
direction unconditionally (Sundar / Achyutananda variant); the parity-based variant
ships separately as `computeNarayanDasha`.

## 18. Muhurta Engine

A configurable rule + scoring engine for picking auspicious dates. Ships with **13 stock
rules** (vivah, griha pravesh, namakarana, vidyarambh, vahan kharidi, annaprashan,
mundan, upanayanam, karnavedha, aksharabhyasam, seemantham, shop opening, travel
start). Each rule is a pure data declaration — write your own without touching the
engine.

```typescript
import { scoreMuhurta, findAuspiciousDates, vivahRule } from 'panchang-ts';

// Score a single date
const r = scoreMuhurta(new Date('2026-05-12'), DELHI, vivahRule, { timezone: 330 });
// → { date, score: 0..100, passes: boolean, reasons: string[] }

// Find all auspicious dates in a range, sorted by score descending
const dates = findAuspiciousDates(
  vivahRule,
  new Date('2026-05-01'),
  new Date('2026-05-31'),
  DELHI,
  { timezone: 330 },
);
// → MuhurtaDay[] with full panchang attached for each result

// Custom rule
const myRule: MuhurtaRule = {
  occasion: 'launch_party',
  auspiciousVaras: [3, 4, 5],          // Wed/Thu/Fri
  auspiciousNakshatras: [11, 12, 21],  // Uttara Phalguni / Hasta / Shravana
  excludeBhadra: true,
  excludeEkadashi: true,
  excludeAdhikaMasa: true,
};
```

Scoring model: starts at 50 (neutral), +10 per matching auspicious axis (tithi,
nakshatra, vara, yoga), -15 per matching inauspicious axis, hard exclusions
(`excludeBhadra` / `excludeEkadashi` / `excludeEclipse` / `excludeAdhikaMasa` /
`excludeGandaMula` / `excludePanchaka` / `requirePaksha` mismatch) zero the score.
Special yogas — Amrit Siddhi, Sarvartha Siddhi, Ravi Pushya, Guru Pushya — add +5;
Jwalamukhi yoga subtracts -10. Final score clamped to 0..100; `passes: true` when
score ≥ 50.

## 19. Calendar Conversion

Gregorian↔Hindu lunar coordinates, Kali Yuga year, regional Hindu New Year, and
yearly listings of Ekadashis / Sankrantis / festivals / eclipses.

```typescript
import {
  convertGregorianToHindu, convertHinduToGregorian,
  getKaliYugaYear, getHinduNewYear,
  getEkadashiDatesForYear, getSankrantisForYear,
  getFestivalsInRange, getUpcomingEclipses,
} from 'panchang-ts';

// Gregorian → Hindu coordinates at sunrise
const h = convertGregorianToHindu(new Date('2026-04-15'), DELHI, { timezone: 330 });
// → { tithiName, tithi (1..30), pakshaTithi (1..15), paksha,
//     masaName, masaIndex, isAdhika, vikramSamvat, shakaSamvat,
//     varaName, varaIndex }

// Hindu → Gregorian: which Gregorian dates correspond to a (samvat, masa, paksha, tithi)?
const dates = convertHinduToGregorian(
  { vikramSamvat: 2083, masaIndex: 0, paksha: 'shukla', pakshaTithi: 9 },
  DELHI, { timezone: 330 },
);
// dates[0] → Rama Navami in VS 2083

getKaliYugaYear(new Date('2026-04-01'));         // 5127
getHinduNewYear(2026, 'tamil-nadu', DELHI, { timezone: 330 });  // Puthandu

// Yearly listings
getEkadashiDatesForYear(2026, DELHI, { timezone: 330 });   // ~24 Date[]
getSankrantisForYear(2026, DELHI, { timezone: 330 });      // 12 SankrantiEvent[]
getFestivalsInRange(start, end, DELHI, { timezone: 330 }); // FestivalDay[]
getUpcomingEclipses(new Date(), DELHI, 5);                  // 5 EclipseInfo[]
```

`getHinduNewYear` is region-aware: Tamil Nadu / Kerala / Punjab / Bengal / Assam use
the **solar** (Mesha Sankranti) anchor; everywhere else uses **Chaitra Shukla Pratipada**
(Ugadi / Gudi Padwa / Cheti Chand). When the Pratipada is a kshaya tithi (e.g. Ugadi
2026), the function falls back to the Amanta-Chaitra-masa boundary.

## 20. Localization

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

## 21. Configuration

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
computeAshtottariDasha, computeYoginiDasha, computeCharaDasha, computeNarayanDasha
computeChandraBalam, computeTarabala
computeLagna, computeBhava, computeRashiChart, computeNavamsa, computeDivisionalChart
computeHoraLagna, computeGhatiLagna, computeBhavaLagna, computeSripatiLagna
computeAspects, computeShadbala, computeBhavaBala, computeAshtakavarga
computeYogas, computeJaiminiKarakas
computeVarshaphala, computeTithiPravesha, computeArudhas, computeUpagrahas, computeArgala
computeAshtakoot, computePathuPorutham
computeMangalDosha, computeKaalSarp, computePitruDosha
computeSadeSati, computeDignity
computeKpSubLord, computeKpCuspalSubLords, computeKpSignificators
computePrashnaChart

// Muhurta engine
scoreMuhurta, findAuspiciousDates, STOCK_MUHURTA_RULES
vivahRule, grihaPraveshRule, namakaranaRule, vidyarambhRule, vahanKharidiRule
annaprashanRule, mundanRule, upanayanamRule, karnavedhaRule
aksharabhyasamRule, seemanthamRule, shopOpeningRule, travelStartRule

// Calendar conversion + yearly listings
convertGregorianToHindu, convertHinduToGregorian
getKaliYugaYear, getHinduNewYear, computeSamvat
getEkadashiDatesForYear, getSankrantisForYear, getFestivalsInRange, getUpcomingEclipses

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

7,156 tests passing across 81 files, including fixtures cross-verified against reference
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
