package astronomy

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"math"
	"os"
	"sort"
	"strings"
	"testing"
)

type ephemerisGolden struct {
	Meta          map[string]string    `json:"_meta"`
	Seed          uint32               `json:"seed"`
	Samples       int                  `json:"samples"`
	SamplesShort  int                  `json:"samplesShort"`
	TMaxCenturies float64              `json:"tMaxCenturies"`
	Digests       map[string]string    `json:"digests"`
	DigestsShort  map[string]string    `json:"digestsShort"`
	Cases         map[string][]float64 `json:"cases"`
}

func (g ephemerisGolden) sample() (int, map[string]string) {
	if os.Getenv("GEN_FULL") != "" {
		return g.Samples, g.Digests
	}
	return g.SamplesShort, g.DigestsShort
}

func loadEphemerisGolden(t *testing.T) ephemerisGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "astronomy", "ephemeris-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v (regenerate with `bash go/parity/goldens.sh`)", err)
	}
	var g ephemerisGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	return g
}

func ephemerisAccessors() map[string]func(float64) float64 {
	out := map[string]func(float64) float64{
		"moonElpLongitude":      MoonElpLongitude,
		"moonElpLatitude":       MoonElpLatitude,
		"moonElpLatitudeCoarse": MoonElpLatitudeCoarse,
		"moonElpDistance":       MoonElpDistance,
		"moonElpDistanceTrack":  MoonElpDistanceTrack,
		"moonElpDistanceCoarse": MoonElpDistanceCoarse,
		"millennia":             func(t float64) float64 { return Millennia(t * 36525) },
		"earthRadiusCoarse":     func(t float64) float64 { return EarthRadiusCoarse(t * 36525) },
	}
	bodies := map[string]VsopBody{
		"earth": Earth, "mercury": Mercury, "venus": Venus,
		"mars": Mars, "jupiter": Jupiter, "saturn": Saturn,
	}
	for name, body := range bodies {
		b := body
		out["heliocentricLongitude:"+name] = func(t float64) float64 { return HeliocentricLongitude(b, t*36525) }
		out["heliocentricLatitude:"+name] = func(t float64) float64 { return HeliocentricLatitude(b, t*36525) }
		out["heliocentricRadius:"+name] = func(t float64) float64 { return HeliocentricRadius(b, t*36525) }
		for axis := 0; axis < 3; axis++ {
			a := axis
			out[fmt.Sprintf("heliocentricRect:%s:%d", name, axis)] = func(t float64) float64 {
				return HeliocentricRect(b, t*36525)[a]
			}
		}
	}
	for axis := 0; axis < 3; axis++ {
		a := axis
		out[fmt.Sprintf("earthRect:%d", axis)] = func(t float64) float64 {
			return EarthRect(NewEphemerisCtx(), t*36525)[a]
		}
	}
	out["meanObliquityArcsec"] = MeanObliquityArcsec
	out["nutationDpsi"] = func(t float64) float64 {
		dpsi, _ := Nutation(NewEphemerisCtx(), t)
		return dpsi
	}
	out["nutationDeps"] = func(t float64) float64 {
		_, deps := Nutation(NewEphemerisCtx(), t)
		return deps
	}
	for axis := 0; axis < 3; axis++ {
		a := axis
		out[fmt.Sprintf("elpToEclipticOfDate:%d", axis)] = func(t float64) float64 {
			return ElpToEclipticOfDate(
				MoonElpLongitude(t), MoonElpLatitudeCoarse(t), MoonElpDistanceCoarse(t), t)[a]
		}
	}

	synthetic := []float64{
		2.5, 0.25, 1.5, 0, -1.25, 1.1, -0.7, 1, 0.5, 2.2, 3.3, 2,
		-0.125, 0.9, -1.9, 3, 0.0625, 1.4, 0.6, 4, -0.03125, 2.1, -0.2, 5,
	}
	out["evaluateVsop:synthetic"] = func(t float64) float64 { return EvaluateVsop(synthetic, t/10) }
	return out
}

func ephemerisEpochs(seed uint32, count int, tMax float64, yield func(float64)) {
	uniform(seed, count, tMax, yield)
}

