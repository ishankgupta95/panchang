package jyotish

import (
	"encoding/json"
	"errors"
	"math"
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

var lagnaTestPune = types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}

func mustLagna(t *testing.T, ctx *astronomy.EphemerisCtx, ms int64, loc types.GeoLocation) types.LagnaInfo {
	t.Helper()
	l, err := ComputeLagna(ctx, ms, loc, types.Lahiri, types.LanguageEn)
	if err != nil {
		t.Fatalf("ComputeLagna(%s): %v", types.Date(ms).ISOString(), err)
	}
	return l
}

func TestLagnaDecompositionIsSelfConsistent(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	base := types.DateUTC(2025, 0, 14).Ms()
	seenRashi := map[int]bool{}
	seenPada := map[int]bool{}
	const steps = 288
	for i := 0; i < steps; i++ {
		l := mustLagna(t, ctx, base+int64(i)*300_000, lagnaTestPune)
		if !(l.SiderealLongitude >= 0 && l.SiderealLongitude < 360) {
			t.Fatalf("siderealLongitude %v outside [0, 360)", l.SiderealLongitude)
		}
		if want := int(math.Floor(l.SiderealLongitude / 30)); l.Rashi.Index != want {
			t.Errorf("rashi.index %d, floor(lon/30) = %d", l.Rashi.Index, want)
		}
		if want := l.SiderealLongitude - float64(l.Rashi.Index)*30; l.DegreeInRashi != want {
			t.Errorf("degreeInRashi %v, lon - index*30 = %v", l.DegreeInRashi, want)
		}
		if !(l.DegreeInRashi >= 0 && l.DegreeInRashi < 30) {
			t.Errorf("degreeInRashi %v outside [0, 30) at lon %v", l.DegreeInRashi, l.SiderealLongitude)
		}
		if want := int(math.Floor(l.SiderealLongitude / (360.0 / 27))); l.Nakshatra.Index != want {
			t.Errorf("nakshatra.index %d, floor(lon/span) = %d", l.Nakshatra.Index, want)
		}
		if l.Pada < 1 || l.Pada > 4 {
			t.Errorf("pada %d outside 1..4 at lon %v", l.Pada, l.SiderealLongitude)
		}
		deg := math.Max(l.SiderealLongitude-float64(l.Nakshatra.Index)*(360.0/27), 0)
		if want := int(math.Floor(deg/(360.0/27/4))) + 1; want > 4 {
			want = 4
		} else if l.Pada != want {
			t.Errorf("pada %d, quarter of nakshatra %d = %d", l.Pada, l.Nakshatra.Index, want)
		}
		if l.Rashi.Name == "" || l.Nakshatra.Name == "" {
			t.Errorf("empty name at lon %v: rashi %q nakshatra %q",
				l.SiderealLongitude, l.Rashi.Name, l.Nakshatra.Name)
		}
		seenRashi[l.Rashi.Index] = true
		seenPada[l.Pada] = true
	}
	if len(seenRashi) != 12 {
		t.Errorf("a full day's ascendant reached %d rashis, not 12: %v", len(seenRashi), seenRashi)
	}
	if len(seenPada) != 4 {
		t.Errorf("a full day's ascendant reached %d padas, not 4: %v", len(seenPada), seenPada)
	}
}

// Angular pairs are exact; trisected ones come from independent calls, so only close.
func TestSripatiCuspsAreOppositeBy180(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	base := types.DateUTC(2025, 0, 14).Ms()
	structural := map[int]bool{0: true, 3: true, 6: true, 9: true} // straight from ASC and MC
	worstArithmetic := 0.0
	for _, loc := range []types.GeoLocation{
		lagnaTestPune,
		{Latitude: -33.8688, Longitude: 151.2093},
		{Latitude: 64.1466, Longitude: -21.9426},
		{Latitude: 0, Longitude: 0},
	} {
		for i := 0; i < 48; i++ {
			c, err := ComputeSripatiLagnaWithCusps(ctx, base+int64(i)*1800_000, loc,
				types.Lahiri, types.LanguageEn)
			if err != nil {
				t.Fatalf("%v: %v", loc, err)
			}
			if len(c.Cusps) != 12 {
				t.Fatalf("%d cusps, want 12", len(c.Cusps))
			}
			for k := 0; k < 6; k++ {
				sep := math.Mod(c.Cusps[k+6]-c.Cusps[k]+720, 360)
				d := math.Abs(sep - 180)
				if structural[k] {
					if sep != 180 {
						t.Errorf("lat %v: cusps %d/%d are %v apart, not exactly 180. "+
							"This pair is normalize360(x) and normalize360(x+180) and "+
							"must be exact", loc.Latitude, k+1, k+7, sep)
					}
					continue
				}
				if d > 1e-12 {
					t.Errorf("lat %v: cusps %d/%d are %v apart, |Δ| from 180 = %g",
						loc.Latitude, k+1, k+7, sep, d)
				}
				if d > worstArithmetic {
					worstArithmetic = d
				}
			}
		}
	}
	t.Logf("trisected opposite pairs: worst |separation - 180| = %g deg", worstArithmetic)
}

