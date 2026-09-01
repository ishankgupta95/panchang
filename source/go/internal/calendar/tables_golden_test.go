package calendar

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/tablejson"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

type tblCase struct {
	Key         string   `json:"key"`
	Latitude    float64  `json:"latitude"`
	Longitude   float64  `json:"longitude"`
	Tz          int      `json:"tz"`
	StartYear   int      `json:"startYear"`
	EndYear     int      `json:"endYear"`
	Languages   []string `json:"languages"`
	VisibleOnly *bool    `json:"visibleOnly"`
}

type tblEntryKeys struct {
	FestivalDict          []string `json:"festivalDict"`
	EclipseEntry          []string `json:"eclipseEntry"`
	EclipseEntryWithSutak []string `json:"eclipseEntryWithSutak"`
	PhaseDict             []string `json:"phaseDict"`
}

type tblResult struct {
	Key          string                    `json:"key"`
	Sha256       map[string]string         `json:"sha256"`
	Sha256Masked map[string]string         `json:"sha256Masked"`
	Bytes        map[string]int            `json:"bytes"`
	MetaKeys     map[string][]string       `json:"metaKeys"`
	EntryKeys    tblEntryKeys              `json:"entryKeys"`
	DictLengths  map[string]int            `json:"dictLengths"`
	DayCounts    map[string]map[string]int `json:"dayCounts"`
}

type tablesGolden struct {
	Meta struct {
		Claim string `json:"claim"`
	} `json:"_meta"`
	Cases   []tblCase      `json:"cases"`
	Digest  string         `json:"digest"`
	TblHits map[string]int `json:"tblHits"`
	Tables  []tblResult    `json:"tables"`
}

func loadTablesGolden(t *testing.T) tablesGolden {
	t.Helper()
	raw, err := repopath.ReadTestData("goldens", "calendar", "tables-golden.json")
	if err != nil {
		t.Fatalf("reading tables-golden.json: %v", err)
	}
	var g tablesGolden
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatalf("parsing tables-golden.json: %v", err)
	}
	if len(g.Cases) == 0 || len(g.Tables) == 0 {
		t.Fatalf("golden is empty: %d cases", len(g.Cases))
	}
	return g
}

func (c tblCase) geo() types.GeoLocation {
	return types.GeoLocation{Latitude: c.Latitude, Longitude: c.Longitude}
}

func (c tblCase) langs() []FestivalsTableLanguage {
	if c.Languages == nil {
		return nil
	}
	out := make([]FestivalsTableLanguage, len(c.Languages))
	for i, l := range c.Languages {
		out[i] = FestivalsTableLanguage(l)
	}
	return out
}

const tblPinnedGeneratedAt = "2026-08-23T00:00:00.000Z"

