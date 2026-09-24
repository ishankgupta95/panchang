package panchang

import (
	"encoding/json"
	"errors"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

var (
	listingNY     = types.GeoLocation{Latitude: 40.7128, Longitude: -74.006}
	listingDelhi  = types.GeoLocation{Latitude: 28.6139, Longitude: 77.209}
	listingSydney = types.GeoLocation{Latitude: -33.8688, Longitude: 151.2093}
	listingProbe  = types.MuhurtaRule{Occasion: "probe"}
)

func listingZone(t *testing.T, name string) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation(name)
	if err != nil {
		t.Fatal(err)
	}
	return loc
}

func listingDatesOfYear(year int) []string {
	out := []string{}
	for d := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC); d.Year() == year; d = d.AddDate(0, 0, 1) {
		out = append(out, d.Format("2006-01-02"))
	}
	return out
}

func listingAtOffset(d types.JSDate, offsetMinutes int) string {
	return types.Date(d.Ms() + int64(offsetMinutes)*60_000).ISOString()[:10]
}

func listingISO(d types.JSDate) string { return d.ISOString()[:10] }

func listingDates(ds []types.JSDate) []string {
	out := make([]string, len(ds))
	for i, d := range ds {
		out[i] = listingISO(d)
	}
	return out
}

func listingContains(xs []string, x string) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

func TestDSTYearListingsCoverEachCivilDayOnce(t *testing.T) {
	s := New()
	ny := listingZone(t, "America/New_York")

	festivals, err := s.ComputeFestivalsForYear(2025, listingNY, types.YearlyListingOptions{Timezone: Zone("America/New_York")})
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, f := range festivals {
		local := time.UnixMilli(f.Date.Ms()).In(ny)
		if local.Hour() != 0 || local.Minute() != 0 || local.Year() != 2025 {
			t.Errorf("%s %s is not a 2025 local midnight", local.Format(time.RFC3339), f.Festival.Key)
		}
		k := local.Format("2006-01-02") + " " + f.Festival.Key
		if seen[k] {
			t.Errorf("%s listed twice", k)
		}
		seen[k] = true
	}
	for _, want := range []string{"2025-03-09 smarta_ekadashi", "2025-12-31 pradosha"} {
		if !seen[want] {
			t.Errorf("missing %s", want)
		}
	}

	days, err := s.ComputeAuspiciousDatesForYear(2025, listingProbe, listingNY,
		types.MuhurtaScoreOptions{Timezone: Zone("America/New_York"), IncludeFailures: true})
	if err != nil {
		t.Fatal(err)
	}
	got := []string{}
	for _, d := range days {
		got = append(got, time.UnixMilli(d.Date.Ms()).In(ny).Format("2006-01-02"))
	}
	sort.Strings(got)
	if !reflect.DeepEqual(got, listingDatesOfYear(2025)) {
		t.Errorf("scored %d days, want every date of 2025 once", len(got))
	}

	ranged, err := s.ComputeAuspiciousDatesInRange(listingProbe,
		time.Date(2025, 3, 6, 4, 30, 0, 0, time.UTC), time.Date(2025, 3, 12, 4, 0, 0, 0, time.UTC), listingNY,
		types.MuhurtaScoreOptions{Timezone: Zone("America/New_York"), IncludeFailures: true})
	if err != nil {
		t.Fatal(err)
	}
	got = got[:0]
	for _, d := range ranged {
		local := time.UnixMilli(d.Date.Ms()).In(ny)
		if local.Hour() != 23 || local.Minute() != 30 {
			t.Errorf("%s is not at the start's local 23:30", local.Format(time.RFC3339))
		}
		got = append(got, local.Format("2006-01-02"))
	}
	sort.Strings(got)
	want := []string{"2025-03-05", "2025-03-06", "2025-03-07", "2025-03-08", "2025-03-09", "2025-03-10", "2025-03-11"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("range days = %v, want %v", got, want)
	}
}

