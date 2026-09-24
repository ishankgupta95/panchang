package panchang

import (
	"context"
	"errors"
	"fmt"
	"math"
	"os"
	"reflect"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/ishankgupta95/panchang/source/go/v5/types"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/core"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/jyotish"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
)

var (
	pune = types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
	when = time.Date(2025, 7, 4, 0, 0, 0, 0, time.UTC)
)

func ist() types.PanchangOptions { return types.PanchangOptions{Timezone: OffsetMinutes(330)} }

func TestFacadeIsAFaithfulPassThrough(t *testing.T) {
	direct, directOK, directErr := core.GetDailyPanchang(
		astronomy.NewEphemerisCtx(), when.UnixMilli(), pune, ist(), jyotish.CoreNatalResolvers())
	if directErr != nil {
		t.Fatal(directErr)
	}

	viaFacade, ok, err := New().GetDailyPanchang(when, pune, ist())
	if err != nil {
		t.Fatal(err)
	}
	if ok != directOK {
		t.Fatalf("ok = %v, want %v", ok, directOK)
	}
	if !ok || len(viaFacade.Angas.Tithis) == 0 {
		t.Fatalf("no tithi in the result; the comparison below would be vacuous")
	}
	if viaFacade.Sun.Rise != direct.Sun.Rise || viaFacade.Sun.Set != direct.Sun.Set {
		t.Errorf("sunrise/sunset differ: %v/%v vs %v/%v",
			viaFacade.Sun.Rise, viaFacade.Sun.Set, direct.Sun.Rise, direct.Sun.Set)
	}
	if viaFacade.Angas.Tithis[0].Name != direct.Angas.Tithis[0].Name {
		t.Errorf("tithi = %q, want %q", viaFacade.Angas.Tithis[0].Name, direct.Angas.Tithis[0].Name)
	}
	if viaFacade.Ayanamsa != direct.Ayanamsa {
		t.Errorf("ayanamsa = %v, want %v", viaFacade.Ayanamsa, direct.Ayanamsa)
	}
}

func TestSessionReuseDoesNotChangeAnswers(t *testing.T) {
	s := New()
	first, _, err := s.GetDailyPanchang(when, pune, ist())
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.GetDailyPanchang(when.AddDate(0, 0, 1), pune, ist()); err != nil {
		t.Fatal(err)
	}
	again, _, err := s.GetDailyPanchang(when, pune, ist())
	if err != nil {
		t.Fatal(err)
	}
	if again.Sun.Rise != first.Sun.Rise || again.Sun.Set != first.Sun.Set {
		t.Errorf("a warm Session answered differently: %v/%v vs %v/%v",
			again.Sun.Rise, again.Sun.Set, first.Sun.Rise, first.Sun.Set)
	}

	s.Reset()
	afterReset, _, err := s.GetDailyPanchang(when, pune, ist())
	if err != nil {
		t.Fatal(err)
	}
	if afterReset.Sun.Rise != first.Sun.Rise {
		t.Errorf("Reset changed the answer: %v vs %v", afterReset.Sun.Rise, first.Sun.Rise)
	}
}

func TestSessionsAreIndependent(t *testing.T) {
	a, _, err := New().GetDailyPanchang(when, pune, ist())
	if err != nil {
		t.Fatal(err)
	}
	b, _, err := New().GetDailyPanchang(when, pune, ist())
	if err != nil {
		t.Fatal(err)
	}
	if a.Sun.Rise != b.Sun.Rise {
		t.Errorf("two Sessions disagree: %v vs %v", a.Sun.Rise, b.Sun.Rise)
	}
}

func TestPackageLevelFunctionsNeedNoSession(t *testing.T) {
	ay, err := ComputeAyanamsa(when, types.Lahiri)
	if err != nil {
		t.Fatal(err)
	}
	if ay < 23 || ay > 25 {
		t.Errorf("ayanamsa = %v, outside a sane 2025 range", ay)
	}
	if got := FormatInZone(when, 330); got != "2025-07-04T05:30:00.000+05:30" {
		t.Errorf("FormatInZone = %q", got)
	}
	if n := len(AllAyanamsaTypes()); n != 5 {
		t.Errorf("AllAyanamsaTypes = %d, want 5", n)
	}
}

func TestAllAyanamsaTypesIsACopy(t *testing.T) {
	first := AllAyanamsaTypes()
	first[0] = "tampered"
	if AllAyanamsaTypes()[0] != types.Lahiri {
		t.Error("AllAyanamsaTypes returns the shared table, not a copy")
	}
}

func TestEveryWiringPathIsExercised(t *testing.T) {
	s := New()
	day, ok, err := s.GetDailyPanchang(when, pune, ist())
	if err != nil || !ok {
		t.Fatalf("daily panchang: ok=%v err=%v", ok, err)
	}
	sunrise, sunset := day.Sun.Rise, day.Sun.Set

	t.Run("astronomy", func(t *testing.T) {
		got, err := s.ComputeSunrise(when, pune, 2)
		if err != nil {
			t.Fatal(err)
		}
		if got != sunrise {
			t.Errorf("ComputeSunrise = %v, day says %v", got, sunrise)
		}
		if _, _, err := s.GetMoonrise(when, pune, 2); err != nil {
			t.Error(err)
		}
		lon, err := s.GetSiderealMoonLongitude(when, types.Lahiri)
		if err != nil || lon < 0 || lon >= 360 {
			t.Errorf("sidereal moon = %v, err=%v", lon, err)
		}
	})

	t.Run("core", func(t *testing.T) {
		rk := ComputeRahuKalam(sunriseTime(sunrise), sunriseTime(sunset), int(day.Angas.Vara.Index))
		if want := (sunset.Ms() - sunrise.Ms()) / 8; rk.EndMs-rk.StartMs != want {
			t.Errorf("rahu kalam width = %d ms, want %d", rk.EndMs-rk.StartMs, want)
		}
		if rk.StartMs < sunrise.Ms() || rk.EndMs > sunset.Ms() {
			t.Errorf("rahu kalam %d..%d falls outside the day %d..%d", rk.StartMs, rk.EndMs, sunrise.Ms(), sunset.Ms())
		}
		if _, err := ComputeGandaMula(0, types.LanguageEn); err != nil {
			t.Error(err)
		}
	})

	t.Run("jyotish", func(t *testing.T) {
		chart, err := s.ComputeRashiChart(when, pune, types.BirthChartOptions{})
		if err != nil {
			t.Fatal(err)
		}
		if len(chart.Planets) == 0 {
			t.Fatal("no planets; the checks below would be vacuous")
		}
		if _, err := s.ComputeShadbala(when, pune, types.BirthChartOptions{}); err != nil {
			t.Error(err)
		}
		if _, err := ComputeJaiminiKarakas(&chart); err != nil {
			t.Error(err)
		}
		atBirth, err := ComputeVimshottariDasha(when, 100, when)
		if err != nil {
			t.Fatal(err)
		}
		if atBirth.CurrentIndex != 0 {
			t.Errorf("dasha at birth: currentIndex = %d, want 0", atBirth.CurrentIndex)
		}
		later, err := ComputeVimshottariDasha(when, 100, when.AddDate(40, 0, 0))
		if err != nil {
			t.Fatal(err)
		}
		if later.CurrentIndex == 0 {
			t.Error("dasha 40 years on still reports the first mahadasha; asOf is being ignored")
		}
	})

	t.Run("calendar", func(t *testing.T) {
		if _, err := s.ComputeSamvat(when); err != nil {
			t.Error(err)
		}
		if _, err := s.GetKaliYugaYear(when); err != nil {
			t.Error(err)
		}
	})

	t.Run("muhurta", func(t *testing.T) {
		if _, err := ComputeVaraTithiYogas(int(day.Angas.Vara.Index), day.Angas.Tithis[0].Index); err != nil {
			t.Error(err)
		}
		if n := len(StockMuhurtaRules()); n != 13 {
			t.Errorf("stock rules = %d, want 13", n)
		}
		if r, ok := MuhurtaRuleFor("vivah"); !ok || r.Occasion == "" {
			t.Errorf("MuhurtaRuleFor(vivah) = %+v, ok=%v", r, ok)
		}
		if VivahRule().Occasion != "vivah" {
			t.Errorf("VivahRule() = %q", VivahRule().Occasion)
		}
	})

	t.Run("constant tables", func(t *testing.T) {
		if n := len(GrahaAbbr()); n != 9 {
			t.Errorf("GrahaAbbr = %d entries, want 9", n)
		}
		if AshtottariYears() == ([9]float64{}) {
			t.Error("AshtottariYears is all zero")
		}
		var sum float64
		for _, y := range YoginiYears() {
			sum += y
		}
		if sum != 36 {
			t.Errorf("Yogini years sum to %v, want 36", sum)
		}
	})
}

