package jsnum

import (
	"math"
	"strconv"
	"strings"
)

const PI = float64(math.Pi)

func Round(x float64) float64 {
	if math.IsNaN(x) || math.IsInf(x, 0) || x == 0 {
		return x
	}
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