func TestDSTInstantListingsUseEachBoundaryOffset(t *testing.T) {
	s := New()
	ny1920, err := s.ComputeMoonPhasesForYear(1920, types.MoonPhasesForYearOptions{Timezone: Zone("America/New_York")})
	if err != nil {
		t.Fatal(err)
	}
	if last := ny1920[len(ny1920)-1]; last.Phase != "last_quarter" || last.TimeMs.ISOString() != "1921-01-01T04:34:21.974Z" {
		t.Errorf("NY 1920 ends with %s %s, want the last quarter of 31 Dec 23:34 EST", last.Phase, last.TimeMs.ISOString())
	}
	syd2031, err := s.ComputeMoonPhasesForYear(2031, types.MoonPhasesForYearOptions{Timezone: Zone("Australia/Sydney")})
	if err != nil {
		t.Fatal(err)
	}
	if got := syd2031[0].TimeMs.ISOString(); got != "2030-12-31T13:36:07.665Z" {
		t.Errorf("Sydney 2031 starts at %s, want 2030-12-31T13:36:07.665Z (00:36 AEDT 1 Jan)", got)
	}
	denver := types.GeoLocation{Latitude: 39.7392, Longitude: -104.9903}
	peak := time.Date(2048, 1, 1, 6, 52, 29, 3_000_000, time.UTC).UnixMilli()
	for year, want := range map[int]int{2047: 1, 2048: 0} {
		es, err := s.ComputeEclipsesForYear(year, denver, Zone("America/Denver"))
		if err != nil {
			t.Fatal(err)
		}
		n := 0
		for _, e := range es {
			if e.PeakMs.Ms() == peak {
				n++
			}
		}
		if n != want {
			t.Errorf("Denver %d lists the 2048-01-01T06:52Z eclipse %d times, want %d", year, n, want)
		}
	}
	for region, want := range map[types.FestivalRegion]string{"punjab": "2008-04-13", "west-bengal": "2008-04-14"} {
		d, ok, err := s.GetHinduNewYear(2008, region, listingSydney, types.ConvertOptions{Timezone: Zone("Australia/Sydney")})
		if err != nil || !ok || listingISO(d) != want {
			t.Errorf("Sydney 2008 %s = %s (ok %v, err %v), want %s", region, listingISO(d), ok, err, want)
		}
	}
}