func sunriseTime(d types.JSDate) time.Time { return time.UnixMilli(d.Ms()) }

func TestGetEclipseDuringDayZeroLongitudesMeansTheEphemeris(t *testing.T) {
	s := New()
	sunrise := time.Date(2025, 3, 29, 1, 0, 0, 0, time.UTC) // solar eclipse day
	next := sunrise.Add(24 * time.Hour)
	gotZero, okZero := s.GetEclipseDuringDay(sunrise, next, pune, types.LanguageEn, types.SyzygyLongitudes{})
	gotExpl, okExpl := s.GetEclipseDuringDay(sunrise, next, pune, types.LanguageEn,
		astronomy.DirectLongitudes(s.eph))
	if okZero != okExpl || gotZero != gotExpl {
		t.Errorf("zero-value longitudes (%v, %v) != explicit DirectLongitudes (%v, %v)",
			gotZero, okZero, gotExpl, okExpl)
	}
}

func TestStockRuleAccessorsReturnIndependentCopies(t *testing.T) {
	accessors := map[string]func() types.MuhurtaRule{
		"vivah": VivahRule, "grihaPravesh": GrihaPraveshRule,
		"namakarana": NamakaranaRule, "vidyarambh": VidyarambhRule,
		"vahanKharidi": VahanKharidiRule, "annaprashan": AnnaprashanRule,
		"mundan": MundanRule, "upanayanam": UpanayanamRule,
		"karnavedha": KarnavedhaRule, "aksharabhyasam": AksharabhyasamRule,
		"seemantham": SeemanthamRule, "shopOpening": ShopOpeningRule,
		"travelStart": TravelStartRule,
	}
	for occasion, fn := range accessors {
		r := fn()
		if r.Occasion != occasion {
			t.Errorf("%sRule().Occasion = %q, want %q", occasion, r.Occasion, occasion)
		}
	}
	a := VivahRule()
	if len(a.AuspiciousTithis) == 0 {
		t.Fatal("vivah rule has no auspicious tithis; the mutation probe below would be vacuous")
	}
	a.AuspiciousTithis[0] = -99
	if b := VivahRule(); b.AuspiciousTithis[0] == -99 {
		t.Error("mutating a returned rule's slice reached the package's own table")
	}
	if all := StockMuhurtaRules(); all[0].AuspiciousTithis[0] == -99 {
		t.Error("the mutation reached StockMuhurtaRules' backing table")
	}
}

// TestContextTwinsStopOnACancelledContext checks that every Context method
// returns the context's error before doing any work, so a caller can abandon a
// long walk. The inputs are deliberately zero values: the context is checked
// ahead of validation, so nothing else should be reported.
func TestContextTwinsStopOnACancelledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	s := New()
	var geo types.GeoLocation
	calls := map[string]func() error{
		"BuildFestivalsTableContext": func() error {
			_, err := s.BuildFestivalsTableContext(ctx, types.BuildFestivalsTableOptions{})
			return err
		},
		"BuildEclipsesTableContext": func() error {
			_, err := s.BuildEclipsesTableContext(ctx, types.BuildEclipsesTableOptions{})
			return err
		},
		"BuildMoonPhasesTableContext": func() error {
			_, err := s.BuildMoonPhasesTableContext(ctx, types.BuildMoonPhasesTableOptions{})
			return err
		},
		"BuildMuhurtaTableContext": func() error {
			_, err := s.BuildMuhurtaTableContext(ctx, types.BuildMuhurtaTableOptions{})
			return err
		},
		"ComputeAuspiciousDatesForYearContext": func() error {
			_, err := s.ComputeAuspiciousDatesForYearContext(ctx, 2025, types.MuhurtaRule{}, geo, types.MuhurtaScoreOptions{})
			return err
		},
		"ComputeAuspiciousDatesInRangeContext": func() error {
			_, err := s.ComputeAuspiciousDatesInRangeContext(ctx, types.MuhurtaRule{}, when, when, geo, types.MuhurtaScoreOptions{})
			return err
		},
		"ComputeEclipsesForYearContext": func() error {
			_, err := s.ComputeEclipsesForYearContext(ctx, 2025, geo, OffsetMinutes(330))
			return err
		},
		"ComputeEclipsesInRangeContext": func() error {
			_, err := s.ComputeEclipsesInRangeContext(ctx, when, when, geo)
			return err
		},
		"ComputeEkadashiDatesForYearContext": func() error {
			_, err := s.ComputeEkadashiDatesForYearContext(ctx, 2025, geo, types.YearlyListingOptions{})
			return err
		},
		"ComputeFestivalsForYearContext": func() error {
			_, err := s.ComputeFestivalsForYearContext(ctx, 2025, geo, types.YearlyListingOptions{})
			return err
		},
		"ComputeFestivalsInRangeContext": func() error {
			_, err := s.ComputeFestivalsInRangeContext(ctx, when, when, geo, types.YearlyListingOptions{})
			return err
		},
		"ComputeMoonPhasesForYearContext": func() error {
			_, err := s.ComputeMoonPhasesForYearContext(ctx, 2025, types.MoonPhasesForYearOptions{})
			return err
		},
		"ComputeMoonPhasesInRangeContext": func() error {
			_, err := s.ComputeMoonPhasesInRangeContext(ctx, when, when)
			return err
		},
		"GetUpcomingEclipsesContext": func() error {
			_, err := s.GetUpcomingEclipsesContext(ctx, when, geo, 0)
			return err
		},
		"ComputeSankrantisForYearContext": func() error {
			_, err := s.ComputeSankrantisForYearContext(ctx, 2025, geo, types.YearlyListingOptions{})
			return err
		},
	}
	for name, call := range calls {
		if err := call(); !errors.Is(err, context.Canceled) {
			t.Errorf("%s with a cancelled context returned %v, want context.Canceled", name, err)
		}
	}

	// The plain form is the Context form on context.Background: it must not be
	// affected by a cancelled context it never saw.
	if _, err := s.ComputeMoonPhasesInRange(when, when.Add(48*time.Hour)); err != nil {
		t.Errorf("plain form errored: %v", err)
	}
}

