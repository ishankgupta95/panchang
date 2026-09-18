package core

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"math"
	"os"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

type elementsGolden struct {
	Meta            map[string]any   `json:"_meta"`
	Seed            uint32           `json:"seed"`
	Samples         int              `json:"samples"`
	SamplesShort    int              `json:"samplesShort"`
	Digest          string           `json:"digest"`
	DigestShort     string           `json:"digestShort"`
	BoundaryPairs   [][2]float64     `json:"boundaryPairs"`
	BoundaryDigest  string           `json:"boundaryDigest"`
	LeafNames       []string         `json:"leafNames"`
	SignedZeroPairs []signedZeroPair `json:"signedZeroPairs"`
	Cases           []elementCase    `json:"cases"`
	BoundaryCases   []elementCase    `json:"boundaryCases"`
	Resolvers       map[string]struct {
		Paksha            []string `json:"paksha"`
		Tithi             []string `json:"tithi"`
		Nakshatra         []string `json:"nakshatra"`
		Yoga              []string `json:"yoga"`
		Karana            []string `json:"karana"`
		KaranaType        []string `json:"karanaType"`
		Masa              []string `json:"masa"`
		ChandraMasa       []string `json:"chandraMasa"`
		ChandraMasaAdhika []string `json:"chandraMasaAdhika"`
	} `json:"resolvers"`
	Spans struct {
		TithiSpan         float64 `json:"TITHI_SPAN"`
		NakshatraSpan     float64 `json:"NAKSHATRA_SPAN"`
		NakshatraPadaSpan float64 `json:"NAKSHATRA_PADA_SPAN"`
		YogaSpan          float64 `json:"YOGA_SPAN"`
		KaranaSpan        float64 `json:"KARANA_SPAN"`
		RashiSpan         float64 `json:"RASHI_SPAN"`
	} `json:"spans"`
}

type signedZeroPair struct {
	Moon          float64   `json:"moon"`
	Sun           float64   `json:"sun"`
	Leaves        []float64 `json:"leaves"`
	NegZeroLeaves []string  `json:"negZeroLeaves"`
}

type elementCase struct {
	Moon      float64             `json:"moon"`
	Sun       float64             `json:"sun"`
	Tithi     types.TithiInfo     `json:"tithi"`
	Nakshatra types.NakshatraInfo `json:"nakshatra"`
	Yoga      types.YogaInfo      `json:"yoga"`
	Karana    types.KaranaInfo    `json:"karana"`
}

func loadElementsGolden(t *testing.T) elementsGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "core", "elements-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g elementsGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	return g
}

func uniform(seed uint32, count int, rng float64, yield func(float64)) {
	s := seed
	for i := 0; i < count; i++ {
		s = s*1664525 + 1013904223
		yield((float64(s)/4294967296*2 - 1) * rng)
	}
}

func elementPairs(seed uint32, count int, yield func(moon, sun float64)) {
	buf := make([]float64, 0, 2)
	uniform(seed, count*2, 180, func(v float64) {
		buf = append(buf, v+180)
		if len(buf) == 2 {
			yield(buf[0], buf[1])
			buf = buf[:0]
		}
	})
}

func elementLeaves(moon, sun float64) [15]float64 {
	tt := ComputeTithiFromLongitudes(moon, sun, "", "")
	nk := ComputeNakshatraFromLongitude(moon, "")
	y := ComputeYogaFromLongitudes(moon, sun, "")
	kr := ComputeKaranaFromLongitudes(moon, sun, "")
	typeIsFixed := 0.0
	if kr.Type == types.KaranaFixed {
		typeIsFixed = 1
	}
	return [15]float64{
		float64(tt.Index), float64(tt.Number), tt.CompletionPercentage,
		float64(nk.Index), float64(nk.Pada), nk.DegreesInNakshatra, nk.CompletionPercentage,
		float64(y.Index), y.CompletionPercentage,
		float64(kr.Index), kr.CompletionPercentage, typeIsFixed,
		float64(GetTithiIndexFromLons(moon, sun)),
		float64(GetYogaIndex(moon, sun)),
		float64(GetKaranaIndex(moon, sun)),
	}
}

func elementDigest(pairs func(yield func(moon, sun float64))) string {
	h := sha256.New()
	const block = 4096
	buf := make([]byte, block*8)
	n := 0
	pairs(func(moon, sun float64) {
		for _, v := range elementLeaves(moon, sun) {
			binary.LittleEndian.PutUint64(buf[n*8:], math.Float64bits(v))
			n++
			if n == block {
				h.Write(buf)
				n = 0
			}
		}
	})
	if n > 0 {
		h.Write(buf[:n*8])
	}
	return hex.EncodeToString(h.Sum(nil))
}

