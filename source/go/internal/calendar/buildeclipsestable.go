package calendar

import (
	"sort"
	"strconv"
	"strings"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
)

type BuildEclipsesTableOptions struct {
	Location              types.GeoLocation
	TimezoneOffsetMinutes int
	StartYear             int
	EndYear               int
	Languages             []FestivalsTableLanguage
	VisibleOnly           *bool
	ReferenceLocation     string
	GeneratedAt           string
	Note                  *string
}

const DefaultEclipsesNote = "Pre-computed eclipse table. Includes every eclipse observable from the " +
	"reference location during any phase (eclipsed body above the horizon " +
	"between first and last contact), so an eclipse already in progress at " +
	"moon/sunrise or moon/sunset is listed. `visibleAtPeak` flags whether the " +
	"peak itself is observable. Solar eclipses carry the subtype seen locally. " +
	"The sutak window is present only for eclipses that warrant it: visible " +
	"solar (all subtypes) and visible umbral lunar (partial/total). Penumbral " +
	"lunar eclipses carry no sutak and are not religiously observed " +
	"(reference almanac / pandit consensus). Times are ISO UTC."

var kindNoun = map[FestivalsTableLanguage]map[EclipseTableKind]string{
	TableLangEn: {EclipseSolar: "Solar Eclipse", EclipseLunar: "Lunar Eclipse"},
	TableLangHi: {EclipseSolar: "सूर्य ग्रहण", EclipseLunar: "चंद्र ग्रहण"},
}

var subtypeAdj = map[FestivalsTableLanguage]map[EclipseTableSubtype]string{
	TableLangEn: {
		EclipseTotal: "Total", EclipsePartial: "Partial",
		EclipseAnnular: "Annular", EclipsePenumbral: "Penumbral",
	},
	TableLangHi: {
		EclipseTotal: "पूर्ण", EclipsePartial: "आंशिक",
		EclipseAnnular: "वलयाकार", EclipsePenumbral: "उपच्छाया",
	},
}

func localizedEclipseName(
	kind EclipseTableKind, subtype EclipseTableSubtype, lang FestivalsTableLanguage,
) string {
	return subtypeAdj[lang][subtype] + " " + kindNoun[lang][kind]
}

func localizedEclipseDescription(
	kind EclipseTableKind, subtype EclipseTableSubtype,
	obscuration float64, lang FestivalsTableLanguage,
) string {
	name := localizedEclipseName(kind, subtype, lang)
	if subtype == EclipsePenumbral {
		if lang == TableLangHi {
			return name + ": केवल उपच्छाया छाया; सूतक नहीं।"
		}
		return name + ": penumbral shadow only; no sutak."
	}
	pct := int(jsnum.Round(obscuration * 100))
	if lang == TableLangHi {
		return name + ": " + strconv.Itoa(pct) + "% ग्रास।"
	}
	return name + ": " + strconv.Itoa(pct) + "% obscuration."
}

func makeEclipseEntry(
	e astronomy.EclipseInfo, anyPhaseVisible bool, languages []FestivalsTableLanguage,
) EclipseTableEntryRaw {
	kind := EclipseTableKind(e.Kind)
	subtype := EclipseTableSubtype(e.Subtype)

	namePairs := make([]LocalizedPair, 0, len(languages))
	descPairs := make([]LocalizedPair, 0, len(languages))
	for _, lang := range languages {
		namePairs = append(namePairs, LocalizedPair{
			Lang: lang, Value: localizedEclipseName(kind, subtype, lang),
		})
		descPairs = append(descPairs, LocalizedPair{
			Lang:  lang,
			Value: localizedEclipseDescription(kind, subtype, e.Obscuration, lang),
		})
	}
	desc := Localized(descPairs...)

	entry := EclipseTableEntryRaw{
		Name:                Localized(namePairs...),
		Kind:                kind,
		Subtype:             subtype,
		Start:               e.StartMs.ISOString(),
		Peak:                e.PeakMs.ISOString(),
		End:                 e.EndMs.ISOString(),
		Obscuration:         e.Obscuration,
		Magnitude:           e.Magnitude,
		VisibleFromLocation: anyPhaseVisible,
		VisibleAtPeak:       e.VisibleFromLocation,
		Description:         &desc,
	}
	if anyPhaseVisible && subtype != EclipsePenumbral &&
		e.SutakStartMs != nil && e.SutakEndMs != nil {
		entry.Sutak = &EclipseSutak{
			Start: e.SutakStartMs.ISOString(),
			End:   e.SutakEndMs.ISOString(),
		}
	}
	return entry
}