func TestWestOfUTCDayValuesFallWithinTheLocalDay(t *testing.T) {
	s := New()
	opts := types.YearlyListingOptions{Timezone: OffsetMinutes(-300)}
	inZone := func(ds []types.JSDate) []string {
		out := make([]string, len(ds))
		for i, d := range ds {
			out[i] = listingAtOffset(d, -300)
		}
		return out
	}
	for _, year := range []int{2025, 2033} {
		ekadashi, err := s.ComputeEkadashiDatesForYear(year, listingNY, opts)
		if err != nil {
			t.Fatal(err)
		}
		festivals, err := s.ComputeFestivalsForYear(year, listingNY, opts)
		if err != nil {
			t.Fatal(err)
		}
		smarta := []string{}
		for _, f := range festivals {
			if d := listingAtOffset(f.Date, -300); f.Festival.Key == "smarta_ekadashi" && !listingContains(smarta, d) {
				smarta = append(smarta, d)
			}
		}
		if got := inZone(ekadashi); !reflect.DeepEqual(got, smarta) {
			t.Errorf("%d Ekadashi read at -300 %v, want the Smarta Ekadashi days %v", year, got, smarta)
		}
	}
	ekadashi, _ := s.ComputeEkadashiDatesForYear(2025, listingNY, opts)
	if got := inZone(ekadashi); !listingContains(got, "2025-03-09") || listingContains(got, "2025-03-10") {
		t.Errorf("NY 2025 Ekadashi read at -300 %v, want 2025-03-09 and not 2025-03-10", got)
	}
	if got := listingDates(ekadashi); !listingContains(got, "2025-03-10") {
		t.Errorf("NY 2025 Ekadashi %v: the 2025-03-09 fast should be the 2025-03-10 UTC midnight, as in 5.3.0", got)
	}

	convert := types.ConvertOptions{Timezone: OffsetMinutes(-300)}
	d, ok, err := s.GetHinduNewYear(2026, "all", listingNY, convert)
	if err != nil || !ok || listingAtOffset(d, -300) != "2026-03-19" {
		t.Errorf("new year 2026 all read at -300 = %s, want 2026-03-19", listingAtOffset(d, -300))
	}
	// Transit 2025-04-13 17:01 at -300, before sunset (about 18:30): Puthandu is 04-13 in New York.
	d, ok, err = s.GetHinduNewYear(2025, "tamil-nadu", listingNY, convert)
	if err != nil || !ok || listingAtOffset(d, -300) != "2025-04-13" || listingISO(d) != "2025-04-14" {
		t.Errorf("new year 2025 tamil-nadu = %s, want the 2025-04-14 UTC midnight, 2025-04-13 at -300", listingISO(d))
	}
	coords := types.HinduDateCoords{VikramSamvat: 2081, MasaIndex: 11, Paksha: types.PakshaShukla, PakshaTithi: 11}
	days, err := s.ConvertHinduToGregorian(coords, listingNY, convert)
	if err != nil || !reflect.DeepEqual(inZone(days), []string{"2025-03-09"}) {
		t.Fatalf("convertHinduToGregorian read at -300 = %v (err %v), want [2025-03-09]", inZone(days), err)
	}
	back, err := s.ConvertGregorianToHindu(days[0].Time(), listingNY, convert)
	if err != nil || back.VikramSamvat != 2081 || back.MasaIndex != 11 || back.Paksha != types.PakshaShukla || back.PakshaTithi != 11 {
		t.Errorf("round trip = %+v (err %v), want the coordinates back", back, err)
	}

	table, err := s.BuildFestivalsTable(types.BuildFestivalsTableOptions{
		Location: listingNY, TimezoneOffsetMinutes: -300, StartYear: 2025, EndYear: 2026,
		Languages: []types.FestivalsTableLanguage{types.TableLangEn},
	})
	if err != nil {
		t.Fatal(err)
	}
	for year, rows := range table.Years {
		for _, r := range rows {
			if !strings.HasPrefix(r.Date, year+"-") {
				t.Errorf("%s is filed under %s", r.Date, year)
			}
		}
	}
	keys := []string{}
	for _, r := range table.Years["2025"] {
		if r.Date == "2025-12-31" {
			for _, i := range r.Festivals {
				keys = append(keys, table.Dict[i].Key)
			}
		}
	}
	if !listingContains(keys, "masik_karthigai") || !listingContains(keys, "pradosha") {
		t.Errorf("2025-12-31 holds %v, want masik_karthigai and pradosha", keys)
	}
}