func TestOptionArmEntryPointsMatchTheirPlainTwins(t *testing.T) {
	s := New()
	if _, err := ComputeJaimini8Karakas(nil); !IsCode(err, types.ErrInvalidInput) {
		t.Errorf("ComputeJaimini8Karakas(nil) err = %v, want %s", err, types.ErrInvalidInput)
	}

	chart, err := s.ComputeRashiChart(when, pune, types.BirthChartOptions{})
	if err != nil {
		t.Fatal(err)
	}
	k7, err := ComputeJaiminiKarakas(&chart)
	if err != nil {
		t.Fatal(err)
	}
	k8, err := ComputeJaimini8Karakas(&chart)
	if err != nil {
		t.Fatal(err)
	}
	direct, err := jyotish.ComputeJaimini8Karakas(&chart)
	if err != nil || k8 != direct {
		t.Errorf("ComputeJaimini8Karakas = %+v, internal gives %+v (err %v)", k8, direct, err)
	}
	// Rahu is a different graha from the seven, so the eight roles fill with
	// eight distinct grahas, and the top role agrees with the seven-karaka
	// ranking unless Rahu takes it.
	used := map[types.Graha]bool{}
	for _, role := range AllKaraka8Names() {
		g, ok := k8.Get(role)
		if !ok || used[g] {
			t.Fatalf("role %s: graha %v (ok=%v) is missing or repeated in %+v", role, g, ok, k8)
		}
		used[g] = true
	}
	if k8.Atmakaraka != types.GrahaRahu && k8.Atmakaraka != k7.Atmakaraka {
		t.Errorf("Atmakaraka: 8-karaka %v, 7-karaka %v", k8.Atmakaraka, k7.Atmakaraka)
	}

	plain, err := s.ComputeSripatiLagna(when, pune, types.Lahiri, types.LanguageEn)
	if err != nil {
		t.Fatal(err)
	}
	withCusps, err := s.ComputeSripatiLagnaWithCusps(when, pune, types.Lahiri, types.LanguageEn)
	if err != nil {
		t.Fatal(err)
	}
	if withCusps.LagnaInfo != plain {
		t.Errorf("the lagna beside the cusps %+v differs from ComputeSripatiLagna %+v", withCusps.LagnaInfo, plain)
	}
	if len(withCusps.Cusps) != 12 || withCusps.Cusps[0] != plain.SiderealLongitude {
		t.Errorf("cusps = %v, want twelve starting at the ascendant %v", withCusps.Cusps, plain.SiderealLongitude)
	}
	if _, err := s.ComputeSripatiLagnaWithCusps(time.Date(1800, 1, 1, 0, 0, 0, 0, time.UTC), pune, "", ""); !IsCode(err, types.ErrInvalidDate) {
		t.Errorf("a birth in 1800 gave err %v, want %s", err, types.ErrInvalidDate)
	}
}

// tsUnion returns the quoted members of the first string literal union that
// follows anchor in a TypeScript source file, in declaration order.
func tsUnion(t *testing.T, file, anchor string) []string {
	t.Helper()
	b, err := os.ReadFile(repopath.Src(file))
	if err != nil {
		t.Fatal(err)
	}
	m := regexp.MustCompile(regexp.QuoteMeta(anchor) + `\s*((?:\|?\s*'[^']*'\s*)+)`).FindSubmatch(b)
	if m == nil {
		t.Fatalf("%s: no string union after %q", file, anchor)
	}
	var out []string
	for _, lit := range regexp.MustCompile(`'([^']*)'`).FindAllSubmatch(m[1], -1) {
		out = append(out, string(lit[1]))
	}
	return out
}

func strs[T ~string](v []T) []string {
	out := make([]string, len(v))
	for i, x := range v {
		out[i] = string(x)
	}
	return out
}

func TestNewAllAccessorsFollowTheTypeScriptUnions(t *testing.T) {
	cases := []struct {
		name       string
		got        func() []string
		file, from string
	}{
		{"AllMoonPhaseNames", func() []string { return strs(AllMoonPhaseNames()) },
			"astronomy/moonPhase.ts", "export type MoonPhaseName ="},
		{"AllMoonPhaseTableNames", func() []string { return strs(AllMoonPhaseTableNames()) },
			"calendar/moonPhasesTableTypes.ts", "export type MoonPhaseTableName ="},
		{"AllNodeAspects", func() []string { return strs(AllNodeAspects()) },
			"jyotish/aspects.ts", "nodeAspects?:"},
		{"AllReferences", func() []string { return strs(AllReferences()) },
			"core/defaultLocation.ts", "export type PanchangReference ="},
		{"AllYogaPolarities", func() []string { return strs(AllYogaPolarities()) },
			"muhurta/varaTithiYogas.ts", "polarity:"},
		{"AllNarayanDirections", func() []string { return strs(AllNarayanDirections()) },
			"jyotish/dasha.ts", "direction:"},
	}
	for _, c := range cases {
		want := tsUnion(t, c.file, c.from)
		first := c.got()
		if !reflect.DeepEqual(first, want) {
			t.Errorf("%s = %q, the TypeScript union in %s is %q", c.name, first, c.file, want)
		}
		first[0] = "tampered"
		if c.got()[0] == "tampered" {
			t.Errorf("%s returns a shared slice, not a fresh copy", c.name)
		}
	}

	// Karaka8Name is KarakaName plus Pitrukaraka in TypeScript, so the rank
	// order is checked instead: the seven-karaka roles with Pitrukaraka fifth.
	want := strs(AllKarakaNames())
	want = append(want[:4], append([]string{string(types.Pitrukaraka)}, want[4:]...)...)
	k8 := AllKaraka8Names()
	if !reflect.DeepEqual(strs(k8), want) {
		t.Errorf("AllKaraka8Names = %q, want %q", k8, want)
	}
	k8[0] = "tampered"
	if AllKaraka8Names()[0] != types.Karaka8Name(types.Atmakaraka) {
		t.Error("AllKaraka8Names returns the shared table, not a copy")
	}

	yogini := YoginiOrder()
	named := [8]types.YoginiName{types.YoginiMangala, types.YoginiPingala, types.YoginiDhanya,
		types.YoginiBhramari, types.YoginiBhadrika, types.YoginiUlka, types.YoginiSiddha, types.YoginiSankata}
	if yogini != named {
		t.Errorf("YoginiOrder() = %v, the YoginiName constants in order are %v", yogini, named)
	}
	if got, want := strs(yogini[:]), tsUnion(t, "jyotish/dasha.ts", "export type YoginiName ="); !reflect.DeepEqual(got, want) {
		t.Errorf("YoginiOrder() = %q, the TypeScript union is %q", got, want)
	}
}

