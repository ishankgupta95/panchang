package calendar

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"hash"
	"math"
	"strconv"
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/core"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

type calLocation struct {
	Name      string         `json:"name"`
	Latitude  float64        `json:"latitude"`
	Longitude float64        `json:"longitude"`
	Timezone  types.Timezone `json:"timezone"`
	Years     []int          `json:"years"`
}

func (l calLocation) geo() types.GeoLocation {
	return types.GeoLocation{Latitude: l.Latitude, Longitude: l.Longitude}
}

func (l calLocation) yearlyOptions() YearlyListingOptions {
	return YearlyListingOptions{Timezone: l.Timezone}
}

type calSankranti struct {
	Date      int64  `json:"date"`
	Moment    int64  `json:"moment"`
	Rashi     int    `json:"rashi"`
	RashiName string `json:"rashiName"`
}

type calEclipse struct {
	Kind        string  `json:"kind"`
	Subtype     string  `json:"subtype"`
	Peak        int64   `json:"peak"`
	Start       int64   `json:"start"`
	End         int64   `json:"end"`
	Obscuration float64 `json:"obscuration"`
	Magnitude   float64 `json:"magnitude"`
	Visible     bool    `json:"visible"`
	SutakStart  *int64  `json:"sutakStart"`
	SutakEnd    *int64  `json:"sutakEnd"`
}

type calCase struct {
	Label         string          `json:"label"`
	Ekadashi      json.RawMessage `json:"ekadashi"`
	Sankrantis    json.RawMessage `json:"sankrantis"`
	Eclipses      json.RawMessage `json:"eclipses"`
	FestivalCount json.RawMessage `json:"festivalCount"`
	FestivalFirst *string         `json:"festivalFirst"`
	FestivalLast  *string         `json:"festivalLast"`
}

type calHindu struct {
	TithiName    string `json:"tithiName"`
	Tithi        int    `json:"tithi"`
	PakshaTithi  int    `json:"pakshaTithi"`
	Paksha       Paksha `json:"paksha"`
	MasaName     string `json:"masaName"`
	MasaIndex    int    `json:"masaIndex"`
	IsAdhika     bool   `json:"isAdhika"`
	VikramSamvat int    `json:"vikramSamvat"`
	ShakaSamvat  int    `json:"shakaSamvat"`
	VaraName     string `json:"varaName"`
	VaraIndex    int    `json:"varaIndex"`
}

type calConvertCase struct {
	Key               string          `json:"key"`
	Hindu             json.RawMessage `json:"hindu"`
	RoundTrip         json.RawMessage `json:"roundTrip"`
	RoundTripContains *bool           `json:"roundTripContains"`
}

type calEraCase struct {
	Key      string          `json:"key"`
	Samvat   json.RawMessage `json:"samvat"`
	KaliYuga json.RawMessage `json:"kaliYuga"`
}

type calNewYearCase struct {
	Key string          `json:"key"`
	At  json.RawMessage `json:"at"`
}

type calUpcomingCase struct {
	Key      string          `json:"key"`
	Eclipses json.RawMessage `json:"eclipses"`
}

type yearlyGolden struct {
	Meta struct {
		Claim string `json:"claim"`
	} `json:"_meta"`
	Locations      []calLocation     `json:"locations"`
	Regions        []string          `json:"regions"`
	Digest         string            `json:"digest"`
	ConvertDigest  string            `json:"convertDigest"`
	EraDigest      string            `json:"eraDigest"`
	NewYearDigest  string            `json:"newYearDigest"`
	UpcomingDigest string            `json:"upcomingDigest"`
	OutcomeCounts  map[string]int    `json:"outcomeCounts"`
	GuardHits      map[string]int    `json:"guardHits"`
	Cases          []calCase         `json:"cases"`
	ConvertCases   []calConvertCase  `json:"convertCases"`
	Eras           []calEraCase      `json:"eras"`
	NewYears       []calNewYearCase  `json:"newYears"`
	Upcoming       []calUpcomingCase `json:"upcoming"`
}

func loadYearlyGolden(t *testing.T) yearlyGolden {
	t.Helper()
	raw, err := repopath.ReadTestData("goldens", "calendar", "yearly-golden.json")
	if err != nil {
		t.Fatalf("reading yearly-golden.json: %v", err)
	}
	var g yearlyGolden
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatalf("parsing yearly-golden.json: %v", err)
	}
	if len(g.Cases) == 0 || len(g.ConvertCases) == 0 {
		t.Fatalf("golden is empty: %d cases, %d convert cases", len(g.Cases), len(g.ConvertCases))
	}
	return g
}

