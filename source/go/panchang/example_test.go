package panchang_test

import (
	"errors"
	"fmt"
	"time"

	"github.com/ishankgupta95/panchang/source/go/v5/panchang"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

// A Session carries the ephemeris memo, so reuse one for every date you look
// up and give each goroutine its own.
func Example() {
	s := panchang.New()

	when := time.Date(2025, 7, 4, 0, 0, 0, 0, time.UTC)
	pune := types.GeoLocation{Latitude: 18.52, Longitude: 73.86}

	day, ok, err := s.GetDailyPanchang(when, pune, types.PanchangOptions{
		Timezone: panchang.OffsetMinutes(330),
	})
	if err != nil {
		panic(err)
	}
	if !ok {
		return // a polar day with no sunrise, not a failure
	}

	fmt.Println("tithi:    ", day.Angas.Tithis[0].Name)
	fmt.Println("nakshatra:", day.Angas.Nakshatras[0].Name)
	// Output:
	// tithi:     Shukla Navami
	// nakshatra: Chitra
}

// Sections selects which of the optional sections GetDailyPanchang computes.
// It is honoured only when SectionsGiven is true, so the zero PanchangOptions
// still computes everything. Here only the moon times are requested, so the
// festivals section stays empty even on a festival day.
func ExampleSections() {
	s := panchang.New()

	day, ok, _ := s.GetDailyPanchang(
		time.Date(2025, 10, 20, 0, 0, 0, 0, time.UTC), // Diwali
		types.GeoLocation{Latitude: 18.52, Longitude: 73.86},
		types.PanchangOptions{
			Timezone:      panchang.OffsetMinutes(330),
			Sections:      panchang.Sections(types.SectionMoonTimes),
			SectionsGiven: true,
		},
	)
	if !ok {
		return
	}

	fmt.Println("moonrise computed:", day.Moon.Rise != nil)
	fmt.Println("festivals skipped:", len(day.Festivals) == 0)
	// Output:
	// moonrise computed: true
	// festivals skipped: true
}

// Errors carry a stable code. Branch on it, never on the message text.
func ExampleIsCode() {
	s := panchang.New()

	_, _, err := s.GetDailyPanchang(
		time.Date(2025, 7, 4, 0, 0, 0, 0, time.UTC),
		types.GeoLocation{Latitude: 200, Longitude: 73.86},
		types.PanchangOptions{Timezone: panchang.OffsetMinutes(330)},
	)

	fmt.Println("bad latitude:", panchang.IsCode(err, types.ErrInvalidLatitude))

	// errors.As reaches the code itself when you need more than a yes or no.
	var pe *types.PanchangError
	if errors.As(err, &pe) {
		fmt.Println("code:        ", pe.Code)
	}
	// Output:
	// bad latitude: true
	// code:         INVALID_LATITUDE
}

// A birth chart is cast for an instant and a place. Build the instant in the
// zone the birth time was recorded in; here, 10:30 in the morning IST.
func ExampleSession_ComputeRashiChart() {
	s := panchang.New()
	ist := time.FixedZone("IST", 330*60)
	delhi := types.GeoLocation{Latitude: 28.6139, Longitude: 77.2090}

	chart, err := s.ComputeRashiChart(time.Date(1990, 8, 1, 10, 30, 0, 0, ist), delhi,
		types.BirthChartOptions{})
	if err != nil {
		panic(err)
	}
	fmt.Printf("lagna: %s %.2f, %s pada %d\n", chart.Lagna.Rashi.Name,
		chart.Lagna.DegreeInRashi, chart.Lagna.Nakshatra.Name, chart.Lagna.Pada)
	fmt.Printf("moon:  %s, house %d\n", chart.ByPlanet.Moon.Rashi.Name, chart.ByPlanet.Moon.House)

	// The eight-karaka Jaimini scheme ranks Rahu too and adds Pitrukaraka.
	karakas, err := panchang.ComputeJaimini8Karakas(&chart)
	if err != nil {
		panic(err)
	}
	for _, role := range panchang.AllKaraka8Names() {
		graha, _ := karakas.Get(role)
		fmt.Printf("%-13s %s\n", role, graha)
	}
	// Output:
	// lagna: Kanya 16.62, Hasta pada 2
	// moon:  Vrischika, house 3
	// Atmakaraka    Saturn
	// Amatyakaraka  Venus
	// Bhratrukaraka Mars
	// Matrukaraka   Rahu
	// Pitrukaraka   Sun
	// Putrakaraka   Moon
	// Gnatikaraka   Mercury
	// Darakaraka    Jupiter
}

// The yearly listing walks every day of a Gregorian year. Each FestivalDay
// carries the instant it was found at, which Time renders in the listing's
// own zone.
func ExampleSession_ComputeFestivalsForYear() {
	s := panchang.New()
	ist := time.FixedZone("IST", 330*60)
	delhi := types.GeoLocation{Latitude: 28.6139, Longitude: 77.2090}

	days, err := s.ComputeFestivalsForYear(2025, delhi, types.YearlyListingOptions{
		Timezone: panchang.OffsetMinutes(330),
	})
	if err != nil {
		panic(err)
	}
	wanted := map[string]bool{"holi": true, "rama_navami": true, "krishna_janmashtami": true,
		"ganesh_chaturthi": true, "dussehra": true, "diwali": true}
	for _, d := range days {
		if wanted[d.Festival.Key] {
			fmt.Println(d.Date.Time().In(ist).Format("Mon 2 Jan"), d.Festival.Name)
		}
	}
	// Output:
	// Fri 14 Mar Holi
	// Sun 6 Apr Rama Navami
	// Fri 15 Aug Krishna Janmashtami
	// Wed 27 Aug Ganesh Chaturthi
	// Thu 2 Oct Dussehra
	// Mon 20 Oct Diwali
}

// A table is computed once, saved as JSON and read back later with no
// Session, by this module or by the TypeScript package. The Read functions
// take the either-layout form, which AsAny gives for a table just built.
func ExampleSession_BuildFestivalsTable() {
	s := panchang.New()
	table, err := s.BuildFestivalsTable(types.BuildFestivalsTableOptions{
		StartYear:             2025,
		EndYear:               2025,
		Location:              types.GeoLocation{Latitude: 28.6139, Longitude: 77.2090},
		TimezoneOffsetMinutes: 330,
	})
	if err != nil {
		panic(err)
	}
	read := table.AsAny()

	for _, f := range panchang.ReadFestivalsForDateKey(read, "2025-10-20", types.TableLangEn) {
		fmt.Println(f.Key, f.Name)
	}
	for _, f := range panchang.ReadFestivalsForDateKey(read, "2025-10-20", types.TableLangHi) {
		fmt.Println(f.Key, f.Name)
	}
	_, ok := panchang.ReadFestivalsForYear(read, 2026, "")
	fmt.Println("2026 covered:", ok)
	// Output:
	// narak_chaturdashi Narak Chaturdashi
	// diwali Diwali
	// kartik_somvar Kartik Somvar
	// narak_chaturdashi नरक चतुर्दशी
	// diwali दिवाली
	// kartik_somvar कार्तिक सोमवार
	// 2026 covered: false
}

// A muhurta search scores every day in a range against an occasion's rule
// and returns the days that pass, best first.
func ExampleSession_FindAuspiciousDates() {
	s := panchang.New()
	ist := time.FixedZone("IST", 330*60)
	delhi := types.GeoLocation{Latitude: 28.6139, Longitude: 77.2090}

	days, err := s.FindAuspiciousDates(panchang.VivahRule(),
		time.Date(2025, 11, 1, 0, 0, 0, 0, ist), time.Date(2025, 11, 30, 0, 0, 0, 0, ist),
		delhi, types.MuhurtaScoreOptions{Timezone: panchang.OffsetMinutes(330)})
	if err != nil {
		panic(err)
	}
	for _, d := range days[:3] {
		fmt.Println(d.Date.Time().In(ist).Format("Mon 2 Jan"), d.Score,
			d.Panchang.Angas.Nakshatras[0].Name)
	}
	// Output:
	// Fri 21 Nov 85 Anuradha
	// Mon 3 Nov 80 Uttara Bhadrapada
	// Fri 7 Nov 75 Rohini
}

// A muhurta table keeps a whole year of scores for one occasion, and the
// readers pick from it without recomputing anything.
func ExampleReadBestMuhurtaDays() {
	s := panchang.New()
	table, err := s.BuildMuhurtaTable(types.BuildMuhurtaTableOptions{
		Rule:                  panchang.VivahRule(),
		StartYear:             2025,
		EndYear:               2025,
		Location:              types.GeoLocation{Latitude: 28.6139, Longitude: 77.2090},
		TimezoneOffsetMinutes: 330,
	})
	if err != nil {
		panic(err)
	}

	fmt.Println(panchang.ReadMuhurtaOccasion(table), panchang.ReadMuhurtaYearRange(table))
	for _, d := range panchang.ReadBestMuhurtaDays(table, 3) {
		fmt.Println(d.Date, d.Score)
	}
	day, ok := panchang.ReadMuhurtaForDateKey(table, "2025-11-21")
	fmt.Println(day.Date, day.Score, ok)
	// Output:
	// vivah {2025 2025}
	// 2025-05-23 100
	// 2025-12-22 95
	// 2025-03-12 90
	// 2025-11-21 85 true
}
