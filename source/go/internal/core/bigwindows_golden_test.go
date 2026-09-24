package core

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

type bigWindowsGolden struct {
	Days []struct {
		I           int   `json:"i"`
		Sunrise     int64 `json:"sunrise"`
		NextSunrise int64 `json:"nextSunrise"`
		Bhadra      *struct {
			Start        int64                `json:"start"`
			End          int64                `json:"end"`
			Location     types.BhadraLocation `json:"location"`
			LocationName string               `json:"locationName"`
			IsActive     bool                 `json:"isActive"`
			Vasa         []struct {
				Start        int64                `json:"start"`
				End          int64                `json:"end"`
				Location     types.BhadraLocation `json:"location"`
				LocationName string               `json:"locationName"`
			} `json:"vasa"`
		} `json:"bhadra"`
		Varjyam        []goldenWindow `json:"varjyam"`
		AmritKala      []goldenWindow `json:"amritKala"`
		NakshatraIndex int            `json:"nakshatraIndex"`
		VarjyamSingle  *goldenWindow  `json:"varjyamSingle"`
	} `json:"days"`
	Muhurtas []struct {
		Day            string        `json:"day"`
		Vara           *int          `json:"vara"`
		Sunrise        int64         `json:"sunrise"`
		Sunset         int64         `json:"sunset"`
		NextSunrise    int64         `json:"nextSunrise"`
		Abhijit        *goldenWindow `json:"abhijit"`
		Brahma         *goldenWindow `json:"brahma"`
		Vijaya         *goldenWindow `json:"vijaya"`
		Godhuli        *goldenWindow `json:"godhuli"`
		Nishita        *goldenWindow `json:"nishita"`
		Madhyahna      *goldenWindow `json:"madhyahna"`
		PratahSandhya  *goldenWindow `json:"pratahSandhya"`
		SayahnaSandhya *goldenWindow `json:"sayahnaSandhya"`
	} `json:"muhurtas"`
	SpecialYogaDigest       string         `json:"specialYogaDigest"`
	SpecialYogaCombinations int            `json:"specialYogaCombinations"`
	SpecialYogaFiringDays   int            `json:"specialYogaFiringDays"`
	SpecialYogaTotal        int            `json:"specialYogaTotal"`
	SpecialYogaPerType      map[string]int `json:"specialYogaPerType"`
	SpecialYogaSamples      []struct {
		Vara   int                     `json:"vara"`
		Tithi  int                     `json:"tithi"`
		Nak    int                     `json:"nak"`
		SunNak int                     `json:"sunNak"`
		Types  []types.SpecialYogaType `json:"types"`
	} `json:"specialYogaSamples"`
	AmritKalaOffsets []int                  `json:"amritKalaOffsets"`
	VarjyamOffsets   []int                  `json:"varjyamOffsets"`
	Vishti           []bool                 `json:"vishti"`
	VasaByRashi      []types.BhadraLocation `json:"vasaByRashi"`
}

type goldenWindow struct {
	Start int64 `json:"start"`
	End   int64 `json:"end"`
}

func loadBigWindowsGolden(t *testing.T) bigWindowsGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "core", "bigwindows-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g bigWindowsGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.Days) == 0 || len(g.Muhurtas) == 0 || g.SpecialYogaDigest == "" {
		t.Fatal("golden is missing an arm")
	}
	return g
}

func bigWindowEphemeris(t *testing.T) (LongitudeAt, LongitudeAt) {
	t.Helper()
	ctx := &astronomy.EphemerisCtx{}
	moon := LongitudeAt(func(ms int64) float64 {
		v, err := astronomy.GetSiderealMoonLongitude(ctx, ms, types.Lahiri)
		if err != nil {
			t.Fatalf("sidereal Moon at %d: %v", ms, err)
		}
		return v
	})
	sun := LongitudeAt(func(ms int64) float64 {
		v, err := astronomy.GetSiderealSunLongitude(ctx, ms, types.Lahiri)
		if err != nil {
			t.Fatalf("sidereal Sun at %d: %v", ms, err)
		}
		return v
	})
	return moon, sun
}

