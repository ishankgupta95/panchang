---
'panchang-ts': minor
---

Correctness fixes and a Go port. Four of these change numbers that 5.1.1 returned, so read the
first section before upgrading if you cache or diff output.

**Solar eclipse ranges no longer loop on one eclipse.** `getUpcomingSolarEclipse` did not check
that an eclipse it found actually ended after the instant it was asked to search from. For an
observer east of the shadow axis the local contacts can fall entirely before the geocentric
conjunction, so every walker that advanced its cursor to `eclipse.end + 1s` found the same
eclipse again, and again, until it hit its step budget. `computeEclipsesInRange(2000 to 2011,
Varanasi)` returned 277 entries of which 249 were the same 2007-03-19 partial, and dropped the
2008-08-01, 2009-07-22 and 2010-01-15 solar eclipses entirely; it now returns 32 distinct
entries with all three present. Over 1900-2100 this affected 33 of 80 locally visible solar
eclipses at Varanasi, 31 of 77 at Delhi, 18 of 74 at New York. Affects `getUpcomingEclipses`,
`computeEclipsesInRange`, `getEclipsesInRange`, `computeEclipsesForYear` and
`buildEclipsesTable`. `getDailyPanchang` was never affected.

**Shadbala Kala Bala is anchored to the preceding sunrise.** The day frame was taken from the
sunrise after birth rather than the last sunrise at or before it, so evening and night births
were measured against the wrong day and `nathonatha` could fall outside its 0 to 60 virupa
range. 1009 of 2016 sampled births move, by up to 482 virupas.

**Narayan dasha durations exclude adjacent signs from rasi drishti.** 160 of 3660 sampled charts
change duration.

**Gulika and Mandi use a day/night test that matches their own definition.** Births inside a
window of roughly four minutes a day move by up to 101 degrees.

**Festivals no longer vanish when their anchor tithi is kshaya.** A tithi that begins and ends
between two consecutive sunrises is current at no sunrise, and a rule keyed on the sunrise tithi
matched it on no day of the year, so the festival disappeared from that year entirely. Ugadi and
Gudi Padwa were absent from 2026 at every location; Navaratri 2027, Gangaur 2025, both Teejes,
Govardhan Puja, Bhai Dooj, Anant Chaturdashi, Kartika Purnima and Chhath Kharna were missing at
some cities and present at others. The Hindu day that wholly contains the tithi now claims it,
which is what the reference almanac publishes.

Every date this adds was checked against the reference before it shipped: Ugadi and Gudi Padwa
2026 (both 2026-03-19), Hariyali Teej 2027 (2027-08-04), Hartalika Teej 2028 (2028-08-22) and
2029 (2029-09-10), Anant Chaturdashi 2021 (2021-09-19), Bhai Dooj 2020 (2020-11-16) and 2029
(2029-11-07), Govardhan Puja 2028 (2028-10-18) and 2029 (2029-11-06), Navaratri 2027
(2027-09-30), Kartika Purnima 2024 (2024-11-15) and Chhath Kharna 2022 (2022-10-29). Gangaur
2025 (2025-03-31) is corroborated by a second almanac rather than the first, which was
unreachable. Where the reference itself splits a date by city, so does this: Hartalika Teej 2029
is the 10th of September at Ahmedabad, Jaipur, Mumbai and Ujjain and the 11th at Delhi, Varanasi,
Chennai and Kolkata, in both.

Measured over eight Indian cities across 2020-2030: 87 dates added, and **no existing date
moves**. That is the shape of the whole change. Every addition belongs to a city and year in which
the festival previously had no date at all, so nothing is rescheduled and no city gains a second
date for a festival it already had. Across the 29 locations and 16,385 days of the parity corpus,
which includes Sydney, Reykjavik and two Arctic sites, the same holds: 32 emissions added, none
removed, and the polar day handling untouched.

A kshaya Shukla Pratipada is the one anchor that opens at the very instant the amanta month rolls,
so it alone is tested against the following day's masa rather than the sunrise masa. When that
following month is adhika the rule is skipped, exactly as it would be on any other day of an
adhika month; without that the containing-day rule would have put Ugadi on Adhika Chaitra and
again on the nija Chaitra a month later, which it does in 1945 and 1964.

