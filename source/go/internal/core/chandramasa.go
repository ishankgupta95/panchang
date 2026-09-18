package core

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

type BoundsAt func(refMs int64) (astronomy.NewMoonBounds, error)

func ComputeChandraMasa(
	siderealSun, siderealMoon float64,
	nameFn func(index int, isAdhika bool) string,
	system types.MasaSystem,
	refDateMs int64,
	getSiderealSun LongitudeAt,
	getBounds BoundsAt,
) (types.ChandraMasaInfo, error) {
	elongation := jsnum.Mod((siderealMoon-siderealSun)+360, 360)

	bounds, err := getBounds(refDateMs)
	if err != nil {
		return types.ChandraMasaInfo{}, err
	}
	sunAtPrevNewMoon := jsnum.Mod(jsnum.Mod(getSiderealSun(bounds.PrevMs), 360)+360, 360)
	sunAtNextNewMoon := jsnum.Mod(jsnum.Mod(getSiderealSun(bounds.NextMs), 360)+360, 360)
	solarMonthAtPrev := int(math.Floor(sunAtPrevNewMoon / 30))
	solarMonthAtNext := int(math.Floor(sunAtNextNewMoon / 30))

	isAdhika := solarMonthAtPrev == solarMonthAtNext

	amantaIndex := (solarMonthAtPrev + 1) % 12
	amantaName := nameFn(amantaIndex, isAdhika)

	isKrishnaPaksha := elongation >= 180
	purnimantaIndex := amantaIndex
	if isKrishnaPaksha && !isAdhika {
		purnimantaIndex = (amantaIndex + 1) % 12
	}
	purnimantaName := nameFn(purnimantaIndex, isAdhika)

	index, name := purnimantaIndex, purnimantaName
	if system == types.Amanta {
		index, name = amantaIndex, amantaName
	}

	return types.ChandraMasaInfo{
		Index:           index,
		Name:            name,
		IsAdhika:        isAdhika,
		System:          system,
		AmantaIndex:     amantaIndex,
		AmantaName:      amantaName,
		PurnimantaIndex: purnimantaIndex,
		PurnimantaName:  purnimantaName,
	}, nil
}