func TestYears1900And2100WorkAtEveryOffset(t *testing.T) {
	s := New()
	pune := types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
	for _, c := range []struct {
		year, tz int
		loc      types.GeoLocation
	}{{1900, 330, pune}, {1900, -300, listingNY}, {2100, 330, pune}, {2100, -300, listingNY}} {
		name := strconv.Itoa(c.year) + "@" + strconv.Itoa(c.tz)
		prefix := strconv.Itoa(c.year) + "-"
		phases, err := s.ComputeMoonPhasesForYear(c.year, types.MoonPhasesForYearOptions{Timezone: OffsetMinutes(c.tz)})
		if err != nil || len(phases) < 48 {
			t.Errorf("%s moon phases: %d, %v", name, len(phases), err)
		}
		eclipses, err := s.ComputeEclipsesForYear(c.year, c.loc, OffsetMinutes(c.tz))
		if err != nil {
			t.Errorf("%s eclipses: %v", name, err)
		}
		for _, e := range eclipses {
			if !strings.HasPrefix(listingAtOffset(e.PeakMs, c.tz), prefix) {
				t.Errorf("%s eclipse %s outside the year", name, e.PeakMs.ISOString())
			}
		}
		festivals, err := s.ComputeFestivalsForYear(c.year, c.loc, types.YearlyListingOptions{Timezone: OffsetMinutes(c.tz)})
		if err != nil || len(festivals) < 200 {
			t.Errorf("%s festivals: %d, %v", name, len(festivals), err)
		}
		for _, f := range festivals {
			if !strings.HasPrefix(listingAtOffset(f.Date, c.tz), prefix) {
				t.Errorf("%s festival %s outside the year", name, f.Date.ISOString())
			}
		}
		scored, err := s.ComputeAuspiciousDatesForYear(c.year, VivahRule(), c.loc,
			types.MuhurtaScoreOptions{Timezone: OffsetMinutes(c.tz), IncludeFailures: true})
		if err != nil {
			t.Fatalf("%s auspicious dates: %v", name, err)
		}
		got := []string{}
		for _, d := range scored {
			got = append(got, listingAtOffset(d.Date, c.tz))
		}
		sort.Strings(got)
		if !reflect.DeepEqual(got, listingDatesOfYear(c.year)) {
			t.Errorf("%s scored %d days, want every date of the year once", name, len(got))
		}
		muhurta, err := s.BuildMuhurtaTable(types.BuildMuhurtaTableOptions{
			Rule: VivahRule(), Location: c.loc, TimezoneOffsetMinutes: c.tz,
			StartYear: c.year, EndYear: c.year, IncludeFailures: true,
		})
		if err != nil {
			t.Fatalf("%s muhurta table: %v", name, err)
		}
		dates := []string{}
		for _, d := range muhurta.Years[strconv.Itoa(c.year)] {
			dates = append(dates, d.Date)
		}
		if !reflect.DeepEqual(dates, listingDatesOfYear(c.year)) {
			t.Errorf("%s muhurta table holds %d days, want every date of the year", name, len(dates))
		}
		moon, err := s.BuildMoonPhasesTable(types.BuildMoonPhasesTableOptions{
			TimezoneOffsetMinutes: c.tz, StartYear: c.year, EndYear: c.year,
		})
		if err != nil || len(moon.Years[strconv.Itoa(c.year)]) < 48 {
			t.Errorf("%s moon phases table: %v", name, err)
		}
		visible := false
		if _, err := s.BuildEclipsesTable(types.BuildEclipsesTableOptions{
			Location: c.loc, TimezoneOffsetMinutes: c.tz, StartYear: c.year, EndYear: c.year, VisibleOnly: &visible,
		}); err != nil {
			t.Errorf("%s eclipses table: %v", name, err)
		}
		fest, err := s.BuildFestivalsTable(types.BuildFestivalsTableOptions{
			Location: c.loc, TimezoneOffsetMinutes: c.tz, StartYear: c.year, EndYear: c.year,
			Languages: []types.FestivalsTableLanguage{types.TableLangEn},
		})
		if err != nil {
			t.Errorf("%s festivals table: %v", name, err)
		}
		for _, r := range fest.Years[strconv.Itoa(c.year)] {
			if !strings.HasPrefix(r.Date, prefix) {
				t.Errorf("%s festivals table files %s", name, r.Date)
			}
		}
	}

	if _, err := s.ComputeMoonPhasesForYear(1899, types.MoonPhasesForYearOptions{Timezone: OffsetMinutes(330)}); !errors.Is(err, &types.PanchangError{Code: types.ErrInvalidDate}) {
		t.Errorf("1899 at +330: %v, want ErrInvalidDate", err)
	}
	if _, err := s.ComputeMoonPhasesForYear(2101, types.MoonPhasesForYearOptions{Timezone: OffsetMinutes(-300)}); !errors.Is(err, &types.PanchangError{Code: types.ErrInvalidDate}) {
		t.Errorf("2101 at -300: %v, want ErrInvalidDate", err)
	}
}

