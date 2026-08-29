// Package rules holds the stock muhurta rules. Sources: Muhurta-chintamani Chs. 4, 9, 16; Muhurta-darpana; BPHS Ch. 28; Charak, *Predictive Astrology* Ch. 23.
package rules

import "github.com/ishankgupta95/panchang-ts/source/go/v5/internal/muhurta"

func bothPakshas(numbers ...int) []int {
	out := make([]int, 0, len(numbers)*2)
	for _, n := range numbers {
		out = append(out, n-1, n+14)
	}
	for i := 1; i < len(out); i++ {
		v := out[i]
		j := i - 1
		for j >= 0 && out[j] > v {
			out[j+1] = out[j]
			j--
		}
		out[j+1] = v
	}
	return out
}

// Order preserved: these lists reach the wire as built.
func concat(lists ...[]int) []int {
	n := 0
	for _, l := range lists {
		n += len(l)
	}
	out := make([]int, 0, n)
	for _, l := range lists {
		out = append(out, l...)
	}
	return out
}

const Purnima = 14

const Amavasya = 29

var rikta = bothPakshas(4, 9, 14)

var ashtami = bothPakshas(8)

const (
	nAshwini          = 0
	nBharani          = 1
	nKrittika         = 2
	nRohini           = 3
	nMrigashira       = 4
	nArdra            = 5
	nPunarvasu        = 6
	nPushya           = 7
	nAshlesha         = 8
	nMagha            = 9
	nPurvaPhalguni    = 10
	nUttaraPhalguni   = 11
	nHasta            = 12
	nChitra           = 13
	nSwati            = 14
	nVishakha         = 15
	nAnuradha         = 16
	nJyeshtha         = 17
	nMula             = 18
	nPurvaAshadha     = 19
	nUttaraAshadha    = 20
	nShravana         = 21
	nDhanishtha       = 22
	nShatabhisha      = 23
	nPurvaBhadrapada  = 24
	nUttaraBhadrapada = 25
	nRevati           = 26
)

var penalize = func() *muhurta.BhadraMode { m := muhurta.BhadraPenalize; return &m }()

// No ExcludeGandaMula: Magha, Mula and Revati are Ganda Mula yet classical vivah nakshatras.
var VivahRule = muhurta.MuhurtaRule{
	Occasion:           "vivah",
	Name:               "Vivah (wedding)",
	AuspiciousTithis:   bothPakshas(2, 3, 5, 7, 11, 13),
	InauspiciousTithis: concat(rikta, ashtami, []int{Purnima, Amavasya}),
	AuspiciousNakshatras: []int{
		nRohini, nMrigashira, nMagha, nUttaraPhalguni, nHasta, nSwati,
		nAnuradha, nMula, nUttaraAshadha, nUttaraBhadrapada, nRevati,
	},
	InauspiciousNakshatras: []int{nBharani, nKrittika, nAshlesha, nVishakha, nJyeshtha},
	AuspiciousVaras:        []int{1, 3, 4, 5},
	InauspiciousVaras:      []int{0, 2, 6},
	Bhadra:                 penalize,
	// No ExcludeEkadashi: Ekadashi is one of the six preferred vivah tithis.
	ExcludeAdhikaMasa: true,
	ExcludeEclipse:    true,
}

// No ExcludeEkadashi: Dashami and Ekadashi are staple griha-pravesh tithis.
var GrihaPraveshRule = muhurta.MuhurtaRule{
	Occasion:           "grihaPravesh",
	Name:               "Griha Pravesh (housewarming)",
	AuspiciousTithis:   bothPakshas(2, 3, 5, 7, 10, 11, 13),
	InauspiciousTithis: concat(rikta, []int{Purnima, Amavasya}),
	AuspiciousNakshatras: []int{
		nRohini, nMrigashira, nUttaraPhalguni, nChitra, nAnuradha,
		nUttaraAshadha, nUttaraBhadrapada, nRevati,
	},
	AuspiciousVaras:   []int{1, 3, 4, 5, 6},
	InauspiciousVaras: []int{0, 2},
	Bhadra:            penalize,
	ExcludeAdhikaMasa: true,
	ExcludeEclipse:    true,
}

var NamakaranaRule = muhurta.MuhurtaRule{
	Occasion:           "namakarana",
	Name:               "Namakarana (naming ceremony)",
	AuspiciousTithis:   bothPakshas(1, 2, 5, 6, 7, 10, 11, 13),
	InauspiciousTithis: concat(rikta, ashtami, []int{Purnima, Amavasya}),
	AuspiciousNakshatras: []int{
		nAshwini, nRohini, nMrigashira, nPunarvasu, nPushya,
		nUttaraPhalguni, nHasta, nChitra, nAnuradha, nUttaraAshadha,
		nShravana, nUttaraBhadrapada, nRevati,
	},
	AuspiciousVaras: []int{1, 3, 4, 5},
	Bhadra:          penalize,
}

