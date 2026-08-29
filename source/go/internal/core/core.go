package core

import (
	"errors"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

type LongitudeAt func(ms int64) float64

type NatalResolvers struct {
	ChandraBalam func(janmaRashiIndex, transitMoonRashiIndex int, lang types.Language) (types.ChandraBalamInfo, error)
	Tarabala     func(janmaNakshatraIndex, transitNakshatraIndex int, lang types.Language) (types.TarabalaInfo, error)
}

var (
	errMissingChandraBalam = errors.New(
		"core: options.janmaRashi is set but NatalResolvers.ChandraBalam is nil")
	errMissingTarabala = errors.New(
		"core: options.janmaNakshatra is set but NatalResolvers.Tarabala is nil")
)