func errTag(err error) string {
	var pe *types.PanchangError
	if errors.As(err, &pe) {
		return "error:" + string(pe.Code)
	}
	return "error:THROW"
}

func isErrTag(raw json.RawMessage) (string, bool) {
	if len(raw) == 0 || raw[0] != '"' {
		return "", false
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return "", false
	}
	return s, true
}

func nOrN(p *int64) string {
	if p == nil {
		return "n"
	}
	return strconv.FormatInt(*p, 10)
}

func TestCalendarMatchesTypeScript(t *testing.T) {
	g := loadYearlyGolden(t)
	h := sha256.New()
	outcomeCounts := map[string]int{}

	for _, loc := range g.Locations {
		geo := loc.geo()
		opts := loc.yearlyOptions()
		for _, year := range loc.Years {
			label := fmt.Sprintf("%s|%d", loc.Name, year)
			ctx := &astronomy.EphemerisCtx{}

			ekadashi, ekErr := ComputeEkadashiDatesForYear(ctx, year, geo, opts)
			sankrantis, saErr := ComputeSankrantisForYear(ctx, year, geo, opts)
			eclipses, ecErr := ComputeEclipsesForYear(ctx, year, geo, loc.Timezone)
			festivals, feErr := ComputeFestivalsForYear(ctx, year, geo, opts)

			h.Write([]byte(label + " "))

			if ekErr != nil {
				h.Write([]byte("E:" + errTag(ekErr) + " "))
			} else {
				parts := make([]string, len(ekadashi))
				for i, d := range ekadashi {
					parts[i] = strconv.FormatInt(d.Ms(), 10)
				}
				h.Write([]byte("E:" + strings.Join(parts, ",") + " "))
			}

			if saErr != nil {
				h.Write([]byte("S:" + errTag(saErr) + " "))
			} else {
				for _, s := range sankrantis {
					h.Write([]byte(fmt.Sprintf("%d/%d/%d/%s;",
						s.Date.Ms(), s.Moment.Ms(), s.Rashi, s.RashiName)))
				}
			}

			if ecErr != nil {
				h.Write([]byte("X:" + errTag(ecErr) + " "))
			} else {
				for _, e := range eclipses {
					var ss, se *int64
					if e.SutakStartMs != nil {
						v := e.SutakStartMs.Ms()
						ss = &v
					}
					if e.SutakEndMs != nil {
						v := e.SutakEndMs.Ms()
						se = &v
					}
					vis := 0
					if e.VisibleFromLocation {
						vis = 1
					}
					h.Write([]byte(fmt.Sprintf("%s/%s/%d/%d/%d/%d/%s/%s;",
						e.Kind, e.Subtype, e.StartMs.Ms(), e.PeakMs.Ms(), e.EndMs.Ms(),
						vis, nOrN(ss), nOrN(se))))
				}
			}

			first, last := "n", "n"
			countField := "0"
			if feErr != nil {
				countField = errTag(feErr)
			} else {
				countField = strconv.Itoa(len(festivals))
				if len(festivals) > 0 {
					first = fmt.Sprintf("%d|%s", festivals[0].Date.Ms(), festivals[0].Festival.Key)
					last = fmt.Sprintf("%d|%s",
						festivals[len(festivals)-1].Date.Ms(),
						festivals[len(festivals)-1].Festival.Key)
				}
			}
			h.Write([]byte(fmt.Sprintf("F:%s/%s/%s\n", countField, first, last)))

			outcome := strings.Join([]string{
				tagOrOK(ekErr), tagOrOK(saErr), tagOrOK(ecErr), tagOrOK(feErr),
			}, ",")
			outcomeCounts[outcome]++
		}
	}

	if got := hex.EncodeToString(h.Sum(nil)); got != g.Digest {
		t.Errorf("calendar digest mismatch:\n  want %s\n  got  %s", g.Digest, got)
	}
	for k, want := range g.OutcomeCounts {
		if outcomeCounts[k] != want {
			t.Errorf("outcome %q: want %d, got %d", k, want, outcomeCounts[k])
		}
	}
	for k, got := range outcomeCounts {
		if _, ok := g.OutcomeCounts[k]; !ok {
			t.Errorf("outcome %q: not in golden, got %d", k, got)
		}
	}
}

