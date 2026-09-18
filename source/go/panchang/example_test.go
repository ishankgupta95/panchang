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
