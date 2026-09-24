package calendar

import "github.com/ishankgupta95/panchang/source/go/v5/types"

func ReadMoonPhasesYearRange(source AnyMoonPhasesFile) TableYearRange {
	return TableYearRange{Start: source.Meta.StartYear, End: source.Meta.EndYear}
}

func flattenMoonPhaseDict(
	entry MoonPhaseDictEntry, epochMs int64, lang FestivalsTableLanguage,
) MoonPhaseTableEntry {
	out := MoonPhaseTableEntry{
		Name:  entry.Name.Pick(lang),
		Phase: entry.Phase,
		Time:  types.Date(epochMs).ISOString(),
	}
	out.Description = pickDescription(entry.Description, lang)
	return out
}

func flattenMoonPhaseV1(
	raw MoonPhaseTableEntryRaw, lang FestivalsTableLanguage,
) MoonPhaseTableEntry {
	out := MoonPhaseTableEntry{
		Name: raw.Name.Pick(lang), Phase: raw.Phase, Time: raw.Time,
	}
	out.Description = pickDescription(raw.Description, lang)
	return out
}

func moonPhaseDaysFor(
	source AnyMoonPhasesFile, yearKey string, lang FestivalsTableLanguage,
) ([]MoonPhaseTableDay, bool) {
	if source.IsPacked {
		days, ok := source.Packed[yearKey]
		if !ok || days == nil {
			return nil, false
		}
		out := make([]MoonPhaseTableDay, 0, len(days))
		for _, d := range days {
			phases := make([]MoonPhaseTableEntry, 0, len(d.Phases))
			for _, p := range d.Phases {
				if p.I >= 0 && p.I < len(source.Dict) {
					phases = append(phases, flattenMoonPhaseDict(source.Dict[p.I], p.T, lang))
				}
			}
			out = append(out, MoonPhaseTableDay{Date: d.Date, Phases: phases})
		}
		return out, true
	}
	days, ok := source.Raw[yearKey]
	if !ok || days == nil {
		return nil, false
	}
	out := make([]MoonPhaseTableDay, 0, len(days))
	for _, d := range days {
		phases := make([]MoonPhaseTableEntry, 0, len(d.Phases))
		for _, p := range d.Phases {
			phases = append(phases, flattenMoonPhaseV1(p, lang))
		}
		out = append(out, MoonPhaseTableDay{Date: d.Date, Phases: phases})
	}
	return out, true
}

func ReadMoonPhasesForYear(
	source AnyMoonPhasesFile, year int, lang FestivalsTableLanguage,
) ([]MoonPhaseTableDay, bool) {
	return moonPhaseDaysFor(source, itoa(year), lang)
}

func ReadMoonPhasesForDateKey(
	source AnyMoonPhasesFile, key string, lang FestivalsTableLanguage,
) []MoonPhaseTableEntry {
	if len(key) < 4 {
		return []MoonPhaseTableEntry{}
	}
	days, ok := moonPhaseDaysFor(source, key[:4], lang)
	if !ok {
		return []MoonPhaseTableEntry{}
	}
	for _, d := range days {
		if d.Date == key {
			return d.Phases
		}
	}
	return []MoonPhaseTableEntry{}
}

func ReadMoonPhasesForDate(
	source AnyMoonPhasesFile, dateMs int64, lang FestivalsTableLanguage,
) []MoonPhaseTableEntry {
	return ReadMoonPhasesForDateKey(source,
		tableDateKey(dateMs, source.Meta.TimezoneOffsetMinutes), lang)
}
