package astronomy

import (
	"encoding/json"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"math"
	"os"
	"sort"
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

type cacheGolden struct {
	Meta         map[string]any       `json:"_meta"`
	Seed         uint32               `json:"seed"`
	Samples      int                  `json:"samples"`
	SamplesShort int                  `json:"samplesShort"`
	MsLo         int64                `json:"msLo"`
	MsHi         int64                `json:"msHi"`
	Digests      map[string]string    `json:"digests"`
	DigestsShort map[string]string    `json:"digestsShort"`
	CaseInstants []int64              `json:"caseInstants"`
	Cases        map[string][]float64 `json:"cases"`
}

func loadCacheGolden(t *testing.T) cacheGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "astronomy", "cache-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v (regenerate with `bash go/parity/goldens.sh`)", err)
	}
	var g cacheGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	return g
}

func cacheAccessors(t *testing.T) map[string]func(int64) float64 {
	t.Helper()
	out := map[string]func(int64) float64{}
	for _, mode := range []LongitudeCacheMode{ModeExact, ModeInterpolated} {
		c, err := NewLongitudeCache(NewEphemerisCtx(), types.Lahiri, mode)
		if err != nil {
			t.Fatalf("NewLongitudeCache(%s): %v", mode, err)
		}
		out["longitudeCache:"+string(mode)+":moon"] = c.GetMoon
		out["longitudeCache:"+string(mode)+":sun"] = c.GetSun
		out["longitudeCache:"+string(mode)+":tropicalMoon"] = c.GetTropicalMoon
		out["longitudeCache:"+string(mode)+":tropicalSun"] = c.GetTropicalSun
	}
	return out
}

func cacheIsBounded(name string) bool {
	return strings.HasSuffix(name, ":moon") || strings.HasSuffix(name, ":tropicalMoon")
}

func TestLongitudeCacheBitIdenticalToTypeScript(t *testing.T) {
	g := loadCacheGolden(t)
	accessors := cacheAccessors(t)
	samples, digests := g.Samples, g.Digests
	if os.Getenv("GEN_FULL") == "" {
		samples, digests = g.SamplesShort, g.DigestsShort
	}
	if len(accessors) != len(g.Digests) {
		t.Errorf("Go has %d accessors, the golden has %d", len(accessors), len(g.Digests))
	}

	instants := func(count int, yield func(float64)) {
		unit01(g.Seed, count, func(u float64) {
			yield(math.Floor(float64(g.MsLo) + u*float64(g.MsHi-g.MsLo)))
		})
	}

	names := make([]string, 0, len(digests))
	for n := range digests {
		names = append(names, n)
	}
	sort.Strings(names)
	exact := 0
	for _, name := range names {
		fn, ok := accessors[name]
		if !ok {
			t.Errorf("%s: in the golden, not in the Go accessor map", name)
			continue
		}
		if cacheIsBounded(name) {
			continue
		}
		exact++
		got := deltaTDigest(samples, instants, func(ms float64) float64 { return fn(int64(ms)) })
		if got != digests[name] {
			t.Errorf("%s: digest %s, golden %s: Go and TS have diverged over %d instants",
				name, got, digests[name], samples)
		}
	}
	for name := range accessors {
		if _, ok := g.Digests[name]; !ok {
			t.Errorf("%s: in the Go accessor map, not in the golden", name)
		}
	}
	if exact != 4 {
		t.Errorf("%d accessors were held to bit-identity; expected exactly 4", exact)
	}
	t.Logf("%d of %d accessors bit-identical over %d instants; the Moon half is bounded below",
		exact, len(accessors), samples)
}

