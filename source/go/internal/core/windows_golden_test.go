package core

import (
	"encoding/json"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
)

type windowsGolden struct {
	Inauspicious []struct {
		Day         string         `json:"day"`
		Vara        int            `json:"vara"`
		Sunrise     int64          `json:"sunrise"`
		Sunset      int64          `json:"sunset"`
		NextSunrise int64          `json:"nextSunrise"`
		Rahu        tsSlotWindow   `json:"rahu"`
		Gulika      tsSlotWindow   `json:"gulika"`
		Yamaganda   tsSlotWindow   `json:"yamaganda"`
		DurMuhurta  []tsDurMuhurta `json:"durMuhurta"`
	} `json:"inauspicious"`
	GandaMula []struct {
		Nakshatra int            `json:"nakshatra"`
		Lang      types.Language `json:"lang"`
		Info      struct {
			Active        bool                    `json:"active"`
			NakshatraName string                  `json:"nakshatraName"`
			Severity      types.GandaMulaSeverity `json:"severity"`
		} `json:"info"`
	} `json:"gandaMula"`
	Anandadi []struct {
		Vara      int                    `json:"vara"`
		Nakshatra int                    `json:"nakshatra"`
		Lang      types.Language         `json:"lang"`
		Info      types.AnandadiYogaInfo `json:"info"`
	} `json:"anandadi"`
	PanchakaTypes []struct {
		Vara    int                `json:"vara"`
		Type    types.PanchakaType `json:"type"`
		IsDosha bool               `json:"isDosha"`
	} `json:"panchakaTypes"`
	PanchakaFlags []struct {
		Lon    float64 `json:"lon"`
		Active bool    `json:"active"`
	} `json:"panchakaFlags"`
	Rahita []struct {
		I           int   `json:"i"`
		Sunrise     int64 `json:"sunrise"`
		NextSunrise int64 `json:"nextSunrise"`
		Windows     []struct {
			Start int64 `json:"start"`
			End   int64 `json:"end"`
		} `json:"windows"`
	} `json:"rahita"`
	Onsets []struct {
		I       int    `json:"i"`
		Sunrise int64  `json:"sunrise"`
		Onset   *int64 `json:"onset"`
	} `json:"onsets"`
}

type tsDurMuhurta struct {
	tsSlotWindow
	Segment types.DayNightSegment `json:"segment"`
}

func loadWindowsGolden(t *testing.T) windowsGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "core", "windows-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g windowsGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.Inauspicious) == 0 || len(g.GandaMula) == 0 || len(g.Anandadi) == 0 ||
		len(g.Rahita) == 0 || len(g.Onsets) == 0 {
		t.Fatal("golden is missing an arm")
	}
	return g
}

func TestInauspiciousPeriodsMatchTypeScript(t *testing.T) {
	g := loadWindowsGolden(t)
	for _, c := range g.Inauspicious {
		slotMs := float64(c.Sunset-c.Sunrise) / 8
		for _, arm := range []struct {
			name  string
			got   types.UtcWindow
			want  tsSlotWindow
			table [7]int
		}{
			{"rahu", ComputeRahuKalam(c.Sunrise, c.Sunset, c.Vara), c.Rahu, utils.RahuKalamSlots},
			{"gulika", ComputeGulikaKalam(c.Sunrise, c.Sunset, c.Vara), c.Gulika, utils.GulikaSlots},
			{"yamaganda", ComputeYamaganda(c.Sunrise, c.Sunset, c.Vara), c.Yamaganda, utils.YamagandaSlots},
		} {
			if arm.got.StartMs != arm.want.Start.Ms() || arm.got.EndMs != arm.want.End.Ms() {
				t.Errorf("%s %s vara=%d: got %d..%d, want %d..%d", c.Day, arm.name, c.Vara,
					arm.got.StartMs, arm.got.EndMs, arm.want.Start.Ms(), arm.want.End.Ms())
			}
			ordinal := arm.table[c.Vara]
			wantStart := int64(float64(c.Sunrise) + float64(float64(ordinal)*slotMs))
			if arm.got.StartMs != wantStart {
				t.Errorf("%s %s vara=%d: start %d, want %d (slot %d of 8)",
					c.Day, arm.name, c.Vara, arm.got.StartMs, wantStart, ordinal)
			}
			width := arm.got.EndMs - arm.got.StartMs
			if w := int64(slotMs); width < w-1 || width > w+1 {
				t.Errorf("%s %s vara=%d: width %d ms, want ~%d", c.Day, arm.name, c.Vara, width, w)
			}
			if arm.got.StartMs < c.Sunrise || arm.got.EndMs > c.Sunset+1 {
				t.Errorf("%s %s vara=%d: %d..%d escapes the daytime span %d..%d",
					c.Day, arm.name, c.Vara, arm.got.StartMs, arm.got.EndMs, c.Sunrise, c.Sunset)
			}
		}
	}

	for _, tbl := range []struct {
		name  string
		table [7]int
	}{
		{"rahu", utils.RahuKalamSlots},
		{"gulika", utils.GulikaSlots},
		{"yamaganda", utils.YamagandaSlots},
	} {
		seen := map[int]bool{}
		for _, v := range tbl.table {
			if v < 0 || v > 7 {
				t.Errorf("%s table holds out-of-range slot %d", tbl.name, v)
			}
			if seen[v] {
				t.Errorf("%s table repeats slot %d", tbl.name, v)
			}
			seen[v] = true
		}
		if len(seen) != 7 {
			t.Errorf("%s table covers %d distinct slots, want 7", tbl.name, len(seen))
		}
	}
	for vara := 0; vara < 7; vara++ {
		r, gk, y := utils.RahuKalamSlots[vara], utils.GulikaSlots[vara], utils.YamagandaSlots[vara]
		if r == gk || r == y || gk == y {
			t.Errorf("vara %d: two of the three slot tables coincide (rahu %d, gulika %d, yamaganda %d)",
				vara, r, gk, y)
		}
	}
}

