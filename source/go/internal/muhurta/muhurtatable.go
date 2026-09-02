package muhurta

import (
	"sort"
	"strconv"
	"strings"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

type MuhurtaYearRange struct {
	Start int `json:"start"`
	End   int `json:"end"`
}

func ReadMuhurtaYearRange(source MuhurtaFile) MuhurtaYearRange {
	return MuhurtaYearRange{Start: source.Meta.StartYear, End: source.Meta.EndYear}
}

func ReadMuhurtaOccasion(source MuhurtaFile) string { return source.Meta.Occasion }

func flatten(source MuhurtaFile, yearKey string) ([]MuhurtaTableDay, bool) {
	days, ok := source.Years[yearKey]
	if !ok {
		return nil, false
	}
	out := make([]MuhurtaTableDay, 0, len(days))
	for _, d := range days {
		factors := make([]MuhurtaFactor, 0, len(d.F))
		for _, i := range d.F {
			if i >= 0 && i < len(source.Dict) {
				factors = append(factors, source.Dict[i])
			}
		}
		out = append(out, MuhurtaTableDay{
			Date: d.Date, Score: d.S, Passes: d.P == 1, Factors: factors,
		})
	}
	return out, true
}

func ReadMuhurtaForYear(source MuhurtaFile, year int) ([]MuhurtaTableDay, bool) {
	return flatten(source, strconv.Itoa(year))
}

func ReadMuhurtaForDateKey(source MuhurtaFile, key string) (MuhurtaTableDay, bool) {
	if len(key) < 4 {
		return MuhurtaTableDay{}, false
	}
	days, ok := flatten(source, key[:4])
	if !ok {
		return MuhurtaTableDay{}, false
	}
	for _, d := range days {
		if d.Date == key {
			return d, true
		}
	}
	return MuhurtaTableDay{}, false
}

func ReadMuhurtaForDate(source MuhurtaFile, dateMs int64) (MuhurtaTableDay, bool) {
	return ReadMuhurtaForDateKey(source, toDateKey(dateMs, source.Meta.TimezoneOffsetMinutes))
}

func ReadBestMuhurtaDays(source MuhurtaFile, limit int) []MuhurtaTableDay {
	all := []MuhurtaTableDay{}
	keys := make([]string, 0, len(source.Years))
	for k := range source.Years {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, yearKey := range keys {
		if days, ok := flatten(source, yearKey); ok {
			all = append(all, days...)
		}
	}
	sort.SliceStable(all, func(i, j int) bool {
		if all[i].Score != all[j].Score {
			return all[i].Score > all[j].Score
		}
		return strings.Compare(all[i].Date, all[j].Date) < 0
	})
	if limit < 0 {
		limit = 0
	}
	if limit > len(all) {
		limit = len(all)
	}
	return all[:limit]
}

func toDateKey(ms int64, offsetMinutes int) string {
	shifted := types.Date(ms + int64(offsetMinutes)*60_000)
	var b strings.Builder
	b.Grow(10)
	b.WriteString(strconv.Itoa(shifted.UTCFullYear()))
	b.WriteByte('-')
	b.WriteString(pad2(shifted.UTCMonth() + 1))
	b.WriteByte('-')
	b.WriteString(pad2(shifted.UTCDate()))
	return b.String()
}

func pad2(n int) string {
	s := strconv.Itoa(n)
	if len(s) < 2 {
		return "0" + s
	}
	return s
}
