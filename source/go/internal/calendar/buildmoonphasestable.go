package calendar

import (
	"context"
	"sort"
	"strconv"
	"strings"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

const DefaultMoonPhasesNote = "Pre-computed Moon-phase table (new / first quarter / full / last quarter). " +
	"Phases are astronomical instants, the same worldwide; the date column is " +
	"the instant mapped to the table timezone. New moon = Amavasya, full moon = " +
	"Purnima. These are precise instants, distinct from the same-named tithis " +
	"(which are ~24h windows). Times are ISO UTC."

var phaseName = map[FestivalsTableLanguage]map[MoonPhaseTableName]string{
	TableLangEn: {
		PhaseNew: "New Moon", PhaseFirstQuarter: "First Quarter",
		PhaseFull: "Full Moon", PhaseLastQuarter: "Last Quarter",
	},
	TableLangHi: {
		PhaseNew: "अमावस्या", PhaseFirstQuarter: "शुक्ल पक्ष अर्धचंद्र",
		PhaseFull: "पूर्णिमा", PhaseLastQuarter: "कृष्ण पक्ष अर्धचंद्र",
	},
}

var phaseDesc = map[FestivalsTableLanguage]map[MoonPhaseTableName]string{
	TableLangEn: {
		PhaseNew:          "New moon (Amavasya).",
		PhaseFirstQuarter: "First quarter: waxing half moon.",
		PhaseFull:         "Full moon (Purnima).",
		PhaseLastQuarter:  "Last quarter: waning half moon.",
	},
	TableLangHi: {
		PhaseNew:          "अमावस्या: नया चंद्रमा।",
		PhaseFirstQuarter: "शुक्ल पक्ष अर्धचंद्र।",
		PhaseFull:         "पूर्णिमा: पूर्ण चंद्रमा।",
		PhaseLastQuarter:  "कृष्ण पक्ष अर्धचंद्र।",
	},
}

func makeMoonPhaseDictEntry(
	phase MoonPhaseTableName, languages []FestivalsTableLanguage,
) MoonPhaseDictEntry {
	namePairs := make([]LocalizedPair, 0, len(languages))
	descPairs := make([]LocalizedPair, 0, len(languages))
	for _, lang := range languages {
		namePairs = append(namePairs, LocalizedPair{Lang: lang, Value: phaseName[lang][phase]})
		descPairs = append(descPairs, LocalizedPair{Lang: lang, Value: phaseDesc[lang][phase]})
	}
	desc := Localized(descPairs...)
	return MoonPhaseDictEntry{Phase: phase, Name: Localized(namePairs...), Description: &desc}
}

func BuildMoonPhasesTable(ctx context.Context,
	eph *astronomy.EphemerisCtx, opts BuildMoonPhasesTableOptions,
) (MoonPhasesFile, error) {
	if err := ctx.Err(); err != nil {
		return MoonPhasesFile{}, err
	}
	languages := opts.Languages
	if languages == nil {
		languages = AllTableLanguages
	}
	note := DefaultMoonPhasesNote
	if opts.Note != nil {
		note = *opts.Note
	}

	if opts.StartYear > opts.EndYear {
		return MoonPhasesFile{}, types.Codef(types.ErrInvalidInput,
			"startYear (%d) must be ≤ endYear (%d)", opts.StartYear, opts.EndYear)
	}
	if len(languages) == 0 {
		return MoonPhasesFile{}, types.Codef(types.ErrInvalidInput,
			"languages must contain at least one locale")
	}
	if err := checkTableLanguages(languages); err != nil {
		return MoonPhasesFile{}, err
	}
	if _, err := utils.ResolveUtcOffset(types.TimezoneOffset(opts.TimezoneOffsetMinutes), 0); err != nil {
		return MoonPhasesFile{}, err
	}

	windowStartMs, windowEndMs := utils.PaddedYearWindow(opts.StartYear, opts.EndYear)

	events, err := astronomy.ComputeMoonPhasesInRange(ctx, eph, windowStartMs, windowEndMs)
	if err != nil {
		return MoonPhasesFile{}, err
	}

	dict := make([]MoonPhaseDictEntry, 0, len(PhaseOrder))
	dictIndex := map[MoonPhaseTableName]int{}
	for i, phase := range PhaseOrder {
		if err := ctx.Err(); err != nil {
			return MoonPhasesFile{}, err
		}
		dict = append(dict, makeMoonPhaseDictEntry(phase, languages))
		dictIndex[phase] = i
	}

	byYear := map[string]map[string][]PackedMoonPhaseEvent{}
	yearOrder := []string{}
	for year := opts.StartYear; year <= opts.EndYear; year++ {
		key := strconv.Itoa(year)
		byYear[key] = map[string][]PackedMoonPhaseEvent{}
		yearOrder = append(yearOrder, key)
	}
	dateOrder := map[string][]string{}

	for _, ev := range events {
		key := tableDateKey(ev.TimeMs.Ms(), opts.TimezoneOffsetMinutes)
		buckets, ok := byYear[key[:4]]
		if !ok {
			continue
		}
		if _, seen := buckets[key]; !seen {
			dateOrder[key[:4]] = append(dateOrder[key[:4]], key)
		}
		phase := MoonPhaseTableName(ev.Phase)
		idx, ok := dictIndex[phase]
		if !ok {
			return MoonPhasesFile{}, types.Codef(types.ErrInvalidInput,
				"moon phase %q is not one of the four in PhaseOrder", phase)
		}
		buckets[key] = append(buckets[key], PackedMoonPhaseEvent{I: idx, T: ev.TimeMs.Ms()})
	}

	years := map[string][]PackedMoonPhaseTableDay{}
	for _, yearKey := range yearOrder {
		dates := make([]string, len(dateOrder[yearKey]))
		copy(dates, dateOrder[yearKey])
		sort.Slice(dates, func(i, j int) bool { return strings.Compare(dates[i], dates[j]) < 0 })
		days := make([]PackedMoonPhaseTableDay, 0, len(dates))
		for _, date := range dates {
			days = append(days, PackedMoonPhaseTableDay{
				Date: date, Phases: byYear[yearKey][date],
			})
		}
		years[yearKey] = days
	}

	langs := make([]FestivalsTableLanguage, len(languages))
	copy(langs, languages)
	return MoonPhasesFile{
		Meta: MoonPhaseTableMeta{
			Format:                2,
			ReferenceLocation:     opts.ReferenceLocation,
			TimezoneOffsetMinutes: opts.TimezoneOffsetMinutes,
			Languages:             langs,
			StartYear:             opts.StartYear,
			EndYear:               opts.EndYear,
			GeneratedAt:           opts.GeneratedAt,
			Note:                  note,
		},
		Dict:  dict,
		Years: years,
	}, nil
}
