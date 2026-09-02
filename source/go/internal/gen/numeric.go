package gen

import (
	"math"
	"math/big"
	"strconv"
	"strings"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
)

func probes(seed uint32) []float64 { return probesN(seed, probeCount) }

func probesN(seed uint32, n int) []float64 {
	s := seed
	out := make([]float64, n)
	for i := 0; i < n; i++ {
		s = s*1664525 + 1013904223
		out[i] = float64(s)/4294967296*2*tMax - tMax
	}
	return out
}

func truncate[T any](terms []T, termValue func(term T, t float64) float64, budget float64, ts []float64) (count int, err float64) {
	n := len(terms)
	maxTail := make([]float64, n+1)
	tail := make([]float64, n+1)
	for _, t := range ts {
		tail[n] = 0
		for i := n - 1; i >= 0; i-- {
			tail[i] = tail[i+1] + termValue(terms[i], t)
		}
		for i := 0; i <= n; i++ {
			if v := math.Abs(tail[i]); v > maxTail[i] {
				maxTail[i] = v
			}
		}
	}
	for k := 1; k <= n; k++ {
		if maxTail[k] <= budget {
			return k, maxTail[k]
		}
	}
	return n, maxTail[n]
}

var ratTen = big.NewRat(10, 1)

func pow10Rat(k int) *big.Rat {
	r := new(big.Rat).SetInt64(1)
	if k == 0 {
		return r
	}
	n := k
	if n < 0 {
		n = -n
	}
	for i := 0; i < n; i++ {
		r.Mul(r, ratTen)
	}
	if k < 0 {
		r.Inv(r)
	}
	return r
}

func decExp(abs *big.Rat) int {
	f, _ := abs.Float64()
	e := int(math.Floor(math.Log10(f)))
	for abs.Cmp(pow10Rat(e+1)) >= 0 {
		e++
	}
	for abs.Cmp(pow10Rat(e)) < 0 {
		e--
	}
	return e
}

var ratHalf = big.NewRat(1, 2)

func toPrecisionParts(x float64, p int) (neg bool, digits string, e int) {
	if x == 0 {
		return false, strings.Repeat("0", p), 0
	}
	r := new(big.Rat).SetFloat64(x)
	neg = r.Sign() < 0
	abs := new(big.Rat).Abs(r)

	e = decExp(abs)
	scaled := new(big.Rat).Mul(abs, pow10Rat(p-1-e))
	scaled.Add(scaled, ratHalf)
	n := new(big.Int).Div(scaled.Num(), scaled.Denom())
	digits = n.String()
	if len(digits) > p {
		e++
		digits = digits[:p]
	}
	return neg, digits, e
}

func toPrecisionValue(x float64, p int) float64 {
	if x == 0 {
		return 0
	}
	neg, digits, e := toPrecisionParts(x, p)
	n, ok := new(big.Int).SetString(digits, 10)
	if !ok {
		panic("toPrecisionValue: undigestible digits " + digits)
	}
	value := new(big.Rat).SetInt(n)
	value.Mul(value, pow10Rat(e-p+1))
	if neg {
		value.Neg(value)
	}
	f, _ := value.Float64()
	return f
}

func toPrecisionString(x float64, p int) string {
	neg, m, e := toPrecisionParts(x, p)
	var out string
	switch {
	case e < -6 || e >= p:
		var b strings.Builder
		b.WriteByte(m[0])
		if p != 1 {
			b.WriteByte('.')
			b.WriteString(m[1:])
		}
		b.WriteByte('e')
		v := e
		if v >= 0 {
			b.WriteByte('+')
		} else {
			b.WriteByte('-')
			v = -v
		}
		b.WriteString(strconv.Itoa(v))
		out = b.String()
	case e == p-1:
		out = m
	case e >= 0:
		out = m[:e+1] + "." + m[e+1:]
	default:
		out = "0." + strings.Repeat("0", -(e+1)) + m
	}
	if neg {
		return "-" + out
	}
	return out
}

func shortest(value, tol float64) string {
	if value == 0 {
		return "0"
	}
	for p := 1; p <= 17; p++ {
		v := toPrecisionValue(value, p)
		if math.Abs(v-value) <= tol {
			return formatFloat(v)
		}
	}
	return formatFloat(value)
}

func formatFloat(v float64) string {
	return jsnum.FormatFloat(v)
}

func floatArray(values, tolerances []float64) string {
	parts := make([]string, len(values))
	for i, v := range values {
		parts[i] = shortest(v, tolerances[i])
	}
	var lines []string
	line := "\t"
	for _, part := range parts {
		if len(line)+len(part)+2 > 96 {
			lines = append(lines, line)
			line = "\t"
		}
		line += part + ", "
	}
	if strings.TrimSpace(line) != "" {
		lines = append(lines, line)
	}
	for i := range lines {
		lines[i] = strings.TrimRight(lines[i], " ")
	}
	return strings.Join(lines, "\n")
}

func zeros(n int) []float64 { return make([]float64, n) }

func fill(n int, v float64) []float64 {
	out := make([]float64, n)
	for i := range out {
		out[i] = v
	}
	return out
}
