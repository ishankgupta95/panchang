package core

import (
	"encoding/json"
	"errors"
	"math"
	"strconv"
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

var testPune = types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
var testIST = types.TimezoneOffset(330)

func dailyOpts() PanchangOptions {
	return PanchangOptions{Timezone: testIST}
}

var testNatal = NatalResolvers{}

func mustDaily(t *testing.T, dateMs int64, loc types.GeoLocation, opts PanchangOptions) types.DailyPanchangResult {
	t.Helper()
	r, ok, err := GetDailyPanchang(&astronomy.EphemerisCtx{}, dateMs, loc, opts, testNatal)
	if err != nil {
		t.Fatalf("GetDailyPanchang: %v", err)
	}
	if !ok {
		t.Fatalf("GetDailyPanchang returned no result for %s", types.Date(dateMs).ISOString())
	}
	return r
}

func TestDailyPanchangInvariants(t *testing.T) {
	base := types.DateUTC(2025, 0, 1).Ms() + 6*3600_000
	const days = 120

	for i := 0; i < days; i++ {
		r := mustDaily(t, base+int64(i)*86_400_000, testPune, dailyOpts())
		day := types.Date(r.Date.Ms()).ISOString()[:10]

		if !(r.Sun.Rise.Ms() < r.Sun.Set.Ms() && r.Sun.Set.Ms() < r.Sun.NextRise.Ms()) {
			t.Fatalf("%s: sunrise %d, sunset %d, nextRise %d out of order",
				day, r.Sun.Rise.Ms(), r.Sun.Set.Ms(), r.Sun.NextRise.Ms())
		}
		if r.Sun.DayDurationMinutes != r.Sun.DinamanaMinutes ||
			r.Sun.NightDurationMinutes != r.Sun.RatrimanaMinutes {
			t.Errorf("%s: dinamana/ratrimana are not aliases of day/night duration", day)
		}

		for _, arm := range []struct {
			name  string
			n     int
			max   int
			first bool
		}{
			{"tithis", len(r.Angas.Tithis), utils.MaxDailyTithis, r.Angas.Tithis[0].IsActiveAtSunrise},
			{"nakshatras", len(r.Angas.Nakshatras), utils.MaxDailyNakshatras, r.Angas.Nakshatras[0].IsActiveAtSunrise},
			{"yogas", len(r.Angas.Yogas), utils.MaxDailyYogas, r.Angas.Yogas[0].IsActiveAtSunrise},
			{"karanas", len(r.Angas.Karanas), utils.MaxDailyKaranas, r.Angas.Karanas[0].IsActiveAtSunrise},
		} {
			if arm.n < 1 || arm.n > arm.max {
				t.Errorf("%s: %d %s, want 1..%d", day, arm.n, arm.name, arm.max)
			}
			if !arm.first {
				t.Errorf("%s: %s[0] is not active at sunrise", day, arm.name)
			}
		}

		checkTiling(t, day, "tithis", r.Sun.Rise.Ms(), r.Sun.NextRise.Ms(), tithiBounds(r))
		checkTiling(t, day, "nakshatras", r.Sun.Rise.Ms(), r.Sun.NextRise.Ms(), nakshatraBounds(r))
		checkTiling(t, day, "yogas", r.Sun.Rise.Ms(), r.Sun.NextRise.Ms(), yogaBounds(r))
		checkTiling(t, day, "karanas", r.Sun.Rise.Ms(), r.Sun.NextRise.Ms(), karanaBounds(r))

		checkSlotCoverage(t, day, "choghadiya", r.Sun.Rise.Ms(), r.Sun.Set.Ms(), r.Sun.NextRise.Ms(),
			choghadiyaBounds(r.Periods.Choghadiya.Day), choghadiyaBounds(r.Periods.Choghadiya.Night), 8)
		checkSlotCoverage(t, day, "hora", r.Sun.Rise.Ms(), r.Sun.Set.Ms(), r.Sun.NextRise.Ms(),
			horaBounds(r.Periods.Hora.Day), horaBounds(r.Periods.Hora.Night), 12)
		checkSlotCoverage(t, day, "gowri", r.Sun.Rise.Ms(), r.Sun.Set.Ms(), r.Sun.NextRise.Ms(),
			gowriBounds(r.Periods.Gowri.Day), gowriBounds(r.Periods.Gowri.Night), 8)
		checkSlotCoverage(t, day, "doGhati", r.Sun.Rise.Ms(), r.Sun.Set.Ms(), r.Sun.NextRise.Ms(),
			doGhatiBounds(r.Muhurtas.DoGhati.Day), doGhatiBounds(r.Muhurtas.DoGhati.Night), 15)

		if (r.Muhurtas.Abhijit == nil) != (r.Angas.Vara.Index == 3) {
			t.Errorf("%s: abhijit present=%v on vara %d", day, r.Muhurtas.Abhijit != nil, r.Angas.Vara.Index)
		}

		wantOffset := "+05:30"
		for _, s := range []string{r.Sun.RiseLocal, r.Sun.SetLocal, r.Sun.NextRiseLocal,
			r.Muhurtas.Brahma.StartLocal, r.Inauspicious.RahuKalam.EndLocal} {
			if !strings.HasSuffix(s, wantOffset) {
				t.Errorf("%s: %q does not carry %s", day, s, wantOffset)
			}
		}
	}
}

type bounds struct{ start, end *int64 }

func tithiBounds(r types.DailyPanchangResult) []bounds {
	out := make([]bounds, 0, len(r.Angas.Tithis))
	for _, e := range r.Angas.Tithis {
		out = append(out, bounds{msOf(e.StartTime), msOf(e.EndTime)})
	}
	return out
}
func nakshatraBounds(r types.DailyPanchangResult) []bounds {
	out := make([]bounds, 0, len(r.Angas.Nakshatras))
	for _, e := range r.Angas.Nakshatras {
		out = append(out, bounds{msOf(e.StartTime), msOf(e.EndTime)})
	}
	return out
}
func yogaBounds(r types.DailyPanchangResult) []bounds {
	out := make([]bounds, 0, len(r.Angas.Yogas))
	for _, e := range r.Angas.Yogas {
		out = append(out, bounds{msOf(e.StartTime), msOf(e.EndTime)})
	}
	return out
}
func karanaBounds(r types.DailyPanchangResult) []bounds {
	out := make([]bounds, 0, len(r.Angas.Karanas))
	for _, e := range r.Angas.Karanas {
		out = append(out, bounds{msOf(e.StartTime), msOf(e.EndTime)})
	}
	return out
}

func msOf(d *types.JSDate) *int64 {
	if d == nil {
		return nil
	}
	v := d.Ms()
	return &v
}

func checkTiling(t *testing.T, day, name string, sunrise, nextSunrise int64, bs []bounds) {
	t.Helper()
	if len(bs) == 0 {
		t.Fatalf("%s: no %s", day, name)
	}
	if bs[0].start == nil || *bs[0].start > sunrise {
		t.Errorf("%s: first %s starts after sunrise", day, name)
	}
	for i := 1; i < len(bs); i++ {
		if bs[i-1].end == nil || bs[i].start == nil {
			t.Fatalf("%s: %s[%d] has a nil bound with end-times on", day, name, i)
		}
		if *bs[i].start != *bs[i-1].end+1 {
			t.Errorf("%s: %s[%d] starts at %d, previous ended at %d",
				day, name, i, *bs[i].start, *bs[i-1].end)
		}
	}
	last := bs[len(bs)-1]
	if last.end == nil || *last.end != nextSunrise {
		t.Errorf("%s: last %s ends at %v, want next sunrise %d", day, name, last.end, nextSunrise)
	}
}

func choghadiyaBounds(in []types.ChoghadiyaSlot) []bounds {
	out := make([]bounds, 0, len(in))
	for i := range in {
		s, e := in[i].Start.Ms(), in[i].End.Ms()
		out = append(out, bounds{&s, &e})
	}
	return out
}
func horaBounds(in []types.HoraSlot) []bounds {
	out := make([]bounds, 0, len(in))
	for i := range in {
		s, e := in[i].Start.Ms(), in[i].End.Ms()
		out = append(out, bounds{&s, &e})
	}
	return out
}
func gowriBounds(in []types.GowriSlot) []bounds {
	out := make([]bounds, 0, len(in))
	for i := range in {
		s, e := in[i].Start.Ms(), in[i].End.Ms()
		out = append(out, bounds{&s, &e})
	}
	return out
}
func doGhatiBounds(in []types.DoGhatiSlot) []bounds {
	out := make([]bounds, 0, len(in))
	for i := range in {
		s, e := in[i].Start.Ms(), in[i].End.Ms()
		out = append(out, bounds{&s, &e})
	}
	return out
}

func checkSlotCoverage(t *testing.T, day, name string, sunrise, sunset, nextSunrise int64,
	dayS, nightS []bounds, want int) {
	t.Helper()
	for _, arm := range []struct {
		half       string
		s          []bounds
		from, upto int64
	}{{"day", dayS, sunrise, sunset}, {"night", nightS, sunset, nextSunrise}} {
		if len(arm.s) != want {
			t.Fatalf("%s: %s.%s has %d slots, want %d", day, name, arm.half, len(arm.s), want)
		}
		if *arm.s[0].start != arm.from {
			t.Errorf("%s: %s.%s starts at %d, want %d", day, name, arm.half, *arm.s[0].start, arm.from)
		}
		if *arm.s[len(arm.s)-1].end != arm.upto {
			t.Errorf("%s: %s.%s ends at %d, want %d", day, name, arm.half,
				*arm.s[len(arm.s)-1].end, arm.upto)
		}
		for i := 1; i < len(arm.s); i++ {
			if *arm.s[i].start != *arm.s[i-1].end {
				t.Errorf("%s: %s.%s slot %d does not abut its predecessor", day, name, arm.half, i)
			}
		}
	}
}

func TestNarrowingIsOutputNeutral(t *testing.T) {
	base := types.DateUTC(2025, 2, 10).Ms() + 6*3600_000
	narrowed := 0
	for i := 0; i < 40; i++ {
		ms := base + int64(i)*86_400_000
		full := mustDaily(t, ms, testPune, dailyOpts())

		narrow := mustDaily(t, ms, testPune, PanchangOptions{
			Timezone: testIST, Sections: NoSections(), SectionsGiven: true,
		})
		narrowed++

		for _, arm := range []struct {
			name string
			a, b any
		}{
			{"sun", full.Sun, narrow.Sun},
			{"angas", full.Angas, narrow.Angas},
			{"calendar", full.Calendar, narrow.Calendar},
			{"periods", full.Periods, narrow.Periods},
			{"ayanamsa", full.Ayanamsa, narrow.Ayanamsa},
			{"anandadiYoga", full.AnandadiYoga, narrow.AnandadiYoga},
			{"specialYogas", full.SpecialYogas, narrow.SpecialYogas},
			{"muhurtas", full.Muhurtas, narrow.Muhurtas},
		} {
			ja, err := json.Marshal(arm.a)
			if err != nil {
				t.Fatal(err)
			}
			jb, err := json.Marshal(arm.b)
			if err != nil {
				t.Fatal(err)
			}
			if string(ja) != string(jb) {
				t.Errorf("day %d %s differs between a full and a narrowed run:\n full   %s\n narrow %s",
					i, arm.name, ja, jb)
			}
		}

		if narrow.Moon.Rise != nil || narrow.Moon.Set != nil {
			t.Errorf("day %d: narrowed run published moon times", i)
		}
		if narrow.Eclipse != nil {
			t.Errorf("day %d: narrowed run published an eclipse", i)
		}
		if narrow.Inauspicious.Bhadra != nil {
			t.Errorf("day %d: narrowed run published a bhadra window", i)
		}
		for _, arm := range []struct {
			name string
			v    any
		}{
			{"varjyam", narrow.Inauspicious.Varjyam},
			{"panchakaRahita", narrow.Inauspicious.PanchakaRahita},
			{"festivals", narrow.Festivals},
		} {
			b, err := json.Marshal(arm.v)
			if err != nil {
				t.Fatal(err)
			}
			if string(b) != "[]" {
				t.Errorf("day %d: narrowed %s marshalled as %s, want [] (docs/porting.md §1.9)", i, arm.name, b)
			}
		}
	}
	if narrowed == 0 {
		t.Fatal("no narrowed run was made")
	}
}

func TestOptionDefaultsAreTheTypeScripts(t *testing.T) {
	ms := types.DateUTC(2025, 0, 14).Ms() + 6*3600_000

	deflt := mustDaily(t, ms, testPune, dailyOpts())
	if deflt.Angas.Tithis[0].EndTime == nil {
		t.Error("D9: the default run computed no end times; `computeEndTimes` must default to true")
	}
	off := false
	explicitOff := mustDaily(t, ms, testPune, PanchangOptions{
		Timezone:               testIST,
		InstantPanchangOptions: InstantPanchangOptions{ComputeEndTimes: &off},
	})
	if explicitOff.Angas.Tithis[0].EndTime != nil {
		t.Error("D9: computeEndTimes=false still computed end times")
	}
	for _, c := range []struct {
		name       string
		on, offVal any
	}{
		{"tithi", deflt.Angas.Tithis[0], explicitOff.Angas.Tithis[0]},
		{"nakshatra", deflt.Angas.Nakshatras[0], explicitOff.Angas.Nakshatras[0]},
		{"yoga", deflt.Angas.Yogas[0], explicitOff.Angas.Yogas[0]},
		{"karana", deflt.Angas.Karanas[0], explicitOff.Angas.Karanas[0]},
	} {
		onKeys := marshalledKeys(t, c.on)
		offKeys := marshalledKeys(t, c.offVal)
		if len(onKeys) == 0 {
			t.Fatalf("%s: no keys marshalled; the comparison below would be vacuous", c.name)
		}
		if strings.Join(onKeys, ",") != strings.Join(offKeys, ",") {
			t.Errorf("%s: computeEndTimes on/off publish different key orders\n"+
				"  on:  %v\n  off: %v", c.name, onKeys, offKeys)
		}
	}

	if !AllSections().Wants(SectionFestivals) {
		t.Error("D10: AllSections must want every section")
	}
	if NoSections().Wants(SectionFestivals) {
		t.Error("D10: NoSections must want none")
	}
	if (SectionSet{}).Wants(SectionEclipse) {
		t.Error("D10: the zero SectionSet must want nothing: it is the 'narrowed to " +
			"nothing' value, and PanchangOptions.SectionsGiven is what says whether " +
			"the caller narrowed at all")
	}
	notGiven := mustDaily(t, ms, testPune, PanchangOptions{Timezone: testIST})
	if notGiven.Moon.Rise == nil {
		t.Error("D10: SectionsGiven=false must mean all sections, so moon times are present")
	}

	withoutJanma := mustDaily(t, ms, testPune, dailyOpts())
	if withoutJanma.ChandraBalam != nil || withoutJanma.Tarabala != nil {
		t.Error("D11: chandraBalam/tarabala present without janmaRashi/janmaNakshatra")
	}
	var cbCalls, tbCalls int
	var cbJanma, cbTransit, tbJanma, tbTransit int
	rec := NatalResolvers{
		ChandraBalam: func(janma, transit int, lang types.Language) (types.ChandraBalamInfo, error) {
			cbCalls++
			cbJanma, cbTransit = janma, transit
			return types.ChandraBalamInfo{House: 7, Quality: types.ChandraBalamStrong}, nil
		},
		Tarabala: func(janma, transit int, lang types.Language) (types.TarabalaInfo, error) {
			tbCalls++
			tbJanma, tbTransit = janma, transit
			return types.TarabalaInfo{TaraIndex: 3}, nil
		},
	}

	zero := 0
	zeroOpts := PanchangOptions{
		Timezone: testIST,
		InstantPanchangOptions: InstantPanchangOptions{
			JanmaRashi: &zero, JanmaNakshatra: &zero,
		},
	}
	withZero, ok, err := GetDailyPanchang(&astronomy.EphemerisCtx{}, ms, testPune, zeroOpts, rec)
	if err != nil || !ok {
		t.Fatalf("D11: janmaRashi=0 daily: ok=%v err=%v", ok, err)
	}
	if withZero.ChandraBalam == nil || withZero.Tarabala == nil {
		t.Fatal("D11: janmaRashi=0 / janmaNakshatra=0 were treated as absent; this is " +
			"the exact bug the pointer types exist to prevent, and index 0 is Mesha " +
			"and Ashwini, not 'unset'")
	}
	if cbCalls != 1 || tbCalls != 1 {
		t.Fatalf("D11: resolvers called %d/%d times, want 1/1", cbCalls, tbCalls)
	}
	if cbJanma != 0 || tbJanma != 0 {
		t.Errorf("D11: resolvers received janma indices %d/%d, want 0/0; a Go zero "+
			"value reaching them as 'absent' is the whole hazard", cbJanma, tbJanma)
	}
	if cbTransit != withZero.Moon.Rashi.Index {
		t.Errorf("D11: chandraBalam transit rashi %d, want %d", cbTransit, withZero.Moon.Rashi.Index)
	}
	if want := utils.NakshatraOf(withZero.Moon.SiderealLongitude); tbTransit != want {
		t.Errorf("D11: tarabala transit nakshatra %d, want %d", tbTransit, want)
	}

	if _, _, err := GetDailyPanchang(&astronomy.EphemerisCtx{}, ms, testPune, zeroOpts,
		NatalResolvers{Tarabala: rec.Tarabala}); !errors.Is(err, errMissingChandraBalam) {
		t.Errorf("nil ChandraBalam with janmaRashi set: err = %v, want errMissingChandraBalam", err)
	}
	if _, _, err := GetDailyPanchang(&astronomy.EphemerisCtx{}, ms, testPune, zeroOpts,
		NatalResolvers{ChandraBalam: rec.ChandraBalam}); !errors.Is(err, errMissingTarabala) {
		t.Errorf("nil Tarabala with janmaNakshatra set: err = %v, want errMissingTarabala", err)
	}
	if _, _, err := GetDailyPanchang(&astronomy.EphemerisCtx{}, ms, testPune, dailyOpts(),
		NatalResolvers{}); err != nil {
		t.Errorf("nil resolvers without the options: err = %v, want nil", err)
	}
}

func TestPolarDayReturnsNoResultNotAnError(t *testing.T) {
	longyearbyen := types.GeoLocation{Latitude: 78.2232, Longitude: 15.6267}
	tz := types.TimezoneOffset(60)

	noResult, results := 0, 0
	for _, window := range []int64{
		types.DateUTC(2025, 5, 15).Ms(),  // midnight sun
		types.DateUTC(2025, 11, 15).Ms(), // polar night
		types.DateUTC(2025, 3, 15).Ms(),  // shoulder
	} {
		for i := 0; i < 12; i++ {
			ms := window + int64(i)*86_400_000
			r, ok, err := GetDailyPanchang(&astronomy.EphemerisCtx{}, ms, longyearbyen,
				PanchangOptions{Timezone: tz}, testNatal)
			if err != nil {
				t.Fatalf("%s: polar day returned an error rather than ok=false: %v",
					types.Date(ms).ISOString()[:10], err)
			}
			if !ok {
				noResult++
				continue
			}
			results++
			if r.Sun.Rise.Ms() >= r.Sun.Set.Ms() {
				t.Errorf("%s: polar day produced sunrise >= sunset", types.Date(ms).ISOString()[:10])
			}
		}
	}
	if noResult == 0 {
		t.Error("no polar day returned ok=false: the midnight-sun and polar-night " +
			"windows should produce some")
	}
	if results == 0 {
		t.Error("every polar day returned ok=false: the shoulder window should produce results")
	}
	t.Logf("polar: %d days with no Hindu day, %d with one", noResult, results)
}

func TestInvalidInputsAreErrors(t *testing.T) {
	ms := types.DateUTC(2025, 0, 14).Ms()
	for _, c := range []struct {
		name string
		loc  types.GeoLocation
	}{
		{"latitude out of range", types.GeoLocation{Latitude: 91, Longitude: 0}},
		{"longitude out of range", types.GeoLocation{Latitude: 0, Longitude: 181}},
		{"NaN latitude", types.GeoLocation{Latitude: math.NaN(), Longitude: 0}},
	} {
		if _, ok, err := GetDailyPanchang(&astronomy.EphemerisCtx{}, ms, c.loc,
			dailyOpts(), testNatal); err == nil {
			t.Errorf("%s: accepted (ok=%v)", c.name, ok)
		}
		if _, ok, err := GetInstantPanchang(&astronomy.EphemerisCtx{}, ms, c.loc,
			InstantPanchangOptions{}, testNatal); err == nil {
			t.Errorf("%s (instant): accepted (ok=%v)", c.name, ok)
		}
	}
}

func TestDailyPanchangIsRaceFreeAndDeterministic(t *testing.T) {
	base := types.DateUTC(2025, 6, 1).Ms() + 6*3600_000
	const days = 24
	locations := []types.GeoLocation{
		{Latitude: 18.5204, Longitude: 73.8567},
		{Latitude: 40.7128, Longitude: -74.0060},
		{Latitude: 64.1466, Longitude: -21.9426},
	}

	serial := make([]string, 0, days*len(locations))
	for _, loc := range locations {
		for i := 0; i < days; i++ {
			r := mustDaily(t, base+int64(i)*86_400_000, loc, dailyOpts())
			b, err := json.Marshal(r)
			if err != nil {
				t.Fatal(err)
			}
			serial = append(serial, string(b))
		}
	}

	const goroutines = 8
	got := make([][]string, goroutines)
	errs := make([]error, goroutines)
	done := make(chan int, goroutines)
	for g := 0; g < goroutines; g++ {
		go func(g int) {
			defer func() { done <- g }()
			out := make([]string, 0, days*len(locations))
			for _, loc := range locations {
				for i := 0; i < days; i++ {
					k := (i + g*3) % days
					r, ok, err := GetDailyPanchang(&astronomy.EphemerisCtx{},
						base+int64(k)*86_400_000, loc, dailyOpts(), testNatal)
					if err != nil || !ok {
						errs[g] = err
						return
					}
					b, err := json.Marshal(r)
					if err != nil {
						errs[g] = err
						return
					}
					out = append(out, string(b))
				}
			}
			got[g] = out
		}(g)
	}
	for i := 0; i < goroutines; i++ {
		<-done
	}

	for g := 0; g < goroutines; g++ {
		if errs[g] != nil {
			t.Fatalf("goroutine %d: %v", g, errs[g])
		}
		idx := 0
		for l := range locations {
			for i := 0; i < days; i++ {
				k := (i + g*3) % days
				if got[g][idx] != serial[l*days+k] {
					t.Fatalf("goroutine %d, location %d, day %d: concurrent result differs from serial",
						g, l, k)
				}
				idx++
			}
		}
	}
}

type endTimeFixture struct {
	Date     string `json:"date"`
	City     string `json:"city"`
	Location struct {
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	} `json:"location"`
	Timezone int `json:"timezone"`
	Expected struct {
		TithiEnd     string `json:"tithiEndHHMM"`
		NakshatraEnd string `json:"nakshatraEndHHMM"`
		YogaEnd      string `json:"yogaEndHHMM"`
		KaranaEnd    string `json:"karanaEndHHMM"`
	} `json:"expected"`
}

func TestDriftDoesNotGrowWithAyanamsaExposure(t *testing.T) {
	b, err := repopath.ReadTestData("almanac", "almanac-verified.json")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var fixtures []endTimeFixture
	if err := json.Unmarshal(b, &fixtures); err != nil {
		t.Fatalf("parse fixture: %v", err)
	}

	var elongation, ayanamsa []float64
	used := 0
	for _, f := range fixtures {
		if f.Expected.TithiEnd == "" {
			continue
		}
		used++
		y, m, d := splitISODate(t, f.Date)
		noonUtc := types.DateUTC(y, m-1, d).Ms() + 12*3600_000
		r, ok, err := GetDailyPanchang(&astronomy.EphemerisCtx{}, noonUtc,
			types.GeoLocation{Latitude: f.Location.Latitude, Longitude: f.Location.Longitude},
			PanchangOptions{Timezone: types.TimezoneOffset(f.Timezone)}, testNatal)
		if err != nil {
			t.Fatalf("%s %s: %v", f.Date, f.City, err)
		}
		if !ok {
			continue
		}

		push := func(bucket *[]float64, local *string, expected string) {
			if local == nil || expected == "" {
				return
			}
			*bucket = append(*bucket,
				math.Abs(secondsFromLocalMidnight(t, *local, f.Date)-almanacSeconds(t, expected)))
		}
		push(&elongation, r.Angas.Tithis[0].EndTimeLocal, f.Expected.TithiEnd)
		push(&elongation, r.Angas.Karanas[0].EndTimeLocal, f.Expected.KaranaEnd)
		push(&ayanamsa, r.Angas.Nakshatras[0].EndTimeLocal, f.Expected.NakshatraEnd)
		push(&ayanamsa, r.Angas.Yogas[0].EndTimeLocal, f.Expected.YogaEnd)
	}

	if used == 0 {
		t.Fatal("no fixture carried published end times: the audit is a no-op, which " +
			"is exactly how this check silently died once before")
	}
	if len(elongation) == 0 || len(ayanamsa) == 0 {
		t.Fatalf("one bucket is empty: %d elongation, %d ayanamsa; the ratio is "+
			"meaningless without both", len(elongation), len(ayanamsa))
	}

	meanElongation := mean(elongation)
	meanAyanamsa := mean(ayanamsa)
	ratio := meanAyanamsa / meanElongation

	if meanElongation >= 60 {
		t.Errorf("elongation-based mean drift %.1f s should stay within the search "+
			"tolerance band (60 s)", meanElongation)
	}
	if ratio >= 1.0 {
		t.Errorf("ayanamsa-exposed mean %.1f s vs ayanamsa-free %.1f s, ratio %.2f. "+
			"A ratio above 1 means drift grows with ayanamsa exposure, which is the "+
			"signature of the Lahiri constant having moved away from the reference almanac's.",
			meanAyanamsa, meanElongation, ratio)
	}
	t.Logf("ayanamsa exposure: elongation-free mean %.1f s (n=%d), exposed mean %.1f s (n=%d), "+
		"ratio %.2f (bound 1.00)", meanElongation, len(elongation), meanAyanamsa, len(ayanamsa), ratio)
}

func mean(xs []float64) float64 {
	var s float64
	for _, x := range xs {
		s += x
	}
	return s / float64(len(xs))
}

func splitISODate(t *testing.T, s string) (y, m, d int) {
	t.Helper()
	parts := strings.Split(s, "-")
	if len(parts) != 3 {
		t.Fatalf("bad fixture date %q", s)
	}
	var err error
	if y, err = strconv.Atoi(parts[0]); err != nil {
		t.Fatal(err)
	}
	if m, err = strconv.Atoi(parts[1]); err != nil {
		t.Fatal(err)
	}
	if d, err = strconv.Atoi(parts[2]); err != nil {
		t.Fatal(err)
	}
	return y, m, d
}

func almanacSeconds(t *testing.T, hhmm string) float64 {
	t.Helper()
	nextDay := strings.HasSuffix(hhmm, "+1")
	core := hhmm
	if nextDay {
		core = hhmm[:len(hhmm)-2]
	}
	parts := strings.Split(core, ":")
	if len(parts) != 2 {
		t.Fatalf("bad almanac time %q", hhmm)
	}
	h, err := strconv.Atoi(parts[0])
	if err != nil {
		t.Fatal(err)
	}
	m, err := strconv.Atoi(parts[1])
	if err != nil {
		t.Fatal(err)
	}
	base := 0.0
	if nextDay {
		base = 86_400
	}
	return base + float64(h)*3600 + float64(m)*60 + 30
}

func secondsFromLocalMidnight(t *testing.T, local, dateStr string) float64 {
	t.Helper()
	localDay, err := types.ParseISODay(local[:10])
	if err != nil {
		t.Fatalf("bad local date in %q: %v", local, err)
	}
	refDay, err := types.ParseISODay(dateStr)
	if err != nil {
		t.Fatalf("bad fixture date %q: %v", dateStr, err)
	}
	dayDelta := float64((localDay - refDay) / 86_400_000)
	h, err := strconv.Atoi(local[11:13])
	if err != nil {
		t.Fatal(err)
	}
	m, err := strconv.Atoi(local[14:16])
	if err != nil {
		t.Fatal(err)
	}
	sec, err := strconv.Atoi(local[17:19])
	if err != nil {
		t.Fatal(err)
	}
	return dayDelta*86_400 + float64(h)*3600 + float64(m)*60 + float64(sec)
}