func tagOrOK(err error) string {
	if err == nil {
		return "ok"
	}
	return errTag(err)
}

func TestCalendarExplicitCases(t *testing.T) {
	g := loadYearlyGolden(t)
	var worstObscuration, worstMagnitude float64
	defer func() {
		t.Logf("eclipse float divergence: worst |Δ| obscuration = %g, magnitude = %g (band %g)",
			worstObscuration, worstMagnitude, eclipseFloatBand)
	}()
	byLabel := map[string]calCase{}
	for _, c := range g.Cases {
		byLabel[c.Label] = c
	}

	for _, loc := range g.Locations {
		geo := loc.geo()
		opts := loc.yearlyOptions()
		for _, year := range loc.Years {
			label := fmt.Sprintf("%s|%d", loc.Name, year)
			want, ok := byLabel[label]
			if !ok {
				t.Fatalf("golden has no case %q", label)
			}
			ctx := &astronomy.EphemerisCtx{}

			ekadashi, err := ComputeEkadashiDatesForYear(ctx, year, geo, opts)
			if tag, isErr := isErrTag(want.Ekadashi); isErr {
				if err == nil || errTag(err) != tag {
					t.Errorf("%s ekadashi: want %s, got %v", label, tag, err)
				}
			} else {
				var wantMs []int64
				if e := json.Unmarshal(want.Ekadashi, &wantMs); e != nil {
					t.Fatalf("%s: %v", label, e)
				}
				if err != nil {
					t.Errorf("%s ekadashi: unexpected error %v", label, err)
				} else if len(ekadashi) != len(wantMs) {
					t.Errorf("%s ekadashi: want %d dates, got %d", label, len(wantMs), len(ekadashi))
				} else {
					for i := range wantMs {
						if ekadashi[i].Ms() != wantMs[i] {
							t.Errorf("%s ekadashi[%d]: want %d, got %d",
								label, i, wantMs[i], ekadashi[i].Ms())
						}
					}
				}
			}

			sankrantis, err := ComputeSankrantisForYear(ctx, year, geo, opts)
			if tag, isErr := isErrTag(want.Sankrantis); isErr {
				if err == nil || errTag(err) != tag {
					t.Errorf("%s sankrantis: want %s, got %v", label, tag, err)
				}
			} else {
				var wantS []calSankranti
				if e := json.Unmarshal(want.Sankrantis, &wantS); e != nil {
					t.Fatalf("%s: %v", label, e)
				}
				if err != nil {
					t.Errorf("%s sankrantis: unexpected error %v", label, err)
				} else if len(sankrantis) != len(wantS) {
					t.Errorf("%s sankrantis: want %d, got %d", label, len(wantS), len(sankrantis))
				} else {
					for i, w := range wantS {
						got := sankrantis[i]
						if got.Date.Ms() != w.Date || got.Moment.Ms() != w.Moment ||
							got.Rashi != w.Rashi || got.RashiName != w.RashiName {
							t.Errorf("%s sankranti[%d]: want %+v, got date=%d moment=%d rashi=%d name=%s",
								label, i, w, got.Date.Ms(), got.Moment.Ms(), got.Rashi, got.RashiName)
						}
					}
				}
			}

			eclipses, err := ComputeEclipsesForYear(ctx, year, geo, loc.Timezone)
			if tag, isErr := isErrTag(want.Eclipses); isErr {
				if err == nil || errTag(err) != tag {
					t.Errorf("%s eclipses: want %s, got %v", label, tag, err)
				}
			} else {
				var wantE []calEclipse
				if e := json.Unmarshal(want.Eclipses, &wantE); e != nil {
					t.Fatalf("%s: %v", label, e)
				}
				if err != nil {
					t.Errorf("%s eclipses: unexpected error %v", label, err)
				} else if len(eclipses) != len(wantE) {
					t.Errorf("%s eclipses: want %d, got %d", label, len(wantE), len(eclipses))
				} else {
					for i, w := range wantE {
						got := eclipses[i]
						if string(got.Kind) != w.Kind || string(got.Subtype) != w.Subtype ||
							got.PeakMs.Ms() != w.Peak || got.StartMs.Ms() != w.Start ||
							got.EndMs.Ms() != w.End ||
							got.VisibleFromLocation != w.Visible {
							t.Errorf("%s eclipse[%d]: want %+v, got %s/%s start=%d peak=%d end=%d vis=%v",
								label, i, w, got.Kind, got.Subtype, got.StartMs.Ms(),
								got.PeakMs.Ms(), got.EndMs.Ms(), got.VisibleFromLocation)
						}
						if d := math.Abs(got.Obscuration - w.Obscuration); d > eclipseFloatBand {
							t.Errorf("%s eclipse[%d].obscuration: |Δ| = %g exceeds %g (want %v, got %v)",
								label, i, d, eclipseFloatBand, w.Obscuration, got.Obscuration)
						} else if d > worstObscuration {
							worstObscuration = d
						}
						if d := math.Abs(got.Magnitude - w.Magnitude); d > eclipseFloatBand {
							t.Errorf("%s eclipse[%d].magnitude: |Δ| = %g exceeds %g (want %v, got %v)",
								label, i, d, eclipseFloatBand, w.Magnitude, got.Magnitude)
						} else if d > worstMagnitude {
							worstMagnitude = d
						}
						if (got.SutakStartMs == nil) != (w.SutakStart == nil) ||
							(got.SutakEndMs == nil) != (w.SutakEnd == nil) {
							t.Errorf("%s eclipse[%d]: sutak presence differs", label, i)
						} else if got.SutakStartMs != nil &&
							(got.SutakStartMs.Ms() != *w.SutakStart || got.SutakEndMs.Ms() != *w.SutakEnd) {
							t.Errorf("%s eclipse[%d]: sutak window differs", label, i)
						}
					}
				}
			}

			festivals, err := ComputeFestivalsForYear(ctx, year, geo, opts)
			if tag, isErr := isErrTag(want.FestivalCount); isErr {
				if err == nil || errTag(err) != tag {
					t.Errorf("%s festivals: want %s, got %v", label, tag, err)
				}
				continue
			}
			var wantCount int
			if e := json.Unmarshal(want.FestivalCount, &wantCount); e != nil {
				t.Fatalf("%s: %v", label, e)
			}
			if err != nil {
				t.Errorf("%s festivals: unexpected error %v", label, err)
				continue
			}
			if len(festivals) != wantCount {
				t.Errorf("%s festivals: want %d, got %d", label, wantCount, len(festivals))
			}
			if wantCount > 0 && len(festivals) > 0 {
				gotFirst := fmt.Sprintf("%d|%s", festivals[0].Date.Ms(), festivals[0].Festival.Key)
				gotLast := fmt.Sprintf("%d|%s",
					festivals[len(festivals)-1].Date.Ms(),
					festivals[len(festivals)-1].Festival.Key)
				if want.FestivalFirst == nil || *want.FestivalFirst != gotFirst {
					t.Errorf("%s festivals first: want %v, got %s", label, want.FestivalFirst, gotFirst)
				}
				if want.FestivalLast == nil || *want.FestivalLast != gotLast {
					t.Errorf("%s festivals last: want %v, got %s", label, want.FestivalLast, gotLast)
				}
			}
		}
	}
}

