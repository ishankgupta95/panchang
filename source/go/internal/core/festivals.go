package core

import (
	"strconv"
	"strings"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

func intp(v int) *int { return &v }

type FestivalDateRule string

const (
	RuleSunrise            FestivalDateRule = "sunrise"
	RuleMadhyahna          FestivalDateRule = "madhyahna"
	RuleAparahna           FestivalDateRule = "aparahna"
	RuleAparahnaFull       FestivalDateRule = "aparahna-full"
	RulePradosha           FestivalDateRule = "pradosha"
	RuleNishita            FestivalDateRule = "nishita"
	RuleJanmashtamiNishita FestivalDateRule = "janmashtami-nishita"
	RuleChandrodaya        FestivalDateRule = "chandrodaya"
)

type AdhikaBehaviour string

const (
	AdhikaSkip          AdhikaBehaviour = "skip"
	AdhikaShiftToNija   AdhikaBehaviour = "shift-to-nija"
	AdhikaObserveInBoth AdhikaBehaviour = "observe-in-both"
)

type NamingSystem string

const (
	NamingAmanta     NamingSystem = "amanta"
	NamingPurnimanta NamingSystem = "purnimanta"
)

type FestivalRuleKind uint8

const (
	KindSolarNakshatra FestivalRuleKind = iota + 1
	KindMasaNakshatra
	KindMasaVara
	KindMasaTithi
)

type FestivalRule struct {
	Key  string
	Kind FestivalRuleKind
	Type types.FestivalType

	Masa      int
	Tithi     int
	SolarMasa int
	Nakshatra int
	Vara      int

	DateRule          FestivalDateRule
	BhadraExclude     bool
	AdhikaBehaviour   AdhikaBehaviour
	NamingSystem      NamingSystem
	Regions           []types.FestivalRegion
	TithiRange        *[2]int
	KshayaRule        KshayaRule
	Paksha            Paksha
	KalaPrefers       KalaPreference
	NakshatraDateRule FestivalDateRule
	FallbackNakshatra *int
}

type KalaPreference string

const (
	KalaFirst KalaPreference = ""
	KalaLast  KalaPreference = "last"
)

type Paksha string

const (
	PakshaAny     Paksha = ""
	PakshaShukla  Paksha = "shukla"
	PakshaKrishna Paksha = "krishna"
)

type KshayaRule string

const (
	KshayaContain KshayaRule = ""
	KshayaExclude KshayaRule = "exclude"
)

type sankrantiRegionalRule struct {
	Key     string
	Regions []types.FestivalRegion
	Type    types.FestivalType
}

var sankrantiRegional = map[int][]sankrantiRegionalRule{
	0: {
		{Key: "puthandu", Regions: []types.FestivalRegion{"tamil-nadu"}, Type: types.FestivalMajor},
		{Key: "bohag_bihu", Regions: []types.FestivalRegion{"assam"}, Type: types.FestivalMajor},
	},
	3: {
		{Key: "dakshinayana", Regions: []types.FestivalRegion{"all"}, Type: types.FestivalMinor},
		{Key: "raja_sankranti", Regions: []types.FestivalRegion{"odisha"}, Type: types.FestivalMajor},
		{Key: "harela", Regions: []types.FestivalRegion{"uttarakhand"}, Type: types.FestivalMajor},
	},
	4: {
		{Key: "singh_sankranti", Regions: []types.FestivalRegion{"odisha", "bihar", "jharkhand", "nepal"}, Type: types.FestivalMinor},
	},
	5: {
		{Key: "sair", Regions: []types.FestivalRegion{"himachal-pradesh"}, Type: types.FestivalMinor},
	},
	6: {
		{Key: "kati_bihu", Regions: []types.FestivalRegion{"assam"}, Type: types.FestivalMinor},
	},
	9: {
		{Key: "makar_sankranti", Regions: []types.FestivalRegion{"all"}, Type: types.FestivalMajor},
		{Key: "pongal", Regions: []types.FestivalRegion{"tamil-nadu"}, Type: types.FestivalMajor},
		{Key: "uttarayan", Regions: []types.FestivalRegion{"gujarat"}, Type: types.FestivalMajor},
		{Key: "magh_bihu", Regions: []types.FestivalRegion{"assam"}, Type: types.FestivalMajor},
		{Key: "ayyappa_makara_jyothi", Regions: []types.FestivalRegion{"kerala"}, Type: types.FestivalMajor},
	},
}

var ekadashiNames = [12][2]string{
	{"kamada", "papamochani"},
	{"mohini", "varuthini"},
	{"nirjala", "apara"},
	{"devshayani", "yogini"},
	{"putrada", "kamika"},
	{"parivartini", "aja"},
	{"pashankusha", "indira"},
	{"prabodhini", "rama"},
	{"mokshada", "utpanna"},
	{"pausha_putrada", "saphala"},
	{"jaya", "shattila"},
	{"amalaki", "vijaya"},
}

var adhikaEkadashiNames = [2]string{"padmini", "parama"}

var pradoshaNames = [7]string{
	"ravi_pradosha",
	"som_pradosha",
	"bhauma_pradosha",
	"saumya_pradosha",
	"guru_pradosha",
	"bhrigu_pradosha",
	"shani_pradosha",
}

var lohriRegions = []types.FestivalRegion{"punjab", "haryana", "himachal-pradesh"}
var rajaRegions = []types.FestivalRegion{"odisha"}

var festivalRegistry = []FestivalRule{
	{Key: "ugadi", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 0, Tithi: 0},
	{Key: "rama_navami", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 0, Tithi: 8, DateRule: RuleMadhyahna, AdhikaBehaviour: AdhikaShiftToNija},
	{Key: "hanuman_jayanti", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 0, Tithi: 14},
	{Key: "akshaya_tritiya", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 1, Tithi: 2, DateRule: RuleMadhyahna},
	{Key: "parashurama_jayanti", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 1, Tithi: 2, DateRule: RuleMadhyahna},
	{Key: "guru_purnima", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 3, Tithi: 14},
	{Key: "nag_panchami", Kind: KindMasaTithi, Type: types.FestivalMinor, Masa: 4, Tithi: 4},
	{Key: "raksha_bandhan", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 4, Tithi: 14, BhadraExclude: true},
	{Key: "krishna_janmashtami", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 4, Tithi: 22, DateRule: RuleJanmashtamiNishita, AdhikaBehaviour: AdhikaShiftToNija},
	{Key: "ganesh_chaturthi", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 5, Tithi: 3, DateRule: RuleMadhyahna},
	{Key: "anant_chaturdashi", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 5, Tithi: 13},
	{Key: "navaratri", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 0},
	{Key: "durga_ashtami", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 7},
	{Key: "maha_navami", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 8},
	{Key: "dussehra", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 9, DateRule: RuleAparahnaFull},
	{Key: "sharad_purnima", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 14},
	{Key: "karva_chauth", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 18, DateRule: RuleChandrodaya, NamingSystem: NamingPurnimanta},
	{Key: "dhanteras", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 27, DateRule: RulePradosha, NamingSystem: NamingPurnimanta},
	{Key: "narak_chaturdashi", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 28, NamingSystem: NamingPurnimanta, KshayaRule: KshayaExclude},
	{Key: "diwali", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 29, DateRule: RulePradosha, NamingSystem: NamingPurnimanta},
	{Key: "kartika_purnima", Kind: KindMasaTithi, Type: types.FestivalMinor, Masa: 7, Tithi: 14},
	{Key: "vasant_panchami", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 10, Tithi: 4, DateRule: RuleMadhyahna},
	{Key: "maha_shivaratri", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 10, Tithi: 28, DateRule: RuleNishita},
	{Key: "holi", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 11, Tithi: 14, KshayaRule: KshayaExclude},
	{Key: "mahalaya_amavasya", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 5, Tithi: 29},
	{Key: "chhath_nahay_khay", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 7, Tithi: 3},
	{Key: "chhath_kharna", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 7, Tithi: 4},
	{Key: "chhath_sandhya_arghya", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 7, Tithi: 5, DateRule: RulePradosha},
	{Key: "chhath_usha_arghya", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 7, Tithi: 6, KshayaRule: KshayaExclude},
	{Key: "vat_savitri_amavasya", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 1, Tithi: 29,
		DateRule: RuleAparahna, KalaPrefers: KalaLast},
	{Key: "vat_savitri_purnima", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 2, Tithi: 14},
	{Key: "yajur_upakarma", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 4, Tithi: 14},
	{Key: "shravan_somvar", Kind: KindMasaVara, Type: types.FestivalMinor, Masa: 4, Vara: 1, AdhikaBehaviour: AdhikaObserveInBoth},
	{Key: "mangala_gauri", Kind: KindMasaVara, Type: types.FestivalMinor, Masa: 4, Vara: 2, AdhikaBehaviour: AdhikaObserveInBoth},
	{Key: "kartik_somvar", Kind: KindMasaVara, Type: types.FestivalMinor, Masa: 7, Vara: 1, AdhikaBehaviour: AdhikaObserveInBoth},
	{Key: "magha_shanivar", Kind: KindMasaVara, Type: types.FestivalMinor, Masa: 10, Vara: 6, AdhikaBehaviour: AdhikaObserveInBoth},
	{Key: "onam", Kind: KindSolarNakshatra, Type: types.FestivalMajor, SolarMasa: 4, Nakshatra: 21},
	{Key: "rig_upakarma", Kind: KindMasaNakshatra, Type: types.FestivalMajor, Masa: 4, Nakshatra: 21,
		Paksha: PakshaShukla, FallbackNakshatra: intp(12)},
	{Key: "sama_upakarma", Kind: KindMasaNakshatra, Type: types.FestivalMajor, Masa: 5, Nakshatra: 12,
		Paksha: PakshaShukla, NakshatraDateRule: RuleAparahna},
	{Key: "gudi_padwa", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 0, Tithi: 0, Regions: []types.FestivalRegion{"maharashtra", "goa"}},
	{Key: "gangaur", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 0, Tithi: 2, Regions: []types.FestivalRegion{"rajasthan"}},
	{Key: "karaga", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 0, Tithi: 14, Regions: []types.FestivalRegion{"karnataka"}},
	{Key: "bonalu", Kind: KindMasaVara, Type: types.FestivalMinor, Masa: 3, Vara: 0, AdhikaBehaviour: AdhikaObserveInBoth, Regions: []types.FestivalRegion{"telangana"}},
	{Key: "hariyali_teej", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 4, Tithi: 2, Regions: []types.FestivalRegion{"rajasthan", "uttar-pradesh", "bihar", "haryana", "madhya-pradesh"}},
	{Key: "kajari_teej", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 4, Tithi: 17, Regions: []types.FestivalRegion{"rajasthan", "uttar-pradesh", "madhya-pradesh"}},
	{Key: "hartalika_teej", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 5, Tithi: 2, Regions: []types.FestivalRegion{"rajasthan", "uttar-pradesh", "bihar", "maharashtra", "madhya-pradesh"}},
	{Key: "govardhan_puja", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 7, Tithi: 0, Regions: []types.FestivalRegion{"uttar-pradesh", "bihar", "haryana", "rajasthan", "gujarat", "madhya-pradesh", "punjab", "jharkhand"}},
	{Key: "bhai_dooj", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 7, Tithi: 1, Regions: []types.FestivalRegion{"uttar-pradesh", "bihar", "haryana", "maharashtra", "gujarat", "rajasthan", "madhya-pradesh", "west-bengal", "jharkhand", "nepal"}},
	{Key: "phagli", Kind: KindMasaTithi, Type: types.FestivalMinor, Masa: 11, Tithi: 14, Regions: []types.FestivalRegion{"himachal-pradesh"}, KshayaRule: KshayaExclude},
	{Key: "jagannath_rath_yatra", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 3, Tithi: 1},
	{Key: "varamahalakshmi", Kind: KindMasaVara, Type: types.FestivalMajor, Masa: 4, Vara: 5, Regions: []types.FestivalRegion{"karnataka", "andhra-pradesh", "telangana", "tamil-nadu"}, TithiRange: &[2]int{7, 13}},
	{Key: "bathukamma_start", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 5, Tithi: 29, Regions: []types.FestivalRegion{"telangana"}},
	{Key: "bathukamma_saddula", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 8, Regions: []types.FestivalRegion{"telangana"}},
}

type FestivalComputeContext struct {
	TithiIndex                       int
	NakshatraIndex                   int
	NakshatraIndicesInDay            map[int]bool
	NakshatraByRule                  map[FestivalDateRule]int
	NakshatraByRuleStart             map[FestivalDateRule]int
	PriorDayNakshatraIndex           int
	HasPriorDayNakshatraIndex        bool
	RemainingPakshaSunriseNakshatras func() map[int]bool
	NextDayNakshatraByRule           func() (start, end map[FestivalDateRule]int)
	NextDayTithiByRule               func() (start, end map[FestivalDateRule]int)
	KshayaTithiIndices               map[int]bool
	NextDayMasaIndex                 int
	NextDayIsAdhika                  bool
	HasNextDayMasa                   bool
	ChandraMasaIndex                 int
	AmantaMasaName                   string
	PurnimantaMasaName               string
	IsAdhika                         bool
	VaraIndex                        int
	SolarMasaIndex                   int

	TithiByRule              map[FestivalDateRule]int
	TithiByRuleStart         map[FestivalDateRule]int
	PriorDayTithiByRule      map[FestivalDateRule]int
	PriorDayTithiByRuleStart map[FestivalDateRule]int

	JanmashtamiNishita *JanmashtamiNishita

	SankrantiRashi        *int
	NextDaySankrantiRashi *int
	PrevDaySankrantiRashi *int

	VaisakhiToday       bool
	VishuToday          bool
	PohelaBoishakhToday bool

	EkadashiDashamiViddha           bool
	VaishnavaDwadashiToday          bool
	EkadashiKshayaToday             bool
	EkadashiGaunaToday              bool
	EkadashiVriddhaDwadashiToday    bool
	EkadashiVriddhaDwadashiTomorrow bool
	EkadashiTrisprishaToday         bool
	EkadashiTrisprishaYesterday     bool
	EkadashiVriddhaFirstDay         bool

	Bhadra      *UtcWindowMs
	FormatClock func(ms int64) string

	Region types.FestivalRegion
}

type JanmashtamiNishita struct {
	AshtamiAtNishita bool
	RohiniAtNishita  bool
	NextDayClaims    bool
	PrevDayClaimed   bool
}

type UtcWindowMs struct {
	StartMs int64
	EndMs   int64
}

func ekadashiNameKey(masaIndex, paksha int, isAdhika bool) string {
	if isAdhika {
		return "ekadashi_" + adhikaEkadashiNames[paksha]
	}
	if masaIndex < 0 || masaIndex >= len(ekadashiNames) {
		return "ekadashi"
	}
	return "ekadashi_" + ekadashiNames[masaIndex][paksha]
}

type festivalCtxView struct{ ctx *FestivalComputeContext }

func (v festivalCtxView) nakshatraPrevails(rule *FestivalRule, nakshatra int) bool {
	dateRule := rule.NakshatraDateRule
	if dateRule == "" {
		dateRule = RuleSunrise
	}
	if dateRule == RuleSunrise {
		if v.ctx.NakshatraIndex != nakshatra {
			return false
		}
		return !(v.ctx.HasPriorDayNakshatraIndex && v.ctx.PriorDayNakshatraIndex == nakshatra)
	}
	start, okStart := v.ctx.NakshatraByRuleStart[dateRule]
	end, okEnd := v.ctx.NakshatraByRule[dateRule]
	if !(okStart && start == nakshatra) && !(okEnd && end == nakshatra) {
		return false
	}
	if v.ctx.NextDayNakshatraByRule == nil {
		return true
	}
	nextStart, nextEnd := v.ctx.NextDayNakshatraByRule()
	if ns, ok := nextStart[dateRule]; ok && ns == nakshatra {
		return false
	}
	ne, ok := nextEnd[dateRule]
	return !(ok && ne == nakshatra)
}

func (v festivalCtxView) tithiForRule(rule FestivalDateRule) int {
	if rule == RuleSunrise {
		return v.ctx.TithiIndex
	}
	if t, ok := v.ctx.TithiByRule[rule]; ok {
		return t
	}
	return v.ctx.TithiIndex
}

func (v festivalCtxView) tithiForRuleStart(rule FestivalDateRule) (int, bool) {
	if rule == RuleSunrise {
		return v.ctx.TithiIndex, true
	}
	t, ok := v.ctx.TithiByRuleStart[rule]
	return t, ok
}

func (v festivalCtxView) priorDayTithiForRule(rule FestivalDateRule) (int, bool) {
	if rule == RuleSunrise {
		return 0, false
	}
	t, ok := v.ctx.PriorDayTithiByRule[rule]
	return t, ok
}

func (v festivalCtxView) prevailsInKala(targetTithi int, dateRule FestivalDateRule, prefersLast bool) bool {
	ctx := v.ctx

	if dateRule == RuleJanmashtamiNishita {
		jn := ctx.JanmashtamiNishita
		if jn == nil {
			return v.prevailsInKala(targetTithi, RuleNishita, false)
		}
		if ctx.TithiIndex == targetTithi {
			return (jn.AshtamiAtNishita || jn.RohiniAtNishita) && !jn.PrevDayClaimed
		}
		return jn.AshtamiAtNishita && !jn.NextDayClaims
	}

	if dateRule == RuleAparahnaFull {
		startTithi, hasStart := ctx.TithiByRuleStart[RuleAparahna]
		endTithi, hasEnd := ctx.TithiByRule[RuleAparahna]
		priorStart, hasPriorStart := ctx.PriorDayTithiByRuleStart[RuleAparahna]
		priorEnd, hasPriorEnd := ctx.PriorDayTithiByRule[RuleAparahna]

		fullToday := hasStart && startTithi == targetTithi && hasEnd && endTithi == targetTithi
		fullYesterday := hasPriorStart && priorStart == targetTithi && hasPriorEnd && priorEnd == targetTithi
		if fullToday {
			return !fullYesterday
		}
		if fullYesterday {
			return false
		}
		madhyahna, hasMadhyahna := ctx.TithiByRule[RuleMadhyahna]
		currentToday := ctx.TithiIndex == targetTithi ||
			(hasStart && startTithi == targetTithi) ||
			(hasMadhyahna && madhyahna == targetTithi)
		return currentToday && !(hasEnd && endTithi == targetTithi)
	}

	endTithi := v.tithiForRule(dateRule)
	startTithi, hasStart := v.tithiForRuleStart(dateRule)
	priorEndTithi, hasPriorEnd := v.priorDayTithiForRule(dateRule)

	if dateRule == RuleChandrodaya {
		if endTithi == targetTithi {
			return !(hasPriorEnd && priorEndTithi == targetTithi)
		}
		return ctx.TithiIndex == targetTithi && !(hasPriorEnd && priorEndTithi == targetTithi)
	}

	if prefersLast && dateRule != RuleSunrise && ctx.NextDayTithiByRule != nil {
		nextStart, nextEnd := ctx.NextDayTithiByRule()
		if ns, ok := nextStart[dateRule]; ok && ns == targetTithi {
			return false
		}
		if ne, ok := nextEnd[dateRule]; ok && ne == targetTithi {
			return false
		}
	}

	matchedByEnd := endTithi == targetTithi
	matchedByStart := dateRule != RuleSunrise && hasStart &&
		startTithi == targetTithi && endTithi != targetTithi
	if !matchedByEnd && !matchedByStart {
		return false
	}

	if !prefersLast && dateRule != RuleSunrise && hasStart && startTithi != targetTithi &&
		hasPriorEnd && priorEndTithi == targetTithi {
		return false
	}

	if !prefersLast && matchedByStart && hasPriorEnd && priorEndTithi == targetTithi {
		return false
	}

	return true
}

func regionAllows(region types.FestivalRegion, allow []types.FestivalRegion) bool {
	if region == types.RegionAll {
		return true
	}
	for _, r := range allow {
		if r == types.RegionAll || r == region {
			return true
		}
	}
	return false
}

func ComputeFestivals(
	ctx *FestivalComputeContext,
	nameResolver func(key string) string,
	rashiNameResolver func(index int) string,
) []types.FestivalInfo {
	results := make([]types.FestivalInfo, 0, 8)
	v := festivalCtxView{ctx: ctx}

	region := ctx.Region
	if region == "" {
		region = types.RegionAll
	}
	rashiName := func(i int) string {
		if rashiNameResolver != nil {
			return rashiNameResolver(i)
		}
		return "Rashi " + strconv.Itoa(i)
	}

	for i := range festivalRegistry {
		rule := &festivalRegistry[i]

		adhikaBehaviour := rule.AdhikaBehaviour
		if adhikaBehaviour == "" {
			adhikaBehaviour = AdhikaSkip
		}

		if ctx.IsAdhika && adhikaBehaviour == AdhikaSkip {
			continue
		}
		if ctx.IsAdhika && adhikaBehaviour == AdhikaShiftToNija {
			continue
		}

		dateRule := rule.DateRule
		if dateRule == "" {
			dateRule = RuleSunrise
		}

		kshayaTithi := len(ctx.KshayaTithiIndices) == 1 && ctx.KshayaTithiIndices[rule.Tithi]
		kshaya := rule.Kind == KindMasaTithi && dateRule == RuleSunrise &&
			rule.KshayaRule != KshayaExclude && kshayaTithi
		masaIndex, isAdhika := ctx.ChandraMasaIndex, ctx.IsAdhika
		if kshaya && rule.Tithi == 0 && ctx.HasNextDayMasa {
			masaIndex, isAdhika = ctx.NextDayMasaIndex, ctx.NextDayIsAdhika
		}
		masaMatches := rule.Masa == masaIndex &&
			(adhikaBehaviour != AdhikaShiftToNija || !isAdhika) &&
			(adhikaBehaviour != AdhikaSkip || !isAdhika)

		match := false
		switch rule.Kind {
		case KindSolarNakshatra:
			match = rule.SolarMasa == ctx.SolarMasaIndex && rule.Nakshatra == ctx.NakshatraIndex
		case KindMasaNakshatra:
			pakshaMatches := rule.Paksha == PakshaAny ||
				(rule.Paksha == PakshaShukla) == (ctx.TithiIndex < utils.TotalTithis/2)
			if masaMatches && pakshaMatches {
				match = v.nakshatraPrevails(rule, rule.Nakshatra)
				if !match && rule.FallbackNakshatra != nil && v.nakshatraPrevails(rule, *rule.FallbackNakshatra) {
					if ctx.RemainingPakshaSunriseNakshatras != nil {
						match = !ctx.RemainingPakshaSunriseNakshatras()[rule.Nakshatra]
					}
				}
			}
		case KindMasaVara:
			inTithiRange := true
			if rule.TithiRange != nil {
				tithi := v.tithiForRule(dateRule)
				inTithiRange = tithi >= rule.TithiRange[0] && tithi <= rule.TithiRange[1]
			}
			match = masaMatches && rule.Vara == ctx.VaraIndex && inTithiRange
		case KindMasaTithi:
			if masaMatches {
				match = kshaya || v.prevailsInKala(rule.Tithi, dateRule, rule.KalaPrefers == KalaLast)
			}
		}

		if !match {
			continue
		}

		if rule.Regions != nil && !regionAllows(region, rule.Regions) {
			continue
		}

		festival := types.FestivalInfo{
			Key:  rule.Key,
			Name: nameResolver(rule.Key),
			Type: rule.Type,
		}

		if rule.NamingSystem == NamingPurnimanta && ctx.PurnimantaMasaName != "" && ctx.AmantaMasaName != "" {
			festival.Description = strings.Replace(
				nameResolver("desc_purnimanta_krishna_paksha"), "{masa}", ctx.PurnimantaMasaName, 1)
		}

		if rule.BhadraExclude && ctx.Bhadra != nil && ctx.FormatClock != nil {
			festival.Description = strings.Replace(
				nameResolver("desc_bhadra_observe_after"), "{time}", ctx.FormatClock(ctx.Bhadra.EndMs), 1)
		}

		results = append(results, festival)
	}

	isEkadashiAtSunrise := ctx.TithiIndex == 10 || ctx.TithiIndex == 25
	paksha := 0
	if ctx.TithiIndex == 25 {
		paksha = 1
	}

	push := func(key string, typ types.FestivalType, description string) {
		results = append(results, types.FestivalInfo{
			Key: key, Name: nameResolver(key), Type: typ, Description: description,
		})
	}

	switch {
	case isEkadashiAtSunrise && ctx.EkadashiVriddhaFirstDay:

	case isEkadashiAtSunrise && ctx.EkadashiTrisprishaYesterday:
		push("vaishnava_ekadashi", types.FestivalVaishnavaEkadashi,
			nameResolver(ekadashiNameKey(ctx.ChandraMasaIndex, paksha, ctx.IsAdhika)))

	case isEkadashiAtSunrise:
		namedDescription := nameResolver(ekadashiNameKey(ctx.ChandraMasaIndex, paksha, ctx.IsAdhika))

		vaishnavaTomorrow := ctx.EkadashiDashamiViddha || ctx.EkadashiVriddhaDwadashiTomorrow
		if !vaishnavaTomorrow {
			push("vaishnava_ekadashi", types.FestivalVaishnavaEkadashi, namedDescription)
		}
		push("smarta_ekadashi", types.FestivalSmartaEkadashi, namedDescription)
		ekadashiDesc := namedDescription
		if ctx.EkadashiDashamiViddha {
			ekadashiDesc = nameResolver("desc_ekadashi_viddha_vaishnava_next")
		} else if ctx.EkadashiVriddhaDwadashiTomorrow {
			ekadashiDesc = nameResolver("desc_ekadashi_vriddha_dwadashi_next")
		}
		push("ekadashi", types.FestivalEkadashi, ekadashiDesc)

	case ctx.EkadashiTrisprishaToday:
		triPaksha := 1
		if ctx.TithiIndex == 9 {
			triPaksha = 0
		}
		namedDescription := nameResolver(ekadashiNameKey(ctx.ChandraMasaIndex, triPaksha, ctx.IsAdhika))
		push("smarta_ekadashi", types.FestivalSmartaEkadashi, namedDescription)
		push("ekadashi", types.FestivalEkadashi, namedDescription)

	case ctx.EkadashiKshayaToday:
		kshayaPaksha := 1
		if ctx.TithiIndex == 9 {
			kshayaPaksha = 0
		}
		namedDescription := nameResolver(ekadashiNameKey(ctx.ChandraMasaIndex, kshayaPaksha, ctx.IsAdhika))
		push("smarta_ekadashi", types.FestivalSmartaEkadashi, namedDescription)
		push("ekadashi", types.FestivalEkadashi, namedDescription)

	case ctx.EkadashiGaunaToday:
		gaunaPaksha := 1
		if ctx.TithiIndex == 11 {
			gaunaPaksha = 0
		}
		push("vaishnava_ekadashi", types.FestivalVaishnavaEkadashi,
			nameResolver(ekadashiNameKey(ctx.ChandraMasaIndex, gaunaPaksha, ctx.IsAdhika)))

	case ctx.VaishnavaDwadashiToday:
		push("vaishnava_ekadashi", types.FestivalVaishnavaEkadashi,
			nameResolver("desc_ekadashi_viddha_vaishnava_today"))

	case ctx.EkadashiVriddhaDwadashiToday:
		push("vaishnava_ekadashi", types.FestivalVaishnavaEkadashi,
			nameResolver("desc_ekadashi_vriddha_dwadashi_vaishnava"))
	}

	if priorChandrodaya, ok := v.priorDayTithiForRule(RuleChandrodaya); v.tithiForRule(RuleChandrodaya) == 18 &&
		!(ok && priorChandrodaya == 18) {
		push("sankashti_chaturthi", types.FestivalMajor, "")
	}

	if isMahaShivaratriMonth := !ctx.IsAdhika && ctx.ChandraMasaIndex == 10; !isMahaShivaratriMonth &&
		v.prevailsInKala(28, RuleNishita, false) {
		push("masik_shivaratri", types.FestivalMinor, "")
	}

	if isGaneshChaturthiMonth := !ctx.IsAdhika && ctx.ChandraMasaIndex == 5; !isGaneshChaturthiMonth &&
		v.prevailsInKala(3, RuleMadhyahna, false) {
		push("vinayaka_chaturthi", types.FestivalMinor, "")
	}

	if ctx.NakshatraIndex == 7 {
		if ctx.VaraIndex == 0 {
			push("ravi_pushya", types.FestivalMinor, "")
		} else if ctx.VaraIndex == 4 {
			push("guru_pushya", types.FestivalMinor, "")
		}
	}

	if ctx.NakshatraIndex == 2 || (ctx.NakshatraIndicesInDay != nil && ctx.NakshatraIndicesInDay[2]) {
		push("masik_karthigai", types.FestivalMinor, "")
	}

	if pradoshaTithi := v.tithiForRule(RulePradosha); pradoshaTithi == 12 || pradoshaTithi == 27 {
		variantKey := "pradosha"
		if ctx.VaraIndex >= 0 && ctx.VaraIndex < len(pradoshaNames) {
			variantKey = pradoshaNames[ctx.VaraIndex]
		}
		push("pradosha", types.FestivalPradosha, nameResolver(variantKey))
	}

	if ctx.SankrantiRashi != nil {
		name := rashiName(*ctx.SankrantiRashi)
		push("sankranti", types.FestivalSankranti, name)

		for _, r := range sankrantiRegional[*ctx.SankrantiRashi] {
			if !regionAllows(region, r.Regions) {
				continue
			}
			push(r.Key, types.FestivalSankranti, name)
		}
	}

	for _, r := range []struct {
		flag    bool
		key     string
		regions []types.FestivalRegion
	}{
		{ctx.VaisakhiToday, "baisakhi", []types.FestivalRegion{"punjab", "haryana"}},
		{ctx.VishuToday, "vishu", []types.FestivalRegion{"kerala"}},
		{ctx.PohelaBoishakhToday, "pohela_boishakh", []types.FestivalRegion{"west-bengal"}},
	} {
		if !r.flag {
			continue
		}
		if region != types.RegionAll && !containsRegion(r.regions, region) {
			continue
		}
		push(r.key, types.FestivalSankranti, rashiName(0))
	}

	if ctx.NextDaySankrantiRashi != nil && *ctx.NextDaySankrantiRashi == 9 {
		if region == types.RegionAll || containsRegion(lohriRegions, region) {
			push("lohri", types.FestivalMajor, "")
		}
	}

	if ctx.NextDaySankrantiRashi != nil && *ctx.NextDaySankrantiRashi == 3 {
		if region == types.RegionAll || containsRegion(rajaRegions, region) {
			push("raja_pahili", types.FestivalMajor, "")
		}
	}

	if ctx.PrevDaySankrantiRashi != nil && *ctx.PrevDaySankrantiRashi == 3 {
		if region == types.RegionAll || containsRegion(rajaRegions, region) {
			push("raja_basi", types.FestivalMajor, "")
		}
	}

	return results
}

func containsRegion(list []types.FestivalRegion, region types.FestivalRegion) bool {
	for _, r := range list {
		if r == region {
			return true
		}
	}
	return false
}
