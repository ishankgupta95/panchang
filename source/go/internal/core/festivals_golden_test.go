package core

import (
	"encoding/json"
	"strconv"
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

// The sweep pins the DISPATCH: each grid varies only the two fields one matcher arm reads.

type festivalGoldenCase struct {
	Label     string `json:"label"`
	Festivals []struct {
		Key         string             `json:"key"`
		Type        types.FestivalType `json:"type"`
		Description *string            `json:"description"`
	} `json:"festivals"`
}

type festivalsGolden struct {
	Meta struct {
		Claim               string `json:"claim"`
		Cases               int    `json:"cases"`
		DistinctKeysEmitted int    `json:"distinctKeysEmitted"`
	} `json:"_meta"`
	Cases []festivalGoldenCase `json:"cases"`
}

func loadFestivalsGolden(t *testing.T) festivalsGolden {
	t.Helper()
	raw, err := repopath.ReadTestData("goldens", "core", "festivals-golden.json")
	if err != nil {
		t.Fatalf("reading festivals-golden.json: %v", err)
	}
	var g festivalsGolden
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatalf("parsing festivals-golden.json: %v", err)
	}
	if len(g.Cases) != g.Meta.Cases || len(g.Cases) == 0 {
		t.Fatalf("golden declares %d cases and carries %d", g.Meta.Cases, len(g.Cases))
	}
	return g
}

