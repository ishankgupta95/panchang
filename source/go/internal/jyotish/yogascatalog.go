package jyotish

import (
	"math"
	"sort"
	"strings"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

var (
	kendraHouses   = [4]int{1, 4, 7, 10}
	dusthanaHouses = [3]int{6, 8, 12}
)

func inHouses3(list [3]int, h int) bool { return list[0] == h || list[1] == h || list[2] == h }
func inHouses4(list [4]int, h int) bool {
	return list[0] == h || list[1] == h || list[2] == h || list[3] == h
}

// Deliberately a second encoding of RashiLord, not an alias.
var rashiLords = [12]types.VisibleGraha{
	types.VisibleMars,
	types.VisibleVenus,
	types.VisibleMercury,
	types.VisibleMoon,
	types.VisibleSun,
	types.VisibleMercury,
	types.VisibleVenus,
	types.VisibleMars,
	types.VisibleJupiter,
	types.VisibleSaturn,
	types.VisibleSaturn,
	types.VisibleJupiter,
}

// Deliberately a third copy of dignity.go's exaltation table.
var exaltationRashi = [types.VisibleGrahaCount]int{
	types.VisibleSun: 0, types.VisibleMoon: 1, types.VisibleMars: 9,
	types.VisibleMercury: 5, types.VisibleJupiter: 3, types.VisibleVenus: 11,
	types.VisibleSaturn: 6,
}

// Lagnas where one planet lords both a kendra and a trikona (BPHS 34); the separate presence array is needed because VisibleSun is 0.
var (
	yogakarakaByLagna = [12]types.VisibleGraha{
		1:  types.VisibleSaturn,
		3:  types.VisibleMars,
		4:  types.VisibleMars,
		6:  types.VisibleSaturn,
		9:  types.VisibleVenus,
		10: types.VisibleVenus,
	}
	yogakarakaPresent = [12]bool{1: true, 3: true, 4: true, 6: true, 9: true, 10: true}
)

var naturalBenefics = [4]types.VisibleGraha{
	types.VisibleJupiter, types.VisibleVenus, types.VisibleMercury, types.VisibleMoon,
}

var catalogVisibleGrahas = types.AllVisibleGrahas

type YogaContext struct {
	Chart        *types.BirthChart
	Dignity      [types.GrahaCount]Dignity
	Aspects      types.AspectMap
	Navamsa      *types.DivisionalChart
	PlanetByName types.PlanetsByGraha
	LagnaRashi   int
}

type YogaMatch struct {
	Reasons []string
	// nil = no bhanga rule; Applies:false = evaluated, did not fire.
	Bhanga *types.YogaBhanga
}

type YogaRule struct {
	Name     types.YogaName
	Type     types.YogaType
	Evaluate func(ctx *YogaContext) *YogaMatch
}

func houseLord(lagnaRashi, house int) types.VisibleGraha {
	return rashiLords[(lagnaRashi+house-1)%12]
}

func rashiOffsetFromTo(sourceRashi, targetRashi int) int {
	return ((targetRashi-sourceRashi+12)%12 + 1)
}

func isOwnOrExalted(d Dignity) bool {
	return d == DignityOwn || d == DignityMoolatrikona || d == DignityExalted
}

var houseOrdinal = [13]string{
	"", "1st", "2nd", "3rd", "4th", "5th", "6th",
	"7th", "8th", "9th", "10th", "11th", "12th",
}

func grahaNamesOf(list []types.Graha) string {
	parts := make([]string, 0, len(list))
	for _, g := range list {
		parts = append(parts, g.String())
	}
	return strings.Join(parts, ", ")
}

func mahapurushaRule(name types.YogaName, planet types.Graha) YogaRule {
	return YogaRule{
		Name: name,
		Type: types.YogaMahapurusha,
		Evaluate: func(ctx *YogaContext) *YogaMatch {
			p, _ := ctx.PlanetByName.Get(planet)
			dignity := ctx.Dignity[planet]
			if !isOwnOrExalted(dignity) {
				return nil
			}
			if !inHouses4(kendraHouses, p.House) {
				return nil
			}
			return &YogaMatch{
				Reasons: []string{planet.String() + " " + string(dignity) + " in " +
					p.Rashi.Name + ", in kendra (house " + jsnum.FormatInt(int64(p.House)) + ")"},
				Bhanga: mahapurushaBhanga(ctx, planet, p.Rashi.Index, p.Rashi.Name),
			}
		},
	}
}

func mahapurushaBhanga(ctx *YogaContext, planet types.Graha, planetRashi int, planetRashiName string) *types.YogaBhanga {
	reasons := make([]string, 0, 2)
	for _, luminary := range []types.Graha{types.GrahaSun, types.GrahaMoon} {
		p, _ := ctx.PlanetByName.Get(luminary)
		if p.Rashi.Index == planetRashi {
			reasons = append(reasons, planet.String()+" conjunct "+luminary.String()+" in "+planetRashiName)
		}
	}
	return &types.YogaBhanga{Applies: len(reasons) > 0, Reasons: reasons}
}

// BPHS 10°, Phaladeepika 12°; matches shadbala.go's Chesta convention.
const jupiterCombustionArcDeg = 10

var gajakesariRule = YogaRule{
	Name: types.YogaGajakesari,
	Type: types.YogaLunar,
	Evaluate: func(ctx *YogaContext) *YogaMatch {
		moon, _ := ctx.PlanetByName.Get(types.GrahaMoon)
		jup, _ := ctx.PlanetByName.Get(types.GrahaJupiter)
		offset := rashiOffsetFromTo(moon.Rashi.Index, jup.Rashi.Index)
		if offset != 1 && offset != 4 && offset != 7 && offset != 10 {
			return nil
		}
		desc := houseOrdinal[offset]
		if offset == 1 {
			desc = "1st (conjunct)"
		}

		bhangaReasons := make([]string, 0, 2)
		sun, _ := ctx.PlanetByName.Get(types.GrahaSun)
		angularDistance := math.Abs(jsnum.Mod(jup.Longitude-sun.Longitude+540, 360) - 180)
		if angularDistance <= jupiterCombustionArcDeg {
			bhangaReasons = append(bhangaReasons,
				"Jupiter combust (within "+jsnum.FormatInt(jupiterCombustionArcDeg)+"° of Sun)")
		}
		if ctx.Dignity[types.GrahaJupiter] == DignityDebilitated {
			bhangaReasons = append(bhangaReasons, "Jupiter debilitated in "+jup.Rashi.Name)
		}

		return &YogaMatch{
			Reasons: []string{"Jupiter in " + desc + " from Moon (kendra)"},
			Bhanga:  &types.YogaBhanga{Applies: len(bhangaReasons) > 0, Reasons: bhangaReasons},
		}
	},
}

func planetsAtOffsetFrom(ctx *YogaContext, fromRashi, offset int, exclude ...types.Graha) []types.Graha {
	out := make([]types.Graha, 0, types.VisibleGrahaCount)
	for _, p := range ctx.Chart.Planets {
		skip := false
		for _, e := range exclude {
			if p.Planet == e {
				skip = true
			}
		}
		if skip {
			continue
		}
		if _, ok := p.Planet.Visible(); !ok {
			continue
		}
		if rashiOffsetFromTo(fromRashi, p.Rashi.Index) == offset {
			out = append(out, p.Planet)
		}
	}
	return out
}

func aroundRule(name types.YogaName, typ types.YogaType, anchor types.Graha, offset int, label string) YogaRule {
	return YogaRule{
		Name: name,
		Type: typ,
		Evaluate: func(ctx *YogaContext) *YogaMatch {
			a, _ := ctx.PlanetByName.Get(anchor)
			planets := planetsAtOffsetFrom(ctx, a.Rashi.Index, offset, types.GrahaSun, types.GrahaMoon)
			if len(planets) == 0 {
				return nil
			}
			return &YogaMatch{Reasons: []string{grahaNamesOf(planets) + " in " + label}}
		},
	}
}

func bothSidesRule(name types.YogaName, typ types.YogaType, anchor types.Graha, label string) YogaRule {
	return YogaRule{
		Name: name,
		Type: typ,
		Evaluate: func(ctx *YogaContext) *YogaMatch {
			a, _ := ctx.PlanetByName.Get(anchor)
			second := planetsAtOffsetFrom(ctx, a.Rashi.Index, 2, types.GrahaSun, types.GrahaMoon)
			twelfth := planetsAtOffsetFrom(ctx, a.Rashi.Index, 12, types.GrahaSun, types.GrahaMoon)
			if len(second) == 0 || len(twelfth) == 0 {
				return nil
			}
			return &YogaMatch{Reasons: []string{
				grahaNamesOf(second) + " in 2nd from " + label + "; " +
					grahaNamesOf(twelfth) + " in 12th from " + label,
			}}
		},
	}
}

var kemadrumaRule = YogaRule{
	Name: types.YogaKemadruma,
	Type: types.YogaLunar,
	Evaluate: func(ctx *YogaContext) *YogaMatch {
		moon, _ := ctx.PlanetByName.Get(types.GrahaMoon)
		moonRashi := moon.Rashi.Index
		// Rahu and Ketu excluded per B.V. Raman.
		for _, p := range ctx.Chart.Planets {
			if p.Planet == types.GrahaMoon {
				continue
			}
			if _, ok := p.Planet.Visible(); !ok {
				continue
			}
			off := rashiOffsetFromTo(moonRashi, p.Rashi.Index)
			if off == 1 || off == 2 || off == 12 {
				return nil
			}
		}
		return &YogaMatch{Reasons: []string{
			"No planet in 2nd, 12th, or conjunct with Moon (Moon isolated from visible grahas)",
		}}
	},
}

var budhaAdityaRule = YogaRule{
	Name: types.YogaBudhaAditya,
	Type: types.YogaSolar,
	Evaluate: func(ctx *YogaContext) *YogaMatch {
		sun, _ := ctx.PlanetByName.Get(types.GrahaSun)
		mer, _ := ctx.PlanetByName.Get(types.GrahaMercury)
		if sun.Rashi.Index != mer.Rashi.Index {
			return nil
		}
		return &YogaMatch{Reasons: []string{"Sun and Mercury conjunct in " + sun.Rashi.Name}}
	},
}

// Sambandha requires mutuality: a one-way aspect is not yoga-forming (BPHS 39).
var rajaYogaRule = YogaRule{
	Name: types.YogaRajaYoga,
	Type: types.YogaRaja,
	Evaluate: func(ctx *YogaContext) *YogaMatch {
		// Slice plus seen-array: a map would reorder the reasons.
		kendraLords := dedupLords(ctx.LagnaRashi, kendraHouses[:])
		trikonaLords := dedupLords(ctx.LagnaRashi, []int{1, 5, 9})

		reasons := make([]string, 0, 4)
		seenPairs := map[string]bool{}
		for _, k := range kendraLords {
			for _, t := range trikonaLords {
				if k == t {
					continue
				}
				pair := []string{k.String(), t.String()}
				sort.Strings(pair)
				pairKey := pair[0] + "|" + pair[1]
				if seenPairs[pairKey] {
					continue
				}
				seenPairs[pairKey] = true

				kp, _ := ctx.PlanetByName.Get(k.Graha())
				tp, _ := ctx.PlanetByName.Get(t.Graha())
				if kp.Rashi.Index == tp.Rashi.Index {
					reasons = append(reasons, "Kendra-lord "+k.String()+" conjunct trikona-lord "+
						t.String()+" in "+kp.Rashi.Name)
					continue
				}
				if aspectsHouse(ctx, k.Graha(), tp.House) && aspectsHouse(ctx, t.Graha(), kp.House) {
					reasons = append(reasons, "Kendra-lord "+k.String()+" and trikona-lord "+
						t.String()+" in mutual aspect")
				}
			}
		}
		if len(reasons) == 0 {
			return nil
		}
		return &YogaMatch{Reasons: reasons}
	},
}

func dedupLords(lagnaRashi int, houses []int) []types.VisibleGraha {
	out := make([]types.VisibleGraha, 0, len(houses))
	var seen [types.VisibleGrahaCount]bool
	for _, h := range houses {
		l := houseLord(lagnaRashi, h)
		if seen[l] {
			continue
		}
		seen[l] = true
		out = append(out, l)
	}
	return out
}

func aspectsHouse(ctx *YogaContext, g types.Graha, house int) bool {
	houses, ok := ctx.Aspects.ForGraha(g)
	if !ok {
		return false
	}
	for _, h := range houses {
		if h == house {
			return true
		}
	}
	return false
}

var dharmaKarmadhipatiRule = YogaRule{
	Name: types.YogaDharmaKarmadhipati,
	Type: types.YogaRaja,
	Evaluate: func(ctx *YogaContext) *YogaMatch {
		lord9 := houseLord(ctx.LagnaRashi, 9)
		lord10 := houseLord(ctx.LagnaRashi, 10)
		if lord9 == lord10 {
			return nil
		}
		p9, _ := ctx.PlanetByName.Get(lord9.Graha())
		p10, _ := ctx.PlanetByName.Get(lord10.Graha())
		if p9.Rashi.Index == p10.Rashi.Index {
			return &YogaMatch{Reasons: []string{
				"9th lord " + lord9.String() + " conjunct 10th lord " + lord10.String() +
					" in " + p9.Rashi.Name,
			}}
		}
		if aspectsHouse(ctx, lord9.Graha(), p10.House) && aspectsHouse(ctx, lord10.Graha(), p9.House) {
			return &YogaMatch{Reasons: []string{
				"9th lord " + lord9.String() + " and 10th lord " + lord10.String() + " in mutual aspect",
			}}
		}
		return nil
	},
}

var vipareetaRajaRule = YogaRule{
	Name: types.YogaVipareetaRaja,
	Type: types.YogaRaja,
	Evaluate: func(ctx *YogaContext) *YogaMatch {
		distinct := dedupLords(ctx.LagnaRashi, []int{6, 8, 12})

		firstRashi := -1
		for _, l := range distinct {
			p, _ := ctx.PlanetByName.Get(l.Graha())
			if firstRashi == -1 {
				firstRashi = p.Rashi.Index
			} else if p.Rashi.Index != firstRashi {
				return nil
			}
		}
		first, _ := ctx.PlanetByName.Get(distinct[0].Graha())
		if !inHouses3(dusthanaHouses, first.House) {
			return nil
		}

		names := make([]types.Graha, 0, len(distinct))
		for _, l := range distinct {
			names = append(names, l.Graha())
		}
		return &YogaMatch{Reasons: []string{
			"6th/8th/12th lords (" + grahaNamesOf(names) + ") conjunct in " +
				first.Rashi.Name + " (house " + jsnum.FormatInt(int64(first.House)) + ")",
		}}
	},
}

var lakshmiYogaRule = YogaRule{
	Name: types.YogaLakshmi,
	Type: types.YogaRaja,
	Evaluate: func(ctx *YogaContext) *YogaMatch {
		lord9 := houseLord(ctx.LagnaRashi, 9)
		dig9 := ctx.Dignity[lord9.Graha()]
		digV := ctx.Dignity[types.GrahaVenus]
		if !isOwnOrExalted(dig9) || !isOwnOrExalted(digV) {
			return nil
		}
		return &YogaMatch{Reasons: []string{
			"9th lord " + lord9.String() + " " + string(dig9) + "; Venus " + string(digV),
		}}
	},
}

func lordsConjunctRule(name types.YogaName, typ types.YogaType, h1, h2 int) YogaRule {
	return YogaRule{
		Name: name,
		Type: typ,
		Evaluate: func(ctx *YogaContext) *YogaMatch {
			a := houseLord(ctx.LagnaRashi, h1)
			b := houseLord(ctx.LagnaRashi, h2)
			if a == b {
				return nil
			}
			pa, _ := ctx.PlanetByName.Get(a.Graha())
			pb, _ := ctx.PlanetByName.Get(b.Graha())
			if pa.Rashi.Index != pb.Rashi.Index {
				return nil
			}
			return &YogaMatch{Reasons: []string{
				houseOrdinal[h1] + " lord " + a.String() + " conjunct " +
					houseOrdinal[h2] + " lord " + b.String() + " in " + pa.Rashi.Name,
			}}
		},
	}
}

// 10, not the vyaya 12 (Raman §21).
var upachayaHouses = [4]int{3, 6, 10, 11}

var vasumatiYogaRule = YogaRule{
	Name: types.YogaVasumati,
	Type: types.YogaDhana,
	Evaluate: func(ctx *YogaContext) *YogaMatch {
		placed := make([]string, 0, len(naturalBenefics))
		for _, v := range naturalBenefics {
			p, _ := ctx.PlanetByName.Get(v.Graha())
			if !inHouses4(upachayaHouses, p.House) {
				return nil
			}
			placed = append(placed, v.String()+" (house "+jsnum.FormatInt(int64(p.House))+")")
		}
		return &YogaMatch{Reasons: []string{
			"All natural benefics in upachayas from lagna: " + strings.Join(placed, ", "),
		}}
	},
}

var vargottamaRule = YogaRule{
	Name: types.YogaVargottama,
	Type: types.YogaSpecial,
	Evaluate: func(ctx *YogaContext) *YogaMatch {
		if ctx.Navamsa == nil {
			return nil
		}
		reasons := make([]string, 0, types.GrahaCount)
		for _, p := range ctx.Chart.Planets {
			var d9 *types.PlanetPlacement
			for i := range ctx.Navamsa.Planets {
				if ctx.Navamsa.Planets[i].Planet == p.Planet {
					d9 = &ctx.Navamsa.Planets[i]
					break
				}
			}
			if d9 == nil {
				continue
			}
			if d9.Rashi.Index == p.Rashi.Index {
				reasons = append(reasons, p.Planet.String()+" in "+p.Rashi.Name+" in both D1 and D9")
			}
		}
		if len(reasons) == 0 {
			return nil
		}
		return &YogaMatch{Reasons: reasons}
	},
}

var yogakarakaRule = YogaRule{
	Name: types.YogaYogakaraka,
	Type: types.YogaSpecial,
	Evaluate: func(ctx *YogaContext) *YogaMatch {
		if !yogakarakaPresent[ctx.LagnaRashi] {
			return nil
		}
		planet := yogakarakaByLagna[ctx.LagnaRashi]
		p, _ := ctx.PlanetByName.Get(planet.Graha())
		return &YogaMatch{Reasons: []string{
			planet.String() + " is Yogakaraka for " + ctx.Chart.Lagna.Rashi.Name +
				" lagna (in " + p.Rashi.Name + ", house " + jsnum.FormatInt(int64(p.House)) + ")",
		}}
	},
}

var kendraOffsetsFromMoon = [4]int{1, 4, 7, 10}

func houseFromMoon(moonRashi, planetRashi int) int {
	return rashiOffsetFromTo(moonRashi, planetRashi)
}

var neechaBhangaRule = YogaRule{
	Name: types.YogaNeechaBhanga,
	Type: types.YogaCancellation,
	Evaluate: func(ctx *YogaContext) *YogaMatch {
		reasons := make([]string, 0, 4)
		moon, _ := ctx.PlanetByName.Get(types.GrahaMoon)
		moonRashi := moon.Rashi.Index

		for _, v := range catalogVisibleGrahas {
			g := v.Graha()
			if ctx.Dignity[g] != DignityDebilitated {
				continue
			}
			p, _ := ctx.PlanetByName.Get(g)

			// Phaladeepika 7.26.
			dispositor := rashiLords[p.Rashi.Index]
			if dispositor != v {
				dpp, _ := ctx.PlanetByName.Get(dispositor.Graha())
				if inHouses4(kendraHouses, dpp.House) {
					reasons = append(reasons, g.String()+" debilitated in "+p.Rashi.Name+
						"; dispositor "+dispositor.String()+" in kendra from Lagna (house "+
						jsnum.FormatInt(int64(dpp.House))+")")
				} else {
					moonHouse := houseFromMoon(moonRashi, dpp.Rashi.Index)
					if inHouses4(kendraOffsetsFromMoon, moonHouse) {
						reasons = append(reasons, g.String()+" debilitated in "+p.Rashi.Name+
							"; dispositor "+dispositor.String()+" in kendra from Moon ("+
							houseOrdinal[moonHouse]+" from Moon)")
					}
				}
			}

			// Phaladeepika 7.26.
			exLord := rashiLords[exaltationRashi[v]]
			if exLord != v {
				exp, _ := ctx.PlanetByName.Get(exLord.Graha())
				if inHouses4(kendraHouses, exp.House) {
					reasons = append(reasons, g.String()+" debilitated in "+p.Rashi.Name+
						"; lord of exaltation rashi "+exLord.String()+" in kendra from Lagna (house "+
						jsnum.FormatInt(int64(exp.House))+")")
				} else {
					moonHouse := houseFromMoon(moonRashi, exp.Rashi.Index)
					if inHouses4(kendraOffsetsFromMoon, moonHouse) {
						reasons = append(reasons, g.String()+" debilitated in "+p.Rashi.Name+
							"; lord of exaltation rashi "+exLord.String()+" in kendra from Moon ("+
							houseOrdinal[moonHouse]+" from Moon)")
					}
				}
			}

			for _, other := range catalogVisibleGrahas {
				if other == v {
					continue
				}
				if ctx.Dignity[other.Graha()] != DignityExalted {
					continue
				}
				op, _ := ctx.PlanetByName.Get(other.Graha())
				off := ((op.House-p.House+12)%12 + 1)
				if off == 1 || off == 4 || off == 7 || off == 10 {
					reasons = append(reasons, g.String()+" debilitated in "+p.Rashi.Name+
						"; exalted "+other.String()+" in "+houseOrdinal[off]+" from "+
						g.String()+" (kendra)")
				}
			}

			// Phaladeepika 7.28.
			if dispositor != v && aspectsHouse(ctx, dispositor.Graha(), p.House) {
				reasons = append(reasons, g.String()+" debilitated in "+p.Rashi.Name+
					"; dispositor "+dispositor.String()+" aspects "+g.String())
			}
		}

		if len(reasons) == 0 {
			return nil
		}
		return &YogaMatch{Reasons: reasons}
	},
}

var daridraYogaRule = YogaRule{
	Name: types.YogaDaridra,
	Type: types.YogaNegative,
	Evaluate: func(ctx *YogaContext) *YogaMatch {
		reasons := make([]string, 0, 2)
		lord11 := houseLord(ctx.LagnaRashi, 11)
		p11, _ := ctx.PlanetByName.Get(lord11.Graha())
		if p11.House == 12 {
			reasons = append(reasons, "11th lord "+lord11.String()+" in 12th house")
		}
		lord2 := houseLord(ctx.LagnaRashi, 2)
		p2, _ := ctx.PlanetByName.Get(lord2.Graha())
		if inHouses3(dusthanaHouses, p2.House) {
			reasons = append(reasons, "2nd lord "+lord2.String()+" in dusthana (house "+
				jsnum.FormatInt(int64(p2.House))+")")
		}
		if len(reasons) == 0 {
			return nil
		}
		return &YogaMatch{Reasons: reasons}
	},
}

// In published-result order.
var YogaCatalog = []YogaRule{
	mahapurushaRule(types.YogaRuchaka, types.GrahaMars),
	mahapurushaRule(types.YogaBhadra, types.GrahaMercury),
	mahapurushaRule(types.YogaHamsa, types.GrahaJupiter),
	mahapurushaRule(types.YogaMalavya, types.GrahaVenus),
	mahapurushaRule(types.YogaSasha, types.GrahaSaturn),
	gajakesariRule,
	aroundRule(types.YogaSunapha, types.YogaLunar, types.GrahaMoon, 2, "2nd from Moon"),
	aroundRule(types.YogaAnapha, types.YogaLunar, types.GrahaMoon, 12, "12th from Moon"),
	bothSidesRule(types.YogaDurudhura, types.YogaLunar, types.GrahaMoon, "Moon"),
	kemadrumaRule,
	budhaAdityaRule,
	aroundRule(types.YogaVeshi, types.YogaSolar, types.GrahaSun, 2, "2nd from Sun"),
	aroundRule(types.YogaVasi, types.YogaSolar, types.GrahaSun, 12, "12th from Sun"),
	bothSidesRule(types.YogaUbhayachari, types.YogaSolar, types.GrahaSun, "Sun"),
	rajaYogaRule,
	dharmaKarmadhipatiRule,
	vipareetaRajaRule,
	lakshmiYogaRule,
	lordsConjunctRule(types.YogaDhana211, types.YogaDhana, 2, 11),
	lordsConjunctRule(types.YogaDhana59, types.YogaDhana, 5, 9),
	vasumatiYogaRule,
	vargottamaRule,
	yogakarakaRule,
	neechaBhangaRule,
	daridraYogaRule,
}