func TestElementsBitIdenticalToTypeScript(t *testing.T) {
	g := loadElementsGolden(t)

	samples, want := g.SamplesShort, g.DigestShort
	if os.Getenv("GEN_FULL") != "" {
		samples, want = g.Samples, g.Digest
	}
	got := elementDigest(func(yield func(moon, sun float64)) {
		elementPairs(g.Seed, samples, yield)
	})
	if got != want {
		t.Errorf("uniform sweep digest over %d pairs:\n got %s\nwant %s\n"+
			"The four element modules are pure arithmetic over the given longitudes, so this "+
			"is a transcription defect, not rounding. Bisect with the `cases` array.",
			samples, got, want)
	}

	if len(g.BoundaryPairs) == 0 {
		t.Fatal("golden carries no boundary pairs: the engineered arm is vacuous")
	}
	gotB := elementDigest(func(yield func(moon, sun float64)) {
		for _, p := range g.BoundaryPairs {
			yield(p[0], p[1])
		}
	})
	if gotB != g.BoundaryDigest {
		t.Errorf("boundary digest over %d engineered pairs:\n got %s\nwant %s\n"+
			"These sit on and one ULP either side of every span multiple; a mismatch here "+
			"and a match above means a floor or an FMA barrier, not the arithmetic generally.",
			len(g.BoundaryPairs), gotB, g.BoundaryDigest)
	}
}

func TestElementCasesMatchTypeScript(t *testing.T) {
	g := loadElementsGolden(t)
	if len(g.Cases) == 0 || len(g.BoundaryCases) == 0 {
		t.Fatal("golden carries no cases to bisect against")
	}
	for _, arm := range []struct {
		name  string
		cases []elementCase
	}{{"uniform", g.Cases}, {"boundary", g.BoundaryCases}} {
		for i, c := range arm.cases {
			gotT := ComputeTithiFromLongitudes(c.Moon, c.Sun, "", "")
			if gotT != c.Tithi {
				t.Errorf("%s[%d] moon=%v sun=%v tithi: got %+v want %+v", arm.name, i, c.Moon, c.Sun, gotT, c.Tithi)
			}
			gotN := ComputeNakshatraFromLongitude(c.Moon, "")
			if gotN != c.Nakshatra {
				t.Errorf("%s[%d] moon=%v nakshatra: got %+v want %+v", arm.name, i, c.Moon, gotN, c.Nakshatra)
			}
			gotY := ComputeYogaFromLongitudes(c.Moon, c.Sun, "")
			if gotY != c.Yoga {
				t.Errorf("%s[%d] moon=%v sun=%v yoga: got %+v want %+v", arm.name, i, c.Moon, c.Sun, gotY, c.Yoga)
			}
			gotK := ComputeKaranaFromLongitudes(c.Moon, c.Sun, "")
			if gotK != c.Karana {
				t.Errorf("%s[%d] moon=%v sun=%v karana: got %+v want %+v", arm.name, i, c.Moon, c.Sun, gotK, c.Karana)
			}
		}
	}
}

func TestElementSweepIsNotVacuous(t *testing.T) {
	g := loadElementsGolden(t)
	samples := g.SamplesShort
	if os.Getenv("GEN_FULL") != "" {
		samples = g.Samples
	}

	var tithi [30]int
	var nak [27]int
	var pada [5]int
	var yoga [27]int
	var karana [60]int
	fixed, movable := 0, 0
	elementPairs(g.Seed, samples, func(moon, sun float64) {
		tithi[ComputeTithiFromLongitudes(moon, sun, "", "").Index]++
		nk := ComputeNakshatraFromLongitude(moon, "")
		nak[nk.Index]++
		pada[nk.Pada]++
		yoga[ComputeYogaFromLongitudes(moon, sun, "").Index]++
		kr := ComputeKaranaFromLongitudes(moon, sun, "")
		karana[kr.Index]++
		if kr.Type == types.KaranaFixed {
			fixed++
		} else {
			movable++
		}
	})

	for i, n := range tithi {
		if n == 0 {
			t.Errorf("tithi index %d never reached in %d pairs", i, samples)
		}
	}
	for i, n := range nak {
		if n == 0 {
			t.Errorf("nakshatra index %d never reached in %d pairs", i, samples)
		}
	}
	for p := 1; p <= 4; p++ {
		if pada[p] == 0 {
			t.Errorf("pada %d never reached in %d pairs", p, samples)
		}
	}
	if pada[0] != 0 {
		t.Errorf("pada 0 produced %d times; padas are 1-based", pada[0])
	}
	for i, n := range yoga {
		if n == 0 {
			t.Errorf("yoga index %d never reached in %d pairs", i, samples)
		}
	}
	for i, n := range karana {
		if n == 0 {
			t.Errorf("karana index %d never reached in %d pairs", i, samples)
		}
	}
	if fixed == 0 || movable == 0 {
		t.Errorf("karana type split is vacuous: fixed=%d movable=%d", fixed, movable)
	}
}