const bigWindowBandMs = 1

func TestBhadraMatchesTypeScript(t *testing.T) {
	g := loadBigWindowsGolden(t)
	getMoon, getSun := bigWindowEphemeris(t)
	locName := func(k types.BhadraLocation) string {
		return i18n.GetTranslations(types.LanguageEn).BhadraLocation(k)
	}

	var worst int64
	found, absent, multiSegment, active := 0, 0, 0, 0
	locations := map[types.BhadraLocation]bool{}
	for _, d := range g.Days {
		got, ok := ComputeBhadraKaal(d.Sunrise, d.NextSunrise, getMoon, getSun, locName)
		if (d.Bhadra != nil) != ok {
			t.Errorf("day %d: found=%v, want %v", d.I, ok, d.Bhadra != nil)
			continue
		}
		if !ok {
			absent++
			continue
		}
		found++
		w := d.Bhadra
		track := func(name string, a, b int64) {
			delta := a - b
			if delta < 0 {
				delta = -delta
			}
			if delta > worst {
				worst = delta
			}
			if delta > bigWindowBandMs {
				t.Errorf("day %d bhadra %s: %d vs %d (%d ms, band %d)",
					d.I, name, a, b, delta, bigWindowBandMs)
			}
		}
		track("start", got.StartMs, w.Start)
		track("end", got.EndMs, w.End)
		if got.Location != w.Location || got.LocationName != w.LocationName || got.IsActive != w.IsActive {
			t.Errorf("day %d bhadra: got {%s %q %v}, want {%s %q %v}",
				d.I, got.Location, got.LocationName, got.IsActive,
				w.Location, w.LocationName, w.IsActive)
		}
		if len(got.Vasa) != len(w.Vasa) {
			t.Errorf("day %d: %d vasa segments, want %d", d.I, len(got.Vasa), len(w.Vasa))
			continue
		}
		for i := range got.Vasa {
			track(fmt.Sprintf("vasa[%d].start", i), got.Vasa[i].StartMs, w.Vasa[i].Start)
			track(fmt.Sprintf("vasa[%d].end", i), got.Vasa[i].EndMs, w.Vasa[i].End)
			if got.Vasa[i].Location != w.Vasa[i].Location ||
				got.Vasa[i].LocationName != w.Vasa[i].LocationName {
				t.Errorf("day %d vasa[%d]: got {%s %q}, want {%s %q}", d.I, i,
					got.Vasa[i].Location, got.Vasa[i].LocationName,
					w.Vasa[i].Location, w.Vasa[i].LocationName)
			}
			locations[got.Vasa[i].Location] = true
		}
		if len(got.Vasa) > 1 {
			multiSegment++
		}
		if got.IsActive {
			active++
		}

		if got.Vasa[0].StartMs != got.StartMs {
			t.Errorf("day %d: first vasa starts at %d, window at %d", d.I, got.Vasa[0].StartMs, got.StartMs)
		}
		if last := got.Vasa[len(got.Vasa)-1]; last.EndMs != got.EndMs {
			t.Errorf("day %d: last vasa ends at %d, window at %d", d.I, last.EndMs, got.EndMs)
		}
		for i := 1; i < len(got.Vasa); i++ {
			if got.Vasa[i].StartMs != got.Vasa[i-1].EndMs {
				t.Errorf("day %d: vasa %d starts at %d but %d ended at %d",
					d.I, i, got.Vasa[i].StartMs, i-1, got.Vasa[i-1].EndMs)
			}
		}
		if got.Location != got.Vasa[0].Location {
			t.Errorf("day %d: top-level location %s != first segment %s",
				d.I, got.Location, got.Vasa[0].Location)
		}
	}

	if found == 0 || absent == 0 {
		t.Errorf("arm coverage: %d found, %d absent over %d days", found, absent, len(g.Days))
	}
	if multiSegment == 0 {
		t.Error("no multi-segment vasa in the sample: the piecewise walk in ComputeBhadraKaal " +
			"was never exercised. It needs the Moon to change rashi inside a <=17 h window, " +
			"which a four-month sample misses entirely; the golden spans 400 days for this reason.")
	}
	if active == 0 {
		t.Error("no day had Bhadra active at sunrise: the isActive arm is untested")
	}
	if len(locations) != 3 {
		t.Errorf("only %d of 3 vasa locations reached", len(locations))
	}
	t.Logf("bhadra: worst %d ms over %d windows (%d absent, %d multi-segment, %d active at sunrise), band %d ms",
		worst, found, absent, multiSegment, active, bigWindowBandMs)
}