func ctxForLabel(t *testing.T, label string) *FestivalComputeContext {
	t.Helper()
	p := strings.Split(label, "|")
	num := func(s string) int {
		v, err := strconv.Atoi(s)
		if err != nil {
			t.Fatalf("label %q: %v", label, err)
		}
		return v
	}
	intp := func(v int) *int { return &v }

	if len(p) == 4 && (p[0] == "N" || p[0] == "A") {
		isAdhika := p[0] == "A"
		a, b := num(p[2]), num(p[3])
		c := &FestivalComputeContext{IsAdhika: isAdhika}
		switch p[1] {
		case "mt":
			c.ChandraMasaIndex, c.TithiIndex = a, b
			c.NakshatraIndex, c.VaraIndex, c.SolarMasaIndex = 26, 3, 11
		case "mv":
			c.ChandraMasaIndex, c.VaraIndex = a, b
			c.TithiIndex, c.NakshatraIndex, c.SolarMasaIndex = 9, 26, 11
		case "mn":
			c.ChandraMasaIndex, c.NakshatraIndex = a, b
			c.TithiIndex, c.VaraIndex, c.SolarMasaIndex = 9, 3, 11
		case "sn":
			c.SolarMasaIndex, c.NakshatraIndex = a, b
			c.TithiIndex, c.VaraIndex, c.ChandraMasaIndex = 9, 3, 8
		default:
			t.Fatalf("label %q: unknown grid %q", label, p[1])
		}
		return c
	}

	switch p[0] {
	case "range":
		return &FestivalComputeContext{
			ChandraMasaIndex: 4, VaraIndex: 5, TithiIndex: num(p[1]),
			NakshatraIndex: 26, SolarMasaIndex: 11,
		}
	case "kala":
		rule := FestivalDateRule(p[1])
		end := num(p[2])
		c := &FestivalComputeContext{
			ChandraMasaIndex: 6, TithiIndex: end, NakshatraIndex: 26, VaraIndex: 3, SolarMasaIndex: 11,
			TithiByRule: map[FestivalDateRule]int{rule: end},
		}
		if p[3] != "x" {
			c.TithiByRuleStart = map[FestivalDateRule]int{rule: num(p[3])}
		}
		if p[4] != "x" {
			c.PriorDayTithiByRule = map[FestivalDateRule]int{rule: num(p[4])}
		}
		return c
	case "af":
		d := strings.Split(p[1], "-")
		if len(d) != 4 {
			t.Fatalf("label %q: want four dash-separated aparahna tithis", label)
		}
		v := func(i int) int { return num(d[i]) }
		return &FestivalComputeContext{
			ChandraMasaIndex: 6, TithiIndex: 9, NakshatraIndex: 26, VaraIndex: 3, SolarMasaIndex: 11,
			TithiByRuleStart:         map[FestivalDateRule]int{RuleAparahna: v(0)},
			TithiByRule:              map[FestivalDateRule]int{RuleAparahna: v(1)},
			PriorDayTithiByRuleStart: map[FestivalDateRule]int{RuleAparahna: v(2)},
			PriorDayTithiByRule:      map[FestivalDateRule]int{RuleAparahna: v(3)},
		}
	case "jn":
		bits := num(p[2])
		tithi := 21
		if p[1] == "u" {
			tithi = 22
		}
		return &FestivalComputeContext{
			ChandraMasaIndex: 5, TithiIndex: tithi, NakshatraIndex: 26, VaraIndex: 3, SolarMasaIndex: 11,
			JanmashtamiNishita: &JanmashtamiNishita{
				AshtamiAtNishita: bits&1 != 0,
				RohiniAtNishita:  bits&2 != 0,
				NextDayClaims:    bits&4 != 0,
				PrevDayClaimed:   bits&8 != 0,
			},
		}
	case "ek":
		c := &FestivalComputeContext{
			TithiIndex: num(p[1]), ChandraMasaIndex: num(p[2]), IsAdhika: p[3] == "A",
			NakshatraIndex: 26, VaraIndex: 3, SolarMasaIndex: 11,
		}
		switch p[4] {
		case "none":
		case "ekadashiDashamiViddha":
			c.EkadashiDashamiViddha = true
		case "vaishnavaDwadashiToday":
			c.VaishnavaDwadashiToday = true
		case "ekadashiKshayaToday":
			c.EkadashiKshayaToday = true
		case "ekadashiGaunaToday":
			c.EkadashiGaunaToday = true
		case "ekadashiVriddhaDwadashiToday":
			c.EkadashiVriddhaDwadashiToday = true
		case "ekadashiVriddhaDwadashiTomorrow":
			c.EkadashiVriddhaDwadashiTomorrow = true
		case "ekadashiTrisprishaToday":
			c.EkadashiTrisprishaToday = true
		case "ekadashiTrisprishaYesterday":
			c.EkadashiTrisprishaYesterday = true
		case "ekadashiVriddhaFirstDay":
			c.EkadashiVriddhaFirstDay = true
		default:
			t.Fatalf("label %q: unknown ekadashi flag %q", label, p[4])
		}
		return c
	case "sk", "skn":
		c := &FestivalComputeContext{
			TithiIndex: 9, NakshatraIndex: 26, VaraIndex: 3, SolarMasaIndex: 11,
			ChandraMasaIndex: 8, Region: types.FestivalRegion(p[1]),
		}
		r := num(p[2])
		if p[0] == "sk" {
			c.SankrantiRashi = intp(r)
		} else {
			c.NextDaySankrantiRashi, c.PrevDaySankrantiRashi = intp(r), intp(r)
		}
		return c
	case "ny":
		c := &FestivalComputeContext{
			TithiIndex: 9, NakshatraIndex: 26, VaraIndex: 3, SolarMasaIndex: 11,
			ChandraMasaIndex: 8, Region: types.FestivalRegion(p[1]),
		}
		switch p[2] {
		case "vaisakhiToday":
			c.VaisakhiToday = true
		case "vishuToday":
			c.VishuToday = true
		case "pohelaBoishakhToday":
			c.PohelaBoishakhToday = true
		default:
			t.Fatalf("label %q: unknown new-year flag %q", label, p[2])
		}
		return c
	case "extra":
		switch p[1] {
		case "krittika-in-day":
			return &FestivalComputeContext{
				TithiIndex: 9, NakshatraIndex: 5, VaraIndex: 3, SolarMasaIndex: 11,
				ChandraMasaIndex: 8, NakshatraIndicesInDay: map[int]bool{2: true, 14: true},
			}
		case "purnimanta-naming":
			return &FestivalComputeContext{
				TithiIndex: 14, ChandraMasaIndex: 7, NakshatraIndex: 26, VaraIndex: 3, SolarMasaIndex: 11,
				AmantaMasaName: "Kartika", PurnimantaMasaName: "Margashirsha",
			}
		case "bhadra-notice":
			return &FestivalComputeContext{
				TithiIndex: 14, ChandraMasaIndex: 4, NakshatraIndex: 26, VaraIndex: 3, SolarMasaIndex: 11,
				TithiByRule: map[FestivalDateRule]int{RuleAparahna: 14},
				Bhadra: &UtcWindowMs{
					StartMs: types.DateUTC(2026, 7, 28).Ms() + 3*3_600_000,
					EndMs:   types.DateUTC(2026, 7, 28).Ms() + 9*3_600_000 + 30*60_000,
				},
				FormatClock: func(ms int64) string { return types.Date(ms).ISOString()[11:16] },
			}
		}
	}
	t.Fatalf("label %q: unrecognised", label)
	return nil
}