func TestTablesAreByteIdenticalToTypeScript(t *testing.T) {
	g := loadTablesGolden(t)
	byKey := map[string]tblResult{}
	for _, r := range g.Tables {
		byKey[r.Key] = r
	}

	for _, c := range g.Cases {
		want, ok := byKey[c.Key]
		if !ok {
			t.Fatalf("golden has no result for %q", c.Key)
		}
		ctx := &astronomy.EphemerisCtx{}

		festivals, err := BuildFestivalsTable(ctx, BuildFestivalsTableOptions{
			Location: c.geo(), TimezoneOffsetMinutes: c.Tz,
			StartYear: c.StartYear, EndYear: c.EndYear, Languages: c.langs(),
			ReferenceLocation: c.Key, GeneratedAt: tblPinnedGeneratedAt,
		})
		if err != nil {
			t.Fatalf("%s festivals: %v", c.Key, err)
		}
		eclipses, err := BuildEclipsesTable(ctx, BuildEclipsesTableOptions{
			Location: c.geo(), TimezoneOffsetMinutes: c.Tz,
			StartYear: c.StartYear, EndYear: c.EndYear, Languages: c.langs(),
			VisibleOnly:       c.VisibleOnly,
			ReferenceLocation: c.Key, GeneratedAt: tblPinnedGeneratedAt,
		})
		if err != nil {
			t.Fatalf("%s eclipses: %v", c.Key, err)
		}
		phases, err := BuildMoonPhasesTable(ctx, BuildMoonPhasesTableOptions{
			TimezoneOffsetMinutes: c.Tz,
			StartYear:             c.StartYear, EndYear: c.EndYear, Languages: c.langs(),
			ReferenceLocation: c.Key, GeneratedAt: tblPinnedGeneratedAt,
		})
		if err != nil {
			t.Fatalf("%s moonPhases: %v", c.Key, err)
		}

		for _, f := range []struct {
			name  string
			file  any
			exact bool
		}{
			{"festivals", festivals, true},
			{"eclipses", eclipses, false},
			{"moonPhases", phases, true},
		} {
			raw, err := tablejson.Marshal(f.file)
			if err != nil {
				t.Fatalf("%s %s: %v", c.Key, f.name, err)
			}
			sum := sha256.Sum256(raw)
			got := hex.EncodeToString(sum[:])
			maskedSum := sha256.Sum256(maskEclipseFloats(raw))
			gotMasked := hex.EncodeToString(maskedSum[:])

			if gotMasked != want.Sha256Masked[f.name] {
				t.Errorf("%s %s: bytes differ outside the two float leaves\n  want %s\n  got  %s",
					c.Key, f.name, want.Sha256Masked[f.name], gotMasked)
				reportFirstByteDifference(t, c.Key+" "+f.name, raw, want.Bytes[f.name])
			}
			if f.exact {
				if got != want.Sha256[f.name] {
					t.Errorf("%s %s: NOT byte-identical\n  want sha %s (%d bytes)\n  got  sha %s (%d bytes)",
						c.Key, f.name, want.Sha256[f.name], want.Bytes[f.name], got, len(raw))
					reportFirstByteDifference(t, c.Key+" "+f.name, raw, want.Bytes[f.name])
				}
				if len(raw) != want.Bytes[f.name] {
					t.Errorf("%s %s: want %d bytes, got %d", c.Key, f.name, want.Bytes[f.name], len(raw))
				}
			} else if got == want.Sha256[f.name] && len(raw) != want.Bytes[f.name] {
				t.Errorf("%s %s: sha matches but length does not", c.Key, f.name)
			}
			if got := objectKeyOrder(t, raw, "_meta"); strings.Join(got, ",") !=
				strings.Join(want.MetaKeys[f.name], ",") {
				t.Errorf("%s %s _meta key order:\n  want %v\n  got  %v",
					c.Key, f.name, want.MetaKeys[f.name], got)
			}
		}

		if len(festivals.Dict) != want.DictLengths["festivals"] {
			t.Errorf("%s: want %d festival dict entries, got %d",
				c.Key, want.DictLengths["festivals"], len(festivals.Dict))
		}
		if len(phases.Dict) != want.DictLengths["moonPhases"] {
			t.Errorf("%s: want %d phase dict entries, got %d",
				c.Key, want.DictLengths["moonPhases"], len(phases.Dict))
		}
		for year, n := range want.DayCounts["festivals"] {
			if got := len(festivals.Years[year]); got != n {
				t.Errorf("%s festivals %s: want %d days, got %d", c.Key, year, n, got)
			}
		}
		for year, n := range want.DayCounts["eclipses"] {
			if got := len(eclipses.Years[year]); got != n {
				t.Errorf("%s eclipses %s: want %d days, got %d", c.Key, year, n, got)
			}
		}
		for year, n := range want.DayCounts["moonPhases"] {
			if got := len(phases.Years[year]); got != n {
				t.Errorf("%s moonPhases %s: want %d days, got %d", c.Key, year, n, got)
			}
		}
	}
}

func maskEclipseFloats(raw []byte) []byte {
	return magnitudePattern.ReplaceAll(
		obscurationPattern.ReplaceAll(raw, []byte("${1}<float>")),
		[]byte("${1}<float>"))
}

