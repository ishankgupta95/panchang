package panchang

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
)

// TestFacadeCoverage classifies every value the npm package exports, from the
// src/index.ts barrel and from each subpath module package.json publishes
// (panchang-ts/festivals and the rest), as covered by a Go name or skipped as a
// deprecated alias.
func TestFacadeCoverage(t *testing.T) {
	barrel := parseBarrelExports(t)
	if len(barrel) < 100 {
		t.Fatalf("parsed %d exports from src/index.ts; the parser is broken, and every check below would pass vacuously", len(barrel))
	}
	subpaths := parseSubpathExports(t)
	if len(subpaths) < 20 {
		t.Fatalf("parsed %d exports from the package.json subpath modules; the parser is broken", len(subpaths))
	}
	seen := map[string]bool{}
	var all []string
	for _, n := range append(barrel, subpaths...) {
		if !seen[n] {
			seen[n] = true
			all = append(all, n)
		}
	}
	sort.Strings(all)

	known := map[string]bool{}
	for ts := range covered {
		known[ts] = true
	}
	for ts := range deprecated {
		if known[ts] {
			t.Errorf("%s is both covered and deprecated", ts)
		}
		known[ts] = true
	}

	for _, ts := range all {
		if !known[ts] {
			t.Errorf("the npm package exports %s and this test classifies it as neither covered nor deprecated. Add it to one", ts)
		}
	}
	exported := map[string]bool{}
	for _, ts := range all {
		exported[ts] = true
	}
	for ts := range known {
		if !exported[ts] {
			t.Errorf("%s is classified here but the npm package no longer exports it. Remove it", ts)
		}
	}
	if len(covered)+len(deprecated) != len(all) {
		t.Errorf("covered %d + deprecated %d != %d parsed", len(covered), len(deprecated), len(all))
	}
	t.Logf("facade covers %d of %d value exports; %d deprecated aliases deliberately not carried",
		len(covered), len(all), len(deprecated))
}

func TestDeprecatedAliasesPointAtSomethingCovered(t *testing.T) {
	for alias, replacement := range deprecated {
		if _, ok := covered[replacement]; !ok {
			t.Errorf("%s is skipped as an alias of %s, but %s is not covered either", alias, replacement, replacement)
		}
	}
}

// TestCoveredNamesExist checks that every TypeScript barrel export the table
// claims is ported really is declared on the Go side. Functions and methods live
// in panchang.go; the types and their constants live in the shared types
// package, which is why this reads both trees.
func TestCoveredNamesExist(t *testing.T) {
	facade, err := os.ReadFile(repopath.Go("panchang", "panchang.go"))
	if err != nil {
		t.Fatal(err)
	}
	typeFiles, err := filepath.Glob(repopath.Go("types", "*.go"))
	if err != nil || len(typeFiles) == 0 {
		t.Fatalf("no files in the types package: %v", err)
	}
	var shared strings.Builder
	for _, f := range typeFiles {
		if strings.HasSuffix(f, "_test.go") {
			continue
		}
		b, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		shared.Write(b)
	}
	facadeText, sharedText := squash(string(facade)), squash(shared.String())

	for ts, goName := range covered {
		if ok, want, where := declaredIn(facadeText, sharedText, goName); !ok {
			t.Errorf("%s maps to %s, but %s declares no %q", ts, goName, where, want)
		}
	}
}

var blankRun = regexp.MustCompile(`[ \t]+`)

func squash(s string) string { return blankRun.ReplaceAllString(s, " ") }

// declaredIn reports whether goName, spelled as the covered table spells it,
// is declared: functions and methods in the facade text, types and constants
// in the types package text.
func declaredIn(facadeText, sharedText, goName string) (ok bool, want, where string) {
	text := facadeText
	switch {
	case strings.HasPrefix(goName, "(*Session)."):
		want, where = "func (s *Session) "+strings.TrimPrefix(goName, "(*Session).")+"(", "panchang.go"
	case strings.HasPrefix(goName, "type "):
		want, where, text = "type "+bare(goName, "type ")+" ", "the types package", sharedText
	case strings.HasPrefix(goName, "const "):
		want, where, text = " "+bare(goName, "const ")+" ", "the types package", sharedText
	default:
		want, where = "func "+goName+"(", "panchang.go"
	}
	return strings.Contains(text, want), want, where
}

