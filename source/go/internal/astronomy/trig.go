package astronomy

import (
	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
)

const (
	pi1 = 3.141592651605606
	pi2 = 1.9841871617964912e-9
	pi3 = -2.4354103367885187e-18
)

const inversePI = 1 / jsnum.PI

func reduce(x float64) (r float64, odd bool) {
	q := jsnum.Round(x * inversePI)
	r = float64(float64(x-float64(q*pi1))-float64(q*pi2)) - float64(q*pi3)
	return r, int64(q)&1 == 1
}

func Sin(x float64) float64 {
	r, odd := reduce(x)
	r2 := r * r
	p := 1.0/6227020800 - r2/1307674368000
	p = -1.0/39916800 + float64(r2*p)
	p = 1.0/362880 + float64(r2*p)
	p = -1.0/5040 + float64(r2*p)
	p = 1.0/120 + float64(r2*p)
	p = -1.0/6 + float64(r2*p)
	p = 1 + float64(r2*p)
	p = r * p
	if odd {
		return -p
	}
	return p
}

func Cos(x float64) float64 {
	r, odd := reduce(x)
	r2 := r * r
	p := -1.0/87178291200 + r2/20922789888000
	p = 1.0/479001600 + float64(r2*p)
	p = -1.0/3628800 + float64(r2*p)
	p = 1.0/40320 + float64(r2*p)
	p = -1.0/720 + float64(r2*p)
	p = 1.0/24 + float64(r2*p)
	p = -1.0/2 + float64(r2*p)
	p = 1 + float64(r2*p)
	if odd {
		return -p
	}
	return p
}