func TestTwoDigitYearsAreNotTheNineteenHundreds(t *testing.T) {
	s := New()
	pune := types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
	ist := OffsetMinutes(330)
	calls := map[string]func() error{
		"auspicious": func() error {
			_, err := s.ComputeAuspiciousDatesForYear(26, VivahRule(), pune, types.MuhurtaScoreOptions{Timezone: ist})
			return err
		},
		"festivals": func() error {
			_, err := s.ComputeFestivalsForYear(50, pune, types.YearlyListingOptions{Timezone: ist})
			return err
		},
		"eclipses": func() error { _, err := s.ComputeEclipsesForYear(50, pune, ist); return err },
		"moonPhases": func() error {
			_, err := s.ComputeMoonPhasesForYear(50, types.MoonPhasesForYearOptions{Timezone: ist})
			return err
		},
		"newYear": func() error {
			_, _, err := s.GetHinduNewYear(50, "all", pune, types.ConvertOptions{Timezone: ist})
			return err
		},
		"muhurtaTable": func() error {
			_, err := s.BuildMuhurtaTable(types.BuildMuhurtaTableOptions{
				Rule: VivahRule(), Location: pune, TimezoneOffsetMinutes: 330, StartYear: 26, EndYear: 26,
			})
			return err
		},
		"festivalsTable": func() error {
			_, err := s.BuildFestivalsTable(types.BuildFestivalsTableOptions{
				Location: pune, TimezoneOffsetMinutes: 330, StartYear: 0, EndYear: 0,
				Languages: []types.FestivalsTableLanguage{types.TableLangEn},
			})
			return err
		},
		"moonPhasesTable": func() error {
			_, err := s.BuildMoonPhasesTable(types.BuildMoonPhasesTableOptions{TimezoneOffsetMinutes: 330, StartYear: 26, EndYear: 26})
			return err
		},
		"eclipsesTable": func() error {
			_, err := s.BuildEclipsesTable(types.BuildEclipsesTableOptions{Location: pune, TimezoneOffsetMinutes: 330, StartYear: 26, EndYear: 26})
			return err
		},
	}
	for name, call := range calls {
		if err := call(); !errors.Is(err, &types.PanchangError{Code: types.ErrInvalidDate}) {
			t.Errorf("%s: %v, want ErrInvalidDate", name, err)
		}
	}

	for _, c := range []struct {
		year, month, day, vikram int
	}{{50, 6, 1, 107}, {99, 6, 1, 156}, {99, 1, 5, 155}} {
		sv, err := s.ComputeSamvat(time.Date(c.year, time.Month(c.month), c.day, 0, 0, 0, 0, time.UTC))
		if err != nil || sv.VikramSamvat != c.vikram {
			t.Errorf("samvat %04d-%02d-%02d = %d (%v), want %d", c.year, c.month, c.day, sv.VikramSamvat, err, c.vikram)
		}
	}
}

func TestKshayaPratipadaOpensTheYearOnItsContainingDay(t *testing.T) {
	s := New()
	festivals, err := s.ComputeFestivalsInRange(time.Date(2026, 3, 16, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 3, 23, 0, 0, 0, 0, time.UTC), listingDelhi, types.YearlyListingOptions{Timezone: OffsetMinutes(330)})
	if err != nil {
		t.Fatal(err)
	}
	ugadi := []string{}
	for _, f := range festivals {
		if f.Festival.Key == "ugadi" {
			ugadi = append(ugadi, listingAtOffset(f.Date, 330))
		}
	}
	if !reflect.DeepEqual(ugadi, []string{"2026-03-19"}) {
		t.Fatalf("ugadi on %v, want [2026-03-19]", ugadi)
	}
	for _, region := range []types.FestivalRegion{"all", "maharashtra", "karnataka"} {
		d, ok, err := s.GetHinduNewYear(2026, region, listingDelhi, types.ConvertOptions{Timezone: OffsetMinutes(330)})
		if err != nil || !ok || listingISO(d) != "2026-03-19" {
			t.Errorf("%s: %s (ok %v, err %v), want 2026-03-19", region, listingISO(d), ok, err)
		}
	}
}

func TestAdhikaChaitraKrishnaRoundTripsInPurnimanta(t *testing.T) {
	s := New()
	ist := types.ConvertOptions{Timezone: OffsetMinutes(330)}
	hindu, err := s.ConvertGregorianToHindu(time.Date(2029, 4, 5, 6, 0, 0, 0, time.UTC), listingDelhi, ist)
	if err != nil {
		t.Fatal(err)
	}
	if hindu.MasaIndex != 0 || hindu.Paksha != types.PakshaKrishna || hindu.PakshaTithi != 7 ||
		!hindu.IsAdhika || hindu.VikramSamvat != 2086 {
		t.Fatalf("2029-04-05 is %+v, want Adhika Chaitra Krishna 7, VS 2086", hindu)
	}
	coords := types.HinduDateCoords{VikramSamvat: 2086, MasaIndex: 0, Paksha: types.PakshaKrishna, PakshaTithi: 7}
	all, err := s.ConvertHinduToGregorian(coords, listingDelhi, ist)
	if err != nil || !reflect.DeepEqual(listingDates(all), []string{"2029-04-05", "2030-03-25"}) {
		t.Errorf("all months: %v (%v), want [2029-04-05 2030-03-25]", listingDates(all), err)
	}
	coords.AdhikaOnly = true
	adhika, err := s.ConvertHinduToGregorian(coords, listingDelhi, ist)
	if err != nil || !reflect.DeepEqual(listingDates(adhika), []string{"2029-04-05"}) {
		t.Errorf("adhika only: %v (%v), want [2029-04-05]", listingDates(adhika), err)
	}
}

