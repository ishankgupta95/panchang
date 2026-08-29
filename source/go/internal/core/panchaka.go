package core

import (
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

// Panchaka runs from Dhanishtha's 3rd pada to the end of the zodiac: the last 5 nakshatras.
const panchakaStartDeg = 300

func ComputePanchaka(siderealMoon float64) bool {
	return siderealMoon >= panchakaStartDeg
}

var panchakaTypeByOnsetVara = [7]types.PanchakaType{
	types.PanchakaRoga,    // 0 Sunday:    illness
	types.PanchakaRaja,    // 1 Monday:    royalty
	types.PanchakaAgni,    // 2 Tuesday:   fire
	types.PanchakaSamanya, // 3 Wednesday: unnamed by the sources; no dosha
	types.PanchakaSamanya, // 4 Thursday:  unnamed by the sources; no dosha
	types.PanchakaChora,   // 5 Friday:    theft
	types.PanchakaMrityu,  // 6 Saturday:  death
}

func ClassifyPanchaka(onsetVaraIndex int) (types.PanchakaType, error) {
	if err := utils.AssertVaraIndex(onsetVaraIndex, "onsetVaraIndex"); err != nil {
		return "", err
	}
	return panchakaTypeByOnsetVara[onsetVaraIndex], nil
}

func IsPanchakaDosha(t types.PanchakaType) bool {
	return t != types.PanchakaSamanya
}

// At ~13.2°/day the 60° span takes ~4.5 days, so a week back is always outside it.
func FindPanchakaOnset(referenceUtcMs int64, getMoon LongitudeAt) (int64, bool) {
	if !ComputePanchaka(getMoon(referenceUtcMs)) {
		return 0, false
	}

	hiMs := referenceUtcMs
	loMs := hiMs - 7*86_400_000
	if ComputePanchaka(getMoon(loMs)) {
		return 0, false
	}

	return utils.SolveAngleCrossing(float64(loMs), float64(hiMs), panchakaStartDeg, getMoon,
		func(m int64) bool { return !ComputePanchaka(getMoon(m)) })
}
