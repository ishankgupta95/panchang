package gen

import (
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
)

type elpCanonical struct {
	a     float64
	phase [5]float64
	power int
	main  bool
}

type elpConstants struct {
	w    [4][6]float64
	p    [9][3]float64
	del  [5][6]float64
	zeta [3]float64
	a0   float64
	ath  float64
}

var elpConst = func() elpConstants {
	const (
		rad = 648000 / jsnum.PI
		deg = jsnum.PI / 180
		c1  = 60.0
		c2  = 3600.0
	)
	var k elpConstants
	k.ath = 384747.9806743165
	k.a0 = 384747.9806448954

	var eart, peri [6]float64
	k.w[1][1] = (218 + 18/c1 + 59.95571/c2) * deg
	k.w[2][1] = (83 + 21/c1 + 11.67475/c2) * deg
	k.w[3][1] = (125 + 2/c1 + 40.39816/c2) * deg
	eart[1] = (100 + 27/c1 + 59.22059/c2) * deg
	peri[1] = (102 + 56/c1 + 14.42753/c2) * deg
	k.w[1][2] = 1732559343.73604 / rad
	k.w[2][2] = 14643420.2632 / rad
	k.w[3][2] = -6967919.3622 / rad
	eart[2] = 129597742.2758 / rad
	peri[2] = 1161.2283 / rad
	k.w[1][3] = -5.8883 / rad
	k.w[2][3] = -38.2776 / rad
	k.w[3][3] = 6.3622 / rad
	eart[3] = -0.0202 / rad
	peri[3] = 0.5327 / rad
	k.w[1][4] = 0.6604e-2 / rad
	k.w[2][4] = -0.45047e-1 / rad
	k.w[3][4] = 0.7625e-2 / rad
	eart[4] = 0.9e-5 / rad
	peri[4] = -0.138e-3 / rad
	k.w[1][5] = -0.3169e-4 / rad
	k.w[2][5] = 0.21301e-3 / rad
	k.w[3][5] = -0.3586e-4 / rad
	eart[5] = 0.15e-6 / rad
	peri[5] = 0

	const preces = 5029.0966 / rad

	k.p[1][1] = (252 + 15/c1 + 3.25986/c2) * deg
	k.p[2][1] = (181 + 58/c1 + 47.28305/c2) * deg
	k.p[3][1] = eart[1]
	k.p[4][1] = (355 + 25/c1 + 59.78866/c2) * deg
	k.p[5][1] = (34 + 21/c1 + 5.34212/c2) * deg
	k.p[6][1] = (50 + 4/c1 + 38.89694/c2) * deg
	k.p[7][1] = (314 + 3/c1 + 18.01841/c2) * deg
	k.p[8][1] = (304 + 20/c1 + 55.19575/c2) * deg
	k.p[1][2] = 538101628.68898 / rad
	k.p[2][2] = 210664136.43355 / rad
	k.p[3][2] = eart[2]
	k.p[4][2] = 68905077.59284 / rad
	k.p[5][2] = 10925660.42861 / rad
	k.p[6][2] = 4399609.65932 / rad
	k.p[7][2] = 1542481.19393 / rad
	k.p[8][2] = 786550.32074 / rad

	for i := 1; i <= 5; i++ {
		k.del[1][i] = k.w[1][i] - eart[i]
		k.del[4][i] = k.w[1][i] - k.w[3][i]
		k.del[3][i] = k.w[1][i] - k.w[2][i]
		k.del[2][i] = eart[i] - peri[i]
	}
	k.del[1][1] = k.del[1][1] + jsnum.PI

	k.zeta[1] = k.w[1][1]
	k.zeta[2] = k.w[1][2] + preces
	return k
}()

const (
	elpRad    = 648000 / jsnum.PI
	elpDeg    = jsnum.PI / 180
	elpAm     = 0.074801329518
	elpAlfa   = 0.002571881335
	elpDtasm  = (2 * elpAlfa) / (3 * elpAm)
	elpDele   = 0.01789 / elpRad
	elpDelg   = -0.08066 / elpRad
	elpDelep  = -0.12879 / elpRad
	elpW1Rate = 1732559343.73604 / elpRad
	elpDelnu  = 0.55604 / elpRad / elpW1Rate
	elpDelnp  = -0.06424 / elpRad / elpW1Rate
)

func canonicalElp(tables *elpTables) [4][]elpCanonical {
	k := elpConst
	var out [4][]elpCanonical
	distScale := k.a0 / k.ath

	for file := 1; file <= 36; file++ {
		iv := ((file-1)%3 + 1)
		scale := 1.0
		if iv == 3 {
			scale = distScale
		}

		switch {
		case file <= 3:
			for _, term := range tables.main[file] {
				coef := term.coef
				tgv := coef[2] + elpDtasm*coef[6]
				a := coef[1]
				if file == 3 {
					a = a - (2*a*elpDelnu)/3
				}
				a = a + tgv*(elpDelnp-elpAm*elpDelnu) + coef[3]*elpDelg + coef[4]*elpDele + coef[5]*elpDelep
				var phase [5]float64
				for kk := 1; kk <= 5; kk++ {
					for i := 1; i <= 4; i++ {
						phase[kk-1] += term.ilu[i-1] * k.del[i][kk]
					}
				}
				if iv == 3 {
					phase[0] += jsnum.PI / 2
				}
				out[iv] = append(out[iv], elpCanonical{a: a * scale, phase: phase, power: 0, main: true})
			}
		case file <= 9 || file >= 22:
			for _, term := range tables.pert[file] {
				phase := [5]float64{term.pha * elpDeg}
				for kk := 1; kk <= 2; kk++ {
					phase[kk-1] += term.iz * k.zeta[kk]
					for i := 1; i <= 4; i++ {
						phase[kk-1] += term.ilu[i-1] * k.del[i][kk]
					}
				}
				power := 0
				switch {
				case file >= 34:
					power = 2
				case (file >= 7 && file <= 9) || (file >= 25 && file <= 27):
					power = 1
				}
				out[iv] = append(out[iv], elpCanonical{a: term.a * scale, phase: phase, power: power, main: false})
			}
		default:
			for _, term := range tables.planet[file] {
				phase := [5]float64{term.pha * elpDeg}
				if file < 16 {
					for kk := 1; kk <= 2; kk++ {
						phase[kk-1] += term.ipla[8]*k.del[1][kk] + term.ipla[9]*k.del[3][kk] + term.ipla[10]*k.del[4][kk]
						for i := 1; i <= 8; i++ {
							phase[kk-1] += term.ipla[i-1] * k.p[i][kk]
						}
					}
				} else {
					for kk := 1; kk <= 2; kk++ {
						for i := 1; i <= 4; i++ {
							phase[kk-1] += term.ipla[i+6] * k.del[i][kk]
						}
						for i := 1; i <= 7; i++ {
							phase[kk-1] += term.ipla[i-1] * k.p[i][kk]
						}
					}
				}
				power := 0
				if (file >= 13 && file <= 15) || (file >= 19 && file <= 21) {
					power = 1
				}
				out[iv] = append(out[iv], elpCanonical{a: term.a * scale, phase: phase, power: power, main: false})
			}
		}
	}
	return out
}

func evalElpTerm(q elpCanonical, t float64) float64 {
	ph := q.phase
	y := ph[0] + t*(ph[1]+t*(ph[2]+t*(ph[3]+t*ph[4])))
	switch q.power {
	case 0:
		return q.a * math.Sin(y)
	case 1:
		return q.a * t * math.Sin(y)
	default:
		return q.a * (t * t) * math.Sin(y)
	}
}