// optionArms maps each overloaded TypeScript export to the option that
// selects its non-default arm and the separately named Go entry point for
// that arm. The coverage table above matches export names only, so without
// this a TypeScript option whose result type differs could go unported.
var optionArms = map[string]struct{ option, goName string }{
	"computeArgala":         {"includeTrikonargala: true", "ComputeArgalaWithTrikonargala"},
	"computeJaiminiKarakas": {"variant: '8-jaimini'", "ComputeJaimini8Karakas"},
	"computeNarayanDasha":   {"duration: 'variable'", "(*Session).ComputeNarayanDashaVariable"},
	"computeSripatiLagna":   {"includeCusps: true", "(*Session).ComputeSripatiLagnaWithCusps"},
}

// TestOverloadArmsHaveGoEntryPoints finds every TypeScript function exported
// with overload signatures and checks that optionArms names its option, that
// the option still appears in that file, and that the Go entry point exists.
func TestOverloadArmsHaveGoEntryPoints(t *testing.T) {
	overloaded := map[string]string{}
	decl := regexp.MustCompile(`(?m)^export function ([A-Za-z0-9_]+)\(`)
	err := filepath.WalkDir(repopath.Src(), func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".ts") {
			return err
		}
		b, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		count := map[string]int{}
		for _, m := range decl.FindAllStringSubmatch(string(b), -1) {
			count[m[1]]++
		}
		for name, n := range count {
			if n > 1 {
				overloaded[name] = squash(strings.ReplaceAll(string(b), "\n", " "))
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(overloaded) < len(optionArms) {
		t.Fatalf("found %d overloaded exports, fewer than the %d optionArms rows; the scan is broken", len(overloaded), len(optionArms))
	}

	facade, err := os.ReadFile(repopath.Go("panchang", "panchang.go"))
	if err != nil {
		t.Fatal(err)
	}
	facadeText := squash(string(facade))
	for name, text := range overloaded {
		arm, ok := optionArms[name]
		if !ok {
			t.Errorf("%s is exported with overloads; add an optionArms row naming the option and the Go function for its non-default arm", name)
			continue
		}
		if !strings.Contains(text, arm.option) {
			t.Errorf("optionArms says %s selects its arm with %q, which its source no longer contains", name, arm.option)
		}
		if ok, want, where := declaredIn(facadeText, "", arm.goName); !ok {
			t.Errorf("%s's %q arm maps to %s, but %s declares no %q", name, arm.option, arm.goName, where, want)
		}
	}
	for name := range optionArms {
		if _, ok := overloaded[name]; !ok {
			t.Errorf("optionArms has a row for %s, which is no longer exported with overloads. Remove it", name)
		}
	}
}

// bare strips the table's kind prefix and the types. qualifier, leaving the
// identifier as it is spelled at its declaration.
func bare(goName, prefix string) string {
	return strings.TrimPrefix(strings.TrimPrefix(goName, prefix), "types.")
}

func parseBarrelExports(t *testing.T) []string {
	t.Helper()
	raw, err := os.ReadFile(repopath.Src("index.ts"))
	if err != nil {
		t.Fatal(err)
	}
	text := regexp.MustCompile(`(?s)/\*.*?\*/`).ReplaceAllString(string(raw), "")
	text = regexp.MustCompile(`(?m)^\s*//.*$`).ReplaceAllString(text, "")

	var out []string
	seen := map[string]bool{}
	for _, m := range regexp.MustCompile(`export\s+(type\s+)?\{([^}]*)\}\s+from`).FindAllStringSubmatch(text, -1) {
		if m[1] != "" {
			continue
		}
		for _, n := range strings.Split(m[2], ",") {
			n = strings.TrimSpace(n)
			if n == "" || strings.HasPrefix(n, "type ") {
				continue
			}
			if i := strings.Index(n, " as "); i >= 0 {
				n = strings.TrimSpace(n[i+4:])
			}
			if !seen[n] {
				seen[n] = true
				out = append(out, n)
			}
		}
	}
	sort.Strings(out)
	return out
}

// parseSubpathExports reads package.json's exports map and returns the value
// exports of each subpath module other than ".", from its source file under
// src/: every `export function` and `export const`.
func parseSubpathExports(t *testing.T) []string {
	t.Helper()
	raw, err := os.ReadFile(repopath.Src("..", "package.json"))
	if err != nil {
		t.Fatal(err)
	}
	var pkg struct {
		Exports map[string]struct {
			Require struct {
				Default string `json:"default"`
			} `json:"require"`
		} `json:"exports"`
	}
	if err := json.Unmarshal(raw, &pkg); err != nil {
		t.Fatal(err)
	}
	decl := regexp.MustCompile(`(?m)^export\s+(?:function|const)\s+([A-Za-z0-9_]+)`)
	var out []string
	seen := map[string]bool{}
	files := 0
	for sub, e := range pkg.Exports {
		if sub == "." {
			continue
		}
		rel := strings.TrimSuffix(strings.TrimPrefix(e.Require.Default, "./dist/"), ".cjs") + ".ts"
		b, err := os.ReadFile(repopath.Src(filepath.FromSlash(rel)))
		if err != nil {
			t.Fatalf("package.json subpath %s: %v", sub, err)
		}
		files++
		for _, m := range decl.FindAllStringSubmatch(string(b), -1) {
			if !seen[m[1]] {
				seen[m[1]] = true
				out = append(out, m[1])
			}
		}
	}
	if files < 4 {
		t.Fatalf("package.json lists %d subpath modules, want at least 4 (festivals, eclipses, moon-phases, muhurta)", files)
	}
	sort.Strings(out)
	return out
}

var covered = map[string]string{
	"ALL_SAHAM_NAMES":                  "AllSahamNames",
	"ASHTOTTARI_ORDER":                 "AshtottariOrder",
	"ASHTOTTARI_YEARS":                 "AshtottariYears",
	"MODERN_REFERENCE":                 "ModernReference",
	"CHARA_RASHI_YEARS":                "CharaRashiYears",
	"GRAHA_ABBR":                       "GrahaAbbr",
	"IST_OFFSET_MINUTES":               "const types.ISTOffsetMinutes",
	"IST_TIMEZONE":                     "const types.ISTTimezone",
	"PanchangError":                    "type types.PanchangError",
	"SAMA_PADA_RASHIS":                 "SamaPadaRashis",
	"STOCK_MUHURTA_RULES":              "StockMuhurtaRules",
	"TRADITIONAL_REFERENCE":            "TraditionalReference",
	"VISHAMA_PADA_RASHIS":              "VishamaPadaRashis",
	"YOGINI_ORDER":                     "YoginiOrder",
	"YOGINI_PLANET":                    "YoginiPlanet",
	"YOGINI_YEARS":                     "YoginiYears",
	"aksharabhyasamRule":               "AksharabhyasamRule",
	"annaprashanRule":                  "AnnaprashanRule",
	"buildEclipsesTable":               "(*Session).BuildEclipsesTable",
	"buildFestivalsTable":              "(*Session).BuildFestivalsTable",
	"buildMoonPhasesTable":             "(*Session).BuildMoonPhasesTable",
	"buildMuhurtaTable":                "(*Session).BuildMuhurtaTable",
	"classifyPanchaka":                 "ClassifyPanchaka",
	"computeAbhijitMuhurta":            "ComputeAbhijitMuhurta",
	"computeAmritKalaWindows":          "ComputeAmritKalaWindows",
	"computeAnandadiYoga":              "ComputeAnandadiYoga",
	"computeArgala":                    "ComputeArgala",
	"computeArudhas":                   "ComputeArudhas",
	"computeAshtakavarga":              "ComputeAshtakavarga",
	"computeAshtakoot":                 "ComputeAshtakoot",
	"computeAshtottariDasha":           "ComputeAshtottariDasha",
	"computeAspects":                   "ComputeAspects",
	"computeAuspiciousDatesForYear":    "(*Session).ComputeAuspiciousDatesForYear",
	"computeAuspiciousDatesInRange":    "(*Session).ComputeAuspiciousDatesInRange",
	"computeBhava":                     "(*Session).ComputeBhava",
	"computeBhavaBala":                 "(*Session).ComputeBhavaBala",
	"computeBhavaLagna":                "(*Session).ComputeBhavaLagna",
	"computeBrahmaMuhurta":             "ComputeBrahmaMuhurta",
	"computeChandraBalam":              "ComputeChandraBalam",
	"computeCharaDasha":                "(*Session).ComputeCharaDasha",
	"computeDignity":                   "ComputeDignity",
	"computeDivisionalChart":           "(*Session).ComputeDivisionalChart",
	"computeDoGhati":                   "ComputeDoGhati",
	"computeEclipsesForYear":           "(*Session).ComputeEclipsesForYear",
	"computeEclipsesInRange":           "(*Session).ComputeEclipsesInRange",
	"computeEkadashiDatesForYear":      "(*Session).ComputeEkadashiDatesForYear",
	"computeFestivalsForYear":          "(*Session).ComputeFestivalsForYear",
	"computeFestivalsInRange":          "(*Session).ComputeFestivalsInRange",
	"computeGandaMula":                 "ComputeGandaMula",
	"computeGhatiLagna":                "(*Session).ComputeGhatiLagna",
	"computeGodhuliMuhurta":            "ComputeGodhuliMuhurta",
	"computeGowriPanchangam":           "ComputeGowriPanchangam",
	"computeGulikaKalam":               "ComputeGulikaKalam",
	"computeHoraLagna":                 "(*Session).ComputeHoraLagna",
	"computeJaiminiKarakas":            "ComputeJaiminiKarakas",
	"computeKaalSarp":                  "ComputeKaalSarp",
	"computeKpCuspalSubLords":          "(*Session).ComputeKpCuspalSubLords",
	"computeKpSignificators":           "ComputeKpSignificators",
	"computeKpSubLord":                 "ComputeKpSubLord",
	"computeLagna":                     "(*Session).ComputeLagna",
	"computeMadhyahna":                 "ComputeMadhyahna",
	"computeMangalCompatibility":       "ComputeMangalCompatibility",
	"computeMangalDosha":               "ComputeMangalDosha",
	"computeMoonPhasesForYear":         "(*Session).ComputeMoonPhasesForYear",
	"computeMoonPhasesInRange":         "(*Session).ComputeMoonPhasesInRange",
	"computeNarayanDasha":              "(*Session).ComputeNarayanDasha",
	"computeNavamsa":                   "(*Session).ComputeNavamsa",
	"computeNishitaMuhurta":            "ComputeNishitaMuhurta",
	"computePanchaka":                  "ComputePanchaka",
	"computePanchakaRahita":            "ComputePanchakaRahita",
	"computePathuPorutham":             "ComputePathuPorutham",
	"computePitruDosha":                "ComputePitruDosha",
	"computePlanetaryPositions":        "(*Session).ComputePlanetaryPositions",
	"computePrashnaChart":              "(*Session).ComputePrashnaChart",
	"computePratahSandhya":             "ComputePratahSandhya",
	"computeRahuKalam":                 "ComputeRahuKalam",
	"computeRashiChart":                "(*Session).ComputeRashiChart",
	"computeSadeSati":                  "(*Session).ComputeSadeSati",
	"computeSamvat":                    "(*Session).ComputeSamvat",
	"computeSankrantisForYear":         "(*Session).ComputeSankrantisForYear",
	"computeSayahnaSandhya":            "ComputeSayahnaSandhya",
	"computeShadbala":                  "(*Session).ComputeShadbala",
	"computeSripatiLagna":              "(*Session).ComputeSripatiLagna",
	"computeTarabala":                  "ComputeTarabala",
	"computeTithiPravesha":             "(*Session).ComputeTithiPravesha",
	"computeUpagrahas":                 "(*Session).ComputeUpagrahas",
	"computeVaraTithiYogas":            "ComputeVaraTithiYogas",
	"computeVarjyam":                   "ComputeVarjyam",
	"computeVarjyamWindows":            "ComputeVarjyamWindows",
	"computeVarshaphala":               "(*Session).ComputeVarshaphala",
	"computeVijayaMuhurta":             "ComputeVijayaMuhurta",
	"computeVimshottariDasha":          "ComputeVimshottariDasha",
	"computeVimshottariDashaFromBirth": "(*Session).ComputeVimshottariDashaFromBirth",
	"computeVimshottariPratyantar":     "ComputeVimshottariPratyantar",
	"computeVimshottariPratyantarIn":   "ComputeVimshottariPratyantarIn",
	"computeYamaganda":                 "ComputeYamaganda",
	"computeYogas":                     "ComputeYogas",
	"computeYoginiDasha":               "ComputeYoginiDasha",
	"convertGregorianToHindu":          "(*Session).ConvertGregorianToHindu",
	"convertHinduToGregorian":          "(*Session).ConvertHinduToGregorian",
	"findAuspiciousDates":              "(*Session).FindAuspiciousDates",
	"findPanchakaOnset":                "FindPanchakaOnset",
	"formatInZone":                     "FormatInZone",
	"getAyanamsa":                      "ComputeAyanamsa",
	"getDailyPanchang":                 "(*Session).GetDailyPanchang",
	"getEclipseDuringDay":              "(*Session).GetEclipseDuringDay",
	"getHinduNewYear":                  "(*Session).GetHinduNewYear",
	"getInstantPanchang":               "(*Session).GetInstantPanchang",
	"getKaliYugaYear":                  "(*Session).GetKaliYugaYear",
	"getMoonPhasesInRange":             "(*Session).GetMoonPhasesInRange",
	"getMoonrise":                      "(*Session).GetMoonrise",
	"getMoonset":                       "(*Session).GetMoonset",
	"getSiderealMoonLongitude":         "(*Session).GetSiderealMoonLongitude",
	"getSiderealSunLongitude":          "(*Session).GetSiderealSunLongitude",
	"getSunrise":                       "(*Session).ComputeSunrise",
	"getSunset":                        "(*Session).ComputeSunset",
	"getUpcomingEclipses":              "(*Session).GetUpcomingEclipses",
	"getUpcomingLunarEclipse":          "(*Session).GetUpcomingLunarEclipse",
	"getUpcomingSolarEclipse":          "(*Session).GetUpcomingSolarEclipse",
	"grihaPraveshRule":                 "GrihaPraveshRule",
	"isEclipseVisibleAnyPhase":         "(*Session).IsEclipseVisibleAnyPhase",
	"isPanchakaDosha":                  "IsPanchakaDosha",
	"karnavedhaRule":                   "KarnavedhaRule",
	"mundanRule":                       "MundanRule",
	"namakaranaRule":                   "NamakaranaRule",
	"readBestMuhurtaDays":              "ReadBestMuhurtaDays",
	"readEclipsesForDate":              "ReadEclipsesForDate",
	"readEclipsesForYear":              "ReadEclipsesForYear",
	"readEclipsesYearRange":            "ReadEclipsesYearRange",
	"readFestivalsForDate":             "ReadFestivalsForDate",
	"readFestivalsForYear":             "ReadFestivalsForYear",
	"readFestivalsYearRange":           "ReadFestivalsYearRange",
	"readMoonPhasesForDate":            "ReadMoonPhasesForDate",
	"readMoonPhasesForYear":            "ReadMoonPhasesForYear",
	"readMoonPhasesYearRange":          "ReadMoonPhasesYearRange",
	"readMuhurtaForDate":               "ReadMuhurtaForDate",
	"readMuhurtaForYear":               "ReadMuhurtaForYear",
	"readMuhurtaOccasion":              "ReadMuhurtaOccasion",
	"readMuhurtaYearRange":             "ReadMuhurtaYearRange",
	"referenceLocation":                "ReferenceLocation",
	"resolveLocation":                  "ResolveLocation",
	"scoreMuhurta":                     "(*Session).ScoreMuhurta",
	"seemanthamRule":                   "SeemanthamRule",
	"shopOpeningRule":                  "ShopOpeningRule",
	"travelStartRule":                  "TravelStartRule",
	"upanayanamRule":                   "UpanayanamRule",
	"vahanKharidiRule":                 "VahanKharidiRule",
	"vidyarambhRule":                   "VidyarambhRule",
	"vivahRule":                        "VivahRule",
}

var deprecated = map[string]string{
	"getEclipsesForDate":      "readEclipsesForDate",
	"getEclipsesForYear":      "readEclipsesForYear",
	"getEclipsesInRange":      "computeEclipsesInRange",
	"getEclipsesYearRange":    "readEclipsesYearRange",
	"getEkadashiDatesForYear": "computeEkadashiDatesForYear",
	"getFestivalsForDate":     "readFestivalsForDate",
	"getFestivalsForYear":     "readFestivalsForYear",
	"getFestivalsInRange":     "computeFestivalsInRange",
	"getFestivalsYearRange":   "readFestivalsYearRange",
	"getMoonPhasesForDate":    "readMoonPhasesForDate",
	"getMoonPhasesForYear":    "readMoonPhasesForYear",
	"getMoonPhasesYearRange":  "readMoonPhasesYearRange",
	"getSankrantisForYear":    "computeSankrantisForYear",
}