func TestSripatiCuspsTrisectTheirQuadrants(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	base := types.DateUTC(2025, 0, 14).Ms()
	worst := 0.0
	quadrants := [4][4]int{{0, 1, 2, 3}, {3, 4, 5, 6}, {6, 7, 8, 9}, {9, 10, 11, 0}}
	for i := 0; i < 48; i++ {
		c, err := ComputeSripatiLagnaWithCusps(ctx, base+int64(i)*1800_000, lagnaTestPune,
			types.Lahiri, types.LanguageEn)
		if err != nil {
			t.Fatal(err)
		}
		for qi, q := range quadrants {
			g0 := math.Mod(c.Cusps[q[1]]-c.Cusps[q[0]]+360, 360)
			g1 := math.Mod(c.Cusps[q[2]]-c.Cusps[q[1]]+360, 360)
			g2 := math.Mod(c.Cusps[q[3]]-c.Cusps[q[2]]+360, 360)
			for _, d := range []float64{math.Abs(g1 - g0), math.Abs(g2 - g0)} {
				if d > 1e-12 {
					t.Errorf("quadrant %d: gaps %v / %v / %v are not equal", qi+1, g0, g1, g2)
				}
				if d > worst {
					worst = d
				}
			}
			if g0 <= 0 {
				t.Errorf("quadrant %d has a non-positive gap %v", qi+1, g0)
			}
		}
	}
	t.Logf("trisection: worst gap inequality = %g deg", worst)
}

func TestSripatiAtTheEquatorIsNotEqualHouse(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	equator := types.GeoLocation{Latitude: 0, Longitude: 12.5}
	base := types.DateUTC(2025, 0, 14).Ms()

	eps := MeanObliquity((astronomy.DateToJulianDay(base) - 2451545.0) / 36525.0)
	c := math.Cos(eps * math.Pi / 180)
	predicted := math.Atan((1-c*c)/(2*c)) * 180 / math.Pi

	worstArc, worstEqual := 0.0, 0.0
	for i := 0; i < 288; i++ {
		cu, err := ComputeSripatiLagnaWithCusps(ctx, base+int64(i)*300_000, equator,
			types.Lahiri, types.LanguageEn)
		if err != nil {
			t.Fatal(err)
		}
		asc, ic, dsc, mc := cu.Cusps[0], cu.Cusps[3], cu.Cusps[6], cu.Cusps[9]
		for _, arc := range []float64{
			math.Mod(ic-asc+360, 360), math.Mod(dsc-ic+360, 360),
			math.Mod(mc-dsc+360, 360), math.Mod(asc-mc+720, 360),
		} {
			if d := math.Abs(arc - 90); d > worstArc {
				worstArc = d
			}
		}
		for k := 0; k < 12; k++ {
			want := math.Mod(asc+float64(k)*30+360, 360)
			d := math.Abs(cu.Cusps[k] - want)
			if d > 180 {
				d = 360 - d
			}
			if d > worstEqual {
				worstEqual = d
			}
		}
	}
	if worstArc < predicted*0.9 || worstArc > predicted*1.01 {
		t.Errorf("equatorial arc excursion %g deg, closed form arctan(sin²ε/(2cos ε)) "+
			"= %g deg. A five-minute sample cannot quite reach the extremum, so 90-101%% "+
			"of the prediction is the expected window", worstArc, predicted)
	}
	if worstEqual < 1 {
		t.Errorf("worst |cusp - equalHouse| = %g deg: the Sripati chart really does "+
			"degenerate to Equal House at the equator, and the docblock is right "+
			"rather than the finding that contradicts it", worstEqual)
	}
	t.Logf("equator: worst |arc-90| = %g deg (closed form %g), worst |cusp - equalHouse| "+
		"= %g deg, NOT the equal-house chart", worstArc, predicted, worstEqual)
}

