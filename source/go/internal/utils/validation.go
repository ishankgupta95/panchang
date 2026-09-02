package utils

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
)

func ValidateLocation(location types.GeoLocation) error {
	if math.IsNaN(location.Latitude) || math.IsInf(location.Latitude, 0) ||
		location.Latitude < -90 || location.Latitude > 90 {
		return types.Codef(types.ErrInvalidLatitude,
			"Latitude must be a finite number between -90 and 90, got %s",
			jsString(location.Latitude))
	}
	if math.IsNaN(location.Longitude) || math.IsInf(location.Longitude, 0) ||
		location.Longitude < -180 || location.Longitude > 180 {
		return types.Codef(types.ErrInvalidLongitude,
			"Longitude must be a finite number between -180 and 180, got %s",
			jsString(location.Longitude))
	}
	if math.IsNaN(location.Elevation) || math.IsInf(location.Elevation, 0) ||
		location.Elevation < -500 {
		return types.Codef(types.ErrInvalidElevation,
			"Elevation must be >= -500 meters, got %s", jsString(location.Elevation))
	}
	return nil
}

func ValidateDate(ms int64) error {
	year := utcYear(ms)
	if year < 1900 || year > 2100 {
		return types.Codef(types.ErrInvalidDate,
			"Date must be between 1900 and 2100 for astronomical accuracy, got year %d", year)
	}
	return nil
}

func assertCyclicIndex(value, modulus int, name string) error {
	if value < 0 || value >= modulus {
		return types.Codef(types.ErrInvalidInput,
			"%s must be integer in [0, %d], got %d", name, modulus-1, value)
	}
	return nil
}

func AssertNakshatraIndex(value int, name string) error {
	return assertCyclicIndex(value, TotalNakshatras, defaultName(name, "nakshatra index"))
}

func AssertVaraIndex(value int, name string) error {
	return assertCyclicIndex(value, 7, defaultName(name, "vara index"))
}

func AssertTithiIndex(value int, name string) error {
	return assertCyclicIndex(value, TotalTithis, defaultName(name, "tithi index"))
}

func defaultName(given, fallback string) string {
	if given == "" {
		return fallback
	}
	return given
}
