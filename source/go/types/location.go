package types

// GeoLocation is an observer position: decimal degrees, north and east
// positive, and metres above sea level. It is validated where it is used: a
// latitude outside -90 to 90, a longitude outside -180 to 180, an elevation
// below -500 or any NaN or infinite value is an error (ErrInvalidLatitude,
// ErrInvalidLongitude, ErrInvalidElevation). The zero value passes
// validation as 0 N, 0 E.
type GeoLocation struct {
	// Latitude is geographic latitude in decimal degrees, north positive,
	// -90 to 90.
	Latitude float64 `json:"latitude"`
	// Longitude is decimal degrees east of Greenwich, -180 to 180, west
	// negative.
	Longitude float64 `json:"longitude"`
	// Elevation is metres above sea level, at least -500; 0 when unknown. It
	// raises the observer in topocentric altitudes and in rise and set
	// searches, and is omitted from JSON when 0.
	Elevation float64 `json:"elevation,omitempty"`
}
