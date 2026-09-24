// Package jsnum reproduces JavaScript's number formatting and math helpers so the
// Go port renders and rounds identically to the TypeScript it is checked against.
package jsnum

import (
	"math"
	"math/big"
	"strconv"
	"strings"
)

const PI = float64(math.Pi)

// Round is JavaScript's Math.round. It needs no guard for the special values:
// Floor keeps ±0 (and ±0 - ±0 = +0 < 0.5 returns it, sign kept), ±Inf - ±Inf
// is NaN so ±Inf comes back as ±Inf + 1, and NaN stays NaN. Keeping it that
// small also keeps it cheap enough to inline into the trig reduction.
func Round(x float64) float64 {
	f := math.Floor(x)
	if float64(x-f) < 0.5 {
		return f
	}
	return f + 1
}

func FormatFloat(v float64) string {
	switch {
	case math.IsNaN(v):
		return "NaN"
	case math.IsInf(v, 1):
		return "Infinity"
	case math.IsInf(v, -1):
		return "-Infinity"
	case v == 0:
		return "0"
	}
	neg := math.Signbit(v)
	if neg {
		v = -v
	}
	mant, expStr, _ := strings.Cut(strconv.FormatFloat(v, 'e', -1, 64), "e")
	exp10, err := strconv.Atoi(expStr)
	if err != nil {
		return strconv.FormatFloat(v, 'g', -1, 64)
	}
	digits := strings.Replace(mant, ".", "", 1)
	k := len(digits)
	n := exp10 + 1

	var out string
	switch {
	case k <= n && n <= 21:
		out = digits + strings.Repeat("0", n-k)
	case 0 < n && n <= 21:
		out = digits[:n] + "." + digits[n:]
	case -6 < n && n <= 0:
		out = "0." + strings.Repeat("0", -n) + digits
	default:
		var b strings.Builder
		b.WriteByte(digits[0])
		if k > 1 {
			b.WriteByte('.')
			b.WriteString(digits[1:])
		}
		b.WriteByte('e')
		m := n - 1
		if m >= 0 {
			b.WriteByte('+')
		} else {
			b.WriteByte('-')
			m = -m
		}
		b.WriteString(strconv.Itoa(m))
		out = b.String()
	}
	if neg {
		return "-" + out
	}
	return out
}

func Mod(x, y float64) float64 { return math.Mod(x, y) }

// ToFixed is Number.prototype.toFixed(digits): the exact decimal value of x
// rounded to digits places, an exact tie going to the larger magnitude where
// Go's %.*f rounds half to even. From 1e21 up it is String(x), as in JavaScript.
func ToFixed(x float64, digits int) string {
	if math.IsNaN(x) || math.IsInf(x, 0) || math.Abs(x) >= 1e21 {
		return FormatFloat(x)
	}
	neg := x < 0
	if neg {
		x = -x
	}
	// 1100 places hold every binary fraction a float64 can carry exactly.
	whole, frac, _ := strings.Cut(strconv.FormatFloat(x, 'f', 1100, 64), ".")
	n, _ := new(big.Int).SetString(whole+frac[:digits], 10)
	if frac[digits] >= '5' {
		n.Add(n, big.NewInt(1))
	}
	s := n.String()
	if digits > 0 {
		if len(s) <= digits {
			s = strings.Repeat("0", digits-len(s)+1) + s
		}
		s = s[:len(s)-digits] + "." + s[len(s)-digits:]
	}
	if neg {
		return "-" + s
	}
	return s
}

// TimeClip reports whether new Date(t) is a valid Date: t is not NaN and lies
// within 8.64e15 ms of the epoch. Converting a float that fails it to int64 is
// implementation-defined in Go (0 on arm64), so a port checks it first.
func TimeClip(t float64) bool { return math.Abs(t) <= 8.64e15 }

func FormatInt(v int64) string {
	if v > -(1<<53) && v < 1<<53 {
		return strconv.FormatInt(v, 10)
	}
	return FormatFloat(float64(v))
}

func Hypot2(a, b float64) float64 {
	max := math.Abs(a)
	if v := math.Abs(b); v > max {
		max = v
	}
	if max == 0 || math.IsInf(max, 0) || math.IsNaN(max) {
		return hypotDegenerate(max, a, b)
	}
	sum, compensation := 0.0, 0.0
	sum, compensation = hypotAccumulate(a/max, sum, compensation)
	sum, _ = hypotAccumulate(b/max, sum, compensation)
	return math.Sqrt(sum) * max
}

func Hypot3(a, b, c float64) float64 {
	max := math.Abs(a)
	if v := math.Abs(b); v > max {
		max = v
	}
	if v := math.Abs(c); v > max {
		max = v
	}
	if max == 0 || math.IsInf(max, 0) || math.IsNaN(max) {
		return hypotDegenerate(max, a, b, c)
	}
	sum, compensation := 0.0, 0.0
	sum, compensation = hypotAccumulate(a/max, sum, compensation)
	sum, compensation = hypotAccumulate(b/max, sum, compensation)
	sum, _ = hypotAccumulate(c/max, sum, compensation)
	return math.Sqrt(sum) * max
}

func hypotAccumulate(n, sum, compensation float64) (float64, float64) {
	summand := float64(n*n) - compensation
	preliminary := sum + summand
	return preliminary, (preliminary - sum) - summand
}

func hypotDegenerate(max float64, values ...float64) float64 {
	for _, v := range values {
		if math.IsInf(v, 0) {
			return math.Inf(1)
		}
	}
	for _, v := range values {
		if math.IsNaN(v) {
			return math.NaN()
		}
	}
	return 0
}