Four festivals are deliberately excluded, because the reference does not place them on the
containing day: Narak Chaturdashi and Chhath Usha Arghya, which it publishes on the day the tithi
ENDS (their observances sit in its pre-dawn tail, and Chhath is anchored as a four-day sequence),
and Holi and Phagli, which are pradosha-anchored. Dhanteras is unaffected because it already keys
on pradosha rather than sunrise. Those four need their own anchors and are left for a later change.

The containing-day rule is deliberately confined to the tithi. A kshaya NAKSHATRA is not resolved
by containment, because the reference does not resolve it that way: the Shravana nakshatra of 2022
is kshaya, and Rig Veda Upakarma is published on the 3rd of August, a Hasta day, rather than on the
11th that contains the anchor. That case is handled by the Upakarma re-anchoring below instead.

**Output strings: 27 labels and messages changed.** An em dash was replaced by a colon or comma
throughout user-visible text, in both `en` and `hi`: the eclipse description template, both
Bathukamma labels, all four Chhath labels, the `PanchangError` message for a polar location with
no sunrise, and the Ashtakoot, Pathu Porutham and Manglik descriptions. The default notes and
phase descriptions emitted by `buildEclipsesTable` and `buildMoonPhasesTable` changed the same
way. Error codes are unchanged, so code branching on `err.code` is unaffected; code matching on
message or label text is not.

**Vat Savitri Amavasya moves a month earlier, to the date it was always meant to have.** The vrat
is observed on purnimanta Jyeshtha Amavasya, but the rule was filed under amanta Jyeshtha. An
amavasya ENDS its amanta month, so the two names are a month apart: amanta Jyeshtha's amavasya is
what the purnimanta system calls Ashadha Amavasya. The rule had therefore been selecting the wrong
new moon in every year since the festival was added, and `vat_savitri_amavasya` was published
roughly thirty days late. It now keys on amanta Vaishakha, and agrees with the reference almanac
for 2020 (2020-05-22), 2022 (2022-05-30), 2023 (2023-05-19), 2024 (2024-06-06), 2025 (2025-05-26),
2026 (2026-05-16) and 2027 (2027-06-04), where before it agreed with none of them. 2026 is worth
calling out: the Amavasya that year touches no sunrise at all, and the aparahna anchor still lands
on the day the reference publishes.

It is also anchored to aparahna rather than sunrise, and where the amavasya reaches aparahna on
two consecutive days the second takes it. That is what settles 2025, where the amavasya begins at
12:11 on the 26th and reaches sunrise only on the 27th: the reference publishes the 26th and so
does this. It now agrees with the reference in all seven checked years, where before it agreed
with none. `vat_savitri_purnima` is untouched and still keys on amanta Jyeshtha, which is correct
there, because a purnima sits inside the amanta month whose name it carries.

This MOVES a date rather than adding one, as does the Upakarma change below. Anything caching
`vat_savitri_amavasya` by date will see it shift by a lunation, and in 2021 by two entries down to
one: a vriddha Amavasya used to satisfy the sunrise test on two consecutive days, and the corrected
anchor has only one.

**Rig and Sama Upakarma are re-anchored, and both now land on one day a year.** The two rules
matched on the nakshatra at sunrise and nothing else, with no paksha and no kala, which was wrong
in three ways at once. Sama Upakarma fired a SECOND time in six of thirteen checked years, on the
Bhadrapada Krishna Amavasya that carries Hasta again, because a nakshatra recurs inside a single
lunar month and nothing confined the rule to Shukla paksha. It was also a day late in five more
years, because Samavedi Upakarma kala is aparahna and the rule was reading sunrise. Rig Upakarma
emitted two dates in the years the Shravana nakshatra spans two sunrises, and nothing at all in
the years it falls outside Shukla paksha, which is what happened in 2022.