func TestVishtiAndVasaTablesMatchTypeScript(t *testing.T) {
	g := loadBigWindowsGolden(t)
	if len(g.Vishti) != 60 || len(g.VasaByRashi) != 12 {
		t.Fatalf("golden tables are %d / %d, want 60 / 12", len(g.Vishti), len(g.VasaByRashi))
	}
	var vishti []int
	for i, want := range g.Vishti {
		if got := IsVishtiKarana(i); got != want {
			t.Errorf("IsVishtiKarana(%d) = %v, want %v", i, got, want)
		}
		if want {
			vishti = append(vishti, i)
		}
	}
	wantVishti := []int{7, 14, 21, 28, 35, 42, 49, 56}
	if len(vishti) != len(wantVishti) {
		t.Fatalf("Vishti karanas: %v, want %v", vishti, wantVishti)
	}
	for i := range vishti {
		if vishti[i] != wantVishti[i] {
			t.Fatalf("Vishti karanas: %v, want %v", vishti, wantVishti)
		}
	}

	for i, want := range g.VasaByRashi {
		if got := BhadraVasaForRashi(i); got != want {
			t.Errorf("BhadraVasaForRashi(%d) = %s, want %s", i, got, want)
		}
	}
	for r := -36; r < 36; r++ {
		if got, want := BhadraVasaForRashi(r), BhadraVasaForRashi(((r%12)+12)%12); got != want {
			t.Errorf("BhadraVasaForRashi(%d) = %s, want %s", r, got, want)
		}
	}
}

func TestVarjyamAndAmritKalaMatchTypeScript(t *testing.T) {
	g := loadBigWindowsGolden(t)
	getMoon, _ := bigWindowEphemeris(t)

	var worst int64
	varjyamCounts := map[int]int{}
	amritCounts := map[int]int{}
	for _, d := range g.Days {
		for _, arm := range []struct {
			name string
			got  []types.UtcWindow
			want []goldenWindow
			seen map[int]int
		}{
			{"varjyam", ComputeVarjyamWindows(d.Sunrise, d.NextSunrise, getMoon), d.Varjyam, varjyamCounts},
			{"amritKala", ComputeAmritKalaWindows(d.Sunrise, d.NextSunrise, getMoon), d.AmritKala, amritCounts},
		} {
			arm.seen[len(arm.got)]++
			if len(arm.got) != len(arm.want) {
				t.Errorf("day %d %s: %d windows, want %d", d.I, arm.name, len(arm.got), len(arm.want))
				continue
			}
			for i := range arm.got {
				for _, c := range []struct {
					what      string
					got, want int64
				}{
					{"start", arm.got[i].StartMs, arm.want[i].Start},
					{"end", arm.got[i].EndMs, arm.want[i].End},
				} {
					delta := c.got - c.want
					if delta < 0 {
						delta = -delta
					}
					if delta > worst {
						worst = delta
					}
					if delta > bigWindowBandMs {
						t.Errorf("day %d %s[%d] %s: %d vs %d (%d ms, band %d)",
							d.I, arm.name, i, c.what, c.got, c.want, delta, bigWindowBandMs)
					}
				}
			}
			for i, w := range arm.got {
				if w.StartMs < d.Sunrise || w.StartMs >= d.NextSunrise {
					t.Errorf("day %d %s[%d]: start %d is outside [%d, %d)",
						d.I, arm.name, i, w.StartMs, d.Sunrise, d.NextSunrise)
				}
				if w.EndMs <= w.StartMs {
					t.Errorf("day %d %s[%d]: end %d is not after start %d", d.I, arm.name, i, w.EndMs, w.StartMs)
				}
				if i > 0 && arm.got[i-1].StartMs > w.StartMs {
					t.Errorf("day %d %s: windows are not in start order", d.I, arm.name)
				}
			}
		}
	}

	for name, counts := range map[string]map[int]int{"varjyam": varjyamCounts, "amritKala": amritCounts} {
		for _, n := range []int{0, 1, 2} {
			if counts[n] == 0 {
				t.Errorf("%s never produced %d windows over %d days: %v", name, n, len(g.Days), counts)
			}
		}
		t.Logf("%s window counts over %d days: %v", name, len(g.Days), counts)
	}
	t.Logf("varjyam + amrit kala: worst %d ms, band %d ms", worst, bigWindowBandMs)
}