func ephemerisDigest(fn func(float64) float64, seed uint32, count int, tMax float64) string {
	h := sha256.New()
	const block = 65536
	buf := make([]byte, block*8)
	n := 0
	ephemerisEpochs(seed, count, tMax, func(t float64) {
		binary.LittleEndian.PutUint64(buf[n*8:], math.Float64bits(fn(t)))
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

func usesPlatformTrig(name string) bool {
	return strings.HasPrefix(name, "heliocentricRect:") ||
		strings.HasPrefix(name, "earthRect:") ||
		strings.HasPrefix(name, "elpToEclipticOfDate:")
}

func TestEphemerisBitIdenticalToTypeScript(t *testing.T) {
	g := loadEphemerisGolden(t)
	accessors := ephemerisAccessors()

	if len(accessors) != len(g.Digests) {
		t.Errorf("Go has %d accessors, the golden has %d", len(accessors), len(g.Digests))
	}
	samples, digests := g.sample()
	names := make([]string, 0, len(digests))
	for name := range digests {
		names = append(names, name)
	}
	sort.Strings(names)
	checked := 0
	for _, name := range names {
		fn, ok := accessors[name]
		if !ok {
			t.Errorf("%s: in the golden, not in the Go accessor map", name)
			continue
		}
		if usesPlatformTrig(name) {
			continue
		}
		checked++
		got := ephemerisDigest(fn, g.Seed, samples, g.TMaxCenturies)
		if got != digests[name] {
			t.Errorf("%s: digest %s, golden %s: Go and TS evaluation have diverged (%d epochs)",
				name, got, digests[name], samples)
		}
	}
	for name := range accessors {
		if _, ok := g.Digests[name]; !ok {
			t.Errorf("%s: in the Go accessor map, not in the golden", name)
		}
	}
	if checked < 30 {
		t.Errorf("only %d accessors were held to bit-identity; expected at least 30", checked)
	}
}

func TestEphemerisRectWithinPlatformTrigBound(t *testing.T) {
	const angleBound = 1e-13  // radians
	const lengthBound = 1e-14 // relative
	g := loadEphemerisGolden(t)
	ts := g.Cases["_t"]
	accessors := ephemerisAccessors()

	vectors := map[string][3]string{}
	for name := range g.Digests {
		if !usesPlatformTrig(name) {
			continue
		}
		base := name[:strings.LastIndex(name, ":")]
		axis := name[strings.LastIndex(name, ":")+1:]
		v := vectors[base]
		switch axis {
		case "0":
			v[0] = name
		case "1":
			v[1] = name
		case "2":
			v[2] = name
		}
		vectors[base] = v
	}
	if len(vectors) != 8 {
		t.Fatalf("found %d platform-trig vectors, expected 8 (six bodies + earthRect + elpToEclipticOfDate)", len(vectors))
	}

	bases := make([]string, 0, len(vectors))
	for base := range vectors {
		bases = append(bases, base)
	}
	sort.Strings(bases)

	worstAngle, worstLength, worstAt := 0.0, 0.0, ""
	for _, base := range bases {
		names := vectors[base]
		for i, tt := range ts {
			var got, want [3]float64
			for axis := 0; axis < 3; axis++ {
				got[axis] = accessors[names[axis]](tt)
				want[axis] = g.Cases[names[axis]][i]
			}
			gl := math.Sqrt(got[0]*got[0] + got[1]*got[1] + got[2]*got[2])
			wl := math.Sqrt(want[0]*want[0] + want[1]*want[1] + want[2]*want[2])
			if wl == 0 {
				continue
			}
			cx := got[1]*want[2] - got[2]*want[1]
			cy := got[2]*want[0] - got[0]*want[2]
			cz := got[0]*want[1] - got[1]*want[0]
			angle := math.Sqrt(cx*cx+cy*cy+cz*cz) / (gl * wl)
			if angle > worstAngle {
				worstAngle, worstAt = angle, base
			}
			if d := math.Abs(gl-wl) / wl; d > worstLength {
				worstLength = d
			}
		}
	}
	if worstAngle > angleBound {
		t.Errorf("worst rect direction error %.3e rad (%s), bound %.0e", worstAngle, worstAt, angleBound)
	}
	if worstLength > lengthBound {
		t.Errorf("worst rect length error %.3e relative, bound %.0e", worstLength, lengthBound)
	}
	t.Logf("rect vs TS over %d epochs x %d vectors: direction %.3e rad (worst at %s), length %.3e relative",
		len(ts), len(vectors), worstAngle, worstAt, worstLength)
}

func TestEphemerisGoldenCases(t *testing.T) {
	g := loadEphemerisGolden(t)
	ts, ok := g.Cases["_t"]
	if !ok || len(ts) == 0 {
		t.Fatal("golden carries no epochs")
	}
	for name, fn := range ephemerisAccessors() {
		if usesPlatformTrig(name) {
			continue
		}
		want, ok := g.Cases[name]
		if !ok {
			t.Errorf("%s: no cases in the golden", name)
			continue
		}
		if len(want) != len(ts) {
			t.Errorf("%s: %d cases for %d epochs", name, len(want), len(ts))
			continue
		}
		for i, tt := range ts {
			if got := fn(tt); math.Float64bits(got) != math.Float64bits(want[i]) {
				t.Errorf("%s(t=%v) = %v (bits %#016x), TS gives %v (bits %#016x)",
					name, tt, got, math.Float64bits(got), want[i], math.Float64bits(want[i]))
				break
			}
		}
	}
}
