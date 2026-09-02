package core

import (
	"encoding/json"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
	"sort"
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

type keyOrderGolden struct {
	Unlocalized map[string][]string `json:"unlocalized"`
	Published   map[string][]string `json:"published"`
}

var notYetPorted = map[string]string{}

var ownedByJyotish = map[string]string{
	"AshtakootResult":       "matching.ts declares it",
	"KootScore":             "matching.ts declares it",
	"PathuPoruthamResult":   "pathuPorutham.ts declares it",
	"PoruthamScore":         "pathuPorutham.ts declares it",
	"PoruthamScoreWithVeto": "pathuPorutham.ts declares it",
	"YoginiDashaResult":     "dasha.ts declares it",
	"YoginiMahaDasha":       "dasha.ts declares it",
	"YoginiAntarDasha":      "dasha.ts declares it",
	"CharaDashaResult":      "dasha.ts declares it",
	"CharaMahaDasha":        "dasha.ts declares it",
	"NarayanDashaResult":    "dasha.ts declares it",
	"NarayanMahaDasha":      "dasha.ts declares it",
	"VarshaphalaChart":      "varshaphala.ts declares it",
	"MunthaInfo":            "varshaphala.ts declares it",
	"Sahams":                "varshaphala.ts declares it",
	"SahamPosition":         "varshaphala.ts declares it",
	"KpCuspalSubLords":      "kpSubLord.ts declares it",
	"KpSubLordInfo":         "kpSubLord.ts declares it",
	"KpSignificators":       "kpSubLord.ts declares it",
	"KpByPlanet":            "kpSubLord.ts declares it (byPlanet's shape)",
	"KpByHouse":             "kpSubLord.ts declares it (byHouse's shape)",
	"TithiPraveshaChart":    "tithiPravesha.ts declares it",
}

func keyOrderRegistry() map[string]any {
	return map[string]any{
		"TithiInfo":                   types.TithiInfo{},
		"NakshatraInfo":               types.NakshatraInfo{},
		"YogaInfo":                    types.YogaInfo{},
		"KaranaInfo":                  types.KaranaInfo{},
		"VaraInfo":                    types.VaraInfo{},
		"RashiInfo":                   types.RashiInfo{},
		"NakshatraIndexInfo":          types.NakshatraIndexInfo{},
		"MasaInfo":                    types.MasaInfo{},
		"SamvatInfo":                  types.SamvatInfo{},
		"ChandraMasaInfo":             types.ChandraMasaInfo{},
		"UnlocalizedChoghadiyaInfo":   types.UnlocalizedChoghadiyaInfo{},
		"UnlocalizedChoghadiyaSlot":   types.UnlocalizedChoghadiyaSlot{},
		"UnlocalizedHoraSlot":         types.UnlocalizedHoraSlot{},
		"UnlocalizedGowriSlot":        types.UnlocalizedGowriSlot{},
		"UnlocalizedDoGhatiSlot":      types.UnlocalizedDoGhatiSlot{},
		"UtcWindow":                   types.UtcWindow{},
		"UnlocalizedDurMuhurtaPeriod": types.UnlocalizedDurMuhurtaPeriod{},
		"AnandadiYogaInfo":            types.AnandadiYogaInfo{},
		"GandaMulaInfoInactive":       types.GandaMulaInfo{},
		"GandaMulaInfoActive": types.GandaMulaInfo{
			Active: true, NakshatraName: "Mula", Severity: types.GandaMulaSevere,
		},
		"PanchakaInfoInactive": types.PanchakaInfo{},
		"PanchakaInfoActive": types.PanchakaInfo{
			Active: true, Type: types.PanchakaSamanya, Name: "Samanya Panchaka",
			IsDosha: false, OnsetVara: 3,
		},

		"ChoghadiyaInfo":   types.ChoghadiyaInfo{},
		"ChoghadiyaSlot":   types.ChoghadiyaSlot{},
		"HoraInfo":         types.HoraInfo{},
		"HoraSlot":         types.HoraSlot{},
		"GowriInfo":        types.GowriInfo{},
		"GowriSlot":        types.GowriSlot{},
		"DoGhatiInfo":      types.DoGhatiInfo{},
		"DoGhatiSlot":      types.DoGhatiSlot{},
		"TimePeriod":       types.TimePeriod{},
		"DurMuhurtaPeriod": types.DurMuhurtaPeriod{},

		"DailyTithiInfo":     types.DailyTithiInfo{},
		"DailyNakshatraInfo": types.DailyNakshatraInfo{},
		"DailyYogaInfo":      types.DailyYogaInfo{},
		"DailyKaranaInfo":    types.DailyKaranaInfo{},

		"DailyPanchangResult":    types.DailyPanchangResult{},
		"DailySun":               types.DailySun{},
		"DailyMoon":              types.DailyMoon{},
		"DailyAngas":             types.DailyAngas{},
		"DailyCalendarLabels":    types.DailyCalendarLabels{},
		"MuhurtaWindows":         types.MuhurtaWindows{},
		"InauspiciousWindows":    types.InauspiciousWindows{},
		"DayPeriods":             types.DayPeriods{},
		"InstantPanchangResult":  types.InstantPanchangResult{},
		"SunPosition":            types.SunPosition{},
		"MoonPosition":           types.MoonPosition{},
		"InstantAngas":           types.InstantAngas{},
		"CalendarLabels":         types.CalendarLabels{},
		"InstantInauspicious":    types.InstantInauspicious{},
		"ResolvedTimezoneOffset": types.ResolvedTimezone{OffsetMinutes: 330},
		"ResolvedTimezoneNamed":  types.ResolvedTimezone{OffsetMinutes: -300, Zone: "America/New_York"},

		"PlanetaryPositions": types.PlanetaryPositions{},
		"GrahaPosition":      types.GrahaPosition{},
		"LagnaInfo":          types.LagnaInfo{},
		"LagnaNakshatra":     types.LagnaNakshatra{},
		"SripatiLagnaInfo":   types.SripatiLagnaInfo{Cusps: make([]float64, 12)},

		"BhavaChart":      types.BhavaChart{Houses: make([]types.HouseInfo, 12)},
		"HouseInfo":       types.HouseInfo{},
		"BirthChart":      types.BirthChart{Planets: make([]types.PlanetPlacement, 9)},
		"PlanetPlacement": types.PlanetPlacement{},
		"PlanetsByGraha":  types.PlanetsByGraha{},
		"DivisionalChart": types.DivisionalChart{Planets: make([]types.PlanetPlacement, 9)},
		"AshtakavargaResult": types.AshtakavargaResult{
			Sarvashtaka: make(types.BhinnashtakaGrid, 12),
			Reduced:     &types.AshtakavargaReduced{},
		},
		"AshtakavargaResultWithoutReduced": types.AshtakavargaResult{
			Sarvashtaka: make(types.BhinnashtakaGrid, 12),
		},
		"BhinnashtakaByGraha": types.BhinnashtakaByGraha{},
		"AshtakavargaReduced": types.AshtakavargaReduced{},
		"JaiminiKarakas":      types.JaiminiKarakas{},
		"Jaimini8Karakas":     types.Jaimini8Karakas{},
		"ArgalaPerBhava": types.ArgalaPerBhava{
			Argala:       []types.PlanetPlacement{},
			Virodhargala: []types.PlanetPlacement{},
			Trikona:      &types.ArgalaTrikona{},
		},
		"ArgalaPerBhavaWithoutTrikona": types.ArgalaPerBhava{
			Argala:       []types.PlanetPlacement{},
			Virodhargala: []types.PlanetPlacement{},
		},
		"ArgalaTrikona":       types.ArgalaTrikona{},
		"Arudha":              types.Arudha{},
		"MangalDoshaInfo":     types.MangalDoshaInfo{Cancellations: []string{}},
		"MangalReference":     types.MangalReference{},
		"MangalCompatibility": types.MangalCompatibility{Cancellations: []string{}},
		"KaalSarpDoshaInfo":   types.KaalSarpDoshaInfo{},
		"PitruDoshaInfo":      types.PitruDoshaInfo{Reasons: []string{}},

		"PlanetShadbala":    types.PlanetShadbala{},
		"ShadbalaResult":    types.ShadbalaResult{},
		"BhavaBalaResult":   types.BhavaBalaResult{Houses: make([]types.BhavaBalaPerHouse, 12)},
		"BhavaBalaPerHouse": types.BhavaBalaPerHouse{},
		"Yoga":              types.Yoga{Reasons: []string{}},
		"YogaWithBhanga": types.Yoga{
			Reasons: []string{}, Bhanga: &types.YogaBhanga{Reasons: []string{}},
		},
		"YogaBhanga": types.YogaBhanga{Reasons: []string{}},
		"VimshottariDashaResult": types.VimshottariDashaResult{
			MahaDashas: []types.MahaDasha{},
		},
		"MahaDasha":       types.MahaDasha{AntarDashas: []types.AntarDasha{}},
		"AntarDasha":      types.AntarDasha{},
		"PratyantarDasha": types.PratyantarDasha{},

		"SadeSatiInfo":         types.SadeSatiInfo{},
		"SadeSatiInfoInactive": types.SadeSatiInfo{},

		"Upagrahas":        types.Upagrahas{},
		"UpagrahaPosition": types.UpagrahaPosition{},
	}
}

func loadKeyOrderGolden(t *testing.T) keyOrderGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "core", "keyorder-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g keyOrderGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.Unlocalized) == 0 || len(g.Published) == 0 {
		t.Fatal("golden is empty")
	}
	return g
}

