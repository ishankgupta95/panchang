package jyotish

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

const twoPi = 2 * jsnum.PI

func ComputeBhava(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	options BirthChartOptions,
) (types.BhavaChart, error) {
	if err := utils.ValidateDate(birthMs); err != nil {
		return types.BhavaChart{}, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return types.BhavaChart{}, err
	}
	basis, err := ComputeNatalBasis(ctx, birthMs, location, options)
	if err != nil {
		return types.BhavaChart{}, err
	}
	return BhavaFromBasis(&basis, resolveHouseSystem(options.HouseSystem))
}

func resolveHouseSystem(s types.HouseSystem) types.HouseSystem {
	if s == "" {
		return types.HouseSystemWholeSign
	}
	return s
}

func BhavaFromBasis(basis *NatalBasis, system types.HouseSystem) (types.BhavaChart, error) {
	ascSidereal := basis.Lagna.SiderealLongitude

	lstDeg := utils.Normalize360(
		astronomy.GreenwichApparentSiderealDegrees(basis.Ctx, basis.BirthMs) + basis.Location.Longitude)
	t := (astronomy.DateToJulianDay(basis.BirthMs) - 2451545.0) / 36525.0
	epsRad := utils.DegToRad(MeanObliquity(t))
	mcTropical := computeMcTropical(lstDeg, epsRad)
	ayanamsa, err := astronomy.ComputeAyanamsa(basis.BirthMs, basis.AyanamsaType)
	if err != nil {
		return types.BhavaChart{}, err
	}
	mcSidereal := utils.Normalize360(mcTropical - ayanamsa)

	cuspLongitudes, err := buildCusps(
		system, ascSidereal, mcTropical, ayanamsa, lstDeg, basis.Location.Latitude, epsRad)
	if err != nil {
		return types.BhavaChart{}, err
	}

	houses := make([]types.HouseInfo, 0, len(cuspLongitudes))
	for i, lon := range cuspLongitudes {
		rashiIndex := int(math.Floor(lon / 30))
		houses = append(houses, types.HouseInfo{
			House:         i + 1,
			CuspLongitude: lon,
			Rashi:         types.RashiInfo{Index: rashiIndex, Name: i18n.ResolveMasaName(rashiIndex, basis.Lang)},
			DegreeInRashi: lon - float64(float64(rashiIndex)*30), // anti-FMA barrier
		})
	}

	return types.BhavaChart{
		System:             system,
		Houses:             houses,
		AscendantLongitude: ascSidereal,
		MCLongitude:        mcSidereal,
	}, nil
}

func buildCusps(
	system types.HouseSystem,
	ascSidereal, mcTropical, ayanamsa, lstDeg, latitudeDeg, epsRad float64,
) ([]float64, error) {
	switch system {
	case types.HouseSystemWholeSign:
		ascRashiStart := math.Floor(ascSidereal/30) * 30
		out := make([]float64, 0, 12)
		for i := 0; i < 12; i++ {
			out = append(out, utils.Normalize360(ascRashiStart+float64(float64(i)*30)))
		}
		return out, nil
	case types.HouseSystemEqual:
		out := make([]float64, 0, 12)
		for i := 0; i < 12; i++ {
			out = append(out, utils.Normalize360(ascSidereal+float64(float64(i)*30)))
		}
		return out, nil
	case types.HouseSystemPlacidusKP:
		return placidusCusps(mcTropical, ayanamsa, lstDeg, latitudeDeg, epsRad)
	}
	return nil, types.Codef(types.ErrInvalidInput,
		"unknown house system %q; expected one of whole-sign, equal, placidus-kp", string(system))
}

func computeMcTropical(lstDeg, epsRad float64) float64 {
	theta := utils.DegToRad(lstDeg)
	mc := math.Atan2(math.Sin(theta), math.Cos(theta)*math.Cos(epsRad))
	return utils.Normalize360(utils.RadToDeg(mc))
}

