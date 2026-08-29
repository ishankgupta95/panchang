package astronomy

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"math"
	"os"
	"sort"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
)

type horizonsDeltaT struct {
	Comment       string    `json:"_comment"`
	Source        string    `json:"source"`
	Ephemeris     string    `json:"ephemeris"`
	JD            []float64 `json:"jd"`
	Year          []int     `json:"year"`
	DeltaTSeconds []float64 `json:"deltaTSeconds"`
}

func loadHorizonsDeltaT(t *testing.T) horizonsDeltaT {
	t.Helper()
	b, err := repopath.ReadTestData("reference", "horizons-deltat.json")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var f horizonsDeltaT
	if err := json.Unmarshal(b, &f); err != nil {
		t.Fatalf("parse fixture: %v", err)
	}
	if len(f.JD) == 0 || len(f.JD) != len(f.Year) || len(f.JD) != len(f.DeltaTSeconds) {
		t.Fatalf("fixture is malformed: %d jd, %d year, %d deltaT", len(f.JD), len(f.Year), len(f.DeltaTSeconds))
	}
	return f
}

func msForJdUt(jdUt float64) int64 {
	return int64((jdUt - 2440587.5) * 86_400_000)
}

// ≤2010 only: beyond that Horizons reports TT − UTC, a different quantity.
func TestDeltaTAgainstHorizons(t *testing.T) {
	f := loadHorizonsDeltaT(t)
	worst, worstYear, checked := 0.0, 0, 0
	for i := range f.JD {
		if f.Year[i] > 2010 {
			continue
		}
		checked++
		if d := math.Abs(DeltaTSeconds(msForJdUt(f.JD[i])) - f.DeltaTSeconds[i]); d > worst {
			worst, worstYear = d, f.Year[i]
		}
	}
	if checked < 10 {
		t.Fatalf("only %d fixture rows are ≤2010; the fixture has changed shape", checked)
	}
	if worst > 1.0 {
		t.Errorf("own ΔT worst %.3f s at %d, bound 1.0 s", worst, worstYear)
	}
	t.Logf("worst |Δ| vs Horizons over %d rows (1900-2010): %.4f s at %d", checked, worst, worstYear)
}

func TestDeltaTTracksLeapSecondChain(t *testing.T) {
	cases := []struct {
		ms   int64
		want float64
	}{
		{utcMS(1980, 5, 1), 32.184 + 19},
		{utcMS(1990, 5, 1), 32.184 + 25},
		{utcMS(2000, 5, 1), 32.184 + 32},
		{utcMS(2010, 5, 1), 32.184 + 34},
		{utcMS(2016, 5, 1), 32.184 + 36},
		{utcMS(2026, 5, 1), 32.184 + 37},
	}
	for _, c := range cases {
		if got := DeltaTSeconds(c.ms); math.Abs(got-c.want) > 1e-9 {
			t.Errorf("ΔT at %d ms = %v, want %v", c.ms, got, c.want)
		}
	}
}

func TestDeltaTHandoffIsContinuous(t *testing.T) {
	handoff := utcMS(2027, 0, 1)
	before := DeltaTSeconds(handoff - 1000)
	after := DeltaTSeconds(handoff + 1000)
	if d := math.Abs(after - before); d >= 0.01 {
		t.Errorf("ΔT steps by %v s at the measurement handoff", d)
	}
}

// Segments are not constrained to meet exactly; a jump past 1 s is a transcription error.
func TestDeltaTBranchContinuity(t *testing.T) {
	boundaries := []float64{-500, 500, 1600, 1700, 1800, 1860, 1900, 1920, 1941,
		1961, 1986, 2005, 2050, 2150}
	worst, worstAt := 0.0, 0.0
	for _, y := range boundaries {
		below := DeltaTSecondsForYear(y - 1e-6)
		above := DeltaTSecondsForYear(y + 1e-6)
		d := math.Abs(above - below)
		if d >= 1.0 {
			t.Errorf("ΔT jumps by %v s at the year-%v segment boundary", d, y)
		}
		if d > worst {
			worst, worstAt = d, y
		}
	}
	t.Logf("largest segment step: %.4f s at year %v (bound 1.0 s)", worst, worstAt)
}

