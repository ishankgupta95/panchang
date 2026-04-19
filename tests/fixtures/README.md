# Test Fixtures — Provenance

| File | Provenance | What it asserts |
|------|------------|-----------------|
| `drikpanchang-verified.json` | **DrikPanchang.com — scraped manually** (per-entry `_source` markers naming Delhi/Chennai locations and scrape dates) | Tithi/Nakshatra/Yoga/Karana names + end-times, Sunrise/Sunset HH:MM, Chandra Rashi, Chandra Masa, Rahu Kalam / Yamaganda / Abhijit, festivals — across 5+ Indian dates |
| `drikpanchang-planets.json` | **DrikPanchang.com Sidereal Planetary Positions page — scraped 2026-04-12** (per-entry `_source`, geoname-id=1273294 Delhi) | Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu — sidereal longitude, rashi, nakshatra, retrograde flag |
| `drikpanchang-festivals.json` | **DrikPanchang.com Hindu calendar pages — scraped manually** (per-entry `_source` markers per festival per year) | Festival name → date assignment for major Hindu festivals across 2025–2026 |
| `drikpanchang-diaspora.json` | **DrikPanchang.com — scraped 2026-04-19** (`_meta.source` declares full Drik verification; geoname-ids: NYC=5128581, London=2643743, Sydney=2147714, Dubai=292223, Singapore=1880252) | Vara, Tithi/Nakshatra at sunrise, Sunrise/Sunset across 15 entries (5 cities × 3 dates spanning DST + solstices) |
| `drikpanchang-precise.json` | **DrikPanchang.com — full Drik verification (scraped 2026-04-19)** (per-file `_note`). All 15 unique dates' tithi-at-sunrise / nakshatra-at-sunrise / chandramasa names are Drik-sourced; sunrise/sunset HH:MM are library-precise tested vs Drik HH:MM with ±2 min tolerance. | Vara, Tithi/Nakshatra at sunrise, Sunrise/Sunset, Chandra Masa across ~20 entries |
| `structural-india.json` | **Structural smoke test, NOT Drik values** — only asserts `varaEnglish` (pure calendar arithmetic, independent of any panchang authority) and `tithiCountAtLeast`/`nakshatraCountAtLeast` (≥ 1 — tautological). | Vara matches calendar weekday + element arrays non-empty |
| `structural-world.json` | **Structural smoke test, NOT Drik values** — same shape as `structural-india.json`: `varaEnglish` (calendar) + count assertions only. Vara correctness across 10 cities (NYC, London, Tokyo, Sydney, Cape Town, Singapore, Dubai, LA, Nairobi, Toronto) is calendar-derived. | Same as structural-india.json |
| `pune-200days.json` | **Structural smoke test, NOT Drik values** — 242 consecutive days at Pune asserting `varaEnglish` (calendar) + `tithiCountAtLeast`/`nakshatraCountAtLeast`. Used to detect crashes / shape regressions over a long range. | Library doesn't crash, vara matches calendar, element arrays non-empty across 242 days |
| `ayanamsa-reference.json` | Currently empty array — placeholder for future Swiss-Ephemeris ayanamsa cross-verification | — |

## Naming convention

- **`drikpanchang-*.json`** — files whose `expected` block carries Drik-scraped
  panchang values. Each must include either per-entry `_source` markers or a
  file-level `_meta`/`_note` declaring the scrape date and Drik geoname-id used.
- **`structural-*.json`** — fixtures that exercise library shape / invariants
  / weekday correctness without comparing to any panchang authority.
  These should never depend on Drik values.

## Adding a new Drik fixture

1. Fetch the Drik day-panchang page for `<date>` and `<location>` via its
   `geoname-id` URL: `https://www.drikpanchang.com/panchang/day-panchang.html?geoname-id=<id>&date=DD/MM/YYYY`.
2. Record the values verbatim (24-hour HH:MM for times, exact tithi/nakshatra
   names from Drik with the Library's transliteration normalized — e.g. Drik
   "Raviwara" matches Library "Raviwara").
3. Include the geoname-id and scrape date in `_source` / `_meta` so the
   provenance is traceable.
4. Library is allowed to disagree with Drik up to documented per-test
   tolerances (sunrise/sunset ±2 min, end-times ±3 min, planetary longitude
   ±0.02° non-node / ±2° node — see README §Accuracy).

**Do not seed expected values from `panchang-ts` output.** A fixture generated
from library output is a tautology, not a test. If you cannot find a Drik
reference for a given date, leave the fixture out rather than self-seed.