var VidyarambhRule = muhurta.MuhurtaRule{
	Occasion:           "vidyarambh",
	Name:               "Vidyarambh (commencement of education)",
	AuspiciousTithis:   bothPakshas(1, 2, 3, 5, 6, 7, 10, 11, 12, 13),
	InauspiciousTithis: concat(rikta, ashtami, []int{Purnima, Amavasya}),
	AuspiciousNakshatras: []int{
		nRohini, nPunarvasu, nPushya, nUttaraPhalguni, nHasta, nSwati,
		nAnuradha, nUttaraAshadha, nShravana, nUttaraBhadrapada, nRevati,
	},
	AuspiciousVaras:   []int{1, 3, 4, 5},
	InauspiciousVaras: []int{0, 2, 6},
	Bhadra:            penalize,
}

var VahanKharidiRule = muhurta.MuhurtaRule{
	Occasion:           "vahanKharidi",
	Name:               "Vahan Kharidi (vehicle purchase)",
	AuspiciousTithis:   concat(bothPakshas(1, 3, 5, 6, 8, 10, 11, 13), []int{Purnima}),
	InauspiciousTithis: concat(rikta, []int{Amavasya}),
	AuspiciousNakshatras: []int{
		nRohini, nMrigashira, nPunarvasu, nPushya, nAnuradha, nHasta,
		nChitra, nSwati, nShravana, nDhanishtha, nShatabhisha, nRevati,
	},
	AuspiciousVaras:   []int{0, 1, 3, 4, 5},
	InauspiciousVaras: []int{2, 6},
	Bhadra:            penalize,
}

var AnnaprashanRule = muhurta.MuhurtaRule{
	Occasion:           "annaprashan",
	Name:               "Annaprashan (first solid food)",
	AuspiciousTithis:   bothPakshas(2, 3, 5, 6, 7, 10, 11, 12, 13),
	InauspiciousTithis: concat(rikta, ashtami, []int{Purnima, Amavasya}),
	AuspiciousNakshatras: []int{
		nRohini, nPunarvasu, nPushya, nUttaraPhalguni, nHasta, nSwati,
		nAnuradha, nUttaraAshadha, nShravana, nUttaraBhadrapada, nRevati,
	},
	AuspiciousVaras: []int{1, 3, 4, 5},
	Bhadra:          penalize,
}

// No ExcludeGandaMula: several classical Chudakarana nakshatras are Ganda Mula.
var MundanRule = muhurta.MuhurtaRule{
	Occasion:           "mundan",
	Name:               "Mundan (first hair-cutting)",
	AuspiciousTithis:   bothPakshas(2, 3, 5, 6, 7, 10, 11, 12, 13),
	InauspiciousTithis: concat(rikta, ashtami, []int{Purnima, Amavasya}),
	AuspiciousNakshatras: []int{
		nAshwini, nMrigashira, nPunarvasu, nPushya, nHasta, nChitra,
		nSwati, nJyeshtha, nShravana, nDhanishtha, nShatabhisha, nRevati,
	},
	AuspiciousVaras:   []int{1, 3, 4, 5},
	InauspiciousVaras: []int{2, 6},
	Bhadra:            penalize,
}

var UpanayanamRule = muhurta.MuhurtaRule{
	Occasion:           "upanayanam",
	Name:               "Upanayanam (sacred thread ceremony)",
	AuspiciousTithis:   bothPakshas(2, 3, 5, 6, 7, 10, 12, 13),
	InauspiciousTithis: concat(rikta, ashtami, []int{Purnima, Amavasya}),
	AuspiciousNakshatras: []int{
		nRohini, nMrigashira, nPushya, nUttaraPhalguni, nHasta, nAnuradha,
		nUttaraAshadha, nShravana, nUttaraBhadrapada, nRevati,
	},
	AuspiciousVaras: []int{1, 3, 4, 5},
	Bhadra:          penalize,
	ExcludeEkadashi: true,
}

var KarnavedhaRule = muhurta.MuhurtaRule{
	Occasion:           "karnavedha",
	Name:               "Karnavedha (ear piercing)",
	AuspiciousTithis:   bothPakshas(2, 6, 7, 10, 11, 12, 13),
	InauspiciousTithis: concat(rikta, []int{Amavasya}),
	AuspiciousNakshatras: []int{
		nMrigashira, nPushya, nUttaraPhalguni, nHasta, nAnuradha,
		nUttaraAshadha, nShravana, nRevati,
	},
	AuspiciousVaras: []int{1, 3, 4, 5},
	Bhadra:          penalize,
}

