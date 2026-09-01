package gen

import (
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
)

const (
	as2r = jsnum.PI / 648000
	turn = 1_296_000
)

func fundPoly(c0, c1, c2, c3, c4 float64) func(t float64) float64 {
	return func(t float64) float64 {
		return math.Mod(c0+(c1+(c2+(c3+c4*t)*t)*t)*t, turn) * as2r
	}
}

var fund = []func(t float64) float64{
	fundPoly(485868.249036, 1717915923.2178, 31.8792, 0.051635, -0.00024470),
	fundPoly(1287104.79305, 129596581.0481, -0.5532, 0.000136, -0.00001149),
	fundPoly(335779.526232, 1739527262.8478, -12.7512, -0.001037, 0.00000417),
	fundPoly(1072260.70369, 1602961601.2090, -6.3706, 0.006593, -0.00003169),
	fundPoly(450160.398036, -6962890.5431, 7.4722, 0.007702, -0.00005939),
	func(t float64) float64 { return 4.402608842 + 2608.7903141574*t },
	func(t float64) float64 { return 3.176146697 + 1021.3285546211*t },
	func(t float64) float64 { return 1.753470314 + 628.3075849991*t },
	func(t float64) float64 { return 6.203480913 + 334.0612426700*t },
	func(t float64) float64 { return 0.599546497 + 52.9690962641*t },
	func(t float64) float64 { return 0.874016757 + 21.3299104960*t },
	func(t float64) float64 { return 5.481293872 + 7.4781598567*t },
	func(t float64) float64 { return 5.311886287 + 3.8133035638*t },
	func(t float64) float64 { return (0.02438175 + 0.00000538691*t) * t },
}

func fundAt(t float64) [14]float64 {
	var a [14]float64
	for k := 0; k < 14; k++ {
		a[k] = fund[k](t)
	}
	return a
}
