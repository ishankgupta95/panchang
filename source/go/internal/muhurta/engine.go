package muhurta

import (
	"context"
	"fmt"
	"sort"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/core"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

const dayMs int64 = 24 * 3600_000

var AllBhadraModes = []BhadraMode{BhadraIgnore, BhadraPenalize, BhadraExclude}

func ScoreMuhurta(
	eph *astronomy.EphemerisCtx,
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
	opts := scoreOptionsPanchangOptions(options)
	opts.Sections = scorerSections()
	opts.SectionsGiven = true

	p, ok, err := core.GetDailyPanchang(eph, dateMs, location, opts, core.NatalResolvers{})
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

func ComputeAuspiciousDatesInRange(ctx context.Context,
	eph *astronomy.EphemerisCtx,
	rule MuhurtaRule,
	startMs, endMs int64,
	location types.GeoLocation,
	options MuhurtaScoreOptions,
) ([]MuhurtaDay, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
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
	return ScoreCivilDays(ctx, eph, rule, startMs, endMs, location, options)
}

// scorerSections are the optional sections scoreFromPanchang reads: the
// eclipse, and the lunar windows that carry Bhadra. The angas at sunrise, the
// vara, the lunar month, Ganda Mula, Panchaka and the special yogas it also
// reads are computed whatever the sections.
func scorerSections() core.SectionSet {
	return core.Sections(core.SectionEclipse, core.SectionLunarWindows)
}

// ScoreCivilDays scores one day per civil date of options.Timezone from
// startMs to endMs, each at startMs's local time of day, best score first.
func ScoreCivilDays(ctx context.Context,
	eph *astronomy.EphemerisCtx,
	rule MuhurtaRule,
	startMs, endMs int64,
	location types.GeoLocation,
	options MuhurtaScoreOptions,
) ([]MuhurtaDay, error) {
	return scoreCivilDays(ctx, eph, rule, startMs, endMs, location, options,
		scoreOptionsPanchangOptions(options), true)
}

// scoreOnlyCivilDays is ScoreCivilDays for a caller that keeps only the
// scores, as BuildMuhurtaTable does: each day is built with the scorer's
// sections and no anga end times (the special yogas are found from the tithi
// and nakshatra spans either way), which scores it exactly as the full day
// does, and no MuhurtaDay keeps its Panchang.
func scoreOnlyCivilDays(ctx context.Context,
	eph *astronomy.EphemerisCtx,
	rule MuhurtaRule,
	startMs, endMs int64,
	location types.GeoLocation,
	options MuhurtaScoreOptions,
) ([]MuhurtaDay, error) {
	opts := scoreOptionsPanchangOptions(options)
	opts.Sections = scorerSections()
	opts.SectionsGiven = true
	computeEndTimes := false
	opts.ComputeEndTimes = &computeEndTimes
	return scoreCivilDays(ctx, eph, rule, startMs, endMs, location, options, opts, false)
}

func scoreCivilDays(ctx context.Context,
	eph *astronomy.EphemerisCtx,
	rule MuhurtaRule,
	startMs, endMs int64,
	location types.GeoLocation,
	options MuhurtaScoreOptions,
	opts types.PanchangOptions,
	keepPanchang bool,
) ([]MuhurtaDay, error) {
	out := []MuhurtaDay{}
	next, err := utils.CivilDayStepper(startMs, options.Timezone)
	if err != nil {
		return nil, err
	}
	for {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		t, err := next()
		if err != nil {
			return nil, err
		}
		if t > endMs {
			break
		}
		p, ok, err := core.GetDailyPanchang(eph, utils.ClampToSupported(t), location, opts, core.NatalResolvers{})
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
			day := MuhurtaDay{MuhurtaScore: result}
			if keepPanchang {
				day.Panchang = p
			}
			out = append(out, day)
		}
	}

	sort.SliceStable(out, func(i, j int) bool { return out[i].Score > out[j].Score })
	return out, nil
}

func scoreFromPanchang(p types.DailyPanchangResult, rule MuhurtaRule) (MuhurtaScore, error) {
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

	bhadraMode := ruleResolvedBhadra(rule)

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

	if ruleScoresVaraTithiYogas(rule) {
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

func ComputeAuspiciousDatesForYear(ctx context.Context,
	eph *astronomy.EphemerisCtx,
	year int,
	rule MuhurtaRule,
	location types.GeoLocation,
	options MuhurtaScoreOptions,
) ([]MuhurtaDay, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	startMs, endMs, err := utils.LocalYearWindow(year, options.Timezone)
	if err != nil {
		return nil, err
	}
	if err := utils.ValidateLocalYearWindow(year, startMs, endMs); err != nil {
		return nil, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return nil, err
	}
	return ScoreCivilDays(ctx, eph, rule, startMs, endMs, location, options)
}

func FindAuspiciousDates(
	ctx context.Context,
	eph *astronomy.EphemerisCtx,
	rule MuhurtaRule,
	startMs, endMs int64,
	location types.GeoLocation,
	options MuhurtaScoreOptions,
) ([]MuhurtaDay, error) {
	return ComputeAuspiciousDatesInRange(ctx, eph, rule, startMs, endMs, location, options)
}
