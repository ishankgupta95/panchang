package core

import (
	"encoding/json"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

type tsSlotWindow struct {
	Start types.JSDate `json:"start"`
	End   types.JSDate `json:"end"`
}

type tsQualitySlot struct {
	tsSlotWindow
	Index       int                     `json:"index"`
	Name        string                  `json:"name"`
	Quality     types.ChoghadiyaQuality `json:"quality"`
	QualityName string                  `json:"qualityName"`
}

type tsHoraSlot struct {
	tsSlotWindow
	PlanetIndex int    `json:"planetIndex"`
	Planet      string `json:"planet"`
}

type slotsGolden struct {
	Cases []struct {
		Day         string         `json:"day"`
		Vara        int            `json:"vara"`
		Lang        types.Language `json:"lang"`
		Sunrise     int64          `json:"sunrise"`
		Sunset      int64          `json:"sunset"`
		NextSunrise int64          `json:"nextSunrise"`
		Choghadiya  struct {
			Day   []tsQualitySlot `json:"day"`
			Night []tsQualitySlot `json:"night"`
		} `json:"choghadiya"`
		Hora struct {
			Day   []tsHoraSlot `json:"day"`
			Night []tsHoraSlot `json:"night"`
		} `json:"hora"`
		Gowri struct {
			Day   []tsQualitySlot `json:"day"`
			Night []tsQualitySlot `json:"night"`
		} `json:"gowri"`
		DoGhati struct {
			Day   []tsQualitySlot `json:"day"`
			Night []tsQualitySlot `json:"night"`
		} `json:"doGhati"`
	} `json:"cases"`
}

func loadSlotsGolden(t *testing.T) slotsGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "core", "slots-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g slotsGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.Cases) == 0 {
		t.Fatal("golden is empty")
	}
	return g
}

func qualityFn(lang types.Language) func(types.ChoghadiyaQuality) string {
	t := i18n.GetTranslations(lang)
	return func(q types.ChoghadiyaQuality) string { return t.Quality(q) }
}

type qslot struct {
	startMs, endMs int64
	index          int
	name           string
	quality        types.ChoghadiyaQuality
	qualityName    string
}

func choghadiyaQslots(in []types.UnlocalizedChoghadiyaSlot) []qslot {
	out := make([]qslot, len(in))
	for i, s := range in {
		out[i] = qslot{s.StartMs, s.EndMs, s.Index, s.Name, s.Quality, s.QualityName}
	}
	return out
}

func gowriQslots(in []types.UnlocalizedGowriSlot) []qslot {
	out := make([]qslot, len(in))
	for i, s := range in {
		out[i] = qslot{s.StartMs, s.EndMs, s.Index, s.Name, s.Quality, s.QualityName}
	}
	return out
}

func doGhatiQslots(in []types.UnlocalizedDoGhatiSlot) []qslot {
	out := make([]qslot, len(in))
	for i, s := range in {
		out[i] = qslot{s.StartMs, s.EndMs, s.Index, s.Name, s.Quality, s.QualityName}
	}
	return out
}