func TestDeltaTPublishedAnchors(t *testing.T) {
	for _, c := range []struct{ y, want float64 }{
		{1900.0, -2.79}, {1950.0, 29.07}, {2000.0, 63.86},
	} {
		if got := DeltaTSecondsForYear(c.y); math.Abs(got-c.want) > 0.05 {
			t.Errorf("ΔT(%v) = %v, published %v", c.y, got, c.want)
		}
	}
}

func TestTTHelpersAreConsistent(t *testing.T) {
	ms := int64(1749945600000)
	utDays := float64(ms-j2000NoonMS) / 86_400_000

	// The bound is one ULP of utDays: the subtraction cancels 1e4 down to 1e-3.
	if d := math.Abs((TTDaysSinceJ2000(ms)-utDays)*86400 - DeltaTSeconds(ms)); d > 1e-6 {
		t.Errorf("ΔT does not round-trip out of the day count: off by %.3e s", d)
	}
	if got, want := JulianCenturiesTt(ms), TTDaysSinceJ2000(ms)/36525; got != want {
		t.Errorf("JulianCenturiesTt = %v, TTDaysSinceJ2000/36525 = %v", got, want)
	}
	// The absolute-JD path is lossy by design, by ~10 µs.
	viaJd := (TerrestrialTimeJd(ms) - (2451545 + utDays)) * 86400
	if d := math.Abs(viaJd - DeltaTSeconds(ms)); d >= 1e-4 {
		t.Errorf("the absolute-JD path loses %.3e s, expected < 1e-4", d)
	}
}

func TestTaiMinusUTCStepsAtEveryLeapSecond(t *testing.T) {
	if !sort.SliceIsSorted(taiMinusUTCTable, func(i, j int) bool {
		return taiMinusUTCTable[i][0] < taiMinusUTCTable[j][0]
	}) {
		t.Fatal("the leap-second table is not in chronological order; the linear scan assumes it is")
	}
	for i, row := range taiMinusUTCTable {
		if got := taiMinusUTC(row[0]); got != float64(row[1]) {
			t.Errorf("at the leap second itself (%d), TAI−UTC = %v, want %d", row[0], got, row[1])
		}
		if i > 0 {
			prev := taiMinusUTCTable[i-1][1]
			if got := taiMinusUTC(row[0] - 1); got != float64(prev) {
				t.Errorf("1 ms before leap second %d, TAI−UTC = %v, want %d", i, got, prev)
			}
		}
	}
	last := taiMinusUTCTable[len(taiMinusUTCTable)-1]
	if got := taiMinusUTC(last[0] + 100*365*86_400_000); got != float64(last[1]) {
		t.Errorf("TAI−UTC a century after the last leap second = %v, want %d held forward", got, last[1])
	}
}

func TestDeltaTEraDispatch(t *testing.T) {
	pre := leapSecondEpochMS - 1
	utDays := float64(pre-j2000NoonMS) / 86_400_000
	year := 2000 + (utDays-14)/daysPerTropicalYear
	if got, want := DeltaTSeconds(pre), DeltaTSecondsForYear(year); got != want {
		t.Errorf("before 1972 ΔT = %v, want the raw model %v", got, want)
	}
	if got, want := DeltaTSeconds(leapSecondEpochMS), ttMinusTAI+10.0; got != want {
		t.Errorf("at 1972-01-01 ΔT = %v, want %v", got, want)
	}
	if got, want := DeltaTSeconds(observedThroughMS), ttMinusTAI+37.0; got != want {
		t.Errorf("at the handoff ΔT = %v, want the chain's %v", got, want)
	}
	post := observedThroughMS + 1
	utDays = float64(post-j2000NoonMS) / 86_400_000
	year = 2000 + (utDays-14)/daysPerTropicalYear
	if got, want := DeltaTSeconds(post), DeltaTSecondsForYear(year)+observedMinusModelAtHandoff; got != want {
		t.Errorf("after the handoff ΔT = %v, want the offset model %v", got, want)
	}
}

