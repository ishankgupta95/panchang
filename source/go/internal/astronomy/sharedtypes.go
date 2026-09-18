package astronomy

import "github.com/ishankgupta95/panchang/source/go/v5/types"

// These types are declared in the shared types package so that a caller can
// import them and their fields and methods render in the documentation. The
// aliases here keep this package's own references spelled unqualified.

type (
	EclipseInfo              = types.EclipseInfo
	SyzygyLongitudes         = types.SyzygyLongitudes
	MoonPhaseName            = types.MoonPhaseName
	MoonPhaseEvent           = types.MoonPhaseEvent
	MoonPhasesForYearOptions = types.MoonPhasesForYearOptions
)

const (
	MoonPhaseNew          = types.MoonPhaseNew
	MoonPhaseFirstQuarter = types.MoonPhaseFirstQuarter
	MoonPhaseFull         = types.MoonPhaseFull
	MoonPhaseLastQuarter  = types.MoonPhaseLastQuarter
)