func TestEclipsesAreSelectedByPeak(t *testing.T) {
	s := New()
	pune := types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
	a, err := s.ComputeEclipsesInRange(time.Date(1976, 4, 29, 11, 0, 0, 0, time.UTC), time.Date(1976, 4, 30, 0, 0, 0, 0, time.UTC), pune)
	if err != nil || len(a) != 1 || a[0].PeakMs.ISOString() != "1976-04-29T12:22:11.020Z" {
		t.Errorf("1976-04-29 from 11:00Z: %d eclipses (%v), want the one peaking 12:22:11.020Z", len(a), err)
	}
	b, err := s.ComputeEclipsesInRange(time.Date(2042, 10, 14, 1, 0, 0, 0, time.UTC), time.Date(2042, 10, 15, 0, 0, 0, 0, time.UTC), pune)
	if err != nil || len(b) != 0 {
		t.Errorf("2042-10-14 from 01:00Z: %d eclipses (%v), want none (it peaked at 00:05Z)", len(b), err)
	}

	count := func(year int, loc types.GeoLocation, tz types.Timezone, peakMs int64) int {
		es, err := s.ComputeEclipsesForYear(year, loc, tz)
		if err != nil {
			t.Fatal(err)
		}
		n := 0
		for _, e := range es {
			if d := e.PeakMs.Ms() - peakMs; d > -60_000 && d < 60_000 {
				n++
			}
		}
		return n
	}
	darwin := types.GeoLocation{Latitude: -12.4634, Longitude: 130.8456}
	peak := time.Date(2066, 12, 31, 14, 28, 6, 335_000_000, time.UTC).UnixMilli()
	if got := []int{count(2066, darwin, Zone("Australia/Darwin"), peak), count(2067, darwin, Zone("Australia/Darwin"), peak)}; !reflect.DeepEqual(got, []int{1, 0}) {
		t.Errorf("Darwin 2066/2067 list the eclipse %v times, want [1 0]", got)
	}
	straddle := time.Date(2009, 12, 31, 19, 22, 39, 805_000_000, time.UTC).UnixMilli()
	if got := []int{count(2009, listingDelhi, OffsetMinutes(285), straddle), count(2010, listingDelhi, OffsetMinutes(285), straddle)}; !reflect.DeepEqual(got, []int{0, 1}) {
		t.Errorf("+04:45 2009/2010 list the eclipse %v times, want [0 1]", got)
	}
}

func TestTrisprishaEkadashiOn31DecemberStaysInItsYear(t *testing.T) {
	s := New()
	opts := types.YearlyListingOptions{Timezone: OffsetMinutes(330)}
	y1911, err := s.ComputeEkadashiDatesForYear(1911, listingDelhi, opts)
	if err != nil {
		t.Fatal(err)
	}
	y1912, err := s.ComputeEkadashiDatesForYear(1912, listingDelhi, opts)
	if err != nil {
		t.Fatal(err)
	}
	if last := listingISO(y1911[len(y1911)-1]); last != "1911-12-31" {
		t.Errorf("1911 ends %s, want 1911-12-31", last)
	}
	if listingContains(listingDates(y1912), "1912-01-01") {
		t.Error("1912 lists 1912-01-01, the Vaishnava day of 1911-12-31's trisprisha fast")
	}
}

