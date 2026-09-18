// Package panchang computes the Hindu calendar (panchang) and Jyotish charts
// from its own built-in ephemeris: tithi, nakshatra, yoga, karana, sunrise and
// moonrise, festivals, muhurta, birth charts, dashas and compatibility.
//
// There are no external ephemeris files, no runtime dependencies and nothing to
// download at startup. Angles are degrees, instants are UTC unless a name says
// otherwise, and sidereal positions use the ayanamsa named in the options.
//
// Start with [New] and the methods on [Session]:
//
//	s := panchang.New()
//	pune := types.GeoLocation{Latitude: 18.52, Longitude: 73.86}
//	day, ok, err := s.GetDailyPanchang(when, pune, types.PanchangOptions{
//		Timezone: panchang.OffsetMinutes(330),
//	})
//
// This package holds the engine. Every data type it takes and returns is
// declared in the companion types package, so a caller can name them and their
// fields and methods are documented in one place. The same-named aliases
// declared here (GeoLocation for [types.GeoLocation], and so on) are the
// spellings earlier v5 releases used. They stay so that existing code keeps
// compiling, and either spelling can be used: an alias and its target are one
// type.
//
// # Cancelling a long walk
//
// The methods that walk a range of dates, the table builders and the yearly
// listings, each have a twin ending in Context that takes a [context.Context]
// and stops early once it is cancelled or its deadline passes:
// [Session.BuildFestivalsTableContext], [Session.ComputeFestivalsForYearContext]
// and so on. The plain form runs to completion.
//
// # A Session is not safe for concurrent use
//
// It memoises the ephemeris as it works, which is most of why the library is
// fast, and that memo has no lock. Give each goroutine its own Session.
// [Session.Reset] drops the memo without discarding the Session; the memo is
// small and fixed-size, so Reset is rarely needed.
//
// # Enumerating the value sets
//
// Every function named All followed by a type name ([AllGrahas],
// [AllErrorCodes] and the rest) returns a fresh copy of that type's value list,
// which the caller may modify; [AllSahamNames] returns an array and
// [AllSections] a [types.SectionSet].
//
// # A false ok is not an error
//
// Several methods return (value, ok, error) and the eclipse lookups return
// (value, ok). A false ok with a nil error means the thing genuinely did not
// happen: a polar day with no sunrise, or a date with no moonrise. The caller
// decides what that means. Each such method documents its own ok.
//
// # Branch on Code, never on message text
//
// Errors carry a stable [types.PanchangError] with a [types.ErrorCode]. All
// fourteen codes are exported as constants, and [AllErrorCodes] returns them for
// exhaustiveness checks. The codes are values, not errors, so errors.Is cannot
// take one: use [IsCode], or errors.Is against one of the four Sentinel
// variables in types ([types.ErrNoSunriseSentinel] and its siblings), since
// [types.PanchangError.Is] compares codes.
//
//	if panchang.IsCode(err, types.ErrInvalidDate) {
//		// ...
//	}
package panchang

