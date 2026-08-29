package jyotish

import (
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

var mangalHouses = [13]bool{1: true, 2: true, 4: true, 7: true, 8: true, 12: true}

var marsOwnRashis = [12]bool{0: true, 7: true}

const marsExaltedRashi = 9

// House numbers land in published strings: jsnum.FormatInt, never strconv.
func ComputeMangalDosha(chart *types.BirthChart) types.MangalDoshaInfo {
	mars := chart.ByPlanet.Mars
	moon := chart.ByPlanet.Moon
	venus := chart.ByPlanet.Venus
	jupiter := chart.ByPlanet.Jupiter

	marsRashi := mars.Rashi.Index
	houseFrom := func(refRashi int) int {
		return ((marsRashi-refRashi+12)%12 + 1)
	}

	fromLagnaHouse := houseFrom(chart.Lagna.Rashi.Index)
	fromMoonHouse := houseFrom(moon.Rashi.Index)
	fromVenusHouse := houseFrom(venus.Rashi.Index)

	fromLagnaAfflicted := mangalHouses[fromLagnaHouse]
	fromMoonAfflicted := mangalHouses[fromMoonHouse]
	fromVenusAfflicted := mangalHouses[fromVenusHouse]

	flaggedCount := 0
	for _, f := range []bool{fromLagnaAfflicted, fromMoonAfflicted, fromVenusAfflicted} {
		if f {
			flaggedCount++
		}
	}
	severity := types.MangalAnshik
	switch flaggedCount {
	case 0:
		severity = types.MangalNone
	case 3:
		severity = types.MangalPurna
	}

	afflicted := flaggedCount > 0
	cancellations := make([]string, 0, 5) // non-nil: JS writes []

	if afflicted {
		if marsRashi < len(marsOwnRashis) && marsOwnRashis[marsRashi] {
			sign := "Scorpio"
			if marsRashi == 0 {
				sign = "Aries"
			}
			cancellations = append(cancellations, "Mars in own sign "+sign)
			afflicted = false
		} else if marsRashi == marsExaltedRashi {
			cancellations = append(cancellations, "Mars exalted in Capricorn")
			afflicted = false
		}

		if mars.House == jupiter.House {
			cancellations = append(cancellations,
				"Mars conjunct Jupiter in house "+jsnum.FormatInt(int64(mars.House)))
			afflicted = false
		}
		if mars.House == moon.House {
			cancellations = append(cancellations,
				"Mars conjunct Moon in house "+jsnum.FormatInt(int64(mars.House)))
			afflicted = false
		}
		if mars.House == venus.House {
			cancellations = append(cancellations,
				"Mars conjunct Venus in house "+jsnum.FormatInt(int64(mars.House)))
			afflicted = false
		}

		// Jupiter's whole-sign aspects fall on the 5th, 7th and 9th rashis from it.
		marsFromJupiter := ((marsRashi-jupiter.Rashi.Index+12)%12 + 1)
		if marsFromJupiter == 5 || marsFromJupiter == 7 || marsFromJupiter == 9 {
			cancellations = append(cancellations,
				"Mars aspected by Jupiter ("+jsnum.FormatInt(int64(marsFromJupiter))+"th aspect)")
			afflicted = false
		}
	}

	return types.MangalDoshaInfo{
		Afflicted:     afflicted,
		Severity:      severity,
		FromLagna:     types.MangalReference{Afflicted: fromLagnaAfflicted, House: fromLagnaHouse},
		FromMoon:      types.MangalReference{Afflicted: fromMoonAfflicted, House: fromMoonHouse},
		FromVenus:     types.MangalReference{Afflicted: fromVenusAfflicted, House: fromVenusHouse},
		Cancellations: cancellations,
	}
}

func ComputeMangalCompatibility(boyChart, girlChart *types.BirthChart) types.MangalCompatibility {
	boy := ComputeMangalDosha(boyChart)
	girl := ComputeMangalDosha(girlChart)
	cancellations := make([]string, 0, 1)

	var afflicted bool
	var description string

	switch {
	case boy.Afflicted && girl.Afflicted:
		afflicted = false
		cancellations = append(cancellations, "both natives Manglik, mutual cancellation")
		description = "both natives Manglik (" + string(boy.Severity) + " / " +
			string(girl.Severity) + "), mutually cancelled"
	case boy.Afflicted || girl.Afflicted:
		afflicted = true
		which := "girl"
		severity := girl.Severity
		if boy.Afflicted {
			which = "boy"
			severity = boy.Severity
		}
		description = "only the " + which + " is Manglik (" + string(severity) + "), dosha stands"
	default:
		afflicted = false
		description = "neither native is Manglik"
	}

	return types.MangalCompatibility{
		Boy: boy, Girl: girl, Afflicted: afflicted,
		Cancellations: cancellations, Description: description,
	}
}

// Partial (one graha outside the arc) is informational; the reference almanac lists no partial Kaal Sarpa.
func ComputeKaalSarp(chart *types.BirthChart) types.KaalSarpDoshaInfo {
	rahu := chart.ByPlanet.Rahu
	ketu := chart.ByPlanet.Ketu

	rahuLon := rahu.Longitude
	inForward, inBackward, total := 0, 0, 0
	for _, p := range chart.Planets {
		if _, ok := p.Planet.Visible(); !ok {
			continue // the nodes bound the arc, not in it
		}
		total++
		d := jsnum.Mod(jsnum.Mod(p.Longitude-rahuLon, 360)+360, 360) // jsnum.Mod, not %; double mod deliberate
		// 0 and 180 are conjunct a node, so in neither arc.
		if d > 0 && d < 180 {
			inForward++
		} else if d > 180 && d < 360 {
			inBackward++
		}
	}

	afflicted := inForward == total || inBackward == total
	partial := !afflicted && (inForward == total-1 || inBackward == total-1)

	var subtype *types.KaalSarpSubtype
	if afflicted {
		st := types.AllKaalSarpSubtypes[rahu.House-1]
		subtype = &st
	}

	return types.KaalSarpDoshaInfo{
		Afflicted: afflicted,
		Subtype:   subtype,
		Partial:   partial,
		RahuHouse: rahu.House,
		KetuHouse: ketu.House,
	}
}

// The reference almanac publishes no calculator; these four rules are the pandit-consensus subset.
func ComputePitruDosha(chart *types.BirthChart) types.PitruDoshaInfo {
	sun := chart.ByPlanet.Sun
	rahu := chart.ByPlanet.Rahu
	saturn := chart.ByPlanet.Saturn

	ninthRashi := chart.Bhava.Houses[8].Rashi.Index
	ninthLordGraha := RashiLord[ninthRashi]
	ninthLord, _ := chart.ByPlanet.Get(ninthLordGraha.Graha())

	reasons := make([]string, 0, 4)

	if sun.House == rahu.House {
		reasons = append(reasons,
			"Sun + Rahu conjunction in house "+jsnum.FormatInt(int64(sun.House)))
	}
	if sun.House == saturn.House {
		reasons = append(reasons,
			"Sun + Saturn conjunction in house "+jsnum.FormatInt(int64(sun.House)))
	}
	if rahu.House == 9 {
		reasons = append(reasons, "Rahu in the 9th house")
	}
	if ninthLordGraha != types.VisibleSun && ninthLord.House == rahu.House {
		reasons = append(reasons, "9th-lord "+ninthLordGraha.String()+
			" conjunct Rahu in house "+jsnum.FormatInt(int64(ninthLord.House)))
	}

	return types.PitruDoshaInfo{
		Afflicted: len(reasons) > 0,
		Reasons:   reasons,
	}
}
