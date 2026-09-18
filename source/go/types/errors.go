package types

import "fmt"

// ErrorCode is the stable identifier a [PanchangError] carries. The fourteen
// values are the Err constants below, spelled exactly as the TypeScript
// PanchangErrorCode union. Branch on the code, never on the message text. It
// is a plain string, so JSON emits it as is.
type ErrorCode string

const (
	// ErrInvalidLatitude: latitude is NaN, infinite or outside -90 to 90
	// degrees.
	ErrInvalidLatitude ErrorCode = "INVALID_LATITUDE"
	// ErrInvalidLongitude: longitude is NaN, infinite or outside -180 to 180
	// degrees.
	ErrInvalidLongitude ErrorCode = "INVALID_LONGITUDE"
	// ErrInvalidElevation: elevation is NaN, infinite or below -500 metres.
	ErrInvalidElevation ErrorCode = "INVALID_ELEVATION"
	// ErrInvalidDate: the instant's UTC year is outside 1900 to 2100.
	ErrInvalidDate ErrorCode = "INVALID_DATE"
	// ErrInvalidTimezone: the Timezone is unset, or its offset is not an
	// integer or lies outside -720 to 840 minutes.
	ErrInvalidTimezone ErrorCode = "INVALID_TIMEZONE"
	// ErrInvalidAyanamsa: the AyanamsaType is not one of the supported
	// values.
	ErrInvalidAyanamsa ErrorCode = "INVALID_AYANAMSA"
	// ErrInvalidInput: any other bad argument, such as an index out of
	// range, an unknown name or an argument the operation cannot use.
	ErrInvalidInput ErrorCode = "INVALID_INPUT"
	// ErrTimezoneResolutionFailed: a named Timezone the host's zone
	// database cannot load.
	ErrTimezoneResolutionFailed ErrorCode = "TIMEZONE_RESOLUTION_FAILED"
	// ErrNoSunrise: no sunrise within the search window, as under midnight
	// sun or polar night.
	ErrNoSunrise ErrorCode = "NO_SUNRISE"
	// ErrNoSunset: no sunset within the search window.
	ErrNoSunset ErrorCode = "NO_SUNSET"
	// ErrSearchDiverged: a root search did not converge: an anga transition
	// within 48 hours, a lunar quarter within 12 days, or a bounding new
	// moon.
	ErrSearchDiverged ErrorCode = "SEARCH_DIVERGED"
	// ErrCircumpolar: a HouseSystemPlacidusKP cusp is undefined at the
	// latitude; HouseSystemWholeSign and HouseSystemEqual still work
	// there.
	ErrCircumpolar ErrorCode = "CIRCUMPOLAR"
	// ErrPlacidusDiverged: the iteration for a Placidus cusp did not
	// converge.
	ErrPlacidusDiverged ErrorCode = "PLACIDUS_DIVERGED"
	// ErrSahamDependencyError: a Varshaphala saham formula used the Punya
	// saham before Punya itself had been computed.
	ErrSahamDependencyError ErrorCode = "SAHAM_DEPENDENCY_ERROR"
)

// AllErrorCodes lists every ErrorCode in declaration order, for
// exhaustiveness checks. It is the package's own slice, not a copy, so
// callers must not modify it.
var AllErrorCodes = []ErrorCode{
	ErrInvalidLatitude, ErrInvalidLongitude, ErrInvalidElevation, ErrInvalidDate,
	ErrInvalidTimezone, ErrInvalidAyanamsa, ErrInvalidInput, ErrTimezoneResolutionFailed,
	ErrNoSunrise, ErrNoSunset, ErrSearchDiverged, ErrCircumpolar,
	ErrPlacidusDiverged, ErrSahamDependencyError,
}

// PanchangError is the error every operation returns for bad input or a
// numerical search that did not converge. Match it by code: errors.Is
// against a *PanchangError compares codes only (see [PanchangError.Is]), and
// errors.As exposes [PanchangError.Code]. The message is not part of the API
// and may change between releases. encoding/json sees only Code, since the
// message field is unexported.
type PanchangError struct {
	// Code identifies the failure; see the Err constants.
	Code ErrorCode
	msg  string
}

// NewPanchangError returns a *PanchangError carrying message and code, in
// the argument order of the TypeScript constructor.
func NewPanchangError(message string, code ErrorCode) *PanchangError {
	return &PanchangError{Code: code, msg: message}
}

// Error returns the message the error was built with.
func (e *PanchangError) Error() string { return e.msg }

// Is reports whether target is a *PanchangError with the same Code; the
// message is not compared. errors.Is(err, &PanchangError{Code: X}) therefore
// matches every error carrying code X, as do the Sentinel variables below.
func (e *PanchangError) Is(target error) bool {
	t, ok := target.(*PanchangError)
	return ok && t.Code == e.Code
}

var (
	// ErrNoSunriseSentinel is an errors.Is target for ErrNoSunrise.
	// Operations never return the sentinel itself; they return a fresh error
	// whose message names the location and search window.
	ErrNoSunriseSentinel = &PanchangError{Code: ErrNoSunrise, msg: "no sunrise"}
	// ErrNoSunsetSentinel is an errors.Is target for ErrNoSunset; see
	// ErrNoSunriseSentinel.
	ErrNoSunsetSentinel = &PanchangError{Code: ErrNoSunset, msg: "no sunset"}
	// ErrCircumpolarSentinel is an errors.Is target for ErrCircumpolar.
	// Operations never return the sentinel itself; they return a fresh error
	// naming the cusp and latitude.
	ErrCircumpolarSentinel = &PanchangError{Code: ErrCircumpolar, msg: "circumpolar"}
	// ErrPlacidusDivergedSentinel is an errors.Is target for
	// ErrPlacidusDiverged. Operations never return the sentinel itself; they
	// return a fresh error naming the cusp.
	ErrPlacidusDivergedSentinel = &PanchangError{Code: ErrPlacidusDiverged, msg: "placidus diverged"}
)

// Codef returns a *PanchangError carrying code and a message formatted by
// fmt.Sprintf.
func Codef(code ErrorCode, format string, args ...any) *PanchangError {
	return &PanchangError{Code: code, msg: fmt.Sprintf(format, args...)}
}
