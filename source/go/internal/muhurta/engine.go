package muhurta

import (
	"fmt"
	"sort"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/core"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

const dayMs int64 = 24 * 3600_000

type BhadraMode string

const (
	BhadraIgnore   BhadraMode = "ignore"
	BhadraPenalize BhadraMode = "penalize"
	BhadraExclude  BhadraMode = "exclude"
)

var AllBhadraModes = []BhadraMode{BhadraIgnore, BhadraPenalize, BhadraExclude}

type Paksha string

const (
	PakshaShukla  Paksha = "shukla"
	PakshaKrishna Paksha = "krishna"
)

// Indices: tithi 0..29 (0 = Shukla Pratipada, 29 = Amavasya), nakshatra 0..26 (Ashwini = 0), vara 0..6 (Sunday = 0), yoga 0..26.
type MuhurtaRule struct {
	Occasion string
	Name     string

	AuspiciousTithis       []int
	InauspiciousTithis     []int
	AuspiciousNakshatras   []int
	InauspiciousNakshatras []int
	AuspiciousVaras        []int
	InauspiciousVaras      []int
	AuspiciousYogas        []int
	InauspiciousYogas      []int

	// Bhadra is a window, not a whole-day veto: excluding drops seven fixed tithis, some preferred.
	Bhadra *BhadraMode
	// Deprecated: use [MuhurtaRule.Bhadra], which wins when both are set.
	ExcludeBhadra     bool
	ExcludeEkadashi   bool
	RequirePaksha     Paksha
	ExcludeAdhikaMasa bool
	ExcludeEclipse    bool
	ExcludeGandaMula  bool
	// Only a spell carrying a dosha; one begun Wed or Thu does not.
	ExcludePanchaka bool
	VaraTithiYogas  *bool
}

func (r MuhurtaRule) resolvedBhadra() BhadraMode {
	if r.Bhadra != nil {
		return *r.Bhadra
	}
	if r.ExcludeBhadra {
		return BhadraExclude
	}
	return BhadraIgnore
}

func (r MuhurtaRule) scoresVaraTithiYogas() bool {
	return r.VaraTithiYogas == nil || *r.VaraTithiYogas
}

type MuhurtaScore struct {
	Date   types.JSDate `json:"date"`
	Score  int          `json:"score"`
	Passes bool         `json:"passes"`
	// Diagnostic English, not a stable format; branch on Factors instead.
	Reasons []string        `json:"reasons"`
	Factors []MuhurtaFactor `json:"factors"`
}

type MuhurtaDay struct {
	MuhurtaScore
	Panchang types.DailyPanchangResult `json:"panchang"`
}

type MuhurtaScoreOptions struct {
	Timezone        types.Timezone
	Ayanamsa        types.AyanamsaType
	Language        types.Language
	MasaSystem      types.MasaSystem
	IncludeFailures bool
}

func (o MuhurtaScoreOptions) panchangOptions() core.PanchangOptions {
	return core.PanchangOptions{
		InstantPanchangOptions: core.InstantPanchangOptions{
			Ayanamsa:   o.Ayanamsa,
			Language:   o.Language,
			MasaSystem: o.MasaSystem,
		},
		Timezone: o.Timezone,
	}
}

func ScoreMuhurta(
	ctx *astronomy.EphemerisCtx,
	dateMs int64,
	location types.GeoLocation,
	rule MuhurtaRule,
	options MuhurtaScoreOptions,
) (MuhurtaScore, error) {
	if err := utils.ValidateDate(dateMs); err != nil {
		return MuhurtaScore{}, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return MuhurtaScore{}, err
	}
	// The special-yoga pass needs post-sunrise nakshatra windows.
	opts := options.panchangOptions()
	opts.Sections = core.Sections(core.SectionEclipse, core.SectionLunarWindows)
	opts.SectionsGiven = true

	p, ok, err := core.GetDailyPanchang(ctx, dateMs, location, opts, core.NatalResolvers{})
	if err != nil {
		return MuhurtaScore{}, err
	}
	if !ok {
		return MuhurtaScore{
			Date:    types.Date(dateMs),
			Score:   0,
			Passes:  false,
			Reasons: []string{"polar location with no sunrise, Hindu day undefined"},
			Factors: []MuhurtaFactor{{Code: "no_sunrise", Axis: AxisExclusion, Delta: 0}},
		}, nil
	}
	return scoreFromPanchang(p, rule)
}

func ComputeAuspiciousDatesInRange(
	ctx *astronomy.EphemerisCtx,
	rule MuhurtaRule,
	startMs, endMs int64,
	location types.GeoLocation,
	options MuhurtaScoreOptions,
) ([]MuhurtaDay, error) {
	if err := utils.ValidateDate(startMs); err != nil {
		return nil, err
	}
	if err := utils.ValidateDate(endMs); err != nil {
		return nil, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return nil, err
	}
	if startMs > endMs {
		return nil, types.Codef(types.ErrInvalidInput,
			"start (%s) must be ≤ end (%s)",
			types.Date(startMs).ISOString(), types.Date(endMs).ISOString())
	}

	out := []MuhurtaDay{}
	for t := startMs; t <= endMs; t += dayMs {
		p, ok, err := core.GetDailyPanchang(ctx, t, location,
			options.panchangOptions(), core.NatalResolvers{})
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		result, err := scoreFromPanchang(p, rule)
		if err != nil {
			return nil, err
		}
		if result.Passes || options.IncludeFailures {
			out = append(out, MuhurtaDay{MuhurtaScore: result, Panchang: p})
		}
	}

	sort.SliceStable(out, func(i, j int) bool { return out[i].Score > out[j].Score })
	return out, nil
}

func scoreFromPanchang(p types.DailyPanchangResult, rule MuhurtaRule) (MuhurtaScore, error) {
	// Both must be [] on the wire, never nil.
	reasons := []string{}
	factors := []MuhurtaFactor{}
	score := 50

	if len(p.Angas.Tithis) == 0 || len(p.Angas.Nakshatras) == 0 || len(p.Angas.Yogas) == 0 {
		return MuhurtaScore{}, fmt.Errorf(
			"muhurta: panchang for %s has an empty anga list (tithis=%d nakshatras=%d yogas=%d)",
			p.Date.ISOString(), len(p.Angas.Tithis), len(p.Angas.Nakshatras), len(p.Angas.Yogas))
	}
	tithiAtSunrise := p.Angas.Tithis[0].Index
	nakAtSunrise := p.Angas.Nakshatras[0].Index
	yogaAtSunrise := p.Angas.Yogas[0].Index
	varaIdx := p.Angas.Vara.Index

	bhadraMode := rule.resolvedBhadra()

	if bhadraMode == BhadraExclude && p.Inauspicious.Bhadra != nil {
		return zero(p.Date, "Bhadra Kala active on this day", "bhadra"), nil
	}
	if rule.ExcludeEkadashi {
		if tithiAtSunrise == 10 || tithiAtSunrise == 25 {
			return zero(p.Date, "Ekadashi tithi at sunrise", "ekadashi"), nil
		}
	}
	if rule.ExcludeEclipse && p.Eclipse != nil {
		return zero(p.Date,
			fmt.Sprintf("Eclipse overlap (%s)", p.Eclipse.Subtype), "eclipse"), nil
	}
	if rule.ExcludeAdhikaMasa && p.Calendar.Chandramasa.IsAdhika {
		return zero(p.Date, "Adhika (intercalary) lunar month", "adhika_masa"), nil
	}
	if rule.ExcludeGandaMula && p.Inauspicious.GandaMula.Active {
		return zero(p.Date,
			fmt.Sprintf("Ganda Mula nakshatra (%s)", p.Inauspicious.GandaMula.Severity),
			"ganda_mula"), nil
	}
	pk := p.Inauspicious.PanchakaInfo
	if rule.ExcludePanchaka && pk.Active && pk.IsDosha {
		return zero(p.Date, fmt.Sprintf("Panchaka active (%s)", pk.Type), "panchaka"), nil
	}
	if rule.RequirePaksha != "" {
		paksha := PakshaKrishna
		if tithiAtSunrise < 15 {
			paksha = PakshaShukla
		}
		if paksha != rule.RequirePaksha {
			return zero(p.Date,
				fmt.Sprintf("paksha is %s, rule requires %s", paksha, rule.RequirePaksha),
				"paksha"), nil
		}
	}

	type axis struct {
		auspicious, inauspicious []int
		index                    int
		name                     string
		factorAxis               MuhurtaFactorAxis
	}
	for _, a := range []axis{
		{rule.AuspiciousTithis, rule.InauspiciousTithis, tithiAtSunrise, "tithi", AxisTithi},
		{rule.AuspiciousNakshatras, rule.InauspiciousNakshatras, nakAtSunrise, "nakshatra", AxisNakshatra},
		{rule.AuspiciousVaras, rule.InauspiciousVaras, varaIdx, "vara", AxisVara},
		{rule.AuspiciousYogas, rule.InauspiciousYogas, yogaAtSunrise, "yoga", AxisYoga},
	} {
		switch {
		case containsInt(a.auspicious, a.index):
			score += 10
			reasons = append(reasons, fmt.Sprintf("auspicious %s (%d)", a.name, a.index))
			factors = append(factors, MuhurtaFactor{
				Code: "auspicious_" + a.name, Axis: a.factorAxis,
				Index: factorIndex(a.index), Delta: 10,
			})
		case containsInt(a.inauspicious, a.index):
			score -= 15
			reasons = append(reasons, fmt.Sprintf("inauspicious %s (%d)", a.name, a.index))
			factors = append(factors, MuhurtaFactor{
				Code: "inauspicious_" + a.name, Axis: a.factorAxis,
				Index: factorIndex(a.index), Delta: -15,
			})
		}
	}

	// Auspicious and inauspicious yogas co-occur and net out: no source ranks them.
	if rule.scoresVaraTithiYogas() {
		yogas, err := ComputeVaraTithiYogas(varaIdx, tithiAtSunrise)
		if err != nil {
			return MuhurtaScore{}, err
		}
		for _, vty := range yogas {
			delta := -15
			if vty.Polarity == PolarityAuspicious {
				delta = 10
			}
			score += delta
			reasons = append(reasons,
				fmt.Sprintf("%s yoga (vara x tithi, %s)", vty.Type, vty.Polarity))
			factors = append(factors, MuhurtaFactor{
				Code: "vara_tithi_" + string(vty.Type), Axis: AxisVaraTithiYoga, Delta: delta,
			})
		}
	}

	if bhadraMode == BhadraPenalize && p.Inauspicious.Bhadra != nil {
		score -= 15
		reasons = append(reasons, "Bhadra Kala active during part of the day")
		factors = append(factors, MuhurtaFactor{Code: "bhadra", Axis: AxisKarana, Delta: -15})
	}

	for _, sy := range p.SpecialYogas {
		if sy.Type == types.YogaAmritSiddhi || sy.Type == types.YogaSarvarthaSiddhi ||
			sy.Type == types.YogaRaviPushya || sy.Type == types.YogaGuruPushya {
			score += 5
			reasons = append(reasons, string(sy.Type)+" bonus")
			factors = append(factors, MuhurtaFactor{
				Code: string(sy.Type), Axis: AxisSpecialYoga, Delta: 5,
			})
		}
		if sy.Type == types.YogaJwalamukhi {
			score -= 10
			reasons = append(reasons, "Jwalamukhi yoga penalty")
			factors = append(factors, MuhurtaFactor{
				Code: "jwalamukhi", Axis: AxisSpecialYoga, Delta: -10,
			})
		}
	}

	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}

	return MuhurtaScore{
		Date:    p.Date,
		Score:   score,
		Passes:  score >= 50,
		Reasons: reasons,
		Factors: factors,
	}, nil
}

