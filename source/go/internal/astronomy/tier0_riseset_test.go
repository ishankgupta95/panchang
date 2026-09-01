package astronomy

import (
	"encoding/json"
	"errors"
	"math"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

type usnoFixture struct {
	Source    string `json:"source"`
	Retrieved string `json:"retrieved"`
	Note      string `json:"note"`
	Rows      []struct {
		Location  string   `json:"location"`
		Latitude  float64  `json:"latitude"`
		Longitude float64  `json:"longitude"`
		Tz        float64  `json:"tz"`
		Date      string   `json:"date"`
		Sunrise   *string  `json:"sunrise"`
		Sunset    *string  `json:"sunset"`
		Moonrise  *string  `json:"moonrise"`
		Moonset   *string  `json:"moonset"`
		SunFlags  []string `json:"sunFlags"`
		MoonFlags []string `json:"moonFlags"`
	} `json:"rows"`
}

func localMidnightUtc(t *testing.T, date string, tzHours float64) int64 {
	t.Helper()
	parts := strings.Split(date, "-")
	if len(parts) != 3 {
		t.Fatalf("fixture date %q is not YYYY-MM-DD", date)
	}
	y, _ := strconv.Atoi(parts[0])
	m, _ := strconv.Atoi(parts[1])
	d, _ := strconv.Atoi(parts[2])
	utc := time.Date(y, time.Month(m), d, 0, 0, 0, 0, time.UTC).UnixMilli()
	return utc - int64(tzHours*3600_000)
}

func TestTier0USNORiseSet(t *testing.T) {
	raw, err := repopath.ReadTestData("reference", "usno-riseset.json")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var f usnoFixture
	if err := json.Unmarshal(raw, &f); err != nil {
		t.Fatalf("parse fixture: %v", err)
	}

	if len(f.Rows) < 72 {
		t.Fatalf("fixture has %d rows, expected at least 72", len(f.Rows))
	}
	sites := map[string]struct{}{}
	hasPolar := false
	for _, r := range f.Rows {
		sites[r.Location] = struct{}{}
		if math.Abs(r.Latitude) >= 80 {
			hasPolar = true
		}
	}
	if len(sites) < 9 {
		t.Errorf("fixture covers %d sites, expected at least 9", len(sites))
	}
	if !hasPolar {
		t.Error("fixture has no site at |latitude| >= 80; the presence assertion below is the point of those")
	}

	ClearRiseSetTracks()
	ctx := NewEphemerisCtx()

	type delta struct {
		body    string
		seconds float64
		where   string
	}
	var deltas []delta
	var presenceMismatches []string

	eventWithin := func(kind string, start int64, loc types.GeoLocation) (int64, bool) {
		var ms int64
		var ok bool
		var err error
		switch kind {
		case "sunrise":
			ms, err = ComputeSunrise(ctx, start, loc, DefaultRiseSetLimitDays)
			ok = err == nil
		case "sunset":
			ms, err = ComputeSunset(ctx, start, loc, DefaultRiseSetLimitDays)
			ok = err == nil
		case "moonrise":
			ms, ok, err = GetMoonrise(ctx, start, loc, DefaultRiseSetLimitDays)
		case "moonset":
			ms, ok, err = GetMoonset(ctx, start, loc, DefaultRiseSetLimitDays)
		}
		if err != nil {
			if errors.Is(err, types.ErrNoSunriseSentinel) || errors.Is(err, types.ErrNoSunsetSentinel) {
				return 0, false
			}
			t.Fatalf("%s: unexpected error %v", kind, err)
		}
		if !ok {
			return 0, false
		}
		if ms >= start && ms < start+dayMS {
			return ms, true
		}
		return 0, false
	}

	kinds := []struct{ key, body string }{
		{"sunrise", "sun"}, {"sunset", "sun"},
		{"moonrise", "moon"}, {"moonset", "moon"},
	}

	for _, row := range f.Rows {
		start := localMidnightUtc(t, row.Date, row.Tz)
		loc := types.GeoLocation{Latitude: row.Latitude, Longitude: row.Longitude}
		published := map[string]*string{
			"sunrise": row.Sunrise, "sunset": row.Sunset,
			"moonrise": row.Moonrise, "moonset": row.Moonset,
		}
		for _, k := range kinds {
			pub := published[k.key]
			mine, haveMine := eventWithin(k.key, start, loc)
			if pub == nil && !haveMine {
				continue
			}
			if pub == nil || !haveMine {
				got := "none"
				if haveMine {
					got = time.UnixMilli(mine).UTC().Format(time.RFC3339Nano)
				}
				want := "none"
				if pub != nil {
					want = *pub
				}
				presenceMismatches = append(presenceMismatches,
					row.Location+" "+row.Date+" "+k.key+": USNO "+want+", ours "+got)
				continue
			}
			hm := strings.Split(*pub, ":")
			hh, _ := strconv.Atoi(hm[0])
			mm, _ := strconv.Atoi(hm[1])
			truth := start + int64(hh*3600+mm*60)*1000
			deltas = append(deltas, delta{
				body:    k.body,
				seconds: float64(mine-truth) / 1000,
				where:   row.Location + " " + row.Date + " " + k.key,
			})
		}
	}

	if len(deltas) < 200 {
		t.Fatalf("only %d comparable events; the fixture or the solver has shrunk", len(deltas))
	}

	if len(presenceMismatches) != 0 {
		show := presenceMismatches
		if len(show) > 5 {
			show = show[:5]
		}
		t.Errorf("%d event-presence mismatches with USNO: %s",
			len(presenceMismatches), strings.Join(show, " | "))
	}

	for _, body := range []string{"sun", "moon"} {
		var worst delta
		var sumAbs, sum float64
		n := 0
		for _, d := range deltas {
			if d.body != body {
				continue
			}
			n++
			if math.Abs(d.seconds) > math.Abs(worst.seconds) {
				worst = d
			}
			sumAbs += math.Abs(d.seconds)
			sum += d.seconds
		}
		if n == 0 {
			t.Fatalf("no %s events scored", body)
		}
		meanAbs := sumAbs / float64(n)
		bias := sum / float64(n)
		if math.Abs(worst.seconds) >= 60 {
			t.Errorf("%s: worst %.1f s at %s; mean |Δ| %.1f s, bias %.1f s (bound 60 s)",
				body, worst.seconds, worst.where, meanAbs, bias)
		}
		if math.Abs(bias) >= 10 {
			t.Errorf("%s: bias %.1f s (bound 10 s)", body, bias)
		}
		t.Logf("%s: n=%d worst %.1f s at %s, mean |Δ| %.1f s, bias %.1f s",
			body, n, worst.seconds, worst.where, meanAbs, bias)
	}
	t.Logf("%d comparable events across %d sites, %d presence mismatches",
		len(deltas), len(sites), len(presenceMismatches))
}
