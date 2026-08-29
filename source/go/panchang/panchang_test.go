package panchang

import (
	"testing"
	"time"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/core"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jyotish"
)

var (
	pune = GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
	when = time.Date(2025, 7, 4, 0, 0, 0, 0, time.UTC)
)

func ist() Options { return Options{Timezone: OffsetMinutes(330)} }

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

// A memo bug shows up as order dependence, which no single-call test can see.
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
	ay, err := ComputeAyanamsa(when, Lahiri)
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
	if AllAyanamsaTypes()[0] != Lahiri {
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
		lon, err := s.GetSiderealMoonLongitude(when, Lahiri)
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
		if _, err := ComputeGandaMula(0, English); err != nil {
			t.Error(err)
		}
	})

	t.Run("jyotish", func(t *testing.T) {
		chart, err := s.ComputeRashiChart(when, pune, BirthChartOptions{})
		if err != nil {
			t.Fatal(err)
		}
		if len(chart.Planets) == 0 {
			t.Fatal("no planets; the checks below would be vacuous")
		}
		if _, err := s.ComputeShadbala(when, pune, BirthChartOptions{}); err != nil {
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

func sunriseTime(d JSDate) time.Time { return time.UnixMilli(d.Ms()) }

func TestGetEclipseDuringDayZeroLongitudesMeansTheEphemeris(t *testing.T) {
	s := New()
	sunrise := time.Date(2025, 3, 29, 1, 0, 0, 0, time.UTC) // solar eclipse day
	next := sunrise.Add(24 * time.Hour)
	gotZero, okZero := s.GetEclipseDuringDay(sunrise, next, pune, English, SyzygyLongitudes{})
	gotExpl, okExpl := s.GetEclipseDuringDay(sunrise, next, pune, English,
		astronomy.DirectLongitudes(s.ctx))
	if okZero != okExpl || gotZero != gotExpl {
		t.Errorf("zero-value longitudes (%v, %v) != explicit DirectLongitudes (%v, %v)",
			gotZero, okZero, gotExpl, okExpl)
	}
}

func TestStockRuleAccessorsReturnIndependentCopies(t *testing.T) {
	accessors := map[string]func() MuhurtaRule{
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
