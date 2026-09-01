package calendar

func ReadEclipsesYearRange(source EclipsesFile) MuhurtaYearRangeLike {
	return MuhurtaYearRangeLike{Start: source.Meta.StartYear, End: source.Meta.EndYear}
}

func flattenEclipse(raw EclipseTableEntryRaw, lang FestivalsTableLanguage) EclipseTableEntry {
	out := EclipseTableEntry{
		Name:                raw.Name.Pick(lang),
		Kind:                raw.Kind,
		Subtype:             raw.Subtype,
		Start:               raw.Start,
		Peak:                raw.Peak,
		End:                 raw.End,
		Obscuration:         raw.Obscuration,
		Magnitude:           raw.Magnitude,
		VisibleFromLocation: raw.VisibleFromLocation,
		VisibleAtPeak:       raw.VisibleAtPeak,
	}
	if raw.Sutak != nil {
		s := *raw.Sutak
		out.Sutak = &s
	}
	if raw.Description != nil {
		out.Description = raw.Description.Pick(lang)
		out.HasDescription = true
	}
	return out
}

func ReadEclipsesForYear(
	source EclipsesFile, year int, lang FestivalsTableLanguage,
) ([]EclipseTableDay, bool) {
	days, ok := source.Years[itoa(year)]
	if !ok || days == nil {
		return nil, false
	}
	out := make([]EclipseTableDay, 0, len(days))
	for _, d := range days {
		entries := make([]EclipseTableEntry, 0, len(d.Eclipses))
		for _, e := range d.Eclipses {
			entries = append(entries, flattenEclipse(e, lang))
		}
		out = append(out, EclipseTableDay{Date: d.Date, Eclipses: entries})
	}
	return out, true
}

func ReadEclipsesForDateKey(
	source EclipsesFile, key string, lang FestivalsTableLanguage,
) []EclipseTableEntry {
	if len(key) < 4 {
		return []EclipseTableEntry{}
	}
	days, ok := source.Years[key[:4]]
	if !ok {
		return []EclipseTableEntry{}
	}
	for _, d := range days {
		if d.Date == key {
			out := make([]EclipseTableEntry, 0, len(d.Eclipses))
			for _, e := range d.Eclipses {
				out = append(out, flattenEclipse(e, lang))
			}
			return out
		}
	}
	return []EclipseTableEntry{}
}

func ReadEclipsesForDate(
	source EclipsesFile, dateMs int64, lang FestivalsTableLanguage,
) []EclipseTableEntry {
	return ReadEclipsesForDateKey(source,
		tableDateKey(dateMs, source.Meta.TimezoneOffsetMinutes), lang)
}
