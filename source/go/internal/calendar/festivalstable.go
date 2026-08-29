package calendar

func ReadFestivalsYearRange(source AnyFestivalsFile) MuhurtaYearRangeLike {
	return MuhurtaYearRangeLike{Start: source.Meta.StartYear, End: source.Meta.EndYear}
}

type MuhurtaYearRangeLike struct {
	Start int `json:"start"`
	End   int `json:"end"`
}

func flattenDict(entry FestivalDictEntry, lang FestivalsTableLanguage) FestivalTableEntry {
	out := FestivalTableEntry{
		Key:  entry.Key,
		Name: entry.Name.Pick(lang),
		Type: entry.Type,
	}
	if entry.Description != nil {
		out.Description = entry.Description.Pick(lang)
		out.HasDescription = true
	}
	return out
}

// v1 tables predate the stable key.
func flattenV1(raw FestivalTableEntryRaw, lang FestivalsTableLanguage) FestivalTableEntry {
	out := FestivalTableEntry{Key: "", Name: raw.Name.Pick(lang), Type: raw.Type}
	if raw.Description != nil {
		out.Description = raw.Description.Pick(lang)
		out.HasDescription = true
	}
	return out
}

func festivalDaysFor(
	source AnyFestivalsFile, yearKey string, lang FestivalsTableLanguage,
) ([]FestivalTableDay, bool) {
	if source.IsPacked {
		days, ok := source.Packed[yearKey]
		// null under a present key means a missing year.
		if !ok || days == nil {
			return nil, false
		}
		out := make([]FestivalTableDay, 0, len(days))
		for _, d := range days {
			entries := make([]FestivalTableEntry, 0, len(d.Festivals))
			for _, i := range d.Festivals {
				if i >= 0 && i < len(source.Dict) {
					entries = append(entries, flattenDict(source.Dict[i], lang))
				}
			}
			out = append(out, FestivalTableDay{Date: d.Date, Festivals: entries})
		}
		return out, true
	}
	days, ok := source.Raw[yearKey]
	if !ok || days == nil {
		return nil, false
	}
	out := make([]FestivalTableDay, 0, len(days))
	for _, d := range days {
		entries := make([]FestivalTableEntry, 0, len(d.Festivals))
		for _, f := range d.Festivals {
			entries = append(entries, flattenV1(f, lang))
		}
		out = append(out, FestivalTableDay{Date: d.Date, Festivals: entries})
	}
	return out, true
}

func ReadFestivalsForYear(
	source AnyFestivalsFile, year int, lang FestivalsTableLanguage,
) ([]FestivalTableDay, bool) {
	return festivalDaysFor(source, itoa(year), lang)
}

func ReadFestivalsForDateKey(
	source AnyFestivalsFile, key string, lang FestivalsTableLanguage,
) []FestivalTableEntry {
	if len(key) < 4 {
		return []FestivalTableEntry{}
	}
	days, ok := festivalDaysFor(source, key[:4], lang)
	if !ok {
		return []FestivalTableEntry{}
	}
	for _, d := range days {
		if d.Date == key {
			return d.Festivals
		}
	}
	return []FestivalTableEntry{}
}

func ReadFestivalsForDate(
	source AnyFestivalsFile, dateMs int64, lang FestivalsTableLanguage,
) []FestivalTableEntry {
	return ReadFestivalsForDateKey(source,
		tableDateKey(dateMs, source.Meta.TimezoneOffsetMinutes), lang)
}