import (
	"context"
	"errors"
	"time"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/calendar"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/core"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/jyotish"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/muhurta"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/muhurta/rules"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

// Every type below is an alias for the type of the same name in the types
// package, where its fields and methods are documented. The aliases keep
// code written against earlier v5 releases compiling; new code can use
// either spelling, since an alias and its target are one type.
type (
	// AnandadiYogaInfo is an alias for [types.AnandadiYogaInfo].
	AnandadiYogaInfo = types.AnandadiYogaInfo

	// AntarDasha is an alias for [types.AntarDasha].
	AntarDasha = types.AntarDasha

	// ArgalaPerBhava is an alias for [types.ArgalaPerBhava].
	ArgalaPerBhava = types.ArgalaPerBhava

	// Arudha is an alias for [types.Arudha].
	Arudha = types.Arudha

	// AshtakavargaOptions is an alias for [types.AshtakavargaOptions].
	AshtakavargaOptions = types.AshtakavargaOptions

	// AshtakavargaResult is an alias for [types.AshtakavargaResult].
	AshtakavargaResult = types.AshtakavargaResult

	// AshtakootOptions is an alias for [types.AshtakootOptions].
	AshtakootOptions = types.AshtakootOptions

	// AshtakootResult is an alias for [types.AshtakootResult].
	AshtakootResult = types.AshtakootResult

	// AspectMap is an alias for [types.AspectMap].
	AspectMap = types.AspectMap

	// AspectsOptions is an alias for [types.AspectsOptions].
	AspectsOptions = types.AspectsOptions

	// AyanamsaType is an alias for [types.AyanamsaType].
	AyanamsaType = types.AyanamsaType

	// BhavaBalaResult is an alias for [types.BhavaBalaResult].
	BhavaBalaResult = types.BhavaBalaResult

	// BhavaChart is an alias for [types.BhavaChart].
	BhavaChart = types.BhavaChart

	// BirthChart is an alias for [types.BirthChart].
	BirthChart = types.BirthChart

	// BirthChartOptions is an alias for [types.BirthChartOptions].
	BirthChartOptions = types.BirthChartOptions

	// BuildEclipsesTableOptions is an alias for [types.BuildEclipsesTableOptions].
	BuildEclipsesTableOptions = types.BuildEclipsesTableOptions

	// BuildFestivalsTableOptions is an alias for [types.BuildFestivalsTableOptions].
	BuildFestivalsTableOptions = types.BuildFestivalsTableOptions

	// BuildMoonPhasesTableOptions is an alias for [types.BuildMoonPhasesTableOptions].
	BuildMoonPhasesTableOptions = types.BuildMoonPhasesTableOptions

	// BuildMuhurtaTableOptions is an alias for [types.BuildMuhurtaTableOptions].
	BuildMuhurtaTableOptions = types.BuildMuhurtaTableOptions

	// ChandraBalamInfo is an alias for [types.ChandraBalamInfo].
	ChandraBalamInfo = types.ChandraBalamInfo

	// CharaDashaResult is an alias for [types.CharaDashaResult].
	CharaDashaResult = types.CharaDashaResult

	// ChoghadiyaQuality is an alias for [types.ChoghadiyaQuality].
	ChoghadiyaQuality = types.ChoghadiyaQuality

	// ComputeYogasOptions is an alias for [types.ComputeYogasOptions].
	ComputeYogasOptions = types.ComputeYogasOptions

	// ConvertOptions is an alias for [types.ConvertOptions].
	ConvertOptions = types.ConvertOptions

	// DailyPanchangResult is an alias for [types.DailyPanchangResult].
	DailyPanchangResult = types.DailyPanchangResult

	// DashaLord is an alias for [types.DashaLord].
	DashaLord = types.DashaLord

	// Dignity is an alias for [types.Dignity].
	Dignity = types.Dignity

	// Divisional is an alias for [types.Divisional].
	Divisional = types.Divisional

	// DivisionalChart is an alias for [types.DivisionalChart].
	DivisionalChart = types.DivisionalChart

	// EclipseInfo is an alias for [types.EclipseInfo].
	EclipseInfo = types.EclipseInfo

	// EclipsesFile is an alias for [types.EclipsesFile].
	EclipsesFile = types.EclipsesFile

	// ErrorCode is an alias for [types.ErrorCode].
	ErrorCode = types.ErrorCode

	// FestivalDay is an alias for [types.FestivalDay].
	FestivalDay = types.FestivalDay

	// FestivalRegion is an alias for [types.FestivalRegion].
	FestivalRegion = types.FestivalRegion

	// FestivalsFile is an alias for [types.FestivalsFile].
	FestivalsFile = types.FestivalsFile

	// GandaMulaInfo is an alias for [types.GandaMulaInfo].
	GandaMulaInfo = types.GandaMulaInfo

	// GeoLocation is an alias for [types.GeoLocation].
	GeoLocation = types.GeoLocation

	// Graha is an alias for [types.Graha].
	Graha = types.Graha

	// HinduCalendarCoords is an alias for [types.HinduCalendarCoords].
	HinduCalendarCoords = types.HinduCalendarCoords

	// HinduDateCoords is an alias for [types.HinduDateCoords].
	HinduDateCoords = types.HinduDateCoords

	// InstantPanchangOptions is an alias for [types.InstantPanchangOptions].
	InstantPanchangOptions = types.InstantPanchangOptions

	// InstantPanchangResult is an alias for [types.InstantPanchangResult].
	InstantPanchangResult = types.InstantPanchangResult

	// JSDate is an alias for [types.JSDate].
	JSDate = types.JSDate

	// JaiminiKarakas is an alias for [types.JaiminiKarakas].
	JaiminiKarakas = types.JaiminiKarakas

	// KaalSarpDoshaInfo is an alias for [types.KaalSarpDoshaInfo].
	KaalSarpDoshaInfo = types.KaalSarpDoshaInfo

	// KpCuspalSubLords is an alias for [types.KpCuspalSubLords].
	KpCuspalSubLords = types.KpCuspalSubLords

	// KpSignificators is an alias for [types.KpSignificators].
	KpSignificators = types.KpSignificators

	// KpSubLordInfo is an alias for [types.KpSubLordInfo].
	KpSubLordInfo = types.KpSubLordInfo

	// LagnaInfo is an alias for [types.LagnaInfo].
	LagnaInfo = types.LagnaInfo

	// Language is an alias for [types.Language].
	Language = types.Language

	// LongitudeAt is an alias for [types.LongitudeAt].
	LongitudeAt = types.LongitudeAt

	// MangalCompatibility is an alias for [types.MangalCompatibility].
	MangalCompatibility = types.MangalCompatibility

	// MangalDoshaInfo is an alias for [types.MangalDoshaInfo].
	MangalDoshaInfo = types.MangalDoshaInfo

	// MoonPhaseEvent is an alias for [types.MoonPhaseEvent].
	MoonPhaseEvent = types.MoonPhaseEvent

	// MoonPhasesFile is an alias for [types.MoonPhasesFile].
	MoonPhasesFile = types.MoonPhasesFile

	// MoonPhasesForYearOptions is an alias for [types.MoonPhasesForYearOptions].
	MoonPhasesForYearOptions = types.MoonPhasesForYearOptions

	// MuhurtaDay is an alias for [types.MuhurtaDay].
	MuhurtaDay = types.MuhurtaDay

	// MuhurtaFile is an alias for [types.MuhurtaFile].
	MuhurtaFile = types.MuhurtaFile

	// MuhurtaRule is an alias for [types.MuhurtaRule].
	MuhurtaRule = types.MuhurtaRule

	// MuhurtaScore is an alias for [types.MuhurtaScore].
	MuhurtaScore = types.MuhurtaScore

	// MuhurtaScoreOptions is an alias for [types.MuhurtaScoreOptions].
	MuhurtaScoreOptions = types.MuhurtaScoreOptions

	// NarayanDashaResult is an alias for [types.NarayanDashaResult].
	NarayanDashaResult = types.NarayanDashaResult

	// NatalMoon is an alias for [types.NatalMoon].
	NatalMoon = types.NatalMoon

	// NatalResolvers is an alias for [types.NatalResolvers].
	NatalResolvers = types.NatalResolvers

	// NodeType is an alias for [types.NodeType].
	NodeType = types.NodeType

	// PanchakaType is an alias for [types.PanchakaType].
	PanchakaType = types.PanchakaType

	// PanchangOptions is an alias for [types.PanchangOptions].
	PanchangOptions = types.PanchangOptions

	// PathuPoruthamResult is an alias for [types.PathuPoruthamResult].
	PathuPoruthamResult = types.PathuPoruthamResult

	// PitruDoshaInfo is an alias for [types.PitruDoshaInfo].
	PitruDoshaInfo = types.PitruDoshaInfo

	// PlanetaryPositions is an alias for [types.PlanetaryPositions].
	PlanetaryPositions = types.PlanetaryPositions

	// PratyantarDasha is an alias for [types.PratyantarDasha].
	PratyantarDasha = types.PratyantarDasha

	// Reference is an alias for [types.Reference].
	Reference = types.Reference

	// SadeSatiInfo is an alias for [types.SadeSatiInfo].
	SadeSatiInfo = types.SadeSatiInfo

	// SahamName is an alias for [types.SahamName].
	SahamName = types.SahamName

	// SamvatInfo is an alias for [types.SamvatInfo].
	SamvatInfo = types.SamvatInfo

	// SankrantiEvent is an alias for [types.SankrantiEvent].
	SankrantiEvent = types.SankrantiEvent

	// ShadbalaResult is an alias for [types.ShadbalaResult].
	ShadbalaResult = types.ShadbalaResult

	// SyzygyLongitudes is an alias for [types.SyzygyLongitudes].
	SyzygyLongitudes = types.SyzygyLongitudes

	// TarabalaInfo is an alias for [types.TarabalaInfo].
	TarabalaInfo = types.TarabalaInfo

	// Timezone is an alias for [types.Timezone].
	Timezone = types.Timezone

	// TithiPraveshaChart is an alias for [types.TithiPraveshaChart].
	TithiPraveshaChart = types.TithiPraveshaChart

	// UnlocalizedDoGhatiInfo is an alias for [types.UnlocalizedDoGhatiInfo].
	UnlocalizedDoGhatiInfo = types.UnlocalizedDoGhatiInfo

	// UnlocalizedGowriInfo is an alias for [types.UnlocalizedGowriInfo].
	UnlocalizedGowriInfo = types.UnlocalizedGowriInfo

	// Upagrahas is an alias for [types.Upagrahas].
	Upagrahas = types.Upagrahas

	// UtcWindow is an alias for [types.UtcWindow].
	UtcWindow = types.UtcWindow

	// VaraTithiYoga is an alias for [types.VaraTithiYoga].
	VaraTithiYoga = types.VaraTithiYoga

	// VarshaphalaChart is an alias for [types.VarshaphalaChart].
	VarshaphalaChart = types.VarshaphalaChart

	// VimshottariDashaResult is an alias for [types.VimshottariDashaResult].
	VimshottariDashaResult = types.VimshottariDashaResult

	// YearlyListingOptions is an alias for [types.YearlyListingOptions].
	YearlyListingOptions = types.YearlyListingOptions

	// Yoga is an alias for [types.Yoga].
	Yoga = types.Yoga

	// YoginiDashaResult is an alias for [types.YoginiDashaResult].
	YoginiDashaResult = types.YoginiDashaResult

	// YoginiName is an alias for [types.YoginiName].
	YoginiName = types.YoginiName

	// Error is an alias for [types.PanchangError], the name earlier v5 releases used.
	Error = types.PanchangError

	// Options is an alias for [types.PanchangOptions], the name earlier v5 releases used.
	Options = types.PanchangOptions

	// InstantOptions is an alias for [types.InstantPanchangOptions], the name earlier v5 releases used.
	InstantOptions = types.InstantPanchangOptions

	// DailyResult is an alias for [types.DailyPanchangResult], the name earlier v5 releases used.
	DailyResult = types.DailyPanchangResult

	// InstantResult is an alias for [types.InstantPanchangResult], the name earlier v5 releases used.
	InstantResult = types.InstantPanchangResult
)

// The constants below are the panchang-package names earlier v5 releases used
// for values declared in the types package: the [types.ErrorCode],
// [types.AyanamsaType], [types.Language], [types.Graha], [types.DashaLord],
// [types.Divisional], [types.NodeType] and [types.Reference] values, nineteen
// of the [types.FestivalRegion] values (RegionUttarPradesh, RegionMadhyaPradesh
// and RegionNepal have only their types spelling) and the IST constants. They
// keep code written against earlier v5 releases compiling; each is the same
// value as its types counterpart.
const (
	ErrInvalidLatitude          = types.ErrInvalidLatitude
	ErrInvalidLongitude         = types.ErrInvalidLongitude
	ErrInvalidElevation         = types.ErrInvalidElevation
	ErrInvalidDate              = types.ErrInvalidDate
	ErrInvalidTimezone          = types.ErrInvalidTimezone
	ErrInvalidAyanamsa          = types.ErrInvalidAyanamsa
	ErrInvalidInput             = types.ErrInvalidInput
	ErrTimezoneResolutionFailed = types.ErrTimezoneResolutionFailed
	ErrNoSunrise                = types.ErrNoSunrise
	ErrNoSunset                 = types.ErrNoSunset
	ErrSearchDiverged           = types.ErrSearchDiverged
	ErrCircumpolar              = types.ErrCircumpolar
	ErrPlacidusDiverged         = types.ErrPlacidusDiverged
	ErrSahamDependencyError     = types.ErrSahamDependencyError
	Lahiri                      = types.Lahiri
	Raman                       = types.Raman
	Krishnamurti                = types.Krishnamurti
	TrueChitra                  = types.TrueChitra
	Thirukanitham               = types.Thirukanitham
	English                     = types.LanguageEn
	Hindi                       = types.LanguageHi
	GrahaSun                    = types.GrahaSun
	GrahaMoon                   = types.GrahaMoon
	GrahaMars                   = types.GrahaMars
	GrahaMercury                = types.GrahaMercury
	GrahaJupiter                = types.GrahaJupiter
	GrahaVenus                  = types.GrahaVenus
	GrahaSaturn                 = types.GrahaSaturn
	GrahaRahu                   = types.GrahaRahu
	GrahaKetu                   = types.GrahaKetu
	DashaKetu                   = types.DashaKetu
	DashaVenus                  = types.DashaVenus
	DashaSun                    = types.DashaSun
	DashaMoon                   = types.DashaMoon
	DashaMars                   = types.DashaMars
	DashaRahu                   = types.DashaRahu
	DashaJupiter                = types.DashaJupiter
	DashaSaturn                 = types.DashaSaturn
	DashaMercury                = types.DashaMercury
	DivisionalD2                = types.DivisionalD2
	DivisionalD3                = types.DivisionalD3
	DivisionalD7                = types.DivisionalD7
	DivisionalD9                = types.DivisionalD9
	DivisionalD10               = types.DivisionalD10
	DivisionalD12               = types.DivisionalD12
	DivisionalD30               = types.DivisionalD30
	NodeMean                    = types.NodeMean
	NodeTrue                    = types.NodeTrue
	RegionAll                   = types.RegionAll
	RegionTamilNadu             = types.RegionTamilNadu
	RegionKerala                = types.RegionKerala
	RegionKarnataka             = types.RegionKarnataka
	RegionAndhraPradesh         = types.RegionAndhraPradesh
	RegionTelangana             = types.RegionTelangana
	RegionWestBengal            = types.RegionWestBengal
	RegionOdisha                = types.RegionOdisha
	RegionAssam                 = types.RegionAssam
	RegionBihar                 = types.RegionBihar
	RegionGoa                   = types.RegionGoa
	RegionGujarat               = types.RegionGujarat
	RegionHaryana               = types.RegionHaryana
	RegionHimachal              = types.RegionHimachalPradesh
	RegionJharkhand             = types.RegionJharkhand
	RegionMaharashtra           = types.RegionMaharashtra
	RegionPunjab                = types.RegionPunjab
	RegionRajasthan             = types.RegionRajasthan
	RegionUttarakhand           = types.RegionUttarakhand
	ReferenceTraditional        = types.ReferenceTraditional
	ReferenceModern             = types.ReferenceModern
	ReferencePractical          = types.ReferencePractical
	ISTTimezone                 = types.ISTTimezone
	ISTOffsetMinutes            = types.ISTOffsetMinutes
)

// AllErrorCodes returns a fresh copy of the fourteen [types.ErrorCode] values, for
// exhaustiveness checks over the codes a [types.PanchangError] can carry.
func AllErrorCodes() []types.ErrorCode { return append([]types.ErrorCode(nil), types.AllErrorCodes...) }

// IsCode reports whether err, or any error it wraps, is a [types.PanchangError]
// carrying code. It is the matching form to reach for: the Err constants are
// [types.ErrorCode] values rather than errors, so errors.Is cannot take one.
//
//	if panchang.IsCode(err, types.ErrNoSunrise) {
//		// ...
//	}
func IsCode(err error, code types.ErrorCode) bool {
	var pe *types.PanchangError
	return errors.As(err, &pe) && pe.Code == code
}

// AllAyanamsaTypes returns a fresh copy of the five supported [types.AyanamsaType]
// values.
func AllAyanamsaTypes() []types.AyanamsaType {
	return append([]types.AyanamsaType(nil), types.AllAyanamsaTypes...)
}

// OffsetMinutes returns a [types.Timezone] fixed at m minutes east of UTC, 330 for
// IST. The offset is not checked here but when the timezone is used, where
// anything outside -720 to 840 reports [types.ErrInvalidTimezone].
func OffsetMinutes(m int) types.Timezone { return types.TimezoneOffset(m) }

// Zone returns a [types.Timezone] named by its IANA identifier, resolved against the
// host's zone database at the instant it is applied, so it follows DST. A name
// the database cannot resolve reports [types.ErrTimezoneResolutionFailed] at that
// point; on a host with no zone database, pass [OffsetMinutes] instead.
func Zone(name string) types.Timezone { return types.TimezoneName(name) }

// TraditionalReference returns the traditional reference point of the panchang,
// Ujjain: 23.1765 N, 75.7885 E, elevation 0.
func TraditionalReference() types.GeoLocation { return core.TraditionalReference() }

// ModernReference returns the modern reference point, on the 82.5 E meridian
// that defines IST: 23.1833 N, 82.5 E, elevation 0.
func ModernReference() types.GeoLocation { return core.ModernReference() }

// ReferenceLocation returns the fixed location behind [types.ReferenceTraditional] or
// [types.ReferenceModern]. Any other mode, [types.ReferencePractical] included, reports
// [types.ErrInvalidInput]: a practical reference has no location of its own.
func ReferenceLocation(mode types.Reference) (types.GeoLocation, error) {
	return core.ReferenceLocation(mode)
}

// ResolveLocation picks the location to compute for and reports which reference
// that was. A nil loc takes the fixed point for mode, so mode must then be
// [types.ReferenceTraditional] or [types.ReferenceModern]; any non-nil loc is used as given
// and reported as [types.ReferencePractical], including the zero [types.GeoLocation], which
// is Null Island rather than "unset". A supplied loc is validated rather than
// replaced by a reference point: an out-of-range value reports
// [types.ErrInvalidLatitude], [types.ErrInvalidLongitude] or [types.ErrInvalidElevation].
func ResolveLocation(loc *types.GeoLocation, mode types.Reference) (types.GeoLocation, types.Reference, error) {
	return core.ResolveLocation(loc, mode)
}

// A Session holds the ephemeris and the natal resolvers, and is the entry point
// for everything that needs them. Build one with [New] and reuse it: it
// memoises the ephemeris as it works, which is most of why the library is fast.
//
// A Session is not safe for concurrent use. That memo has no lock, so give each
// goroutine its own Session. [Session.Reset] drops the memo without discarding
// the Session; the memo is small and fixed-size, so Reset is rarely needed.
type Session struct {
	eph   *astronomy.EphemerisCtx
	natal core.NatalResolvers
}

// New returns a [Session] with an empty ephemeris memo. A Session is not safe
// for concurrent use: give each goroutine its own, and see [Session.Reset] to
// drop the memo without discarding the Session.
func New() *Session {
	return &Session{eph: astronomy.NewEphemerisCtx(), natal: jyotish.CoreNatalResolvers()}
}

// Reset drops the ephemeris memo a [Session] has accumulated (nutation and
// Earth position) and leaves the Session usable. The memo is a fixed size cache
// keyed by instant: dropping it discards cached work and changes no result.
func (s *Session) Reset() { s.eph = astronomy.NewEphemerisCtx() }

func asOfMs(asOf time.Time) int64 {
	if asOf.IsZero() {
		return time.Now().UnixMilli()
	}
	return asOf.UnixMilli()
}

// GetDailyPanchang returns the whole panchang for the calendar day containing
// date in options.Timezone: the angas running from that day's sunrise to the
// next with their end times, rise and set times, muhurta and inauspicious
// windows, calendar labels and festivals. ok is false with a nil error when the
// location has no sunrise or sunset that day (polar day or polar night). A
// timezone is required: the error is non-nil for an unset, unresolvable or out
// of range one (a numeric offset outside -720 to 840), for a date outside 1900
// to 2100, for out of range coordinates, and for an unrecognised ayanamsa.
func (s *Session) GetDailyPanchang(date time.Time, location types.GeoLocation, options types.PanchangOptions) (day types.DailyPanchangResult, ok bool, err error) {
	return core.GetDailyPanchang(s.eph, date.UnixMilli(), location, options, s.natal)
}

// GetInstantPanchang returns the angas, calendar labels and festivals holding
// at the given instant rather than at sunrise. The vara still comes from the
// last sunrise at or before that instant, taken in local mean time at the
// location's longitude, so [types.InstantPanchangOptions] carries no timezone. ok is false
// with a nil error when no sunrise can be found around that instant (polar day
// or polar night), and the error is non-nil for a date outside 1900 to 2100,
// out of range coordinates or an unrecognised ayanamsa.
func (s *Session) GetInstantPanchang(date time.Time, location types.GeoLocation, options types.InstantPanchangOptions) (instant types.InstantPanchangResult, ok bool, err error) {
	return core.GetInstantPanchang(s.eph, date.UnixMilli(), location, options, s.natal)
}

// ComputeSunrise returns the first sunrise at or after searchFrom, searching at
// most limitDays days forward. The error carries [types.ErrNoSunrise] when that
// window holds none (midnight sun or polar night), and otherwise reports an out
// of range latitude, longitude or elevation.
func (s *Session) ComputeSunrise(searchFrom time.Time, location types.GeoLocation, limitDays int) (types.JSDate, error) {
	ms, err := astronomy.ComputeSunrise(s.eph, searchFrom.UnixMilli(), location, limitDays)
	return types.JSDate(ms), err
}

// ComputeSunset returns the first sunset at or after searchFrom, searching at
// most limitDays days forward. The error carries [types.ErrNoSunset] when that window
// holds none (midnight sun or polar night), and otherwise reports an out of
// range latitude, longitude or elevation.
func (s *Session) ComputeSunset(searchFrom time.Time, location types.GeoLocation, limitDays int) (types.JSDate, error) {
	ms, err := astronomy.ComputeSunset(s.eph, searchFrom.UnixMilli(), location, limitDays)
	return types.JSDate(ms), err
}

// GetMoonrise returns the first moonrise at or after searchFrom, searching at
// most limitDays days forward. ok is false with a nil error when no moonrise
// falls in that window: moonrise slips about 50 minutes a day, so a short
// window can miss one, and at polar latitudes the Moon can stay down far
// longer. The error is non-nil only for an out of range latitude, longitude or
// elevation.
func (s *Session) GetMoonrise(searchFrom time.Time, location types.GeoLocation, limitDays int) (rise types.JSDate, ok bool, err error) {
	ms, ok, err := astronomy.GetMoonrise(s.eph, searchFrom.UnixMilli(), location, limitDays)
	return types.JSDate(ms), ok, err
}

// GetMoonset returns the first moonset at or after searchFrom, searching at
// most limitDays days forward. ok is false with a nil error when no moonset
// falls in that window: moonset slips about 50 minutes a day, so a short window
// can miss one, and at polar latitudes the Moon can stay up far longer. The
// error is non-nil only for an out of range latitude, longitude or elevation.
func (s *Session) GetMoonset(searchFrom time.Time, location types.GeoLocation, limitDays int) (set types.JSDate, ok bool, err error) {
	ms, ok, err := astronomy.GetMoonset(s.eph, searchFrom.UnixMilli(), location, limitDays)
	return types.JSDate(ms), ok, err
}

// ComputeAyanamsa returns the ayanamsa at the instant at, in degrees: the
// amount to subtract from a tropical longitude to get the sidereal longitude in
// that system. It reports [types.ErrInvalidAyanamsa] for an unknown typ.
func ComputeAyanamsa(at time.Time, typ types.AyanamsaType) (float64, error) {
	return astronomy.ComputeAyanamsa(at.UnixMilli(), typ)
}

// GetSiderealSunLongitude returns the Sun's apparent geocentric ecliptic
// longitude of date at the given instant, in degrees in [0, 360), as the
// tropical longitude less the named ayanamsa. The error is non-nil only for an
// unrecognised ayanamsa type, and an empty ayanamsaType counts as unrecognised
// here.
func (s *Session) GetSiderealSunLongitude(at time.Time, ayanamsaType types.AyanamsaType) (float64, error) {
	return astronomy.GetSiderealSunLongitude(s.eph, at.UnixMilli(), ayanamsaType)
}

// GetSiderealMoonLongitude returns the Moon's apparent geocentric ecliptic
// longitude of date at the given instant, in degrees in [0, 360), as the
// tropical longitude less the named ayanamsa. The error is non-nil only for an
// unrecognised ayanamsa type, and an empty ayanamsaType counts as unrecognised
// here.
func (s *Session) GetSiderealMoonLongitude(at time.Time, ayanamsaType types.AyanamsaType) (float64, error) {
	return astronomy.GetSiderealMoonLongitude(s.eph, at.UnixMilli(), ayanamsaType)
}

// ComputeLagna returns the ascendant rising at the given instant and place:
// sidereal longitude in degrees, its rashi (0-based index), the degree within
// that rashi, and the nakshatra with its pada (1 to 4). An empty ayanamsaType
// means types.Lahiri and an empty lang means types.LanguageEn. The error is non-nil for a date
// outside 1900 to 2100, out of range coordinates, or an unrecognised ayanamsa.
func (s *Session) ComputeLagna(birth time.Time, location types.GeoLocation, ayanamsaType types.AyanamsaType, lang types.Language) (types.LagnaInfo, error) {
	return jyotish.ComputeLagna(s.eph, birth.UnixMilli(), location, ayanamsaType, lang)
}

// ComputeRashiChart returns the D1 birth chart: the lagna, the twelve bhavas in
// the requested house system (whole sign when unset), and every graha with its
// sidereal longitude, rashi (0-based index), house (1 to 12) and retrograde
// flag. The error is non-nil for a birth date outside 1900 to 2100, out of
// range coordinates, an unrecognised ayanamsa, a house system that is not
// whole-sign, equal or placidus-kp, a placidus-kp cusp that is circumpolar at
// that latitude ([types.ErrCircumpolar]), or a placidus-kp cusp that fails to
// converge ([types.ErrPlacidusDiverged]).
func (s *Session) ComputeRashiChart(birth time.Time, location types.GeoLocation, options types.BirthChartOptions) (types.BirthChart, error) {
	return jyotish.ComputeRashiChart(s.eph, birth.UnixMilli(), location, options)
}

// ComputeNavamsa returns the D9 chart: each graha mapped to its navamsa
// longitude and rashi (0-based index), with houses numbered 1 to 12 from the
// navamsa lagna. The error is non-nil for a birth date outside 1900 to 2100,
// out of range coordinates, or an unrecognised ayanamsa.
func (s *Session) ComputeNavamsa(birth time.Time, location types.GeoLocation, options types.BirthChartOptions) (types.DivisionalChart, error) {
	return jyotish.ComputeNavamsa(s.eph, birth.UnixMilli(), location, options)
}

// ComputeVimshottariDashaFromBirth returns the 120 year Vimshottari sequence
// keyed to the Moon's nakshatra at birth: nine mahadashas with their
// antardashas, the first clipped to the balance remaining at birth. asOf picks
// out the current period and a zero asOf means now; an empty ayanamsaType means
// types.Lahiri. The error is non-nil for a birth date outside 1900 to 2100 or an
// unrecognised ayanamsa.
func (s *Session) ComputeVimshottariDashaFromBirth(birth time.Time, ayanamsaType types.AyanamsaType, asOf time.Time) (types.VimshottariDashaResult, error) {
	return jyotish.ComputeVimshottariDashaFromBirth(s.eph, birth.UnixMilli(), ayanamsaType, asOfMs(asOf))
}

// ComputeAshtottariDasha returns the eight Ashtottari mahadashas from the birth
// instant and the Moon's sidereal longitude in degrees, each with its
// antardashas, beginning with the unexpired balance of the mahadasha running at
// birth (108 years for a full cycle). CurrentIndex is the mahadasha holding
// asOf, or 0 when asOf falls outside all eight; a zero asOf means now. It
// reports [types.ErrInvalidDate] when birth's UTC year is outside 1900 to 2100,
// and [types.ErrInvalidInput] when moonSiderealLon lies outside [0, 360), since
// the longitude is used unnormalised to pick the nakshatra.
func ComputeAshtottariDasha(birth time.Time, moonSiderealLon float64, asOf time.Time) (types.VimshottariDashaResult, error) {
	if err := checkMoonLongitude(moonSiderealLon); err != nil {
		return types.VimshottariDashaResult{}, err
	}
	return jyotish.ComputeAshtottariDasha(birth.UnixMilli(), moonSiderealLon, asOfMs(asOf))
}

// checkMoonLongitude rejects a sidereal Moon longitude outside [0, 360): the
// dasha functions index their nakshatra tables with it unnormalised, so an out
// of range value would read past the table.
func checkMoonLongitude(lon float64) error {
	if lon != lon || lon < 0 || lon >= 360 {
		return types.Codef(types.ErrInvalidInput, "moonSiderealLon must be in [0, 360), got %v", lon)
	}
	return nil
}

// ComputeYoginiDasha returns the eight Yogini mahadashas from the birth instant
// and the Moon's sidereal longitude in degrees, each with its antardashas,
// beginning with the unexpired balance of the mahadasha running at birth (36
// years for a full cycle). CurrentIndex is the mahadasha holding asOf, or 0
// when asOf falls outside all eight; a zero asOf means now. It reports
// [types.ErrInvalidDate] when birth's UTC year is outside 1900 to 2100, and
// [types.ErrInvalidInput] when moonSiderealLon lies outside [0, 360), since
// the longitude is used unnormalised to pick the nakshatra.
func ComputeYoginiDasha(birth time.Time, moonSiderealLon float64, asOf time.Time) (types.YoginiDashaResult, error) {
	if err := checkMoonLongitude(moonSiderealLon); err != nil {
		return types.YoginiDashaResult{}, err
	}
	return jyotish.ComputeYoginiDasha(birth.UnixMilli(), moonSiderealLon, asOfMs(asOf))
}

// ComputeCharaDasha returns the Jaimini Chara dasha: twelve rashi periods
// running forward from the lagna rashi (0-based indices), each of the fixed
// length for its sign. asOf picks out the current period and a zero asOf means
// now. The error is non-nil for a birth date outside 1900 to 2100, out of range
// coordinates, or an unrecognised ayanamsa.
func (s *Session) ComputeCharaDasha(birth time.Time, location types.GeoLocation, ayanamsa types.AyanamsaType, asOf time.Time) (types.CharaDashaResult, error) {
	return jyotish.ComputeCharaDasha(s.eph, birth.UnixMilli(), location, ayanamsa, asOfMs(asOf))
}

// ComputeNarayanDasha returns twelve rashi periods (0-based indices) from the
// lagna rashi, running forward when that rashi is vishama pada and backward
// when it is sama pada, each of the fixed length for its sign. asOf picks out
// the current period and a zero asOf means now; see
// [Session.ComputeNarayanDashaVariable] for the variable duration rule. The
// error is non-nil for a birth date outside 1900 to 2100, out of range
// coordinates, or an unrecognised ayanamsa.
func (s *Session) ComputeNarayanDasha(birth time.Time, location types.GeoLocation, ayanamsa types.AyanamsaType, asOf time.Time) (types.NarayanDashaResult, error) {
	return jyotish.ComputeNarayanDasha(s.eph, birth.UnixMilli(), location, ayanamsa, asOfMs(asOf))
}

// ComputeSadeSati reports whether Saturn is transiting the three rashi arc
// around the natal Moon at asOf, with natalMoonRashi a 0-based index in [0,
// 11]. When active it gives the phase (1 for Saturn in the 12th from the Moon,
// 2 over the Moon, 3 in the 2nd) and the arc's start and end; when not, it
// gives the start of the next arc. A zero asOf means now, and the error is
// non-nil for a natalMoonRashi outside [0, 11], an asOf outside 1900 to 2100,
// or an unrecognised ayanamsa.
func (s *Session) ComputeSadeSati(natalMoonRashi int, asOf time.Time, ayanamsa types.AyanamsaType) (types.SadeSatiInfo, error) {
	return jyotish.ComputeSadeSati(s.eph, natalMoonRashi, asOfMs(asOf), ayanamsa)
}

// ComputeAshtakoot scores the eight kootas of Guna Milan for two natal Moons,
// 36 points in all, and lists the cancellations applied to Bhakoot and Nadi,
// plus Gana when options.GanaCancellation is set. It reports [types.ErrInvalidInput]
// when a rashi, lagna rashi or navamsa rashi is outside 0 to 11, a nakshatra
// outside 0 to 26, or a nakshatra pada outside 1 to 4.
func ComputeAshtakoot(boy, girl types.NatalMoon, options types.AshtakootOptions) (types.AshtakootResult, error) {
	return jyotish.ComputeAshtakoot(boy, girl, options)
}

// ConvertGregorianToHindu returns the Hindu date holding at sunrise of the
// calendar day containing date in options.Timezone: the tithi (1 to 30, and its
// 1 to 15 number within the paksha), the paksha, the chandramasa (0-based
// index) with its adhika flag, Vikram and Shaka samvat, and the vara. The error
// carries [types.ErrNoSunrise] for a polar location with no sunrise that day, and
// otherwise reports a date outside 1900 to 2100, out of range coordinates, or
// an unset or unresolvable timezone.
func (s *Session) ConvertGregorianToHindu(date time.Time, location types.GeoLocation, options types.ConvertOptions) (types.HinduCalendarCoords, error) {
	return calendar.ConvertGregorianToHindu(s.eph, date.UnixMilli(), location, options)
}

// ConvertHinduToGregorian returns every Gregorian day whose sunrise carries the
// given masa, paksha and tithi, scanning a window around that month of the
// named Vikram Samvat year, and only adhika months when coords.AdhikaOnly is
// set. The result can hold no dates (a kshaya tithi that touches no sunrise) or
// two (a tithi spanning two sunrises), which is why it is a slice. The error is
// non-nil for a MasaIndex outside [0, 11], a PakshaTithi outside [1, 15], a
// types.Paksha that is neither shukla nor krishna, out of range coordinates, a
// scanned date outside 1900 to 2100, or an unset or unresolvable timezone.
func (s *Session) ConvertHinduToGregorian(coords types.HinduDateCoords, location types.GeoLocation, options types.ConvertOptions) ([]types.JSDate, error) {
	return calendar.ConvertHinduToGregorian(s.eph, coords, location, options)
}

// BuildFestivalsTable precomputes a festival table for whole years, StartYear
// to EndYear inclusive, at one location and UTC offset, with names in each
// requested language and repeated entries interned into a shared dictionary.
// Eclipses are left out because their visibility is location dependent. The
// error is non-nil when StartYear exceeds EndYear, when Languages is present
// but empty (nil means every supported language), and for years outside 1900 to
// 2100 or out of range coordinates.
func (s *Session) BuildFestivalsTable(opts types.BuildFestivalsTableOptions) (types.FestivalsFile, error) {
	return s.BuildFestivalsTableContext(context.Background(), opts)
}

// BuildFestivalsTableContext is [Session.BuildFestivalsTable] with a context.
// It walks a range of dates, checking ctx between steps, and returns ctx.Err()
// once ctx is cancelled or its deadline passes.
func (s *Session) BuildFestivalsTableContext(ctx context.Context, opts types.BuildFestivalsTableOptions) (types.FestivalsFile, error) {
	return calendar.BuildFestivalsTable(ctx, s.eph, opts)
}

// BuildEclipsesTable precomputes an eclipse table for whole years, StartYear to
// EndYear inclusive, bucketed by the local date of each eclipse's peak at the
// given UTC offset, each entry carrying visibility from the location,
// obscuration, magnitude and the sutak window where one applies. VisibleOnly
// defaults to true when nil, keeping only eclipses observable from the location
// during some phase. The error is non-nil when StartYear exceeds EndYear, when
// Languages is present but empty (nil means every supported language), and for
// out of range coordinates. The scan overhangs the range by two days at each
// end, so StartYear 1900 and EndYear 2100 are themselves rejected as reaching
// outside the supported 1900 to 2100 span; 1901 to 2099 is the usable range.
func (s *Session) BuildEclipsesTable(opts types.BuildEclipsesTableOptions) (types.EclipsesFile, error) {
	return s.BuildEclipsesTableContext(context.Background(), opts)
}

// BuildEclipsesTableContext is [Session.BuildEclipsesTable] with a context. It
// walks a range of dates, checking ctx between steps, and returns ctx.Err()
// once ctx is cancelled or its deadline passes.
func (s *Session) BuildEclipsesTableContext(ctx context.Context, opts types.BuildEclipsesTableOptions) (types.EclipsesFile, error) {
	return calendar.BuildEclipsesTable(ctx, s.eph, opts)
}

// BuildMoonPhasesTable returns a packed table of the four Moon phase instants
// (new, first quarter, full, last quarter) for the years opts.StartYear to
// opts.EndYear inclusive, each filed under the date it falls on at
// opts.TimezoneOffsetMinutes. Phase names and descriptions are localised into
// every language in opts.Languages, into all of them when that is nil. It
// errors when StartYear is after EndYear, when Languages is non-nil but empty,
// and, because the scan overhangs the range by two days at each end, when
// StartYear is 1900 or EndYear is 2100; 1901 to 2099 is the usable range.
func (s *Session) BuildMoonPhasesTable(opts types.BuildMoonPhasesTableOptions) (types.MoonPhasesFile, error) {
	return s.BuildMoonPhasesTableContext(context.Background(), opts)
}

// BuildMoonPhasesTableContext is [Session.BuildMoonPhasesTable] with a context.
// It walks a range of dates, checking ctx between steps, and returns ctx.Err()
// once ctx is cancelled or its deadline passes.
func (s *Session) BuildMoonPhasesTableContext(ctx context.Context, opts types.BuildMoonPhasesTableOptions) (types.MoonPhasesFile, error) {
	return calendar.BuildMoonPhasesTable(ctx, s.eph, opts)
}

// BuildMuhurtaTable returns a packed table of daily muhurta scores for one
// occasion at one location, for the years opts.StartYear to opts.EndYear
// inclusive, each day filed under its date at opts.TimezoneOffsetMinutes. Days
// that fail the rule are omitted unless opts.IncludeFailures is set, and an
// empty opts.Ayanamsa, opts.MasaSystem or opts.Language falls back to
// [types.Lahiri], [types.Purnimanta] and [types.LanguageEn]. It errors when the
// location is invalid, opts.Rule carries no Occasion, StartYear is after
// EndYear, or either year lies outside 1900 to 2100.
func (s *Session) BuildMuhurtaTable(opts types.BuildMuhurtaTableOptions) (types.MuhurtaFile, error) {
	return s.BuildMuhurtaTableContext(context.Background(), opts)
}

// BuildMuhurtaTableContext is [Session.BuildMuhurtaTable] with a context. It
// walks a range of dates, checking ctx between steps, and returns ctx.Err()
// once ctx is cancelled or its deadline passes.
func (s *Session) BuildMuhurtaTableContext(ctx context.Context, opts types.BuildMuhurtaTableOptions) (types.MuhurtaFile, error) {
	return muhurta.BuildMuhurtaTable(ctx, s.eph, opts)
}

// FormatInZone renders at as an ISO 8601 timestamp shifted offsetMinutes east
// of UTC, with milliseconds and an explicit offset:
// 2025-07-04T06:02:11.000+05:30.
func FormatInZone(at time.Time, offsetMinutes int) string {
	return utils.FormatInZone(at.UnixMilli(), offsetMinutes)
}

// ClassifyPanchaka returns the Panchaka type named for the weekday the spell
// began on, onsetVaraIndex 0 for Sunday through 6 for Saturday. Wednesday and
// Thursday give the Samanya type, which carries no dosha. It reports
// [types.ErrInvalidInput] when onsetVaraIndex is outside 0 to 6.
func ClassifyPanchaka(onsetVaraIndex int) (types.PanchakaType, error) {
	return core.ClassifyPanchaka(onsetVaraIndex)
}

// ComputeAbhijitMuhurta returns the eighth of the fifteen equal day muhurtas
// between sunrise and sunset, as a UTC window. The bool is false only when
// varaIndex is non-nil and 3, Wednesday counting Sunday as 0, on which Abhijit
// is not observed; pass nil to skip that check.
func ComputeAbhijitMuhurta(sunrise, sunset time.Time, varaIndex *int) (types.UtcWindow, bool) {
	return core.ComputeAbhijitMuhurta(sunrise.UnixMilli(), sunset.UnixMilli(), varaIndex)
}

// ComputeAmritKalaWindows returns every Amrit Kala spell whose start falls in
// [sunriseUtc, nextSunriseUtc), ordered by start. A spell begins a
// per-nakshatra offset in ghatikas after that nakshatra's start and runs four
// ghatikas, a ghatika being one sixtieth of the nakshatra's own duration.
// getMoon supplies the sidereal Moon longitude in degrees at a given instant.
func ComputeAmritKalaWindows(sunriseUtc, nextSunriseUtc time.Time, getMoon types.LongitudeAt) []types.UtcWindow {
	return core.ComputeAmritKalaWindows(sunriseUtc.UnixMilli(), nextSunriseUtc.UnixMilli(), getMoon)
}

// ComputeAnandadiYoga returns the Anandadi yoga for a weekday and nakshatra
// pair, varaIndex 0 for Sunday through 6 for Saturday and nakshatraIndex 0 for
// Ashwini through 26 for Revati, with its name in lang and its quality. It
// reports [types.ErrInvalidInput] when either index is out of range.
func ComputeAnandadiYoga(varaIndex, nakshatraIndex int, lang types.Language) (types.AnandadiYogaInfo, error) {
	return core.ComputeAnandadiYoga(varaIndex, nakshatraIndex, lang)
}

// ComputeArgala returns, for each bhava 1 to 12, the planets forming argala on
// it (those in the 2nd, 4th and 11th from it) and those forming virodhargala
// (the 3rd, 10th and 12th). The Trikona field is left nil; use
// [ComputeArgalaWithTrikonargala] for the 5th and 9th house intervention.
func ComputeArgala(chart *types.BirthChart) []types.ArgalaPerBhava {
	if chart == nil {
		panic("panchang: ComputeArgala: chart must not be nil")
	}
	return jyotish.ComputeArgala(chart)
}

// ComputeArgalaWithTrikonargala returns what [ComputeArgala] does and also
// fills Trikona, the intervention of the 5th (sources) and the 9th
// (virodhakas), with Ketu's role reversed. That is the 5/9 trine, not Rath's
// competing 5/8 "Secondary Argala".
func ComputeArgalaWithTrikonargala(chart *types.BirthChart) []types.ArgalaPerBhava {
	if chart == nil {
		panic("panchang: ComputeArgalaWithTrikonargala: chart must not be nil")
	}
	return jyotish.ComputeArgalaWithTrikonargala(chart)
}

// ComputeArudhas returns the arudha pada of each bhava 1 to 12: the rashi as
// far from the bhava lord as the lord is from the bhava, with a pada landing on
// the bhava itself moved to the 10th from itself and one landing in the 7th
// from the bhava moved to the 4th from itself. Rashi names are resolved in
// lang. It reports [types.ErrInvalidInput] when the chart is missing one of the seven
// visible grahas, which the rule needs to locate a bhava lord.
func ComputeArudhas(chart *types.BirthChart, lang types.Language) ([]types.Arudha, error) {
	if chart == nil {
		return nil, types.Codef(types.ErrInvalidInput,
			"ComputeArudhas: chart must not be nil")
	}
	return jyotish.ComputeArudhas(chart, lang)
}

// ComputeAshtakavarga returns the bhinnashtakavarga bindu grid of each of the
// seven visible grahas, 12 entries indexed from Mesha, and their
// sarvashtakavarga sum. With options.Reductions set it also fills Reduced, the
// same grids after trikona sodhana and then ekadhipatya sodhana. A chart
// missing one of the seven visible grahas panics rather than placing that
// contributor's bindus from Mesha. The lagna is taken from chart.Lagna as it
// stands, so an unset lagna contributes from Mesha with no panic.
func ComputeAshtakavarga(chart *types.BirthChart, options types.AshtakavargaOptions) types.AshtakavargaResult {
	if chart == nil {
		panic("panchang: ComputeAshtakavarga: chart must not be nil")
	}
	return jyotish.ComputeAshtakavarga(chart, options)
}

// ComputeAspects returns the houses each graha aspects, 1 to 12 and ascending:
// the universal 7th plus the special aspects of Mars, Jupiter and Saturn. The
// zero options value gives the nodes the 7th only; [types.NodeAspects5And9] adds the
// 5th and 9th for Rahu and Ketu. It reports [types.ErrInvalidInput] for any other
// types.NodeAspects value, or when the chart does not carry each of the nine grahas
// exactly once.
func ComputeAspects(chart *types.BirthChart, options types.AspectsOptions) (types.AspectMap, error) {
	if chart == nil {
		var zero types.AspectMap
		return zero, types.Codef(types.ErrInvalidInput,
			"ComputeAspects: chart must not be nil")
	}
	return jyotish.ComputeAspects(chart, options)
}

// ComputeAuspiciousDatesForYear scores every day of the calendar year in
// options.Timezone against rule and returns the days sorted by descending
// score. Days that fail the rule are omitted unless options.IncludeFailures is
// set. options.Timezone is required and fixes the year's boundaries.
func (s *Session) ComputeAuspiciousDatesForYear(year int, rule types.MuhurtaRule, location types.GeoLocation, options types.MuhurtaScoreOptions) ([]types.MuhurtaDay, error) {
	return s.ComputeAuspiciousDatesForYearContext(context.Background(), year, rule, location, options)
}

// ComputeAuspiciousDatesForYearContext is
// [Session.ComputeAuspiciousDatesForYear] with a context. It walks a range of
// dates, checking ctx between steps, and returns ctx.Err() once ctx is
// cancelled or its deadline passes.
func (s *Session) ComputeAuspiciousDatesForYearContext(ctx context.Context, year int, rule types.MuhurtaRule, location types.GeoLocation, options types.MuhurtaScoreOptions) ([]types.MuhurtaDay, error) {
	return muhurta.ComputeAuspiciousDatesForYear(ctx, s.eph, year, rule, location, options)
}

// ComputeAuspiciousDatesInRange scores each day from start to end inclusive,
// stepping 24 hours, and returns them sorted by descending score. A day scores
// 0 to 100 and passes at 50 or more; failing days are omitted unless
// options.IncludeFailures is set, and days at polar latitudes with no sunrise
// or sunset are skipped. It errors when either instant lies outside 1900 to
// 2100, the location is invalid, options.Timezone is unset, or start is after
// end.
func (s *Session) ComputeAuspiciousDatesInRange(rule types.MuhurtaRule, start, end time.Time, location types.GeoLocation, options types.MuhurtaScoreOptions) ([]types.MuhurtaDay, error) {
	return s.ComputeAuspiciousDatesInRangeContext(context.Background(), rule, start, end, location, options)
}

// ComputeAuspiciousDatesInRangeContext is
// [Session.ComputeAuspiciousDatesInRange] with a context. It walks a range of
// dates, checking ctx between steps, and returns ctx.Err() once ctx is
// cancelled or its deadline passes.
func (s *Session) ComputeAuspiciousDatesInRangeContext(ctx context.Context, rule types.MuhurtaRule, start, end time.Time, location types.GeoLocation, options types.MuhurtaScoreOptions) ([]types.MuhurtaDay, error) {
	return muhurta.ComputeAuspiciousDatesInRange(ctx, s.eph, rule, start.UnixMilli(), end.UnixMilli(), location, options)
}

// ComputeBhava returns the twelve house cusps for a birth at location as
// sidereal degrees, along with the sidereal ascendant and MC longitudes.
// options.HouseSystem selects whole-sign (the default when empty), equal or
// placidus-kp; any other value is an error. The placidus-kp solver errors at
// latitudes where a cusp is circumpolar ([types.ErrCircumpolar]) or when a
// cusp fails to converge ([types.ErrPlacidusDiverged]). The error is also
// non-nil for a birth date outside 1900 to 2100, out of range coordinates or
// an unrecognised ayanamsa.
func (s *Session) ComputeBhava(birth time.Time, location types.GeoLocation, options types.BirthChartOptions) (types.BhavaChart, error) {
	return jyotish.ComputeBhava(s.eph, birth.UnixMilli(), location, options)
}

// ComputeBhavaBala returns the four Bhava Bala components (bhavadhipati, dik,
// drik, sthana) and their total for each of the twelve houses in Virupas, house
// 1 first. Drik is floored at 0.
func (s *Session) ComputeBhavaBala(birth time.Time, location types.GeoLocation, options types.BirthChartOptions) (types.BhavaBalaResult, error) {
	return jyotish.ComputeBhavaBala(s.eph, birth.UnixMilli(), location, options)
}

// ComputeBhavaLagna returns Bhava Lagna for a birth: the sidereal Sun longitude
// at the sunrise preceding birth, advanced 15 degrees per elapsed hour (one
// rashi every two hours). Rashi and nakshatra names are resolved in lang
// (types.LanguageEn when empty), and an empty ayanamsaType means types.Lahiri.
func (s *Session) ComputeBhavaLagna(birth time.Time, location types.GeoLocation, ayanamsaType types.AyanamsaType, lang types.Language) (types.LagnaInfo, error) {
	return jyotish.ComputeBhavaLagna(s.eph, birth.UnixMilli(), location, ayanamsaType, lang)
}

// ComputeBrahmaMuhurta returns the pre-dawn Brahma muhurta as a UTC window: a
// span one thirtieth of the daylight length (sunrise to sunset) wide, ending
// that same span before sunrise.
func ComputeBrahmaMuhurta(sunrise, sunset time.Time) types.UtcWindow {
	return core.ComputeBrahmaMuhurta(sunrise.UnixMilli(), sunset.UnixMilli())
}

// ComputeChandraBalam returns the transiting Moon's strength relative to a
// natal Moon rashi: the count 1 to 12 from janmaRashiIndex to
// transitMoonRashiIndex (both 0 for Mesha through 11 for Meena), and whether
// that house is strong (Shubha, the 1st, 3rd, 6th, 7th, 10th and 11th) or weak
// (Ashubha), named in lang. It reports [types.ErrInvalidInput] when either index is
// outside 0 to 11.
func ComputeChandraBalam(janmaRashiIndex, transitMoonRashiIndex int, lang types.Language) (types.ChandraBalamInfo, error) {
	return jyotish.ComputeChandraBalam(janmaRashiIndex, transitMoonRashiIndex, lang)
}

// ComputeDignity returns the dignity of graha in rashi (0 based, 0 = Mesha),
// checking exaltation, debilitation and moolatrikona first, then own sign, then
// Naisargika friendship with the sign lord. Rahu and Ketu have no row in the
// seven-planet Naisargika table, so outside their exaltation and debilitation
// signs they come back neutral. It errors on a rashi outside [0, 11] or an
// out-of-range graha.
func ComputeDignity(graha types.Graha, rashi int) (types.Dignity, error) {
	return jyotish.ComputeDignity(graha, rashi)
}

// ComputeDivisionalChart returns the varga chart for a birth, with the lagna
// and every graha mapped into divisional. Only D2, D3, D7, D9, D10, D12 and D30
// are supported; any other value is an error. House numbers run 1 to 12 counted
// from the divisional lagna.
func (s *Session) ComputeDivisionalChart(birth time.Time, location types.GeoLocation, divisional types.Divisional, options types.BirthChartOptions) (types.DivisionalChart, error) {
	return jyotish.ComputeDivisionalChart(s.eph, birth.UnixMilli(), location, divisional, options)
}

// ComputeDoGhati divides daytime and nighttime into 15 equal Do Ghati slots
// each, indexed 0 to 14 for the day and 15 to 29 for the night. nameFn and
// qualityNameFn supply the display strings for a slot index and for its fixed
// auspicious or inauspicious quality.
func ComputeDoGhati(sunrise, sunset, nextSunrise time.Time, nameFn func(index int) string, qualityNameFn func(quality types.ChoghadiyaQuality) string) types.UnlocalizedDoGhatiInfo {
	return core.ComputeDoGhati(sunrise.UnixMilli(), sunset.UnixMilli(), nextSunrise.UnixMilli(), nameFn, qualityNameFn)
}

// ComputeEclipsesForYear returns the eclipses whose new or full moon instant
// falls in the calendar year in timezone and whose peak falls no later than its
// end, ordered by peak time, selected and annotated for location
// exactly as [Session.ComputeEclipsesInRange] does. timezone is required and
// fixes the year's boundaries.
func (s *Session) ComputeEclipsesForYear(year int, location types.GeoLocation, timezone types.Timezone) ([]types.EclipseInfo, error) {
	return s.ComputeEclipsesForYearContext(context.Background(), year, location, timezone)
}

// ComputeEclipsesForYearContext is [Session.ComputeEclipsesForYear] with a
// context. It walks a range of dates, checking ctx between steps, and returns
// ctx.Err() once ctx is cancelled or its deadline passes.
func (s *Session) ComputeEclipsesForYearContext(ctx context.Context, year int, location types.GeoLocation, timezone types.Timezone) ([]types.EclipseInfo, error) {
	return calendar.ComputeEclipsesForYear(ctx, s.eph, year, location, timezone)
}

// ComputeEclipsesInRange returns the eclipses whose new or full moon instant
// falls at or after start and whose peak falls no later than end, ordered by
// peak time. Every lunar eclipse is listed; a
// solar eclipse is listed only when the Sun stands above the horizon at
// location at the start or the end of the local partial phase.
// VisibleFromLocation says whether the eclipsed body is above the horizon at
// location at peak, and it errors when either instant lies outside 1900 to
// 2100, the location is invalid, or start is after end.
func (s *Session) ComputeEclipsesInRange(start, end time.Time, location types.GeoLocation) ([]types.EclipseInfo, error) {
	return s.ComputeEclipsesInRangeContext(context.Background(), start, end, location)
}

// ComputeEclipsesInRangeContext is [Session.ComputeEclipsesInRange] with a
// context. It walks a range of dates, checking ctx between steps, and returns
// ctx.Err() once ctx is cancelled or its deadline passes.
func (s *Session) ComputeEclipsesInRangeContext(ctx context.Context, start, end time.Time, location types.GeoLocation) ([]types.EclipseInfo, error) {
	return calendar.ComputeEclipsesInRange(ctx, s.eph, start.UnixMilli(), end.UnixMilli(), location)
}

// ComputeEkadashiDatesForYear returns the Ekadashi fasting days of year, both
// pakshas, as UTC midnights. The tithi at sunrise at location fixes each day
// (options.Timezone is required to place that sunrise), and the vriddha and
// kshaya cases move the observance onto the neighbouring day. Days at polar
// latitudes with no sunrise or sunset are skipped.
func (s *Session) ComputeEkadashiDatesForYear(year int, location types.GeoLocation, options types.YearlyListingOptions) ([]types.JSDate, error) {
	return s.ComputeEkadashiDatesForYearContext(context.Background(), year, location, options)
}

// ComputeEkadashiDatesForYearContext is [Session.ComputeEkadashiDatesForYear]
// with a context. It walks a range of dates, checking ctx between steps, and
// returns ctx.Err() once ctx is cancelled or its deadline passes.
func (s *Session) ComputeEkadashiDatesForYearContext(ctx context.Context, year int, location types.GeoLocation, options types.YearlyListingOptions) ([]types.JSDate, error) {
	return calendar.ComputeEkadashiDatesForYear(ctx, s.eph, year, location, options)
}

// ComputeFestivalsForYear returns one entry per festival observed at location
// during the calendar year in options.Timezone, in date order, with several
// entries sharing a date when a day carries more than one. options.Region
// selects the regional festival set, and options.Timezone is required and fixes
// the year's boundaries.
func (s *Session) ComputeFestivalsForYear(year int, location types.GeoLocation, options types.YearlyListingOptions) ([]types.FestivalDay, error) {
	return s.ComputeFestivalsForYearContext(context.Background(), year, location, options)
}

// ComputeFestivalsForYearContext is [Session.ComputeFestivalsForYear] with a
// context. It walks a range of dates, checking ctx between steps, and returns
// ctx.Err() once ctx is cancelled or its deadline passes.
func (s *Session) ComputeFestivalsForYearContext(ctx context.Context, year int, location types.GeoLocation, options types.YearlyListingOptions) ([]types.FestivalDay, error) {
	return calendar.ComputeFestivalsForYear(ctx, s.eph, year, location, options)
}

// ComputeFestivalsInRange returns one entry per festival falling between start
// and end inclusive, walked one day at a time, so the result is in date order
// and a day with several festivals yields several entries. Days at polar
// latitudes with no sunrise or sunset are skipped. It errors when either
// instant lies outside 1900 to 2100, the location is invalid, options.Timezone
// is unset, or start is after end.
func (s *Session) ComputeFestivalsInRange(start, end time.Time, location types.GeoLocation, options types.YearlyListingOptions) ([]types.FestivalDay, error) {
	return s.ComputeFestivalsInRangeContext(context.Background(), start, end, location, options)
}

// ComputeFestivalsInRangeContext is [Session.ComputeFestivalsInRange] with a
// context. It walks a range of dates, checking ctx between steps, and returns
// ctx.Err() once ctx is cancelled or its deadline passes.
func (s *Session) ComputeFestivalsInRangeContext(ctx context.Context, start, end time.Time, location types.GeoLocation, options types.YearlyListingOptions) ([]types.FestivalDay, error) {
	return calendar.ComputeFestivalsInRange(ctx, s.eph, start.UnixMilli(), end.UnixMilli(), location, options)
}

// ComputeGandaMula reports whether currentNakshatraIndex (0 based) is one of
// the six gandanta or mula nakshatras, naming it in lang, with Jyeshtha and
// Mula severe and Ashwini, Ashlesha, Magha and Revati mild. For any other
// nakshatra it returns Active false with a nil error. It errors when the index
// is outside [0, 26].
func ComputeGandaMula(currentNakshatraIndex int, lang types.Language) (types.GandaMulaInfo, error) {
	return core.ComputeGandaMula(currentNakshatraIndex, lang)
}

// ComputeGhatiLagna returns Ghati Lagna for a birth: the sidereal Sun longitude
// at the sunrise preceding birth, advanced 30 degrees per elapsed ghatika (one
// ghatika is 24 minutes). Rashi and nakshatra names are resolved in lang
// (types.LanguageEn when empty), and an empty ayanamsaType means types.Lahiri.
func (s *Session) ComputeGhatiLagna(birth time.Time, location types.GeoLocation, ayanamsaType types.AyanamsaType, lang types.Language) (types.LagnaInfo, error) {
	return jyotish.ComputeGhatiLagna(s.eph, birth.UnixMilli(), location, ayanamsaType, lang)
}

// ComputeGodhuliMuhurta returns the fixed 48 minute twilight window centered on
// sunset, 24 minutes either side.
func ComputeGodhuliMuhurta(sunset time.Time) types.UtcWindow {
	return core.ComputeGodhuliMuhurta(sunset.UnixMilli())
}

// ComputeGowriPanchangam divides daytime and nighttime into 8 equal Gowri slots
// each, the slot sequence taken from the day and night grids for varaIndex (0
// based, 0 = Sunday). nameFn and qualityNameFn supply the display strings for a
// slot index (0 to 7) and for its quality, and both must be non-nil.
// varaIndex outside 0 to 6 panics.
func ComputeGowriPanchangam(sunrise, sunset, nextSunrise time.Time, varaIndex int, nameFn func(index int) string, qualityNameFn func(quality types.ChoghadiyaQuality) string) types.UnlocalizedGowriInfo {
	return core.ComputeGowriPanchangam(sunrise.UnixMilli(), sunset.UnixMilli(), nextSunrise.UnixMilli(), varaIndex, nameFn, qualityNameFn)
}

// ComputeGulikaKalam returns the Gulika Kalam window, one of the eight equal
// parts of daytime selected by varaIndex (0 based, 0 = Sunday). varaIndex
// outside 0 to 6 panics.
func ComputeGulikaKalam(sunrise, sunset time.Time, varaIndex int) types.UtcWindow {
	return core.ComputeGulikaKalam(sunrise.UnixMilli(), sunset.UnixMilli(), varaIndex)
}

// ComputeHoraLagna returns Hora Lagna for a birth: the sidereal Sun longitude
// at the sunrise preceding birth, advanced 30 degrees per elapsed hour (one
// rashi an hour). Rashi and nakshatra names are resolved in lang (types.LanguageEn when
// empty), and an empty ayanamsaType means types.Lahiri. The error is non-nil
// for a birth date outside 1900 to 2100, out of range coordinates, an
// unrecognised ayanamsa, or when no sunrise can be found before birth (polar
// day or polar night).
func (s *Session) ComputeHoraLagna(birth time.Time, location types.GeoLocation, ayanamsaType types.AyanamsaType, lang types.Language) (types.LagnaInfo, error) {
	return jyotish.ComputeHoraLagna(s.eph, birth.UnixMilli(), location, ayanamsaType, lang)
}

// ComputeJaiminiKarakas ranks the seven visible grahas by degree within their
// rashi, highest first, and assigns them types.Atmakaraka through types.Darakaraka. It
// errors when the chart carries an out-of-range graha or is missing one of the
// seven.
func ComputeJaiminiKarakas(chart *types.BirthChart) (types.JaiminiKarakas, error) {
	if chart == nil {
		var zero types.JaiminiKarakas
		return zero, types.Codef(types.ErrInvalidInput,
			"ComputeJaiminiKarakas: chart must not be nil")
	}
	return jyotish.ComputeJaiminiKarakas(chart)
}

// ComputeKaalSarp reports Kaal Sarp dosha: Afflicted when all seven visible
// grahas lie on one side of the Rahu/Ketu axis, Partial when all but one do.
// The subtype, named for Rahu's house, is set only when Afflicted.
func ComputeKaalSarp(chart *types.BirthChart) types.KaalSarpDoshaInfo {
	if chart == nil {
		panic("panchang: ComputeKaalSarp: chart must not be nil")
	}
	return jyotish.ComputeKaalSarp(chart)
}

// ComputeKpCuspalSubLords returns the sign lord, star lord and sub lord of each
// of the twelve house cusps, house 1 first. It forces the placidus-kp house
// system and, when options.Ayanamsa is empty, the types.Krishnamurti ayanamsa.
// The error is non-nil for a birth date outside 1900 to 2100, out of range
// coordinates, an unrecognised ayanamsa, a cusp that is circumpolar at that
// latitude ([types.ErrCircumpolar]) or one that fails to converge
// ([types.ErrPlacidusDiverged]).
func (s *Session) ComputeKpCuspalSubLords(birth time.Time, location types.GeoLocation, options types.BirthChartOptions) (types.KpCuspalSubLords, error) {
	return jyotish.ComputeKpCuspalSubLords(s.eph, birth.UnixMilli(), location, options)
}

// ComputeKpSignificators returns the KP significator houses (1 based) of each
// graha: the house it occupies, the house its star lord occupies, and the
// houses either of them owns, together with the inverse index of grahas per
// house.
func ComputeKpSignificators(chart *types.BirthChart) types.KpSignificators {
	if chart == nil {
		panic("panchang: ComputeKpSignificators: chart must not be nil")
	}
	return jyotish.ComputeKpSignificators(chart)
}

// ComputeKpSubLord splits a sidereal longitude in degrees into its KP rulers:
// sign lord, nakshatra (star) lord and sub lord, the sub being the Vimshottari
// proportional division inside the nakshatra. It also returns the longitude
// normalized to [0, 360) with its rashi and nakshatra indices (0 based).
func ComputeKpSubLord(siderealLongitude float64) types.KpSubLordInfo {
	return jyotish.ComputeKpSubLord(siderealLongitude)
}

// ComputeMadhyahna returns the fixed 48 minute midday window centered on the
// midpoint of sunrise and sunset.
func ComputeMadhyahna(sunrise, sunset time.Time) types.UtcWindow {
	return core.ComputeMadhyahna(sunrise.UnixMilli(), sunset.UnixMilli())
}

// ComputeMangalCompatibility runs [ComputeMangalDosha] on both charts and
// applies mutual cancellation: the dosha stands only when exactly one of the
// two natives is Manglik.
func ComputeMangalCompatibility(boyChart, girlChart *types.BirthChart) types.MangalCompatibility {
	if boyChart == nil || girlChart == nil {
		panic("panchang: ComputeMangalCompatibility: charts must not be nil")
	}
	return jyotish.ComputeMangalCompatibility(boyChart, girlChart)
}

// ComputeMangalDosha checks Mars against houses 1, 2, 4, 7, 8 and 12 counted
// from the lagna, the Moon and Venus, grading none, anshik (one or two of the
// three) or purna (all three). Afflicted is then cleared by any cancellation
// found (Mars in its own sign or exalted, conjunct Jupiter, the Moon or Venus,
// or under Jupiter's 5th, 7th or 9th aspect), while Severity keeps the
// uncancelled grade.
func ComputeMangalDosha(chart *types.BirthChart) types.MangalDoshaInfo {
	if chart == nil {
		panic("panchang: ComputeMangalDosha: chart must not be nil")
	}
	return jyotish.ComputeMangalDosha(chart)
}

// ComputeMoonPhasesForYear returns the new, first quarter, full and last
// quarter instants falling in the calendar year in options.Timezone, in time
// order. The instants themselves are UTC and the same worldwide; only the
// year's boundaries are local. options.Timezone is required: the error is
// non-nil for an unset or unresolvable one. The boundaries are converted with
// the zone's offset on 1 July, so for a zone that observes daylight saving
// they are off by the DST shift.
func (s *Session) ComputeMoonPhasesForYear(year int, options types.MoonPhasesForYearOptions) ([]types.MoonPhaseEvent, error) {
	return s.ComputeMoonPhasesForYearContext(context.Background(), year, options)
}

// ComputeMoonPhasesForYearContext is [Session.ComputeMoonPhasesForYear] with a
// context. It walks a range of dates, checking ctx between steps, and returns
// ctx.Err() once ctx is cancelled or its deadline passes.
func (s *Session) ComputeMoonPhasesForYearContext(ctx context.Context, year int, options types.MoonPhasesForYearOptions) ([]types.MoonPhaseEvent, error) {
	return astronomy.ComputeMoonPhasesForYear(ctx, s.eph, year, options)
}

// ComputeMoonPhasesInRange returns the new, first quarter, full and last
// quarter instants between start and end inclusive, in time order, as UTC
// instants. These are the literal phase moments, distinct from the Amavasya and
// Purnima tithis of the same name, which are windows of about a day. It errors
// when either instant lies outside 1900 to 2100 or start is after end.
func (s *Session) ComputeMoonPhasesInRange(start, end time.Time) ([]types.MoonPhaseEvent, error) {
	return s.ComputeMoonPhasesInRangeContext(context.Background(), start, end)
}

// ComputeMoonPhasesInRangeContext is [Session.ComputeMoonPhasesInRange] with a
// context. It walks a range of dates, checking ctx between steps, and returns
// ctx.Err() once ctx is cancelled or its deadline passes.
func (s *Session) ComputeMoonPhasesInRangeContext(ctx context.Context, start, end time.Time) ([]types.MoonPhaseEvent, error) {
	return astronomy.ComputeMoonPhasesInRange(ctx, s.eph, start.UnixMilli(), end.UnixMilli())
}

// ComputeNishitaMuhurta returns the eighth of the fifteen equal night muhurtas,
// the one straddling the midpoint of sunset and the next sunrise.
func ComputeNishitaMuhurta(sunset, nextSunrise time.Time) types.UtcWindow {
	return core.ComputeNishitaMuhurta(sunset.UnixMilli(), nextSunrise.UnixMilli())
}

// ComputePanchaka reports whether a sidereal Moon longitude in degrees is 300
// or more, the start of the Panchaka span (Dhanishtha's second half through
// Revati). The value is used as given, so it must already be in [0, 360).
func ComputePanchaka(siderealMoon float64) bool {
	return core.ComputePanchaka(siderealMoon)
}

// ComputePanchakaRahita returns the part of the sunrise to next sunrise day
// that is free of Panchaka, at most one window. The slice is empty when the
// Moon is in Panchaka for the whole day, and holds the whole day when it is
// never in it. getMoon supplies the sidereal Moon longitude in degrees, 0 to
// 360, at an instant.
func ComputePanchakaRahita(sunriseUtc, nextSunriseUtc time.Time, getMoon types.LongitudeAt) []types.UtcWindow {
	return core.ComputePanchakaRahita(sunriseUtc.UnixMilli(), nextSunriseUtc.UnixMilli(), getMoon)
}

// ComputePathuPorutham scores the ten South Indian poruthams for two natal
// Moons. Recommended requires at least 5 of the 10 to pass and no veto (Yoni
// score 0, a shared Rajju, or a Vedha pair). It errors when either input has a
// rashi outside [0, 11], a nakshatra outside [0, 26], an optional lagna or
// navamsa rashi outside [0, 11], or an optional nakshatra pada outside [1, 4].
func ComputePathuPorutham(boy, girl types.NatalMoon) (types.PathuPoruthamResult, error) {
	return jyotish.ComputePathuPorutham(boy, girl)
}

// ComputePitruDosha reports Pitru dosha with the reasons that triggered it: the
// Sun sharing a house with Rahu or with Saturn, Rahu in the 9th house, or the
// 9th lord (when that lord is not the Sun) sharing a house with Rahu. Afflicted
// is true when at least one reason applies.
func ComputePitruDosha(chart *types.BirthChart) types.PitruDoshaInfo {
	if chart == nil {
		panic("panchang: ComputePitruDosha: chart must not be nil")
	}
	return jyotish.ComputePitruDosha(chart)
}

// ComputePlanetaryPositions returns the sidereal longitudes of the nine grahas
// at the given instant, in degrees, each with its rashi, degree in rashi,
// nakshatra and retrograde flag. nakshatraName and rashiName turn a 0-based
// index into a display name and may be nil, in which case the index is
// formatted as a number; nodeType picks the mean (the default when empty) or
// true Rahu, with Ketu 180 degrees opposite and both marked retrograde.
// ayanamsaType is required: an empty or unknown value is an error.
func (s *Session) ComputePlanetaryPositions(at time.Time, ayanamsaType types.AyanamsaType, nakshatraName func(idx int) string, rashiName func(idx int) string, nodeType types.NodeType) (types.PlanetaryPositions, error) {
	return jyotish.ComputePlanetaryPositions(s.eph, at.UnixMilli(), ayanamsaType, nakshatraName, rashiName, nodeType)
}

// ComputePrashnaChart returns the D1 rashi chart cast for questionMoment at
// location, the horary chart of prashna practice. When options.HouseSystem or
// options.Ayanamsa is empty it falls back to placidus-kp and types.Krishnamurti, not
// to the birth-chart defaults of whole-sign and types.Lahiri. The error
// conditions are those of [Session.ComputeRashiChart].
func (s *Session) ComputePrashnaChart(questionMoment time.Time, location types.GeoLocation, options types.BirthChartOptions) (types.BirthChart, error) {
	return jyotish.ComputePrashnaChart(s.eph, questionMoment.UnixMilli(), location, options)
}

// ComputePratahSandhya returns the morning twilight window ending at sunrise,
// one tenth as long as the following night (sunset to nextSunrise).
func ComputePratahSandhya(sunrise, sunset, nextSunrise time.Time) types.UtcWindow {
	return core.ComputePratahSandhya(sunrise.UnixMilli(), sunset.UnixMilli(), nextSunrise.UnixMilli())
}

// ComputeRahuKalam returns the Rahu Kalam window, one of the eight equal parts
// of daytime selected by varaIndex (0 based, 0 = Sunday). varaIndex outside 0
// to 6 panics.
func ComputeRahuKalam(sunrise, sunset time.Time, varaIndex int) types.UtcWindow {
	return core.ComputeRahuKalam(sunrise.UnixMilli(), sunset.UnixMilli(), varaIndex)
}

// ComputeSamvat returns the Vikram and Shaka era years for the instant, each
// with its name in the 60-year Samvatsara cycle. Both are taken from the
// instant's UTC Gregorian year and step up at that year's Chaitra new moon, not
// on 1 January.
func (s *Session) ComputeSamvat(date time.Time) (types.SamvatInfo, error) {
	return calendar.ComputeSamvat(s.eph, date.UnixMilli())
}

// ComputeSankrantisForYear returns the Sankrantis (the Sun's sidereal sign
// ingresses) whose observance date falls in the given Gregorian year by local
// date, in time order. Moment is the exact transit instant in UTC, Date is the
// local day the transit is reckoned to (the sunrise-to-sunset day containing
// it, else the following sunrise's day), and Rashi is 0-based with 0 = Mesha.
// It errors if the location is invalid, the timezone cannot be resolved, or
// options.Ayanamsa is unrecognised.
func (s *Session) ComputeSankrantisForYear(year int, location types.GeoLocation, options types.YearlyListingOptions) ([]types.SankrantiEvent, error) {
	return s.ComputeSankrantisForYearContext(context.Background(), year, location, options)
}

// ComputeSankrantisForYearContext is [Session.ComputeSankrantisForYear] with a
// context. It walks a range of dates, checking ctx between steps, and returns
// ctx.Err() once ctx is cancelled or its deadline passes.
func (s *Session) ComputeSankrantisForYearContext(ctx context.Context, year int, location types.GeoLocation, options types.YearlyListingOptions) ([]types.SankrantiEvent, error) {
	return calendar.ComputeSankrantisForYear(ctx, s.eph, year, location, options)
}

// ComputeSayahnaSandhya returns the evening twilight window starting at sunset,
// one tenth of the night's length long.
func ComputeSayahnaSandhya(sunset, nextSunrise time.Time) types.UtcWindow {
	return core.ComputeSayahnaSandhya(sunset.UnixMilli(), nextSunrise.UnixMilli())
}

// ComputeShadbala returns the six-fold strength of the seven visible grahas for
// a birth, in virupas (60 virupas = 1 rupa). Total sums the six components,
// counting a negative Drik as zero while the Drik field keeps its sign.
func (s *Session) ComputeShadbala(birth time.Time, location types.GeoLocation, options types.BirthChartOptions) (types.ShadbalaResult, error) {
	return jyotish.ComputeShadbala(s.eph, birth.UnixMilli(), location, options)
}

// ComputeSripatiLagna returns the ascendant for the birth instant under the
// Sripati house system, the same ascendant [Session.ComputeLagna] gives, since
// Sripati differs only in its intermediate cusps. SiderealLongitude is in
// degrees under the given ayanamsa (empty means types.Lahiri, empty lang means
// types.LanguageEn). It errors when the birth date lies outside 1900 to 2100, the
// location is invalid, or the ayanamsa is unrecognised.
func (s *Session) ComputeSripatiLagna(birth time.Time, location types.GeoLocation, ayanamsaType types.AyanamsaType, lang types.Language) (types.LagnaInfo, error) {
	return jyotish.ComputeSripatiLagna(s.eph, birth.UnixMilli(), location, ayanamsaType, lang)
}

// ComputeTarabala returns the tara of a transit nakshatra counted from the
// janma nakshatra, (transit - janma) mod 9, as index 0 Janma through 8
// Ati-Mitra, with Vipat, Pratyari and Vadha marked inauspicious. Both indices
// are 0 based, lang selects the localized name, and it errors when either index
// is outside [0, 26].
func ComputeTarabala(janmaNakshatraIndex, transitNakshatraIndex int, lang types.Language) (types.TarabalaInfo, error) {
	return jyotish.ComputeTarabala(janmaNakshatraIndex, transitNakshatraIndex, lang)
}

// ComputeTithiPravesha returns the annual Tithi Pravesha chart for the
// yearAge-th year: the chart cast for the moment near that solar return when
// the Moon's elongation from the Sun returns to its natal value, preferring the
// candidate with the Sun back in the natal rashi. yearAge counts years after
// birth and must be 1 or more, otherwise the call fails with types.ErrInvalidInput.
func (s *Session) ComputeTithiPravesha(natalBirth time.Time, yearAge int, location types.GeoLocation, options types.BirthChartOptions) (types.TithiPraveshaChart, error) {
	return jyotish.ComputeTithiPravesha(s.eph, natalBirth.UnixMilli(), yearAge, location, options)
}

// ComputeUpagrahas returns the seven shadowy sub-planets for a birth: Gulika
// and Mandi are the ascendant at the start and at the midpoint of Saturn's
// eighth of the birth day (of the night, for a birth after sunset), and Dhuma,
// Vyatipata, Parivesha, Indrachapa and Upaketu are derived from the Sun's
// sidereal longitude. Each carries a sidereal longitude in degrees, its rashi
// (0-based, 0 = Mesha), and its whole-sign house counted 1-based from the natal
// lagna.
func (s *Session) ComputeUpagrahas(birth time.Time, location types.GeoLocation, options types.BirthChartOptions) (types.Upagrahas, error) {
	return jyotish.ComputeUpagrahas(s.eph, birth.UnixMilli(), location, options)
}

// ComputeVaraTithiYogas returns the vara and tithi combinations in force for
// varaIndex (0 based, 0 = Sunday) and tithiIndex (0 based, [0, 29], reduced to
// its number within the paksha), auspicious ones first. The slice is empty when
// no combination applies. It errors when either index is out of range.
func ComputeVaraTithiYogas(varaIndex, tithiIndex int) ([]types.VaraTithiYoga, error) {
	return muhurta.ComputeVaraTithiYogas(varaIndex, tithiIndex)
}

// ComputeVarjyam returns the Varjyam window of currentNakshatraIndex (0 based)
// that overlaps the sunrise to next sunrise day. The bool is false when that
// nakshatra's spell falls entirely outside the day, or when its boundaries
// cannot be bracketed within 30 hours either side of sunrise. It errors when
// the index is outside [0, 26].
func ComputeVarjyam(currentNakshatraIndex int, sunriseUtc, nextSunriseUtc time.Time, getMoon types.LongitudeAt) (window types.UtcWindow, ok bool, err error) {
	return core.ComputeVarjyam(currentNakshatraIndex, sunriseUtc.UnixMilli(), nextSunriseUtc.UnixMilli(), getMoon)
}

// ComputeVarjyamWindows returns every Varjyam spell starting at or after
// sunrise and before the next sunrise, in start order, walking up to three
// nakshatras from sunrise. Mula is the one nakshatra that carries two spells,
// so it alone can contribute more than one window.
func ComputeVarjyamWindows(sunriseUtc, nextSunriseUtc time.Time, getMoon types.LongitudeAt) []types.UtcWindow {
	return core.ComputeVarjyamWindows(sunriseUtc.UnixMilli(), nextSunriseUtc.UnixMilli(), getMoon)
}

// ComputeVarshaphala returns the annual chart for the yearAge-th solar return:
// the return instant, the chart cast for it, the Muntha (the natal lagna rashi
// advanced one sign per year), the year lord, the types.Sahams and whether the return
// falls by day. yearAge counts years after birth and must be 1 or more,
// otherwise the call fails with types.ErrInvalidInput.
func (s *Session) ComputeVarshaphala(natalBirth time.Time, yearAge int, location types.GeoLocation, options types.BirthChartOptions) (types.VarshaphalaChart, error) {
	return jyotish.ComputeVarshaphala(s.eph, natalBirth.UnixMilli(), yearAge, location, options)
}

// ComputeVijayaMuhurta returns the Vijaya muhurta for a day, the 11th of the 15
// equal muhurtas of daylight, so it starts 10/15 of the way from sunrise to
// sunset and lasts one fifteenth of the daylight. Arguments and the returned
// window are UTC.
func ComputeVijayaMuhurta(sunrise, sunset time.Time) types.UtcWindow {
	return core.ComputeVijayaMuhurta(sunrise.UnixMilli(), sunset.UnixMilli())
}

// ComputeVimshottariDasha returns all nine Vimshottari mahadashas from birth
// with their antardashas, the first mahadasha truncated to the balance of the
// janma nakshatra lord and its already elapsed antardashas dropped;
// moonSiderealLon is the sidereal Moon longitude at birth in degrees and
// periods use a 365.25 day year. A zero asOf means now, and CurrentIndex is 0
// when asOf falls outside every mahadasha. It errors when birth's UTC year is
// outside 1900 to 2100.
func ComputeVimshottariDasha(birth time.Time, moonSiderealLon float64, asOf time.Time) (types.VimshottariDashaResult, error) {
	return jyotish.ComputeVimshottariDasha(birth.UnixMilli(), moonSiderealLon, asOfMs(asOf))
}

// ComputeVimshottariPratyantar splits one antardasha into its nine
// pratyantardashas, beginning with the antardasha's own lord and running in
// Vimshottari order, each taking its Vimshottari years out of 120 of the span.
// It errors only when antardasha.Lord is not a valid [types.DashaLord].
func ComputeVimshottariPratyantar(antardasha types.AntarDasha) ([]types.PratyantarDasha, error) {
	return jyotish.ComputeVimshottariPratyantar(antardasha)
}

// ComputeYamaganda returns the Yamaganda kalam, one of the eight equal slots of
// daylight, selected by weekday. varaIndex is 0 for Sunday through 6 for
// Saturday, and a value outside that range panics; arguments and the returned
// window are UTC.
func ComputeYamaganda(sunrise, sunset time.Time, varaIndex int) types.UtcWindow {
	return core.ComputeYamaganda(sunrise.UnixMilli(), sunset.UnixMilli(), varaIndex)
}

// ComputeYogas evaluates the built-in yoga catalogue against chart and returns
// every yoga that matches, with its reasons and any bhanga (cancellation). An
// empty options.Types keeps every yoga type, otherwise only the listed types
// are evaluated. It errors when chart is nil or missing a graha, or when
// options.Types names an unknown [types.YogaType].
func ComputeYogas(chart *types.BirthChart, options types.ComputeYogasOptions) ([]types.Yoga, error) {
	if chart == nil {
		return nil, types.Codef(types.ErrInvalidInput,
			"ComputeYogas: chart must not be nil")
	}
	return jyotish.ComputeYogas(chart, options)
}

// FindAuspiciousDates scores every day from start to end inclusive against rule
// and returns those that pass, sorted by descending score; it is identical to
// [Session.ComputeAuspiciousDatesInRange]. Failing days are included only when
// options.IncludeFailures is set, and days with no sunrise are skipped. It
// errors if start is after end, if either date lies outside 1900 to 2100, or if
// the location is invalid.
//
// Deprecated: use [Session.ComputeAuspiciousDatesInRange].
func (s *Session) FindAuspiciousDates(rule types.MuhurtaRule, start, end time.Time, location types.GeoLocation, options types.MuhurtaScoreOptions) ([]types.MuhurtaDay, error) {
	return muhurta.FindAuspiciousDates(context.Background(), s.eph, rule, start.UnixMilli(), end.UnixMilli(), location, options)
}

// FindPanchakaOnset returns the instant the Moon entered Panchaka, its sidereal
// longitude crossing 300 degrees, searched over the seven days ending at
// referenceUtc. The bool is false when the Moon is not in Panchaka at
// referenceUtc, when it was already in Panchaka seven days earlier and so no
// crossing lies in the window, or when the crossing search does not converge.
func FindPanchakaOnset(referenceUtc time.Time, getMoon types.LongitudeAt) (types.JSDate, bool) {
	ms, ok := core.FindPanchakaOnset(referenceUtc.UnixMilli(), getMoon)
	return types.JSDate(ms), ok
}

// GetEclipseDuringDay returns the eclipse whose peak falls between sunrise and
// the next sunrise, that is, within the Hindu day, preferring the solar one
// when both a solar and a lunar eclipse peak there. Solar eclipses pass the
// same above-horizon filter as [Session.GetUpcomingSolarEclipse], and ok is
// false when nothing qualifies, which is the ordinary case. longitudes supplies
// the tropical Sun and Moon functions used for the cheap syzygy pre-filter; a
// [types.SyzygyLongitudes] with either function nil falls back to the session's
// own ephemeris for both.
func (s *Session) GetEclipseDuringDay(sunrise, nextSunrise time.Time, location types.GeoLocation, lang types.Language, longitudes types.SyzygyLongitudes) (types.EclipseInfo, bool) {
	if longitudes.TropicalMoon == nil || longitudes.TropicalSun == nil {
		longitudes = astronomy.DirectLongitudes(s.eph)
	}
	return astronomy.GetEclipseDuringDay(s.eph, sunrise.UnixMilli(), nextSunrise.UnixMilli(), location, lang, longitudes)
}

// GetHinduNewYear returns the day the Hindu year begins in gregorianYear for
// the region: Chaitra Shukla Pratipada for most regions, or the Mesha Sankranti
// day for Tamil Nadu, Kerala, Punjab, West Bengal and Assam, where which civil
// day the transit is reckoned to varies by region. The value identifies a day,
// not a moment within it. ok is false when the scan finds no such day. A
// timezone is required in options: the error is non-nil for an unset or
// unresolvable one, for an invalid location, for an unrecognised
// options.Ayanamsa, and, on the Chaitra path, for a gregorianYear outside 1900
// to 2100.
func (s *Session) GetHinduNewYear(gregorianYear int, region types.FestivalRegion, location types.GeoLocation, options types.ConvertOptions) (date types.JSDate, ok bool, err error) {
	return calendar.GetHinduNewYear(s.eph, gregorianYear, region, location, options)
}

// GetKaliYugaYear returns the Kali Yuga year for the instant, counted from the
// 3102 BCE epoch and turning over at that Gregorian year's Chaitra new moon
// rather than on 1 January. It errors when the date lies outside 1900 to 2100.
func (s *Session) GetKaliYugaYear(date time.Time) (int, error) {
	return calendar.GetKaliYugaYear(s.eph, date.UnixMilli())
}

// GetMoonPhasesInRange returns every new moon, first quarter, full moon and
// last quarter whose instant falls in [start, end] inclusive, in time order and
// in UTC. It is identical to [Session.ComputeMoonPhasesInRange], and errors if
// start is after end or either endpoint lies outside 1900 to 2100.
//
// Deprecated: use [Session.ComputeMoonPhasesInRange].
func (s *Session) GetMoonPhasesInRange(start, end time.Time) ([]types.MoonPhaseEvent, error) {
	return astronomy.GetMoonPhasesInRange(context.Background(), s.eph, start.UnixMilli(), end.UnixMilli())
}

// GetUpcomingEclipses returns up to count eclipses at or after from, solar and
// lunar interleaved in peak order, and fewer than count when the search runs
// out. A solar eclipse is included only when the Sun is above the horizon at
// the location at the start or the end of its local partial phase, while lunar
// eclipses are returned either way, with VisibleFromLocation reporting
// visibility at peak. It errors when count is below 1, when from lies outside
// 1900 to 2100, or when the location is invalid.
func (s *Session) GetUpcomingEclipses(from time.Time, location types.GeoLocation, count int) ([]types.EclipseInfo, error) {
	return calendar.GetUpcomingEclipses(s.eph, from.UnixMilli(), location, count)
}

// GetUpcomingLunarEclipse returns the first lunar eclipse whose penumbral phase
// begins no later than withinDays after from, visible from the location or not:
// VisibleFromLocation says whether the Moon is above the horizon at peak. The
// search starts at the first full moon at or after from, so an eclipse whose
// full moon has already passed is skipped even while it is still running. Start
// and End bound the penumbral phase, and the sutak window (9 hours before
// umbral first contact to umbral last contact) is set only for an eclipse that
// has an umbral phase, so a penumbral eclipse carries none. ok is false when no
// lunar eclipse falls in the window.
func (s *Session) GetUpcomingLunarEclipse(from time.Time, location types.GeoLocation, withinDays int, lang types.Language) (types.EclipseInfo, bool) {
	return astronomy.GetUpcomingLunarEclipse(s.eph, from.UnixMilli(), location, withinDays, lang)
}

// GetUpcomingSolarEclipse returns the first solar eclipse whose local partial
// phase begins no later than withinDays after from and has the Sun above the
// horizon at its start or at its end; one that begins and ends with the Sun
// down is passed over and the search continues to the next. The window bounds
// first contact, not the new moon, so an eclipse is still returned when its
// conjunction falls past the window end. The search starts at the first new
// moon at or after from, so an eclipse whose new moon has already passed is
// skipped even while it is still running, while one whose first contact is
// behind from but whose new moon is still ahead is returned with a Start
// earlier than from. VisibleFromLocation reports whether the Sun is up at peak,
// and the sutak window runs from 12 hours before first contact to last contact.
// ok is false when no such eclipse falls in the window.
func (s *Session) GetUpcomingSolarEclipse(from time.Time, location types.GeoLocation, withinDays int, lang types.Language) (types.EclipseInfo, bool) {
	return astronomy.GetUpcomingSolarEclipse(s.eph, from.UnixMilli(), location, withinDays, lang)
}

// IsEclipseVisibleAnyPhase reports whether the eclipsed body (the Sun for a
// solar eclipse, the Moon for a lunar one) is above the horizon at the location
// at any of 13 samples spaced evenly from the eclipse's start to its end. It is
// looser than the types.EclipseInfo.VisibleFromLocation flag, which only looks at the
// peak.
func (s *Session) IsEclipseVisibleAnyPhase(eclipse types.EclipseInfo, location types.GeoLocation) bool {
	return astronomy.IsEclipseVisibleAnyPhase(s.eph, eclipse, location)
}

// IsPanchakaDosha reports whether a Panchaka type carries a dosha. Every type
// does except "samanya", the Wednesday and Thursday onsets the sources leave
// unnamed.
func IsPanchakaDosha(t types.PanchakaType) bool {
	return core.IsPanchakaDosha(t)
}

// ScoreMuhurta scores one day against rule, starting from 50 and clamped to 0
// through 100, with Passes true at 50 or above and Reasons and Factors
// recording what moved it. A polar day with no sunrise or no sunset scores 0
// with a no_sunrise factor rather than returning an error. options.Timezone is
// required: it errors for an unset or unresolvable timezone, for a date outside
// 1900 to 2100, for an invalid location, and for an unrecognised
// options.Ayanamsa.
func (s *Session) ScoreMuhurta(date time.Time, location types.GeoLocation, rule types.MuhurtaRule, options types.MuhurtaScoreOptions) (types.MuhurtaScore, error) {
	return muhurta.ScoreMuhurta(s.eph, date.UnixMilli(), location, rule, options)
}

// GrahaAbbr returns the two letter English abbreviations of the nine grahas
// (Su, Mo, Ma, Me, Ju, Ve, Sa, Ra, Ke), indexed by [types.Graha]. They do not
// vary with the language option.
func GrahaAbbr() [types.GrahaCount]string { return jyotish.GrahaAbbr }

// AshtottariOrder returns the eight dasha lords of the Ashtottari cycle in
// sequence, Sun through Venus. Ketu takes no part in Ashtottari.
func AshtottariOrder() [8]types.DashaLord { return jyotish.AshtottariOrder }

// AshtottariYears returns the length in years of each lord's Ashtottari
// mahadasha, indexed by [types.DashaLord] and totalling 108. Ketu's entry is 0, since
// Ketu takes no part in Ashtottari.
func AshtottariYears() [types.DashaLordCount]float64 { return jyotish.AshtottariYears }

// YoginiOrder returns the eight Yoginis in cycle order, Mangala through
// Sankata.
func YoginiOrder() [8]types.YoginiName { return jyotish.YoginiOrder }

// YoginiYears returns the length in years of each Yogini's mahadasha, 1 through
// 8 in [YoginiOrder] order, so the cycle totals 36.
func YoginiYears() [8]float64 { return jyotish.YoginiYears }

// YoginiPlanet returns the dasha lord of each Yogini, indexed to match
// [YoginiOrder].
func YoginiPlanet() [8]types.DashaLord { return jyotish.YoginiPlanet }

// CharaRashiYears returns the length in years of each rashi's Chara dasha,
// indexed 0 for Mesha through 11 for Meena. It is also the fixed duration table
// of [Session.ComputeNarayanDasha].
func CharaRashiYears() [12]float64 { return jyotish.CharaRashiYears }

// VishamaPadaRashis reports which rashis are vishama pada (odd footed), indexed
// 0 for Mesha through 11 for Meena: Mesha to Mithuna and Tula to Dhanu. Narayan
// dasha runs forward from a vishama pada lagna and backward otherwise.
func VishamaPadaRashis() [12]bool { return jyotish.VishamaPadaRashis }

// SamaPadaRashis reports which rashis are sama pada (even footed), indexed 0
// for Mesha through 11 for Meena: Karka to Kanya and Makara to Meena. It is the
// complement of [VishamaPadaRashis].
func SamaPadaRashis() [12]bool { return jyotish.SamaPadaRashis }

// AllSahamNames returns all 27 saham (sensitive point) names in the order a
// Varshaphala chart computes them, Punya first.
func AllSahamNames() [types.SahamNameCount]types.SahamName { return jyotish.AllSahamNames }

func deepRule(r types.MuhurtaRule) types.MuhurtaRule {
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

// StockMuhurtaRules returns the thirteen built-in muhurta rules in their
// canonical order, vivah first. Each is a fresh deep copy and is safe to
// modify.
func StockMuhurtaRules() []types.MuhurtaRule {
	all := rules.All()
	for i := range all {
		all[i] = deepRule(all[i])
	}
	return all
}

// MuhurtaRuleFor returns the built-in muhurta rule whose Occasion is occasion,
// as a fresh deep copy. The bool is false when no stock rule uses that key;
// [StockMuhurtaRules] lists them all.
func MuhurtaRuleFor(occasion string) (types.MuhurtaRule, bool) {
	r, ok := rules.Get(occasion)
	if !ok {
		return r, false
	}
	return deepRule(r), true
}

// VivahRule returns the built-in muhurta rule for a wedding (vivah), as a fresh
// deep copy.
func VivahRule() types.MuhurtaRule {
	r, _ := rules.Get("vivah")
	return deepRule(r)
}

// GrihaPraveshRule returns the built-in muhurta rule for a housewarming (griha
// pravesh), as a fresh deep copy.
func GrihaPraveshRule() types.MuhurtaRule {
	r, _ := rules.Get("grihaPravesh")
	return deepRule(r)
}

// NamakaranaRule returns the built-in muhurta rule for a naming ceremony
// (namakarana), as a fresh deep copy.
func NamakaranaRule() types.MuhurtaRule {
	r, _ := rules.Get("namakarana")
	return deepRule(r)
}

// VidyarambhRule returns the built-in muhurta rule for the commencement of
// education (vidyarambh), as a fresh deep copy.
func VidyarambhRule() types.MuhurtaRule {
	r, _ := rules.Get("vidyarambh")
	return deepRule(r)
}

// VahanKharidiRule returns the built-in muhurta rule for a vehicle purchase
// (vahan kharidi), as a fresh deep copy.
func VahanKharidiRule() types.MuhurtaRule {
	r, _ := rules.Get("vahanKharidi")
	return deepRule(r)
}

// AnnaprashanRule returns the stock muhurta rule for annaprashan (first solid
// food). The returned rule is a fresh deep copy, so a caller may modify it
// before passing it to [Session.ScoreMuhurta] or [Session.ComputeAuspiciousDatesInRange].
func AnnaprashanRule() types.MuhurtaRule {
	r, _ := rules.Get("annaprashan")
	return deepRule(r)
}

// MundanRule returns the stock muhurta rule for mundan (first hair-cutting).
// The returned rule is a fresh deep copy, so a caller may modify it before
// passing it to [Session.ScoreMuhurta] or [Session.ComputeAuspiciousDatesInRange].
func MundanRule() types.MuhurtaRule {
	r, _ := rules.Get("mundan")
	return deepRule(r)
}

// UpanayanamRule returns the stock muhurta rule for upanayanam (sacred thread
// ceremony). The returned rule is a fresh deep copy, so a caller may modify it
// before passing it to [Session.ScoreMuhurta] or [Session.ComputeAuspiciousDatesInRange].
func UpanayanamRule() types.MuhurtaRule {
	r, _ := rules.Get("upanayanam")
	return deepRule(r)
}

// KarnavedhaRule returns the stock muhurta rule for karnavedha (ear piercing).
// The returned rule is a fresh deep copy, so a caller may modify it before
// passing it to [Session.ScoreMuhurta] or [Session.ComputeAuspiciousDatesInRange].
func KarnavedhaRule() types.MuhurtaRule {
	r, _ := rules.Get("karnavedha")
	return deepRule(r)
}

// AksharabhyasamRule returns the stock muhurta rule for aksharabhyasam
// (introduction to letters). The returned rule is a fresh deep copy, so a
// caller may modify it before passing it to [Session.ScoreMuhurta] or
// [Session.ComputeAuspiciousDatesInRange].
func AksharabhyasamRule() types.MuhurtaRule {
	r, _ := rules.Get("aksharabhyasam")
	return deepRule(r)
}

// SeemanthamRule returns the stock muhurta rule for seemantham (Vedic baby
// shower). The returned rule is a fresh deep copy, so a caller may modify it
// before passing it to [Session.ScoreMuhurta] or [Session.ComputeAuspiciousDatesInRange].
func SeemanthamRule() types.MuhurtaRule {
	r, _ := rules.Get("seemantham")
	return deepRule(r)
}

// ShopOpeningRule returns the stock muhurta rule for a shop or business
// opening. The returned rule is a fresh deep copy, so a caller may modify it
// before passing it to [Session.ScoreMuhurta] or [Session.ComputeAuspiciousDatesInRange].
func ShopOpeningRule() types.MuhurtaRule {
	r, _ := rules.Get("shopOpening")
	return deepRule(r)
}

// TravelStartRule returns the stock muhurta rule for the start of travel
// (yatra). The returned rule is a fresh deep copy, so a caller may modify it
// before passing it to [Session.ScoreMuhurta] or [Session.ComputeAuspiciousDatesInRange].
func TravelStartRule() types.MuhurtaRule {
	r, _ := rules.Get("travelStart")
	return deepRule(r)
}

// ComputeNarayanDashaVariable returns the twelve Narayan (Chara) rashi
// mahadashas from the lagna, taking each period's length from where that
// rashi's lord sits (0 to 12 years, one added for an exalted lord and one taken
// off for a debilitated one; for Scorpio and Aquarius, which have two lords,
// the stronger one counts, or 12 years when both occupy the rashi itself)
// instead of the fixed table
// [Session.ComputeNarayanDasha] uses. The order runs forward from an odd-footed
// (vishama pada) lagna rashi and backward otherwise, with the first period
// starting at birth. asOf selects the current period and a zero asOf means now;
// CurrentIndex falls back to 0 when asOf lies outside every period. The error
// is non-nil for a birth date outside 1900 to 2100, out of range coordinates,
// or an unrecognised ayanamsa.
func (s *Session) ComputeNarayanDashaVariable(birth time.Time, location types.GeoLocation, ayanamsa types.AyanamsaType, asOf time.Time) (types.NarayanDashaResult, error) {
	return jyotish.ComputeNarayanDashaVariable(s.eph, birth.UnixMilli(), location, ayanamsa, asOfMs(asOf))
}

// AllSections returns a
// [types.SectionSet] that selects every optional section: festivals, eclipse, moon
// times and lunar windows. It is what [Session.GetDailyPanchang] uses when
// types.PanchangOptions.SectionsGiven is false.
func AllSections() types.SectionSet { return core.AllSections() }

// NoSections returns a [types.SectionSet] that selects no optional section, so
// [Session.GetDailyPanchang] skips festivals, eclipse, moon times and lunar
// windows. It takes effect only when types.PanchangOptions.SectionsGiven is true; the zero
// types.SectionSet selects nothing in the same way.
func NoSections() types.SectionSet { return core.NoSections() }

// Sections returns a [types.SectionSet] holding exactly the listed sections and
// nothing else. It takes effect only when types.PanchangOptions.SectionsGiven is true; an
// empty list selects nothing.
func Sections(list ...types.PanchangSection) types.SectionSet { return core.Sections(list...) }

// AllBhadraLocations returns every [types.BhadraLocation], the
// loka a Bhadra (Vishti karana) segment is reckoned to occupy. The returned
// slice is a fresh copy.
func AllBhadraLocations() []types.BhadraLocation {
	return append([]types.BhadraLocation(nil), types.AllBhadraLocations...)
}

// AllBhadraModes returns every [types.BhadraMode], the ways a [types.MuhurtaRule] can treat
// a day on which Bhadra is active. The returned slice is a fresh copy.
func AllBhadraModes() []types.BhadraMode {
	return append([]types.BhadraMode(nil), muhurta.AllBhadraModes...)
}

// AllChandraBalamQualities returns every [types.ChandraBalamQuality], the verdict on
// the house (1 based) that the transit Moon occupies counted from a janma
// rashi. The returned slice is a fresh copy.
func AllChandraBalamQualities() []types.ChandraBalamQuality {
	return append([]types.ChandraBalamQuality(nil), types.AllChandraBalamQualities...)
}

// AllChoghadiyaQualities returns every [types.ChoghadiyaQuality], the quality label
// carried by Choghadiya, Gowri and Do Ghati slots and by Anandadi yoga. The
// returned slice is a fresh copy.
func AllChoghadiyaQualities() []types.ChoghadiyaQuality {
	return append([]types.ChoghadiyaQuality(nil), types.AllChoghadiyaQualities...)
}

// AllDashaLords returns the nine dasha lords in Vimshottari order, beginning
// with Ketu. The returned slice is a fresh copy.
func AllDashaLords() []types.DashaLord {
	return append([]types.DashaLord(nil), types.AllDashaLords[:]...)
}

// AllDayNightSegments returns both [types.DayNightSegment] values: day (sunrise to
// sunset) and night (sunset to the next sunrise), the halves a
// [types.DurMuhurtaPeriod] falls in. The returned slice is a fresh copy.
func AllDayNightSegments() []types.DayNightSegment {
	return append([]types.DayNightSegment(nil), types.AllDayNightSegments...)
}

// AllDignities returns every [types.Dignity] a graha can hold in the rashi it
// occupies, ordered from exalted down to debilitated. The returned slice is a
// fresh copy.
func AllDignities() []types.Dignity { return append([]types.Dignity(nil), types.AllDignities...) }

// AllDivisionals returns the seven divisional (varga) charts that
// [Session.ComputeDivisionalChart] accepts. The returned slice is a fresh copy.
func AllDivisionals() []types.Divisional {
	return append([]types.Divisional(nil), types.AllDivisionals...)
}

// AllEclipseKinds returns both [types.EclipseKind] values, solar and lunar, as
// carried by [types.EclipseInfo]. The returned slice is a fresh copy.
func AllEclipseKinds() []types.EclipseKind {
	return append([]types.EclipseKind(nil), types.AllEclipseKinds...)
}

// AllEclipseSubtypes returns every [types.EclipseSubtype] an [types.EclipseInfo] can carry.
// The returned slice is a fresh copy.
func AllEclipseSubtypes() []types.EclipseSubtype {
	return append([]types.EclipseSubtype(nil), types.AllEclipseSubtypes...)
}

// AllEclipseTableKinds returns both [types.EclipseTableKind] values, solar and lunar,
// as used by entries of an eclipses table built by
// [Session.BuildEclipsesTable]. The returned slice is a fresh copy.
func AllEclipseTableKinds() []types.EclipseTableKind {
	return append([]types.EclipseTableKind(nil), calendar.AllEclipseTableKinds...)
}

// AllEclipseTableSubtypes returns every [types.EclipseTableSubtype] an entry of an
// eclipses table built by [Session.BuildEclipsesTable] can carry. The returned
// slice is a fresh copy.
func AllEclipseTableSubtypes() []types.EclipseTableSubtype {
	return append([]types.EclipseTableSubtype(nil), calendar.AllEclipseTableSubtypes...)
}

// AllFestivalRegions returns every current [types.FestivalRegion], including
// types.RegionAll (no regional filter) and excluding the deprecated aliases returned
// by [AllLegacyFestivalRegions]. The returned slice is a fresh copy.
func AllFestivalRegions() []types.FestivalRegion {
	return append([]types.FestivalRegion(nil), types.AllFestivalRegions...)
}

// AllFestivalTypes returns every [types.FestivalType], the classification carried by
// [types.FestivalInfo]. The returned slice is a fresh copy.
func AllFestivalTypes() []types.FestivalType {
	return append([]types.FestivalType(nil), types.AllFestivalTypes...)
}

// AllFestivalsTableTypes returns the eight categories an entry in a generated
// festivals table can carry (major, minor, the three Ekadashi variants,
// pradosha, sankranti and eclipse).
func AllFestivalsTableTypes() []types.FestivalsTableType {
	return append([]types.FestivalsTableType(nil), calendar.AllFestivalsTableTypes...)
}

// AllGandaMulaSeverities returns the two severities of a Gandamula nakshatra
// affliction, mild and severe.
func AllGandaMulaSeverities() []types.GandaMulaSeverity {
	return append([]types.GandaMulaSeverity(nil), types.AllGandaMulaSeverities...)
}

// AllGrahas returns the nine grahas in canonical order, Sun through Ketu, which
// is also their numeric [types.Graha] order.
func AllGrahas() []types.Graha { return append([]types.Graha(nil), types.AllGrahas[:]...) }

// AllHouseSystems returns the three house systems a bhava chart can be cast in:
// whole sign, equal and Placidus (KP).
func AllHouseSystems() []types.HouseSystem {
	return append([]types.HouseSystem(nil), types.AllHouseSystems...)
}

// AllKaalSarpSubtypes returns the twelve Kaal Sarp subtypes in Rahu house
// order: index i is the subtype for Rahu in house i+1.
func AllKaalSarpSubtypes() []types.KaalSarpSubtype {
	return append([]types.KaalSarpSubtype(nil), types.AllKaalSarpSubtypes[:]...)
}

// AllKarakaNames returns the seven Jaimini chara karaka titles in rank order,
// from types.Atmakaraka (the graha at the highest degree within its rashi) down to
// types.Darakaraka.
func AllKarakaNames() []types.KarakaName {
	return append([]types.KarakaName(nil), types.AllKarakaNames[:]...)
}

// AllKaranaTypes returns the two karana classes, fixed and movable.
func AllKaranaTypes() []types.KaranaType {
	return append([]types.KaranaType(nil), types.AllKaranaTypes...)
}

// AllKootNames returns the eight Ashtakoot koots in scoring order, Varna (1
// point maximum) through Nadi (8).
func AllKootNames() []types.KootName {
	return append([]types.KootName(nil), jyotish.AllKootNames[:]...)
}

// AllLanguages returns the two output languages, types.LanguageEn ("en") and types.LanguageHi
// ("hi").
func AllLanguages() []types.Language { return append([]types.Language(nil), types.AllLanguages...) }

// AllLegacyFestivalRegions returns the three deprecated [types.FestivalRegion] values
// ("tamil", "bengal", "north-india"). They are still accepted as input and
// resolve to "tamil-nadu", "west-bengal" and "all" respectively.
func AllLegacyFestivalRegions() []types.FestivalRegion {
	return append([]types.FestivalRegion(nil), types.AllLegacyFestivalRegions...)
}

// AllMangalDoshaSeverities returns the three Mangal Dosha severities: none,
// anshik (partial) and purna (full).
func AllMangalDoshaSeverities() []types.MangalDoshaSeverity {
	return append([]types.MangalDoshaSeverity(nil), types.AllMangalDoshaSeverities...)
}

// AllMasaSystems returns the two lunar month conventions, purnimanta (the masa
// ends at the full moon) and amanta (it ends at the new moon).
func AllMasaSystems() []types.MasaSystem {
	return append([]types.MasaSystem(nil), types.AllMasaSystems...)
}

// AllMuhurtaFactorAxes returns the eight axes a muhurta scoring factor can come
// from (tithi, nakshatra, vara, karana, yoga, special yoga, vara-tithi yoga and
// exclusion).
func AllMuhurtaFactorAxes() []types.MuhurtaFactorAxis {
	return append([]types.MuhurtaFactorAxis(nil), muhurta.AllMuhurtaFactorAxes...)
}

// AllNodeTypes returns the two lunar node models available for Rahu and Ketu,
// mean and true. An empty types.NodeType is treated as mean.
func AllNodeTypes() []types.NodeType { return append([]types.NodeType(nil), jyotish.AllNodeTypes...) }

// AllPakshas returns the two lunar fortnights, shukla (waxing) and krishna
// (waning).
func AllPakshas() []types.Paksha { return append([]types.Paksha(nil), calendar.AllPakshas...) }

// AllPanchakaTypes returns the six Panchaka classifications: the five doshas
// keyed to the onset weekday, plus samanya, which carries no dosha.
func AllPanchakaTypes() []types.PanchakaType {
	return append([]types.PanchakaType(nil), types.AllPanchakaTypes...)
}

// AllPanchangSections returns the four optional sections a [types.SectionSet] can
// select: festivals, eclipse, moon times and lunar windows.
func AllPanchangSections() []types.PanchangSection {
	return append([]types.PanchangSection(nil), core.AllPanchangSections...)
}

// AllPoruthamNames returns the ten South Indian poruthams in their standard
// order, Dina through Vedha.
func AllPoruthamNames() []types.PoruthamName {
	return append([]types.PoruthamName(nil), jyotish.AllPoruthamNames[:]...)
}

// AllSpecialYogaTypes returns the ten day level special yogas the panchang can
// report, such as Amrit Siddhi and Sarvartha Siddhi.
func AllSpecialYogaTypes() []types.SpecialYogaType {
	return append([]types.SpecialYogaType(nil), types.AllSpecialYogaTypes...)
}

// AllTableLanguages returns the two languages a generated festivals, eclipses
// or moon-phases table can carry, "en" and "hi".
func AllTableLanguages() []types.FestivalsTableLanguage {
	return append([]types.FestivalsTableLanguage(nil), calendar.AllTableLanguages...)
}

// AllTarabalaQualities returns the two Tarabala qualities, auspicious and
// inauspicious.
func AllTarabalaQualities() []types.TarabalaQuality {
	return append([]types.TarabalaQuality(nil), types.AllTarabalaQualities...)
}

// AllVaraTithiYogaTypes returns the seven vara and tithi combination yogas, the
// two auspicious ones (Siddha, Amrita) first and then the five inauspicious
// ones.
func AllVaraTithiYogaTypes() []types.VaraTithiYogaType {
	return append([]types.VaraTithiYogaType(nil), muhurta.AllVaraTithiYogaTypes...)
}

// AllVisibleGrahas returns the seven physical grahas, Sun through Saturn, in
// [types.Graha] order; the nodes Rahu and Ketu are excluded.
func AllVisibleGrahas() []types.VisibleGraha {
	return append([]types.VisibleGraha(nil), types.AllVisibleGrahas[:]...)
}

// AllYogaNames returns the twenty-five birth chart yogas the library detects.
func AllYogaNames() []types.YogaName { return append([]types.YogaName(nil), types.AllYogaNames...) }

// AllYogaTypes returns the eight categories a birth chart yoga is grouped under
// (mahapurusha, lunar, solar, raja, dhana, special, cancellation and negative).
func AllYogaTypes() []types.YogaType { return append([]types.YogaType(nil), types.AllYogaTypes...) }
