package jyotish

import (
	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
)

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
