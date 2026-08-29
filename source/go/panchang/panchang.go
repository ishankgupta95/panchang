// Package panchang is the public API of the Go port.
package panchang

import (
	"time"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/calendar"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/core"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jyotish"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/muhurta"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/muhurta/rules"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

type (
	EclipseInfo                 = astronomy.EclipseInfo
	MoonPhaseEvent              = astronomy.MoonPhaseEvent
	MoonPhasesForYearOptions    = astronomy.MoonPhasesForYearOptions
	SyzygyLongitudes            = astronomy.SyzygyLongitudes
	BuildEclipsesTableOptions   = calendar.BuildEclipsesTableOptions
	BuildFestivalsTableOptions  = calendar.BuildFestivalsTableOptions
	BuildMoonPhasesTableOptions = calendar.BuildMoonPhasesTableOptions
	ConvertOptions              = calendar.ConvertOptions
	EclipsesFile                = calendar.EclipsesFile
	FestivalDay                 = calendar.FestivalDay
	FestivalsFile               = calendar.FestivalsFile
	HinduCalendarCoords         = calendar.HinduCalendarCoords
	HinduDateCoords             = calendar.HinduDateCoords
	MoonPhasesFile              = calendar.MoonPhasesFile
	SankrantiEvent              = calendar.SankrantiEvent
	YearlyListingOptions        = calendar.YearlyListingOptions
	InstantPanchangOptions      = core.InstantPanchangOptions
	LongitudeAt                 = core.LongitudeAt
	NatalResolvers              = core.NatalResolvers
	PanchangOptions             = core.PanchangOptions
	AshtakavargaOptions         = jyotish.AshtakavargaOptions
	AshtakootOptions            = jyotish.AshtakootOptions
	AshtakootResult             = jyotish.AshtakootResult
	AspectsOptions              = jyotish.AspectsOptions
	BirthChartOptions           = jyotish.BirthChartOptions
	CharaDashaResult            = jyotish.CharaDashaResult
	ComputeYogasOptions         = jyotish.ComputeYogasOptions
	Dignity                     = jyotish.Dignity
	KpCuspalSubLords            = jyotish.KpCuspalSubLords
	KpSignificators             = jyotish.KpSignificators
	KpSubLordInfo               = jyotish.KpSubLordInfo
	NarayanDashaResult          = jyotish.NarayanDashaResult
	NatalMoon                   = jyotish.NatalMoon
	NodeType                    = jyotish.NodeType
	PathuPoruthamResult         = jyotish.PathuPoruthamResult
	TithiPraveshaChart          = jyotish.TithiPraveshaChart
	VarshaphalaChart            = jyotish.VarshaphalaChart
	YoginiDashaResult           = jyotish.YoginiDashaResult
	BuildMuhurtaTableOptions    = muhurta.BuildMuhurtaTableOptions
	MuhurtaDay                  = muhurta.MuhurtaDay
	MuhurtaFile                 = muhurta.MuhurtaFile
	MuhurtaRule                 = muhurta.MuhurtaRule
	MuhurtaScore                = muhurta.MuhurtaScore
	MuhurtaScoreOptions         = muhurta.MuhurtaScoreOptions
	VaraTithiYoga               = muhurta.VaraTithiYoga
	AnandadiYogaInfo            = types.AnandadiYogaInfo
	AntarDasha                  = types.AntarDasha
	ArgalaPerBhava              = types.ArgalaPerBhava
	Arudha                      = types.Arudha
	AshtakavargaResult          = types.AshtakavargaResult
	AspectMap                   = types.AspectMap
	AyanamsaType                = types.AyanamsaType
	BhavaBalaResult             = types.BhavaBalaResult
	BhavaChart                  = types.BhavaChart
	BirthChart                  = types.BirthChart
	ChandraBalamInfo            = types.ChandraBalamInfo
	ChoghadiyaQuality           = types.ChoghadiyaQuality
	DailyPanchangResult         = types.DailyPanchangResult
	Divisional                  = types.Divisional
	DivisionalChart             = types.DivisionalChart
	FestivalRegion              = types.FestivalRegion
	GandaMulaInfo               = types.GandaMulaInfo
	GeoLocation                 = types.GeoLocation
	Graha                       = types.Graha
	InstantPanchangResult       = types.InstantPanchangResult
	JSDate                      = types.JSDate
	JaiminiKarakas              = types.JaiminiKarakas
	KaalSarpDoshaInfo           = types.KaalSarpDoshaInfo
	LagnaInfo                   = types.LagnaInfo
	Language                    = types.Language
	MangalCompatibility         = types.MangalCompatibility
	MangalDoshaInfo             = types.MangalDoshaInfo
	PanchakaType                = types.PanchakaType
	PitruDoshaInfo              = types.PitruDoshaInfo
	PlanetaryPositions          = types.PlanetaryPositions
	PratyantarDasha             = types.PratyantarDasha
	SadeSatiInfo                = types.SadeSatiInfo
	SamvatInfo                  = types.SamvatInfo
	ShadbalaResult              = types.ShadbalaResult
	TarabalaInfo                = types.TarabalaInfo
	Timezone                    = types.Timezone
	UnlocalizedDoGhatiInfo      = types.UnlocalizedDoGhatiInfo
	UnlocalizedGowriInfo        = types.UnlocalizedGowriInfo
	Upagrahas                   = types.Upagrahas
	UtcWindow                   = types.UtcWindow
	VimshottariDashaResult      = types.VimshottariDashaResult
	Yoga                        = types.Yoga

	DashaLord  = types.DashaLord
	YoginiName = jyotish.YoginiName
	SahamName  = jyotish.SahamName

	Error = types.PanchangError
	// ErrorCode identifies a failure without matching on message text.
	ErrorCode = types.ErrorCode

	// The zero value is valid but for Timezone, which is required.
	Options        = core.PanchangOptions
	InstantOptions = core.InstantPanchangOptions
	DailyResult    = types.DailyPanchangResult
	InstantResult  = types.InstantPanchangResult
)

const (
	Lahiri        = types.Lahiri
	Raman         = types.Raman
	Krishnamurti  = types.Krishnamurti
	TrueChitra    = types.TrueChitra
	Thirukanitham = types.Thirukanitham

	English = types.LanguageEn
	Hindi   = types.LanguageHi
)

const (
	GrahaSun     = types.GrahaSun
	GrahaMoon    = types.GrahaMoon
	GrahaMars    = types.GrahaMars
	GrahaMercury = types.GrahaMercury
	GrahaJupiter = types.GrahaJupiter
	GrahaVenus   = types.GrahaVenus
	GrahaSaturn  = types.GrahaSaturn
	GrahaRahu    = types.GrahaRahu
	GrahaKetu    = types.GrahaKetu

	DashaKetu    = types.DashaKetu
	DashaVenus   = types.DashaVenus
	DashaSun     = types.DashaSun
	DashaMoon    = types.DashaMoon
	DashaMars    = types.DashaMars
	DashaRahu    = types.DashaRahu
	DashaJupiter = types.DashaJupiter
	DashaSaturn  = types.DashaSaturn
	DashaMercury = types.DashaMercury

	DivisionalD2  = types.DivisionalD2
	DivisionalD3  = types.DivisionalD3
	DivisionalD7  = types.DivisionalD7
	DivisionalD9  = types.DivisionalD9
	DivisionalD10 = types.DivisionalD10
	DivisionalD12 = types.DivisionalD12
	DivisionalD30 = types.DivisionalD30

	NodeMean = jyotish.NodeMean
	NodeTrue = jyotish.NodeTrue

	RegionAll           = types.RegionAll
	RegionTamilNadu     = types.RegionTamilNadu
	RegionKerala        = types.RegionKerala
	RegionKarnataka     = types.RegionKarnataka
	RegionAndhraPradesh = types.RegionAndhraPradesh
	RegionTelangana     = types.RegionTelangana
	RegionWestBengal    = types.RegionWestBengal
	RegionOdisha        = types.RegionOdisha
	RegionAssam         = types.RegionAssam
	RegionBihar         = types.RegionBihar
	RegionGoa           = types.RegionGoa
	RegionGujarat       = types.RegionGujarat
	RegionHaryana       = types.RegionHaryana
	RegionHimachal      = types.RegionHimachalPradesh
	RegionJharkhand     = types.RegionJharkhand
	RegionMaharashtra   = types.RegionMaharashtra
	RegionPunjab        = types.RegionPunjab
	RegionRajasthan     = types.RegionRajasthan
	RegionUttarakhand   = types.RegionUttarakhand
)

// A function, not a var, so no caller can mutate the shared table; likewise below.
func AllAyanamsaTypes() []AyanamsaType {
	return append([]AyanamsaType(nil), types.AllAyanamsaTypes...)
}

func OffsetMinutes(m int) Timezone { return types.TimezoneOffset(m) }

func Zone(name string) Timezone { return types.TimezoneName(name) }

// Session holds one request's ephemeris memos; not safe for concurrent use.
type Session struct {
	ctx   *astronomy.EphemerisCtx
	natal core.NatalResolvers
}

func New() *Session {
	return &Session{ctx: astronomy.NewEphemerisCtx(), natal: jyotish.CoreNatalResolvers()}
}

func (s *Session) Reset() { s.ctx = astronomy.NewEphemerisCtx() }

func asOfMs(asOf time.Time) int64 {
	if asOf.IsZero() {
		return time.Now().UnixMilli()
	}
	return asOf.UnixMilli()
}

func (s *Session) GetDailyPanchang(date time.Time, location types.GeoLocation, options core.PanchangOptions) (types.DailyPanchangResult, bool, error) {
	return core.GetDailyPanchang(s.ctx, date.UnixMilli(), location, options, s.natal)
}

func (s *Session) GetInstantPanchang(date time.Time, location types.GeoLocation, options core.InstantPanchangOptions) (types.InstantPanchangResult, bool, error) {
	return core.GetInstantPanchang(s.ctx, date.UnixMilli(), location, options, s.natal)
}

func (s *Session) ComputeSunrise(searchFrom time.Time, location types.GeoLocation, limitDays int) (JSDate, error) {
	ms, err := astronomy.ComputeSunrise(s.ctx, searchFrom.UnixMilli(), location, limitDays)
	return JSDate(ms), err
}

func (s *Session) ComputeSunset(searchFrom time.Time, location types.GeoLocation, limitDays int) (JSDate, error) {
	ms, err := astronomy.ComputeSunset(s.ctx, searchFrom.UnixMilli(), location, limitDays)
	return JSDate(ms), err
}

func (s *Session) GetMoonrise(searchFrom time.Time, location types.GeoLocation, limitDays int) (JSDate, bool, error) {
	ms, ok, err := astronomy.GetMoonrise(s.ctx, searchFrom.UnixMilli(), location, limitDays)
	return JSDate(ms), ok, err
}

func (s *Session) GetMoonset(searchFrom time.Time, location types.GeoLocation, limitDays int) (JSDate, bool, error) {
	ms, ok, err := astronomy.GetMoonset(s.ctx, searchFrom.UnixMilli(), location, limitDays)
	return JSDate(ms), ok, err
}

func ComputeAyanamsa(at time.Time, typ types.AyanamsaType) (float64, error) {
	return astronomy.ComputeAyanamsa(at.UnixMilli(), typ)
}

func (s *Session) GetSiderealSunLongitude(at time.Time, ayanamsaType types.AyanamsaType) (float64, error) {
	return astronomy.GetSiderealSunLongitude(s.ctx, at.UnixMilli(), ayanamsaType)
}

func (s *Session) GetSiderealMoonLongitude(at time.Time, ayanamsaType types.AyanamsaType) (float64, error) {
	return astronomy.GetSiderealMoonLongitude(s.ctx, at.UnixMilli(), ayanamsaType)
}

func (s *Session) ComputeLagna(birth time.Time, location types.GeoLocation, ayanamsaType types.AyanamsaType, lang types.Language) (types.LagnaInfo, error) {
	return jyotish.ComputeLagna(s.ctx, birth.UnixMilli(), location, ayanamsaType, lang)
}

func (s *Session) ComputeRashiChart(birth time.Time, location types.GeoLocation, options jyotish.BirthChartOptions) (types.BirthChart, error) {
	return jyotish.ComputeRashiChart(s.ctx, birth.UnixMilli(), location, options)
}

func (s *Session) ComputeNavamsa(birth time.Time, location types.GeoLocation, options jyotish.BirthChartOptions) (types.DivisionalChart, error) {
	return jyotish.ComputeNavamsa(s.ctx, birth.UnixMilli(), location, options)
}

func (s *Session) ComputeVimshottariDashaFromBirth(birth time.Time, ayanamsaType types.AyanamsaType, asOf time.Time) (types.VimshottariDashaResult, error) {
	return jyotish.ComputeVimshottariDashaFromBirth(s.ctx, birth.UnixMilli(), ayanamsaType, asOfMs(asOf))
}

func ComputeAshtottariDasha(birth time.Time, moonSiderealLon float64, asOf time.Time) (types.VimshottariDashaResult, error) {
	return jyotish.ComputeAshtottariDasha(birth.UnixMilli(), moonSiderealLon, asOfMs(asOf))
}

func ComputeYoginiDasha(birth time.Time, moonSiderealLon float64, asOf time.Time) (jyotish.YoginiDashaResult, error) {
	return jyotish.ComputeYoginiDasha(birth.UnixMilli(), moonSiderealLon, asOfMs(asOf))
}

func (s *Session) ComputeCharaDasha(birth time.Time, location types.GeoLocation, ayanamsa types.AyanamsaType, asOf time.Time) (jyotish.CharaDashaResult, error) {
	return jyotish.ComputeCharaDasha(s.ctx, birth.UnixMilli(), location, ayanamsa, asOfMs(asOf))
}

func (s *Session) ComputeNarayanDasha(birth time.Time, location types.GeoLocation, ayanamsa types.AyanamsaType, asOf time.Time) (jyotish.NarayanDashaResult, error) {
	return jyotish.ComputeNarayanDasha(s.ctx, birth.UnixMilli(), location, ayanamsa, asOfMs(asOf))
}

func (s *Session) ComputeSadeSati(natalMoonRashi int, asOf time.Time, ayanamsa types.AyanamsaType) (types.SadeSatiInfo, error) {
	return jyotish.ComputeSadeSati(s.ctx, natalMoonRashi, asOfMs(asOf), ayanamsa)
}

func ComputeAshtakoot(boy, girl jyotish.NatalMoon, options jyotish.AshtakootOptions) (jyotish.AshtakootResult, error) {
	return jyotish.ComputeAshtakoot(boy, girl, options)
}

func (s *Session) ConvertGregorianToHindu(date time.Time, location types.GeoLocation, options calendar.ConvertOptions) (calendar.HinduCalendarCoords, error) {
	return calendar.ConvertGregorianToHindu(s.ctx, date.UnixMilli(), location, options)
}

func (s *Session) ConvertHinduToGregorian(coords calendar.HinduDateCoords, location types.GeoLocation, options calendar.ConvertOptions) ([]types.JSDate, error) {
	return calendar.ConvertHinduToGregorian(s.ctx, coords, location, options)
}

func (s *Session) BuildFestivalsTable(opts calendar.BuildFestivalsTableOptions) (calendar.FestivalsFile, error) {
	return calendar.BuildFestivalsTable(s.ctx, opts)
}

func (s *Session) BuildEclipsesTable(opts calendar.BuildEclipsesTableOptions) (calendar.EclipsesFile, error) {
	return calendar.BuildEclipsesTable(s.ctx, opts)
}

func (s *Session) BuildMoonPhasesTable(opts calendar.BuildMoonPhasesTableOptions) (calendar.MoonPhasesFile, error) {
	return calendar.BuildMoonPhasesTable(s.ctx, opts)
}

func (s *Session) BuildMuhurtaTable(opts muhurta.BuildMuhurtaTableOptions) (muhurta.MuhurtaFile, error) {
	return muhurta.BuildMuhurtaTable(s.ctx, opts)
}

func FormatInZone(at time.Time, offsetMinutes int) string {
	return utils.FormatInZone(at.UnixMilli(), offsetMinutes)
}

func ClassifyPanchaka(onsetVaraIndex int) (types.PanchakaType, error) {
	return core.ClassifyPanchaka(onsetVaraIndex)
}

func ComputeAbhijitMuhurta(sunrise, sunset time.Time, varaIndex *int) (types.UtcWindow, bool) {
	return core.ComputeAbhijitMuhurta(sunrise.UnixMilli(), sunset.UnixMilli(), varaIndex)
}

func ComputeAmritKalaWindows(sunriseUtc, nextSunriseUtc time.Time, getMoon core.LongitudeAt) []types.UtcWindow {
	return core.ComputeAmritKalaWindows(sunriseUtc.UnixMilli(), nextSunriseUtc.UnixMilli(), getMoon)
}

func ComputeAnandadiYoga(varaIndex, nakshatraIndex int, lang types.Language) (types.AnandadiYogaInfo, error) {
	return core.ComputeAnandadiYoga(varaIndex, nakshatraIndex, lang)
}

func ComputeArgala(chart *types.BirthChart) []types.ArgalaPerBhava {
	return jyotish.ComputeArgala(chart)
}

func ComputeArudhas(chart *types.BirthChart, lang types.Language) ([]types.Arudha, error) {
	return jyotish.ComputeArudhas(chart, lang)
}

func ComputeAshtakavarga(chart *types.BirthChart, options jyotish.AshtakavargaOptions) types.AshtakavargaResult {
	return jyotish.ComputeAshtakavarga(chart, options)
}

func ComputeAspects(chart *types.BirthChart, options jyotish.AspectsOptions) (types.AspectMap, error) {
	return jyotish.ComputeAspects(chart, options)
}

func (s *Session) ComputeAuspiciousDatesForYear(year int, rule muhurta.MuhurtaRule, location types.GeoLocation, options muhurta.MuhurtaScoreOptions) ([]muhurta.MuhurtaDay, error) {
	return muhurta.ComputeAuspiciousDatesForYear(s.ctx, year, rule, location, options)
}

func (s *Session) ComputeAuspiciousDatesInRange(rule muhurta.MuhurtaRule, start, end time.Time, location types.GeoLocation, options muhurta.MuhurtaScoreOptions) ([]muhurta.MuhurtaDay, error) {
	return muhurta.ComputeAuspiciousDatesInRange(s.ctx, rule, start.UnixMilli(), end.UnixMilli(), location, options)
}

func (s *Session) ComputeBhava(birth time.Time, location types.GeoLocation, options jyotish.BirthChartOptions) (types.BhavaChart, error) {
	return jyotish.ComputeBhava(s.ctx, birth.UnixMilli(), location, options)
}

func (s *Session) ComputeBhavaBala(birth time.Time, location types.GeoLocation, options jyotish.BirthChartOptions) (types.BhavaBalaResult, error) {
	return jyotish.ComputeBhavaBala(s.ctx, birth.UnixMilli(), location, options)
}

func (s *Session) ComputeBhavaLagna(birth time.Time, location types.GeoLocation, ayanamsaType types.AyanamsaType, lang types.Language) (types.LagnaInfo, error) {
	return jyotish.ComputeBhavaLagna(s.ctx, birth.UnixMilli(), location, ayanamsaType, lang)
}

func ComputeBrahmaMuhurta(sunrise, sunset time.Time) types.UtcWindow {
	return core.ComputeBrahmaMuhurta(sunrise.UnixMilli(), sunset.UnixMilli())
}

func ComputeChandraBalam(janmaRashiIndex, transitMoonRashiIndex int, lang types.Language) (types.ChandraBalamInfo, error) {
	return jyotish.ComputeChandraBalam(janmaRashiIndex, transitMoonRashiIndex, lang)
}

func ComputeDignity(graha types.Graha, rashi int) (jyotish.Dignity, error) {
	return jyotish.ComputeDignity(graha, rashi)
}

func (s *Session) ComputeDivisionalChart(birth time.Time, location types.GeoLocation, divisional types.Divisional, options jyotish.BirthChartOptions) (types.DivisionalChart, error) {
	return jyotish.ComputeDivisionalChart(s.ctx, birth.UnixMilli(), location, divisional, options)
}

func ComputeDoGhati(sunrise, sunset, nextSunrise time.Time, nameFn func(index int) string, qualityNameFn func(quality types.ChoghadiyaQuality) string) types.UnlocalizedDoGhatiInfo {
	return core.ComputeDoGhati(sunrise.UnixMilli(), sunset.UnixMilli(), nextSunrise.UnixMilli(), nameFn, qualityNameFn)
}

func (s *Session) ComputeEclipsesForYear(year int, location types.GeoLocation, timezone types.Timezone) ([]astronomy.EclipseInfo, error) {
	return calendar.ComputeEclipsesForYear(s.ctx, year, location, timezone)
}

func (s *Session) ComputeEclipsesInRange(start, end time.Time, location types.GeoLocation) ([]astronomy.EclipseInfo, error) {
	return calendar.ComputeEclipsesInRange(s.ctx, start.UnixMilli(), end.UnixMilli(), location)
}

func (s *Session) ComputeEkadashiDatesForYear(year int, location types.GeoLocation, options calendar.YearlyListingOptions) ([]types.JSDate, error) {
	return calendar.ComputeEkadashiDatesForYear(s.ctx, year, location, options)
}

func (s *Session) ComputeFestivalsForYear(year int, location types.GeoLocation, options calendar.YearlyListingOptions) ([]calendar.FestivalDay, error) {
	return calendar.ComputeFestivalsForYear(s.ctx, year, location, options)
}

func (s *Session) ComputeFestivalsInRange(start, end time.Time, location types.GeoLocation, options calendar.YearlyListingOptions) ([]calendar.FestivalDay, error) {
	return calendar.ComputeFestivalsInRange(s.ctx, start.UnixMilli(), end.UnixMilli(), location, options)
}

func ComputeGandaMula(currentNakshatraIndex int, lang types.Language) (types.GandaMulaInfo, error) {
	return core.ComputeGandaMula(currentNakshatraIndex, lang)
}

func (s *Session) ComputeGhatiLagna(birth time.Time, location types.GeoLocation, ayanamsaType types.AyanamsaType, lang types.Language) (types.LagnaInfo, error) {
	return jyotish.ComputeGhatiLagna(s.ctx, birth.UnixMilli(), location, ayanamsaType, lang)
}

func ComputeGodhuliMuhurta(sunset time.Time) types.UtcWindow {
	return core.ComputeGodhuliMuhurta(sunset.UnixMilli())
}

func ComputeGowriPanchangam(sunrise, sunset, nextSunrise time.Time, varaIndex int, nameFn func(index int) string, qualityNameFn func(quality types.ChoghadiyaQuality) string) types.UnlocalizedGowriInfo {
	return core.ComputeGowriPanchangam(sunrise.UnixMilli(), sunset.UnixMilli(), nextSunrise.UnixMilli(), varaIndex, nameFn, qualityNameFn)
}

func ComputeGulikaKalam(sunrise, sunset time.Time, varaIndex int) types.UtcWindow {
	return core.ComputeGulikaKalam(sunrise.UnixMilli(), sunset.UnixMilli(), varaIndex)
}

func (s *Session) ComputeHoraLagna(birth time.Time, location types.GeoLocation, ayanamsaType types.AyanamsaType, lang types.Language) (types.LagnaInfo, error) {
	return jyotish.ComputeHoraLagna(s.ctx, birth.UnixMilli(), location, ayanamsaType, lang)
}

func ComputeJaiminiKarakas(chart *types.BirthChart) (types.JaiminiKarakas, error) {
	return jyotish.ComputeJaiminiKarakas(chart)
}

func ComputeKaalSarp(chart *types.BirthChart) types.KaalSarpDoshaInfo {
	return jyotish.ComputeKaalSarp(chart)
}

func (s *Session) ComputeKpCuspalSubLords(birth time.Time, location types.GeoLocation, options jyotish.BirthChartOptions) (jyotish.KpCuspalSubLords, error) {
	return jyotish.ComputeKpCuspalSubLords(s.ctx, birth.UnixMilli(), location, options)
}

func ComputeKpSignificators(chart *types.BirthChart) jyotish.KpSignificators {
	return jyotish.ComputeKpSignificators(chart)
}

func ComputeKpSubLord(siderealLongitude float64) jyotish.KpSubLordInfo {
	return jyotish.ComputeKpSubLord(siderealLongitude)
}

func ComputeMadhyahna(sunrise, sunset time.Time) types.UtcWindow {
	return core.ComputeMadhyahna(sunrise.UnixMilli(), sunset.UnixMilli())
}

func ComputeMangalCompatibility(boyChart, girlChart *types.BirthChart) types.MangalCompatibility {
	return jyotish.ComputeMangalCompatibility(boyChart, girlChart)
}

func ComputeMangalDosha(chart *types.BirthChart) types.MangalDoshaInfo {
	return jyotish.ComputeMangalDosha(chart)
}

func (s *Session) ComputeMoonPhasesForYear(year int, options astronomy.MoonPhasesForYearOptions) ([]astronomy.MoonPhaseEvent, error) {
	return astronomy.ComputeMoonPhasesForYear(s.ctx, year, options)
}

func (s *Session) ComputeMoonPhasesInRange(start, end time.Time) ([]astronomy.MoonPhaseEvent, error) {
	return astronomy.ComputeMoonPhasesInRange(s.ctx, start.UnixMilli(), end.UnixMilli())
}

func ComputeNishitaMuhurta(sunset, nextSunrise time.Time) types.UtcWindow {
	return core.ComputeNishitaMuhurta(sunset.UnixMilli(), nextSunrise.UnixMilli())
}

func ComputePanchaka(siderealMoon float64) bool {
	return core.ComputePanchaka(siderealMoon)
}

func ComputePanchakaRahita(sunriseUtc, nextSunriseUtc time.Time, getMoon core.LongitudeAt) []types.UtcWindow {
	return core.ComputePanchakaRahita(sunriseUtc.UnixMilli(), nextSunriseUtc.UnixMilli(), getMoon)
}

func ComputePathuPorutham(boy, girl jyotish.NatalMoon) (jyotish.PathuPoruthamResult, error) {
	return jyotish.ComputePathuPorutham(boy, girl)
}

func ComputePitruDosha(chart *types.BirthChart) types.PitruDoshaInfo {
	return jyotish.ComputePitruDosha(chart)
}

func (s *Session) ComputePlanetaryPositions(at time.Time, ayanamsaType types.AyanamsaType, nakshatraName func(idx int) string, rashiName func(idx int) string, nodeType jyotish.NodeType) (types.PlanetaryPositions, error) {
	return jyotish.ComputePlanetaryPositions(s.ctx, at.UnixMilli(), ayanamsaType, nakshatraName, rashiName, nodeType)
}

func (s *Session) ComputePrashnaChart(questionMoment time.Time, location types.GeoLocation, options jyotish.BirthChartOptions) (types.BirthChart, error) {
	return jyotish.ComputePrashnaChart(s.ctx, questionMoment.UnixMilli(), location, options)
}

func ComputePratahSandhya(sunrise, sunset, nextSunrise time.Time) types.UtcWindow {
	return core.ComputePratahSandhya(sunrise.UnixMilli(), sunset.UnixMilli(), nextSunrise.UnixMilli())
}

func ComputeRahuKalam(sunrise, sunset time.Time, varaIndex int) types.UtcWindow {
	return core.ComputeRahuKalam(sunrise.UnixMilli(), sunset.UnixMilli(), varaIndex)
}

func (s *Session) ComputeSamvat(date time.Time) (types.SamvatInfo, error) {
	return calendar.ComputeSamvat(s.ctx, date.UnixMilli())
}

func (s *Session) ComputeSankrantisForYear(year int, location types.GeoLocation, options calendar.YearlyListingOptions) ([]calendar.SankrantiEvent, error) {
	return calendar.ComputeSankrantisForYear(s.ctx, year, location, options)
}

func ComputeSayahnaSandhya(sunset, nextSunrise time.Time) types.UtcWindow {
	return core.ComputeSayahnaSandhya(sunset.UnixMilli(), nextSunrise.UnixMilli())
}

func (s *Session) ComputeShadbala(birth time.Time, location types.GeoLocation, options jyotish.BirthChartOptions) (types.ShadbalaResult, error) {
	return jyotish.ComputeShadbala(s.ctx, birth.UnixMilli(), location, options)
}

func (s *Session) ComputeSripatiLagna(birth time.Time, location types.GeoLocation, ayanamsaType types.AyanamsaType, lang types.Language) (types.LagnaInfo, error) {
	return jyotish.ComputeSripatiLagna(s.ctx, birth.UnixMilli(), location, ayanamsaType, lang)
}

func ComputeTarabala(janmaNakshatraIndex, transitNakshatraIndex int, lang types.Language) (types.TarabalaInfo, error) {
	return jyotish.ComputeTarabala(janmaNakshatraIndex, transitNakshatraIndex, lang)
}

func (s *Session) ComputeTithiPravesha(natalBirth time.Time, yearAge int, location types.GeoLocation, options jyotish.BirthChartOptions) (jyotish.TithiPraveshaChart, error) {
	return jyotish.ComputeTithiPravesha(s.ctx, natalBirth.UnixMilli(), yearAge, location, options)
}

func (s *Session) ComputeUpagrahas(birth time.Time, location types.GeoLocation, options jyotish.BirthChartOptions) (types.Upagrahas, error) {
	return jyotish.ComputeUpagrahas(s.ctx, birth.UnixMilli(), location, options)
}

func ComputeVaraTithiYogas(varaIndex, tithiIndex int) ([]muhurta.VaraTithiYoga, error) {
	return muhurta.ComputeVaraTithiYogas(varaIndex, tithiIndex)
}

func ComputeVarjyam(currentNakshatraIndex int, sunriseUtc, nextSunriseUtc time.Time, getMoon core.LongitudeAt) (types.UtcWindow, bool, error) {
	return core.ComputeVarjyam(currentNakshatraIndex, sunriseUtc.UnixMilli(), nextSunriseUtc.UnixMilli(), getMoon)
}

func ComputeVarjyamWindows(sunriseUtc, nextSunriseUtc time.Time, getMoon core.LongitudeAt) []types.UtcWindow {
	return core.ComputeVarjyamWindows(sunriseUtc.UnixMilli(), nextSunriseUtc.UnixMilli(), getMoon)
}

func (s *Session) ComputeVarshaphala(natalBirth time.Time, yearAge int, location types.GeoLocation, options jyotish.BirthChartOptions) (jyotish.VarshaphalaChart, error) {
	return jyotish.ComputeVarshaphala(s.ctx, natalBirth.UnixMilli(), yearAge, location, options)
}

func ComputeVijayaMuhurta(sunrise, sunset time.Time) types.UtcWindow {
	return core.ComputeVijayaMuhurta(sunrise.UnixMilli(), sunset.UnixMilli())
}

func ComputeVimshottariDasha(birth time.Time, moonSiderealLon float64, asOf time.Time) (types.VimshottariDashaResult, error) {
	return jyotish.ComputeVimshottariDasha(birth.UnixMilli(), moonSiderealLon, asOfMs(asOf))
}

func ComputeVimshottariPratyantar(antardasha types.AntarDasha) ([]types.PratyantarDasha, error) {
	return jyotish.ComputeVimshottariPratyantar(antardasha)
}

func ComputeYamaganda(sunrise, sunset time.Time, varaIndex int) types.UtcWindow {
	return core.ComputeYamaganda(sunrise.UnixMilli(), sunset.UnixMilli(), varaIndex)
}

func ComputeYogas(chart *types.BirthChart, options jyotish.ComputeYogasOptions) ([]types.Yoga, error) {
	return jyotish.ComputeYogas(chart, options)
}

func (s *Session) FindAuspiciousDates(rule muhurta.MuhurtaRule, start, end time.Time, location types.GeoLocation, options muhurta.MuhurtaScoreOptions) ([]muhurta.MuhurtaDay, error) {
	return muhurta.FindAuspiciousDates(s.ctx, rule, start.UnixMilli(), end.UnixMilli(), location, options)
}

func FindPanchakaOnset(referenceUtc time.Time, getMoon core.LongitudeAt) (JSDate, bool) {
	ms, ok := core.FindPanchakaOnset(referenceUtc.UnixMilli(), getMoon)
	return JSDate(ms), ok
}

func (s *Session) GetEclipseDuringDay(sunrise, nextSunrise time.Time, location types.GeoLocation, lang types.Language, longitudes astronomy.SyzygyLongitudes) (astronomy.EclipseInfo, bool) {
	if longitudes.TropicalMoon == nil && longitudes.TropicalSun == nil {
		longitudes = astronomy.DirectLongitudes(s.ctx)
	}
	return astronomy.GetEclipseDuringDay(s.ctx, sunrise.UnixMilli(), nextSunrise.UnixMilli(), location, lang, longitudes)
}

func (s *Session) GetHinduNewYear(gregorianYear int, region types.FestivalRegion, location types.GeoLocation, options calendar.ConvertOptions) (types.JSDate, bool, error) {
	return calendar.GetHinduNewYear(s.ctx, gregorianYear, region, location, options)
}

func (s *Session) GetKaliYugaYear(date time.Time) (int, error) {
	return calendar.GetKaliYugaYear(s.ctx, date.UnixMilli())
}

func (s *Session) GetMoonPhasesInRange(start, end time.Time) ([]astronomy.MoonPhaseEvent, error) {
	return astronomy.GetMoonPhasesInRange(s.ctx, start.UnixMilli(), end.UnixMilli())
}

func (s *Session) GetUpcomingEclipses(from time.Time, location types.GeoLocation, count int) ([]astronomy.EclipseInfo, error) {
	return calendar.GetUpcomingEclipses(s.ctx, from.UnixMilli(), location, count)
}

func (s *Session) GetUpcomingLunarEclipse(from time.Time, location types.GeoLocation, withinDays int, lang types.Language) (astronomy.EclipseInfo, bool) {
	return astronomy.GetUpcomingLunarEclipse(s.ctx, from.UnixMilli(), location, withinDays, lang)
}

func (s *Session) GetUpcomingSolarEclipse(from time.Time, location types.GeoLocation, withinDays int, lang types.Language) (astronomy.EclipseInfo, bool) {
	return astronomy.GetUpcomingSolarEclipse(s.ctx, from.UnixMilli(), location, withinDays, lang)
}

func (s *Session) IsEclipseVisibleAnyPhase(eclipse astronomy.EclipseInfo, location types.GeoLocation) bool {
	return astronomy.IsEclipseVisibleAnyPhase(s.ctx, eclipse, location)
}

func IsPanchakaDosha(t types.PanchakaType) bool {
	return core.IsPanchakaDosha(t)
}

func (s *Session) ScoreMuhurta(date time.Time, location types.GeoLocation, rule muhurta.MuhurtaRule, options muhurta.MuhurtaScoreOptions) (muhurta.MuhurtaScore, error) {
	return muhurta.ScoreMuhurta(s.ctx, date.UnixMilli(), location, rule, options)
}

func GrahaAbbr() [types.GrahaCount]string { return jyotish.GrahaAbbr }

func AshtottariOrder() [8]DashaLord { return jyotish.AshtottariOrder }

func AshtottariYears() [types.DashaLordCount]float64 { return jyotish.AshtottariYears }

func YoginiOrder() [8]YoginiName { return jyotish.YoginiOrder }

// Indexed like [YoginiOrder]; so is [YoginiPlanet].
func YoginiYears() [8]float64 { return jyotish.YoginiYears }

func YoginiPlanet() [8]DashaLord { return jyotish.YoginiPlanet }

func CharaRashiYears() [12]float64 { return jyotish.CharaRashiYears }

func VishamaPadaRashis() [12]bool { return jyotish.VishamaPadaRashis }

func SamaPadaRashis() [12]bool { return jyotish.SamaPadaRashis }

func AllSahamNames() [jyotish.SahamNameCount]SahamName { return jyotish.AllSahamNames }

// A value copy from `rules.Get` still shares its slices.
func deepRule(r MuhurtaRule) MuhurtaRule {
	cp := func(s []int) []int {
		if s == nil {
			return nil
		}
		return append([]int(nil), s...)
	}
	r.AuspiciousTithis = cp(r.AuspiciousTithis)
	r.InauspiciousTithis = cp(r.InauspiciousTithis)
	r.AuspiciousNakshatras = cp(r.AuspiciousNakshatras)
	r.InauspiciousNakshatras = cp(r.InauspiciousNakshatras)
	r.AuspiciousVaras = cp(r.AuspiciousVaras)
	r.InauspiciousVaras = cp(r.InauspiciousVaras)
	r.AuspiciousYogas = cp(r.AuspiciousYogas)
	r.InauspiciousYogas = cp(r.InauspiciousYogas)
	if r.Bhadra != nil {
		b := *r.Bhadra
		r.Bhadra = &b
	}
	if r.VaraTithiYogas != nil {
		v := *r.VaraTithiYogas
		r.VaraTithiYogas = &v
	}
	return r
}

// A slice, not a map: it keeps the TypeScript's key order.
func StockMuhurtaRules() []MuhurtaRule {
	all := rules.All()
	for i := range all {
		all[i] = deepRule(all[i])
	}
	return all
}

func MuhurtaRuleFor(occasion string) (MuhurtaRule, bool) {
	r, ok := rules.Get(occasion)
	if !ok {
		return r, false
	}
	return deepRule(r), true
}

func VivahRule() MuhurtaRule {
	r, _ := rules.Get("vivah")
	return deepRule(r)
}

func GrihaPraveshRule() MuhurtaRule {
	r, _ := rules.Get("grihaPravesh")
	return deepRule(r)
}

func NamakaranaRule() MuhurtaRule {
	r, _ := rules.Get("namakarana")
	return deepRule(r)
}

func VidyarambhRule() MuhurtaRule {
	r, _ := rules.Get("vidyarambh")
	return deepRule(r)
}

func VahanKharidiRule() MuhurtaRule {
	r, _ := rules.Get("vahanKharidi")
	return deepRule(r)
}

func AnnaprashanRule() MuhurtaRule {
	r, _ := rules.Get("annaprashan")
	return deepRule(r)
}

func MundanRule() MuhurtaRule {
	r, _ := rules.Get("mundan")
	return deepRule(r)
}

func UpanayanamRule() MuhurtaRule {
	r, _ := rules.Get("upanayanam")
	return deepRule(r)
}

func KarnavedhaRule() MuhurtaRule {
	r, _ := rules.Get("karnavedha")
	return deepRule(r)
}

func AksharabhyasamRule() MuhurtaRule {
	r, _ := rules.Get("aksharabhyasam")
	return deepRule(r)
}

func SeemanthamRule() MuhurtaRule {
	r, _ := rules.Get("seemantham")
	return deepRule(r)
}

func ShopOpeningRule() MuhurtaRule {
	r, _ := rules.Get("shopOpening")
	return deepRule(r)
}

func TravelStartRule() MuhurtaRule {
	r, _ := rules.Get("travelStart")
	return deepRule(r)
}

func (s *Session) ComputeNarayanDashaVariable(birth time.Time, location types.GeoLocation, ayanamsa types.AyanamsaType, asOf time.Time) (jyotish.NarayanDashaResult, error) {
	return jyotish.ComputeNarayanDashaVariable(s.ctx, birth.UnixMilli(), location, ayanamsa, asOfMs(asOf))
}