func TestDurMuhurtaMatchesTypeScript(t *testing.T) {
	g := loadWindowsGolden(t)
	nightRows, dayRows := 0, 0
	countByVara := map[int]int{}
	for _, c := range g.Inauspicious {
		got := ComputeDurMuhurta(c.Sunrise, c.Sunset, c.NextSunrise, c.Vara)
		if len(got) != len(c.DurMuhurta) {
			t.Fatalf("%s vara=%d: %d windows, want %d", c.Day, c.Vara, len(got), len(c.DurMuhurta))
		}
		for i := range got {
			w := c.DurMuhurta[i]
			if got[i].StartMs != w.Start.Ms() || got[i].EndMs != w.End.Ms() || got[i].Segment != w.Segment {
				t.Errorf("%s vara=%d window %d: got %d..%d %s, want %d..%d %s", c.Day, c.Vara, i,
					got[i].StartMs, got[i].EndMs, got[i].Segment, w.Start.Ms(), w.End.Ms(), w.Segment)
			}
			if got[i].Segment == types.SegmentNight {
				nightRows++
				if c.Vara != 2 {
					t.Errorf("vara %d carries a night Dur Muhurta; only Tuesday should", c.Vara)
				}
			} else {
				dayRows++
			}
		}
		countByVara[c.Vara] = len(got)
	}
	if nightRows == 0 || dayRows == 0 {
		t.Errorf("segment coverage: %d night rows, %d day rows", nightRows, dayRows)
	}
	for vara, n := range countByVara {
		want := 2
		if vara == 0 || vara == 3 {
			want = 1
		}
		if n != want {
			t.Errorf("vara %d has %d Dur Muhurta windows, want %d", vara, n, want)
		}
	}
}

func TestGandaMulaMatchesTypeScript(t *testing.T) {
	g := loadWindowsGolden(t)
	active, inactive := 0, 0
	severities := map[types.GandaMulaSeverity]bool{}
	for _, c := range g.GandaMula {
		got, err := ComputeGandaMula(c.Nakshatra, c.Lang)
		if err != nil {
			t.Fatalf("nakshatra %d: %v", c.Nakshatra, err)
		}
		if got.Active != c.Info.Active || got.NakshatraName != c.Info.NakshatraName ||
			got.Severity != c.Info.Severity {
			t.Errorf("nakshatra %d %s: got %+v, want %+v", c.Nakshatra, c.Lang, got, c.Info)
		}
		if got.Active {
			active++
			severities[got.Severity] = true
		} else {
			inactive++
		}
	}
	if active == 0 || inactive == 0 {
		t.Errorf("arm coverage: %d active, %d inactive", active, inactive)
	}
	if len(severities) != 2 {
		t.Errorf("only %d of 2 severities reached", len(severities))
	}

	want := map[int]types.GandaMulaSeverity{
		0: types.GandaMulaMild, 8: types.GandaMulaMild, 9: types.GandaMulaMild,
		17: types.GandaMulaSevere, 18: types.GandaMulaSevere, 26: types.GandaMulaMild,
	}
	for n := 0; n < utils.TotalNakshatras; n++ {
		got, err := ComputeGandaMula(n, types.LanguageEn)
		if err != nil {
			t.Fatal(err)
		}
		sev, isRoot := want[n]
		if got.Active != isRoot {
			t.Errorf("nakshatra %d: active=%v, want %v", n, got.Active, isRoot)
		}
		if isRoot && got.Severity != sev {
			t.Errorf("nakshatra %d: severity %q, want %q", n, got.Severity, sev)
		}
	}

	for _, bad := range []int{-1, 27, 100} {
		if _, err := ComputeGandaMula(bad, types.LanguageEn); err == nil {
			t.Errorf("nakshatra %d was accepted", bad)
		}
	}
}

