# Ephemeris source tables — provenance

Fetched by [notes/ephemeris-fetch.mjs](../../../notes/ephemeris-fetch.mjs). Do not
hand-edit: re-run the script and diff instead. Each bundle is the upstream files
concatenated verbatim, separated by a `===== NAME =====` line.

| bundle | upstream | reference |
|---|---|---|
| `vsop87d.txt.gz` | https://cdsarc.cds.unistra.fr/ftp/VI/81/VSOP87D.{ear,mer,ven,mar,jup,sat} | Bretagnon P., Francou G., *A&A* **202**, 309 (1988) |
| `vsop87.chk.txt.gz` | https://cdsarc.cds.unistra.fr/ftp/VI/81/vsop87.chk | IMCCE's own substitution results — used to validate the parser |
| `elp2000-82b.txt.gz` | https://cdsarc.cds.unistra.fr/ftp/VI/79/ELP1 … ELP36 | Chapront-Touzé M., Chapront J., *A&A* **124**, 50 (1983); **190**, 342 (1988) |
| `iers-nutation.txt.gz` | https://iers-conventions.obspm.fr/content/chapter5/additional_info/tab5.3{a,b}.txt | IERS Conventions (2010), ch. 5 — IAU 2000A nutation, 2000_R06 expression |

## Who reads these

- `notes/ephemeris-generate.mjs` truncates them into `src/astronomy/series/`
  under a stated error budget, and prints the resulting term counts.
- `tests/reference/` evaluates them **untruncated**, as the frozen reference
  implementation of PLAN.md §36.0 H. The shipped series is differential-tested
  against that reference, so the truncation budget is measured rather than
  asserted.

Nothing in `src/` reads these files; the published package does not contain them
(`.npmignore` excludes `tests/`).