func TestSpansMatchTypeScript(t *testing.T) {
	g := loadElementsGolden(t)
	for _, c := range []struct {
		name      string
		got, want float64
	}{
		{"TITHI_SPAN", utils.TithiSpan, g.Spans.TithiSpan},
		{"NAKSHATRA_SPAN", utils.NakshatraSpan, g.Spans.NakshatraSpan},
		{"NAKSHATRA_PADA_SPAN", utils.NakshatraPadaSpan, g.Spans.NakshatraPadaSpan},
		{"YOGA_SPAN", utils.YogaSpan, g.Spans.YogaSpan},
		{"KARANA_SPAN", utils.KaranaSpan, g.Spans.KaranaSpan},
		{"RASHI_SPAN", utils.RashiSpan, g.Spans.RashiSpan},
	} {
		if math.Float64bits(c.got) != math.Float64bits(c.want) {
			t.Errorf("%s: got %v (%#016x) want %v (%#016x)",
				c.name, c.got, math.Float64bits(c.got), c.want, math.Float64bits(c.want))
		}
	}
}

func TestResolversMatchTypeScript(t *testing.T) {
	g := loadElementsGolden(t)
	for _, lang := range []types.Language{types.LanguageEn, types.LanguageHi} {
		want, ok := g.Resolvers[string(lang)]
		if !ok {
			t.Fatalf("golden has no resolver table for %q", lang)
		}
		check := func(name string, want []string, got func(i int) string) {
			t.Helper()
			if len(want) == 0 {
				t.Errorf("%s/%s: golden table is empty", lang, name)
				return
			}
			for i, w := range want {
				if g := got(i); g != w {
					t.Errorf("%s/%s[%d]: got %q want %q", lang, name, i, g, w)
				}
			}
		}
		check("paksha", want.Paksha, func(i int) string { return i18n.ResolvePakshaName(i, lang) })
		check("tithi", want.Tithi, func(i int) string { return i18n.ResolveTithiName(i, lang) })
		check("nakshatra", want.Nakshatra, func(i int) string { return i18n.ResolveNakshatraName(i, lang) })
		check("yoga", want.Yoga, func(i int) string { return i18n.ResolveYogaName(i, lang) })
		check("karana", want.Karana, func(i int) string { return i18n.ResolveKaranaName(i, lang) })
		check("karanaType", want.KaranaType, func(i int) string { return string(GetKaranaType(i)) })
		check("masa", want.Masa, func(i int) string { return i18n.ResolveMasaName(i, lang) })
		check("chandraMasa", want.ChandraMasa, func(i int) string {
			return i18n.ResolveChandraMasaName(i, lang, false)
		})
		check("chandraMasaAdhika", want.ChandraMasaAdhika, func(i int) string {
			return i18n.ResolveChandraMasaName(i, lang, true)
		})
	}

	fallback, ok := g.Resolvers["unknown-language-falls-back"]
	if !ok || len(fallback.Tithi) == 0 {
		t.Fatal("golden has no unknown-language fallback table")
	}
	for i, w := range fallback.Tithi {
		if got := i18n.ResolveTithiName(i, types.Language("xx")); got != w {
			t.Errorf("unknown-language tithi[%d]: got %q want %q", i, got, w)
		}
	}
	if fallback.Tithi[0] != g.Resolvers["en"].Tithi[0] {
		t.Errorf("unknown-language fallback is not English: %q vs %q",
			fallback.Tithi[0], g.Resolvers["en"].Tithi[0])
	}
	if g.Resolvers["en"].Tithi[0] == g.Resolvers["hi"].Tithi[0] {
		t.Error("en and hi tithi[0] are identical: the two-language check is vacuous")
	}
}

