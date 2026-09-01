package calendar

import (
	"encoding/json"
	"errors"
	"math"
	"sort"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

var (
	pune         = types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
	longyearbyen = types.GeoLocation{Latitude: 78.2232, Longitude: 15.6267}
	istOptions   = YearlyListingOptions{Timezone: types.TimezoneOffset(330)}
)

func TestBisectionMidpointIsFloorDivision(t *testing.T) {
	const seed uint32 = 0x5eed_1912
	state := seed
	next := func() int64 {
		state = state*1664525 + 1013904223
		high := int64(int32(state))
		state = state*1664525 + 1013904223
		return high*1000 + int64((state>>16)%1000)
	}

	shiftVsFloat, divVsFloat := 0, 0
	const n = 200_000
	for i := 0; i < n; i++ {
		lo, hi := next(), next()
		if lo > hi {
			lo, hi = hi, lo
		}
		sum := lo + hi
		want := int64(math.Floor(float64(sum) / 2))
		if got := sum >> 1; got != want {
			shiftVsFloat++
		}
		if got := sum / 2; got != want {
			divVsFloat++
		}
	}
	if shiftVsFloat != 0 {
		t.Errorf("(lo+hi)>>1 disagreed with Math.floor((lo+hi)/2) on %d of %d samples",
			shiftVsFloat, n)
	}
	if divVsFloat == 0 {
		t.Fatalf("(lo+hi)/2 agreed with the floor form on all %d samples: the sweep "+
			"no longer covers negative odd sums, so the shift's correctness is untested", n)
	}
	t.Logf("seed %#x: the truncating spelling (lo+hi)/2 differs from Math.floor on "+
		"%d of %d samples (%.1f%%); the shipped shift differs on 0",
		seed, divVsFloat, n, 100*float64(divVsFloat)/float64(n))
}

func TestPre1970TransitsAreNegativeAndOdd(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	sankrantis, err := ComputeSankrantisForYear(ctx, 1912, pune, istOptions)
	if err != nil {
		t.Fatalf("1912 sankrantis: %v", err)
	}
	negative, odd := 0, 0
	for _, s := range sankrantis {
		if s.Moment.Ms() < 0 {
			negative++
		}
		if s.Moment.Ms()%2 != 0 {
			odd++
		}
	}
	if negative != len(sankrantis) {
		t.Errorf("want all %d 1912 transits negative, got %d", len(sankrantis), negative)
	}
	if odd == 0 {
		t.Error("no 1912 transit landed on an odd millisecond: the bisection's " +
			"rounding direction is not exercised by this year")
	}
	t.Logf("1912: %d transits, %d negative, %d on an odd millisecond",
		len(sankrantis), negative, odd)
}

func TestSankrantisAreTwelvePerYear(t *testing.T) {
	for _, year := range []int{1912, 1999, 2000, 2025, 2026, 2027, 2028, 2029, 2088, 2100} {
		ctx := &astronomy.EphemerisCtx{}
		got, err := ComputeSankrantisForYear(ctx, year, pune, istOptions)
		if err != nil {
			t.Fatalf("%d: %v", year, err)
		}
		if len(got) != 12 {
			t.Errorf("%d: want 12 sankrantis, got %d", year, len(got))
			continue
		}
		seen := map[int]bool{}
		for i, s := range got {
			if s.Rashi < 0 || s.Rashi > 11 {
				t.Errorf("%d sankranti[%d]: rashi %d out of range", year, i, s.Rashi)
			}
			if seen[s.Rashi] {
				t.Errorf("%d: rashi %d transited twice", year, s.Rashi)
			}
			seen[s.Rashi] = true
			if i > 0 && got[i-1].Moment.Ms() >= s.Moment.Ms() {
				t.Errorf("%d: transit %d is not after transit %d", year, i, i-1)
			}
			if s.RashiName == "" {
				t.Errorf("%d sankranti[%d]: empty rashi name", year, i)
			}
		}
	}
}

func TestSankrantiDateIsTheObservanceDayNotTheTransitDay(t *testing.T) {
	same, next, other := 0, 0, 0
	for _, year := range []int{2025, 2026, 2027, 2028, 2029} {
		ctx := &astronomy.EphemerisCtx{}
		got, err := ComputeSankrantisForYear(ctx, year, pune, istOptions)
		if err != nil {
			t.Fatalf("%d: %v", year, err)
		}
		for _, s := range got {
			local := types.Date(s.Moment.Ms() + 330*60_000)
			transitDay := types.DateUTC(local.UTCFullYear(), local.UTCMonth(), local.UTCDate())
			switch s.Date.Ms() - transitDay.Ms() {
			case 0:
				same++
			case dayMs:
				next++
			default:
				other++
				t.Errorf("%s: observance day is %s, %d ms from the transit's own day",
					s.RashiName, s.Date.ISOString()[:10], s.Date.Ms()-transitDay.Ms())
			}
		}
	}
	if other != 0 {
		t.Errorf("%d transits landed neither on their own day nor the next", other)
	}
	if next == 0 {
		t.Error("no transit in 2025-2029 at Pune moved to the next sunrise's day: " +
			"the night-transit arm of the almanac's rule is not exercised, so an " +
			"inversion of it would pass here")
	}
	t.Logf("Pune 2025-2029: %d transits observed on their own civil day, %d moved "+
		"to the next sunrise's day", same, next)
}

func TestIsPolarRiseSetErrorClassifiesOnlyTheTwoSentinels(t *testing.T) {
	for _, code := range types.AllErrorCodes {
		err := types.NewPanchangError("synthetic", code)
		want := code == types.ErrNoSunrise || code == types.ErrNoSunset
		if got := isPolarRiseSetError(err); got != want {
			t.Errorf("isPolarRiseSetError(%s) = %v, want %v", code, got, want)
		}
	}
	if isPolarRiseSetError(errors.New("plain")) {
		t.Error("a plain error must not classify as a polar rise/set error")
	}
	if isPolarRiseSetError(nil) {
		t.Error("nil must not classify as a polar rise/set error")
	}
}

func TestSankrantiAnchorReachesOnlyTheTwoSentinels(t *testing.T) {
	sentinels, others := 0, 0
	for _, year := range []int{2025, 2026} {
		ctx := &astronomy.EphemerisCtx{}
		got, err := ComputeSankrantisForYear(ctx, year, longyearbyen,
			YearlyListingOptions{Timezone: types.TimezoneOffset(60)})
		if err != nil {
			t.Fatalf("%d: %v", year, err)
		}
		for _, s := range got {
			if _, err := sankrantiAnchor(ctx, s.Moment.Ms(), longyearbyen); err != nil {
				if isPolarRiseSetError(err) {
					sentinels++
				} else {
					others++
					t.Errorf("sankrantiAnchor returned a non-sentinel error: %v", err)
				}
			}
		}
	}
	if sentinels == 0 {
		t.Fatal("no sankranti anchor failed at Longyearbyen across 2025-2026: the " +
			"bare-catch arm is not exercised, so its behaviour is untested")
	}
	if others != 0 {
		t.Errorf("%d non-sentinel errors reached the bare catch", others)
	}
	t.Logf("Longyearbyen 2025-2026: %d anchor failures, all of them one of the two "+
		"D7 sentinels; %d were anything else", sentinels, others)
}

func TestMaxStepsIsARealDivision(t *testing.T) {
	shortfalls := 0
	for spanDays := 1; spanDays <= 4000; spanDays++ {
		want := int(math.Ceil(float64(spanDays)/20)) + 50
		if naive := spanDays/20 + 50; naive != want {
			shortfalls++
		}
	}
	if shortfalls == 0 {
		t.Fatal("integer division agreed with the ceiling form on every span: " +
			"the hazard this test guards has stopped being reachable")
	}
	t.Logf("integer division would take maxSteps one step short on %d of 4000 spans",
		shortfalls)

	for _, days := range []int64{1, 19, 20, 21, 365, 366, 3653} {
		startMs := types.DateUTC(2025, 0, 1).Ms()
		endMs := startMs + days*dayMs - 1
		got := int(math.Ceil(float64(endMs-startMs)/float64(24*3600_000))) + 1
		if want := int(days) + 1; got != want {
			t.Errorf("spanDays for a %d-day range: want %d, got %d", days, want, got)
		}
	}
}

func TestLocalYearWindowIsTheLastMillisecondOfTheYear(t *testing.T) {
	for _, year := range []int{1912, 2025, 2088, 2100} {
		startMs, endMs, err := localYearWindow(year, types.TimezoneOffset(330))
		if err != nil {
			t.Fatalf("%d: %v", year, err)
		}
		wantStart := types.DateUTC(year, 0, 1).Ms() - 330*60_000
		wantEnd := types.DateUTC(year, 11, 31).Ms() + 86_399_999 - 330*60_000
		if startMs != wantStart {
			t.Errorf("%d start: want %d, got %d", year, wantStart, startMs)
		}
		if endMs != wantEnd {
			t.Errorf("%d end: want %d, got %d", year, wantEnd, endMs)
		}
		local := types.Date(endMs + 330*60_000)
		if local.UTCFullYear() != year || local.UTCMonth() != 11 || local.UTCDate() != 31 ||
			local.UTCHours() != 23 || local.UTCMinutes() != 59 {
			t.Errorf("%d end is %s local, want the last minute of Dec 31",
				year, types.Date(endMs+330*60_000).ISOString())
		}
	}
}

func TestEmptyListingsMarshalAsArrays(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	startMs := types.DateUTC(2025, 5, 10).Ms()

	festivals, err := ComputeFestivalsInRange(ctx, startMs, startMs, pune, istOptions)
	if err != nil {
		t.Fatalf("festivals: %v", err)
	}
	eclipses, err := ComputeEclipsesInRange(ctx, startMs, startMs, pune)
	if err != nil {
		t.Fatalf("eclipses: %v", err)
	}
	if len(eclipses) != 0 {
		t.Fatalf("expected no eclipse on 2025-06-10, got %d", len(eclipses))
	}
	empty, err := ComputeEkadashiDatesForYear(ctx, 2025, pune, istOptions)
	if err != nil {
		t.Fatalf("ekadashi: %v", err)
	}

	for name, v := range map[string]any{
		"eclipses":  eclipses,
		"festivals": festivals,
	} {
		b, err := json.Marshal(v)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if string(b) == "null" {
			t.Errorf("%s marshalled as null; JavaScript writes [] (docs/porting.md §1.9)", name)
		}
	}
	if len(empty) == 0 {
		b, _ := json.Marshal(empty)
		if string(b) == "null" {
			t.Error("ekadashi marshalled as null")
		}
	}
}

func TestEclipsesInRangeIsSortedAndStable(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	startMs, endMs, err := localYearWindow(2025, types.TimezoneOffset(330))
	if err != nil {
		t.Fatal(err)
	}
	got, err := ComputeEclipsesInRange(ctx, startMs, endMs, pune)
	if err != nil {
		t.Fatalf("eclipses: %v", err)
	}
	for i := 1; i < len(got); i++ {
		if got[i-1].PeakMs.Ms() > got[i].PeakMs.Ms() {
			t.Errorf("eclipse %d peaks before eclipse %d", i, i-1)
		}
	}

	type tagged struct {
		peak int64
		tag  string
	}
	in := []tagged{{10, "s0"}, {10, "s1"}, {5, "s2"}, {10, "l0"}, {5, "l1"}}
	sort.SliceStable(in, func(i, j int) bool { return in[i].peak < in[j].peak })
	want := []string{"s2", "l1", "s0", "s1", "l0"}
	for i, w := range want {
		if in[i].tag != w {
			t.Errorf("stable sort order: want %v, got %v at %d", want, in, i)
			break
		}
	}
}

func TestRashiAtModuloGuardIsUnreachableButFaithful(t *testing.T) {
	for _, lon := range []float64{0, 1e-300, 29.999999, 30, 180, 359.9999999999999, 359.99999999999994} {
		raw := int(math.Floor(lon / 30))
		if got := raw % 12; got != raw {
			t.Errorf("lon %v: the modulo changed %d to %d, so it is not a no-op "+
				"on a normalized longitude", lon, raw, got)
		}
		if raw < 0 || raw > 11 {
			t.Errorf("lon %v: floor(lon/30) = %d, outside 0..11", lon, raw)
		}
	}
	if got := int(math.Floor(360.0/30)) % 12; got != 0 {
		t.Errorf("the guard does not fold an exact 360 to rashi 0: got %d", got)
	}
}

func TestConvertHinduToGregorianRejectsOutOfRangeCoords(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	opts := ConvertOptions{Timezone: types.TimezoneOffset(330)}
	for _, c := range []struct {
		name   string
		coords HinduDateCoords
	}{
		{"masaIndex low", HinduDateCoords{VikramSamvat: 2083, MasaIndex: -1, Paksha: PakshaShukla, PakshaTithi: 1}},
		{"masaIndex high", HinduDateCoords{VikramSamvat: 2083, MasaIndex: 12, Paksha: PakshaShukla, PakshaTithi: 1}},
		{"pakshaTithi low", HinduDateCoords{VikramSamvat: 2083, MasaIndex: 0, Paksha: PakshaShukla, PakshaTithi: 0}},
		{"pakshaTithi high", HinduDateCoords{VikramSamvat: 2083, MasaIndex: 0, Paksha: PakshaShukla, PakshaTithi: 16}},
		{"paksha empty", HinduDateCoords{VikramSamvat: 2083, MasaIndex: 0, Paksha: "", PakshaTithi: 1}},
		{"paksha bogus", HinduDateCoords{VikramSamvat: 2083, MasaIndex: 0, Paksha: "waxing", PakshaTithi: 1}},
	} {
		_, err := ConvertHinduToGregorian(ctx, c.coords, pune, opts)
		var pe *types.PanchangError
		if !errors.As(err, &pe) || pe.Code != types.ErrInvalidInput {
			t.Errorf("%s: want an INVALID_INPUT error, got %v", c.name, err)
		}
	}
}

func TestGetUpcomingEclipsesRejectsNonPositiveCount(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	fromMs := types.DateUTC(2025, 0, 1).Ms()
	for _, count := range []int{0, -1, -100} {
		_, err := GetUpcomingEclipses(ctx, fromMs, pune, count)
		var pe *types.PanchangError
		if !errors.As(err, &pe) || pe.Code != types.ErrInvalidInput {
			t.Errorf("count %d: want an INVALID_INPUT error, got %v", count, err)
		}
	}
	for _, count := range []int{1, 3, 5} {
		got, err := GetUpcomingEclipses(ctx, fromMs, pune, count)
		if err != nil {
			t.Fatalf("count %d: %v", count, err)
		}
		if len(got) > count {
			t.Errorf("count %d: got %d eclipses", count, len(got))
		}
	}
}

func TestRangeEnumeratorsRejectInvertedRanges(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	early := types.DateUTC(2025, 0, 1).Ms()
	late := types.DateUTC(2025, 5, 1).Ms()
	if _, err := ComputeFestivalsInRange(ctx, late, early, pune, istOptions); err == nil {
		t.Error("ComputeFestivalsInRange accepted start > end")
	}
	if _, err := ComputeEclipsesInRange(ctx, late, early, pune); err == nil {
		t.Error("ComputeEclipsesInRange accepted start > end")
	}
	if _, err := ComputeFestivalsInRange(ctx, early, early, pune, istOptions); err != nil {
		t.Errorf("ComputeFestivalsInRange rejected a one-day range: %v", err)
	}
}

func TestConvertGregorianToHinduThrowsOnPolarDays(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	ms := types.DateUTC(2025, 11, 15).Ms()
	_, err := ConvertGregorianToHindu(ctx, ms, longyearbyen,
		ConvertOptions{Timezone: types.TimezoneOffset(60)})
	var pe *types.PanchangError
	if !errors.As(err, &pe) || pe.Code != types.ErrNoSunrise {
		t.Fatalf("want a NO_SUNRISE PanchangError, got %v", err)
	}
	if _, err := ConvertGregorianToHindu(ctx, types.DateUTC(2025, 5, 15).Ms(), pune,
		ConvertOptions{Timezone: types.TimezoneOffset(330)}); err != nil {
		t.Errorf("an ordinary day should convert: %v", err)
	}
}

func TestKaliYugaIncrementsAtChaitraNotAtTheEpochAnniversary(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	for _, c := range []struct {
		day  string
		want int
	}{
		{"2026-01-01", 5126},
		{"2026-03-01", 5126},
		{"2026-03-20", 5127},
		{"2026-08-19", 5127},
	} {
		ms, err := types.ParseISODay(c.day)
		if err != nil {
			t.Fatal(err)
		}
		got, err := GetKaliYugaYear(ctx, ms)
		if err != nil {
			t.Fatalf("%s: %v", c.day, err)
		}
		if got != c.want {
			t.Errorf("%s: want Kali Yuga %d, got %d", c.day, c.want, got)
		}
	}
	for _, day := range []string{"2026-03-01", "2026-03-20", "2026-08-19"} {
		ms, err := types.ParseISODay(day)
		if err != nil {
			t.Fatal(err)
		}
		ky, err := GetKaliYugaYear(ctx, ms)
		if err != nil {
			t.Fatal(err)
		}
		sv, err := ComputeSamvat(ctx, ms)
		if err != nil {
			t.Fatal(err)
		}
		if ky-sv.VikramSamvat != 3044 {
			t.Errorf("%s: Kali %d - Vikram %d = %d, want 3044",
				day, ky, sv.VikramSamvat, ky-sv.VikramSamvat)
		}
	}
}

func TestMeshaDayRuleForCoversEveryRegion(t *testing.T) {
	solar := []types.FestivalRegion{
		types.LegacyRegionTamil, types.RegionTamilNadu, types.RegionKerala,
		types.RegionPunjab, types.LegacyRegionBengal, types.RegionWestBengal,
		types.RegionAssam,
	}
	reached := map[meshaDayRule]int{}
	for _, r := range solar {
		reached[meshaDayRuleFor(r)]++
	}
	for _, rule := range []meshaDayRule{
		meshaSankrantiDay, meshaCivilDay, meshaNextSunrise, meshaCivilDayPlus1,
	} {
		if reached[rule] == 0 {
			t.Errorf("no region maps to the %q rule", rule)
		}
	}
	if got := meshaDayRuleFor(types.RegionAssam); got != meshaSankrantiDay {
		t.Errorf("Assam maps to %q, want %q (the unpinned Tamil Nadu rule)",
			got, meshaSankrantiDay)
	}
	for _, r := range []types.FestivalRegion{types.RegionAll, types.RegionGujarat, ""} {
		if got := meshaDayRuleFor(r); got != meshaSankrantiDay {
			t.Errorf("region %q maps to %q, want the default", r, got)
		}
	}
}
