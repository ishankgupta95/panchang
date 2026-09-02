package astronomy

import (
	"encoding/json"
	"fmt"
	"math"
	"runtime"
	"sync"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
)

type lunarRow struct {
	Date                 string  `json:"date"`
	JdGreatestTt         float64 `json:"jdGreatestTt"`
	Kind                 string  `json:"kind"`
	Type                 string  `json:"type"`
	PenumbralMagnitude   float64 `json:"penumbralMagnitude"`
	UmbralMagnitude      float64 `json:"umbralMagnitude"`
	PenumbralDurationMin float64 `json:"penumbralDurationMin"`
	PartialDurationMin   float64 `json:"partialDurationMin"`
	TotalDurationMin     float64 `json:"totalDurationMin"`
}

type solarRow struct {
	Date                string  `json:"date"`
	JdGreatestTt        float64 `json:"jdGreatestTt"`
	Kind                string  `json:"kind"`
	Type                string  `json:"type"`
	Gamma               float64 `json:"gamma"`
	Magnitude           float64 `json:"magnitude"`
	GreatestLatitude    float64 `json:"greatestLatitude"`
	GreatestLongitude   float64 `json:"greatestLongitude"`
	GreatestSunAltitude float64 `json:"greatestSunAltitude"`
}

type localRow struct {
	Date           string  `json:"date"`
	GlobalType     string  `json:"globalType"`
	LocalType      string  `json:"localType"`
	Begins         string  `json:"begins"`
	BeginsFlag     string  `json:"beginsFlag"`
	Maximum        string  `json:"maximum"`
	MaximumFlag    string  `json:"maximumFlag"`
	Ends           string  `json:"ends"`
	EndsFlag       string  `json:"endsFlag"`
	SunAltitudeDeg float64 `json:"sunAltitudeDeg"`
	SunAzimuthDeg  float64 `json:"sunAzimuthDeg"`
	Magnitude      float64 `json:"magnitude"`
	Obscuration    float64 `json:"obscuration"`
}

type localSite struct {
	Name           string     `json:"name"`
	Latitude       float64    `json:"latitude"`
	Longitude      float64    `json:"longitude"`
	UtcOffsetHours float64    `json:"utcOffsetHours"`
	Eclipses       []localRow `json:"eclipses"`
}

type eclipseCanon struct {
	Lunar []lunarRow `json:"lunar"`
	Solar []solarRow `json:"solar"`
}

type localCanonFile struct {
	Sites []localSite `json:"sites"`
}

func loadEclipseCanon(t *testing.T) eclipseCanon {
	t.Helper()
	b, err := repopath.ReadTestData("reference", "nasa-eclipses.json")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var c eclipseCanon
	if err := json.Unmarshal(b, &c); err != nil {
		t.Fatalf("parse fixture: %v", err)
	}
	return c
}

func loadLocalCanon(t *testing.T) localCanonFile {
	t.Helper()
	b, err := repopath.ReadTestData("reference", "nasa-eclipse-local.json")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var c localCanonFile
	if err := json.Unmarshal(b, &c); err != nil {
		t.Fatalf("parse fixture: %v", err)
	}
	return c
}

func ttJulianDateToUtc(jdTt float64) int64 {
	ttDays := jdTt - j2000JD
	ms := float64(j2000NoonMS) + ttDays*dayMS
	for i := 0; i < 3; i++ {
		ms += (ttDays - TTDaysSinceJ2000(int64(ms))) * dayMS
	}
	return int64(ms)
}

func utcToTtJulianDate(ms int64) float64 { return TTDaysSinceJ2000(ms) + j2000JD }

type worst struct {
	value float64
	where string
	sum   float64
	count int
}

func (w *worst) add(delta float64, where string) {
	w.sum += delta
	w.count++
	if math.Abs(delta) > math.Abs(w.value) {
		w.value, w.where = delta, where
	}
}

func (w *worst) merge(o *worst) {
	w.sum += o.sum
	w.count += o.count
	if math.Abs(o.value) > math.Abs(w.value) {
		w.value, w.where = o.value, o.where
	}
}

func (w *worst) bias() float64 {
	if w.count == 0 {
		return 0
	}
	return w.sum / float64(w.count)
}

func (w *worst) label() string {
	return fmt.Sprintf("max %.4f at %s (n=%d, bias %.4f)", w.value, w.where, w.count, w.bias())
}

func parallelRows(n int, body func(ctx *EphemerisCtx, i int)) {
	workers := runtime.GOMAXPROCS(0)
	if workers > n {
		workers = n
	}
	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			ctx := NewEphemerisCtx()
			for i := w; i < n; i += workers {
				body(ctx, i)
			}
		}(w)
	}
	wg.Wait()
}