func TestGandaMulaInactiveArmMarshalsBare(t *testing.T) {
	inactive, err := ComputeGandaMula(1, types.LanguageEn)
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(inactive)
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != `{"active":false}` {
		t.Errorf("inactive arm marshalled as %s, want {\"active\":false}", b)
	}

	active, err := ComputeGandaMula(18, types.LanguageEn)
	if err != nil {
		t.Fatal(err)
	}
	b, err = json.Marshal(active)
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != `{"active":true,"nakshatraName":"Mula","severity":"severe"}` {
		t.Errorf("active arm marshalled as %s", b)
	}
}

func TestAnandadiYogaMatchesTypeScript(t *testing.T) {
	g := loadWindowsGolden(t)
	indices := map[int]bool{}
	qualities := map[types.ChoghadiyaQuality]bool{}
	for _, c := range g.Anandadi {
		got, err := ComputeAnandadiYoga(c.Vara, c.Nakshatra, c.Lang)
		if err != nil {
			t.Fatalf("vara %d nakshatra %d: %v", c.Vara, c.Nakshatra, err)
		}
		if got != c.Info {
			t.Errorf("vara %d nakshatra %d %s: got %+v, want %+v", c.Vara, c.Nakshatra, c.Lang, got, c.Info)
		}
		indices[got.Index] = true
		qualities[got.Quality] = true
	}
	if len(indices) != 28 {
		t.Errorf("only %d of 28 Anandadi indices reached", len(indices))
	}
	if len(qualities) < 2 {
		t.Errorf("only %d qualities reached", len(qualities))
	}

	for vara := 0; vara < 7; vara++ {
		seen := map[int]bool{}
		for n := 0; n < utils.TotalNakshatras; n++ {
			got, err := ComputeAnandadiYoga(vara, n, types.LanguageEn)
			if err != nil {
				t.Fatal(err)
			}
			if seen[got.Index] {
				t.Errorf("vara %d: Anandadi index %d appears twice in the row", vara, got.Index)
			}
			seen[got.Index] = true
		}
		if len(seen) != 27 {
			t.Errorf("vara %d row covers %d distinct indices, want 27", vara, len(seen))
		}
	}

	anchor, err := ComputeAnandadiYoga(0, 0, types.LanguageEn)
	if err != nil {
		t.Fatal(err)
	}
	if anchor.Index != 0 || anchor.Name != "Ananda" {
		t.Errorf("Sunday x Ashwini is %+v, want index 0 / Ananda", anchor)
	}

	for _, bad := range [][2]int{{-1, 0}, {7, 0}, {0, -1}, {0, 27}} {
		if _, err := ComputeAnandadiYoga(bad[0], bad[1], types.LanguageEn); err == nil {
			t.Errorf("vara=%d nakshatra=%d was accepted", bad[0], bad[1])
		}
	}
}

func TestPanchakaClassifiersMatchTypeScript(t *testing.T) {
	g := loadWindowsGolden(t)
	doshaTrue, doshaFalse := 0, 0
	for _, c := range g.PanchakaTypes {
		got, err := ClassifyPanchaka(c.Vara)
		if err != nil {
			t.Fatalf("vara %d: %v", c.Vara, err)
		}
		if got != c.Type {
			t.Errorf("vara %d: type %q, want %q", c.Vara, got, c.Type)
		}
		if d := IsPanchakaDosha(got); d != c.IsDosha {
			t.Errorf("vara %d (%s): isDosha %v, want %v", c.Vara, got, d, c.IsDosha)
		}
		if c.IsDosha {
			doshaTrue++
		} else {
			doshaFalse++
		}
	}
	if doshaTrue == 0 || doshaFalse == 0 {
		t.Errorf("isDosha coverage: %d true, %d false", doshaTrue, doshaFalse)
	}
	for vara := 0; vara < 7; vara++ {
		got, err := ClassifyPanchaka(vara)
		if err != nil {
			t.Fatal(err)
		}
		wantSamanya := vara == 3 || vara == 4
		if (got == types.PanchakaSamanya) != wantSamanya {
			t.Errorf("vara %d classified %q; samanya should be Wednesday and Thursday only", vara, got)
		}
	}
	for _, bad := range []int{-1, 7} {
		if _, err := ClassifyPanchaka(bad); err == nil {
			t.Errorf("vara %d was accepted", bad)
		}
	}

	for _, c := range g.PanchakaFlags {
		if got := ComputePanchaka(c.Lon); got != c.Active {
			t.Errorf("lon %v: active %v, want %v", c.Lon, got, c.Active)
		}
	}
}