func zero(date types.JSDate, reason, code string) MuhurtaScore {
	return MuhurtaScore{
		Date:    date,
		Score:   0,
		Passes:  false,
		Reasons: []string{reason},
		Factors: []MuhurtaFactor{{Code: code, Axis: AxisExclusion, Delta: 0}},
	}
}

func ComputeAuspiciousDatesForYear(
	ctx *astronomy.EphemerisCtx,
	year int,
	rule MuhurtaRule,
	location types.GeoLocation,
	options MuhurtaScoreOptions,
) ([]MuhurtaDay, error) {
	offsetMinutes, err := utils.ResolveUtcOffset(options.Timezone, types.DateUTC(year, 6, 1).Ms())
	if err != nil {
		return nil, err
	}
	off := int64(offsetMinutes) * 60_000
	startMs := types.DateUTC(year, 0, 1).Ms() - off
	endMs := types.DateUTC(year, 11, 31).Ms() + dayMs - 1 - off
	return ComputeAuspiciousDatesInRange(ctx, rule, startMs, endMs, location, options)
}

// Deprecated: use [ComputeAuspiciousDatesInRange].
func FindAuspiciousDates(
	ctx *astronomy.EphemerisCtx,
	rule MuhurtaRule,
	startMs, endMs int64,
	location types.GeoLocation,
	options MuhurtaScoreOptions,
) ([]MuhurtaDay, error) {
	return ComputeAuspiciousDatesInRange(ctx, rule, startMs, endMs, location, options)
}