// All three share the Sun's sunrise longitude, so differencing two instants in one day cancels it.
func TestSpecialLagnaRatesAreTheDocumentedOnes(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	t0 := types.DateUTC(2025, 0, 14).Ms() + 6*3600_000
	t1 := t0 + 2*3600_000
	if s0, err := findSunriseBefore(ctx, t0, lagnaTestPune); err != nil {
		t.Fatal(err)
	} else if s1, err := findSunriseBefore(ctx, t1, lagnaTestPune); err != nil {
		t.Fatal(err)
	} else if s0 != s1 {
		t.Fatalf("the two probes fall in different solar days (%d vs %d); the base "+
			"point would not cancel and the measured rate would be meaningless", s0, s1)
	}

	rates := map[string]float64{}
	for _, arm := range []struct {
		name string
		fn   func(int64) (types.LagnaInfo, error)
		want float64
	}{
		{"hora", func(ms int64) (types.LagnaInfo, error) {
			return ComputeHoraLagna(ctx, ms, lagnaTestPune, types.Lahiri, types.LanguageEn)
		}, 30},
		{"ghati", func(ms int64) (types.LagnaInfo, error) {
			return ComputeGhatiLagna(ctx, ms, lagnaTestPune, types.Lahiri, types.LanguageEn)
		}, 75},
		{"bhava", func(ms int64) (types.LagnaInfo, error) {
			return ComputeBhavaLagna(ctx, ms, lagnaTestPune, types.Lahiri, types.LanguageEn)
		}, 15},
	} {
		a, err := arm.fn(t0)
		if err != nil {
			t.Fatalf("%s: %v", arm.name, err)
		}
		b, err := arm.fn(t1)
		if err != nil {
			t.Fatalf("%s: %v", arm.name, err)
		}
		rate := math.Mod(b.SiderealLongitude-a.SiderealLongitude+360, 360) / 2
		rates[arm.name] = rate
		if math.Abs(rate-arm.want) > 1e-9 {
			t.Errorf("%s advances %v deg/h, documented %v", arm.name, rate, arm.want)
		}
	}
	if rates["hora"] == rates["bhava"] {
		t.Error("Hora and Bhava advance at the same rate; lagna.ts:174-176 exists " +
			"because these two are routinely confused, and they are 30 and 15 deg/h")
	}
	if math.Abs(rates["ghati"]/rates["hora"]-2.5) > 1e-12 {
		t.Errorf("ghati/hora = %v, want 2.5 (a 60-minute hour over a 24-minute ghatika)",
			rates["ghati"]/rates["hora"])
	}
	t.Logf("measured rates: hora %v, ghati %v, bhava %v deg/h",
		rates["hora"], rates["ghati"], rates["bhava"])
}