func TestTableReadersDefaultToEnglishAndDateInTheTableOffset(t *testing.T) {
	name := types.LocalizedString{En: "Diwali", Hi: "दिवाली", HasEn: true, HasHi: true, HiFirst: true}
	desc := types.LocalizedString{En: "", HasEn: true}
	table := types.FestivalsFile{
		Meta: types.FestivalTableMeta{Format: 2, TimezoneOffsetMinutes: 330, StartYear: 2025, EndYear: 2025,
			Languages: []types.FestivalsTableLanguage{types.TableLangHi, types.TableLangEn}},
		Dict:  []types.FestivalDictEntry{{Key: "diwali", Name: name, Type: types.TableTypeMajor, Description: &desc}},
		Years: map[string][]types.PackedFestivalTableDay{"2025": {{Date: "2025-10-20", Festivals: []int{0, 7}}}},
	}
	read := table.AsAny()

	days, ok := ReadFestivalsForYear(read, 2025, "")
	if !ok || len(days) != 1 || len(days[0].Festivals) != 1 {
		t.Fatalf("ReadFestivalsForYear = %+v, ok=%v; want one day with the one in-range entry", days, ok)
	}
	got := days[0].Festivals[0]
	if got.Name != "Diwali" {
		t.Errorf("an empty lang read %q from a Hindi-first table; TypeScript defaults to English", got.Name)
	}
	if got.Description == nil || *got.Description != "" {
		t.Errorf("a present, empty description must read as a pointer to \"\", got %v", got.Description)
	}
	if hi := ReadFestivalsForDateKey(read, "2025-10-20", types.TableLangHi); len(hi) != 1 || hi[0].Name != "दिवाली" {
		t.Errorf("hi read = %+v", hi)
	}
	if _, ok := ReadFestivalsForYear(read, 2026, types.TableLangEn); ok {
		t.Error("a year the table lacks must report ok=false")
	}
	if r := ReadFestivalsYearRange(read); r != (types.TableYearRange{Start: 2025, End: 2025}) {
		t.Errorf("year range = %+v", r)
	}

	// 18:30 UTC on the 19th is midnight IST on the 20th; one millisecond
	// earlier is still the 19th at the table's offset.
	edge := time.Date(2025, 10, 19, 18, 30, 0, 0, time.UTC)
	if on := ReadFestivalsForDate(read, edge, ""); len(on) != 1 {
		t.Errorf("ReadFestivalsForDate at IST midnight = %+v, want Diwali", on)
	}
	if before := ReadFestivalsForDate(read, edge.Add(-time.Millisecond), ""); before == nil || len(before) != 0 {
		t.Errorf("ReadFestivalsForDate just before IST midnight = %#v, want an empty non-nil slice", before)
	}

	muh := types.MuhurtaFile{
		Meta: types.MuhurtaTableMeta{Format: 2, Occasion: "probe", TimezoneOffsetMinutes: 330, StartYear: 2025, EndYear: 2026},
		Dict: []types.MuhurtaFactor{{Code: "a"}},
		Years: map[string][]types.PackedMuhurtaTableDay{
			"2025": {{Date: "2025-10-20", S: 70, P: 1, F: []int{0}}},
			"2026": nil,
		},
	}
	if _, ok := ReadMuhurtaForYear(muh, 2026); ok {
		t.Error("a nil year slice is TypeScript's null and must report ok=false")
	}
	if day, ok := ReadMuhurtaForDate(muh, edge); !ok || day.Date != "2025-10-20" || len(day.Factors) != 1 {
		t.Errorf("ReadMuhurtaForDate = %+v, ok=%v", day, ok)
	}
	if best := ReadBestMuhurtaDays(muh, 0); best == nil || len(best) != 0 {
		t.Errorf("ReadBestMuhurtaDays(0) = %#v, want an empty non-nil slice", best)
	}
	if ReadMuhurtaOccasion(muh) != "probe" || ReadMuhurtaYearRange(muh) != (types.TableYearRange{Start: 2025, End: 2026}) {
		t.Error("the muhurta meta readers disagree with _meta")
	}

	ecl := types.EclipsesFile{
		Meta: types.EclipseTableMeta{TimezoneOffsetMinutes: 330, StartYear: 2025, EndYear: 2025},
		Years: map[string][]types.RawEclipseTableDay{"2025": {{Date: "2025-09-08", Eclipses: []types.EclipseTableEntryRaw{
			{Name: name, Kind: types.EclipseTableLunar, Subtype: types.EclipseTableTotal},
		}}}},
	}
	if e := ReadEclipsesForDate(ecl, time.Date(2025, 9, 7, 18, 30, 0, 0, time.UTC), ""); len(e) != 1 || e[0].Name != "Diwali" {
		t.Errorf("ReadEclipsesForDate = %+v", e)
	}
	moon := types.MoonPhasesFile{
		Meta:  types.MoonPhaseTableMeta{Format: 2, TimezoneOffsetMinutes: 330, StartYear: 2025, EndYear: 2025},
		Dict:  []types.MoonPhaseDictEntry{{Phase: types.PhaseNew, Name: name}},
		Years: map[string][]types.PackedMoonPhaseTableDay{"2025": {{Date: "2025-01-29", Phases: []types.PackedMoonPhaseEvent{{I: 0, T: 1738154040000}}}}},
	}
	if p := ReadMoonPhasesForDateKey(moon.AsAny(), "2025-01-29", ""); len(p) != 1 || p[0].Time != "2025-01-29T12:34:00.000Z" || p[0].Name != "Diwali" {
		t.Errorf("ReadMoonPhasesForDateKey = %+v", p)
	}
}

// The tests from here on feed the facade out-of-contract input. Each call must
// either apply the documented normalisation or return a coded error (or, with
// no error return, a named panic), never a runtime panic or a plausible wrong
// answer.

var (
	robustBirth = time.Date(2000, 1, 1, 6, 0, 0, 0, time.UTC)
	robustAsOf  = time.Date(2020, 6, 1, 0, 0, 0, 0, time.UTC)
)