var (
	obscurationPattern = regexp.MustCompile(`("obscuration": )-?[0-9.eE+-]+`)
	magnitudePattern   = regexp.MustCompile(`("magnitude": )-?[0-9.eE+-]+`)
)

func TestEclipseTableFloatsAreWithinTheNumericBand(t *testing.T) {
	g := loadTablesGolden(t)
	closestTie := 1.0
	entries := 0

	for _, c := range g.Cases {
		ctx := &astronomy.EphemerisCtx{}
		eclipses, err := BuildEclipsesTable(ctx, BuildEclipsesTableOptions{
			Location: c.geo(), TimezoneOffsetMinutes: c.Tz,
			StartYear: c.StartYear, EndYear: c.EndYear, Languages: c.langs(),
			VisibleOnly:       c.VisibleOnly,
			ReferenceLocation: c.Key, GeneratedAt: tblPinnedGeneratedAt,
		})
		if err != nil {
			t.Fatal(err)
		}
		for _, days := range eclipses.Years {
			for _, d := range days {
				for _, e := range d.Eclipses {
					entries++
					if e.Obscuration < -1 || e.Obscuration > 1.0000001 {
						t.Errorf("%s: obscuration %v is outside [0, 1]", c.Key, e.Obscuration)
					}
					if e.Subtype == EclipsePenumbral {
						continue
					}
					x := e.Obscuration * 100
					dist := math.Abs(x - math.Floor(x) - 0.5)
					if dist < closestTie {
						closestTie = dist
					}
				}
			}
		}
	}
	if entries == 0 {
		t.Fatal("no eclipse entries in the sweep")
	}
	const maxPerturbationPercentagePoints = 1.5e-12
	if closestTie <= maxPerturbationPercentagePoints {
		t.Errorf("an obscuration came within %g of a Math.round tie, which is "+
			"inside the %g the float divergence can move it, so the rendered "+
			"percentage in `description` could now flip",
			closestTie, maxPerturbationPercentagePoints)
	}
	t.Logf("%d eclipse entries; closest approach to a Math.round tie is %g, "+
		"%.3g times the largest perturbation the float divergence can produce",
		entries, closestTie, closestTie/maxPerturbationPercentagePoints)
}

