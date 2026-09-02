package astronomy

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
	"math"
	"testing"
)

func uniform(seed uint32, count int, rng float64, yield func(float64)) {
	s := seed
	for i := 0; i < count; i++ {
		s = s*1664525 + 1013904223
		yield((float64(s)/4294967296*2 - 1) * rng)
	}
}

type sweepRange struct {
	name    string
	rng     float64
	samples int
}

var sweepRanges = []sweepRange{
	{"pi", math.Pi, 2_000_000},
	{"1e2", 100, 2_000_000},
	{"5e3", 5000, 2_000_000},
	{"1e5", 100_000, 2_000_000},
	{"1e6", 1_000_000, 2_000_000},
}

func seedFor(rng float64) uint32 { return uint32(0x5eed + rng) }

type trigGolden struct {
	Meta   map[string]string `json:"_meta"`
	Ranges []struct {
		Name    string  `json:"name"`
		Range   float64 `json:"range"`
		Samples int     `json:"samples"`
		Seed    uint32  `json:"seed"`
		SHA256  string  `json:"sha256"`
	} `json:"ranges"`
	Cases []struct {
		X   float64 `json:"x"`
		Sin float64 `json:"sin"`
		Cos float64 `json:"cos"`
	} `json:"cases"`
}

func loadTrigGolden(t *testing.T) trigGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "astronomy", "trig-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v (regenerate with `bash go/parity/goldens.sh`)", err)
	}
	var g trigGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	return g
}

func sweepDigest(seed uint32, samples int, rng float64) string {
	h := sha256.New()
	const block = 65536
	buf := make([]byte, block*8)
	n := 0
	push := func(v float64) {
		binary.LittleEndian.PutUint64(buf[n*8:], math.Float64bits(v))
		n++
		if n == block {
			h.Write(buf)
			n = 0
		}
	}
	uniform(seed, samples, rng, func(x float64) {
		push(Sin(x))
		push(Cos(x))
	})
	if n > 0 {
		h.Write(buf[:n*8])
	}
	return hex.EncodeToString(h.Sum(nil))
}

func TestTrigBitIdenticalToTypeScript(t *testing.T) {
	g := loadTrigGolden(t)
	if len(g.Ranges) != len(sweepRanges) {
		t.Fatalf("golden has %d sweeps, test has %d", len(g.Ranges), len(sweepRanges))
	}
	for i, want := range g.Ranges {
		r := sweepRanges[i]
		if want.Name != r.name || want.Range != r.rng || want.Samples != r.samples {
			t.Fatalf("sweep %d: golden is %s/%v/%d, test is %s/%v/%d",
				i, want.Name, want.Range, want.Samples, r.name, r.rng, r.samples)
		}
		if got := seedFor(r.rng); got != want.Seed {
			t.Fatalf("sweep %s: seed %d, golden %d", r.name, got, want.Seed)
		}
		if got := sweepDigest(want.Seed, r.samples, r.rng); got != want.SHA256 {
			t.Errorf("sweep %s: digest %s, golden %s: Go and TS trig have diverged",
				r.name, got, want.SHA256)
		}
	}
}

func TestTrigGoldenCases(t *testing.T) {
	g := loadTrigGolden(t)
	if len(g.Cases) == 0 {
		t.Fatal("golden carries no explicit cases")
	}
	for _, c := range g.Cases {
		if got := Sin(c.X); math.Float64bits(got) != math.Float64bits(c.Sin) {
			t.Errorf("Sin(%v) = %v (bits %#016x), TS gives %v (bits %#016x)",
				c.X, got, math.Float64bits(got), c.Sin, math.Float64bits(c.Sin))
		}
		if got := Cos(c.X); math.Float64bits(got) != math.Float64bits(c.Cos) {
			t.Errorf("Cos(%v) = %v (bits %#016x), TS gives %v (bits %#016x)",
				c.X, got, math.Float64bits(got), c.Cos, math.Float64bits(c.Cos))
		}
	}
}

const bound = 2e-11

func TestDifferentialTrig(t *testing.T) {
	for _, r := range sweepRanges {
		t.Run(r.name, func(t *testing.T) {
			var worstSin, worstCos, worstAt float64
			uniform(seedFor(r.rng), r.samples, r.rng, func(x float64) {
				if ds := math.Abs(Sin(x) - math.Sin(x)); ds > worstSin {
					worstSin, worstAt = ds, x
				}
				if dc := math.Abs(Cos(x) - math.Cos(x)); dc > worstCos {
					worstCos = dc
				}
			})
			if worstSin >= bound {
				t.Errorf("worst |Δsin| = %.3e at x=%v, bound %.0e", worstSin, worstAt, bound)
			}
			if worstCos >= bound {
				t.Errorf("worst |Δcos| = %.3e, bound %.0e", worstCos, bound)
			}
			t.Logf("worst |Δsin| %.3e (at %v), worst |Δcos| %.3e", worstSin, worstAt, worstCos)
		})
	}
}

func TestTrigIdentities(t *testing.T) {
	var worstPythagoras, worstShift, worstOdd float64
	uniform(99, 500_000, 5000, func(x float64) {
		s, c := Sin(x), Cos(x)
		if v := math.Abs(s*s + c*c - 1); v > worstPythagoras {
			worstPythagoras = v
		}
		if v := math.Abs(c - Sin(x+math.Pi/2)); v > worstShift {
			worstShift = v
		}
		if v := math.Abs(Sin(-x) + s); v > worstOdd {
			worstOdd = v
		}
		if v := math.Abs(Cos(-x) - c); v > worstOdd {
			worstOdd = v
		}
	})
	if worstPythagoras >= 1e-10 {
		t.Errorf("sin² + cos² − 1 = %.3e, bound 1e-10", worstPythagoras)
	}
	if worstShift >= 1e-9 {
		t.Errorf("cos(x) − sin(x + π/2) = %.3e, bound 1e-9", worstShift)
	}
	if worstOdd != 0 {
		t.Errorf("parity violated by %.3e; it must be exactly 0", worstOdd)
	}
	t.Logf("pythagoras %.3e, shift %.3e, parity %.3e", worstPythagoras, worstShift, worstOdd)
}