func wantCode(t *testing.T, what string, err error, code types.ErrorCode) {
	t.Helper()
	if !IsCode(err, code) {
		t.Errorf("%s: err = %v, want code %s", what, err, code)
	}
}

func TestDashaMoonLongitudeIsWrappedOrRejected(t *testing.T) {
	vim := func(lon float64) (any, error) { return ComputeVimshottariDasha(robustBirth, lon, robustAsOf) }
	asht := func(lon float64) (any, error) { return ComputeAshtottariDasha(robustBirth, lon, robustAsOf) }
	yog := func(lon float64) (any, error) { return ComputeYoginiDasha(robustBirth, lon, robustAsOf) }
	for name, fn := range map[string]func(float64) (any, error){"vimshottari": vim, "ashtottari": asht, "yogini": yog} {
		for _, pair := range [][2]float64{{360, 0}, {720, 0}, {-0.5, 359.5}, {1e9, math.Mod(1e9, 360)}} {
			got, err := fn(pair[0])
			want, wantErr := fn(pair[1])
			if err != nil || wantErr != nil || !reflect.DeepEqual(got, want) {
				t.Errorf("%s(%v) = %v, %v; want the result for %v (%v)", name, pair[0], got, err, pair[1], wantErr)
			}
		}
		for _, lon := range []float64{math.NaN(), math.Inf(1), math.Inf(-1)} {
			_, err := fn(lon)
			wantCode(t, name, err, types.ErrInvalidInput)
		}
	}
}