var AksharabhyasamRule = muhurta.MuhurtaRule{
	Occasion:           "aksharabhyasam",
	Name:               "Aksharabhyasam (introduction to letters)",
	AuspiciousTithis:   bothPakshas(5, 6, 10, 11, 12, 13),
	InauspiciousTithis: concat(rikta, []int{Amavasya}),
	AuspiciousNakshatras: []int{
		nRohini, nPunarvasu, nPushya, nUttaraPhalguni, nHasta, nSwati,
		nAnuradha, nUttaraAshadha, nShravana, nUttaraBhadrapada, nRevati,
	},
	AuspiciousVaras: []int{1, 3, 4, 5},
	Bhadra:          penalize,
}

var SeemanthamRule = muhurta.MuhurtaRule{
	Occasion:           "seemantham",
	Name:               "Seemantham (Vedic baby shower)",
	AuspiciousTithis:   bothPakshas(2, 3, 5, 6, 7, 10, 12, 13),
	InauspiciousTithis: concat(rikta, ashtami, []int{Purnima, Amavasya}),
	AuspiciousNakshatras: []int{
		nRohini, nMrigashira, nPunarvasu, nUttaraPhalguni, nHasta, nSwati,
		nAnuradha, nUttaraAshadha, nShravana, nUttaraBhadrapada,
	},
	AuspiciousVaras:  []int{1, 3, 4, 5},
	Bhadra:           penalize,
	ExcludeEkadashi:  true,
	ExcludeGandaMula: true,
}

var ShopOpeningRule = muhurta.MuhurtaRule{
	Occasion:           "shopOpening",
	Name:               "Shop / business opening",
	AuspiciousTithis:   bothPakshas(1, 2, 5, 6, 10, 11, 13),
	InauspiciousTithis: concat(rikta, []int{Amavasya}),
	AuspiciousNakshatras: []int{
		nRohini, nPunarvasu, nPushya, nUttaraPhalguni, nHasta, nAnuradha,
		nUttaraAshadha, nShravana, nUttaraBhadrapada, nRevati,
	},
	AuspiciousVaras:   []int{1, 3, 4, 5},
	InauspiciousVaras: []int{0, 2, 6},
	Bhadra:            penalize,
	ExcludeAdhikaMasa: true,
}

var TravelStartRule = muhurta.MuhurtaRule{
	Occasion:           "travelStart",
	Name:               "Travel start (Yatra)",
	AuspiciousTithis:   bothPakshas(2, 3, 5, 6, 7, 10, 12, 13),
	InauspiciousTithis: concat(rikta, ashtami, []int{Purnima, Amavasya}),
	AuspiciousNakshatras: []int{
		nRohini, nPunarvasu, nPushya, nUttaraPhalguni, nHasta, nAnuradha,
		nUttaraAshadha, nShravana, nUttaraBhadrapada, nRevati,
	},
	InauspiciousVaras: []int{2, 6},
	Bhadra:            penalize,
	ExcludeEkadashi:   true,
}

var order = []string{
	"vivah", "grihaPravesh", "namakarana", "vidyarambh", "vahanKharidi",
	"annaprashan", "mundan", "upanayanam", "karnavedha", "aksharabhyasam",
	"seemantham", "shopOpening", "travelStart",
}

var stock = map[string]muhurta.MuhurtaRule{
	"vivah":          VivahRule,
	"grihaPravesh":   GrihaPraveshRule,
	"namakarana":     NamakaranaRule,
	"vidyarambh":     VidyarambhRule,
	"vahanKharidi":   VahanKharidiRule,
	"annaprashan":    AnnaprashanRule,
	"mundan":         MundanRule,
	"upanayanam":     UpanayanamRule,
	"karnavedha":     KarnavedhaRule,
	"aksharabhyasam": AksharabhyasamRule,
	"seemantham":     SeemanthamRule,
	"shopOpening":    ShopOpeningRule,
	"travelStart":    TravelStartRule,
}

func Order() []string {
	out := make([]string, len(order))
	copy(out, order)
	return out
}

// Slice fields share backing arrays; treat the result read-only.
func Get(occasion string) (muhurta.MuhurtaRule, bool) {
	r, ok := stock[occasion]
	return r, ok
}

func All() []muhurta.MuhurtaRule {
	out := make([]muhurta.MuhurtaRule, 0, len(order))
	for _, id := range order {
		out = append(out, stock[id])
	}
	return out
}