func TestTableEntryKeyOrderMatchesInsertionOrder(t *testing.T) {
	g := loadTablesGolden(t)
	byKey := map[string]tblResult{}
	for _, r := range g.Tables {
		byKey[r.Key] = r
	}
	checkedSutak := 0

	for _, c := range g.Cases {
		want := byKey[c.Key]
		ctx := &astronomy.EphemerisCtx{}
		festivals, err := BuildFestivalsTable(ctx, BuildFestivalsTableOptions{
			Location: c.geo(), TimezoneOffsetMinutes: c.Tz,
			StartYear: c.StartYear, EndYear: c.EndYear, Languages: c.langs(),
			ReferenceLocation: c.Key, GeneratedAt: tblPinnedGeneratedAt,
		})
		if err != nil {
			t.Fatal(err)
		}
		eclipses, err := BuildEclipsesTable(ctx, BuildEclipsesTableOptions{
			Location: c.geo(), TimezoneOffsetMinutes: c.Tz,
			StartYear: c.StartYear, EndYear: c.EndYear, Languages: c.langs(),
			VisibleOnly:       c.VisibleOnly,
			ReferenceLocation: c.Key, GeneratedAt: tblPinnedGeneratedAt,
		})
		if err != nil {
			t.Fatal(err)
		}
		phases, err := BuildMoonPhasesTable(ctx, BuildMoonPhasesTableOptions{
			TimezoneOffsetMinutes: c.Tz,
			StartYear:             c.StartYear, EndYear: c.EndYear, Languages: c.langs(),
			ReferenceLocation: c.Key, GeneratedAt: tblPinnedGeneratedAt,
		})
		if err != nil {
			t.Fatal(err)
		}

		if want.EntryKeys.FestivalDict != nil && len(festivals.Dict) > 0 {
			raw, _ := tablejson.Marshal(festivals.Dict[0])
			got := objectKeyOrder(t, raw, "")
			if strings.Join(got, ",") != strings.Join(want.EntryKeys.FestivalDict, ",") {
				t.Errorf("%s festival dict entry key order:\n  want %v\n  got  %v",
					c.Key, want.EntryKeys.FestivalDict, got)
			}
		}
		if want.EntryKeys.PhaseDict != nil && len(phases.Dict) > 0 {
			raw, _ := tablejson.Marshal(phases.Dict[0])
			got := objectKeyOrder(t, raw, "")
			if strings.Join(got, ",") != strings.Join(want.EntryKeys.PhaseDict, ",") {
				t.Errorf("%s phase dict entry key order:\n  want %v\n  got  %v",
					c.Key, want.EntryKeys.PhaseDict, got)
			}
		}
		for _, withSutak := range []bool{true, false} {
			wantKeys := want.EntryKeys.EclipseEntry
			if withSutak {
				wantKeys = want.EntryKeys.EclipseEntryWithSutak
			}
			entry, found := firstEclipseEntry(eclipses, withSutak)
			if wantKeys == nil {
				if found {
					t.Errorf("%s: golden has no eclipse entry with sutak=%v but Go produced one",
						c.Key, withSutak)
				}
				continue
			}
			if !found {
				t.Errorf("%s: want an eclipse entry with sutak=%v, Go produced none", c.Key, withSutak)
				continue
			}
			raw, _ := tablejson.Marshal(entry)
			got := objectKeyOrder(t, raw, "")
			if strings.Join(got, ",") != strings.Join(wantKeys, ",") {
				t.Errorf("%s eclipse entry (sutak=%v) key order:\n  want %v\n  got  %v",
					c.Key, withSutak, wantKeys, got)
			}
			if withSutak {
				checkedSutak++
				di, si := indexOf(got, "description"), indexOf(got, "sutak")
				if di < 0 || si < 0 || si < di {
					t.Errorf("%s: sutak must follow description (description at %d, sutak at %d)",
						c.Key, di, si)
				}
			}
		}
	}
	if checkedSutak == 0 {
		t.Fatal("no eclipse entry in the sweep carried a sutak, so the key-order " +
			"trap this test exists for was never checked")
	}
}

func indexOf(xs []string, want string) int {
	for i, x := range xs {
		if x == want {
			return i
		}
	}
	return -1
}

func firstEclipseEntry(file EclipsesFile, withSutak bool) (EclipseTableEntryRaw, bool) {
	years := make([]string, 0, len(file.Years))
	for k := range file.Years {
		years = append(years, k)
	}
	sortStrings(years)
	for _, y := range years {
		for _, d := range file.Years[y] {
			for _, e := range d.Eclipses {
				if withSutak == (e.Sutak != nil) {
					return e, true
				}
			}
		}
	}
	return EclipseTableEntryRaw{}, false
}

func sortStrings(xs []string) {
	for i := 1; i < len(xs); i++ {
		v := xs[i]
		j := i - 1
		for j >= 0 && xs[j] > v {
			xs[j+1] = xs[j]
			j--
		}
		xs[j+1] = v
	}
}

func objectKeyOrder(t *testing.T, raw []byte, field string) []string {
	t.Helper()
	body := raw
	if field != "" {
		var doc map[string]json.RawMessage
		if err := json.Unmarshal(raw, &doc); err != nil {
			t.Fatalf("re-parsing: %v", err)
		}
		body = doc[field]
	}
	dec := json.NewDecoder(strings.NewReader(string(body)))
	tok, err := dec.Token()
	if err != nil {
		t.Fatalf("reading %q: %v", field, err)
	}
	if d, ok := tok.(json.Delim); !ok || d != '{' {
		t.Fatalf("%q is not an object", field)
	}
	var keys []string
	for dec.More() {
		k, err := dec.Token()
		if err != nil {
			t.Fatalf("reading keys: %v", err)
		}
		keys = append(keys, k.(string))
		var v json.RawMessage
		if err := dec.Decode(&v); err != nil {
			t.Fatalf("skipping a value: %v", err)
		}
	}
	return keys
}

