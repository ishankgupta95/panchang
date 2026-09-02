package jyotish

import "github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"

type Dignity string

const (
	DignityExalted      Dignity = "exalted"
	DignityMoolatrikona Dignity = "moolatrikona"
	DignityOwn          Dignity = "own"
	DignityFriend       Dignity = "friend"
	DignityNeutral      Dignity = "neutral"
	DignityEnemy        Dignity = "enemy"
	DignityDebilitated  Dignity = "debilitated"
)

var AllDignities = []Dignity{
	DignityExalted, DignityMoolatrikona, DignityOwn, DignityFriend,
	DignityNeutral, DignityEnemy, DignityDebilitated,
}

const noRashi = -1 // a zero would read as Mesha

var exaltation = [types.GrahaCount]int{
	types.GrahaSun:     0,
	types.GrahaMoon:    1,
	types.GrahaMars:    9,
	types.GrahaMercury: 5,
	types.GrahaJupiter: 3,
	types.GrahaVenus:   11,
	types.GrahaSaturn:  6,
	types.GrahaRahu:    1, // some traditions: Gemini
	types.GrahaKetu:    7, // some traditions: Sagittarius
}

var debilitation = [types.GrahaCount]int{
	types.GrahaSun:     6,
	types.GrahaMoon:    7,
	types.GrahaMars:    3,
	types.GrahaMercury: 11,
	types.GrahaJupiter: 9,
	types.GrahaVenus:   5,
	types.GrahaSaturn:  0,
	types.GrahaRahu:    7,
	types.GrahaKetu:    1,
}

var moolatrikona = [types.GrahaCount]int{
	types.GrahaSun:     4,
	types.GrahaMoon:    1,
	types.GrahaMars:    0,
	types.GrahaMercury: 5,
	types.GrahaJupiter: 8,
	types.GrahaVenus:   6,
	types.GrahaSaturn:  10,
	types.GrahaRahu:    noRashi,
	types.GrahaKetu:    noRashi,
}

var ownRashis = [types.GrahaCount][]int{
	types.GrahaSun:     {4},
	types.GrahaMoon:    {3},
	types.GrahaMars:    {0, 7},
	types.GrahaMercury: {2, 5},
	types.GrahaJupiter: {8, 11},
	types.GrahaVenus:   {1, 6},
	types.GrahaSaturn:  {9, 10},
	types.GrahaRahu:    {}, // the nodes rule no sign
	types.GrahaKetu:    {},
}

func ComputeDignity(graha types.Graha, rashi int) (Dignity, error) {
	if rashi < 0 || rashi >= 12 {
		return "", types.NewPanchangError(
			"rashi must be integer in [0, 11], got "+itoa(rashi), types.ErrInvalidInput)
	}
	if !graha.Valid() {
		return "", types.NewPanchangError(
			"graha out of range: "+itoa(int(graha)), types.ErrInvalidInput)
	}

	if exaltation[graha] == rashi {
		return DignityExalted, nil
	}
	if debilitation[graha] == rashi {
		return DignityDebilitated, nil
	}
	if moolatrikona[graha] == rashi {
		return DignityMoolatrikona, nil
	}
	for _, r := range ownRashis[graha] {
		if r == rashi {
			return DignityOwn, nil
		}
	}

	self, ok := graha.Visible() // Rahu/Ketu have no row in the 7-planet Naisargika table
	if !ok {
		return DignityNeutral, nil
	}

	lord := RashiLord[rashi]
	if self == lord {
		return DignityOwn, nil
	}
	switch NaisargikaMaitri[self][lord] {
	case 1:
		return DignityFriend, nil
	case -1:
		return DignityEnemy, nil
	}
	return DignityNeutral, nil
}
