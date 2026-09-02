package jyotish

import (
	"encoding/json"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
)

type jyotishGolden struct {
	ChandraBalam []struct {
		Janma   int                    `json:"janma"`
		Transit int                    `json:"transit"`
		Lang    types.Language         `json:"lang"`
		Info    types.ChandraBalamInfo `json:"info"`
	} `json:"chandraBalam"`
	Tarabala []struct {
		Janma   int                `json:"janma"`
		Transit int                `json:"transit"`
		Lang    types.Language     `json:"lang"`
		Info    types.TarabalaInfo `json:"info"`
	} `json:"tarabala"`
}

func loadJyotishGolden(t *testing.T) jyotishGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "jyotish", "jyotish-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g jyotishGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.ChandraBalam) == 0 || len(g.Tarabala) == 0 {
		t.Fatal("golden is missing an arm")
	}
	return g
}

func TestChandraBalamMatchesTypeScript(t *testing.T) {
	g := loadJyotishGolden(t)
	houses := map[int]bool{}
	qualities := map[types.ChandraBalamQuality]bool{}
	for _, c := range g.ChandraBalam {
		got, err := ComputeChandraBalam(c.Janma, c.Transit, c.Lang)
		if err != nil {
			t.Fatalf("janma=%d transit=%d: %v", c.Janma, c.Transit, err)
		}
		if got != c.Info {
			t.Errorf("janma=%d transit=%d %s: got %+v, want %+v",
				c.Janma, c.Transit, c.Lang, got, c.Info)
		}
		houses[got.House] = true
		qualities[got.Quality] = true
	}
	if len(houses) != 12 {
		t.Errorf("only %d of 12 houses reached", len(houses))
	}
	if len(qualities) != 2 {
		t.Errorf("only %d of 2 qualities reached", len(qualities))
	}

	strong := map[int]bool{1: true, 3: true, 6: true, 7: true, 10: true, 11: true}
	for janma := 0; janma < 12; janma++ {
		for transit := 0; transit < 12; transit++ {
			got, err := ComputeChandraBalam(janma, transit, types.LanguageEn)
			if err != nil {
				t.Fatal(err)
			}
			want := types.ChandraBalamWeak
			if strong[got.House] {
				want = types.ChandraBalamStrong
			}
			if got.Quality != want {
				t.Errorf("house %d classified %q, want %q", got.House, got.Quality, want)
			}
			if (janma == transit) != (got.House == 1) {
				t.Errorf("janma=%d transit=%d gave house %d", janma, transit, got.House)
			}
		}
	}

	for _, bad := range [][2]int{{-1, 0}, {12, 0}, {0, -1}, {0, 12}} {
		if _, err := ComputeChandraBalam(bad[0], bad[1], types.LanguageEn); err == nil {
			t.Errorf("janma=%d transit=%d was accepted", bad[0], bad[1])
		}
	}
}

func TestTarabalaMatchesTypeScript(t *testing.T) {
	g := loadJyotishGolden(t)
	taras := map[int]bool{}
	qualities := map[types.TarabalaQuality]bool{}
	for _, c := range g.Tarabala {
		got, err := ComputeTarabala(c.Janma, c.Transit, c.Lang)
		if err != nil {
			t.Fatalf("janma=%d transit=%d: %v", c.Janma, c.Transit, err)
		}
		if got != c.Info {
			t.Errorf("janma=%d transit=%d %s: got %+v, want %+v",
				c.Janma, c.Transit, c.Lang, got, c.Info)
		}
		taras[got.TaraIndex] = true
		qualities[got.Quality] = true
	}
	if len(taras) != 9 {
		t.Errorf("only %d of 9 taras reached", len(taras))
	}
	if len(qualities) != 2 {
		t.Errorf("only %d of 2 qualities reached", len(qualities))
	}

	for janma := 0; janma < 27; janma++ {
		counts := map[int]int{}
		for transit := 0; transit < 27; transit++ {
			got, err := ComputeTarabala(janma, transit, types.LanguageEn)
			if err != nil {
				t.Fatal(err)
			}
			counts[got.TaraIndex]++
			wantQ := types.TarabalaAuspicious
			if got.TaraIndex == 2 || got.TaraIndex == 4 || got.TaraIndex == 6 {
				wantQ = types.TarabalaInauspicious
			}
			if got.Quality != wantQ {
				t.Errorf("tara %d classified %q, want %q", got.TaraIndex, got.Quality, wantQ)
			}
		}
		for tara := 0; tara < 9; tara++ {
			if counts[tara] != 3 {
				t.Errorf("janma=%d: tara %d occurs %d times across 27 nakshatras, want 3",
					janma, tara, counts[tara])
			}
		}
	}

	for n := 0; n < 27; n++ {
		got, err := ComputeTarabala(n, n, types.LanguageEn)
		if err != nil {
			t.Fatal(err)
		}
		if got.TaraIndex != 0 || got.EnglishName != "Janma" {
			t.Errorf("nakshatra %d to itself gave %+v, want tara 0 / Janma", n, got)
		}
	}

	for _, bad := range [][2]int{{-1, 0}, {27, 0}, {0, -1}, {0, 27}} {
		if _, err := ComputeTarabala(bad[0], bad[1], types.LanguageEn); err == nil {
			t.Errorf("janma=%d transit=%d was accepted", bad[0], bad[1])
		}
	}
}
