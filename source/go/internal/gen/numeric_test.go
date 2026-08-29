package gen

import (
	"math"
	"testing"
)

// Ties matter most: ECMA rounds half away from zero, strconv to even.
func TestToPrecisionStringMatchesJS(t *testing.T) {
	cases := []struct {
		v    float64
		p    int
		want string
	}{
		{0.399, 3, "0.399"}, {0.2, 3, "0.200"}, {0.198, 3, "0.198"}, {0.38, 3, "0.380"},
		{1.4e-6, 3, "0.00000140"}, {8.42e-5, 3, "0.0000842"}, {7.18e-7, 3, "7.18e-7"},
		{3.7e-7, 3, "3.70e-7"}, {5.3e-7, 3, "5.30e-7"}, {5.37e-6, 3, "0.00000537"},
		{1.12e-5, 3, "0.0000112"}, {0.00602, 3, "0.00602"}, {0.00392, 3, "0.00392"},
		{20, 3, "20.0"}, {4.9, 3, "4.90"}, {90.4, 3, "90.4"},
		{0.0962, 3, "0.0962"}, {0.0995, 3, "0.0995"}, {0.324, 3, "0.324"}, {0.491, 3, "0.491"},
		{999.6, 3, "1.00e+3"}, {0.9996, 3, "1.00"},
		{1, 1, "1"}, {1, 17, "1.0000000000000000"},
		{123456, 3, "1.23e+5"}, {0, 3, "0.00"}, {-0.38, 3, "-0.380"},
		{1e21, 3, "1.00e+21"}, {1e-7, 3, "1.00e-7"}, {12345, 2, "1.2e+4"},
		// 0.5 and 0.15 are not exact halves as doubles; 2.5, 1.5 and 0.25 are.
		{0.5, 1, "0.5"}, {2.5, 1, "3"}, {1.5, 1, "2"}, {0.15, 1, "0.1"}, {0.25, 1, "0.3"},
	}
	for _, c := range cases {
		if got := toPrecisionString(c.v, c.p); got != c.want {
			t.Errorf("toPrecisionString(%v, %d) = %q, JS gives %q", c.v, c.p, got, c.want)
		}
	}
}

func TestToPrecisionValueAgreesWithString(t *testing.T) {
	s := uint32(0xBADC0DE)
	for i := 0; i < 20_000; i++ {
		s = s*1664525 + 1013904223
		mant := float64(s)/4294967296*2 - 1
		exp := float64(int(s)%40 - 20)
		// anti-FMA barrier
		v := float64(mant * math.Pow(10, exp))
		if v == 0 || math.IsInf(v, 0) {
			continue
		}
		p := int(s%17) + 1
		str := toPrecisionString(v, p)
		val := toPrecisionValue(v, p)
		var parsed float64
		if _, err := fmtSscan(str, &parsed); err != nil {
			t.Fatalf("toPrecisionString(%v, %d) = %q does not parse: %v", v, p, str, err)
		}
		if math.Float64bits(parsed) != math.Float64bits(val) {
			t.Fatalf("toPrecision(%v, %d): string %q parses to %v, value is %v", v, p, str, parsed, val)
		}
	}
}

func TestShortestRoundTrips(t *testing.T) {
	s := uint32(0x5eed)
	for i := 0; i < 2_000; i++ {
		s = s*1664525 + 1013904223
		mant := float64(s)/4294967296*2 - 1
		exp := float64(int(s)%24 - 12)
		v := float64(mant * math.Pow(10, exp)) // rounding barrier
		if v == 0 || math.IsInf(v, 0) {
			continue
		}
		for _, tol := range []float64{0, 1e-12, math.Abs(v) * 1e-6} {
			str := shortest(v, tol)
			var parsed float64
			if _, err := fmtSscan(str, &parsed); err != nil {
				t.Fatalf("shortest(%v, %v) = %q does not parse: %v", v, tol, str, err)
			}
			if math.Abs(parsed-v) > tol {
				t.Fatalf("shortest(%v, %v) = %q parses to %v, off by %.3e", v, tol, str, parsed, math.Abs(parsed-v))
			}
		}
		var exact float64
		if _, err := fmtSscan(shortest(v, 0), &exact); err != nil {
			t.Fatal(err)
		}
		if math.Float64bits(exact) != math.Float64bits(v) {
			t.Fatalf("shortest(%v, 0) = %q is not exact", v, shortest(v, 0))
		}
	}
}

func TestProbesAreTheTypeScriptSample(t *testing.T) {
	ts := probes(probeSeed)
	if len(ts) != probeCount {
		t.Fatalf("got %d probes, want %d", len(ts), probeCount)
	}
	s := uint32(probeSeed)
	for i := 0; i < 3; i++ {
		s = s*1664525 + 1013904223
		want := float64(s)/4294967296*2*tMax - tMax
		if ts[i] != want {
			t.Fatalf("probe %d: got %v, want %v", i, ts[i], want)
		}
	}
	for i, v := range ts {
		if v < -tMax || v > tMax {
			t.Fatalf("probe %d = %v is outside [-%v, %v]", i, v, tMax, tMax)
		}
	}
}

// {3, 5, -5} is non-monotone: k = 1's dropped 5 and -5 cancel, while k = 2's error is 5.
func TestTruncateIsATailSweep(t *testing.T) {
	terms := []float64{3, 5, -5}
	value := func(a float64, _ float64) float64 { return a }
	ts := []float64{1}

	count, err := truncate(terms, value, 1.0, ts)
	if count != 1 || err != 0 {
		t.Fatalf("got count %d err %v, want (1, 0): the cancelling tail", count, err)
	}
	if c, e := truncate([]float64{10, 4, -1}, value, 2.0, ts); c != 2 || e != 1 {
		t.Fatalf("got (%d, %v), want (2, 1)", c, e)
	}
	count, err = truncate(terms, value, -1, ts)
	if count != 3 || err != 0 {
		t.Fatalf("got count %d err %v, want (3, 0)", count, err)
	}
}