func TestLongitudeCacheWithinPlatformTrigBound(t *testing.T) {
	const angleBoundDeg = 1e-11
	g := loadCacheGolden(t)
	accessors := cacheAccessors(t)

	worst, worstAt, worstMs := 0.0, "", int64(0)
	checked := 0
	for name, want := range g.Cases {
		if !cacheIsBounded(name) {
			continue
		}
		checked++
		fn := accessors[name]
		for i, ms := range g.CaseInstants {
			d := math.Abs(angularDelta(fn(ms), want[i]))
			if d > worst {
				worst, worstAt, worstMs = d, name, ms
			}
		}
	}
	if checked != 4 {
		t.Fatalf("%d bounded accessors checked, expected 4", checked)
	}
	if worst > angleBoundDeg {
		t.Errorf("worst angular |Δ| %.3e deg (%s at ms=%d), bound %.0e",
			worst, worstAt, worstMs, angleBoundDeg)
	}
	t.Logf("%d bounded accessors over %d instants: worst |Δ| %.3e deg (%s at ms=%d)",
		checked, len(g.CaseInstants), worst, worstAt, worstMs)
}

func TestLongitudeCaseValuesAgreeExactly(t *testing.T) {
	g := loadCacheGolden(t)
	accessors := cacheAccessors(t)
	checked := 0
	for name, want := range g.Cases {
		if cacheIsBounded(name) {
			continue
		}
		fn := accessors[name]
		for i, ms := range g.CaseInstants {
			got := fn(ms)
			if math.Float64bits(got) != math.Float64bits(want[i]) {
				t.Errorf("%s at ms=%d: Go %v (%#x), TS %v (%#x)",
					name, ms, got, math.Float64bits(got), want[i], math.Float64bits(want[i]))
			}
			checked++
		}
	}
	if checked == 0 {
		t.Fatal("no exact accessors were checked; the classifier has stopped matching")
	}
	t.Logf("%d exact case values, all bit-identical", checked)
}

func TestChebyshevAbscissae(t *testing.T) {
	v8Moon := []float64{
		1, 0.9396926207859084, 0.766044443118978, 0.5000000000000001,
		0.17364817766693041, -0.1736481776669303, -0.4999999999999998,
		-0.7660444431189779, -0.9396926207859083, -1,
	}
	v8Sun := []float64{
		1, 0.9009688679024191, 0.6234898018587336, 0.22252093395631445,
		-0.22252093395631434, -0.6234898018587335, -0.900968867902419, -1,
	}
	for _, tc := range []struct {
		nodes int
		v8    []float64
	}{{moonNodes, v8Moon}, {sunNodes, v8Sun}} {
		if len(tc.v8) != tc.nodes {
			t.Fatalf("%d nodes but %d pinned values", tc.nodes, len(tc.v8))
		}
		got := make([]float64, tc.nodes)
		c := newChebyshevLongitude(func(float64) float64 { return 0 }, 0, float64(dayMS), tc.nodes)
		copy(got, c.nodeX)

		diffs := 0
		for k := range got {
			if math.Float64bits(got[k]) != math.Float64bits(tc.v8[k]) {
				diffs++
				t.Logf("nodes=%d k=%d: Go %v, V8 %v (|Δ| %.3e)", tc.nodes, k, got[k], tc.v8[k],
					math.Abs(got[k]-tc.v8[k]))
			}
		}
		if diffs != 0 {
			t.Errorf("%d abscissae must all match V8; %d differ", tc.nodes, diffs)
		}
		if got[0] != 1 || got[tc.nodes-1] != -1 {
			t.Errorf("nodes=%d: endpoints are %v and %v, want exactly 1 and -1",
				tc.nodes, got[0], got[tc.nodes-1])
		}
		for k := 1; k < tc.nodes; k++ {
			if !(got[k] < got[k-1]) {
				t.Errorf("nodes=%d: abscissae not strictly decreasing at k=%d", tc.nodes, k)
			}
		}
		for k := 0; k < tc.nodes; k++ {
			mirror := -got[tc.nodes-1-k]
			if d := math.Abs(got[k] - mirror); d > 1e-15 {
				t.Errorf("nodes=%d: abscissae antisymmetric only to %.3e at k=%d (%v vs %v), "+
					"bound 1e-15", tc.nodes, d, k, got[k], mirror)
			}
		}
	}
}
