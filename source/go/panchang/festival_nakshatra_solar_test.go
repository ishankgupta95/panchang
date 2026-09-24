package panchang

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"testing"
	"time"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

type nakshatraSolarOptions struct {
	Region     types.FestivalRegion `json:"region"`
	MasaSystem types.MasaSystem     `json:"masaSystem"`
}

type nakshatraSolarFixture struct {
	YearLists []struct {
		Key      string                `json:"key"`
		City     string                `json:"city"`
		Location types.GeoLocation     `json:"location"`
		Timezone int                   `json:"timezone"`
		Options  nakshatraSolarOptions `json:"options"`
		Year     int                   `json:"year"`
		Dates    []string              `json:"dates"`
		Source   string                `json:"source"`
	} `json:"yearLists"`
	Entries []struct {
		Key             string            `json:"key"`
		Date            string            `json:"date"`
		City            string            `json:"city"`
		Location        types.GeoLocation `json:"location"`
		Timezone        int               `json:"timezone"`
		AloneWithinDays int               `json:"aloneWithinDays"`
		Ordinal         int               `json:"ordinal"`
		Source          string            `json:"source"`
	} `json:"entries"`
}

type nakshatraSolarDay struct{ key, date string }

// TestNakshatraSolarFestivalsMatchReference pins Masik Karthigai, Karthigai
// Deepam, Onam and the masaSystem-aware vara rules to the reference dates the
// TypeScript suite also reads.
func TestNakshatraSolarFestivalsMatchReference(t *testing.T) {
	raw, err := repopath.ReadTestData("almanac", "almanac-festival-rules-2026-09-nakshatra-solar.json")
	if err != nil {
		t.Fatal(err)
	}
	var fx nakshatraSolarFixture
	if err := json.Unmarshal(raw, &fx); err != nil {
		t.Fatal(err)
	}
	s := New()
	cache := map[string][]nakshatraSolarDay{}
	days := func(year int, loc types.GeoLocation, offset int, o nakshatraSolarOptions) []nakshatraSolarDay {
		id := fmt.Sprint(year, loc, offset, o)
		if got, ok := cache[id]; ok {
			return got
		}
		list, err := s.ComputeFestivalsForYear(year, loc, types.YearlyListingOptions{
			Timezone: OffsetMinutes(offset), Region: o.Region, MasaSystem: o.MasaSystem,
		})
		if err != nil {
			t.Fatalf("%d %v: %v", year, loc, err)
		}
		out := make([]nakshatraSolarDay, len(list))
		for i, f := range list {
			out[i] = nakshatraSolarDay{f.Festival.Key, listingAtOffset(f.Date, offset)}
		}
		cache[id] = out
		return out
	}
	dates := func(ds []nakshatraSolarDay, keep func(string) bool) []string {
		out := []string{}
		for _, d := range ds {
			if keep(d.key) {
				out = append(out, d.date)
			}
		}
		return out
	}

	for _, l := range fx.YearLists {
		got := dates(days(l.Year, l.Location, l.Timezone, l.Options), func(k string) bool { return k == l.Key })
		if !reflect.DeepEqual(got, l.Dates) {
			t.Errorf("%s %s %d %+v: got %v, want %v (%s)", l.Key, l.City, l.Year, l.Options, got, l.Dates, l.Source)
		}
	}

	for _, e := range fx.Entries {
		year, _ := strconv.Atoi(e.Date[:4])
		own := dates(days(year, e.Location, e.Timezone, nakshatraSolarOptions{}),
			func(k string) bool { return k == e.Key })
		at := -1
		for i, d := range own {
			if d == e.Date {
				at = i
			}
		}
		if at < 0 {
			t.Errorf("%s %s %s: not emitted (%s)", e.Key, e.City, e.Date, e.Source)
			continue
		}
		if e.Ordinal != 0 && at+1 != e.Ordinal {
			t.Errorf("%s %s %s: emission %d of the year, want %d (%s)", e.Key, e.City, e.Date, at+1, e.Ordinal, e.Source)
		}
		if e.AloneWithinDays != 0 {
			target, _ := time.Parse("2006-01-02", e.Date)
			near := []string{}
			for _, y := range []int{year - 1, year, year + 1} {
				mid := time.Date(y, 7, 1, 0, 0, 0, 0, time.UTC)
				if d := target.Sub(mid); d > 190*24*time.Hour || d < -190*24*time.Hour {
					continue
				}
				for _, d := range dates(days(y, e.Location, e.Timezone, nakshatraSolarOptions{}), func(k string) bool {
					return k == "masik_karthigai" || k == "karthigai_deepam"
				}) {
					at, _ := time.Parse("2006-01-02", d)
					if gap := at.Sub(target); gap <= time.Duration(e.AloneWithinDays)*24*time.Hour &&
						gap >= -time.Duration(e.AloneWithinDays)*24*time.Hour {
						near = append(near, d)
					}
				}
			}
			if !reflect.DeepEqual(near, []string{e.Date}) {
				t.Errorf("%s %s %s: Karthigai days within %d days are %v (%s)", e.Key, e.City, e.Date,
					e.AloneWithinDays, near, e.Source)
			}
		}
	}
}
