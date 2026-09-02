package jyotish

import (
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

var dayGulikaSlot = utils.GulikaSlots

var nightGulikaSlot = [7]int{2, 1, 0, 6, 5, 4, 3}

const (
	dhumaOffsetDeg   float64 = 133 + 20.0/60
	upaketuOffsetDeg float64 = 16 + 40.0/60
)

func ComputeUpagrahas(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	options BirthChartOptions,
) (types.Upagrahas, error) {
	if err := utils.ValidateDate(birthMs); err != nil {
		return types.Upagrahas{}, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return types.Upagrahas{}, err
	}

	ayanamsaType := resolveAyanamsa(options.Ayanamsa)
	lang := resolveLang(options.Language)

	natalLagna, err := ComputeLagna(ctx, birthMs, location, ayanamsaType, lang)
	if err != nil {
		return types.Upagrahas{}, err
	}
	natalLagnaRashi := natalLagna.Rashi.Index

	sunLon, err := astronomy.GetSiderealSunLongitude(ctx, birthMs, ayanamsaType)
	if err != nil {
		return types.Upagrahas{}, err
	}

	seg, err := locateGulikaSegment(ctx, birthMs, location)
	if err != nil {
		return types.Upagrahas{}, err
	}
	gulika, err := ComputeLagna(ctx, seg.Start, location, ayanamsaType, lang)
	if err != nil {
		return types.Upagrahas{}, err
	}
	mandi, err := ComputeLagna(ctx, seg.Midpoint, location, ayanamsaType, lang)
	if err != nil {
		return types.Upagrahas{}, err
	}

	dhuma := utils.Normalize360(sunLon + dhumaOffsetDeg)
	vyatipata := utils.Normalize360(360 - dhuma)
	parivesha := utils.Normalize360(vyatipata + 180)
	indrachapa := utils.Normalize360(360 - parivesha)
	upaketu := utils.Normalize360(indrachapa + upaketuOffsetDeg)

	return types.Upagrahas{
		Gulika:     makeUpagrahaPos(gulika.SiderealLongitude, natalLagnaRashi, lang),
		Mandi:      makeUpagrahaPos(mandi.SiderealLongitude, natalLagnaRashi, lang),
		Dhuma:      makeUpagrahaPos(dhuma, natalLagnaRashi, lang),
		Vyatipata:  makeUpagrahaPos(vyatipata, natalLagnaRashi, lang),
		Parivesha:  makeUpagrahaPos(parivesha, natalLagnaRashi, lang),
		Indrachapa: makeUpagrahaPos(indrachapa, natalLagnaRashi, lang),
		Upaketu:    makeUpagrahaPos(upaketu, natalLagnaRashi, lang),
	}, nil
}

func makeUpagrahaPos(longitude float64, natalLagnaRashi int, lang types.Language) types.UpagrahaPosition {
	lon := utils.Normalize360(longitude)
	rashi := int(math.Floor(lon / 30))
	return types.UpagrahaPosition{
		Longitude: lon,
		Rashi:     rashi,
		RashiName: i18n.ResolveMasaName(rashi, lang),
		House:     ((rashi-natalLagnaRashi+12)%12 + 1),
	}
}

type GulikaSegment struct {
	Start    int64
	Midpoint int64
}

func locateGulikaSegment(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
) (GulikaSegment, error) {
	baseSunrise, err := findSunriseBeforeBirth(ctx, birthMs, location)
	if err != nil {
		return GulikaSegment{}, err
	}
	varaIndex := types.Date(int64(float64(baseSunrise) +
		float64((location.Longitude/15)*3600_000))).UTCDay()

	baseSunset, err := astronomy.ComputeSunset(ctx, baseSunrise, location, astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return GulikaSegment{}, err
	}
	day := birthMs < baseSunset

	var segStart, segEnd int64

	if day {
		sunrise := baseSunrise
		sunset := baseSunset
		dayMs := sunset - sunrise
		segLen := float64(dayMs) / 8
		slot := dayGulikaSlot[varaIndex]
		segStart = int64(float64(sunrise) + float64(float64(slot)*segLen))
		segEnd = int64(float64(segStart) + segLen)
	} else {
		priorSunset := baseSunset
		segmentSunset := priorSunset
		segmentNextSunrise, err := astronomy.ComputeSunrise(ctx, segmentSunset+60_000, location, astronomy.DefaultRiseSetLimitDays)
		if err != nil {
			return GulikaSegment{}, err
		}

		nightMs := segmentNextSunrise - segmentSunset
		segLen := float64(nightMs) / 8
		slot := nightGulikaSlot[varaIndex]
		segStart = int64(float64(segmentSunset) + float64(float64(slot)*segLen))
		segEnd = int64(float64(segStart) + segLen)
	}

	midpoint := (segStart + segEnd) / 2
	return GulikaSegment{Start: segStart, Midpoint: midpoint}, nil
}

func LocateGulikaSegmentForTest(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
) (GulikaSegment, error) {
	return locateGulikaSegment(ctx, birthMs, location)
}

func findSunriseBeforeBirth(ctx *astronomy.EphemerisCtx, ms int64, location types.GeoLocation) (int64, error) {
	back30h := ms - 30*3600_000
	candidate, err := astronomy.ComputeSunrise(ctx, back30h, location, astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return 0, err
	}
	for i := 0; i < 4; i++ {
		lookAhead := candidate + 22*3600_000
		next, err := astronomy.ComputeSunrise(ctx, lookAhead, location, astronomy.DefaultRiseSetLimitDays)
		if err != nil {
			return 0, err
		}
		if next > ms {
			return candidate, nil
		}
		candidate = next
	}
	return candidate, nil
}