func TestVarjyamAndAmritKalaAreDifferentTables(t *testing.T) {
	g := loadBigWindowsGolden(t)
	if len(g.AmritKalaOffsets) != 27 || len(g.VarjyamOffsets) != 27 {
		t.Fatalf("golden holds %d amrit kala / %d varjyam offsets, want 27 each",
			len(g.AmritKalaOffsets), len(g.VarjyamOffsets))
	}
	for i, want := range g.VarjyamOffsets {
		if utils.VarjyamOffsetGhatikas[i] != want {
			t.Errorf("VarjyamOffsetGhatikas[%d] = %d, want %d", i, utils.VarjyamOffsetGhatikas[i], want)
		}
	}
	agree := 0
	for i, want := range g.AmritKalaOffsets {
		if AmritKalaOffsetGhatikas[i] != want {
			t.Errorf("AmritKalaOffsetGhatikas[%d] = %d, want %d", i, AmritKalaOffsetGhatikas[i], want)
		}
		if AmritKalaOffsetGhatikas[i] == utils.VarjyamOffsetGhatikas[i] {
			agree++
		}
	}
	if agree == 27 {
		t.Fatal("the Amrit Kala and Varjyam offset tables are identical: one has been " +
			"copied over the other")
	}
	t.Logf("the two offset tables agree at %d of 27 indices", agree)

	const windowGhatikas, fullGhatikas, offsetStep = 4, 60, 24
	const maxOffset = fullGhatikas - windowGhatikas

	plus24, noRoom, viaSecondSpell := 0, 0, 0
	unexplained := []int{}
	for i := 0; i < 27; i++ {
		v := utils.VarjyamOffsetGhatikas[i]
		a := AmritKalaOffsetGhatikas[i]
		if a == v+offsetStep {
			plus24++
			continue
		}
		if second, ok := utils.VarjyamSecondOffsetGhatikas[i]; ok && a == second+offsetStep {
			viaSecondSpell++
			continue
		}
		if v+offsetStep > maxOffset {
			noRoom++
			continue
		}
		unexplained = append(unexplained, i)
	}
	if plus24 != 23 {
		t.Errorf("%d of 27 nakshatras follow amrit = varjyam + %d, want 23. A table changed; "+
			"that is a review event, not a re-pin.", plus24, offsetStep)
	}
	if viaSecondSpell != 1 {
		t.Errorf("%d nakshatras satisfy the +%d relation via their second tyajya spell, want 1 (Mula)",
			viaSecondSpell, offsetStep)
	}
	if noRoom != 2 {
		t.Errorf("%d nakshatras have no room for +%d (V > %d), want 2 (Ashwini, Rohini)",
			noRoom, offsetStep, maxOffset-offsetStep)
	}
	if len(unexplained) != 1 || unexplained[0] != 5 {
		t.Errorf("unexplained rows = %v, want exactly [5] (Ardra). A new one is a "+
			"transcription slip until a source says otherwise; a vanished one means a "+
			"table moved.", unexplained)
	}
	t.Logf("amrit = varjyam + %d at %d of 27; %d via the second spell (Mula); %d with no room "+
		"(Ashwini, Rohini); unexplained %v (Ardra)",
		offsetStep, plus24, viaSecondSpell, noRoom, unexplained)
}