func reportFirstByteDifference(t *testing.T, label string, got []byte, wantLen int) {
	t.Helper()
	t.Logf("%s: Go produced %d bytes against the TypeScript's %d (Δ %+d)",
		label, len(got), wantLen, len(got)-wantLen)
	const window = 200
	if len(got) > window {
		t.Logf("%s: first %d bytes of the Go output:\n%s", label, window, got[:window])
	}
}

func TestTableReadersMatchTypeScript(t *testing.T) {
	g := loadTablesGolden(t)
	hits := map[string]int{}
	for k := range g.TblHits {
		hits[k] = 0
	}

	for _, c := range g.Cases {
		ctx := &astronomy.EphemerisCtx{}
		festivals, err := BuildFestivalsTable(ctx, BuildFestivalsTableOptions{
			Location: c.geo(), TimezoneOffsetMinutes: c.Tz,
			StartYear: c.StartYear, EndYear: c.EndYear, Languages: c.langs(),
			ReferenceLocation: c.Key, GeneratedAt: tblPinnedGeneratedAt,
		})
		if err != nil {
			t.Fatal(err)
		}
		eclipses, err := BuildEclipsesTable(ctx, BuildEclipsesTableOptions{
			Location: c.geo(), TimezoneOffsetMinutes: c.Tz,
			StartYear: c.StartYear, EndYear: c.EndYear, Languages: c.langs(),
			VisibleOnly:       c.VisibleOnly,
			ReferenceLocation: c.Key, GeneratedAt: tblPinnedGeneratedAt,
		})
		if err != nil {
			t.Fatal(err)
		}
		phases, err := BuildMoonPhasesTable(ctx, BuildMoonPhasesTableOptions{
			TimezoneOffsetMinutes: c.Tz,
			StartYear:             c.StartYear, EndYear: c.EndYear, Languages: c.langs(),
			ReferenceLocation: c.Key, GeneratedAt: tblPinnedGeneratedAt,
		})
		if err != nil {
			t.Fatal(err)
		}
		anyF, anyP := festivals.AsAny(), phases.AsAny()

		for _, lang := range []FestivalsTableLanguage{TableLangEn, TableLangHi} {
			for yy := c.StartYear; yy <= c.EndYear; yy++ {
				if days, ok := ReadEclipsesForYear(eclipses, yy, lang); ok && len(days) == 0 {
					hits["emptyEclipseYears"]++
				}
			}
			if fd, ok := ReadFestivalsForYear(anyF, c.StartYear, lang); ok {
				hits["festivalDays"] += len(fd)
				for _, d := range fd {
					for _, f := range d.Festivals {
						hits["festivalEntries"]++
						if f.HasDescription {
							hits["festivalWithDescription"]++
						}
						if c.Languages != nil && !containsLang(c.Languages, string(lang)) {
							hits["pickFallback"]++
						}
					}
				}
			}
			if ed, ok := ReadEclipsesForYear(eclipses, c.StartYear, lang); ok {
				hits["eclipseDays"] += len(ed)
				for _, d := range ed {
					for _, e := range d.Eclipses {
						hits["eclipseEntries"]++
						if e.Sutak != nil {
							hits["eclipseWithSutak"]++
						} else {
							hits["eclipseWithoutSutak"]++
						}
						if e.Subtype == EclipsePenumbral {
							hits["eclipsePenumbral"]++
						}
						if !e.VisibleFromLocation {
							hits["eclipseInvisible"]++
						}
					}
				}
			}
			if pd, ok := ReadMoonPhasesForYear(anyP, c.StartYear, lang); ok {
				hits["phaseDays"] += len(pd)
				for _, d := range pd {
					hits["phaseEntries"] += len(d.Phases)
				}
			}
		}
	}
	hits["v1Read"] = 1

	for k, want := range g.TblHits {
		if hits[k] != want {
			t.Errorf("arm %q: want %d, got %d", k, want, hits[k])
		}
		if want == 0 {
			t.Errorf("arm %q was never reached by the golden's own sweep", k)
		}
	}
	for k, got := range hits {
		if _, ok := g.TblHits[k]; !ok {
			t.Errorf("arm %q: not in golden, got %d", k, got)
		}
	}
}