func robustChart(t *testing.T) types.BirthChart {
	t.Helper()
	c, err := New().ComputeRashiChart(time.Date(1995, 6, 15, 5, 0, 0, 0, time.UTC),
		types.GeoLocation{Latitude: 28.6139, Longitude: 77.2090}, types.BirthChartOptions{})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

// withLagna copies the chart with its lagna rashi index replaced. Planets is
// cloned so no test shares a backing array with another.
func withLagna(c types.BirthChart, index int) types.BirthChart {
	c.Planets = append([]types.PlanetPlacement(nil), c.Planets...)
	c.Lagna.Rashi.Index = index
	return c
}

func TestYogasAndArudhasRejectABadLagnaInsteadOfPanicking(t *testing.T) {
	base := robustChart(t)
	for _, l := range []int{12, 13, -1, -12} {
		c := withLagna(base, l)
		_, err := ComputeYogas(&c, types.ComputeYogasOptions{})
		wantCode(t, "ComputeYogas", err, types.ErrInvalidInput)
	}
	for _, l := range []int{-1, -12} {
		c := withLagna(base, l)
		_, err := ComputeArudhas(&c, "")
		wantCode(t, "ComputeArudhas", err, types.ErrInvalidInput)
	}
	c12, c0 := withLagna(base, 12), withLagna(base, 0)
	got, err := ComputeArudhas(&c12, "")
	want, wantErr := ComputeArudhas(&c0, "")
	if err != nil || wantErr != nil || !reflect.DeepEqual(got, want) {
		t.Errorf("ComputeArudhas(lagna 12) = %v, %v; want the lagna 0 result %v", got, err, want)
	}
}

// TestVarjyamCallbacksOutsideTheContractMatchTypeScript pins the TypeScript
// results (the oracle) for a Moon that moves 0.55 degrees an hour from base
// without wrapping: a nakshatra read outside 0 to 26 contributes no spell.
func TestVarjyamCallbacksOutsideTheContractMatchTypeScript(t *testing.T) {
	sr := time.Date(2025, 3, 20, 0, 0, 0, 0, time.UTC)
	nsr := sr.Add(24 * time.Hour)
	linear := func(base float64) types.LongitudeAt {
		return func(ms int64) float64 { return base + float64(ms-sr.UnixMilli())/3600e3*0.55 }
	}
	cases := []struct {
		base           float64
		varjyam, amrit []types.UtcWindow
	}{
		{-10, []types.UtcWindow{}, []types.UtcWindow{}},
		{355, []types.UtcWindow{}, []types.UtcWindow{{StartMs: 1742452800002, EndMs: 1742458618182}}},
		{-3, []types.UtcWindow{}, []types.UtcWindow{{StartMs: 1742509527272, EndMs: 1742515345454}}},
		{5, []types.UtcWindow{{StartMs: 1742468800004, EndMs: 1742474618184}},
			[]types.UtcWindow{{StartMs: 1742457163644, EndMs: 1742462981824}}},
	}
	for _, c := range cases {
		if got := ComputeVarjyamWindows(sr, nsr, linear(c.base)); !reflect.DeepEqual(got, c.varjyam) {
			t.Errorf("ComputeVarjyamWindows(base %v) = %v, want %v", c.base, got, c.varjyam)
		}
		if got := ComputeAmritKalaWindows(sr, nsr, linear(c.base)); !reflect.DeepEqual(got, c.amrit) {
			t.Errorf("ComputeAmritKalaWindows(base %v) = %v, want %v", c.base, got, c.amrit)
		}
	}

	// A NaN Moon puts no nakshatra in force at sunrise, so ComputeVarjyam finds
	// no window for any index, as TypeScript's computeVarjyam returns null.
	nan := func(int64) float64 { return math.NaN() }
	if got := ComputeVarjyamWindows(sr, nsr, nan); len(got) != 0 {
		t.Errorf("ComputeVarjyamWindows(NaN) = %v, want none", got)
	}
	for _, idx := range []int{0, 16} {
		if w, ok, err := ComputeVarjyam(idx, sr, nsr, nan); ok || err != nil {
			t.Errorf("ComputeVarjyam(%d, NaN) = %v %v %v, want ok=false", idx, w, ok, err)
		}
	}

	_, _, err := ComputeVarjyam(3, sr, nsr, nil)
	wantCode(t, "ComputeVarjyam(nil getMoon)", err, types.ErrInvalidInput)
}

func TestFormatInZoneRendersEveryOffsetWithoutPanicking(t *testing.T) {
	at := time.UnixMilli(1736818784172)
	for off, want := range map[int]string{
		330:   "2025-01-14T07:09:44.172+05:30",
		3659:  "2025-01-16T14:38:44.172+60:59",
		3660:  "2025-01-16T14:39:44.172+61:00",
		-5000: "2025-01-10T14:19:44.172-83:20",
		19800: "2025-01-27T19:39:44.172+330:00",
	} {
		if got := FormatInZone(at, off); got != want {
			t.Errorf("FormatInZone(%d) = %q, want %q", off, got, want)
		}
	}
	shape := regexp.MustCompile(`[+-][0-9]{2,}:[0-5][0-9]$`)
	for _, off := range []int{math.MaxInt, math.MinInt, math.MinInt + 1} {
		if got := FormatInZone(at, off); !shape.MatchString(got) {
			t.Errorf("FormatInZone(%d) = %q, want a +HH:MM style offset", off, got)
		}
	}
}

// TestZeroSessionBehavesLikeNew calls methods that reach the ephemeris memo and
// the natal resolvers on a zero Session, declared and embedded, and expects
// exactly what New gives.
func TestZeroSessionBehavesLikeNew(t *testing.T) {
	when := time.Date(2025, 3, 20, 0, 0, 0, 0, time.UTC)
	pune := types.GeoLocation{Latitude: 18.52, Longitude: 73.85}
	janma := 3
	daily := types.PanchangOptions{
		Timezone:               OffsetMinutes(330),
		InstantPanchangOptions: types.InstantPanchangOptions{JanmaRashi: &janma, JanmaNakshatra: &janma},
	}
	calls := func(s *Session) []any {
		sun, err1 := s.GetSiderealSunLongitude(when, types.Lahiri)
		day, ok, err2 := s.GetDailyPanchang(when, pune, daily)
		chart, err3 := s.ComputeRashiChart(when, pune, types.BirthChartOptions{})
		rise, err4 := s.ComputeSunrise(when, pune, 2)
		inst, iok, err5 := s.GetInstantPanchang(when, pune, daily.InstantPanchangOptions)
		return []any{sun, err1, day, ok, err2, chart, err3, rise, err4, inst, iok, err5}
	}
	want := calls(New())
	var declared Session
	var embedded struct{ Session }
	var reset Session
	reset.Reset()
	for name, s := range map[string]*Session{"declared": &declared, "embedded": &embedded.Session, "reset": &reset} {
		if got := calls(s); !reflect.DeepEqual(got, want) {
			t.Errorf("zero Session (%s) differs from New()", name)
		}
	}
}

// TestAnnualChartsPastTheDateRangeAreInvalidDate covers the year ages whose
// search instant turns NaN or leaves the JavaScript Date range. TypeScript
// throws INVALID_DATE there; Go used to convert the NaN to a 1970 instant on
// arm64 and return a chart.
func TestAnnualChartsPastTheDateRangeAreInvalidDate(t *testing.T) {
	s := New()
	birth := time.Date(1990, 5, 17, 6, 0, 0, 0, time.UTC)
	pune := types.GeoLocation{Latitude: 18.52, Longitude: 73.85}
	for _, age := range []int{78615, 100000} {
		_, err := s.ComputeTithiPravesha(birth, age, pune, types.BirthChartOptions{})
		wantCode(t, "ComputeTithiPravesha", err, types.ErrInvalidDate)
	}
	_, err := s.ComputeVarshaphala(birth, 1000000, pune, types.BirthChartOptions{})
	wantCode(t, "ComputeVarshaphala", err, types.ErrInvalidDate)
	if _, err := s.ComputeTithiPravesha(birth, 35, pune, types.BirthChartOptions{}); err != nil {
		t.Errorf("ComputeTithiPravesha(35) = %v, want a chart", err)
	}
}

func TestKpInputsOutsideTheContract(t *testing.T) {
	for _, lon := range []float64{math.NaN(), math.Inf(1), math.Inf(-1)} {
		k := ComputeKpSubLord(lon)
		if !math.IsNaN(k.Longitude) || k.Rashi != -1 || k.Nakshatra != -1 ||
			k.SignLord.Valid() || k.StarLord.Valid() || k.SubLord != types.DashaSaturn {
			t.Errorf("ComputeKpSubLord(%v) = %+v, want the TypeScript reading (NaN, -1, -1, none, none, Saturn)", lon, k)
		}
	}
	if got, want := ComputeKpSubLord(360), ComputeKpSubLord(0); got != want {
		t.Errorf("ComputeKpSubLord(360) = %+v, want %+v", got, want)
	}

	base := robustChart(t)
	sunHouses := func(lon float64) []int {
		c := withLagna(base, base.Lagna.Rashi.Index)
		c.Planets[0].Longitude = lon
		k := ComputeKpSignificators(&c)
		h, _ := k.ByPlanet.Get(types.GrahaSun)
		return h
	}
	for lon, want := range map[float64][]int{360: {1, 9, 10}, 720: {1, 9, 10}, -5: {1, 2, 10, 11}, math.NaN(): {1, 10}, math.Inf(1): {1, 10}} {
		if got := sunHouses(lon); !reflect.DeepEqual(got, want) {
			t.Errorf("ComputeKpSignificators(Sun at %v).Sun = %v, want %v (TypeScript)", lon, got, want)
		}
	}
	if !reflect.DeepEqual(sunHouses(360), sunHouses(0)) {
		t.Error("a Sun at 360 must read as a Sun at 0")
	}
	c := withLagna(base, base.Lagna.Rashi.Index)
	c.Planets[0].Planet = 42
	k := ComputeKpSignificators(&c)
	moon, _ := k.ByPlanet.Get(types.GrahaMoon)
	if want := []int{1, 5, 12}; !reflect.DeepEqual(moon, want) {
		t.Errorf("ComputeKpSignificators(Planets[0] = Graha(42)).Moon = %v, want %v (TypeScript ignores it)", moon, want)
	}
}

// panicOf runs f and returns what it panicked with, or "" if it returned.
func panicOf(f func()) (msg string) {
	defer func() {
		if r := recover(); r != nil {
			msg = fmt.Sprint(r)
		}
	}()
	f()
	return ""
}

// TestMalformedInputPanicsAreNamed checks that the functions with no error
// return name what was wrong instead of dying on a runtime index or nil
// dereference, and that KaalSarp returns what TypeScript returns.
func TestMalformedInputPanicsAreNamed(t *testing.T) {
	sr := time.Date(2025, 3, 20, 1, 0, 0, 0, time.UTC)
	nsr := sr.Add(24 * time.Hour)
	base := robustChart(t)
	negLagna := withLagna(base, -3)
	badRashi := withLagna(base, base.Lagna.Rashi.Index)
	badRashi.Planets[1].Rashi.Index = 12
	calls := map[string]func(){
		"ComputeAshtakavarga":     func() { ComputeAshtakavarga(&negLagna, types.AshtakavargaOptions{}) },
		"ComputeAshtakavarga ":    func() { ComputeAshtakavarga(&badRashi, types.AshtakavargaOptions{}) },
		"ComputePitruDosha":       func() { ComputePitruDosha(&types.BirthChart{}) },
		"ComputeVarjyamWindows":   func() { ComputeVarjyamWindows(sr, nsr, nil) },
		"ComputeAmritKalaWindows": func() { ComputeAmritKalaWindows(sr, nsr, nil) },
		"ComputePanchakaRahita":   func() { ComputePanchakaRahita(sr, nsr, nil) },
		"FindPanchakaOnset":       func() { FindPanchakaOnset(sr, nil) },
		"ComputeDoGhati":          func() { ComputeDoGhati(sr, nsr, nsr, nil, nil) },
		"ComputeRahuKalam":        func() { ComputeRahuKalam(sr, nsr, 7) },
		"ComputeGulikaKalam":      func() { ComputeGulikaKalam(sr, nsr, -1) },
		"ComputeYamaganda":        func() { ComputeYamaganda(sr, nsr, 7) },
		"ComputeGowriPanchangam":  func() { ComputeGowriPanchangam(sr, nsr, nsr, 7, nil, nil) },
		"ComputeGowriPanchangam ": func() { ComputeGowriPanchangam(sr, nsr, nsr, 1, nil, nil) },
	}
	for name, f := range calls {
		want := "panchang: " + strings.TrimSpace(name) + ":"
		if got := panicOf(f); !strings.HasPrefix(got, want) {
			t.Errorf("%s panicked with %q, want a message starting %q", name, got, want)
		}
	}

	var ks types.KaalSarpDoshaInfo
	if got := panicOf(func() { ks = ComputeKaalSarp(&types.BirthChart{}) }); got != "" || ks.Subtype != nil {
		t.Errorf("ComputeKaalSarp(zero chart) = %+v, panic %q; want no subtype and no panic", ks, got)
	}
	wrapped := withLagna(base, base.Lagna.Rashi.Index+12)
	if got := panicOf(func() { ComputeAshtakavarga(&wrapped, types.AshtakavargaOptions{}) }); got != "" {
		t.Errorf("ComputeAshtakavarga(lagna+12) panicked with %q; a lagna of 12 or more wraps", got)
	}
}

// TestRiseSetBeyondTheSolverRangeIsInvalidDate covers the instants past 2^52
// ms from 1970, where the rise/set refinement used to loop forever. Every
// entry point that reaches the solver now returns INVALID_DATE promptly, the
// Context twins included.
func TestRiseSetBeyondTheSolverRangeIsInvalidDate(t *testing.T) {
	s := New()
	pune := types.GeoLocation{Latitude: 18.52, Longitude: 73.85}
	far := time.Date(150000, 1, 1, 0, 0, 0, 0, time.UTC)
	yearly := types.YearlyListingOptions{Timezone: OffsetMinutes(330)}
	_, err := s.ComputeSunrise(far, pune, 2)
	wantCode(t, "ComputeSunrise", err, types.ErrInvalidDate)
	_, err = s.ComputeSunset(far.AddDate(-300000, 0, 0), pune, 2)
	wantCode(t, "ComputeSunset(-150000)", err, types.ErrInvalidDate)
	_, _, err = s.GetMoonrise(far, pune, 2)
	wantCode(t, "GetMoonrise", err, types.ErrInvalidDate)
	_, err = s.ComputeSankrantisForYear(150000, pune, yearly)
	wantCode(t, "ComputeSankrantisForYear", err, types.ErrInvalidDate)
	_, err = s.ComputeSankrantisForYearContext(context.Background(), 150000, pune, yearly)
	wantCode(t, "ComputeSankrantisForYearContext", err, types.ErrInvalidDate)
	_, err = s.ComputeEkadashiDatesForYear(150000, pune, yearly)
	wantCode(t, "ComputeEkadashiDatesForYear", err, types.ErrInvalidDate)
	_, _, err = s.GetHinduNewYear(150000, types.RegionTamilNadu, pune, types.ConvertOptions{Timezone: OffsetMinutes(330)})
	wantCode(t, "GetHinduNewYear", err, types.ErrInvalidDate)

	if _, err := s.ComputeSunrise(time.Date(144000, 1, 1, 0, 0, 0, 0, time.UTC), pune, 2); err != nil {
		t.Errorf("ComputeSunrise(year 144000) = %v; inside 2^52 ms it must still solve", err)
	}
}

func TestTableBuildersValidateOffsetAndLanguages(t *testing.T) {
	s := New()
	varanasi := types.GeoLocation{Latitude: 25.3176, Longitude: 82.9739}
	_, err := s.BuildMoonPhasesTable(types.BuildMoonPhasesTableOptions{TimezoneOffsetMinutes: 1000000, StartYear: 2025, EndYear: 2025})
	wantCode(t, "BuildMoonPhasesTable(offset 1e6)", err, types.ErrInvalidTimezone)
	_, err = s.BuildEclipsesTable(types.BuildEclipsesTableOptions{Location: varanasi, TimezoneOffsetMinutes: -721, StartYear: 2025, EndYear: 2025})
	wantCode(t, "BuildEclipsesTable(offset -721)", err, types.ErrInvalidTimezone)
	for _, langs := range [][]types.FestivalsTableLanguage{{"fr"}, {"en", "fr"}, {"EN"}, {""}} {
		_, err = s.BuildMoonPhasesTable(types.BuildMoonPhasesTableOptions{TimezoneOffsetMinutes: 330, StartYear: 2025, EndYear: 2025, Languages: langs})
		wantCode(t, "BuildMoonPhasesTable(languages)", err, types.ErrInvalidInput)
		_, err = s.BuildEclipsesTable(types.BuildEclipsesTableOptions{Location: varanasi, TimezoneOffsetMinutes: 330, StartYear: 2025, EndYear: 2025, Languages: langs})
		wantCode(t, "BuildEclipsesTable(languages)", err, types.ErrInvalidInput)
		_, err = s.BuildFestivalsTable(types.BuildFestivalsTableOptions{Location: varanasi, TimezoneOffsetMinutes: 330, StartYear: 2025, EndYear: 2025, Languages: langs})
		wantCode(t, "BuildFestivalsTable(languages)", err, types.ErrInvalidInput)
	}
	if _, err := s.BuildMoonPhasesTable(types.BuildMoonPhasesTableOptions{TimezoneOffsetMinutes: 840, StartYear: 2025, EndYear: 2025,
		Languages: []types.FestivalsTableLanguage{"en", "hi", "en"}}); err != nil {
		t.Errorf("repeated languages and offset 840 must stay accepted: %v", err)
	}
}

func TestEmptyAyanamsaMeansLahiriAtTheFacade(t *testing.T) {
	s := New()
	at := time.Date(1995, 8, 15, 5, 30, 0, 0, time.UTC)
	pairs := []struct {
		name string
		call func(types.AyanamsaType) (any, error)
	}{
		{"ComputeAyanamsa", func(a types.AyanamsaType) (any, error) { return ComputeAyanamsa(at, a) }},
		{"GetSiderealSunLongitude", func(a types.AyanamsaType) (any, error) { return s.GetSiderealSunLongitude(at, a) }},
		{"GetSiderealMoonLongitude", func(a types.AyanamsaType) (any, error) { return s.GetSiderealMoonLongitude(at, a) }},
		{"ComputePlanetaryPositions", func(a types.AyanamsaType) (any, error) {
			return s.ComputePlanetaryPositions(at, a, nil, nil, "")
		}},
	}
	for _, p := range pairs {
		got, err := p.call("")
		want, wantErr := p.call(types.Lahiri)
		if err != nil || wantErr != nil || !reflect.DeepEqual(got, want) {
			t.Errorf("%s(\"\") = %v, %v; want the Lahiri result", p.name, got, err)
		}
		_, err = p.call("bogus")
		wantCode(t, p.name+"(bogus)", err, types.ErrInvalidAyanamsa)
	}
}

// TestMutatingExportedTablesChangesNoResult edits the exported types lists and
// sentinels the way a careless caller might (an in-place sort, an append that
// aliases, a reslice, an overwrite) and checks that no engine result or All
// function moves. Every edit is undone before the test returns.
func TestMutatingExportedTablesChangesNoResult(t *testing.T) {
	s := New()
	delhi := types.GeoLocation{Latitude: 28.6139, Longitude: 77.2090}
	birth := time.Date(1990, 5, 15, 6, 30, 0, 0, time.UTC)
	chartOf := func(at time.Time) types.BirthChart {
		c, err := s.ComputeRashiChart(at, delhi, types.BirthChartOptions{})
		if err != nil {
			t.Fatal(err)
		}
		return c
	}
	polar := func() (bool, error) {
		_, ok, err := s.GetDailyPanchang(time.Date(2025, 6, 21, 0, 0, 0, 0, time.UTC),
			types.GeoLocation{Latitude: 69.6492, Longitude: 18.9553}, types.PanchangOptions{Timezone: OffsetMinutes(120)})
		return ok, err
	}
	results := func() []any {
		chart := chartOf(birth)
		kaal := chartOf(time.Date(1980, 1, 8, 6, 0, 0, 0, time.UTC))
		yogas, yErr := ComputeYogas(&chart, types.ComputeYogasOptions{Types: []types.YogaType{"mahapurusha"}})
		shadbala, sErr := s.ComputeShadbala(birth, delhi, types.BirthChartOptions{})
		ok, pErr := polar()
		return []any{chart, ComputeKaalSarp(&kaal), yogas, yErr, shadbala, sErr, ok, pErr,
			AllGrahas(), AllDivisionals(), AllYogaTypes(), AllVisibleGrahas(), AllKaalSarpSubtypes(),
			types.DivisionalD3.Valid(), types.Divisional("D60").Valid()}
	}
	want := results()

	savedGrahas, savedVisible, savedKaal := types.AllGrahas, types.AllVisibleGrahas, types.AllKaalSarpSubtypes
	savedDiv := append([]types.Divisional(nil), types.AllDivisionals...)
	savedYogaTypes := types.AllYogaTypes
	savedRise, savedSet := types.ErrNoSunriseSentinel.Code, types.ErrNoSunsetSentinel.Code
	defer func() {
		types.AllGrahas, types.AllVisibleGrahas, types.AllKaalSarpSubtypes = savedGrahas, savedVisible, savedKaal
		copy(types.AllDivisionals, savedDiv)
		types.AllYogaTypes = savedYogaTypes
		types.ErrNoSunriseSentinel.Code, types.ErrNoSunsetSentinel.Code = savedRise, savedSet
	}()

	types.AllGrahas[0], types.AllGrahas[8] = types.AllGrahas[8], types.AllGrahas[0]
	types.AllVisibleGrahas[1] = types.VisibleSun
	for i := range types.AllKaalSarpSubtypes {
		types.AllKaalSarpSubtypes[i] = "tampered"
	}
	_ = append(types.AllDivisionals[:1], "D60")
	types.AllYogaTypes = types.AllYogaTypes[1:]
	types.ErrNoSunriseSentinel.Code, types.ErrNoSunsetSentinel.Code = "MUTATED", "MUTATED"

	if got := results(); !reflect.DeepEqual(got, want) {
		t.Errorf("results changed after the exported tables were modified:\n got %v\nwant %v", got, want)
	}
}

func TestGetUpcomingEclipsesContextStopsAtItsDeadline(t *testing.T) {
	s := New()
	pune := types.GeoLocation{Latitude: 18.52, Longitude: 73.85}
	from := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	start := time.Now()
	_, err := s.GetUpcomingEclipsesContext(ctx, from, pune, 1_000_000)
	if err != context.DeadlineExceeded || time.Since(start) > 5*time.Second {
		t.Errorf("GetUpcomingEclipsesContext = %v after %v, want context.DeadlineExceeded promptly", err, time.Since(start))
	}
	plain, err1 := s.GetUpcomingEclipses(from, pune, 3)
	twin, err2 := s.GetUpcomingEclipsesContext(context.Background(), from, pune, 3)
	if err1 != nil || err2 != nil || !reflect.DeepEqual(plain, twin) {
		t.Errorf("the Context twin with a background context must match the plain form")
	}
}

// TestErrorMessagesSpellNumbersAsJavaScript checks the two messages that
// printed numbers with Go verbs: String(x) for the NO_SUNRISE coordinates and
// toFixed(2), which rounds a tie up, for the CIRCUMPOLAR latitude.
func TestErrorMessagesSpellNumbersAsJavaScript(t *testing.T) {
	s := New()
	_, err := s.ComputeSunrise(time.Date(2025, 12, 20, 0, 0, 0, 0, time.UTC),
		types.GeoLocation{Latitude: 89, Longitude: math.Copysign(0, -1)}, 2)
	if err == nil || !strings.Contains(err.Error(), "(89°, 0°)") {
		t.Errorf("NO_SUNRISE message = %v, want the coordinates spelled (89°, 0°)", err)
	}
	_, err = s.ComputeSunset(time.Date(2025, 6, 20, 0, 0, 0, 0, time.UTC),
		types.GeoLocation{Latitude: -89.5, Longitude: 1e-7}, 2)
	if err == nil || !strings.Contains(err.Error(), "(-89.5°, 1e-7°)") {
		t.Errorf("NO_SUNSET message = %v, want (-89.5°, 1e-7°)", err)
	}
	_, err = s.ComputeBhava(time.Date(2000, 1, 1, 12, 0, 0, 0, time.UTC),
		types.GeoLocation{Latitude: -67.125, Longitude: 25}, types.BirthChartOptions{HouseSystem: types.HouseSystemPlacidusKP})
	if err == nil || !strings.Contains(err.Error(), "latitude -67.13°") {
		t.Errorf("CIRCUMPOLAR message = %v, want latitude -67.13° as toFixed(2) gives", err)
	}
}

func TestPanchangErrorIsToleratesNil(t *testing.T) {
	err := error(types.Codef(types.ErrInvalidDate, "bad"))
	if errors.Is(err, (*types.PanchangError)(nil)) {
		t.Error("errors.Is(err, typed nil) = true, want false")
	}
	var nilErr *types.PanchangError
	if nilErr.Is(types.Codef(types.ErrInvalidDate, "x")) {
		t.Error("(*types.PanchangError)(nil).Is(...) = true, want false")
	}
	if !errors.Is(err, &types.PanchangError{Code: types.ErrInvalidDate}) || errors.Is(err, types.ErrNoSunriseSentinel) {
		t.Error("Is must still compare codes")
	}
}