func marshalledKeys(t *testing.T, v any) []string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal %T: %v", v, err)
	}
	dec := json.NewDecoder(strings.NewReader(string(b)))
	tok, err := dec.Token()
	if err != nil {
		t.Fatalf("decode %T: %v", v, err)
	}
	if d, ok := tok.(json.Delim); !ok || d != '{' {
		t.Fatalf("%T did not marshal to an object: %s", v, b)
	}
	var keys []string
	depth := 0
	for dec.More() || depth > 0 {
		tok, err := dec.Token()
		if err != nil {
			t.Fatalf("decode %T: %v", v, err)
		}
		switch tv := tok.(type) {
		case json.Delim:
			switch tv {
			case '{', '[':
				depth++
			case '}', ']':
				depth--
				if depth < 0 {
					return keys
				}
			}
		case string:
			if depth == 0 {
				keys = append(keys, tv)
				if err := skipValue(dec); err != nil {
					t.Fatalf("decode %T: %v", v, err)
				}
			}
		}
	}
	return keys
}

func skipValue(dec *json.Decoder) error {
	tok, err := dec.Token()
	if err != nil {
		return err
	}
	d, ok := tok.(json.Delim)
	if !ok {
		return nil
	}
	depth := 1
	if d != '{' && d != '[' {
		return nil
	}
	for depth > 0 {
		tok, err := dec.Token()
		if err != nil {
			return err
		}
		if d, ok := tok.(json.Delim); ok {
			switch d {
			case '{', '[':
				depth++
			case '}', ']':
				depth--
			}
		}
	}
	return nil
}