// The > versus >= boundary at the sunrise instant, unreachable by sampling.
func TestFindSunriseBeforeBracketsTheInstant(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	day := types.DateUTC(2025, 0, 14).Ms()
	sunrise, err := astronomy.ComputeSunrise(ctx, day, lagnaTestPune, astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range []struct {
		name string
		ms   int64
	}{
		{"mid-day", sunrise + 6*3600_000},
		{"before sunrise", sunrise - 2*3600_000},
		{"the sunrise instant itself", sunrise},
		{"one ms after sunrise", sunrise + 1},
		{"one ms before sunrise", sunrise - 1},
	} {
		got, err := findSunriseBefore(ctx, c.ms, lagnaTestPune)
		if err != nil {
			t.Fatalf("%s: %v", c.name, err)
		}
		if got > c.ms {
			t.Errorf("%s: returned %s, which is AFTER %s", c.name,
				types.Date(got).ISOString(), types.Date(c.ms).ISOString())
		}
		next, err := astronomy.ComputeSunrise(ctx, got+22*3600_000, lagnaTestPune,
			astronomy.DefaultRiseSetLimitDays)
		if err != nil {
			t.Fatal(err)
		}
		if next <= c.ms {
			t.Errorf("%s: the next sunrise %s is not after the instant %s. A later "+
				"sunrise was available and was not taken", c.name,
				types.Date(next).ISOString(), types.Date(c.ms).ISOString())
		}
		if c.ms-got >= 25*3600_000 {
			t.Errorf("%s: sunrise is %d h before the instant", c.name, (c.ms-got)/3600_000)
		}
	}
	if got, _ := findSunriseBefore(ctx, sunrise, lagnaTestPune); got != sunrise {
		t.Errorf("at the sunrise instant, findSunriseBefore returned %s, want the "+
			"instant itself: this is what `next > date` rather than `>=` decides",
			types.Date(got).ISOString())
	}
}

func TestPolarSpecialLagnaPropagatesNoSunrise(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	longyearbyen := types.GeoLocation{Latitude: 78.2232, Longitude: 15.6267}
	midsummer := types.DateUTC(2025, 5, 21).Ms() // polar day: the Sun never sets

	for _, arm := range []struct {
		name string
		fn   func() (types.LagnaInfo, error)
	}{
		{"hora", func() (types.LagnaInfo, error) {
			return ComputeHoraLagna(ctx, midsummer, longyearbyen, types.Lahiri, types.LanguageEn)
		}},
		{"ghati", func() (types.LagnaInfo, error) {
			return ComputeGhatiLagna(ctx, midsummer, longyearbyen, types.Lahiri, types.LanguageEn)
		}},
		{"bhava", func() (types.LagnaInfo, error) {
			return ComputeBhavaLagna(ctx, midsummer, longyearbyen, types.Lahiri, types.LanguageEn)
		}},
	} {
		_, err := arm.fn()
		if err == nil {
			t.Errorf("%s: polar day returned a lagna and no error", arm.name)
			continue
		}
		if !errors.Is(err, types.ErrNoSunriseSentinel) {
			t.Errorf("%s: error is %v, want ErrNoSunrise. lagna.ts does not catch "+
				"this one, so it must propagate as the sentinel", arm.name, err)
		}
	}
	if _, err := ComputeLagna(ctx, midsummer, longyearbyen, types.Lahiri, types.LanguageEn); err != nil {
		t.Errorf("the plain lagna needs no sunrise and must work on a polar day: %v", err)
	}
	if _, err := ComputeSripatiLagnaWithCusps(ctx, midsummer, longyearbyen,
		types.Lahiri, types.LanguageEn); err != nil {
		t.Errorf("the Sripati cusps need no sunrise either: %v", err)
	}
}

func TestLagnaRejectsInvalidInput(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	good := types.DateUTC(2025, 0, 14).Ms()
	bad := []struct {
		name string
		ms   int64
		loc  types.GeoLocation
		code types.ErrorCode
	}{
		{"year 1850", types.DateUTC(1850, 0, 1).Ms(), lagnaTestPune, types.ErrInvalidDate},
		{"year 2150", types.DateUTC(2150, 0, 1).Ms(), lagnaTestPune, types.ErrInvalidDate},
		{"latitude 91", good, types.GeoLocation{Latitude: 91}, types.ErrInvalidLatitude},
		{"longitude 181", good, types.GeoLocation{Longitude: 181}, types.ErrInvalidLongitude},
		{"NaN latitude", good, types.GeoLocation{Latitude: math.NaN()}, types.ErrInvalidLatitude},
	}
	entries := map[string]func(int64, types.GeoLocation) error{
		"ComputeLagna": func(ms int64, l types.GeoLocation) error {
			_, err := ComputeLagna(ctx, ms, l, types.Lahiri, types.LanguageEn)
			return err
		},
		"ComputeHoraLagna": func(ms int64, l types.GeoLocation) error {
			_, err := ComputeHoraLagna(ctx, ms, l, types.Lahiri, types.LanguageEn)
			return err
		},
		"ComputeGhatiLagna": func(ms int64, l types.GeoLocation) error {
			_, err := ComputeGhatiLagna(ctx, ms, l, types.Lahiri, types.LanguageEn)
			return err
		},
		"ComputeBhavaLagna": func(ms int64, l types.GeoLocation) error {
			_, err := ComputeBhavaLagna(ctx, ms, l, types.Lahiri, types.LanguageEn)
			return err
		},
		"ComputeSripatiLagna": func(ms int64, l types.GeoLocation) error {
			_, err := ComputeSripatiLagna(ctx, ms, l, types.Lahiri, types.LanguageEn)
			return err
		},
		"ComputeSripatiLagnaWithCusps": func(ms int64, l types.GeoLocation) error {
			_, err := ComputeSripatiLagnaWithCusps(ctx, ms, l, types.Lahiri, types.LanguageEn)
			return err
		},
	}
	for name, fn := range entries {
		for _, c := range bad {
			err := fn(c.ms, c.loc)
			var pe *types.PanchangError
			if !errors.As(err, &pe) {
				t.Errorf("%s/%s: err = %v, want a PanchangError", name, c.name, err)
				continue
			}
			if pe.Code != c.code {
				t.Errorf("%s/%s: code %s, want %s", name, c.name, pe.Code, c.code)
			}
		}
	}
}

// On the bytes, not len: len(nil) == 0 passes while the wire is wrong.
func TestSripatiCuspsMarshalAsAnArray(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	c, err := ComputeSripatiLagnaWithCusps(ctx, types.DateUTC(2025, 0, 14).Ms(),
		lagnaTestPune, types.Lahiri, types.LanguageEn)
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(c)
	if err != nil {
		t.Fatal(err)
	}
	var probe struct {
		Cusps json.RawMessage `json:"cusps"`
	}
	if err := json.Unmarshal(b, &probe); err != nil {
		t.Fatal(err)
	}
	if string(probe.Cusps) == "null" {
		t.Error("cusps marshalled as null; JavaScript writes an array (docs/porting.md §1.9)")
	}
	if probe.Cusps[0] != '[' {
		t.Errorf("cusps marshalled as %s, want an array", probe.Cusps)
	}
	empty, err := json.Marshal(types.SripatiLagnaInfo{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(empty), `"cusps":null`) {
		t.Errorf("a zero SripatiLagnaInfo marshalled %s; the test above is guarding "+
			"against a hazard that no longer exists", empty)
	}
}