func TestSlotSystemsMatchTypeScript(t *testing.T) {
	g := loadSlotsGolden(t)

	varas := map[int]bool{}
	langs := map[types.Language]bool{}
	days := map[string]bool{}
	chogIdx, gowriIdx, doGhatiIdx, planetIdx := map[int]bool{}, map[int]bool{}, map[int]bool{}, map[int]bool{}
	qualities := map[types.ChoghadiyaQuality]bool{}

	for ci, c := range g.Cases {
		tr := i18n.GetTranslations(c.Lang)
		qn := qualityFn(c.Lang)

		chog := ComputeChoghadiya(c.Sunrise, c.Sunset, c.NextSunrise, c.Vara,
			func(i int) string { return tr.ChoghadiyaNames[i] }, qn)
		hora := ComputeHora(c.Sunrise, c.Sunset, c.NextSunrise, c.Vara,
			func(i int) string { return tr.GrahaNames[i] })
		gowri := ComputeGowriPanchangam(c.Sunrise, c.Sunset, c.NextSunrise, c.Vara,
			func(i int) string { return tr.GowriNames[i] }, qn)
		doGhati := ComputeDoGhati(c.Sunrise, c.Sunset, c.NextSunrise,
			func(i int) string { return tr.DoGhatiNames[i] }, qn)

		label := func(system, half string) string {
			return system + "/" + half + " " + c.Day + " vara=" + string(rune('0'+c.Vara)) + " " + string(c.Lang)
		}

		checkQuality := func(name string, got []qslot, want []tsQualitySlot) {
			t.Helper()
			if len(got) != len(want) {
				t.Fatalf("case %d %s: %d slots, want %d", ci, name, len(got), len(want))
			}
			for i := range got {
				w := want[i]
				if got[i].startMs != w.Start.Ms() || got[i].endMs != w.End.Ms() {
					t.Errorf("case %d %s[%d]: window %d..%d, want %d..%d",
						ci, name, i, got[i].startMs, got[i].endMs, w.Start.Ms(), w.End.Ms())
				}
				if got[i].index != w.Index || got[i].name != w.Name ||
					got[i].quality != w.Quality || got[i].qualityName != w.QualityName {
					t.Errorf("case %d %s[%d]: got {%d %q %s %q}, want {%d %q %s %q}",
						ci, name, i, got[i].index, got[i].name, got[i].quality, got[i].qualityName,
						w.Index, w.Name, w.Quality, w.QualityName)
				}
				qualities[got[i].quality] = true
			}
		}

		checkQuality(label("choghadiya", "day"), choghadiyaQslots(chog.Day), c.Choghadiya.Day)
		checkQuality(label("choghadiya", "night"), choghadiyaQslots(chog.Night), c.Choghadiya.Night)
		checkQuality(label("gowri", "day"), gowriQslots(gowri.Day), c.Gowri.Day)
		checkQuality(label("gowri", "night"), gowriQslots(gowri.Night), c.Gowri.Night)
		checkQuality(label("doGhati", "day"), doGhatiQslots(doGhati.Day), c.DoGhati.Day)
		checkQuality(label("doGhati", "night"), doGhatiQslots(doGhati.Night), c.DoGhati.Night)

		for _, arm := range []struct {
			name string
			got  []types.UnlocalizedHoraSlot
			want []tsHoraSlot
		}{{label("hora", "day"), hora.Day, c.Hora.Day}, {label("hora", "night"), hora.Night, c.Hora.Night}} {
			if len(arm.got) != len(arm.want) {
				t.Fatalf("case %d %s: %d slots, want %d", ci, arm.name, len(arm.got), len(arm.want))
			}
			for i := range arm.got {
				w := arm.want[i]
				if arm.got[i].StartMs != w.Start.Ms() || arm.got[i].EndMs != w.End.Ms() {
					t.Errorf("case %d %s[%d]: window %d..%d, want %d..%d",
						ci, arm.name, i, arm.got[i].StartMs, arm.got[i].EndMs, w.Start.Ms(), w.End.Ms())
				}
				if arm.got[i].PlanetIndex != w.PlanetIndex || arm.got[i].Planet != w.Planet {
					t.Errorf("case %d %s[%d]: got {%d %q}, want {%d %q}",
						ci, arm.name, i, arm.got[i].PlanetIndex, arm.got[i].Planet, w.PlanetIndex, w.Planet)
				}
				planetIdx[arm.got[i].PlanetIndex] = true
			}
		}

		varas[c.Vara] = true
		langs[c.Lang] = true
		days[c.Day] = true
		for _, s := range append(append([]types.UnlocalizedChoghadiyaSlot{}, chog.Day...), chog.Night...) {
			chogIdx[s.Index] = true
		}
		for _, s := range append(append([]types.UnlocalizedGowriSlot{}, gowri.Day...), gowri.Night...) {
			gowriIdx[s.Index] = true
		}
		for _, s := range append(append([]types.UnlocalizedDoGhatiSlot{}, doGhati.Day...), doGhati.Night...) {
			doGhatiIdx[s.Index] = true
		}
	}

	if len(varas) != 7 {
		t.Errorf("only %d of 7 weekdays covered", len(varas))
	}
	if len(langs) != 2 {
		t.Errorf("only %d of 2 languages covered", len(langs))
	}
	if len(days) < 5 {
		t.Errorf("only %d day shapes covered", len(days))
	}
	if len(chogIdx) != 7 || len(gowriIdx) != 8 || len(doGhatiIdx) != 30 || len(planetIdx) != 7 {
		t.Errorf("index coverage: choghadiya %d/7, gowri %d/8, doGhati %d/30, hora %d/7",
			len(chogIdx), len(gowriIdx), len(doGhatiIdx), len(planetIdx))
	}
	if len(qualities) != 3 {
		t.Errorf("only %d of 3 qualities reached: %v", len(qualities), qualities)
	}
}

