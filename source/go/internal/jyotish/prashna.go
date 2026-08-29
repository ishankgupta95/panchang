package jyotish

import (
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

// Defaults to the KP conventions of *Prasna Marga* / KP Reader VI.
func ComputePrashnaChart(
	ctx *astronomy.EphemerisCtx,
	questionMomentMs int64,
	location types.GeoLocation,
	options BirthChartOptions,
) (types.BirthChart, error) {
	prashnaOptions := options
	if prashnaOptions.HouseSystem == "" {
		prashnaOptions.HouseSystem = types.HouseSystemPlacidusKP
	}
	if prashnaOptions.Ayanamsa == "" {
		prashnaOptions.Ayanamsa = types.Krishnamurti
	}
	return ComputeRashiChart(ctx, questionMomentMs, location, prashnaOptions)
}
