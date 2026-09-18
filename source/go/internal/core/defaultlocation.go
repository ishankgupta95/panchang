package core

import (
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

func TraditionalReference() types.GeoLocation {
	return types.GeoLocation{Latitude: 23.1765, Longitude: 75.7885, Elevation: 0}
}

func ModernReference() types.GeoLocation {
	return types.GeoLocation{Latitude: 23.1833, Longitude: 82.5, Elevation: 0}
}

func ReferenceLocation(mode Reference) (types.GeoLocation, error) {
	switch mode {
	case ReferenceTraditional:
		return TraditionalReference(), nil
	case ReferenceModern:
		return ModernReference(), nil
	default:
		return types.GeoLocation{}, types.Codef(types.ErrInvalidInput,
			"Reference mode must be %q or %q, got %q", ReferenceTraditional, ReferenceModern, mode)
	}
}

func ResolveLocation(loc *types.GeoLocation, mode Reference) (types.GeoLocation, Reference, error) {
	if loc == nil {
		ref, err := ReferenceLocation(mode)
		if err != nil {
			return types.GeoLocation{}, "", err
		}
		return ref, mode, nil
	}
	if err := utils.ValidateLocation(*loc); err != nil {
		return types.GeoLocation{}, "", err
	}
	return *loc, ReferencePractical, nil
}