type deltaTGolden struct {
	Meta         map[string]any `json:"_meta"`
	Seed         uint32         `json:"seed"`
	Samples      int            `json:"samples"`
	SamplesShort int            `json:"samplesShort"`

	MeasuredSeedXor uint32 `json:"measuredSeedXor"`
	MeasuredMsLo    int64  `json:"measuredMsLo"`
	MeasuredMsHi    int64  `json:"measuredMsHi"`

	Digests      map[string]string `json:"digests"`
	DigestsShort map[string]string `json:"digestsShort"`

	BoundYears         []float64 `json:"boundYears"`
	BoundYearValues    []float64 `json:"boundYearValues"`
	BoundInstants      []int64   `json:"boundInstants"`
	BoundInstantValues []float64 `json:"boundInstantValues"`

	CaseYears         []float64 `json:"caseYears"`
	CaseYearValues    []float64 `json:"caseYearValues"`
	CaseInstants      []int64   `json:"caseInstants"`
	CaseInstantValues []float64 `json:"caseInstantValues"`
	CaseTtDays        []float64 `json:"caseTtDays"`
	CaseTtJd          []float64 `json:"caseTtJd"`
	CaseCenturies     []float64 `json:"caseCenturies"`

	ObservedMinusModelAtHandoff float64 `json:"observedMinusModelAtHandoff"`
}

func loadDeltaTGolden(t *testing.T) deltaTGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "astronomy", "deltat-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v (regenerate with `bash go/parity/goldens.sh`)", err)
	}
	var g deltaTGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	return g
}

func unit01(seed uint32, count int, yield func(float64)) {
	s := seed
	for i := 0; i < count; i++ {
		s = s*1664525 + 1013904223
		yield(float64(s) / 4294967296)
	}
}