func containsLang(xs []string, want string) bool {
	for _, x := range xs {
		if x == want {
			return true
		}
	}
	return false
}

func TestV1TablesStillRead(t *testing.T) {
	const v1FestivalsJSON = `{
	  "_meta": {"referenceLocation":"v1","latitude":18.5204,"longitude":73.8567,
	    "timezoneOffsetMinutes":330,"ayanamsa":"lahiri","masaSystem":"purnimanta",
	    "region":"all","languages":["en","hi"],"startYear":2025,"endYear":2025,
	    "generatedAt":"2026-08-23T00:00:00.000Z","note":"v1 fixture"},
	  "years": {"2025": [
	    {"date":"2025-01-14","festivals":[
	      {"name":{"en":"Makar Sankranti","hi":"मकर संक्रांति"},"type":"sankranti",
	       "description":{"en":"Sun enters Capricorn.","hi":"सूर्य मकर राशि में।"}},
	      {"name":{"en":"Pongal"},"type":"major"}]},
	    {"date":"2025-03-14","festivals":[{"name":{"hi":"होली"},"type":"major"}]}]}
	}`
	var f AnyFestivalsFile
	if err := json.Unmarshal([]byte(v1FestivalsJSON), &f); err != nil {
		t.Fatalf("parsing the v1 festivals fixture: %v", err)
	}
	if f.IsPacked {
		t.Fatal("a file with no _dict must sniff as v1")
	}
	days, ok := ReadFestivalsForYear(f, 2025, TableLangEn)
	if !ok || len(days) != 2 {
		t.Fatalf("want 2 v1 days, got %d (ok=%v)", len(days), ok)
	}
	if days[0].Festivals[0].Key != "" {
		t.Errorf("a v1 entry must have an empty Key, got %q", days[0].Festivals[0].Key)
	}
	if days[0].Festivals[0].Name != "Makar Sankranti" {
		t.Errorf("v1 en name: got %q", days[0].Festivals[0].Name)
	}
	hiDays, _ := ReadFestivalsForYear(f, 2025, TableLangHi)
	if hiDays[0].Festivals[0].Name != "मकर संक्रांति" {
		t.Errorf("v1 hi name: got %q", hiDays[0].Festivals[0].Name)
	}
	if hiDays[0].Festivals[1].Name != "Pongal" {
		t.Errorf("the hi read of an en-only entry must fall back to en, got %q",
			hiDays[0].Festivals[1].Name)
	}
	if enDays, _ := ReadFestivalsForYear(f, 2025, TableLangEn); enDays[1].Festivals[0].Name != "होली" {
		t.Errorf("the en read of an hi-only entry must fall back to hi, got %q",
			enDays[1].Festivals[0].Name)
	}
	if _, ok := ReadFestivalsForYear(f, 2026, TableLangEn); ok {
		t.Error("2026 is out of the v1 table's range")
	}
	if got := ReadFestivalsForDateKey(f, "2025-01-14", TableLangEn); len(got) != 2 {
		t.Errorf("by-date on a v1 table: want 2, got %d", len(got))
	}

	const v1PhasesJSON = `{
	  "_meta": {"referenceLocation":"v1","timezoneOffsetMinutes":330,
	    "languages":["en","hi"],"startYear":2025,"endYear":2025,
	    "generatedAt":"2026-08-23T00:00:00.000Z","note":"v1 fixture"},
	  "years": {"2025": [
	    {"date":"2025-01-13","phases":[
	      {"name":{"en":"Full Moon","hi":"पूर्णिमा"},"phase":"full",
	       "time":"2025-01-13T22:26:00.000Z",
	       "description":{"en":"Full moon (Purnima).","hi":"पूर्णिमा: पूर्ण चंद्रमा।"}}]},
	    {"date":"2025-01-29","phases":[
	      {"name":{"hi":"अमावस्या"},"phase":"new","time":"2025-01-29T12:36:00.000Z"}]}]}
	}`
	var p AnyMoonPhasesFile
	if err := json.Unmarshal([]byte(v1PhasesJSON), &p); err != nil {
		t.Fatalf("parsing the v1 phases fixture: %v", err)
	}
	if p.IsPacked {
		t.Fatal("a phases file with no _dict must sniff as v1")
	}
	phases, ok := ReadMoonPhasesForYear(p, 2025, TableLangEn)
	if !ok || len(phases) != 2 {
		t.Fatalf("want 2 v1 phase days, got %d (ok=%v)", len(phases), ok)
	}
	if phases[0].Phases[0].Time != "2025-01-13T22:26:00.000Z" {
		t.Errorf("a v1 phase time must pass through verbatim, got %q", phases[0].Phases[0].Time)
	}
	if got := ReadMoonPhasesForDateKey(p, "2025-01-29", TableLangHi); len(got) != 1 ||
		got[0].Name != "अमावस्या" {
		t.Errorf("v1 by-date read: got %+v", got)
	}
}