func BuildEclipsesTable(
	ctx *astronomy.EphemerisCtx, opts BuildEclipsesTableOptions,
) (EclipsesFile, error) {
	languages := opts.Languages
	if languages == nil {
		languages = AllTableLanguages
	}
	visibleOnly := true
	if opts.VisibleOnly != nil {
		visibleOnly = *opts.VisibleOnly
	}
	note := DefaultEclipsesNote
	if opts.Note != nil {
		note = *opts.Note
	}

	if opts.StartYear > opts.EndYear {
		return EclipsesFile{}, types.Codef(types.ErrInvalidInput,
			"startYear (%d) must be ≤ endYear (%d)", opts.StartYear, opts.EndYear)
	}
	if len(languages) == 0 {
		return EclipsesFile{}, types.Codef(types.ErrInvalidInput,
			"languages must contain at least one locale")
	}

	windowStartMs := types.DateUTC(opts.StartYear, 0, 1).Ms() - 2*dayMs
	windowEndMs := types.DateUTC(opts.EndYear, 11, 31).Ms() + dayMs - 1 + 2*dayMs

	all, err := ComputeEclipsesInRange(ctx, windowStartMs, windowEndMs, opts.Location)
	if err != nil {
		return EclipsesFile{}, err
	}
	type visibleEclipse struct {
		e        astronomy.EclipseInfo
		anyPhase bool
	}
	eclipses := make([]visibleEclipse, 0, len(all))
	for _, e := range all {
		anyPhase := astronomy.IsEclipseVisibleAnyPhase(ctx, e, opts.Location)
		if !visibleOnly || anyPhase {
			eclipses = append(eclipses, visibleEclipse{e: e, anyPhase: anyPhase})
		}
	}

	byYear := map[string]map[string][]EclipseTableEntryRaw{}
	yearOrder := []string{}
	for year := opts.StartYear; year <= opts.EndYear; year++ {
		key := strconv.Itoa(year)
		byYear[key] = map[string][]EclipseTableEntryRaw{}
		yearOrder = append(yearOrder, key)
	}
	dateOrder := map[string][]string{}

	for _, ve := range eclipses {
		key := tableDateKey(ve.e.PeakMs.Ms(), opts.TimezoneOffsetMinutes)
		buckets, ok := byYear[key[:4]]
		if !ok {
			continue
		}
		if _, seen := buckets[key]; !seen {
			dateOrder[key[:4]] = append(dateOrder[key[:4]], key)
		}
		buckets[key] = append(buckets[key], makeEclipseEntry(ve.e, ve.anyPhase, languages))
	}

	years := map[string][]RawEclipseTableDay{}
	for _, yearKey := range yearOrder {
		dates := make([]string, len(dateOrder[yearKey]))
		copy(dates, dateOrder[yearKey])
		sort.Slice(dates, func(i, j int) bool { return strings.Compare(dates[i], dates[j]) < 0 })
		days := make([]RawEclipseTableDay, 0, len(dates))
		for _, date := range dates {
			days = append(days, RawEclipseTableDay{
				Date: date, Eclipses: byYear[yearKey][date],
			})
		}
		years[yearKey] = days
	}

	langs := make([]FestivalsTableLanguage, len(languages))
	copy(langs, languages)
	return EclipsesFile{
		Meta: EclipseTableMeta{
			ReferenceLocation:     opts.ReferenceLocation,
			Latitude:              opts.Location.Latitude,
			Longitude:             opts.Location.Longitude,
			TimezoneOffsetMinutes: opts.TimezoneOffsetMinutes,
			VisibleOnly:           visibleOnly,
			Languages:             langs,
			StartYear:             opts.StartYear,
			EndYear:               opts.EndYear,
			GeneratedAt:           opts.GeneratedAt,
			Note:                  note,
		},
		Years: years,
	}, nil
}
