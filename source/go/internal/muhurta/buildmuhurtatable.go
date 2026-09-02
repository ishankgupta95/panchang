package muhurta

import (
	"sort"
	"strconv"
	"strings"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

type BuildMuhurtaTableOptions struct {
	Rule                  MuhurtaRule
	Location              types.GeoLocation
	TimezoneOffsetMinutes int
	StartYear             int
	EndYear               int
	IncludeFailures       bool
	Ayanamsa              types.AyanamsaType
	MasaSystem            types.MasaSystem
	Language              types.Language
	ReferenceLocation     string
	GeneratedAt           string
	Note                  *string
}

const DefaultMuhurtaNote = "Pre-computed muhurta table for one occasion at one location. Scores are " +
	"location- and rule-dependent, so a table built for one place and rule says " +
	"nothing about another."

type factorDictionary struct {
	entries []MuhurtaFactor
	index   map[string]int
}

func newFactorDictionary() *factorDictionary {
	return &factorDictionary{entries: []MuhurtaFactor{}, index: map[string]int{}}
}

func (d *factorDictionary) intern(f MuhurtaFactor) int {
	var b strings.Builder
	b.WriteString(f.Code)
	b.WriteByte('|')
	b.WriteString(string(f.Axis))
	b.WriteByte('|')
	if f.Index != nil {
		b.WriteString(strconv.Itoa(*f.Index))
	}
	b.WriteByte('|')
	b.WriteString(strconv.Itoa(f.Delta))
	id := b.String()
	if seen, ok := d.index[id]; ok {
		return seen
	}
	next := len(d.entries)
	d.entries = append(d.entries, f)
	d.index[id] = next
	return next
}

func BuildMuhurtaTable(
	ctx *astronomy.EphemerisCtx, opts BuildMuhurtaTableOptions,
) (MuhurtaFile, error) {
	ayanamsa := opts.Ayanamsa
	if ayanamsa == "" {
		ayanamsa = types.Lahiri
	}
	masaSystem := opts.MasaSystem
	if masaSystem == "" {
		masaSystem = types.Purnimanta
	}
	language := opts.Language
	if language == "" {
		language = types.LanguageEn
	}
	note := DefaultMuhurtaNote
	if opts.Note != nil {
		note = *opts.Note
	}

	if err := utils.ValidateLocation(opts.Location); err != nil {
		return MuhurtaFile{}, err
	}
	if opts.Rule.Occasion == "" {
		return MuhurtaFile{}, types.Codef(types.ErrInvalidInput,
			"BuildMuhurtaTable: Rule is required and must be a MuhurtaRule with an Occasion string")
	}
	if opts.StartYear > opts.EndYear {
		return MuhurtaFile{}, types.Codef(types.ErrInvalidInput,
			"startYear (%d) must be ≤ endYear (%d)", opts.StartYear, opts.EndYear)
	}

	dict := newFactorDictionary()
	years := map[string][]PackedMuhurtaTableDay{}

	for year := opts.StartYear; year <= opts.EndYear; year++ {
		off := int64(opts.TimezoneOffsetMinutes) * 60_000
		startMs := types.DateUTC(year, 0, 1).Ms() - off
		endMs := types.DateUTC(year, 11, 31).Ms() + dayMs - 1 - off

		scored, err := ComputeAuspiciousDatesInRange(ctx, opts.Rule, startMs, endMs, opts.Location,
			MuhurtaScoreOptions{
				Timezone:        types.TimezoneOffset(opts.TimezoneOffsetMinutes),
				Ayanamsa:        ayanamsa,
				MasaSystem:      masaSystem,
				Language:        language,
				IncludeFailures: true,
			})
		if err != nil {
			return MuhurtaFile{}, err
		}

		days := []PackedMuhurtaTableDay{}
		for _, day := range scored {
			if !opts.IncludeFailures && !day.Passes {
				continue
			}
			f := make([]int, 0, len(day.Factors))
			for _, factor := range day.Factors {
				f = append(f, dict.intern(factor))
			}
			p := 0
			if day.Passes {
				p = 1
			}
			days = append(days, PackedMuhurtaTableDay{
				Date: toDateKey(day.Date.Ms(), opts.TimezoneOffsetMinutes),
				S:    day.Score,
				P:    p,
				F:    f,
			})
		}
		sort.SliceStable(days, func(i, j int) bool {
			return strings.Compare(days[i].Date, days[j].Date) < 0
		})
		years[strconv.Itoa(year)] = days
	}

	meta := MuhurtaTableMeta{
		Format:                2,
		Occasion:              opts.Rule.Occasion,
		ReferenceLocation:     opts.ReferenceLocation,
		Latitude:              opts.Location.Latitude,
		Longitude:             opts.Location.Longitude,
		TimezoneOffsetMinutes: opts.TimezoneOffsetMinutes,
		Ayanamsa:              string(ayanamsa),
		MasaSystem:            string(masaSystem),
		StartYear:             opts.StartYear,
		EndYear:               opts.EndYear,
		IncludeFailures:       opts.IncludeFailures,
		GeneratedAt:           opts.GeneratedAt,
		Note:                  note,
	}
	if opts.Rule.Name != "" {
		meta.OccasionName = opts.Rule.Name
	}

	return MuhurtaFile{Meta: meta, Dict: dict.entries, Years: years}, nil
}