func TestPackedAndV1ReadTheSameWayWhereTheyCan(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	f, err := BuildFestivalsTable(ctx, BuildFestivalsTableOptions{
		Location:              types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567},
		TimezoneOffsetMinutes: 330, StartYear: 2025, EndYear: 2025,
		GeneratedAt: tblPinnedGeneratedAt,
	})
	if err != nil {
		t.Fatal(err)
	}
	raw, err := tablejson.Marshal(f)
	if err != nil {
		t.Fatal(err)
	}
	var parsed AnyFestivalsFile
	if err := json.Unmarshal(raw, &parsed); err != nil {
		t.Fatal(err)
	}
	if !parsed.IsPacked {
		t.Fatal("a built table must sniff as v2")
	}
	direct, ok1 := ReadFestivalsForYear(f.AsAny(), 2025, TableLangEn)
	roundTripped, ok2 := ReadFestivalsForYear(parsed, 2025, TableLangEn)
	if !ok1 || !ok2 || len(direct) != len(roundTripped) {
		t.Fatalf("day counts differ: %d vs %d", len(direct), len(roundTripped))
	}
	for i := range direct {
		if direct[i].Date != roundTripped[i].Date ||
			len(direct[i].Festivals) != len(roundTripped[i].Festivals) {
			t.Fatalf("day %d differs after a JSON round trip", i)
		}
		for j := range direct[i].Festivals {
			if direct[i].Festivals[j] != roundTripped[i].Festivals[j] {
				t.Errorf("day %d festival %d differs:\n  direct %+v\n  parsed %+v",
					i, j, direct[i].Festivals[j], roundTripped[i].Festivals[j])
			}
		}
	}
	reparsed := FestivalsFile{Meta: parsed.Meta, Dict: parsed.Dict, Years: parsed.Packed}
	again, err := tablejson.Marshal(reparsed)
	if err != nil {
		t.Fatal(err)
	}
	if string(again) != string(raw) {
		t.Errorf("parse-and-re-emit is not byte-identical (%d vs %d bytes)",
			len(again), len(raw))
		for i := 0; i < len(raw) && i < len(again); i++ {
			if raw[i] != again[i] {
				lo := i - 60
				if lo < 0 {
					lo = 0
				}
				t.Errorf("first difference at byte %d:\n  want …%s…\n  got  …%s…",
					i, raw[lo:min(i+60, len(raw))], again[lo:min(i+60, len(again))])
				break
			}
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

var _ = fmt.Sprintf
var _ = strconv.Itoa
