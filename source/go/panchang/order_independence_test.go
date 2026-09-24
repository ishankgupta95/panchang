package panchang

import (
	"encoding/json"
	"math/rand"
	"testing"
	"time"

	"github.com/ishankgupta95/panchang/source/go/v5/types"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/core"
)

// orderCall is one public call, named so its results can be matched up.
type orderCall struct {
	name string
	run  func(s *Session) any
}

func orderResult(v any, err error) any {
	if err != nil {
		return "error: " + err.Error()
	}
	return v
}

// orderCalls is a mix of public calls whose inputs overlap: the same days,
// lunations, eclipses and birth instants reached by different routes, which is
// where a memo that answered from history rather than from its key would show.
func orderCalls() []orderCall {
	nyc := types.GeoLocation{Latitude: 40.7128, Longitude: -74.006}
	tromso := types.GeoLocation{Latitude: 69.6496, Longitude: 18.956}
	day := func(y, m, d int) time.Time { return time.Date(y, time.Month(m), d, 0, 0, 0, 0, time.UTC) }
	birth := time.Date(1987, 3, 14, 5, 42, 0, 0, time.UTC)
	calls := []orderCall{}
	add := func(name string, run func(s *Session) any) { calls = append(calls, orderCall{name, run}) }

	for d := 0; d < 12; d++ {
		d := d
		at := day(2025, 9, 1).AddDate(0, 0, d*3)
		add("daily-pune-"+at.Format("0102"), func(s *Session) any {
			r, ok, err := s.GetDailyPanchang(at, pune, ist())
			return orderResult([]any{r, ok}, err)
		})
		add("instant-pune-"+at.Format("0102"), func(s *Session) any {
			r, ok, err := s.GetInstantPanchang(at.Add(7*time.Hour+time.Duration(d)*53*time.Minute), pune, types.InstantPanchangOptions{})
			return orderResult([]any{r, ok}, err)
		})
		add("g2h-pune-"+at.Format("0102"), func(s *Session) any {
			return orderResult(s.ConvertGregorianToHindu(at, pune, types.ConvertOptions{Timezone: OffsetMinutes(330)}))
		})
	}
	add("daily-nyc-zone", func(s *Session) any {
		r, ok, err := s.GetDailyPanchang(day(2024, 3, 10), nyc, types.PanchangOptions{Timezone: Zone("America/New_York")})
		return orderResult([]any{r, ok}, err)
	})
	add("daily-tromso-edge", func(s *Session) any {
		r, ok, err := s.GetDailyPanchang(day(2025, 1, 16), tromso, types.PanchangOptions{Timezone: OffsetMinutes(60)})
		return orderResult([]any{r, ok}, err)
	})
	add("festivals-range", func(s *Session) any {
		return orderResult(s.ComputeFestivalsInRange(day(2025, 9, 1), day(2025, 10, 5), pune,
			types.YearlyListingOptions{Timezone: OffsetMinutes(330)}))
	})
	add("h2g", func(s *Session) any {
		return orderResult(s.ConvertHinduToGregorian(types.HinduDateCoords{VikramSamvat: 2082, MasaIndex: 6,
			Paksha: types.PakshaShukla, PakshaTithi: 10}, pune, types.ConvertOptions{Timezone: OffsetMinutes(330)}))
	})
	add("hindu-new-year", func(s *Session) any {
		d, ok, err := s.GetHinduNewYear(2026, "", pune, types.ConvertOptions{Timezone: OffsetMinutes(330)})
		return orderResult([]any{d, ok}, err)
	})
	add("upcoming-eclipses", func(s *Session) any {
		return orderResult(s.GetUpcomingEclipses(day(2025, 6, 1), pune, 3))
	})
	add("eclipses-range", func(s *Session) any {
		return orderResult(s.ComputeEclipsesInRange(day(2025, 8, 1), day(2026, 3, 31), pune))
	})
	// Overlapping walks reach the same phases and eclipses from different
	// seeds, which is where a search answered from a nearby key would differ
	// by a millisecond.
	for k := 0; k < 8; k++ {
		from := day(2025, 9, 1).Add(time.Duration(k) * (61*time.Hour + 17*time.Minute))
		add("moon-phases-"+from.Format("0102T15"), func(s *Session) any {
			return orderResult(s.ComputeMoonPhasesInRange(from, from.AddDate(0, 2, 0)))
		})
		add("next-lunar-"+from.Format("0102T15"), func(s *Session) any {
			e, ok := s.GetUpcomingLunarEclipse(from, pune, 400, types.LanguageEn)
			return []any{e, ok}
		})
		add("next-solar-"+from.Format("0102T15"), func(s *Session) any {
			e, ok := s.GetUpcomingSolarEclipse(from, nyc, 1200, types.LanguageEn)
			return []any{e, ok}
		})
	}
	add("muhurta-score", func(s *Session) any {
		return orderResult(s.ScoreMuhurta(day(2025, 9, 7), pune, VivahRule(), types.MuhurtaScoreOptions{Timezone: OffsetMinutes(330)}))
	})
	add("auspicious-range", func(s *Session) any {
		return orderResult(s.ComputeAuspiciousDatesInRange(VivahRule(), day(2025, 9, 1), day(2025, 9, 30), pune,
			types.MuhurtaScoreOptions{Timezone: OffsetMinutes(330), IncludeFailures: true}))
	})
	for r := 0; r < 12; r += 5 {
		r := r
		add("sade-sati-"+string(rune('a'+r)), func(s *Session) any {
			return orderResult(s.ComputeSadeSati(r, day(2025, 9, 1), types.Lahiri))
		})
	}
	add("rashi-chart", func(s *Session) any {
		return orderResult(s.ComputeRashiChart(birth, pune, types.BirthChartOptions{}))
	})
	add("bhava-kp", func(s *Session) any {
		return orderResult(s.ComputeBhava(birth, pune, types.BirthChartOptions{HouseSystem: types.HouseSystemPlacidusKP}))
	})
	add("kp-cusps", func(s *Session) any {
		return orderResult(s.ComputeKpCuspalSubLords(birth, pune, types.BirthChartOptions{}))
	})
	add("narayan-variable", func(s *Session) any {
		return orderResult(s.ComputeNarayanDashaVariable(birth, pune, types.Lahiri, day(2025, 9, 1)))
	})
	add("shadbala", func(s *Session) any {
		return orderResult(s.ComputeShadbala(birth, pune, types.BirthChartOptions{}))
	})
	add("navamsa", func(s *Session) any {
		return orderResult(s.ComputeNavamsa(birth, pune, types.BirthChartOptions{Ayanamsa: types.Raman}))
	})
	return calls
}