func TestFixedMuhurtasMatchTypeScript(t *testing.T) {
	g := loadBigWindowsGolden(t)
	abhijitNull, abhijitSet, varaNil := 0, 0, 0
	for _, c := range g.Muhurtas {
		sunrise, sunset, nextSunrise := c.Sunrise, c.Sunset, c.NextSunrise

		gotAbhijit, ok := ComputeAbhijitMuhurta(sunrise, sunset, c.Vara)
		if (c.Abhijit != nil) != ok {
			t.Errorf("%s vara=%v abhijit: present=%v, want %v", c.Day, c.Vara, ok, c.Abhijit != nil)
		} else if ok {
			checkWindow(t, c.Day+" abhijit", gotAbhijit, *c.Abhijit)
			abhijitSet++
		} else {
			abhijitNull++
		}
		if c.Vara == nil {
			varaNil++
		}

		checkWindow(t, c.Day+" brahma", ComputeBrahmaMuhurta(sunrise, sunset), *c.Brahma)
		checkWindow(t, c.Day+" vijaya", ComputeVijayaMuhurta(sunrise, sunset), *c.Vijaya)
		checkWindow(t, c.Day+" godhuli", ComputeGodhuliMuhurta(sunset), *c.Godhuli)
		checkWindow(t, c.Day+" nishita", ComputeNishitaMuhurta(sunset, nextSunrise), *c.Nishita)
		checkWindow(t, c.Day+" madhyahna", ComputeMadhyahna(sunrise, sunset), *c.Madhyahna)
		checkWindow(t, c.Day+" pratahSandhya",
			ComputePratahSandhya(sunrise, sunset, nextSunrise), *c.PratahSandhya)
		checkWindow(t, c.Day+" sayahnaSandhya",
			ComputeSayahnaSandhya(sunset, nextSunrise), *c.SayahnaSandhya)

		if p := ComputePratahSandhya(sunrise, sunset, nextSunrise); p.EndMs != sunrise {
			t.Errorf("%s: pratah sandhya ends at %d, want sunrise %d", c.Day, p.EndMs, sunrise)
		}
		if sa := ComputeSayahnaSandhya(sunset, nextSunrise); sa.StartMs != sunset {
			t.Errorf("%s: sayahna sandhya starts at %d, want sunset %d", c.Day, sa.StartMs, sunset)
		}
	}
	if abhijitNull == 0 || abhijitSet == 0 {
		t.Errorf("abhijit coverage: %d null (Wednesday), %d set", abhijitNull, abhijitSet)
	}
	if varaNil == 0 {
		t.Error("no case passed a nil varaIndex: the optional-parameter arm is untested, " +
			"and it is the arm where a plain int would have made Sunday mean 'omitted'")
	}
}

func checkWindow(t *testing.T, name string, got types.UtcWindow, want goldenWindow) {
	t.Helper()
	if got.StartMs != want.Start || got.EndMs != want.End {
		t.Errorf("%s: got %d..%d, want %d..%d", name, got.StartMs, got.EndMs, want.Start, want.End)
	}
}