func TestPanchakaRahitaMatchesTypeScript(t *testing.T) {
	g := loadWindowsGolden(t)
	ctx := &astronomy.EphemerisCtx{}
	getMoon := LongitudeAt(func(ms int64) float64 {
		v, err := astronomy.GetSiderealMoonLongitude(ctx, ms, types.Lahiri)
		if err != nil {
			t.Fatalf("sidereal Moon at %d: %v", ms, err)
		}
		return v
	})

	const bandMs = 1
	var worst int64
	empty, fullDay, partial := 0, 0, 0
	for _, c := range g.Rahita {
		got := ComputePanchakaRahita(c.Sunrise, c.NextSunrise, getMoon)
		if len(got) != len(c.Windows) {
			t.Fatalf("day %d: %d windows, want %d", c.I, len(got), len(c.Windows))
		}
		for i := range got {
			for _, d := range []struct {
				name      string
				got, want int64
			}{
				{"start", got[i].StartMs, c.Windows[i].Start},
				{"end", got[i].EndMs, c.Windows[i].End},
			} {
				delta := d.got - d.want
				if delta < 0 {
					delta = -delta
				}
				if delta > worst {
					worst = delta
				}
				if delta > bandMs {
					t.Errorf("day %d window %d %s: %d vs %d (%d ms, band %d)",
						c.I, i, d.name, d.got, d.want, delta, bandMs)
				}
			}
		}
		switch {
		case len(got) == 0:
			empty++
		case got[0].StartMs == c.Sunrise && got[0].EndMs == c.NextSunrise:
			fullDay++
		default:
			partial++
		}
	}

	if empty == 0 || fullDay == 0 || partial == 0 {
		t.Errorf("outcome coverage over %d days: %d empty, %d full-day, %d partial: "+
			"the partial arm is the only one that runs the solver",
			len(g.Rahita), empty, fullDay, partial)
	}
	t.Logf("panchaka rahita: worst %d ms over %d days (%d empty, %d full-day, %d partial), band %d ms",
		worst, len(g.Rahita), empty, fullDay, partial, bandMs)
}

func TestPanchakaRahitaEmptyMarshalsAsArray(t *testing.T) {
	inside := LongitudeAt(func(int64) float64 { return 330 })
	got := ComputePanchakaRahita(0, 86_400_000, inside)
	if len(got) != 0 {
		t.Fatalf("expected the empty arm, got %d windows", len(got))
	}
	b, err := json.Marshal(got)
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != "[]" {
		t.Errorf("empty result marshalled as %s, want []: a nil slice writes null "+
			"where JavaScript writes []", b)
	}
}

func TestPanchakaOnsetMatchesTypeScript(t *testing.T) {
	g := loadWindowsGolden(t)
	ctx := &astronomy.EphemerisCtx{}
	getMoon := LongitudeAt(func(ms int64) float64 {
		v, err := astronomy.GetSiderealMoonLongitude(ctx, ms, types.Lahiri)
		if err != nil {
			t.Fatalf("sidereal Moon at %d: %v", ms, err)
		}
		return v
	})

	const bandMs = 1
	var worst int64
	found, absent := 0, 0
	for _, c := range g.Onsets {
		gotMs, ok := FindPanchakaOnset(c.Sunrise, getMoon)
		if (c.Onset != nil) != ok {
			t.Errorf("day %d: found=%v, want %v", c.I, ok, c.Onset != nil)
			continue
		}
		if !ok {
			absent++
			continue
		}
		found++
		delta := gotMs - *c.Onset
		if delta < 0 {
			delta = -delta
		}
		if delta > worst {
			worst = delta
		}
		if delta > bandMs {
			t.Errorf("day %d onset: %d vs %d (%d ms, band %d)", c.I, gotMs, *c.Onset, delta, bandMs)
		}
		if !ComputePanchaka(getMoon(gotMs + 1000)) {
			t.Errorf("day %d: the Moon is not in Panchaka one second after the reported onset", c.I)
		}
		if ComputePanchaka(getMoon(gotMs - 1000)) {
			t.Errorf("day %d: the Moon is already in Panchaka one second before the reported onset", c.I)
		}
	}
	if found == 0 || absent == 0 {
		t.Errorf("arm coverage over %d days: %d found, %d absent", len(g.Onsets), found, absent)
	}
	t.Logf("panchaka onset: worst %d ms over %d found (%d absent), band %d ms",
		worst, found, absent, bandMs)
}
