package jsnum

import (
	"math"
	"strconv"
	"testing"
)

func TestRoundMatchesECMA262(t *testing.T) {
	cases := []struct {
		in, want float64
	}{
		{0.5, 1}, {1.5, 2}, {2.5, 3}, {-0.5, 0}, {-1.5, -1}, {-2.5, -2},
		{0.4, 0}, {0.6, 1}, {-0.4, 0}, {-0.6, -1},
		{3, 3}, {-3, -3},
		// The largest double below ½; math.Floor(x+0.5) gets this wrong.
		{0.49999999999999994, 0},
		{-0.49999999999999994, 0},
		// Beyond 2⁵² every double is already integral.
		{4503599627370497, 4503599627370497},
		{-4503599627370497, -4503599627370497},
		{math.MaxFloat64, math.MaxFloat64},
	}
	for _, c := range cases {
		if got := Round(c.in); got != c.want {
			t.Errorf("Round(%v) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestRoundDivergesFromMathRound(t *testing.T) {
	diverged := 0
	for _, x := range []float64{-0.5, -1.5, -2.5, -3.5, -100.5} {
		if Round(x) != math.Round(x) {
			diverged++
		}
	}
	if diverged != 5 {
		t.Fatalf("Round agreed with math.Round on %d/5 negative ties; the tie rule is wrong", 5-diverged)
	}
}

func TestRoundSpecials(t *testing.T) {
	if !math.IsNaN(Round(math.NaN())) {
		t.Error("Round(NaN) must be NaN")
	}
	if !math.IsInf(Round(math.Inf(1)), 1) || !math.IsInf(Round(math.Inf(-1)), -1) {
		t.Error("Round(±Inf) must be ±Inf")
	}
	if got := Round(0); got != 0 || math.Signbit(got) {
		t.Error("Round(+0) must be +0")
	}
	if got := Round(math.Copysign(0, -1)); got != 0 || !math.Signbit(got) {
		t.Error("Round(-0) must be -0")
	}
}

func TestRoundSignedZeroDeviation(t *testing.T) {
	got := Round(-0.2)
	if got != 0 {
		t.Fatalf("Round(-0.2) = %v, want 0", got)
	}
	if math.Signbit(got) {
		t.Fatal("Round(-0.2) returned -0; the deviation this test pins has been fixed, so update the docblock")
	}
}

func TestFormatFloatMatchesJS(t *testing.T) {
	cases := []struct {
		in   float64
		want string
	}{
		{0, "0"}, {math.Copysign(0, -1), "0"}, {1, "1"}, {-1, "-1"}, {0.5, "0.5"},
		{100, "100"}, {1000, "1000"}, {1e6, "1000000"},
		{1e20, "100000000000000000000"}, {1e21, "1e+21"}, {1e22, "1e+22"}, {1.5e21, "1.5e+21"},
		{123456789012345678901, "123456789012345680000"},
		{1e-6, "0.000001"}, {1e-7, "1e-7"}, {5e-7, "5e-7"},
		{0.000028547284, "0.000028547284"}, {-0.000028547284, "-0.000028547284"},
		{3.20170955e-8, "3.20170955e-8"}, {-1.53637456e-10, "-1.53637456e-10"},
		{22639.58578, "22639.58578"}, {8328.6914269556, "8328.6914269556"},
		{0.0001570278, "0.0001570278"}, {2.504e-7, "2.504e-7"}, {-1.2e-9, "-1.2e-9"},
		{5e-324, "5e-324"}, {1.7976931348623157e308, "1.7976931348623157e+308"},
		{0.1, "0.1"}, {0.2, "0.2"}, {0.3, "0.3"},
		{1.0 / 3.0, "0.3333333333333333"}, {2.0 / 3.0, "0.6666666666666666"},
		{1e-323, "1e-323"},
		{1234567890123456789012345, "1.2345678901234568e+24"},
		{-0.00000140, "-0.0000014"}, {7.18e-7, "7.18e-7"}, {3.7e-7, "3.7e-7"},
		{5.3e-7, "5.3e-7"}, {0.00000537, "0.00000537"}, {0.0000112, "0.0000112"},
		{1.4e-6, "0.0000014"},
	}
	for _, c := range cases {
		if got := FormatFloat(c.in); got != c.want {
			t.Errorf("FormatFloat(%v) = %q, JS gives %q", c.in, got, c.want)
		}
	}
	for _, v := range []float64{math.NaN(), math.Inf(1), math.Inf(-1)} {
		got := FormatFloat(v)
		want := map[bool]string{true: "NaN"}[math.IsNaN(v)]
		if want == "" {
			want = "Infinity"
			if math.Signbit(v) {
				want = "-Infinity"
			}
		}
		if got != want {
			t.Errorf("FormatFloat(%v) = %q, JS gives %q", v, got, want)
		}
	}
}

func TestFormatFloatRoundTrips(t *testing.T) {
	s := uint32(0xC0FFEE)
	for i := 0; i < 200_000; i++ {
		s = s*1664525 + 1013904223
		mant := float64(s)/4294967296*2 - 1
		exp := float64(int(s)%600 - 300)
		v := float64(mant * math.Pow(10, exp)) // rounding barrier
		if math.IsInf(v, 0) || v == 0 {
			continue
		}
		got, err := strconv.ParseFloat(FormatFloat(v), 64)
		if err != nil {
			t.Fatalf("FormatFloat(%v) = %q does not parse: %v", v, FormatFloat(v), err)
		}
		if math.Float64bits(got) != math.Float64bits(v) {
			t.Fatalf("FormatFloat(%v) = %q parses back as %v", v, FormatFloat(v), got)
		}
	}
}

func TestHypotMatchesJS(t *testing.T) {
	two := []struct {
		a, b, want float64
	}{
		{3, 4, 5},
		{1e-300, 1e-300, 1.4142135623730952e-300},
		{0, 0, 0},
		{1, 0, 1},
		{-3, -4, 5},
		{1e300, 1e300, 1.4142135623730952e300},
		{0.9999, 0.0001, 0.9999000050004999},
	}
	for _, c := range two {
		if got := Hypot2(c.a, c.b); math.Float64bits(got) != math.Float64bits(c.want) {
			t.Errorf("Hypot2(%v, %v) = %v, JS gives %v", c.a, c.b, got, c.want)
		}
	}
	three := []struct {
		a, b, c, want float64
	}{
		{1, 2, 3, 3.741657386773941},
		{0.5, 0.25, 0.125, 0.57282196186948},
		{1e-8, 1e8, 1, 100000000},
		{0, 0, 0, 0},
	}
	for _, c := range three {
		if got := Hypot3(c.a, c.b, c.c); math.Float64bits(got) != math.Float64bits(c.want) {
			t.Errorf("Hypot3(%v, %v, %v) = %v, JS gives %v", c.a, c.b, c.c, got, c.want)
		}
	}
	if got := Hypot2(math.Inf(1), math.NaN()); !math.IsInf(got, 1) {
		t.Errorf("Hypot2(Inf, NaN) = %v, JS gives Infinity", got)
	}
	if got := Hypot2(math.NaN(), 1); !math.IsNaN(got) {
		t.Errorf("Hypot2(NaN, 1) = %v, JS gives NaN", got)
	}
}

func TestHypotDivergesFromMathHypot(t *testing.T) {
	diverged := 0
	seed := uint32(0x40FF)
	for i := 0; i < 200_000; i++ {
		seed = seed*1664525 + 1013904223
		a := (float64(seed)/4294967296*2 - 1) * 1e3
		seed = seed*1664525 + 1013904223
		b := (float64(seed)/4294967296*2 - 1) * 1e3
		if math.Float64bits(Hypot2(a, b)) != math.Float64bits(math.Hypot(a, b)) {
			diverged++
		}
	}
	if diverged == 0 {
		t.Error("Hypot2 agreed with math.Hypot on every one of 200,000 pairs: " +
			"either the port has been replaced by a forward, or this toolchain's " +
			"math.Hypot has become bit-identical to V8's (re-verify before simplifying)")
	}
	t.Logf("Hypot2 differs from math.Hypot on %d of 200,000 random pairs", diverged)
}
