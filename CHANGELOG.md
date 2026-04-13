# panchang-ts

## 1.0.0

**Stable API.** This release begins the semver compatibility promise: every
symbol re-exported from `panchang-ts` is now a stable contract, and any
breaking change will require a v2 major bump.

**Drop-in upgrade from v0.7.0** for almost all users. No renames, no removed
exports, no changed defaults, no changed return shapes. Phase 18 added new
APIs (`computeChandraBalam`, `computeVimshottariDashaFromBirth`); Phase 19
added docs, tests, and JSDoc only. **One numeric output change** to flag —
see *Behavior change vs v0.7.0* below.

### Behavior change vs v0.7.0

`computePlanetaryPositions(...).rahu` and `.ketu` switched from the **true
node** (Meeus + perturbation series, ~±0.05° accuracy) to the **mean node**
(Meeus Ch. 47 polynomial, typically ±0.5° / worst-case ±2° vs the true
node). This aligns with classical Vedic practice and Drik's published
values.

**Impact:**
- `rahu.siderealLongitude` / `ketu.siderealLongitude` shift by ≤2°
- `rahu.rashi` — almost never changes (rashis are 30° wide)
- `rahu.nakshatra` / `pada` — *can* change in edge cases (nakshatras are
  ~13.3° wide)
- `computeVimshottariDasha*` is **unaffected** — dasha is computed from the
  Moon's longitude, not Rahu's
- All other planets are unchanged

If you depend on Rahu/Ketu degree values matching v0.7.0 exactly, this
release will produce different numbers. If you depend on Rahu/Ketu matching
Drik or other Vedic almanacs, this release will produce *better* numbers.

### What's in v1

- **Pancha Anga** — Tithi, Nakshatra, Yoga, Karana, Vara with end-times
- **Lunar calendar** — Chandra Masa (Purnimanta default + Amanta) with Adhika
  detection, Vikram & Shaka Samvat
- **Muhurta** — Brahma, Abhijit, Choghadiya (16 slots), Gowri Panchangam
  (16 slots), Hora (24 slots), Dur Muhurta
- **Inauspicious periods** — Rahu Kalam, Gulika Kalam, Yamaganda, Panchaka
- **Special Yogas** — Amrit Siddhi, Sarvartha Siddhi, Ravi Pushya, Guru Pushya
- **Festivals** — 24 major pan-Indian festivals + recurring Ekadashi /
  Pradosha / Sankranti (Adhika months auto-skipped)
- **Jyotish** — all 9 graha positions (sidereal, Rahu/Ketu on mean node),
  Vimshottari Dasha (from birth moment or Moon longitude), Antardasha
  breakdown, Chandra Balam
- **Astronomy utilities** — Sunrise, Sunset, Moonrise, Moonset, Sidereal
  Sun/Moon longitude, Ayanamsa

### Validation

- 4,864 tests passing
- Drik-verified across 2025–2026 (Delhi, Chennai, Mumbai, Bangalore, Pune)
- Sunrise/Sunset ≤29 s observed vs Drik minute-midpoint (±45 s test tolerance)
- Tithi / Nakshatra / Yoga / Karana end-times max 2.01 min drift, ±3 min
  tolerance (20 assertions)
- Planetary positions (Sun–Saturn) ≤0.02° vs Drik sidereal
- 12 Drik-verified festival dates (2025–2026)
- Bundle parses cleanly with the official Hermes JS frontend
  (`npm run test:hermes` via `hermes-parser`)

### Documented tradeoff

Festival detection uses **tithi-at-sunrise**. Festivals that Drik resolves
via tithi-at-midnight (Krishna Janmashtami, Maha Shivaratri, Diwali/Lakshmi
Puja), madhyahna-vyapini (Ganesh Chaturthi edge years, Akshaya Tritiya
2026), or kshaya-tithi handling (Ugadi 2026-03-19) can drift ±1 day from
Drik's canonical date. See the README §Festival Detection for the full
caveat set.

### Notable changes since v0.5.x (pre-0.7 users only)

- Default masa system is now `purnimanta` (North Indian). Pass
  `masaSystem: 'amanta'` for the South Indian convention.
- Kundli/birth-chart module was removed in v0.6 — to be developed as a
  separate package.

### Naming convention (stable from v1)

- `get*` — simple retrievers returning a single value at an instant, and
  the two top-level panchang entry points.
- `compute*` — synthesize multi-field structured results from derived
  astronomical inputs.
