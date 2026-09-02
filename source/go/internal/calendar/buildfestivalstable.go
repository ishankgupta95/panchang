package calendar

import (
	"encoding/json"
	"sort"
	"strconv"
	"strings"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/core"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
)

type BuildFestivalsTableOptions struct {
	Location              types.GeoLocation
	TimezoneOffsetMinutes int
	StartYear             int
	EndYear               int
	Languages             []FestivalsTableLanguage
	Ayanamsa              types.AyanamsaType
	MasaSystem            types.MasaSystem
	Region                types.FestivalRegion
	ReferenceLocation     string
	GeneratedAt           string
	Note                  *string
	RegionAliasWarner     core.RegionAliasWarner
}

const DefaultFestivalsNote = "Pre-computed festival table. Eclipses are excluded because visibility " +
	"is location-dependent; use getUpcomingEclipses for those."

type festivalDictionary struct {
	entries []FestivalDictEntry
	index   map[string]int
}

func newFestivalDictionary() *festivalDictionary {
	return &festivalDictionary{entries: []FestivalDictEntry{}, index: map[string]int{}}
}

func (d *festivalDictionary) intern(entry FestivalDictEntry) int {
	tuple := []any{entry.Key, entry.Type, entry.Name, entry.Description}
	raw, err := json.Marshal(tuple)
	if err != nil {
		panic("calendar: interning a festival entry: " + err.Error())
	}
	id := string(raw)
	if seen, ok := d.index[id]; ok {
		return seen
	}
	next := len(d.entries)
	d.entries = append(d.entries, entry)
	d.index[id] = next
	return next
}

func BuildFestivalsTable(
	ctx *astronomy.EphemerisCtx, opts BuildFestivalsTableOptions,
) (FestivalsFile, error) {
	languages := opts.Languages
	if languages == nil {
		languages = AllTableLanguages
	}
	ayanamsa := opts.Ayanamsa
	if ayanamsa == "" {
		ayanamsa = types.Lahiri
	}
	masaSystem := opts.MasaSystem
	if masaSystem == "" {
		masaSystem = types.Purnimanta
	}
	region := opts.Region
	if region == "" {
		region = types.RegionAll
	}
	note := DefaultFestivalsNote
	if opts.Note != nil {
		note = *opts.Note
	}

	if opts.StartYear > opts.EndYear {
		return FestivalsFile{}, types.Codef(types.ErrInvalidInput,
			"startYear (%d) must be ≤ endYear (%d)", opts.StartYear, opts.EndYear)
	}
	if len(languages) == 0 {
		return FestivalsFile{}, types.Codef(types.ErrInvalidInput,
			"languages must contain at least one locale")
	}

	years := map[string][]PackedFestivalTableDay{}
	dict := newFestivalDictionary()

	for year := opts.StartYear; year <= opts.EndYear; year++ {
		days, err := buildFestivalYear(ctx, year, opts.Location, opts.TimezoneOffsetMinutes,
			languages, ayanamsa, masaSystem, region, opts.RegionAliasWarner, dict)
		if err != nil {
			return FestivalsFile{}, err
		}
		years[strconv.Itoa(year)] = days
	}

	langs := make([]FestivalsTableLanguage, len(languages))
	copy(langs, languages)
	return FestivalsFile{
		Meta: FestivalTableMeta{
			Format:                2,
			ReferenceLocation:     opts.ReferenceLocation,
			Latitude:              opts.Location.Latitude,
			Longitude:             opts.Location.Longitude,
			TimezoneOffsetMinutes: opts.TimezoneOffsetMinutes,
			Ayanamsa:              string(ayanamsa),
			MasaSystem:            string(masaSystem),
			Region:                string(region),
			Languages:             langs,
			StartYear:             opts.StartYear,
			EndYear:               opts.EndYear,
			GeneratedAt:           opts.GeneratedAt,
			Note:                  note,
		},
		Dict:  dict.entries,
		Years: years,
	}, nil
}

func buildFestivalYear(
	ctx *astronomy.EphemerisCtx,
	year int,
	location types.GeoLocation,
	offsetMinutes int,
	languages []FestivalsTableLanguage,
	ayanamsa types.AyanamsaType,
	masaSystem types.MasaSystem,
	region types.FestivalRegion,
	warner core.RegionAliasWarner,
	dict *festivalDictionary,
) ([]PackedFestivalTableDay, error) {
	startMs := types.DateUTC(year, 0, 1).Ms()
	endMs := types.DateUTC(year, 11, 31).Ms()

	runs := make([][]FestivalDay, len(languages))
	for i, language := range languages {
		run, err := ComputeFestivalsInRange(ctx, startMs, endMs, location, YearlyListingOptions{
			Timezone:          types.TimezoneOffset(offsetMinutes),
			Ayanamsa:          ayanamsa,
			MasaSystem:        masaSystem,
			Region:            region,
			Language:          types.Language(language),
			RegionAliasWarner: warner,
		})
		if err != nil {
			return nil, err
		}
		runs[i] = run
	}

	length := len(runs[0])
	for i := 1; i < len(runs); i++ {
		if len(runs[i]) != length {
			return nil, types.Codef(types.ErrInvalidInput,
				"language-run length mismatch for %d: %s=%d %s=%d",
				year, languages[0], length, languages[i], len(runs[i]))
		}
	}

	byDate := map[string][]int{}
	order := []string{}
	for i := 0; i < length; i++ {
		base := runs[0][i]
		if base.Festival.Type == types.FestivalEclipse {
			continue
		}

		namePairs := make([]LocalizedPair, 0, len(languages))
		descPairs := make([]LocalizedPair, 0, len(languages))
		for l := 0; l < len(languages); l++ {
			f := runs[l][i].Festival
			namePairs = append(namePairs, LocalizedPair{Lang: languages[l], Value: f.Name})
			if f.Description != "" {
				descPairs = append(descPairs, LocalizedPair{Lang: languages[l], Value: f.Description})
			}
		}

		entry := FestivalDictEntry{
			Key:  base.Festival.Key,
			Type: FestivalsTableType(base.Festival.Type),
			Name: Localized(namePairs...),
		}
		if len(descPairs) > 0 {
			d := Localized(descPairs...)
			entry.Description = &d
		}

		dateKey := tableDateKey(base.Date.Ms(), offsetMinutes)
		if _, seen := byDate[dateKey]; !seen {
			order = append(order, dateKey)
		}
		byDate[dateKey] = append(byDate[dateKey], dict.intern(entry))
	}

	sorted := make([]string, len(order))
	copy(sorted, order)
	sort.Slice(sorted, func(i, j int) bool {
		return strings.Compare(sorted[i], sorted[j]) < 0
	})
	out := make([]PackedFestivalTableDay, 0, len(sorted))
	for _, date := range sorted {
		out = append(out, PackedFestivalTableDay{Date: date, Festivals: byDate[date]})
	}
	return out, nil
}