func TestSpecialYogasMatchTypeScript(t *testing.T) {
	g := loadBigWindowsGolden(t)

	h := sha256.New()
	perType := map[string]int{}
	firings, total := 0, 0
	combinations := 0
	for vara := 0; vara < 7; vara++ {
		for tithi := 0; tithi < 30; tithi++ {
			for nak := 0; nak < 27; nak++ {
				for sunNak := 0; sunNak < 27; sunNak++ {
					combinations++
					r, err := ComputeSpecialYogas(vara, tithi, nak, sunNak,
						func(y types.SpecialYogaType) string { return "name:" + string(y) })
					if err != nil {
						t.Fatalf("vara=%d tithi=%d nak=%d sunNak=%d: %v", vara, tithi, nak, sunNak, err)
					}
					fmt.Fprintf(h, "%d,%d,%d,%d|%d|", vara, tithi, nak, sunNak, len(r))
					for _, y := range r {
						fmt.Fprintf(h, "%s=%s;", y.Type, y.Name)
					}
					if len(r) > 0 {
						firings++
						total += len(r)
						for _, y := range r {
							perType[string(y.Type)]++
						}
					}
				}
			}
		}
	}

	if got := hex.EncodeToString(h.Sum(nil)); got != g.SpecialYogaDigest {
		t.Errorf("special-yoga digest over %d combinations:\n got %s\nwant %s\n"+
			"Bisect with the samples array. This covers the resolved names and the "+
			"order the rules fire in, not only which fired.",
			combinations, got, g.SpecialYogaDigest)
	}
	if combinations != g.SpecialYogaCombinations {
		t.Errorf("enumerated %d combinations, golden says %d", combinations, g.SpecialYogaCombinations)
	}
	if firings != g.SpecialYogaFiringDays || total != g.SpecialYogaTotal {
		t.Errorf("firings %d (want %d), total yogas %d (want %d)",
			firings, g.SpecialYogaFiringDays, total, g.SpecialYogaTotal)
	}
	for typ, want := range g.SpecialYogaPerType {
		if perType[typ] != want {
			t.Errorf("%s fired %d times, want %d", typ, perType[typ], want)
		}
	}

	if len(perType) != len(types.AllSpecialYogaTypes) {
		t.Errorf("only %d of %d yoga types ever fired: %v",
			len(perType), len(types.AllSpecialYogaTypes), perType)
	}
	for _, typ := range types.AllSpecialYogaTypes {
		if perType[string(typ)] == 0 {
			t.Errorf("%s never fired over the exhaustive sweep", typ)
		}
	}
	t.Logf("special yogas: %d of %d combinations fire, %d yogas total, %d distinct types",
		firings, combinations, total, len(perType))
}

func TestSpecialYogaOrderIsTheDeclarationOrder(t *testing.T) {
	rank := map[types.SpecialYogaType]int{}
	for i, y := range types.AllSpecialYogaTypes {
		rank[y] = i
	}
	multi := 0
	for vara := 0; vara < 7; vara++ {
		for tithi := 0; tithi < 30; tithi++ {
			for nak := 0; nak < 27; nak++ {
				for sunNak := 0; sunNak < 27; sunNak++ {
					r, err := ComputeSpecialYogas(vara, tithi, nak, sunNak,
						func(y types.SpecialYogaType) string { return string(y) })
					if err != nil {
						t.Fatal(err)
					}
					if len(r) > 1 {
						multi++
					}
					for i := 1; i < len(r); i++ {
						if rank[r[i-1].Type] >= rank[r[i].Type] {
							t.Fatalf("vara=%d tithi=%d nak=%d sunNak=%d: %s precedes %s, "+
								"which is not the declaration order",
								vara, tithi, nak, sunNak, r[i-1].Type, r[i].Type)
						}
					}
				}
			}
		}
	}
	if multi == 0 {
		t.Fatal("no combination produced two or more yogas: the ordering claim is vacuous")
	}
	t.Logf("%d combinations produced two or more yogas", multi)
}

func TestSpecialYogaRejectsOutOfRange(t *testing.T) {
	for _, bad := range [][4]int{
		{-1, 0, 0, 0}, {7, 0, 0, 0},
		{0, -1, 0, 0}, {0, 30, 0, 0},
		{0, 0, -1, 0}, {0, 0, 27, 0},
		{0, 0, 0, -1}, {0, 0, 0, 27},
	} {
		if _, err := ComputeSpecialYogas(bad[0], bad[1], bad[2], bad[3],
			func(types.SpecialYogaType) string { return "" }); err == nil {
			t.Errorf("vara=%d tithi=%d nak=%d sunNak=%d was accepted", bad[0], bad[1], bad[2], bad[3])
		}
	}
}