func TestSignedZeroDivergenceIsExactlyOneMechanism(t *testing.T) {
	g := loadElementsGolden(t)
	if len(g.SignedZeroPairs) == 0 {
		t.Fatal("golden holds no signed-zero pairs: either the generator's partition " +
			"stopped detecting them or the boundary set lost its negative subnormal, and " +
			"in both cases this pin is vacuous")
	}
	if len(g.LeafNames) != 15 {
		t.Fatalf("golden leafNames has %d entries, want 15", len(g.LeafNames))
	}

	wantGoNegZero := map[string]bool{
		"n.index": false,
	}

	for pi, p := range g.SignedZeroPairs {
		tsNegZero := make(map[string]bool, len(p.NegZeroLeaves))
		for _, n := range p.NegZeroLeaves {
			tsNegZero[n] = true
		}
		if len(tsNegZero) != len(wantGoNegZero) {
			t.Errorf("pair %d (moon=%v sun=%v): TypeScript has −0 at %v, but this test only "+
				"accounts for %d leaves. A new one is a new mechanism: derive it before "+
				"adding it here.", pi, p.Moon, p.Sun, p.NegZeroLeaves, len(wantGoNegZero))
		}
		for name := range wantGoNegZero {
			if !tsNegZero[name] {
				t.Errorf("pair %d: expected TypeScript −0 at %s, golden says %v",
					pi, name, p.NegZeroLeaves)
			}
		}

		got := elementLeaves(p.Moon, p.Sun)
		if len(p.Leaves) != len(got) {
			t.Fatalf("pair %d: golden has %d leaves, Go produces %d", pi, len(p.Leaves), len(got))
		}
		for i, name := range g.LeafNames {
			if got[i] != p.Leaves[i] {
				t.Errorf("pair %d leaf %s: got %v want %v", pi, name, got[i], p.Leaves[i])
			}
			goNegZero := got[i] == 0 && math.Signbit(got[i])
			if tsNegZero[name] {
				if goNegZero != wantGoNegZero[name] {
					t.Errorf("pair %d leaf %s: Go negative-zero = %v, predicted %v",
						pi, name, goNegZero, wantGoNegZero[name])
				}
				continue
			}
			if goNegZero {
				t.Errorf("pair %d leaf %s: Go produced −0 where TypeScript has +0. "+
					"encoding/json writes that as \"-0\" and JSON.stringify writes \"0\", "+
					"so this is a wire divergence a numeric band cannot catch.", pi, name)
			}
		}
	}
}

func TestGoJSONWritesNegativeZero(t *testing.T) {
	b, err := json.Marshal(struct {
		V float64 `json:"v"`
	}{math.Copysign(0, -1)})
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != `{"v":-0}` {
		t.Errorf("encoding/json now writes %s for negative zero. JavaScript's "+
			"JSON.stringify writes {\"v\":0}. If this is now {\"v\":0} too, the signed-zero "+
			"hazard is gone and TestSignedZeroDivergenceIsExactlyOneMechanism's "+
			"reasoning about the wire should be revisited.", b)
	}
}

func TestNoNegativeZeroFromNormalizedLongitudes(t *testing.T) {
	g := loadElementsGolden(t)
	if len(g.LeafNames) != 15 {
		t.Fatalf("golden leafNames has %d entries, want 15", len(g.LeafNames))
	}

	var lons []float64
	for _, span := range []float64{utils.TithiSpan, utils.KaranaSpan, utils.NakshatraSpan, utils.NakshatraPadaSpan} {
		for k := 0.0; k*span < 360; k++ {
			x := k * span
			lons = append(lons, x, math.Nextafter(x, 0), math.Nextafter(x, 360))
		}
	}
	lons = append(lons, 0, math.Nextafter(360, 0))
	uniform(0x1CE, 4000, 180, func(v float64) { lons = append(lons, v+180) })

	checked, sunZero := 0, 0
	for _, stride := range []int{0, 1, 7, 337, 1723} {
		for i, moon := range lons {
			m := utils.Normalize360(moon)
			s := utils.Normalize360(lons[(i+stride)%len(lons)])
			if s == 0 {
				sunZero++
			}
			for j, v := range elementLeaves(m, s) {
				checked++
				if v == 0 && math.Signbit(v) {
					t.Fatalf("leaf %s is −0 for normalized moon=%v sun=%v: the reachability "+
						"argument in TestSignedZeroDivergenceIsExactlyOneMechanism is wrong, "+
						"and encoding/json will write \"-0\" where JavaScript writes \"0\"",
						g.LeafNames[j], m, s)
				}
			}
		}
	}
	if checked < 100_000 {
		t.Fatalf("only %d leaves checked: the sweep is vacuous", checked)
	}
	if sunZero == 0 {
		t.Fatal("no pair had sun == 0: the exact-zero elongation path was never reached")
	}
	t.Logf("checked %d leaves over %d normalized longitudes x 5 strides, no negative zero",
		checked, len(lons))
}