func TestSlotsTileTheirHalfExactly(t *testing.T) {
	g := loadSlotsGolden(t)
	checked := 0
	for _, c := range g.Cases {
		tr := i18n.GetTranslations(c.Lang)
		qn := qualityFn(c.Lang)
		chog := ComputeChoghadiya(c.Sunrise, c.Sunset, c.NextSunrise, c.Vara,
			func(i int) string { return tr.ChoghadiyaNames[i] }, qn)
		hora := ComputeHora(c.Sunrise, c.Sunset, c.NextSunrise, c.Vara,
			func(i int) string { return tr.GrahaNames[i] })
		gowri := ComputeGowriPanchangam(c.Sunrise, c.Sunset, c.NextSunrise, c.Vara,
			func(i int) string { return tr.GowriNames[i] }, qn)
		doGhati := ComputeDoGhati(c.Sunrise, c.Sunset, c.NextSunrise,
			func(i int) string { return tr.DoGhatiNames[i] }, qn)

		type window struct{ start, end int64 }
		toWindows := func(fn func(func(start, end int64))) []window {
			var out []window
			fn(func(s, e int64) { out = append(out, window{s, e}) })
			return out
		}
		halves := []struct {
			name           string
			ref, endAnchor int64
			count          int
			w              []window
		}{
			{"choghadiya.day", c.Sunrise, c.Sunset, 8, toWindows(func(y func(int64, int64)) {
				for _, s := range chog.Day {
					y(s.StartMs, s.EndMs)
				}
			})},
			{"choghadiya.night", c.Sunset, c.NextSunrise, 8, toWindows(func(y func(int64, int64)) {
				for _, s := range chog.Night {
					y(s.StartMs, s.EndMs)
				}
			})},
			{"hora.day", c.Sunrise, c.Sunset, 12, toWindows(func(y func(int64, int64)) {
				for _, s := range hora.Day {
					y(s.StartMs, s.EndMs)
				}
			})},
			{"hora.night", c.Sunset, c.NextSunrise, 12, toWindows(func(y func(int64, int64)) {
				for _, s := range hora.Night {
					y(s.StartMs, s.EndMs)
				}
			})},
			{"gowri.day", c.Sunrise, c.Sunset, 8, toWindows(func(y func(int64, int64)) {
				for _, s := range gowri.Day {
					y(s.StartMs, s.EndMs)
				}
			})},
			{"gowri.night", c.Sunset, c.NextSunrise, 8, toWindows(func(y func(int64, int64)) {
				for _, s := range gowri.Night {
					y(s.StartMs, s.EndMs)
				}
			})},
			{"doGhati.day", c.Sunrise, c.Sunset, 15, toWindows(func(y func(int64, int64)) {
				for _, s := range doGhati.Day {
					y(s.StartMs, s.EndMs)
				}
			})},
			{"doGhati.night", c.Sunset, c.NextSunrise, 15, toWindows(func(y func(int64, int64)) {
				for _, s := range doGhati.Night {
					y(s.StartMs, s.EndMs)
				}
			})},
		}
		for _, h := range halves {
			if len(h.w) != h.count {
				t.Fatalf("%s %s: %d slots, want %d", c.Day, h.name, len(h.w), h.count)
			}
			if h.w[0].start != h.ref {
				t.Errorf("%s %s: first slot starts at %d, want %d", c.Day, h.name, h.w[0].start, h.ref)
			}
			if h.w[len(h.w)-1].end != h.endAnchor {
				t.Errorf("%s %s: last slot ends at %d, want %d (the anchored end)",
					c.Day, h.name, h.w[len(h.w)-1].end, h.endAnchor)
			}
			for i := 1; i < len(h.w); i++ {
				if h.w[i].start != h.w[i-1].end {
					t.Errorf("%s %s: slot %d starts at %d but slot %d ended at %d, a %d ms gap",
						c.Day, h.name, i, h.w[i].start, i-1, h.w[i-1].end, h.w[i].start-h.w[i-1].end)
				}
			}
			checked++
		}
	}
	if checked < 100 {
		t.Fatalf("only %d halves checked: the sweep is vacuous", checked)
	}
}