func TestPublishedKeyOrderMatchesTypeScript(t *testing.T) {
	g := loadKeyOrderGolden(t)
	registry := keyOrderRegistry()

	all := map[string][]string{}
	for name, keys := range g.Unlocalized {
		all[name] = keys
	}
	for name, keys := range g.Published {
		all[name] = keys
	}

	names := make([]string, 0, len(all))
	for name := range all {
		names = append(names, name)
	}
	sort.Strings(names)

	checked := 0
	for _, name := range names {
		want := all[name]
		v, ok := registry[name]
		if !ok {
			if reason, listed := ownedByJyotish[name]; listed {
				t.Logf("%s: checked in internal/jyotish (%s)", name, reason)
				continue
			}
			if reason, listed := notYetPorted[name]; listed {
				t.Logf("%s: not ported yet (%s)", name, reason)
				continue
			}
			t.Errorf("golden records %s but no Go struct is registered for it, and it is not "+
				"in notYetPorted. Add the struct to keyOrderRegistry, or the name to "+
				"notYetPorted with the task that will land it.", name)
			continue
		}
		got := marshalledKeys(t, v)
		if len(got) != len(want) {
			t.Errorf("%s: %d keys, want %d\n got %v\nwant %v", name, len(got), len(want), got, want)
			continue
		}
		for i := range got {
			if got[i] != want[i] {
				t.Errorf("%s: key %d is %q, want %q\n got %v\nwant %v", name, i, got[i], want[i], got, want)
				break
			}
		}
		checked++
	}

	for name, reason := range notYetPorted {
		if _, ok := registry[name]; ok {
			t.Errorf("%s is registered but still listed in notYetPorted (%q). Remove the entry", name, reason)
		}
		if _, ok := all[name]; !ok {
			t.Errorf("%s is listed in notYetPorted but the golden does not record it", name)
		}
	}
	for name, reason := range ownedByJyotish {
		if _, ok := registry[name]; ok {
			t.Errorf("%s is registered here but also listed as ownedByJyotish (%q); the "+
				"two halves of the gate must be disjoint", name, reason)
		}
		if _, ok := all[name]; !ok {
			t.Errorf("%s is listed as ownedByJyotish but the golden does not record it", name)
		}
	}

	if checked < len(registry) {
		t.Errorf("only %d of %d registered shapes were checked, so the golden is missing some",
			checked, len(registry))
	}
	t.Logf("%d shapes checked here, %d in internal/jyotish, %d awaiting their task",
		checked, len(ownedByJyotish), len(notYetPorted))
}

func TestKeyOrderTestWouldCatchAReorder(t *testing.T) {
	type reordered struct {
		Index                int           `json:"index"`
		Name                 string        `json:"name"`
		CompletionPercentage float64       `json:"completionPercentage"`
		EndTime              *types.JSDate `json:"endTime"`
		Paksha               string        `json:"paksha"`
		Number               int           `json:"number"`
	}
	real := marshalledKeys(t, types.TithiInfo{})
	wrong := marshalledKeys(t, reordered{})

	if len(real) != 6 || len(wrong) != 6 {
		t.Fatalf("expected 6 keys each, got %d and %d. The token walk is broken", len(real), len(wrong))
	}
	same := true
	for i := range real {
		if real[i] != wrong[i] {
			same = false
			break
		}
	}
	if same {
		t.Fatalf("the interface-order twin produced the same key sequence as the real struct "+
			"(%v): marshalledKeys is not reading emission order", real)
	}
	for i, k := range []string{"index", "name", "paksha", "number", "completionPercentage", "endTime"} {
		if real[i] != k {
			t.Errorf("TithiInfo key %d is %q, want %q", i, real[i], k)
		}
	}
}
