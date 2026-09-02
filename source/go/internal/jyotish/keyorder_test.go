package jyotish

import (
	"bytes"
	"encoding/json"
	"sort"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
)

type jyotishKeyOrderGolden struct {
	Unlocalized map[string][]string `json:"unlocalized"`
	Published   map[string][]string `json:"published"`
}

func jyotishKeyOrderRegistry() map[string]any {
	vetoTrue := true
	return map[string]any{
		"AshtakootResult": AshtakootResult{
			Koots: []KootScore{}, Cancellations: []string{},
		},
		"KootScore":           KootScore{},
		"PathuPoruthamResult": PathuPoruthamResult{Poruthams: []PoruthamScore{}},
		"PoruthamScore":       PoruthamScore{},
		"PoruthamScoreWithVeto": PoruthamScore{
			Name: PoruthamRajju, Passes: false, Description: "", Veto: &vetoTrue,
		},

		"YoginiDashaResult": YoginiDashaResult{MahaDashas: []YoginiMahaDasha{}},
		"YoginiMahaDasha":   YoginiMahaDasha{AntarDashas: []YoginiAntarDasha{}},
		"YoginiAntarDasha":  YoginiAntarDasha{},
		"CharaDashaResult":  CharaDashaResult{MahaDashas: []CharaMahaDasha{}},
		"CharaMahaDasha":    CharaMahaDasha{},
		"NarayanDashaResult": NarayanDashaResult{
			MahaDashas: []NarayanMahaDasha{},
		},
		"NarayanMahaDasha": NarayanMahaDasha{},

		"VarshaphalaChart": VarshaphalaChart{
			Planets: []types.PlanetPlacement{},
		},
		"MunthaInfo":    MunthaInfo{},
		"Sahams":        Sahams{},
		"SahamPosition": SahamPosition{},

		"KpCuspalSubLords": KpCuspalSubLords{Cusps: []KpSubLordInfo{}},
		"KpSubLordInfo":    KpSubLordInfo{},
		"KpSignificators":  KpSignificators{},
		"KpByPlanet":       KpByPlanet{},
		"KpByHouse":        KpByHouse{},
		"TithiPraveshaChart": TithiPraveshaChart{
			Planets: []types.PlanetPlacement{},
		},
	}
}

var jyotishDeclaredShapes = []string{
	"AshtakootResult", "KootScore",
	"PathuPoruthamResult", "PoruthamScore", "PoruthamScoreWithVeto",
	"YoginiDashaResult", "YoginiMahaDasha", "YoginiAntarDasha",
	"CharaDashaResult", "CharaMahaDasha",
	"NarayanDashaResult", "NarayanMahaDasha",
	"VarshaphalaChart", "MunthaInfo", "Sahams", "SahamPosition",
	"KpCuspalSubLords", "KpSubLordInfo", "KpSignificators", "KpByPlanet",
	"KpByHouse", "TithiPraveshaChart",
}

func loadJyotishKeyOrderGolden(t *testing.T) jyotishKeyOrderGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "core", "keyorder-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g jyotishKeyOrderGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.Published) == 0 {
		t.Fatal("golden is empty")
	}
	return g
}

func jyotishMarshalledKeys(t *testing.T, v any) []string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal %T: %v", v, err)
	}
	dec := json.NewDecoder(bytes.NewReader(b))
	tok, err := dec.Token()
	if err != nil {
		t.Fatalf("decode %T: %v", v, err)
	}
	if d, ok := tok.(json.Delim); !ok || d != '{' {
		t.Fatalf("%T did not marshal to an object: %s", v, b)
	}
	var keys []string
	for dec.More() {
		tok, err := dec.Token()
		if err != nil {
			t.Fatalf("decode %T: %v", v, err)
		}
		name, ok := tok.(string)
		if !ok {
			t.Fatalf("%T: expected a key, got %v", v, tok)
		}
		keys = append(keys, name)
		var skip json.RawMessage
		if err := dec.Decode(&skip); err != nil {
			t.Fatalf("decode %T: %v", v, err)
		}
	}
	return keys
}

func TestJyotishPublishedKeyOrderMatchesTypeScript(t *testing.T) {
	g := loadJyotishKeyOrderGolden(t)
	registry := jyotishKeyOrderRegistry()

	all := map[string][]string{}
	for name, keys := range g.Unlocalized {
		all[name] = keys
	}
	for name, keys := range g.Published {
		all[name] = keys
	}

	names := make([]string, 0, len(registry))
	for name := range registry {
		names = append(names, name)
	}
	sort.Strings(names)

	for _, name := range names {
		want, ok := all[name]
		if !ok {
			t.Errorf("%s is registered here but the golden does not record it; add it "+
				"to writeKeyOrderGolden", name)
			continue
		}
		got := jyotishMarshalledKeys(t, registry[name])
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
	}

	if len(jyotishDeclaredShapes) != len(registry) {
		t.Errorf("jyotishDeclaredShapes has %d entries and the registry %d",
			len(jyotishDeclaredShapes), len(registry))
	}
	for _, name := range jyotishDeclaredShapes {
		if _, ok := registry[name]; !ok {
			t.Errorf("%s is in jyotishDeclaredShapes but not in the registry", name)
		}
	}
	t.Logf("%d jyotish-declared shapes checked against core/testdata/keyorder-golden.json",
		len(names))
}

func TestJyotishKeyOrderWouldCatchAReorder(t *testing.T) {
	type reordered struct {
		Description string       `json:"description"`
		Passes      bool         `json:"passes"`
		Name        PoruthamName `json:"name"`
	}
	real := jyotishMarshalledKeys(t, PoruthamScore{})
	twin := jyotishMarshalledKeys(t, reordered{})
	if len(real) != 3 || len(twin) != 3 {
		t.Fatalf("expected 3 keys each, got %v and %v", real, twin)
	}
	same := true
	for i := range real {
		if real[i] != twin[i] {
			same = false
		}
	}
	if same {
		t.Errorf("a deliberately reordered twin produced the same key sequence %v; the "+
			"extractor is not reading order", real)
	}
	if real[0] != "name" {
		t.Errorf("PoruthamScore's first key is %q, want \"name\"", real[0])
	}
}