func TestChoghadiyaAndHoraShareTheWeekdayTable(t *testing.T) {
	tr := i18n.GetTranslations(types.LanguageEn)
	qn := qualityFn(types.LanguageEn)
	const sunrise, sunset, next = 0, 43_200_000, 86_400_000
	for vara := 0; vara < 7; vara++ {
		chog := ComputeChoghadiya(sunrise, sunset, next, vara,
			func(i int) string { return tr.ChoghadiyaNames[i] }, qn)
		hora := ComputeHora(sunrise, sunset, next, vara,
			func(i int) string { return tr.GrahaNames[i] })
		if chog.Day[0].Index != hora.Day[0].PlanetIndex {
			t.Errorf("vara %d: first day choghadiya index %d != first day hora planet %d",
				vara, chog.Day[0].Index, hora.Day[0].PlanetIndex)
		}
		if chog.Day[0].Index != vara*3%7 {
			// A weekday's lord is three Chaldean steps on.
			t.Errorf("vara %d: start index %d, want %d (3*vara mod 7)", vara, chog.Day[0].Index, vara*3%7)
		}
	}
}

func TestGowriGridIsNotARotation(t *testing.T) {
	satNight := gowriNightGrid[6]
	seen := map[int]int{}
	for _, v := range satNight {
		seen[v]++
	}
	if seen[7] != 2 {
		t.Errorf("Saturday night should carry Chal (7) twice, got %d. The grid has been "+
			"'corrected' into a permutation, which no source supports", seen[7])
	}
	if seen[2] != 0 {
		t.Errorf("Saturday night should carry no Roga (2), got %d", seen[2])
	}
	for _, grid := range [][7][8]int{gowriDayGrid, gowriNightGrid} {
		for row := 0; row < 7; row++ {
			if grid == gowriNightGrid && row == 6 {
				continue
			}
			var count [8]int
			for _, v := range grid[row] {
				if v < 0 || v > 7 {
					t.Fatalf("row %d holds out-of-range index %d", row, v)
				}
				count[v]++
			}
			for v, n := range count {
				if n != 1 {
					t.Errorf("row %d: index %d appears %d times, want 1", row, v, n)
				}
			}
		}
	}
}

func TestDoGhatiDoesNotRotateByWeekday(t *testing.T) {
	tr := i18n.GetTranslations(types.LanguageEn)
	qn := qualityFn(types.LanguageEn)
	got := ComputeDoGhati(0, 43_200_000, 86_400_000,
		func(i int) string { return tr.DoGhatiNames[i] }, qn)
	for i, s := range got.Day {
		if s.Index != i {
			t.Errorf("day slot %d has index %d", i, s.Index)
		}
	}
	for i, s := range got.Night {
		if s.Index != 15+i {
			t.Errorf("night slot %d has index %d, want %d", i, s.Index, 15+i)
		}
	}
}
