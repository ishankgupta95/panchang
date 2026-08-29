package types

import "fmt"

// Branch on the code, not the message: only the code is stable across releases.
type ErrorCode string

const (
	ErrInvalidLatitude          ErrorCode = "INVALID_LATITUDE"
	ErrInvalidLongitude         ErrorCode = "INVALID_LONGITUDE"
	ErrInvalidElevation         ErrorCode = "INVALID_ELEVATION"
	ErrInvalidDate              ErrorCode = "INVALID_DATE"
	ErrInvalidTimezone          ErrorCode = "INVALID_TIMEZONE"
	ErrInvalidAyanamsa          ErrorCode = "INVALID_AYANAMSA"
	ErrInvalidInput             ErrorCode = "INVALID_INPUT"
	ErrTimezoneResolutionFailed ErrorCode = "TIMEZONE_RESOLUTION_FAILED"
	ErrNoSunrise                ErrorCode = "NO_SUNRISE"
	ErrNoSunset                 ErrorCode = "NO_SUNSET"
	ErrSearchDiverged           ErrorCode = "SEARCH_DIVERGED"
	ErrCircumpolar              ErrorCode = "CIRCUMPOLAR"
	ErrPlacidusDiverged         ErrorCode = "PLACIDUS_DIVERGED"
	ErrSahamDependencyError     ErrorCode = "SAHAM_DEPENDENCY_ERROR"
)

var AllErrorCodes = []ErrorCode{
	ErrInvalidLatitude, ErrInvalidLongitude, ErrInvalidElevation, ErrInvalidDate,
	ErrInvalidTimezone, ErrInvalidAyanamsa, ErrInvalidInput, ErrTimezoneResolutionFailed,
	ErrNoSunrise, ErrNoSunset, ErrSearchDiverged, ErrCircumpolar,
	ErrPlacidusDiverged, ErrSahamDependencyError,
}

type PanchangError struct {
	Code ErrorCode
	msg  string
}

func NewPanchangError(message string, code ErrorCode) *PanchangError {
	return &PanchangError{Code: code, msg: message}
}

func (e *PanchangError) Error() string { return e.msg }

func (e *PanchangError) Is(target error) bool {
	t, ok := target.(*PanchangError)
	return ok && t.Code == e.Code
}

var (
	ErrNoSunriseSentinel        = &PanchangError{Code: ErrNoSunrise, msg: "no sunrise"}
	ErrNoSunsetSentinel         = &PanchangError{Code: ErrNoSunset, msg: "no sunset"}
	ErrCircumpolarSentinel      = &PanchangError{Code: ErrCircumpolar, msg: "circumpolar"}
	ErrPlacidusDivergedSentinel = &PanchangError{Code: ErrPlacidusDiverged, msg: "placidus diverged"}
)

func Codef(code ErrorCode, format string, args ...any) *PanchangError {
	return &PanchangError{Code: code, msg: fmt.Sprintf(format, args...)}
}