func TestComputeVarjyamIsTheOlderSingleWindowForm(t *testing.T) {
	g := loadBigWindowsGolden(t)
	getMoon, _ := bigWindowEphemeris(t)

	var (
		days         int
		single, none int
		fewerThanAll int // days where the windows form found more than the primitive
		differentIt  int // days where the primitive's window is not windows[0]
	)
	for _, d := range g.Days {
		days++
		all := ComputeVarjyamWindows(d.Sunrise, d.NextSunrise, getMoon)

		if got := GetNakshatraIndexAtTime(d.Sunrise, getMoon); got != d.NakshatraIndex {
			t.Errorf("day %d: nakshatra at sunrise = %d, TypeScript said %d", d.I, got, d.NakshatraIndex)
		}
		one, ok, err := ComputeVarjyam(d.NakshatraIndex, d.Sunrise, d.NextSunrise, getMoon)
		if err != nil {
			t.Fatalf("day %d: %v", d.I, err)
		}

		switch {
		case d.VarjyamSingle == nil && ok:
			t.Errorf("day %d: Go found a window %d..%d, TypeScript found none", d.I, one.StartMs, one.EndMs)
		case d.VarjyamSingle != nil && !ok:
			t.Errorf("day %d: TypeScript found %d..%d, Go found none", d.I, d.VarjyamSingle.Start, d.VarjyamSingle.End)
		case d.VarjyamSingle != nil && ok:
			if one.StartMs != d.VarjyamSingle.Start || one.EndMs != d.VarjyamSingle.End {
				t.Errorf("day %d: %d..%d, want %d..%d", d.I, one.StartMs, one.EndMs,
					d.VarjyamSingle.Start, d.VarjyamSingle.End)
			}
		}

		if !ok {
			none++
			continue
		}
		single++
		if len(all) > 1 {
			fewerThanAll++
		}
		if len(all) == 0 || all[0] != one {
			differentIt++
		}
	}

	if days == 0 {
		t.Fatal("no days in the golden; every count below would be vacuous")
	}
	if single == 0 {
		t.Fatal("ComputeVarjyam never produced a window; the comparison is vacuous")
	}
	if single != 183 {
		t.Errorf("days with a single-form window = %d, want 183", single)
	}
	if fewerThanAll == 0 && differentIt == 0 {
		t.Errorf("over %d days the single-window form never differed from the windows form; "+
			"either the sweep no longer contains a nakshatra-transition day or the two have converged", days)
	}
	t.Logf("%d days: %d with a window, %d without; %d where the windows form found more, %d where the chosen window differs",
		days, single, none, fewerThanAll, differentIt)
}

func TestComputeVarjyamRejectsABadIndex(t *testing.T) {
	getMoon, _ := bigWindowEphemeris(t)
	for _, bad := range []int{-1, 27, 100} {
		if _, _, err := ComputeVarjyam(bad, 0, 86_400_000, getMoon); err == nil {
			t.Errorf("index %d: no error", bad)
		}
	}
	if _, _, err := ComputeVarjyam(0, 0, 86_400_000, getMoon); err != nil {
		t.Errorf("index 0: %v", err)
	}

	// Pune, sunrise 2025-03-20T00:53:00.123Z with Anuradha (16) in force: every other index used to
	// return a window a few seconds long with ok=true.
	const sunrise, nextSunrise = int64(1742431980123), int64(1742518307891)
	atSunrise := GetNakshatraIndexAtTime(sunrise, getMoon)
	for i := 0; i < 27; i++ {
		if i == atSunrise {
			continue
		}
		if w, ok, err := ComputeVarjyam(i, sunrise, nextSunrise, getMoon); ok || err != nil {
			t.Errorf("index %d with %d at sunrise: %v ok=%v err=%v, want no window", i, atSunrise, w, ok, err)
		}
	}
}