func TestConvertMatchesTypeScript(t *testing.T) {
	g := loadYearlyGolden(t)
	ch := sha256.New()
	eh := sha256.New()
	nh := sha256.New()
	uh := sha256.New()

	for _, loc := range g.Locations {
		geo := loc.geo()
		opts := ConvertOptions{Timezone: loc.Timezone}
		for _, year := range loc.Years {
			for day := 1; day <= 365; day += 29 {
				ms := types.DateUTC(year, 0, 1).Ms() + int64(day-1)*86_400_000
				key := fmt.Sprintf("%s|%s", loc.Name, types.Date(ms).ISOString()[:10])
				ctx := &astronomy.EphemerisCtx{}
				h, err := ConvertGregorianToHindu(ctx, ms, geo, opts)
				if err != nil {
					ch.Write([]byte(key + " " + errTag(err) + "\n"))
					continue
				}
				rt, rtErr := ConvertHinduToGregorian(ctx, HinduDateCoords{
					VikramSamvat: h.VikramSamvat, MasaIndex: h.MasaIndex,
					Paksha: h.Paksha, PakshaTithi: h.PakshaTithi,
				}, geo, opts)
				rtField := ""
				if rtErr != nil {
					rtField = errTag(rtErr)
				} else {
					parts := make([]string, len(rt))
					for i, d := range rt {
						parts[i] = strconv.FormatInt(d.Ms(), 10)
					}
					rtField = strings.Join(parts, ",")
				}
				adhika := 0
				if h.IsAdhika {
					adhika = 1
				}
				ch.Write([]byte(fmt.Sprintf("%s %d/%d/%s/%d/%d/%d/%d/%d/%s/%s/%s %s\n",
					key, h.Tithi, h.PakshaTithi, h.Paksha, h.MasaIndex, adhika,
					h.VikramSamvat, h.ShakaSamvat, h.VaraIndex,
					h.TithiName, h.MasaName, h.VaraName, rtField)))
			}
		}
	}

	for _, year := range []int{1912, 2025, 2026, 2027, 2028, 2029, 2088} {
		for _, md := range [][2]int{{0, 1}, {1, 18}, {2, 15}, {2, 20}, {2, 25}, {3, 5}, {11, 31}} {
			ms := types.DateUTC(year, md[0], md[1]).Ms()
			ctx := &astronomy.EphemerisCtx{}
			day := types.Date(ms).ISOString()[:10]
			sv, svErr := ComputeSamvat(ctx, ms)
			svField := ""
			if svErr != nil {
				svField = strconv.Quote(errTag(svErr))
			} else {
				b, e := json.Marshal(sv)
				if e != nil {
					t.Fatalf("marshalling samvat: %v", e)
				}
				svField = string(b)
			}
			ky, kyErr := GetKaliYugaYear(ctx, ms)
			kyField := strconv.Itoa(ky)
			if kyErr != nil {
				kyField = errTag(kyErr)
			}
			eh.Write([]byte(fmt.Sprintf("era %s %s %s\n", day, svField, kyField)))
		}
	}

	for _, li := range []int{0, 1, 5} {
		loc := g.Locations[li]
		geo := loc.geo()
		for _, year := range []int{2025, 2026, 2027, 2028, 2029} {
			for _, region := range g.Regions {
				ctx := &astronomy.EphemerisCtx{}
				v, ok, err := GetHinduNewYear(ctx, year, types.FestivalRegion(region), geo,
					ConvertOptions{Timezone: loc.Timezone})
				at := "null"
				switch {
				case err != nil:
					at = errTag(err)
				case ok:
					at = strconv.FormatInt(v.Ms(), 10)
				}
				nh.Write([]byte(fmt.Sprintf("hny %s|%d|%s %s\n", loc.Name, year, region, at)))
			}
		}
	}

	for _, li := range []int{0, 3, 4} {
		loc := g.Locations[li]
		for _, spec := range []struct {
			from  string
			count int
		}{{"2025-01-01", 5}, {"2026-06-15", 3}, {"1912-06-01", 4}} {
			fromMs, err := types.ParseISODay(spec.from)
			if err != nil {
				t.Fatalf("parsing %q: %v", spec.from, err)
			}
			ctx := &astronomy.EphemerisCtx{}
			list, err := GetUpcomingEclipses(ctx, fromMs, loc.geo(), spec.count)
			field := ""
			if err != nil {
				field = errTag(err)
			} else {
				parts := make([]string, len(list))
				for i, e := range list {
					vis := 0
					if e.VisibleFromLocation {
						vis = 1
					}
					parts[i] = fmt.Sprintf("%s/%s/%d/%d", e.Kind, e.Subtype, e.PeakMs.Ms(), vis)
				}
				field = strings.Join(parts, ",")
			}
			uh.Write([]byte(fmt.Sprintf("up %s|%s|%d %s\n", loc.Name, spec.from, spec.count, field)))
		}
	}

	for _, d := range []struct {
		name, want string
		h          hash.Hash
	}{
		{"convert", g.ConvertDigest, ch},
		{"era", g.EraDigest, eh},
		{"newYear", g.NewYearDigest, nh},
		{"upcoming", g.UpcomingDigest, uh},
	} {
		if got := hex.EncodeToString(d.h.Sum(nil)); got != d.want {
			t.Errorf("%s digest mismatch:\n  want %s\n  got  %s", d.name, d.want, got)
		}
	}
}