func clearProcessMemos() {
	astronomy.ClearEphemerisMemos()
	astronomy.ClearBlockStores()
	astronomy.ClearRiseSetTracks()
	core.ClearChaitraCache()
}

func runOrder(t *testing.T, calls []orderCall, order []int, session func() *Session) map[string]string {
	t.Helper()
	out := make(map[string]string, len(calls))
	for _, i := range order {
		b, err := json.Marshal(calls[i].run(session()))
		if err != nil {
			t.Fatalf("%s: %v", calls[i].name, err)
		}
		out[calls[i].name] = string(b)
	}
	return out
}

func shuffled(n int, seed int64) []int {
	order := rand.New(rand.NewSource(seed)).Perm(n)
	return order
}

// Every result must be the same whatever ran before it in the process or in
// the Session: the memos answer only from exact keys of pure evaluations.
// The mixed calls run in two shuffled orders on one shared Session each, and
// on a fresh Session per call, with the process memos cleared before each run.
// (Goroutines sharing the memos are raced in internal/core and
// internal/astronomy, the packages CI runs under -race.)
func TestResultsDoNotDependOnCallOrder(t *testing.T) {
	calls := orderCalls()
	n := len(calls)

	clearProcessMemos()
	shared := New()
	first := runOrder(t, calls, shuffled(n, 1), func() *Session { return shared })

	clearProcessMemos()
	other := New()
	second := runOrder(t, calls, shuffled(n, 2), func() *Session { return other })

	clearProcessMemos()
	fresh := runOrder(t, calls, shuffled(n, 3), New)

	compare := func(label string, got map[string]string) {
		t.Helper()
		for _, c := range calls {
			if got[c.name] != first[c.name] {
				t.Errorf("%s: %s differs from the first shared-Session order", label, c.name)
			}
		}
	}
	compare("second shared-Session order", second)
	compare("fresh Session per call", fresh)
}