func TestFestivalDispatchMatchesTypeScript(t *testing.T) {
	g := loadFestivalsGolden(t)
	identity := func(k string) string { return k }
	rashiName := func(i int) string { return "R" + strconv.Itoa(i) }

	emitted := map[string]int{}
	nonEmpty := 0
	for _, c := range g.Cases {
		got := ComputeFestivals(ctxForLabel(t, c.Label), identity, rashiName)
		if len(got) != len(c.Festivals) {
			gotKeys := make([]string, len(got))
			for i, f := range got {
				gotKeys[i] = string(f.Key)
			}
			wantKeys := make([]string, len(c.Festivals))
			for i, f := range c.Festivals {
				wantKeys[i] = f.Key
			}
			t.Errorf("%s: %d festivals [%s], TS %d [%s]",
				c.Label, len(got), strings.Join(gotKeys, ","), len(c.Festivals), strings.Join(wantKeys, ","))
			continue
		}
		if len(got) > 0 {
			nonEmpty++
		}
		for i, want := range c.Festivals {
			gf := got[i]
			wantDesc := ""
			if want.Description != nil {
				wantDesc = *want.Description
			}
			if gf.Key != want.Key || gf.Type != want.Type || gf.Description != wantDesc {
				t.Errorf("%s[%d]: got {%s %s %q}, TS {%s %s %q}",
					c.Label, i, gf.Key, gf.Type, gf.Description, want.Key, want.Type, wantDesc)
			}
			emitted[want.Key]++
		}
	}

	if len(emitted) != g.Meta.DistinctKeysEmitted {
		t.Errorf("emitted %d distinct keys, golden declares %d", len(emitted), g.Meta.DistinctKeysEmitted)
	}
	if nonEmpty < 100 {
		t.Errorf("only %d of %d contexts emitted anything; the sweep has gone vacuous",
			nonEmpty, len(g.Cases))
	}
	t.Logf("%d contexts, %d non-empty, %d distinct keys, all matching TypeScript",
		len(g.Cases), nonEmpty, len(emitted))
}

func TestFestivalRegistryShape(t *testing.T) {
	if len(festivalRegistry) != 53 {
		t.Errorf("registry holds %d rules, want 53", len(festivalRegistry))
	}
	kinds := map[FestivalRuleKind]int{}
	seen := map[string]bool{}
	for _, r := range festivalRegistry {
		if r.Kind < KindSolarNakshatra || r.Kind > KindMasaTithi {
			t.Errorf("rule %q has no D8 kind: the naive-int-port failure mode", r.Key)
		}
		kinds[r.Kind]++
		if seen[r.Key] {
			t.Errorf("duplicate registry key %q", r.Key)
		}
		seen[r.Key] = true
		switch r.Kind {
		case KindSolarNakshatra:
			if r.SolarMasa < 0 || r.SolarMasa > 11 || r.Nakshatra < 0 || r.Nakshatra > 26 {
				t.Errorf("rule %q: solarMasa %d / nakshatra %d out of range", r.Key, r.SolarMasa, r.Nakshatra)
			}
		case KindMasaNakshatra:
			if r.Masa < 0 || r.Masa > 11 || r.Nakshatra < 0 || r.Nakshatra > 26 {
				t.Errorf("rule %q: masa %d / nakshatra %d out of range", r.Key, r.Masa, r.Nakshatra)
			}
		case KindMasaVara:
			if r.Masa < 0 || r.Masa > 11 || r.Vara < 0 || r.Vara > 6 {
				t.Errorf("rule %q: masa %d / vara %d out of range", r.Key, r.Masa, r.Vara)
			}
		case KindMasaTithi:
			if r.Masa < 0 || r.Masa > 11 || r.Tithi < 0 || r.Tithi > 29 {
				t.Errorf("rule %q: masa %d / tithi %d out of range", r.Key, r.Masa, r.Tithi)
			}
		}
	}
	want := map[FestivalRuleKind]int{
		KindMasaTithi: 44, KindMasaVara: 6, KindSolarNakshatra: 1, KindMasaNakshatra: 2,
	}
	for k, n := range want {
		if kinds[k] != n {
			t.Errorf("kind %d: %d rules, want %d", k, kinds[k], n)
		}
	}

	// Entry 0 carries masa 0 AND tithi 0: zero-as-absence would file it nowhere.
	if festivalRegistry[0].Key != "ugadi" || festivalRegistry[0].Masa != 0 ||
		festivalRegistry[0].Tithi != 0 || festivalRegistry[0].Kind != KindMasaTithi {
		t.Errorf("registry[0] is %+v; D8's worked example is {ugadi, masa 0, tithi 0, KindMasaTithi}",
			festivalRegistry[0])
	}

	if len(sankrantiRegional) != 6 {
		t.Errorf("sankrantiRegional has %d rashi keys, want 6", len(sankrantiRegional))
	}
	total := 0
	for rashi, rules := range sankrantiRegional {
		if rashi < 0 || rashi > 11 {
			t.Errorf("sankrantiRegional rashi key %d out of range", rashi)
		}
		total += len(rules)
	}
	if total != 13 {
		t.Errorf("sankrantiRegional holds %d regional rules, want 13", total)
	}
}