func deltaTDigest(count int, gen func(int, func(float64)), fn func(float64) float64) string {
	h := sha256.New()
	const block = 65536
	buf := make([]byte, block*8)
	n := 0
	gen(count, func(v float64) {
		binary.LittleEndian.PutUint64(buf[n*8:], math.Float64bits(fn(v)))
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

func TestDeltaTBitIdenticalInTheMeasuredEra(t *testing.T) {
	g := loadDeltaTGolden(t)
	samples, digests := g.Samples, g.Digests
	if os.Getenv("GEN_FULL") == "" {
		samples, digests = g.SamplesShort, g.DigestsShort
	}
	measured := func(count int, yield func(float64)) {
		unit01(g.Seed^g.MeasuredSeedXor, count, func(u float64) {
			yield(math.Floor(float64(g.MeasuredMsLo) + u*float64(g.MeasuredMsHi-g.MeasuredMsLo)))
		})
	}
	got := map[string]string{
		"deltaTSeconds":     deltaTDigest(samples, measured, func(ms float64) float64 { return DeltaTSeconds(int64(ms)) }),
		"ttDaysSinceJ2000":  deltaTDigest(samples, measured, func(ms float64) float64 { return TTDaysSinceJ2000(int64(ms)) }),
		"terrestrialTimeJd": deltaTDigest(samples, measured, func(ms float64) float64 { return TerrestrialTimeJd(int64(ms)) }),
		"julianCenturiesTt": deltaTDigest(samples, measured, func(ms float64) float64 { return JulianCenturiesTt(int64(ms)) }),
	}
	if len(got) != len(digests) {
		t.Errorf("Go checks %d accessors, the golden has %d", len(got), len(digests))
	}
	for name, want := range digests {
		if got[name] != want {
			t.Errorf("%s: digest %s, golden %s: Go and TS ΔT have diverged inside the measured era, "+
				"where the arithmetic is a table lookup and one addition (%d samples)",
				name, got[name], want, samples)
		}
	}
}

// 27x the worst measured **-vs-products divergence.
const deltaTPowBound = 1e-10

func TestDeltaTWithinPowFormulationBound(t *testing.T) {
	g := loadDeltaTGolden(t)
	if len(g.BoundYears) == 0 || len(g.BoundYears) != len(g.BoundYearValues) {
		t.Fatalf("golden bound sample is malformed: %d years, %d values", len(g.BoundYears), len(g.BoundYearValues))
	}

	worst, worstAt, exact := 0.0, 0.0, 0
	for i, y := range g.BoundYears {
		got := DeltaTSecondsForYear(y)
		if math.Float64bits(got) == math.Float64bits(g.BoundYearValues[i]) {
			exact++
		}
		if d := math.Abs(got - g.BoundYearValues[i]); d > worst {
			worst, worstAt = d, y
		}
	}
	if worst > deltaTPowBound {
		t.Errorf("DeltaTSecondsForYear: worst |Δ| vs TS %.3e s at year %v, bound %.0e",
			worst, worstAt, deltaTPowBound)
	}
	t.Logf("DeltaTSecondsForYear over %d years in [-1000, 3000]: worst |Δ| %.3e s at %v; %d/%d bit-exact",
		len(g.BoundYears), worst, worstAt, exact, len(g.BoundYears))

	worst, worstMs := 0.0, int64(0)
	for i, ms := range g.BoundInstants {
		if d := math.Abs(DeltaTSeconds(ms) - g.BoundInstantValues[i]); d > worst {
			worst, worstMs = d, ms
		}
	}
	if worst > deltaTPowBound {
		t.Errorf("DeltaTSeconds: worst |Δ| vs TS %.3e s at %d ms, bound %.0e", worst, worstMs, deltaTPowBound)
	}
	t.Logf("DeltaTSeconds over %d instants in [1700, 2300]: worst |Δ| %.3e s", len(g.BoundInstants), worst)
}

func TestDeltaTGoldenCases(t *testing.T) {
	g := loadDeltaTGolden(t)

	worst, worstAt := 0.0, 0.0
	for i, y := range g.CaseYears {
		if d := math.Abs(DeltaTSecondsForYear(y) - g.CaseYearValues[i]); d > worst {
			worst, worstAt = d, y
		}
	}
	if worst > deltaTPowBound {
		t.Errorf("DeltaTSecondsForYear boundary cases: worst |Δ| %.3e s at year %v, bound %.0e",
			worst, worstAt, deltaTPowBound)
	}
	t.Logf("segment-boundary cases: worst |Δ| %.3e s at year %v", worst, worstAt)

	for i, ms := range g.CaseInstants {
		for _, c := range []struct {
			name string
			got  float64
			want float64
		}{
			{"DeltaTSeconds", DeltaTSeconds(ms), g.CaseInstantValues[i]},
			{"TTDaysSinceJ2000", TTDaysSinceJ2000(ms), g.CaseTtDays[i]},
			{"TerrestrialTimeJd", TerrestrialTimeJd(ms), g.CaseTtJd[i]},
			{"JulianCenturiesTt", JulianCenturiesTt(ms), g.CaseCenturies[i]},
		} {
			if d := math.Abs(c.got - c.want); d > deltaTPowBound {
				t.Errorf("%s(%d ms) = %v, TS gives %v (Δ %.3e)", c.name, ms, c.got, c.want, d)
			}
		}
	}

	if math.Abs(observedMinusModelAtHandoff-g.ObservedMinusModelAtHandoff) > 1e-12 {
		t.Errorf("observedMinusModelAtHandoff = %v, TS gives %v",
			observedMinusModelAtHandoff, g.ObservedMinusModelAtHandoff)
	}
	t.Logf("observedMinusModelAtHandoff = %.6f s", observedMinusModelAtHandoff)
}