func TestTier0LunarEclipsesVsNASACanon(t *testing.T) {
	canon := loadEclipseCanon(t)
	if len(canon.Lunar) != 457 {
		t.Fatalf("fixture has %d lunar rows, expected 457", len(canon.Lunar))
	}

	type result struct {
		peak, penumbralMagnitude, umbralMagnitude         worst
		penumbralDuration, partialDuration, totalDuration worst
		typeMismatches, notFound                          []string
	}
	results := make([]result, len(canon.Lunar))

	parallelRows(len(canon.Lunar), func(ctx *EphemerisCtx, i int) {
		row := canon.Lunar[i]
		r := &results[i]
		approximate := ttJulianDateToUtc(row.JdGreatestTt)
		opposition, ok := SearchMoonPhase(ctx, 180, approximate-3*dayMS, 8)
		if !ok {
			r.notFound = append(r.notFound, row.Date+" "+row.Type)
			return
		}
		eclipse, found := FindLunarEclipse(ctx, opposition)
		if !found {
			r.notFound = append(r.notFound, row.Date+" "+row.Type)
			return
		}

		r.peak.add((utcToTtJulianDate(eclipse.PeakMs)-row.JdGreatestTt)*86400, row.Date)
		r.penumbralMagnitude.add(eclipse.PenumbralMagnitude-row.PenumbralMagnitude, row.Date)
		r.umbralMagnitude.add(eclipse.UmbralMagnitude-row.UmbralMagnitude, row.Date)
		r.penumbralDuration.add(
			float64(eclipse.PenumbralEndMs-eclipse.PenumbralBeginMs)/60_000-row.PenumbralDurationMin, row.Date)
		if row.PartialDurationMin > 0 && eclipse.PartialBeginMs != nil && eclipse.PartialEndMs != nil {
			r.partialDuration.add(
				float64(*eclipse.PartialEndMs-*eclipse.PartialBeginMs)/60_000-row.PartialDurationMin, row.Date)
		}
		if row.TotalDurationMin > 0 && eclipse.TotalBeginMs != nil && eclipse.TotalEndMs != nil {
			r.totalDuration.add(
				float64(*eclipse.TotalEndMs-*eclipse.TotalBeginMs)/60_000-row.TotalDurationMin, row.Date)
		}

		expected := LunarPenumbral
		switch row.Kind {
		case "T":
			expected = LunarTotal
		case "P":
			expected = LunarPartial
		}
		if eclipse.Kind != expected {
			r.typeMismatches = append(r.typeMismatches,
				fmt.Sprintf("%s canon %s (%s) vs ours %s", row.Date, row.Type, expected, eclipse.Kind))
		}
	})

	var peak, penumbralMagnitude, umbralMagnitude worst
	var penumbralDuration, partialDuration, totalDuration worst
	var typeMismatches, notFound []string
	for i := range results {
		peak.merge(&results[i].peak)
		penumbralMagnitude.merge(&results[i].penumbralMagnitude)
		umbralMagnitude.merge(&results[i].umbralMagnitude)
		penumbralDuration.merge(&results[i].penumbralDuration)
		partialDuration.merge(&results[i].partialDuration)
		totalDuration.merge(&results[i].totalDuration)
		typeMismatches = append(typeMismatches, results[i].typeMismatches...)
		notFound = append(notFound, results[i].notFound...)
	}

	if len(notFound) != 0 {
		t.Errorf("every canon eclipse must be found; %d missing: %v", len(notFound), first(notFound, 5))
	}
	if len(typeMismatches) != 0 {
		t.Errorf("eclipse type is an invariant, not a tolerance; %d mismatches: %v",
			len(typeMismatches), first(typeMismatches, 5))
	}

	for _, c := range []struct {
		label string
		w     *worst
		bound float64
	}{
		{"greatest eclipse (s TT)", &peak, 4.5},
		{"penumbral magnitude", &penumbralMagnitude, 0.0004},
		{"umbral magnitude", &umbralMagnitude, 0.0007},
		{"penumbral duration (min)", &penumbralDuration, 1.2},
		{"partial duration (min)", &partialDuration, 0.5},
		{"total duration (min)", &totalDuration, 1.1},
	} {
		if math.Abs(c.w.value) >= c.bound {
			t.Errorf("%s: %s, bound %v", c.label, c.w.label(), c.bound)
		}
		t.Logf("%-26s %s", c.label, c.w.label())
	}
}

