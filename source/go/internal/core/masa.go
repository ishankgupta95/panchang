package core

import (
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

func ComputeMasa(siderealSunLon float64, nameResolver func(index int) string) types.MasaInfo {
	index := int(math.Floor(siderealSunLon / 30))
	return types.MasaInfo{
		Index: index,
		Name:  nameResolver(index),
	}
}