// dayConventionFixture is testdata/almanac/almanac-day-convention-2026-09.json,
// shared with the TypeScript day-convention-almanac test.
type dayConventionFixture struct {
	PanaSankranti struct {
		Location types.GeoLocation `json:"location"`
		Entries  []struct {
			Year int    `json:"year"`
			Date string `json:"date"`
		} `json:"entries"`
	} `json:"panaSankranti"`
	WestOfUtc2027 struct {
		Location   types.GeoLocation `json:"location"`
		Timezone   int               `json:"timezone"`
		Sankrantis []struct {
			Rashi int    `json:"rashi"`
			Day   string `json:"day"`
		} `json:"sankrantis"`
		NewYears []struct {
			Region types.FestivalRegion `json:"region"`
			Day    string               `json:"day"`
		} `json:"newYears"`
	} `json:"westOfUtc2027"`
}

func readDayConventionFixture(t *testing.T) dayConventionFixture {
	t.Helper()
	raw, err := repopath.ReadTestData("almanac", "almanac-day-convention-2026-09.json")
	if err != nil {
		t.Fatal(err)
	}
	var fx dayConventionFixture
	if err := json.Unmarshal(raw, &fx); err != nil {
		t.Fatal(err)
	}
	if len(fx.PanaSankranti.Entries) != 10 || len(fx.WestOfUtc2027.Sankrantis) != 11 || len(fx.WestOfUtc2027.NewYears) != 6 {
		t.Fatalf("fixture shape changed: %d Pana Sankranti entries, %d Sankrantis, %d new years",
			len(fx.PanaSankranti.Entries), len(fx.WestOfUtc2027.Sankrantis), len(fx.WestOfUtc2027.NewYears))
	}
	return fx
}

func TestPanaSankrantiMatchesTheReferenceAlmanac(t *testing.T) {
	fx := readDayConventionFixture(t)
	s := New()
	kolkata := listingZone(t, "Asia/Kolkata")
	for _, e := range fx.PanaSankranti.Entries {
		for _, tz := range []types.Timezone{OffsetMinutes(330), Zone("Asia/Kolkata")} {
			d, ok, err := s.GetHinduNewYear(e.Year, types.RegionOdisha, fx.PanaSankranti.Location, types.ConvertOptions{Timezone: tz})
			if err != nil || !ok {
				t.Fatalf("odisha %d: ok %v err %v", e.Year, ok, err)
			}
			if got := d.Time().In(kolkata).Format("2006-01-02"); got != e.Date || listingISO(d) != e.Date {
				t.Errorf("odisha %d = %s (%s in IST), want %s", e.Year, listingISO(d), got, e.Date)
			}
		}
	}
}

func TestWestOfUTCSankrantisAndSolarNewYearsFallWithinTheLocalDay(t *testing.T) {
	fx := readDayConventionFixture(t)
	w := fx.WestOfUtc2027
	s := New()
	ny := listingZone(t, "America/New_York")
	zones := []struct {
		name string
		tz   types.Timezone
		read func(types.JSDate) string
	}{
		{strconv.Itoa(w.Timezone), OffsetMinutes(w.Timezone), func(d types.JSDate) string { return listingAtOffset(d, w.Timezone) }},
		{"America/New_York", Zone("America/New_York"), func(d types.JSDate) string { return d.Time().In(ny).Format("2006-01-02") }},
	}
	for _, z := range zones {
		list, err := s.ComputeSankrantisForYear(2027, w.Location, types.YearlyListingOptions{Timezone: z.tz})
		if err != nil {
			t.Fatal(err)
		}
		for _, want := range w.Sankrantis {
			found := false
			for _, e := range list {
				if e.Rashi != want.Rashi {
					continue
				}
				found = true
				if got := z.read(e.Date); got != want.Day || e.Date.Time().UTC().Hour() != 0 {
					t.Errorf("%s: rashi %d Sankranti %s reads %s, want %s", z.name, want.Rashi, e.Date.ISOString(), got, want.Day)
				}
			}
			if !found {
				t.Errorf("%s: rashi %d missing from 2027", z.name, want.Rashi)
			}
		}
		for _, want := range w.NewYears {
			d, ok, err := s.GetHinduNewYear(2027, want.Region, w.Location, types.ConvertOptions{Timezone: z.tz})
			if err != nil || !ok {
				t.Fatalf("%s: %s new year ok %v err %v", z.name, want.Region, ok, err)
			}
			if got := z.read(d); got != want.Day {
				t.Errorf("%s: %s new year %s reads %s, want %s", z.name, want.Region, d.ISOString(), got, want.Day)
			}
		}
	}
}
