package panchang

import (
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
)

func TestFacadeCoverage(t *testing.T) {
	all := parseBarrelExports(t)
	if len(all) < 100 {
		t.Fatalf("parsed %d exports from src/index.ts; the parser is broken, and every check below would pass vacuously", len(all))
	}

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
			t.Errorf("src/index.ts exports %s and this test classifies it as neither covered nor deprecated. Add it to one", ts)
		}
	}
	inBarrel := map[string]bool{}
	for _, ts := range all {
		inBarrel[ts] = true
	}
	for ts := range known {
		if !inBarrel[ts] {
			t.Errorf("%s is classified here but src/index.ts no longer exports it. Remove it", ts)
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

func TestCoveredNamesExist(t *testing.T) {
	src, err := os.ReadFile(repopath.Go("panchang", "panchang.go"))
	if err != nil {
		t.Fatal(err)
	}
	text := regexp.MustCompile(`[ \t]+`).ReplaceAllString(string(src), " ")
	for ts, goName := range covered {
		var want string
		switch {
		case strings.HasPrefix(goName, "(*Session)."):
			want = "func (s *Session) " + strings.TrimPrefix(goName, "(*Session).") + "("
		case strings.HasPrefix(goName, "type "):
			want = strings.TrimPrefix(goName, "type ") + " = "
		case strings.HasPrefix(goName, "const "):
			want = strings.TrimPrefix(goName, "const ") + " = "
		default:
			want = "func " + goName + "("
		}
		if !strings.Contains(text, want) {
			t.Errorf("%s maps to %s, but panchang.go declares no %q", ts, goName, want)
		}
	}
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

var covered = map[string]string{
	"ALL_SAHAM_NAMES":                  "AllSahamNames",
	"ASHTOTTARI_ORDER":                 "AshtottariOrder",
	"ASHTOTTARI_YEARS":                 "AshtottariYears",
	"MODERN_REFERENCE":                 "ModernReference",
	"CHARA_RASHI_YEARS":                "CharaRashiYears",
	"GRAHA_ABBR":                       "GrahaAbbr",
	"IST_OFFSET_MINUTES":               "const ISTOffsetMinutes",
	"IST_TIMEZONE":                     "const ISTTimezone",
	"PanchangError":                    "type Error",
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
	"getEclipsesInRange":      "computeEclipsesInRange",
	"getEkadashiDatesForYear": "computeEkadashiDatesForYear",
	"getFestivalsInRange":     "computeFestivalsInRange",
	"getSankrantisForYear":    "computeSankrantisForYear",
}
