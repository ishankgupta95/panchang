package jyotish

import (
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

type SahamPosition struct {
	Longitude float64 `json:"longitude"`
	Rashi     int     `json:"rashi"`
	RashiName string  `json:"rashiName"`
	House     int     `json:"house"`
}

type MunthaInfo struct {
	Rashi int                `json:"rashi"`
	Lord  types.VisibleGraha `json:"lord"`
	House int                `json:"house"`
}

// Named fields, not a map: the wire key order is fixed.
type Sahams struct {
	Punya       SahamPosition `json:"Punya"`
	Vidya       SahamPosition `json:"Vidya"`
	Yasas       SahamPosition `json:"Yasas"`
	Mitra       SahamPosition `json:"Mitra"`
	Karma       SahamPosition `json:"Karma"`
	Vivaha      SahamPosition `json:"Vivaha"`
	Putra       SahamPosition `json:"Putra"`
	Roga        SahamPosition `json:"Roga"`
	Marana      SahamPosition `json:"Marana"`
	Rajya       SahamPosition `json:"Rajya"`
	Raja        SahamPosition `json:"Raja"`
	Bandhu      SahamPosition `json:"Bandhu"`
	Dharma      SahamPosition `json:"Dharma"`
	Gnati       SahamPosition `json:"Gnati"`
	Apamrityu   SahamPosition `json:"Apamrityu"`
	Bhratri     SahamPosition `json:"Bhratri"`
	Matri       SahamPosition `json:"Matri"`
	Pitri       SahamPosition `json:"Pitri"`
	Sama        SahamPosition `json:"Sama"`
	Bandhana    SahamPosition `json:"Bandhana"`
	Karyasiddhi SahamPosition `json:"Karyasiddhi"`
	Vyapara     SahamPosition `json:"Vyapara"`
	Sastra      SahamPosition `json:"Sastra"`
	Asha        SahamPosition `json:"Asha"`
	Labha       SahamPosition `json:"Labha"`
	Susha       SahamPosition `json:"Susha"`
	Tapas       SahamPosition `json:"Tapas"`
}

func (s *Sahams) sahamField(n SahamName) *SahamPosition {
	switch n {
	case SahamPunya:
		return &s.Punya
	case SahamVidya:
		return &s.Vidya
	case SahamYasas:
		return &s.Yasas
	case SahamMitra:
		return &s.Mitra
	case SahamKarma:
		return &s.Karma
	case SahamVivaha:
		return &s.Vivaha
	case SahamPutra:
		return &s.Putra
	case SahamRoga:
		return &s.Roga
	case SahamMarana:
		return &s.Marana
	case SahamRajya:
		return &s.Rajya
	case SahamRaja:
		return &s.Raja
	case SahamBandhu:
		return &s.Bandhu
	case SahamDharma:
		return &s.Dharma
	case SahamGnati:
		return &s.Gnati
	case SahamApamrityu:
		return &s.Apamrityu
	case SahamBhratri:
		return &s.Bhratri
	case SahamMatri:
		return &s.Matri
	case SahamPitri:
		return &s.Pitri
	case SahamSama:
		return &s.Sama
	case SahamBandhana:
		return &s.Bandhana
	case SahamKaryasiddhi:
		return &s.Karyasiddhi
	case SahamVyapara:
		return &s.Vyapara
	case SahamSastra:
		return &s.Sastra
	case SahamAsha:
		return &s.Asha
	case SahamLabha:
		return &s.Labha
	case SahamSusha:
		return &s.Susha
	case SahamTapas:
		return &s.Tapas
	}
	return nil
}

func (s *Sahams) Set(n SahamName, p SahamPosition) bool {
	f := s.sahamField(n)
	if f == nil {
		return false
	}
	*f = p
	return true
}

func (s *Sahams) Get(n SahamName) (SahamPosition, bool) {
	f := s.sahamField(n)
	if f == nil {
		return SahamPosition{}, false
	}
	return *f, true
}

type VarshaphalaChart struct {
	SolarReturnInstant types.JSDate            `json:"solarReturnInstant"`
	VarshaLagna        types.LagnaInfo         `json:"varshaLagna"`
	Muntha             MunthaInfo              `json:"muntha"`
	YearLord           types.VisibleGraha      `json:"yearLord"`
	Sahams             Sahams                  `json:"sahams"`
	IsDayBirth         bool                    `json:"isDayBirth"`
	Planets            []types.PlanetPlacement `json:"planets"`
	Bhava              types.BhavaChart        `json:"bhava"`
}

// Typed deliberately: untyped, it changes sunDegPerDay's last bits.
const siderealYearDays float64 = 365.25636

const sunDegPerDay = 360 / siderealYearDays

// Sahams are the 27-Saham core set per *Tajika Neelakanthi*.
func ComputeVarshaphala(
	ctx *astronomy.EphemerisCtx,
	natalBirthMs int64,
	yearAge int,
	location types.GeoLocation,
	options BirthChartOptions,
) (VarshaphalaChart, error) {
	if err := utils.ValidateDate(natalBirthMs); err != nil {
		return VarshaphalaChart{}, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return VarshaphalaChart{}, err
	}
	if yearAge < 1 {
		return VarshaphalaChart{}, types.Codef(types.ErrInvalidInput,
			"Varshaphala yearAge must be a positive integer (1 = first solar return); got %d",
			yearAge)
	}

	ayanamsaType := resolveAyanamsa(options.Ayanamsa)
	lang := resolveLang(options.Language)

	natalSun, err := astronomy.GetSiderealSunLongitude(ctx, natalBirthMs, ayanamsaType)
	if err != nil {
		return VarshaphalaChart{}, err
	}
	solarReturnMs, err := FindSolarReturn(ctx, natalBirthMs, yearAge, natalSun, ayanamsaType)
	if err != nil {
		return VarshaphalaChart{}, err
	}

	varshaChart, err := ComputeRashiChart(ctx, solarReturnMs, location, options)
	if err != nil {
		return VarshaphalaChart{}, err
	}
	isDay := varshaphalaIsDayBirth(ctx, solarReturnMs, location)

	natalLagna, err := ComputeLagna(ctx, natalBirthMs, location, ayanamsaType, lang)
	if err != nil {
		return VarshaphalaChart{}, err
	}
	muntha := buildMuntha(natalLagna.Rashi.Index, yearAge, varshaChart.Lagna.Rashi.Index, lang)
	yearLord, err := pickYearLord(ctx, &varshaChart, muntha.Lord, isDay, solarReturnMs, location, options)
	if err != nil {
		return VarshaphalaChart{}, err
	}

	sahams, err := computeSahams(&varshaChart, isDay, lang)
	if err != nil {
		return VarshaphalaChart{}, err
	}

	return VarshaphalaChart{
		SolarReturnInstant: types.Date(solarReturnMs),
		VarshaLagna:        varshaChart.Lagna,
		Muntha:             muntha,
		YearLord:           yearLord,
		Sahams:             sahams,
		IsDayBirth:         isDay,
		Planets:            varshaChart.Planets,
		Bhava:              varshaChart.Bhava,
	}, nil
}

func FindSolarReturn(
	ctx *astronomy.EphemerisCtx,
	natalBirthMs int64,
	yearAge int,
	natalSun float64,
	ayanamsaType types.AyanamsaType,
) (int64, error) {
	// t stays a float; only the lookups truncate. FMA barrier.
	t := float64(natalBirthMs) + float64(float64(yearAge)*siderealYearDays*86400_000)

	const tolDeg = 0.0001
	for iter := 0; iter < 25; iter++ {
		lon, err := astronomy.GetSiderealSunLongitude(ctx, int64(t), ayanamsaType)
		if err != nil {
			return 0, err
		}
		delta := lon - natalSun
		delta = jsnum.Mod(delta+540, 360) - 180
		if math.Abs(delta) < tolDeg {
			break
		}
		t -= float64((delta / sunDegPerDay) * 86400_000)
	}

	// Half-up, not math.Round: pre-1970 solar returns are negative.
	return int64(jsnum.Round(t)), nil
}

// The Sun's apparent centre above the horizon, not sunrise/sunset's refracted limb.
func varshaphalaIsDayBirth(ctx *astronomy.EphemerisCtx, ms int64, location types.GeoLocation) bool {
	return astronomy.IsSunAboveHorizon(ctx, ms, location)
}

func buildMuntha(natalLagnaRashi, yearAge, varshaLagnaRashi int, lang types.Language) MunthaInfo {
	munthaRashi := (natalLagnaRashi + yearAge) % 12
	lord := RashiLord[munthaRashi]
	house := (munthaRashi-varshaLagnaRashi+12)%12 + 1
	_ = lang
	return MunthaInfo{Rashi: munthaRashi, Lord: lord, House: house}
}

// Tajik elemental triplicity rulers by `rashi % 4` (0 Fire, 1 Earth, 2 Air, 3 Water), per B.V. Raman, *Annual Horoscope* Ch. 2.
var (
	triraashiPatiDay = [4]types.VisibleGraha{
		types.VisibleSun, types.VisibleVenus, types.VisibleSaturn, types.VisibleVenus,
	}
	triraashiPatiNight = [4]types.VisibleGraha{
		types.VisibleJupiter, types.VisibleMoon, types.VisibleMercury, types.VisibleMars,
	}
)

func triraashiPati(rashi int, isDay bool) types.VisibleGraha {
	elem := rashi % 4
	if isDay {
		return triraashiPatiDay[elem]
	}
	return triraashiPatiNight[elem]
}

func pickYearLord(
	ctx *astronomy.EphemerisCtx,
	varshaChart *types.BirthChart,
	munthaLord types.VisibleGraha,
	isDay bool,
	varshaInstantMs int64,
	location types.GeoLocation,
	options BirthChartOptions,
) (types.VisibleGraha, error) {
	lagnaRashi := varshaChart.Lagna.Rashi.Index
	lagnaLord := RashiLord[lagnaRashi]

	sunPlacement, ok := varshaChart.ByPlanet.Get(types.GrahaSun)
	if !ok {
		return 0, types.Codef(types.ErrInvalidInput, "varsha chart has no Sun placement")
	}
	sunRashiLord := RashiLord[sunPlacement.Rashi.Index]

	triraashi := triraashiPati(lagnaRashi, isDay)

	candidates := make([]types.VisibleGraha, 0, 4)
	for _, c := range [4]types.VisibleGraha{lagnaLord, munthaLord, sunRashiLord, triraashi} {
		dup := false
		for _, seen := range candidates {
			if seen == c {
				dup = true
			}
		}
		if !dup {
			candidates = append(candidates, c)
		}
	}

	shadbala, err := ComputeShadbala(ctx, varshaInstantMs, location, options)
	if err != nil {
		return 0, err
	}

	best := candidates[0]
	bestBala, _ := shadbala.Get(best)
	bestTotal := bestBala.Total
	for i := 1; i < len(candidates); i++ {
		c := candidates[i]
		b, _ := shadbala.Get(c)
		if b.Total > bestTotal {
			best = c
			bestTotal = b.Total
		}
	}
	return best, nil
}

func resolveOperand(
	op SahamOperand,
	varshaChart *types.BirthChart,
	priorSahams *[SahamNameCount]float64,
	computed *[SahamNameCount]bool,
) (float64, error) {
	switch op {
	case OperandSun, OperandMoon, OperandMars, OperandMercury,
		OperandJupiter, OperandVenus, OperandSaturn:
		// The graha operands share the visible-graha ordinal.
		p, ok := varshaChart.ByPlanet.Get(types.VisibleGraha(op).Graha())
		if !ok {
			return 0, types.Codef(types.ErrInvalidInput,
				"varsha chart has no %s placement", op)
		}
		return p.Longitude, nil
	case OperandAsc:
		return varshaChart.Lagna.SiderealLongitude, nil
	case OperandAscLord:
		lord := RashiLord[varshaChart.Lagna.Rashi.Index]
		p, ok := varshaChart.ByPlanet.Get(lord.Graha())
		if !ok {
			return 0, types.Codef(types.ErrInvalidInput,
				"varsha chart has no %s placement", lord)
		}
		return p.Longitude, nil
	case OperandHouse11Cusp:
		lagnaRashi := varshaChart.Lagna.Rashi.Index
		return float64(((lagnaRashi + 10) % 12) * 30), nil
	case OperandPunya:
		if !computed[SahamPunya] {
			return 0, types.Codef(types.ErrSahamDependencyError,
				"Saham operand Punya referenced before Punya was computed")
		}
		return priorSahams[SahamPunya], nil
	}
	return 0, types.Codef(types.ErrInvalidInput, "unknown Saham operand %v", op)
}

// Tajika completion rule (Neelakanthi).
func evaluateSaham(
	formula SahamFormula,
	isDay bool,
	varshaChart *types.BirthChart,
	priorSahams *[SahamNameCount]float64,
	computed *[SahamNameCount]bool,
) (float64, error) {
	xOp, yOp := formula.X, formula.Y
	if formula.Swap && !isDay {
		xOp, yOp = formula.Y, formula.X
	}
	x, err := resolveOperand(xOp, varshaChart, priorSahams, computed)
	if err != nil {
		return 0, err
	}
	y, err := resolveOperand(yOp, varshaChart, priorSahams, computed)
	if err != nil {
		return 0, err
	}
	z, err := resolveOperand(formula.Z, varshaChart, priorSahams, computed)
	if err != nil {
		return 0, err
	}
	zInArcYtoX := utils.Normalize360(z-y) <= utils.Normalize360(x-y)
	add := 30.0
	if zInArcYtoX {
		add = 0
	}
	return utils.Normalize360(x - y + z + add), nil
}

func computeSahams(varshaChart *types.BirthChart, isDay bool, lang types.Language) (Sahams, error) {
	var longitudes [SahamNameCount]float64
	var computed [SahamNameCount]bool

	// Punya must precede Yasas, Mitra and Susha.
	for _, formula := range SahamFormulas {
		lon, err := evaluateSaham(formula, isDay, varshaChart, &longitudes, &computed)
		if err != nil {
			return Sahams{}, err
		}
		longitudes[formula.Name] = lon
		computed[formula.Name] = true
	}

	lagnaRashi := varshaChart.Lagna.Rashi.Index
	var out Sahams
	for _, name := range AllSahamNames {
		lon := longitudes[name]
		rashi := int(math.Floor(lon / 30))
		out.Set(name, SahamPosition{
			Longitude: lon,
			Rashi:     rashi,
			RashiName: i18n.ResolveMasaName(rashi, lang),
			House:     (rashi-lagnaRashi+12)%12 + 1,
		})
	}
	return out, nil
}

func TriraashiPatiForTest(rashi int, isDay bool) types.VisibleGraha {
	return triraashiPati(rashi, isDay)
}

func EvaluateSahamForTest(
	formula SahamFormula, isDay bool, varshaChart *types.BirthChart, priorPunya *float64,
) (float64, error) {
	var longitudes [SahamNameCount]float64
	var computed [SahamNameCount]bool
	if priorPunya != nil {
		longitudes[SahamPunya] = *priorPunya
		computed[SahamPunya] = true
	}
	return evaluateSaham(formula, isDay, varshaChart, &longitudes, &computed)
}

func IsDayBirthForTest(ctx *astronomy.EphemerisCtx, ms int64, location types.GeoLocation) bool {
	return varshaphalaIsDayBirth(ctx, ms, location)
}
