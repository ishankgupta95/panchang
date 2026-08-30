package jyotish

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
	"math"
	"os"
	"sort"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

const (
	// ~100× the predicted worst case.
	chartAngleBound = 1e-10
	// One math.Sin scaled by 1.4979°, so three orders tighter.
	chartNodeBound = 1e-11
)

type chartsGolden struct {
	Meta struct {
		Claim string `json:"claim"`
		Note  string `json:"note"`
	} `json:"_meta"`
	Seed              uint32 `json:"seed"`
	NodeSamples       int    `json:"nodeSamples"`
	NodeSamplesShort  int    `json:"nodeSamplesShort"`
	LagnaSamples      int    `json:"lagnaSamples"`
	LagnaSamplesShort int    `json:"lagnaSamplesShort"`
	SpecialSamples    int    `json:"specialSamples"`
	MsLo              int64  `json:"msLo"`
	MsHi              int64  `json:"msHi"`
	Locations         []struct {
		Name      string  `json:"name"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	} `json:"locations"`
	Events []struct {
		Name string `json:"name"`
		Ms   int64  `json:"ms"`
		Loc  struct {
			Name      string  `json:"name"`
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
		} `json:"loc"`
	} `json:"events"`
	GrahaAbbr         map[string]string            `json:"grahaAbbr"`
	ObliquityT        []float64                    `json:"obliquityT"`
	ObliquityValues   []float64                    `json:"obliquityValues"`
	NodeDigests       map[string]string            `json:"nodeDigests"`
	NodeDigestsShort  map[string]string            `json:"nodeDigestsShort"`
	LagnaDigests      map[string]map[string]string `json:"lagnaDigests"`
	LagnaDigestsShort map[string]map[string]string `json:"lagnaDigestsShort"`
	CaseInstants      []int64                      `json:"caseInstants"`
	NodeCaseInstants  []int64                      `json:"nodeCaseInstants"`
	NodeCases         []struct {
		Ms       int64   `json:"ms"`
		RahuMean float64 `json:"rahuMean"`
		KetuMean float64 `json:"ketuMean"`
		RahuTrue float64 `json:"rahuTrue"`
		KetuTrue float64 `json:"ketuTrue"`
	} `json:"nodeCases"`
	LagnaCases map[string][]struct {
		En    types.LagnaInfo `json:"en"`
		Hi    types.LagnaInfo `json:"hi"`
		Raman types.LagnaInfo `json:"raman"`
	} `json:"lagnaCases"`
	SpecialInstants []int64 `json:"specialInstants"`
	Special         map[string][]struct {
		Ms            int64           `json:"ms"`
		SunriseBefore int64           `json:"sunriseBefore"`
		Hora          types.LagnaInfo `json:"hora"`
		Ghati         types.LagnaInfo `json:"ghati"`
		Bhava         types.LagnaInfo `json:"bhava"`
		Sripati       types.LagnaInfo `json:"sripati"`
		SripatiCusps  []float64       `json:"sripatiCusps"`
	} `json:"special"`
	Positions []struct {
		Ms   int64                    `json:"ms"`
		Mean types.PlanetaryPositions `json:"mean"`
		True types.PlanetaryPositions `json:"true"`
	} `json:"positions"`
	RetrogradeDeltas []struct {
		Ms     int64              `json:"ms"`
		Deltas map[string]float64 `json:"deltas"`
	} `json:"retrogradeDeltas"`
	Basis []struct {
		Name         string                   `json:"name"`
		Ms           int64                    `json:"ms"`
		AyanamsaType string                   `json:"ayanamsaType"`
		Lang         string                   `json:"lang"`
		NodeType     string                   `json:"nodeType"`
		Lagna        types.LagnaInfo          `json:"lagna"`
		GrahaOrder   []types.Graha            `json:"grahaOrder"`
		Positions    types.PlanetaryPositions `json:"positions"`
	} `json:"basis"`
	BasisWithOptions struct {
		AyanamsaType string                   `json:"ayanamsaType"`
		Lang         string                   `json:"lang"`
		NodeType     string                   `json:"nodeType"`
		Lagna        types.LagnaInfo          `json:"lagna"`
		Positions    types.PlanetaryPositions `json:"positions"`
	} `json:"basisWithOptions"`
}

func loadChartsGolden(t *testing.T) chartsGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "jyotish", "charts-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g chartsGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.ObliquityT) == 0 || len(g.Positions) == 0 || len(g.Basis) == 0 {
		t.Fatal("golden is empty")
	}
	return g
}

func chartUnit01(seed uint32, count int, yield func(float64)) {
	s := seed
	for i := 0; i < count; i++ {
		s = s*1664525 + 1013904223
		yield(float64(s) / 4294967296)
	}
}

func chartInstants(g chartsGolden, salt uint32, count int, yield func(int64)) {
	chartUnit01(g.Seed^salt, count, func(u float64) {
		yield(int64(math.Floor(float64(g.MsLo) + u*float64(g.MsHi-g.MsLo))))
	})
}

func chartDigest(count int, gen func(int, func(int64)), fn func(int64) float64) string {
	h := sha256.New()
	const block = 65536
	buf := make([]byte, block*8)
	n := 0
	gen(count, func(ms int64) {
		binary.LittleEndian.PutUint64(buf[n*8:], math.Float64bits(fn(ms)))
		n++
		if n == block {
			h.Write(buf)
			n = 0
		}
	})
	if n > 0 {
		h.Write(buf[:n*8])
	}
	return hex.EncodeToString(h.Sum(nil))
}

// Must match the generator's salts, or the two sides sample different instants.
const (
	chartSaltNode    = 0x0D0E
	chartSaltLagna   = 0x1A61
	chartSaltSpecial = 0x5EC1
)

func TestMeanObliquityIsBitIdentical(t *testing.T) {
	g := loadChartsGolden(t)
	if len(g.ObliquityT) != len(g.ObliquityValues) {
		t.Fatalf("golden has %d T values and %d results", len(g.ObliquityT), len(g.ObliquityValues))
	}
	bad := 0
	for i, tt := range g.ObliquityT {
		got := MeanObliquity(tt)
		if got != g.ObliquityValues[i] {
			bad++
			if bad <= 5 {
				t.Errorf("MeanObliquity(%v) = %v, TypeScript %v (Δ %g)",
					tt, got, g.ObliquityValues[i], got-g.ObliquityValues[i])
			}
		}
	}
	if bad > 0 {
		t.Errorf("%d of %d obliquity values diverged; this path has no transcendental "+
			"in it, so a divergence is a lost anti-FMA barrier or a mistyped constant, "+
			"not rounding", bad, len(g.ObliquityT))
	}
	t.Logf("%d T values bit-identical over T in [-1, +1]", len(g.ObliquityT))
}

func TestMeanObliquityHighOrderTermsArePresent(t *testing.T) {
	const base = 23.439291111
	if MeanObliquity(0) != base {
		t.Errorf("MeanObliquity(0) = %v, want the constant term %v exactly", MeanObliquity(0), base)
	}
	for _, c := range []struct {
		name string
		tt   float64
		want float64
	}{
		{"linear", 1, base - 0.013004167 - 0.000000164 + 0.000000504},
		{"negative T", -1, base + 0.013004167 - 0.000000164 - 0.000000504},
	} {
		if got := MeanObliquity(c.tt); math.Abs(got-c.want) > 1e-15 {
			t.Errorf("%s: MeanObliquity(%v) = %v, want %v", c.name, c.tt, got, c.want)
		}
	}
	// Cancellation budget: extracting a 3.3e-7 term near 23.44 costs ~1 ULP.
	const isolationTol = 1e-14
	quad := MeanObliquity(1) + MeanObliquity(-1) - 2*base
	if want := 2 * -0.000000164; math.Abs(quad-want) > isolationTol {
		t.Errorf("isolated quadratic term = %g, want %g (residual %g, budget %g)",
			quad, want, math.Abs(quad-want), isolationTol)
	}
	oddPart := MeanObliquity(1) - MeanObliquity(-1)
	cubic := oddPart/2 - -0.013004167
	if want := 0.000000504; math.Abs(cubic-want) > isolationTol {
		t.Errorf("isolated cubic term = %g, want %g: a dropped T³ term leaves the "+
			"obliquity looking entirely reasonable and moves the ascendant", cubic, want)
	}
	if 0.000000504 <= isolationTol {
		t.Fatal("the isolation budget is as large as the term it is isolating; a " +
			"dropped cubic would pass")
	}
}

func TestGrahaAbbrMatchesTypeScript(t *testing.T) {
	g := loadChartsGolden(t)
	if len(g.GrahaAbbr) != types.GrahaCount {
		t.Fatalf("golden has %d abbreviations, want %d", len(g.GrahaAbbr), types.GrahaCount)
	}
	seen := map[string]types.Graha{}
	for _, graha := range types.AllGrahas {
		want, ok := g.GrahaAbbr[graha.String()]
		if !ok {
			t.Errorf("%s: missing from the golden", graha)
			continue
		}
		if got := GrahaAbbr[graha]; got != want {
			t.Errorf("GrahaAbbr[%s] = %q, TypeScript %q", graha, got, want)
		}
		if prev, dup := seen[want]; dup {
			t.Errorf("abbreviation %q is shared by %s and %s", want, prev, graha)
		}
		seen[want] = graha
	}
}

func TestMeanNodeIsBitIdentical(t *testing.T) {
	g := loadChartsGolden(t)
	samples, digests := g.NodeSamples, g.NodeDigests
	if os.Getenv("GEN_FULL") == "" {
		samples, digests = g.NodeSamplesShort, g.NodeDigestsShort
	}
	gen := func(n int, yield func(int64)) { chartInstants(g, chartSaltNode, n, yield) }

	accessors := map[string]func(int64) float64{
		"rahuSidereal:mean": func(ms int64) float64 {
			return mustPositions(t, ms, NodeMean).Rahu.SiderealLongitude
		},
		"rahuSidereal:true": func(ms int64) float64 {
			return mustPositions(t, ms, NodeTrue).Rahu.SiderealLongitude
		},
		"ketuSidereal:mean": func(ms int64) float64 {
			return mustPositions(t, ms, NodeMean).Ketu.SiderealLongitude
		},
	}
	if len(accessors) != len(digests) {
		t.Fatalf("Go has %d node accessors, the golden has %d", len(accessors), len(digests))
	}

	names := make([]string, 0, len(accessors))
	for n := range accessors {
		names = append(names, n)
	}
	sort.Strings(names)
	for _, name := range names {
		got := chartDigest(samples, gen, accessors[name])
		want, ok := digests[name]
		if !ok {
			t.Errorf("%s: in the Go accessor map, not in the golden", name)
			continue
		}
		// Only the exact arm is asserted: the true node reaches the platform's sin, so
		// TestTrueNodeWithinSinBound holds it to a bound instead of to a digest.
		if exact := name != "rahuSidereal:true"; exact && got != want {
			t.Errorf("%s: digest %s, golden %s: this path has no transcendental and "+
				"must be bit-identical over %d instants", name, got, want, samples)
		}
	}
	t.Logf("mean node bit-identical over %d instants; true node bounded separately", samples)
}

func TestTrueNodeWithinSinBound(t *testing.T) {
	g := loadChartsGolden(t)
	if len(g.NodeCases) == 0 {
		t.Fatal("the golden carries no explicit node cases")
	}
	ctx := astronomy.NewEphemerisCtx()
	worstTrue, worstMs := 0.0, int64(0)
	differTrue, differMean := 0, 0
	for _, c := range g.NodeCases {
		mean, err := ComputePlanetaryPositions(ctx, c.Ms, types.Lahiri, nil, nil, NodeMean)
		if err != nil {
			t.Fatalf("mean node at %s: %v", types.Date(c.Ms).ISOString(), err)
		}
		tru, err := ComputePlanetaryPositions(ctx, c.Ms, types.Lahiri, nil, nil, NodeTrue)
		if err != nil {
			t.Fatalf("true node at %s: %v", types.Date(c.Ms).ISOString(), err)
		}
		if mean.Rahu.SiderealLongitude != c.RahuMean || mean.Ketu.SiderealLongitude != c.KetuMean {
			differMean++
			if differMean <= 3 {
				t.Errorf("%s: mean node rahu %v / ketu %v, TypeScript %v / %v: this "+
					"path has no transcendental in it", types.Date(c.Ms).ISOString(),
					mean.Rahu.SiderealLongitude, mean.Ketu.SiderealLongitude, c.RahuMean, c.KetuMean)
			}
		}
		for _, pair := range [][2]float64{
			{tru.Rahu.SiderealLongitude, c.RahuTrue},
			{tru.Ketu.SiderealLongitude, c.KetuTrue},
		} {
			if pair[0] != pair[1] {
				differTrue++
			}
			if d := angleDelta(pair[0], pair[1]); d > worstTrue {
				worstTrue, worstMs = d, c.Ms
			}
		}
	}
	if worstTrue > chartNodeBound {
		t.Errorf("true node worst |Δ| = %g deg at %s, bound %g", worstTrue,
			types.Date(worstMs).ISOString(), chartNodeBound)
	}
	t.Logf("true node: %d of %d values differ, worst |Δ| = %g deg (predicted <= 1e-14, "+
		"bound %g); mean node exact on all %d", differTrue, len(g.NodeCases)*2, worstTrue,
		chartNodeBound, len(g.NodeCases)*2)
}

func TestLagnaIndicesAreExactAndValuesAreBounded(t *testing.T) {
	g := loadChartsGolden(t)
	samples, digests := g.LagnaSamples, g.LagnaDigests
	if os.Getenv("GEN_FULL") == "" {
		samples, digests = g.LagnaSamplesShort, g.LagnaDigestsShort
	}
	gen := func(n int, yield func(int64)) { chartInstants(g, chartSaltLagna, n, yield) }

	exactByName := map[string]bool{
		"rashiIndex": true, "nakshatraIndex": true, "pada": true,
		"siderealLongitude": false, "degreeInRashi": false,
	}
	checkedExact, checkedBounded := 0, 0

	for _, loc := range g.Locations {
		geo := types.GeoLocation{Latitude: loc.Latitude, Longitude: loc.Longitude}
		lagnaAt := func(ms int64) types.LagnaInfo {
			l, err := ComputeLagna(astronomy.NewEphemerisCtx(), ms, geo, types.Lahiri, types.LanguageEn)
			if err != nil {
				t.Fatalf("ComputeLagna(%s, %s): %v", types.Date(ms).ISOString(), loc.Name, err)
			}
			return l
		}
		accessors := map[string]func(int64) float64{
			"siderealLongitude": func(ms int64) float64 { return lagnaAt(ms).SiderealLongitude },
			"degreeInRashi":     func(ms int64) float64 { return lagnaAt(ms).DegreeInRashi },
			"rashiIndex":        func(ms int64) float64 { return float64(lagnaAt(ms).Rashi.Index) },
			"nakshatraIndex":    func(ms int64) float64 { return float64(lagnaAt(ms).Nakshatra.Index) },
			"pada":              func(ms int64) float64 { return float64(lagnaAt(ms).Pada) },
		}
		want, ok := digests[loc.Name]
		if !ok {
			t.Errorf("%s: no digests in the golden", loc.Name)
			continue
		}
		if len(want) != len(accessors) {
			t.Errorf("%s: golden has %d accessors, Go has %d", loc.Name, len(want), len(accessors))
		}
		names := make([]string, 0, len(accessors))
		for n := range accessors {
			names = append(names, n)
		}
		sort.Strings(names)
		for _, name := range names {
			got := chartDigest(samples, gen, accessors[name])
			if !exactByName[name] {
				checkedBounded++
				if got == want[name] {
					t.Errorf("%s/%s: bit-identical to the TypeScript over %d instants. "+
						"This path ends in math.Atan2 over math.Sin/Cos/Tan, none of "+
						"which can agree with V8's everywhere: an exact match means "+
						"the port stopped using them", loc.Name, name, samples)
				}
				continue
			}
			checkedExact++
			if got != want[name] {
				t.Errorf("%s/%s: digest %s, golden %s: an INDEX diverged over %d "+
					"instants. docs/validation-tiers.md makes this an invariant with zero "+
					"tolerance: it is a port defect, not a boundary coincidence "+
					"(expected rate ~1e-8 over this sweep)", loc.Name, name, got, want[name], samples)
			}
		}
	}
	if checkedExact != 3*len(g.Locations) || checkedBounded != 2*len(g.Locations) {
		t.Errorf("checked %d exact and %d bounded accessors; expected %d and %d",
			checkedExact, checkedBounded, 3*len(g.Locations), 2*len(g.Locations))
	}
	t.Logf("%d index accessors exact, %d value accessors confirmed divergent, over "+
		"%d instants at %d locations", checkedExact, checkedBounded, samples, len(g.Locations))
}

func TestLagnaCasesMatchTypeScript(t *testing.T) {
	g := loadChartsGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	worst := 0.0
	checked := 0
	for _, loc := range g.Locations {
		geo := types.GeoLocation{Latitude: loc.Latitude, Longitude: loc.Longitude}
		cases, ok := g.LagnaCases[loc.Name]
		if !ok {
			t.Errorf("%s: no cases in the golden", loc.Name)
			continue
		}
		if len(cases) != len(g.CaseInstants) {
			t.Fatalf("%s: %d cases for %d instants", loc.Name, len(cases), len(g.CaseInstants))
		}
		for i, ms := range g.CaseInstants {
			for _, arm := range []struct {
				label    string
				ayanamsa types.AyanamsaType
				lang     types.Language
				want     types.LagnaInfo
			}{
				{"en", types.Lahiri, types.LanguageEn, cases[i].En},
				{"hi", types.Lahiri, types.LanguageHi, cases[i].Hi},
				{"raman", types.Raman, types.LanguageEn, cases[i].Raman},
			} {
				got, err := ComputeLagna(ctx, ms, geo, arm.ayanamsa, arm.lang)
				if err != nil {
					t.Fatalf("%s/%s at %s: %v", loc.Name, arm.label, types.Date(ms).ISOString(), err)
				}
				checked++
				where := loc.Name + "/" + arm.label + " @ " + types.Date(ms).ISOString()
				if d := compareLagna(t, where, got, arm.want); d > worst {
					worst = d
				}
			}
		}
	}
	if checked != 3*len(g.Locations)*len(g.CaseInstants) {
		t.Errorf("compared %d lagnas, expected %d", checked, 3*len(g.Locations)*len(g.CaseInstants))
	}
	t.Logf("%d lagnas compared leaf for leaf; worst angular |Δ| = %g deg (bound %g)",
		checked, worst, chartAngleBound)
}

func compareLagna(t *testing.T, where string, got, want types.LagnaInfo) float64 {
	t.Helper()
	d := angleDelta(got.SiderealLongitude, want.SiderealLongitude)
	if d > chartAngleBound {
		t.Errorf("%s: siderealLongitude %v vs %v, |Δ| = %g deg > %g",
			where, got.SiderealLongitude, want.SiderealLongitude, d, chartAngleBound)
	}
	if dd := math.Abs(got.DegreeInRashi - want.DegreeInRashi); dd > chartAngleBound {
		t.Errorf("%s: degreeInRashi %v vs %v, |Δ| = %g deg > %g",
			where, got.DegreeInRashi, want.DegreeInRashi, dd, chartAngleBound)
		if dd > d {
			d = dd
		}
	}
	if got.Rashi != want.Rashi {
		t.Errorf("%s: rashi %+v, TypeScript %+v", where, got.Rashi, want.Rashi)
	}
	if got.Nakshatra != want.Nakshatra {
		t.Errorf("%s: nakshatra %+v, TypeScript %+v", where, got.Nakshatra, want.Nakshatra)
	}
	if got.Pada != want.Pada {
		t.Errorf("%s: pada %d, TypeScript %d", where, got.Pada, want.Pada)
	}
	return d
}

func TestSpecialLagnasMatchTypeScript(t *testing.T) {
	g := loadChartsGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	worst := 0.0
	checked, sunriseChecked := 0, 0
	for _, loc := range g.Locations {
		cases, ok := g.Special[loc.Name]
		if !ok {
			continue // Reykjavik: excluded by the generator
		}
		geo := types.GeoLocation{Latitude: loc.Latitude, Longitude: loc.Longitude}
		for _, c := range cases {
			when := types.Date(c.Ms).ISOString()
			gotSunrise, err := findSunriseBefore(ctx, c.Ms, geo)
			if err != nil {
				t.Fatalf("%s findSunriseBefore(%s): %v", loc.Name, when, err)
			}
			sunriseChecked++
			if gotSunrise != c.SunriseBefore {
				t.Errorf("%s %s: sunriseBefore %d, TypeScript %d (Δ %d ms): rise/set "+
					"is bit-identical by construction, so this is a regression in the "+
					"solver, not a special-lagna bug",
					loc.Name, when, gotSunrise, c.SunriseBefore, gotSunrise-c.SunriseBefore)
			}
			for _, arm := range []struct {
				label string
				fn    func() (types.LagnaInfo, error)
				want  types.LagnaInfo
			}{
				{"hora", func() (types.LagnaInfo, error) {
					return ComputeHoraLagna(ctx, c.Ms, geo, types.Lahiri, types.LanguageEn)
				}, c.Hora},
				{"ghati", func() (types.LagnaInfo, error) {
					return ComputeGhatiLagna(ctx, c.Ms, geo, types.Lahiri, types.LanguageEn)
				}, c.Ghati},
				{"bhava", func() (types.LagnaInfo, error) {
					return ComputeBhavaLagna(ctx, c.Ms, geo, types.Lahiri, types.LanguageEn)
				}, c.Bhava},
				{"sripati", func() (types.LagnaInfo, error) {
					return ComputeSripatiLagna(ctx, c.Ms, geo, types.Lahiri, types.LanguageEn)
				}, c.Sripati},
			} {
				got, err := arm.fn()
				if err != nil {
					t.Fatalf("%s %s %s: %v", loc.Name, arm.label, when, err)
				}
				checked++
				if d := compareLagna(t, loc.Name+"/"+arm.label+" @ "+when, got, arm.want); d > worst {
					worst = d
				}
			}
			cusps, err := ComputeSripatiLagnaWithCusps(ctx, c.Ms, geo, types.Lahiri, types.LanguageEn)
			if err != nil {
				t.Fatalf("%s sripatiCusps %s: %v", loc.Name, when, err)
			}
			if len(cusps.Cusps) != len(c.SripatiCusps) {
				t.Fatalf("%s %s: %d cusps, TypeScript %d", loc.Name, when,
					len(cusps.Cusps), len(c.SripatiCusps))
			}
			for k := range cusps.Cusps {
				if d := angleDelta(cusps.Cusps[k], c.SripatiCusps[k]); d > chartAngleBound {
					t.Errorf("%s %s: cusp %d = %v, TypeScript %v, |Δ| = %g deg > %g",
						loc.Name, when, k+1, cusps.Cusps[k], c.SripatiCusps[k], d, chartAngleBound)
				} else if d > worst {
					worst = d
				}
			}
			plain, err := ComputeSripatiLagna(ctx, c.Ms, geo, types.Lahiri, types.LanguageEn)
			if err != nil {
				t.Fatalf("%s sripati %s: %v", loc.Name, when, err)
			}
			if cusps.LagnaInfo != plain {
				t.Errorf("%s %s: the cusps variant's embedded lagna is %+v, the plain "+
					"function's %+v: D18's two functions have diverged",
					loc.Name, when, cusps.LagnaInfo, plain)
			}
		}
	}
	if sunriseChecked == 0 || checked == 0 {
		t.Fatal("no special-lagna cases were exercised: the golden's `special` map " +
			"keys do not match the location names, so this test proved nothing")
	}
	t.Logf("%d special lagnas and %d sunrise instants compared; worst angular |Δ| = %g deg",
		checked, sunriseChecked, worst)
}

func mustPositions(t *testing.T, ms int64, node NodeType) types.PlanetaryPositions {
	t.Helper()
	p, err := ComputePlanetaryPositions(astronomy.NewEphemerisCtx(), ms, types.Lahiri, nil, nil, node)
	if err != nil {
		t.Fatalf("ComputePlanetaryPositions(%s, %s): %v", types.Date(ms).ISOString(), node, err)
	}
	return p
}

func TestPlanetaryPositionsMatchTypeScript(t *testing.T) {
	g := loadChartsGolden(t)
	worst, worstWhere := 0.0, ""
	leaves := 0
	for _, c := range g.Positions {
		when := types.Date(c.Ms).ISOString()
		for _, arm := range []struct {
			node NodeType
			want types.PlanetaryPositions
		}{{NodeMean, c.Mean}, {NodeTrue, c.True}} {
			got := mustPositions(t, c.Ms, arm.node)
			for _, graha := range types.AllGrahas {
				gp, _ := got.Get(graha)
				wp, _ := arm.want.Get(graha)
				where := when + " " + string(arm.node) + " " + graha.String()
				d := comparePosition(t, where, *gp, *wp)
				leaves += 6
				if d > worst {
					worst, worstWhere = d, where
				}
			}
		}
	}
	if leaves != len(g.Positions)*2*types.GrahaCount*6 {
		t.Errorf("compared %d leaves, expected %d", leaves, len(g.Positions)*2*types.GrahaCount*6)
	}
	t.Logf("%d graha positions compared (%d top-level leaves); worst angular |Δ| = %g deg at %s "+
		"(bound %g)", len(g.Positions)*2*types.GrahaCount, leaves, worst, worstWhere, chartAngleBound)
}

func comparePosition(t *testing.T, where string, got, want types.GrahaPosition) float64 {
	t.Helper()
	if got.Planet != want.Planet {
		t.Errorf("%s: planet %s, TypeScript %s", where, got.Planet, want.Planet)
	}
	d := angleDelta(got.SiderealLongitude, want.SiderealLongitude)
	if d > chartAngleBound {
		t.Errorf("%s: siderealLongitude %v vs %v, |Δ| = %g deg > %g",
			where, got.SiderealLongitude, want.SiderealLongitude, d, chartAngleBound)
	}
	if dd := math.Abs(got.DegreeInRashi - want.DegreeInRashi); dd > chartAngleBound {
		t.Errorf("%s: degreeInRashi %v vs %v, |Δ| = %g deg > %g",
			where, got.DegreeInRashi, want.DegreeInRashi, dd, chartAngleBound)
		if dd > d {
			d = dd
		}
	}
	if got.Rashi != want.Rashi {
		t.Errorf("%s: rashi %+v, TypeScript %+v", where, got.Rashi, want.Rashi)
	}
	if got.IsRetrograde != want.IsRetrograde {
		t.Errorf("%s: isRetrograde %v, TypeScript %v: this is the sign of a "+
			"two-hour longitude difference, an invariant with zero tolerance "+
			"(docs/validation-tiers.md); see TestRetrogradeSignMargin for how close to a "+
			"station the sample got", where, got.IsRetrograde, want.IsRetrograde)
	}
	gn, wn := got.Nakshatra, want.Nakshatra
	if gn.Index != wn.Index || gn.Name != wn.Name || gn.Pada != wn.Pada {
		t.Errorf("%s: nakshatra index/name/pada %d/%q/%d, TypeScript %d/%q/%d",
			where, gn.Index, gn.Name, gn.Pada, wn.Index, wn.Name, wn.Pada)
	}
	if gn.DegreesInNakshatra != wn.DegreesInNakshatra {
		t.Errorf("%s: degreesInNakshatra %v, TypeScript %v: both are rounded to 4 "+
			"places, so a difference means a rounding tie was straddled and a "+
			"published value moved by 1e-4", where, gn.DegreesInNakshatra, wn.DegreesInNakshatra)
	}
	if gn.CompletionPercentage != wn.CompletionPercentage {
		t.Errorf("%s: completionPercentage %v, TypeScript %v",
			where, gn.CompletionPercentage, wn.CompletionPercentage)
	}
	if gn.EndTime != nil || wn.EndTime != nil {
		t.Errorf("%s: a graha position carries no transition, so endTime must be null "+
			"on both sides; got %v / %v", where, gn.EndTime, wn.EndTime)
	}
	return d
}

func TestRetrogradeSignMargin(t *testing.T) {
	g := loadChartsGolden(t)
	bodies := map[string]astronomy.PlanetBody{
		"mercury": astronomy.PlanetMercury, "venus": astronomy.PlanetVenus,
		"mars": astronomy.PlanetMars, "jupiter": astronomy.PlanetJupiter,
		"saturn": astronomy.PlanetSaturn,
	}
	ctx := astronomy.NewEphemerisCtx()
	minAbs, minWhere := math.Inf(1), ""
	worstDelta := 0.0
	n, retroCount := 0, 0
	for _, c := range g.RetrogradeDeltas {
		for name, want := range c.Deltas {
			body, ok := bodies[name]
			if !ok {
				t.Fatalf("golden names body %q, which the Go map does not have", name)
			}
			got := retrogradeDelta(ctx, body, c.Ms)
			n++
			if got < 0 {
				retroCount++
			}
			if (got < 0) != (want < 0) {
				t.Errorf("%s %s: sign of delta differs: Go %g, TypeScript %g",
					types.Date(c.Ms).ISOString(), name, got, want)
			}
			if d := math.Abs(got - want); d > worstDelta {
				worstDelta = d
			}
			if a := math.Abs(want); a < minAbs {
				minAbs, minWhere = a, types.Date(c.Ms).ISOString()+" "+name
			}
		}
	}
	if n == 0 {
		t.Fatal("no retrograde deltas were compared")
	}
	if retroCount == 0 || retroCount == n {
		t.Errorf("%d of %d probes were retrograde: the sample must contain both, or "+
			"the sign test is never exercised in one direction", retroCount, n)
	}
	if minAbs <= worstDelta*1e3 {
		t.Errorf("smallest |delta| in the sample is %g deg at %s, only %.1fx the worst "+
			"Go-vs-TS disagreement (%g deg). The sign is no longer safely determined; "+
			"investigate rather than widening anything", minAbs, minWhere, minAbs/worstDelta, worstDelta)
	}
	t.Logf("%d retrograde probes (%d retrograde); worst |Δdelta| = %g deg, smallest "+
		"|delta| = %g deg at %s, margin %.3g x", n, retroCount, worstDelta, minAbs,
		minWhere, minAbs/worstDelta)
}

func TestNatalBasisMatchesTypeScript(t *testing.T) {
	g := loadChartsGolden(t)
	if len(g.Basis) != len(g.Events) {
		t.Fatalf("golden has %d bases for %d events", len(g.Basis), len(g.Events))
	}
	for i, want := range g.Basis {
		ev := g.Events[i]
		if ev.Name != want.Name {
			t.Fatalf("basis[%d] is %q but events[%d] is %q", i, want.Name, i, ev.Name)
		}
		geo := types.GeoLocation{Latitude: ev.Loc.Latitude, Longitude: ev.Loc.Longitude}
		basis, err := ComputeNatalBasis(astronomy.NewEphemerisCtx(), want.Ms, geo, BirthChartOptions{})
		if err != nil {
			t.Fatalf("%s: %v", want.Name, err)
		}
		if string(basis.AyanamsaType) != want.AyanamsaType {
			t.Errorf("%s: ayanamsaType %q, TypeScript %q: the no-options default",
				want.Name, basis.AyanamsaType, want.AyanamsaType)
		}
		if string(basis.Lang) != want.Lang {
			t.Errorf("%s: lang %q, TypeScript %q", want.Name, basis.Lang, want.Lang)
		}
		if string(basis.NodeType) != want.NodeType {
			t.Errorf("%s: nodeType %q, TypeScript %q", want.Name, basis.NodeType, want.NodeType)
		}
		compareLagna(t, want.Name+" basis lagna", basis.Lagna, want.Lagna)

		order := GrahaList(&basis)
		if len(order) != len(want.GrahaOrder) {
			t.Fatalf("%s: grahaList has %d entries, TypeScript %d", want.Name,
				len(order), len(want.GrahaOrder))
		}
		for i := range order {
			if order[i].Key != want.GrahaOrder[i] {
				t.Errorf("%s: grahaList[%d] = %s, TypeScript %s: the canonical graha "+
					"order is encoded in five places and a reorder remaps every [9]T "+
					"table in the package", want.Name, i, order[i].Key, want.GrahaOrder[i])
			}
			wp, _ := want.Positions.Get(order[i].Key)
			comparePosition(t, want.Name+" "+order[i].Key.String(), *order[i].Pos, *wp)
		}
	}
	t.Logf("%d natal bases compared", len(g.Basis))
}

func TestNatalBasisOptionsTakeEffect(t *testing.T) {
	g := loadChartsGolden(t)
	want := g.BasisWithOptions
	ev := g.Events[2] // e3-1995-delhi
	geo := types.GeoLocation{Latitude: ev.Loc.Latitude, Longitude: ev.Loc.Longitude}
	basis, err := ComputeNatalBasis(astronomy.NewEphemerisCtx(), ev.Ms, geo, BirthChartOptions{
		Ayanamsa: types.Raman, Language: types.LanguageHi, NodeType: NodeTrue,
	})
	if err != nil {
		t.Fatalf("ComputeNatalBasis with options: %v", err)
	}
	if string(basis.AyanamsaType) != want.AyanamsaType || want.AyanamsaType != "raman" {
		t.Errorf("ayanamsaType %q, golden %q, want raman", basis.AyanamsaType, want.AyanamsaType)
	}
	if string(basis.Lang) != want.Lang || want.Lang != "hi" {
		t.Errorf("lang %q, golden %q, want hi", basis.Lang, want.Lang)
	}
	if string(basis.NodeType) != want.NodeType || want.NodeType != "true" {
		t.Errorf("nodeType %q, golden %q, want true", basis.NodeType, want.NodeType)
	}
	compareLagna(t, "basisWithOptions lagna", basis.Lagna, want.Lagna)
	for _, graha := range types.AllGrahas {
		gp, _ := basis.Positions.Get(graha)
		wp, _ := want.Positions.Get(graha)
		comparePosition(t, "basisWithOptions "+graha.String(), *gp, *wp)
	}
	def, err := ComputeNatalBasis(astronomy.NewEphemerisCtx(), ev.Ms, geo, BirthChartOptions{})
	if err != nil {
		t.Fatalf("ComputeNatalBasis default: %v", err)
	}
	if def.Lagna.SiderealLongitude == basis.Lagna.SiderealLongitude {
		t.Error("the raman and lahiri lagnas are identical: the ayanamsa option is " +
			"not reaching computeLagna")
	}
	if def.Positions.Rahu.SiderealLongitude == basis.Positions.Rahu.SiderealLongitude {
		t.Error("the mean and true nodes are identical: the nodeType option is not " +
			"reaching computePlanetaryPositions")
	}
	if def.Lagna.Rashi.Name == basis.Lagna.Rashi.Name {
		t.Errorf("the en and hi rashi names are both %q: the language option is not "+
			"reaching the resolvers", def.Lagna.Rashi.Name)
	}
}

func angleDelta(a, b float64) float64 {
	d := math.Abs(a - b)
	if d > 180 {
		d = 360 - d
	}
	return d
}