const eclipseFloatBand = 1e-9

func TestConvertRoundTripsExplicitly(t *testing.T) {
	g := loadYearlyGolden(t)
	byKey := map[string]calConvertCase{}
	for _, c := range g.ConvertCases {
		byKey[c.Key] = c
	}
	contains, checked := 0, 0

	for _, loc := range g.Locations {
		geo := loc.geo()
		opts := ConvertOptions{Timezone: loc.Timezone}
		for _, year := range loc.Years {
			for day := 1; day <= 365; day += 29 {
				ms := types.DateUTC(year, 0, 1).Ms() + int64(day-1)*86_400_000
				key := fmt.Sprintf("%s|%s", loc.Name, types.Date(ms).ISOString()[:10])
				want, ok := byKey[key]
				if !ok {
					t.Fatalf("golden has no convert case %q", key)
				}
				ctx := &astronomy.EphemerisCtx{}
				h, err := ConvertGregorianToHindu(ctx, ms, geo, opts)

				if tag, isErr := isErrTag(want.Hindu); isErr {
					if err == nil || errTag(err) != tag {
						t.Errorf("%s: want %s, got %+v / %v", key, tag, h, err)
					}
					continue
				}
				if err != nil {
					t.Errorf("%s: unexpected error %v", key, err)
					continue
				}
				var wantH calHindu
				if e := json.Unmarshal(want.Hindu, &wantH); e != nil {
					t.Fatalf("%s: %v", key, e)
				}
				got := calHindu{
					TithiName: h.TithiName, Tithi: h.Tithi, PakshaTithi: h.PakshaTithi,
					Paksha: h.Paksha, MasaName: h.MasaName, MasaIndex: h.MasaIndex,
					IsAdhika: h.IsAdhika, VikramSamvat: h.VikramSamvat,
					ShakaSamvat: h.ShakaSamvat, VaraName: h.VaraName, VaraIndex: h.VaraIndex,
				}
				if got != wantH {
					t.Errorf("%s coords:\n  want %+v\n  got  %+v", key, wantH, got)
				}

				rt, rtErr := ConvertHinduToGregorian(ctx, HinduDateCoords{
					VikramSamvat: h.VikramSamvat, MasaIndex: h.MasaIndex,
					Paksha: h.Paksha, PakshaTithi: h.PakshaTithi,
				}, geo, opts)
				if tag, isErr := isErrTag(want.RoundTrip); isErr {
					if rtErr == nil || errTag(rtErr) != tag {
						t.Errorf("%s roundTrip: want %s, got %v", key, tag, rtErr)
					}
					continue
				}
				if rtErr != nil {
					t.Errorf("%s roundTrip: unexpected error %v", key, rtErr)
					continue
				}
				var wantRT []int64
				if e := json.Unmarshal(want.RoundTrip, &wantRT); e != nil {
					t.Fatalf("%s: %v", key, e)
				}
				if len(rt) != len(wantRT) {
					t.Errorf("%s roundTrip: want %d dates, got %d", key, len(wantRT), len(rt))
				} else {
					for i := range wantRT {
						if rt[i].Ms() != wantRT[i] {
							t.Errorf("%s roundTrip[%d]: want %d, got %d", key, i, wantRT[i], rt[i].Ms())
						}
					}
				}
				if want.RoundTripContains != nil {
					gotContains := false
					for _, d := range rt {
						if d.Ms() == ms {
							gotContains = true
							break
						}
					}
					checked++
					if gotContains {
						contains++
					}
					if gotContains != *want.RoundTripContains {
						t.Errorf("%s roundTripContains: want %v, got %v",
							key, *want.RoundTripContains, gotContains)
					}
				}
			}
		}
	}
	t.Logf("round trip returned the original date on %d of %d cases", contains, checked)
	if checked == 0 {
		t.Fatal("no round trips were checked: the golden carries no roundTripContains flags")
	}
}

