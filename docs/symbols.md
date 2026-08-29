# Symbol-level correspondence exemptions

Read by `internal/symcheck` (`TestSymbolCorrespondence`), the way
`internal/treecheck` reads `docs/porting.md` §3. Every exported **value** symbol in a
mirrored `source/ts/src/` file must have a declaration in the mirrored Go
package (exported or unexported, matched case- and underscore-insensitively)
unless a row here says why not. A row that matches no symbol on disk fails the
check, and so does a row for a symbol that *does* have a counterpart.

The pattern is `filepath:name`, relative to `source/ts/src/`, with `*` inside a
segment or name and `**` across path segments. Type-only exports (`interface`,
`type`) are outside the gate's domain entirely (see the package docblock for
why), so they need no rows.

## The exemptions

| symbol | why it has no Go counterpart |
|---|---|
| `**:_*ForTest` | the TypeScript idiom for exposing a module-private function to the test suite (`_navamsaLongitudeForTest` and eighteen siblings). The port puts Go tests in the same package, where they call the unexported function directly; an exported alias would be surface with no consumer. |
| `jyotish/shadbala.ts:_BHAVA_DIK_VALUES_FOR_TEST` | the same test-access idiom in its SCREAMING_SNAKE spelling; `bhavaDikValues` is unexported in `shadbala.go` and its in-package tests read it directly. |
| `calendar/yearly.ts:getEkadashiDatesForYear` | `@deprecated` v4 alias of `computeEkadashiDatesForYear`. The port skips deprecated aliases: a module published for the first time has no v4 callers (`panchang/coverage_test.go`, the `deprecated` map). |
| `calendar/yearly.ts:getSankrantisForYear` | `@deprecated` v4 alias of `computeSankrantisForYear`; same skip. |
| `calendar/yearly.ts:getFestivalsInRange` | `@deprecated` v4 alias of `computeFestivalsInRange`; same skip. |
| `calendar/yearly.ts:getEclipsesInRange` | `@deprecated` v4 alias of `computeEclipsesInRange`; same skip. |
| `calendar/festivalsTable.ts:getFestivalsForYear` | `@deprecated` alias of `readFestivalsForYear`, ported as `ReadFestivalsForYear`; same skip. |
| `calendar/festivalsTable.ts:getFestivalsForDate` | `@deprecated` alias of `readFestivalsForDate`; same skip. |
| `calendar/festivalsTable.ts:getFestivalsYearRange` | `@deprecated` alias of `readFestivalsYearRange`; same skip. |
| `calendar/moonPhasesTable.ts:getMoonPhasesForYear` | `@deprecated` alias of `readMoonPhasesForYear`; same skip. |
| `calendar/moonPhasesTable.ts:getMoonPhasesForDate` | `@deprecated` alias of `readMoonPhasesForDate`; same skip. |
| `calendar/moonPhasesTable.ts:getMoonPhasesYearRange` | `@deprecated` alias of `readMoonPhasesYearRange`; same skip. |
| `calendar/eclipsesTable.ts:getEclipsesForYear` | `@deprecated` alias of `readEclipsesForYear`; same skip. |
| `calendar/eclipsesTable.ts:getEclipsesForDate` | `@deprecated` alias of `readEclipsesForDate`; same skip. |
| `calendar/eclipsesTable.ts:getEclipsesYearRange` | `@deprecated` alias of `readEclipsesYearRange`; same skip. |
| `jyotish/planets.ts:getTropicalPlanetLongitude` | a from-less re-export of `astronomy/planet.ts`'s function; the logic lives in `internal/astronomy/planet.go` (`GetTropicalPlanetLongitude`), and one Go package cannot re-export another's symbol. |
| `muhurta/rules/index.ts:STOCK_MUHURTA_RULES` | ported under a different shape, not missing: the TypeScript's insertion-ordered record becomes `rules.All()` and `rules.Get(occasion)` in `internal/muhurta/rules/index.go`, because a Go map cannot hold the key order the facade's `StockMuhurtaRules()` must reproduce. |