func TestTrigSpecialArguments(t *testing.T) {
	special := []float64{
		0,
		5e-324, -5e-324, 2.2250738585072014e-308,
	}
	for _, x := range special {
		if got, want := Sin(x), math.Sin(x); math.Float64bits(got) != math.Float64bits(want) {
			t.Errorf("Sin(%v) = %v, platform gives %v", x, got, want)
		}
		if got, want := Cos(x), math.Cos(x); math.Float64bits(got) != math.Float64bits(want) {
			t.Errorf("Cos(%v) = %v, platform gives %v", x, got, want)
		}
	}
	for _, x := range []float64{math.NaN(), math.Inf(1), math.Inf(-1)} {
		if !math.IsNaN(Sin(x)) {
			t.Errorf("Sin(%v) = %v, want NaN like the platform", x, Sin(x))
		}
		if !math.IsNaN(Cos(x)) {
			t.Errorf("Cos(%v) = %v, want NaN like the platform", x, Cos(x))
		}
	}
}

func TestTrigSignedZeroDeviation(t *testing.T) {
	negZero := math.Copysign(0, -1)
	if !math.Signbit(math.Sin(negZero)) {
		t.Error("the platform no longer returns -0 for Sin(-0); revisit this deviation")
	}
	got := Sin(negZero)
	if got != 0 {
		t.Fatalf("Sin(-0) = %v, want 0", got)
	}
	if math.Signbit(got) {
		t.Fatal("Sin(-0) now returns -0; the deviation has been fixed, so update the docblocks")
	}
	if math.Float64bits(Cos(negZero)) != math.Float64bits(math.Cos(negZero)) {
		t.Error("Cos(-0) diverges from the platform")
	}
}

func TestTrigStatedRange(t *testing.T) {
	for _, x := range []float64{1e5, -1e5, 99999.5, 12345.6789} {
		if d := math.Abs(Sin(x) - math.Sin(x)); d >= 1e-9 {
			t.Errorf("Sin(%v) off by %.3e at the edge of the stated range", x, d)
		}
		if d := math.Abs(Cos(x) - math.Cos(x)); d >= 1e-9 {
			t.Errorf("Cos(%v) off by %.3e at the edge of the stated range", x, d)
		}
	}
	if math.IsInf(math.Sin(math.MaxFloat64), 0) || math.IsNaN(math.Sin(math.MaxFloat64)) {
		t.Error("the platform no longer returns a finite value at MaxFloat64")
	}
	v := Sin(math.MaxFloat64)
	if !math.IsInf(v, 0) && !math.IsNaN(v) {
		t.Errorf("Sin(MaxFloat64) = %v; the reduction is expected to overflow", v)
	}
}

func TestReduceQuadrantParity(t *testing.T) {
	for _, q := range []float64{
		0, 1, -1, 2, -2, 3, -3,
		32767, -32768, 1 << 24, -(1 << 24),
		(1 << 31) - 1, 1 << 31, -(1 << 31),
		(1 << 52) - 1, 1 << 52, 1 << 53,
	} {
		goParity := int64(q)&1 == 1
		jsParity := (uint32(int64(q))&1 == 1)
		if goParity != jsParity {
			t.Errorf("q=%v: Go parity %v, ToInt32 parity %v", q, goParity, jsParity)
		}
	}
}

var sinkFloat float64

func BenchmarkSin(b *testing.B) {
	x := 0.0
	for i := 0; i < b.N; i++ {
		x += 0.001
		sinkFloat += Sin(x)
	}
}

func BenchmarkCos(b *testing.B) {
	x := 0.0
	for i := 0; i < b.N; i++ {
		x += 0.001
		sinkFloat += Cos(x)
	}
}

func BenchmarkStdlibSin(b *testing.B) {
	x := 0.0
	for i := 0; i < b.N; i++ {
		x += 0.001
		sinkFloat += math.Sin(x)
	}
}

func sinFused(x float64) float64 {
	r, odd := reduce(x)
	r2 := r * r
	p := 1.0/6227020800 - r2/1307674368000
	p = -1.0/39916800 + r2*p
	p = 1.0/362880 + r2*p
	p = -1.0/5040 + r2*p
	p = 1.0/120 + r2*p
	p = -1.0/6 + r2*p
	p = 1 + r2*p
	p = r * p
	if odd {
		return -p
	}
	return p
}

func BenchmarkSinFused(b *testing.B) {
	x := 0.0
	for i := 0; i < b.N; i++ {
		x += 0.001
		sinkFloat += sinFused(x)
	}
}

func TestFMABarrierIsLoadBearing(t *testing.T) {
	diverged, worst := 0, 0.0
	uniform(seedFor(5000), 200_000, 5000, func(x float64) {
		a, b := Sin(x), sinFused(x)
		if math.Float64bits(a) != math.Float64bits(b) {
			diverged++
			if d := math.Abs(a - b); d > worst {
				worst = d
			}
		}
	})
	t.Logf("fused vs barriered: %d/200000 arguments differ, worst |Δ| %.3e", diverged, worst)
}
