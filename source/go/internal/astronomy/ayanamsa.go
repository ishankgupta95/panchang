package astronomy

import (
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

func ComputeAyanamsa(ms int64, typ types.AyanamsaType) (float64, error) {
	t := julianCenturiesFromJ2000(ms)

	switch typ {
	case types.Lahiri:
		return lahiriAyanamsa(t), nil
	case types.Raman:
		return ramanAyanamsa(t), nil
	case types.Krishnamurti:
		return kpAyanamsa(t), nil
	case types.TrueChitra:
		return trueChitraAyanamsa(t), nil
	case types.Thirukanitham:
		return thirukanithamAyanamsa(t), nil
	default:
		return 0, types.Codef(types.ErrInvalidAyanamsa, "Unknown ayanamsa type: %s", typ)
	}
}

// Solved from Drik, not the widely repeated 23.853211°; typed so the offset sums do not constant-fold.
const lahiriJ2000Deg float64 = 23.863801

// IAU general precession in longitude, arcsec; the casts are FMA barriers.
func precessionArcsec(t float64) float64 {
	return float64(5029.0966*t) + float64(1.112*t*t) - float64(0.000006*t*t*t)
}

const (
	offsetTrueChitra    float64 = -0.0006
	offsetKP            float64 = -0.079605
	offsetThirukanitham float64 = +0.018456
	// Measured against SwissEph; the literature value −1.392722 is wrong.
	offsetRaman float64 = -1.453010
)

func trueChitraAyanamsa(t float64) float64 {
	return lahiriJ2000Deg + offsetTrueChitra + precessionArcsec(t)/3600
}

func thirukanithamAyanamsa(t float64) float64 {
	return lahiriJ2000Deg + offsetThirukanitham + precessionArcsec(t)/3600
}

func lahiriAyanamsa(t float64) float64 {
	return lahiriJ2000Deg + precessionArcsec(t)/3600
}

func ramanAyanamsa(t float64) float64 {
	return lahiriJ2000Deg + offsetRaman + precessionArcsec(t)/3600
}

func kpAyanamsa(t float64) float64 {
	return lahiriJ2000Deg + offsetKP + precessionArcsec(t)/3600
}

func julianCenturiesFromJ2000(ms int64) float64 {
	jd := DateToJulianDay(ms)
	return (jd - 2451545.0) / 36525.0
}

// UT, not TT: ΔT is 0.001″ of ayanamsa here.
func DateToJulianDay(ms int64) float64 {
	return float64(ms)/86_400_000 + 2440587.5
}