func placidusCusps(mcTropical, ayanamsa, lstDeg, latitudeDeg, epsRad float64) ([]float64, error) {
	thetaRad := utils.DegToRad(lstDeg)
	phiRad := utils.DegToRad(latitudeDeg)

	ascTropical := computeAscTropical(thetaRad, phiRad, epsRad)

	cusp11Trop, err := solvePlacidus(11, thetaRad, phiRad, epsRad, utils.Normalize360(mcTropical+30))
	if err != nil {
		return nil, err
	}
	cusp12Trop, err := solvePlacidus(12, thetaRad, phiRad, epsRad, utils.Normalize360(mcTropical+60))
	if err != nil {
		return nil, err
	}
	cusp2Trop, err := solvePlacidus(2, thetaRad, phiRad, epsRad, utils.Normalize360(ascTropical+30))
	if err != nil {
		return nil, err
	}
	cusp3Trop, err := solvePlacidus(3, thetaRad, phiRad, epsRad, utils.Normalize360(ascTropical+60))
	if err != nil {
		return nil, err
	}

	trop := [12]float64{
		ascTropical,
		cusp2Trop,
		cusp3Trop,
		utils.Normalize360(mcTropical + 180),
		utils.Normalize360(cusp11Trop + 180),
		utils.Normalize360(cusp12Trop + 180),
		utils.Normalize360(ascTropical + 180),
		utils.Normalize360(cusp2Trop + 180),
		utils.Normalize360(cusp3Trop + 180),
		mcTropical,
		cusp11Trop,
		cusp12Trop,
	}

	out := make([]float64, 0, 12)
	for _, t := range trop {
		out = append(out, utils.Normalize360(t-ayanamsa))
	}
	return out, nil
}

func computeAscTropical(thetaRad, phiRad, epsRad float64) float64 {
	num := math.Cos(thetaRad)
	den := -float64(math.Sin(epsRad)*math.Tan(phiRad)) - float64(math.Cos(epsRad)*math.Sin(thetaRad)) // FMA barriers
	return utils.Normalize360(utils.RadToDeg(math.Atan2(num, den)))
}

func solvePlacidus(cusp int, thetaRad, phiRad, epsRad, initialGuessDeg float64) (float64, error) {
	lambdaRad := utils.DegToRad(initialGuessDeg)
	tanPhi := math.Tan(phiRad)
	sinEps := math.Sin(epsRad)
	cosEps := math.Cos(epsRad)
	tolRad := utils.DegToRad(1e-7)

	for i := 0; i < 60; i++ {
		sinLambda := math.Sin(lambdaRad)
		cosLambda := math.Cos(lambdaRad)
		alpha := math.Atan2(sinLambda*cosEps, cosLambda)
		delta := math.Asin(sinLambda * sinEps)

		cosArg := -tanPhi * math.Tan(delta)
		if cosArg <= -1 || cosArg >= 1 {
			return 0, types.Codef(types.ErrCircumpolar,
				"Placidus cusp %d undefined at latitude %.2f° (circumpolar). Use 'whole-sign' or 'equal'.",
				cusp, utils.RadToDeg(phiRad))
		}
		sda := math.Acos(cosArg)
		sna := jsnum.PI - sda

		var targetAlpha float64
		switch cusp {
		case 11:
			targetAlpha = thetaRad + sda/3
		case 12:
			targetAlpha = thetaRad + 2*sda/3
		case 2:
			targetAlpha = thetaRad + sda + sna/3
		case 3:
			targetAlpha = thetaRad + sda + 2*sna/3
		default:
			return 0, types.Codef(types.ErrInvalidInput,
				"solvePlacidus: cusp %d is not one of 2, 3, 11, 12", cusp)
		}

		dAlpha := targetAlpha - alpha
		dAlpha = jsnum.Mod(jsnum.Mod(dAlpha+jsnum.PI, twoPi)+twoPi, twoPi) - jsnum.PI // jsnum.Mod, not math.Remainder

		lambdaRad += dAlpha
		if math.Abs(dAlpha) < tolRad {
			return utils.Normalize360(utils.RadToDeg(lambdaRad)), nil
		}
	}
	return 0, types.Codef(types.ErrPlacidusDiverged, "Placidus cusp %d did not converge", cusp)
}
