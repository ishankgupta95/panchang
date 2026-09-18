package types

// EclipseInfo is one eclipse as the eclipse searches return it
// (GetUpcomingSolarEclipse, GetUpcomingLunarEclipse, GetUpcomingEclipses,
// ComputeEclipsesInRange, ComputeEclipsesForYear and GetEclipseDuringDay in
// the panchang package). Solar contacts, subtype and magnitudes are
// topocentric for the location searched; lunar ones are geocentric. Instants
// are UTC epoch milliseconds that marshal as ISO 8601 UTC strings under the
// keys start, peak, end, sutakStart and sutakEnd. [DailyEclipseInfo] is the
// same data with local strings added.
type EclipseInfo struct {
	// Kind is EclipseSolar or EclipseLunar.
	Kind EclipseKind `json:"kind"`
	// Subtype is partial, annular or total for a solar eclipse, as seen from
	// the location rather than anywhere on Earth; penumbral, partial or
	// total for a lunar one, by umbral magnitude.
	Subtype EclipseSubtype `json:"subtype"`
	// StartMs is first contact in UTC epoch milliseconds: the local partial
	// phase begins for a solar eclipse, the penumbral phase for a lunar one.
	StartMs JSDate `json:"start"`
	// PeakMs is greatest eclipse in UTC epoch milliseconds: least apparent
	// separation, topocentric for solar, geocentric for lunar.
	PeakMs JSDate `json:"peak"`
	// EndMs is last contact in UTC epoch milliseconds: the local partial
	// phase ends for a solar eclipse, the penumbral phase for a lunar one.
	EndMs JSDate `json:"end"`
	// VisibleFromLocation is true when the eclipsed body (Sun or Moon) has a
	// refracted topocentric altitude above 0 degrees at PeakMs. Lunar
	// eclipses are returned whether or not this holds.
	VisibleFromLocation bool `json:"visibleFromLocation"`
	// Obscuration is the fraction of the eclipsed disc's area covered at
	// peak, 0 to 1. For a lunar eclipse it is the umbral cover, so a
	// penumbral eclipse reads 0.
	Obscuration float64 `json:"obscuration"`
	// Magnitude is the fraction of the disc's diameter covered at peak, not
	// capped: above 1 for a total eclipse. For a lunar eclipse it is the
	// umbral magnitude, which is zero or negative for a penumbral one.
	Magnitude float64 `json:"magnitude"`
	// SutakStartMs opens the sutak window: 12 hours before StartMs for a
	// solar eclipse, 9 hours before umbral first contact for a lunar one.
	// nil when there is no umbral phase, that is, a penumbral lunar eclipse.
	SutakStartMs *JSDate `json:"sutakStart"`
	// SutakEndMs closes the sutak window at last contact: EndMs for a solar
	// eclipse, umbral last contact for a lunar one. nil exactly when
	// SutakStartMs is.
	SutakEndMs *JSDate `json:"sutakEnd"`
	// Description is one sentence naming the subtype, kind, obscuration as a
	// rounded percent and the visibility, in the language the search was
	// given; the list methods always produce English.
	Description string `json:"description"`
}

// SyzygyLongitudes supplies the tropical Sun and Moon longitude functions
// that GetEclipseDuringDay in the panchang package uses for its cheap new or
// full moon pre-check. Only the difference is used, so no ayanamsa is
// involved. When either function is nil that method falls back to the
// session's own ephemeris for both. Function fields, so it has no JSON form.
type SyzygyLongitudes struct {
	// TropicalMoon returns the Moon's tropical longitude of date in degrees
	// at ms, a UTC epoch millisecond instant.
	TropicalMoon func(ms int64) float64
	// TropicalSun returns the Sun's tropical longitude of date in degrees at
	// ms, a UTC epoch millisecond instant.
	TropicalSun func(ms int64) float64
}

// MoonPhaseName names one of the four principal lunar phases, the exact
// instants at which the Moon's elongation from the Sun is 0, 90, 180 or 270
// degrees. They are not the tithis of the same name, which are windows of
// about a day.
type MoonPhaseName string

const (
	// MoonPhaseNew is the new moon, elongation 0 degrees.
	MoonPhaseNew MoonPhaseName = "new"
	// MoonPhaseFirstQuarter is elongation 90 degrees.
	MoonPhaseFirstQuarter MoonPhaseName = "first_quarter"
	// MoonPhaseFull is the full moon, elongation 180 degrees.
	MoonPhaseFull MoonPhaseName = "full"
	// MoonPhaseLastQuarter is elongation 270 degrees.
	MoonPhaseLastQuarter MoonPhaseName = "last_quarter"
)

// MoonPhaseEvent is one principal phase instant, as ComputeMoonPhasesInRange
// and ComputeMoonPhasesForYear in the panchang package return them, in time
// order.
type MoonPhaseEvent struct {
	// Phase is which of the four principal phases this instant is.
	Phase MoonPhaseName `json:"phase"`
	// TimeMs is the phase instant in UTC epoch milliseconds, the same for
	// every location. It marshals as an ISO 8601 UTC string under "time".
	TimeMs JSDate `json:"time"`
}

// MoonPhasesForYearOptions bounds ComputeMoonPhasesForYear in the panchang
// package to one calendar year.
type MoonPhasesForYearOptions struct {
	// Timezone fixes the year's local boundaries and is required: unset is
	// an ErrInvalidTimezone error, an unknown zone name
	// ErrTimezoneResolutionFailed. A named zone's offset is sampled on July
	// 1 of the year and applied to both boundaries.
	Timezone Timezone `json:"timezone"`
}