Scored against the reference for thirteen years each, 2018 to 2030: `rig_upakarma` goes from 9 of
13 to 13 of 13, and `sama_upakarma` from 4 of 13 to 13 of 13. Across eight Indian cities and
2020 to 2030, both now emit exactly one date in all 88 city-years; before, Sama managed 45, left
4 blank and emitted twice in 39. The dates follow Nirnaya Sindhu and Dharmasindhu as the
reference does: Shravana nakshatra in Shravana Shukla for Rig, falling back to Hasta in the same
paksha when the Shravana nakshatra slips past Purnima, and Hasta reaching aparahna in Bhadrapada
Shukla for Sama, with a spell that reaches aparahna on two days going to the second of them. That
last rule is longitude sensitive and so is the published date: Sama Upakarma 2026 is the 13th of
September at Kolkata and the 12th everywhere else, in the reference and now here too.

Both rules MOVE dates rather than adding them, in most years. Rig Upakarma 2020 moves from the
4th of August to the 26th of July and 2022 appears for the first time, on the 3rd of August. Sama
Upakarma moves by a day in 2019, 2023, 2024, 2026 and 2030, and loses its spurious second date in
2018, 2021, 2023, 2025, 2026 and 2027. `yajur_upakarma` is untouched: it keys on Shravana Purnima,
a tithi, and was already right.

Three things are new on a festival rule and may matter to anyone reading the shape of the
registry: a `paksha` constraint, a `nakshatraDateRule` naming the kala a nakshatra anchor must
pervade, and a `fallbackNakshatra` used only when the anchor is absent from the whole remaining
paksha. All three are internal to the rule table, which is not exported.

**Nakshatra pada no longer returns 0 at one exact longitude.** A sidereal longitude landing one
ULP below a nakshatra boundary produced pada 0, outside the documented 1 to 4, with negative zero
for the degrees and completion. Reachable for exactly one double in the domain.

**New moon lookups abstain from the cache within 2 ms of a lunation boundary.** Two search routes
to the same syzygy can disagree by a millisecond, which put a reference instant on the wrong side
of a cached boundary and shifted the Chandra masa by a whole month.

**Six dasha entry points accept an optional trailing `asOfDate`.** Additive; existing calls are
unchanged. An invalid `Date` throws `PanchangError` with code `INVALID_DATE`.

**`clearRiseSetTracks` now also clears the rise/set event cache.** Callers that previously saw
stale events after clearing no longer do.

**A Go port ships alongside**, as `github.com/ishankgupta95/panchang-ts/source/go/v5`. It
reproduces this package's arithmetic; a parity harness compares the two leaf for leaf on every
change. They agree bit for bit on every published instant, boundary, festival and muhurta, and to
within 3.4e-13 degrees on sidereal longitudes. Nothing about the npm package changes because of
it. On the Go side the fourteen error codes are now exported as constants from the public package,
alongside `AllErrorCodes()`: TypeScript gets them as the `PanchangErrorCode` string-literal union,
which its compiler checks, and Go has no equivalent type, so it needed the names.

**Three named reference frames, for callers who have no location.** `location` stays required, so
nothing starts defaulting on its own. A result is now describable as one of `practical` (the
location you passed, and the only frame correct for a real user), `traditional` (Ujjain
23.1765N/75.7885E, the classical madhya rekha, and the default fallback) or `modern`
(23.1833N/82.5E, the 1955 Calendar Reform Committee reference for the Rashtriya Panchang). New
exports `TRADITIONAL_REFERENCE`, `MODERN_REFERENCE`, `IST_TIMEZONE`, `IST_OFFSET_MINUTES`, `referenceLocation` and
`resolveLocation`, the last returning `{ location, reference }` so a caller can label a fallback
result the way a printed panchang names its city. `practical` is reported, never selected: passing
a location is what makes a result practical. Both fallbacks are approximations and are documented
as such: measured over 730 days against 48 Indian cities, the tithi at the reference's sunrise
differs from the city's own on up to 5.9% of days for Ujjain and 4.0% for the Central Station.
`IST_OFFSET_MINUTES` is exact for the Central Station, whose longitude is the IST meridian, and is
the civil clock rather than local mean time for Ujjain. A half-filled location throws rather than
being completed, and 0,0 is treated as the real place it is. Mirrored in the Go module as
`TraditionalReference()`, `ModernReference()`, `ReferenceLocation()` and `ResolveLocation()`.

**Editor documentation is thinner.** `dist/index.d.ts` dropped from 268 KB to 75 KB and 326 of
633 JSDoc blocks are gone, so hover documentation shows less than it did in 5.1.1.