func TestCalendarGuardsAreReached(t *testing.T) {
	g := loadYearlyGolden(t)
	hits := map[string]int{
		"ekadashiPolarContinue": 0, "ekadashiDaysProbed": 0,
		"yearlyBareCatch": 0, "sankrantiTransits": 0,
		"meshaCatch": 0, "meshaSolarAnchorCalls": 0,
		"chaitraNull": 0, "hinduNewYearCalls": 0,
		"convertPolarThrow": 0, "convertCalls": 0,
	}

	for _, loc := range g.Locations {
		geo := loc.geo()
		opts := loc.yearlyOptions()
		for _, year := range loc.Years {
			ctx := &astronomy.EphemerisCtx{}
			offsetMinutes, err := utils.ResolveUtcOffset(loc.Timezone, types.DateUTC(year, 6, 1).Ms())
			if err != nil {
				t.Fatalf("%s: %v", loc.Name, err)
			}

			for ms := types.DateUTC(year, 0, 1).Ms(); ms <= types.DateUTC(year, 11, 31).Ms()+dayMs; ms += dayMs {
				hits["ekadashiDaysProbed"]++
				sr, err := astronomy.ComputeSunrise(ctx,
					utils.GetLocalMidnightUtc(ms, offsetMinutes), geo, astronomy.DefaultRiseSetLimitDays)
				if err == nil {
					var ss int64
					ss, err = astronomy.ComputeSunset(ctx, sr, geo, astronomy.DefaultRiseSetLimitDays)
					if err == nil {
						_, err = astronomy.ComputeSunrise(ctx, ss, geo, astronomy.DefaultRiseSetLimitDays)
					}
				}
				if err != nil {
					if !isPolarRiseSetError(err) {
						t.Fatalf("%s %d: non-sentinel error in the ekadashi probe: %v", loc.Name, year, err)
					}
					hits["ekadashiPolarContinue"]++
				}
			}

			sank, err := ComputeSankrantisForYear(ctx, year, geo, opts)
			if err != nil {
				t.Fatalf("%s %d sankrantis: %v", loc.Name, year, err)
			}
			for _, s := range sank {
				hits["sankrantiTransits"]++
				if _, err := sankrantiAnchor(ctx, s.Moment.Ms(), geo); err != nil {
					hits["yearlyBareCatch"]++
				}
			}

			hits["meshaSolarAnchorCalls"]++
			aprMs := types.DateUTC(year, 3, 14).Ms() + 6*3600_000
			if _, err := meshaSunriseAnchor(ctx, aprMs, meshaSankrantiDay, geo); err != nil {
				if !isPolarRiseSetError(err) {
					t.Fatalf("%s %d: non-sentinel error in the mesha probe: %v", loc.Name, year, err)
				}
				hits["meshaCatch"]++
			}

			for day := 1; day <= 365; day += 29 {
				ms := types.DateUTC(year, 0, 1).Ms() + int64(day-1)*86_400_000
				hits["convertCalls"]++
				if _, err := ConvertGregorianToHindu(ctx, ms, geo,
					ConvertOptions{Timezone: loc.Timezone}); err != nil {
					if errTag(err) == "error:NO_SUNRISE" {
						hits["convertPolarThrow"]++
					}
				}
			}
		}
	}

	for _, li := range []int{0, 1, 5} {
		loc := g.Locations[li]
		geo := loc.geo()
		for _, year := range []int{2025, 2026, 2027, 2028, 2029} {
			for _, region := range g.Regions {
				ctx := &astronomy.EphemerisCtx{}
				hits["hinduNewYearCalls"]++
				_, ok, err := GetHinduNewYear(ctx, year, types.FestivalRegion(region), geo,
					ConvertOptions{Timezone: loc.Timezone})
				if err != nil {
					t.Fatalf("%s %d %s: %v", loc.Name, year, region, err)
				}
				if !ok {
					hits["chaitraNull"]++
				}
			}
		}
	}

	for k, want := range g.GuardHits {
		if hits[k] != want {
			t.Errorf("guard %q: want %d, got %d", k, want, hits[k])
		}
	}
	for k := range hits {
		if _, ok := g.GuardHits[k]; !ok {
			t.Errorf("guard %q: not in golden", k)
		}
	}
}

func TestCoreGetDailyPanchangIsTheSeam(t *testing.T) {
	opts := YearlyListingOptions{Timezone: types.TimezoneOffset(330)}.panchangOptions()
	opts.Sections = core.Sections(core.SectionFestivals, core.SectionEclipse)
	opts.SectionsGiven = true
	if opts.Sections.Wants(core.SectionMoonTimes) || opts.Sections.Wants(core.SectionLunarWindows) {
		t.Error("the festivals-in-range section set must not request moon times or lunar windows")
	}
	if !opts.Sections.Wants(core.SectionFestivals) || !opts.Sections.Wants(core.SectionEclipse) {
		t.Error("the festivals-in-range section set must request festivals and eclipse")
	}
}