func TestTier0PublishedLunarFields(t *testing.T) {
	canon := loadEclipseCanon(t)
	observer := types.GeoLocation{Latitude: 28.6139, Longitude: 77.2090}

	const boundaryBand = 0.002

	type result struct {
		magnitude                           worst
		notFound, misclassified, outOfRange []string
		penumbralWithObscuration, identical []string
		boundaryRows, negatives, aboveOne   int
		obscurationLower, obscurationHigher int
	}
	results := make([]result, len(canon.Lunar))

	parallelRows(len(canon.Lunar), func(ctx *EphemerisCtx, i int) {
		row := canon.Lunar[i]
		r := &results[i]
		approximate := ttJulianDateToUtc(row.JdGreatestTt)
		info, ok := GetUpcomingLunarEclipse(ctx, approximate-3*dayMS, observer, 6, types.LanguageEn)
		if !ok || abs64(info.PeakMs.Ms()-approximate) > dayMS {
			r.notFound = append(r.notFound, row.Date+" "+row.Type)
			return
		}

		r.magnitude.add(info.Magnitude-row.UmbralMagnitude, row.Date)
		if info.Magnitude < 0 {
			r.negatives++
		}
		if info.Magnitude > 1 {
			r.aboveOne++
		}
		if info.Obscuration < 0 || info.Obscuration > 1 {
			r.outOfRange = append(r.outOfRange,
				fmt.Sprintf("%s obscuration %v", row.Date, info.Obscuration))
		}

		canonKind := "penumbral"
		switch row.Kind {
		case "T":
			canonKind = "total"
		case "P":
			canonKind = "partial"
		}
		nearBoundary := math.Abs(row.UmbralMagnitude) < boundaryBand ||
			math.Abs(row.UmbralMagnitude-1) < boundaryBand
		if nearBoundary {
			r.boundaryRows++
		} else {
			implied := "penumbral"
			if info.Magnitude >= 1 {
				implied = "total"
			} else if info.Magnitude > 0 {
				implied = "partial"
			}
			if implied != canonKind {
				r.misclassified = append(r.misclassified,
					fmt.Sprintf("%s canon %s vs magnitude %v", row.Date, canonKind, info.Magnitude))
			}
		}

		if canonKind == "penumbral" && info.Obscuration != 0 {
			r.penumbralWithObscuration = append(r.penumbralWithObscuration,
				fmt.Sprintf("%s %v", row.Date, info.Obscuration))
		}
		if canonKind == "partial" && row.UmbralMagnitude > 0.05 && row.UmbralMagnitude < 0.95 {
			if info.Obscuration == info.Magnitude {
				r.identical = append(r.identical, row.Date)
			}
			if info.Obscuration < info.Magnitude {
				r.obscurationLower++
			}
			if info.Obscuration > info.Magnitude {
				r.obscurationHigher++
			}
		}
	})

	var magnitude worst
	var notFound, misclassified, outOfRange, penumbralWithObscuration, identical []string
	boundaryRows, negatives, aboveOne, obscurationLower, obscurationHigher := 0, 0, 0, 0, 0
	for i := range results {
		magnitude.merge(&results[i].magnitude)
		notFound = append(notFound, results[i].notFound...)
		misclassified = append(misclassified, results[i].misclassified...)
		outOfRange = append(outOfRange, results[i].outOfRange...)
		penumbralWithObscuration = append(penumbralWithObscuration, results[i].penumbralWithObscuration...)
		identical = append(identical, results[i].identical...)
		boundaryRows += results[i].boundaryRows
		negatives += results[i].negatives
		aboveOne += results[i].aboveOne
		obscurationLower += results[i].obscurationLower
		obscurationHigher += results[i].obscurationHigher
	}

	if len(notFound) != 0 {
		t.Errorf("every canon eclipse must be reachable through the public path; %d missing: %v",
			len(notFound), first(notFound, 5))
	}
	if len(misclassified) != 0 {
		t.Errorf("the sign of the published magnitude encodes the type; %v", first(misclassified, 5))
	}
	if len(outOfRange) != 0 {
		t.Errorf("obscuration is an area fraction and lives in [0, 1]; %v", first(outOfRange, 5))
	}
	if len(penumbralWithObscuration) != 0 {
		t.Errorf("a penumbral eclipse touches no umbra, so umbral obscuration is 0; %v",
			first(penumbralWithObscuration, 5))
	}
	if len(identical) != 0 {
		t.Errorf("obscuration and magnitude are different quantities; identical on %v",
			first(identical, 5))
	}
	if boundaryRows >= 10 {
		t.Errorf("%d rows in the boundary exclusion band, expected fewer than 10", boundaryRows)
	}
	if math.Abs(magnitude.value) >= 0.0007 {
		t.Errorf("published magnitude vs canon umbral: %s, bound 0.0007", magnitude.label())
	}
	if negatives != 169 {
		t.Errorf("%d eclipses publish a negative magnitude, expected 169 penumbral", negatives)
	}
	if aboveOne != 166 {
		t.Errorf("%d eclipses publish a magnitude above 1, expected 166 total", aboveOne)
	}
	if obscurationLower == 0 {
		t.Error("no shallow partial covers less area than diameter")
	}
	if obscurationHigher == 0 {
		t.Error("no deep partial covers more area than diameter")
	}
	t.Logf("published magnitude: %s; %d negative, %d above one, %d/%d obscuration below/above magnitude",
		magnitude.label(), negatives, aboveOne, obscurationLower, obscurationHigher)
}

func first(s []string, n int) []string {
	if len(s) > n {
		return s[:n]
	}
	return s
}
