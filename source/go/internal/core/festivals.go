package core

import (
	"strconv"
	"strings"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
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
	// Select is the day choice with a day geometry; DateRule is the sample test without one.
	Select TithiSelection
	// AnchorTithi (default Tithi) and AnchorOffset: the festival falls AnchorOffset days after the
	// day chosen for AnchorTithi.
	AnchorTithi  *int
	AnchorOffset int
	// UdayaNakshatra: a later udaya day holding this nakshatra at sunrise and in the kala takes over
	// from a day without it.
	UdayaNakshatra *int
	// VaraBeforeTithi: the Vara falls in the 7 days ending on this tithi's udaya day.
	VaraBeforeTithi *int
	// FollowsMasaSystem makes a KindMasaVara rule judge the month in the
	// caller's MasaSystem (the solar month in Nepal) instead of always Amanta.
	FollowsMasaSystem bool
}

// TithiSelection is how the day is chosen when a DayGeometry is supplied. Windows: madhyahna is the
// third fifth of the daytime, pradosha the first fifth of the night, nishita the 8th of 15 night
// muhurtas, arunodaya the 96 minutes before sunrise. A sunrise rule with no Select takes the first
// of two udaya days.
type TithiSelection string

const (
	SelectUdayaFirst TithiSelection = ""
	// SelectUdayaEach keeps every day whose sunrise holds the tithi (Phagli, pending a regional capture).
	SelectUdayaEach TithiSelection = "udaya-each"
	// SelectUdayaLast takes the later of two udaya days (Tritiya vratas, Rath Yatra).
	SelectUdayaLast TithiSelection = "udaya-last"
	// SelectTrimuhurta takes the first udaya day with 3 muhurtas of the tithi after sunrise, else the
	// day the tithi begins.
	SelectTrimuhurta TithiSelection = "trimuhurta"
	// SelectMadhyahna, SelectPradosha and SelectDaytime take the day whose window holds more of the
	// tithi, the earlier on a tie; no overlap falls back to udaya.
	SelectMadhyahna TithiSelection = "madhyahna"
	SelectPradosha  TithiSelection = "pradosha"
	SelectDaytime   TithiSelection = "daytime"
	// SelectMadhyahnaLast and SelectAparahnaLast take the last day whose window touches the tithi.
	SelectMadhyahnaLast TithiSelection = "madhyahna-last"
	SelectAparahnaLast  TithiSelection = "aparahna-last"
	// SelectAparahna takes the first full aparahna, else the larger overlap, else udaya; then
	// UdayaNakshatra may move it a day.
	SelectAparahna TithiSelection = "aparahna"
	// SelectNishita: one full nishita wins, two full the later, else the larger overlap; none, the
	// civil day the tithi begins.
	SelectNishita TithiSelection = "nishita"
	// SelectArunodaya takes the first day whose arunodaya touches the tithi, else the day it begins.
	SelectArunodaya TithiSelection = "arunodaya"
	// SelectSangavaStart takes the first day whose sunrise + 2/5 daytime follows the tithi's start.
	SelectSangavaStart TithiSelection = "sangava-start"
	// SelectNavamiStart takes the first day whose sunset less 2 muhurtas follows the tithi's start.
	SelectNavamiStart TithiSelection = "navami-start"
	// SelectHolika is the Holika Dahan ladder on Phalguna Purnima.
	SelectHolika TithiSelection = "holika"
)

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

// karthigaiDeepamRegions see Karthigai Deepam in place of that day's Masik
// Karthigai; everywhere else the day stays Masik Karthigai.
var karthigaiDeepamRegions = []types.FestivalRegion{"tamil-nadu"}

var festivalRegistry = []FestivalRule{
	{Key: "ugadi", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 0, Tithi: 0},
	{Key: "rama_navami", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 0, Tithi: 8, DateRule: RuleMadhyahna, AdhikaBehaviour: AdhikaShiftToNija,
		Select: SelectMadhyahnaLast},
	{Key: "hanuman_jayanti", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 0, Tithi: 14},
	{Key: "akshaya_tritiya", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 1, Tithi: 2, DateRule: RuleMadhyahna, Select: SelectTrimuhurta},
	{Key: "parashurama_jayanti", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 1, Tithi: 2, DateRule: RuleMadhyahna, Select: SelectPradosha},
	{Key: "guru_purnima", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 3, Tithi: 14},
	{Key: "nag_panchami", Kind: KindMasaTithi, Type: types.FestivalMinor, Masa: 4, Tithi: 4, Select: SelectTrimuhurta},
	{Key: "raksha_bandhan", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 4, Tithi: 14, BhadraExclude: true, Select: SelectTrimuhurta},
	{Key: "krishna_janmashtami", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 4, Tithi: 22, DateRule: RuleJanmashtamiNishita, AdhikaBehaviour: AdhikaShiftToNija},
	{Key: "ganesh_chaturthi", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 5, Tithi: 3, DateRule: RuleMadhyahna, Select: SelectMadhyahna},
	{Key: "anant_chaturdashi", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 5, Tithi: 13},
	{Key: "navaratri", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 0},
	{Key: "durga_ashtami", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 7},
	{Key: "maha_navami", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 8, Select: SelectNavamiStart},
	{Key: "dussehra", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 9, DateRule: RuleAparahnaFull, Select: SelectAparahna,
		UdayaNakshatra: intp(21)},
	{Key: "sharad_purnima", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 14},
	{Key: "karva_chauth", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 18, DateRule: RuleChandrodaya, NamingSystem: NamingPurnimanta},
	{Key: "dhanteras", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 27, DateRule: RulePradosha, NamingSystem: NamingPurnimanta,
		Select: SelectPradosha},
	{Key: "narak_chaturdashi", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 28, NamingSystem: NamingPurnimanta,
		Select: SelectArunodaya},
	{Key: "diwali", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 29, DateRule: RulePradosha, NamingSystem: NamingPurnimanta,
		Select: SelectPradosha},
	{Key: "kartika_purnima", Kind: KindMasaTithi, Type: types.FestivalMinor, Masa: 7, Tithi: 14},
	{Key: "vasant_panchami", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 10, Tithi: 4, DateRule: RuleMadhyahna, Select: SelectSangavaStart},
	{Key: "maha_shivaratri", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 10, Tithi: 28, DateRule: RuleNishita, Select: SelectNishita},
	{Key: "holika_dahan", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 11, Tithi: 14, Select: SelectHolika},
	{Key: "holi", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 11, Tithi: 14, Select: SelectHolika, AnchorOffset: 1},
	{Key: "mahalaya_amavasya", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 5, Tithi: 29},
	{Key: "chhath_nahay_khay", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 7, Tithi: 3, AnchorTithi: intp(5), AnchorOffset: -2},
	{Key: "chhath_kharna", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 7, Tithi: 4, AnchorTithi: intp(5), AnchorOffset: -1},
	{Key: "chhath_sandhya_arghya", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 7, Tithi: 5},
	{Key: "chhath_usha_arghya", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 7, Tithi: 6, AnchorTithi: intp(5), AnchorOffset: 1},
	{Key: "vat_savitri_amavasya", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 1, Tithi: 29,
		DateRule: RuleAparahna, KalaPrefers: KalaLast, Select: SelectAparahnaLast},
	{Key: "vat_savitri_purnima", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 2, Tithi: 14},
	{Key: "yajur_upakarma", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 4, Tithi: 14, Select: SelectTrimuhurta},
	{Key: "shravan_somvar", Kind: KindMasaVara, Type: types.FestivalMinor, Masa: 4, Vara: 1, AdhikaBehaviour: AdhikaObserveInBoth, FollowsMasaSystem: true},
	{Key: "mangala_gauri", Kind: KindMasaVara, Type: types.FestivalMinor, Masa: 4, Vara: 2, AdhikaBehaviour: AdhikaObserveInBoth, FollowsMasaSystem: true},
	{Key: "kartik_somvar", Kind: KindMasaVara, Type: types.FestivalMinor, Masa: 7, Vara: 1, AdhikaBehaviour: AdhikaObserveInBoth, FollowsMasaSystem: true},
	{Key: "magha_shanivar", Kind: KindMasaVara, Type: types.FestivalMinor, Masa: 10, Vara: 6, AdhikaBehaviour: AdhikaObserveInBoth, FollowsMasaSystem: true},
	{Key: "onam", Kind: KindSolarNakshatra, Type: types.FestivalMajor, SolarMasa: 4, Nakshatra: 21, AdhikaBehaviour: AdhikaObserveInBoth},
	{Key: "rig_upakarma", Kind: KindMasaNakshatra, Type: types.FestivalMajor, Masa: 4, Nakshatra: 21,
		Paksha: PakshaShukla, FallbackNakshatra: intp(12)},
	{Key: "sama_upakarma", Kind: KindMasaNakshatra, Type: types.FestivalMajor, Masa: 5, Nakshatra: 12,
		Paksha: PakshaShukla, NakshatraDateRule: RuleAparahna},
	{Key: "gudi_padwa", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 0, Tithi: 0, Regions: []types.FestivalRegion{"maharashtra", "goa"}},
	{Key: "gangaur", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 0, Tithi: 2, Select: SelectUdayaLast, Regions: []types.FestivalRegion{"rajasthan"}},
	{Key: "karaga", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 0, Tithi: 14, Regions: []types.FestivalRegion{"karnataka"}},
	{Key: "bonalu", Kind: KindMasaVara, Type: types.FestivalMinor, Masa: 3, Vara: 0, AdhikaBehaviour: AdhikaObserveInBoth, Regions: []types.FestivalRegion{"telangana"}},
	{Key: "hariyali_teej", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 4, Tithi: 2, Select: SelectUdayaLast, Regions: []types.FestivalRegion{"rajasthan", "uttar-pradesh", "bihar", "haryana", "madhya-pradesh"}},
	{Key: "kajari_teej", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 4, Tithi: 17, Select: SelectUdayaLast, Regions: []types.FestivalRegion{"rajasthan", "uttar-pradesh", "madhya-pradesh"}},
	{Key: "hartalika_teej", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 5, Tithi: 2, Select: SelectUdayaLast, Regions: []types.FestivalRegion{"rajasthan", "uttar-pradesh", "bihar", "maharashtra", "madhya-pradesh"}},
	{Key: "govardhan_puja", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 7, Tithi: 0, Select: SelectDaytime, Regions: []types.FestivalRegion{"uttar-pradesh", "bihar", "haryana", "rajasthan", "gujarat", "madhya-pradesh", "punjab", "jharkhand"}},
	{Key: "bhai_dooj", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 7, Tithi: 1, Select: SelectAparahnaLast, Regions: []types.FestivalRegion{"uttar-pradesh", "bihar", "haryana", "maharashtra", "gujarat", "rajasthan", "madhya-pradesh", "west-bengal", "jharkhand", "nepal"}},
	{Key: "phagli", Kind: KindMasaTithi, Type: types.FestivalMinor, Masa: 11, Tithi: 14, Select: SelectUdayaEach, Regions: []types.FestivalRegion{"himachal-pradesh"}, KshayaRule: KshayaExclude},
	{Key: "jagannath_rath_yatra", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 3, Tithi: 1, Select: SelectUdayaLast},
	{Key: "varamahalakshmi", Kind: KindMasaVara, Type: types.FestivalMajor, Masa: 4, Vara: 5, Regions: []types.FestivalRegion{"karnataka", "andhra-pradesh", "telangana", "tamil-nadu"}, TithiRange: &[2]int{7, 13}, VaraBeforeTithi: intp(14)},
	{Key: "bathukamma_start", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 5, Tithi: 29, Regions: []types.FestivalRegion{"telangana"}},
	{Key: "bathukamma_saddula", Kind: KindMasaTithi, Type: types.FestivalMajor, Masa: 6, Tithi: 7, Regions: []types.FestivalRegion{"telangana"}},
}

type FestivalComputeContext struct {
	TithiIndex                       int
	NakshatraIndex                   int
	MasikKarthigaiToday              bool
	HasMasikKarthigai                bool
	KarthigaiDeepamToday             func() bool
	NakshatraByRule                  map[FestivalDateRule]int
	NakshatraByRuleStart             map[FestivalDateRule]int
	PriorDayNakshatraIndex           int
	HasPriorDayNakshatraIndex        bool
	NextDayNakshatraIndex            int
	HasNextDayNakshatraIndex         bool
	PriorDaySolarMasaIndex           int
	HasPriorDaySolarMasaIndex        bool
	NakshatraLaterInSolarMonth       func(nakshatra int) bool
	RemainingPakshaSunriseNakshatras func() map[int]bool
	NextDayNakshatraByRule           func() (start, end map[FestivalDateRule]int)
	NextDayTithiByRule               func() (start, end map[FestivalDateRule]int)
	KshayaTithiIndices               map[int]bool
	NextDayMasaIndex                 int
	NextDayIsAdhika                  bool
	HasNextDayMasa                   bool
	ChandraMasaIndex                 int
	VaraMasaIndex                    int
	HasVaraMasaIndex                 bool
	AmantaMasaName                   string
	PurnimantaMasaName               string
	IsAdhika                         bool
	VaraIndex                        int
	SolarMasaIndex                   int

	// NextDayMasa is the lazy amanta masa at the next sunrise, for a span that opens a month after
	// today's sunrise.
	NextDayMasa func() (index int, isAdhika bool)
	// DayGeometry nil (the instant path) makes every rule fall back to its DateRule samples.
	DayGeometry *DayGeometry

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
	EkadashiVriddhaTrisprisha       bool

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

// KalaDay is one Hindu day, epoch milliseconds.
type KalaDay struct {
	Sunrise     int64
	Sunset      int64
	NextSunrise int64
}

// DayGeometry is the days around today and the instants the tithi-selection rules measure kala
// windows against.
type DayGeometry struct {
	Today KalaDay
	// Day is the Hindu day k days from today (Day(0) is Today); false past a polar gap.
	Day         func(k int) (KalaDay, bool)
	TithiAt     func(ms int64) int
	NakshatraAt func(ms int64) int
	// ElongationReaches is the instant, to 1 s, at which the Moon-Sun elongation reaches deg for the
	// crossing nearest nearMs. Bracketed on a fixed 6 h grid, so every day that asks gets the same
	// instant.
	ElongationReaches func(deg float64, nearMs int64) int64
	// LocalDay is the local civil day number of an instant (days since 1970-01-01 local).
	LocalDay func(ms int64) int64
}

type kalaWindow func(d KalaDay) (int64, int64)

const arunodayaMs = 96 * 60_000

// Pradosha is three night muhurtas, nishita the 8th of fifteen.
var (
	kalaMadhyahna kalaWindow = func(d KalaDay) (int64, int64) {
		return int64(float64(d.Sunrise) + float64((d.Sunset-d.Sunrise)*2)/5),
			int64(float64(d.Sunrise) + float64((d.Sunset-d.Sunrise)*3)/5)
	}
	kalaAparahna kalaWindow = func(d KalaDay) (int64, int64) {
		return int64(float64(d.Sunrise) + float64((d.Sunset-d.Sunrise)*3)/5),
			int64(float64(d.Sunrise) + float64((d.Sunset-d.Sunrise)*4)/5)
	}
	kalaPradosha kalaWindow = func(d KalaDay) (int64, int64) {
		return d.Sunset, int64(float64(d.Sunset) + float64(d.NextSunrise-d.Sunset)/5)
	}
	kalaNishita kalaWindow = func(d KalaDay) (int64, int64) {
		return int64(float64(d.Sunset) + float64((d.NextSunrise-d.Sunset)*7)/15),
			int64(float64(d.Sunset) + float64((d.NextSunrise-d.Sunset)*8)/15)
	}
	kalaDaytime   kalaWindow = func(d KalaDay) (int64, int64) { return d.Sunrise, d.Sunset }
	kalaArunodaya kalaWindow = func(d KalaDay) (int64, int64) {
		return d.Sunrise - arunodayaMs, d.Sunrise
	}
)

type tithiSpan struct{ start, end int64 }

// tithiSelector is the day choice for the tithi rules, measured on the anchor tithi's span against
// today's and its neighbours' windows.
type tithiSelector struct {
	ctx           *FestivalComputeContext
	g             *DayGeometry
	sunriseTithis map[int]*int
	spans         map[int]tithiSpan
	holikaDone    bool
	holika        int
	holikaOK      bool
}

func newTithiSelector(ctx *FestivalComputeContext, g *DayGeometry) *tithiSelector {
	return &tithiSelector{ctx: ctx, g: g, sunriseTithis: map[int]*int{}, spans: map[int]tithiSpan{}}
}

func (s *tithiSelector) day(k int) *KalaDay {
	d, ok := s.g.Day(k)
	if !ok {
		return nil
	}
	return &d
}

func (s *tithiSelector) sunriseTithi(k int) (int, bool) {
	t, seen := s.sunriseTithis[k]
	if !seen {
		if d := s.day(k); d != nil {
			v := s.g.TithiAt(d.Sunrise)
			t = &v
		}
		s.sunriseTithis[k] = t
	}
	if t == nil {
		return 0, false
	}
	return *t, true
}

func (s *tithiSelector) spanOf(tithi int) tithiSpan {
	sp, ok := s.spans[tithi]
	if !ok {
		near := s.g.Today.Sunrise
		sp = tithiSpan{
			start: s.g.ElongationReaches(float64(tithi*12), near),
			end:   s.g.ElongationReaches(float64(((tithi+1)%30)*12), near),
		}
		s.spans[tithi] = sp
	}
	return sp
}

// offset is today's sunrise tithi less tithi, in [-15, 14].
func (s *tithiSelector) offset(tithi int) int { return (s.ctx.TithiIndex-tithi+45)%30 - 15 }

func (s *tithiSelector) near(tithi, lo, hi int) bool {
	o := s.offset(tithi)
	return o >= lo && o <= hi
}

func overlapMs(w kalaWindow, d *KalaDay, sp tithiSpan) int64 {
	if d == nil {
		return 0
	}
	a, b := w(*d)
	lo, hi := max(a, sp.start), min(b, sp.end)
	if hi <= lo {
		return 0
	}
	return hi - lo
}

func fullWindow(w kalaWindow, d *KalaDay, sp tithiSpan) bool {
	if d == nil {
		return false
	}
	a, b := w(*d)
	return sp.start <= a && b <= sp.end
}

func udayaIn(d *KalaDay, sp tithiSpan) bool {
	return d != nil && sp.start <= d.Sunrise && d.Sunrise < sp.end
}

func startsIn(d *KalaDay, sp tithiSpan) bool {
	return d != nil && d.Sunrise <= sp.start && sp.start < d.NextSunrise
}

// udayaFirstAt: day k is the first whose sunrise the span holds, else the day holding the whole span.
func (s *tithiSelector) udayaFirstAt(sp tithiSpan, k int) bool {
	if udayaIn(s.day(k), sp) {
		return !udayaIn(s.day(k-1), sp)
	}
	return startsIn(s.day(k), sp) && !udayaIn(s.day(k+1), sp)
}

// udayaAt samples day k: the tithi at its sunrise, or a kshaya tithi that day holds.
func (s *tithiSelector) udayaAt(tithi, k int, last bool) bool {
	t, ok := s.sunriseTithi(k)
	if !ok {
		return false
	}
	if t == tithi {
		nk := k - 1
		if last {
			nk = k + 1
		}
		n, ok := s.sunriseTithi(nk)
		return !ok || n != tithi
	}
	next, ok := s.sunriseTithi(k + 1)
	return ok && (tithi-t+30)%30 == 1 && (next-tithi+30)%30 == 1
}

func (s *tithiSelector) maxOverlap(tithi int, w kalaWindow, fallback bool) bool {
	sp := s.spanOf(tithi)
	today, yesterday, tomorrow := &s.g.Today, s.day(-1), s.day(1)
	o0 := overlapMs(w, today, sp)
	oPrev := overlapMs(w, yesterday, sp)
	oNext := overlapMs(w, tomorrow, sp)
	if o0 > 0 {
		f0 := fullWindow(w, today, sp)
		beatsPrev := o0 > oPrev
		if f0 && fullWindow(w, yesterday, sp) {
			beatsPrev = false
		}
		beatsNext := o0 >= oNext
		if f0 && fullWindow(w, tomorrow, sp) {
			beatsNext = true
		}
		return beatsPrev && beatsNext
	}
	return fallback && oPrev == 0 && oNext == 0 && s.udayaFirstAt(sp, 0)
}

func (s *tithiSelector) lastOverlap(tithi int, w kalaWindow) bool {
	sp := s.spanOf(tithi)
	oNext := overlapMs(w, s.day(1), sp)
	if overlapMs(w, &s.g.Today, sp) > 0 {
		return oNext == 0
	}
	return oNext == 0 && overlapMs(w, s.day(-1), sp) == 0 && s.udayaFirstAt(sp, 0)
}

// aparahnaLadder is day k's claim: the first full aparahna, else the larger overlap (earlier on a
// tie), else udaya.
func (s *tithiSelector) aparahnaLadder(sp tithiSpan, k int) bool {
	w := kalaAparahna
	d, prev, next := s.day(k), s.day(k-1), s.day(k+1)
	if d == nil {
		return false
	}
	if fullWindow(w, d, sp) {
		return !fullWindow(w, prev, sp)
	}
	if fullWindow(w, prev, sp) || fullWindow(w, next, sp) {
		return false
	}
	o, oPrev, oNext := overlapMs(w, d, sp), overlapMs(w, prev, sp), overlapMs(w, next, sp)
	if o > 0 {
		return o > oPrev && o >= oNext
	}
	return oPrev == 0 && oNext == 0 && s.udayaFirstAt(sp, k)
}

// vijaya: a next day with Dashami and the nakshatra at sunrise, and the nakshatra in its aparahna,
// takes over from a ladder day whose aparahna lacks the nakshatra (Nirnaya Sindhu: udaye dasami
// kimcit ... sravanarksam yada kale sa tithir vijayabhidha).
func (s *tithiSelector) vijaya(tithi int, nakshatra *int) bool {
	sp := s.spanOf(tithi)
	if nakshatra == nil {
		return s.aparahnaLadder(sp, 0)
	}
	has := func(d *KalaDay) bool {
		a, b := kalaAparahna(*d)
		return s.g.NakshatraAt(a) == *nakshatra || s.g.NakshatraAt(b) == *nakshatra
	}
	moves := func(k int) bool {
		d, next := s.day(k), s.day(k+1)
		return d != nil && next != nil && udayaIn(next, sp) && s.g.NakshatraAt(next.Sunrise) == *nakshatra &&
			!has(d) && has(next)
	}
	if s.aparahnaLadder(sp, 0) {
		return !moves(0)
	}
	return s.aparahnaLadder(sp, -1) && moves(-1)
}

func (s *tithiSelector) nishitaLadder(tithi int) bool {
	sp := s.spanOf(tithi)
	w := kalaNishita
	today, yesterday, tomorrow := &s.g.Today, s.day(-1), s.day(1)
	if fullWindow(w, today, sp) {
		return !fullWindow(w, tomorrow, sp)
	}
	if fullWindow(w, yesterday, sp) || fullWindow(w, tomorrow, sp) {
		return false
	}
	o0, oPrev, oNext := overlapMs(w, today, sp), overlapMs(w, yesterday, sp), overlapMs(w, tomorrow, sp)
	if o0 > 0 {
		return o0 > oPrev && o0 >= oNext
	}
	return oPrev == 0 && oNext == 0 && s.g.LocalDay(sp.start) == s.g.LocalDay(today.Sunrise)
}

func (s *tithiSelector) arunodayaFirst(tithi int) bool {
	sp := s.spanOf(tithi)
	w := kalaArunodaya
	oPrev := overlapMs(w, s.day(-1), sp)
	if overlapMs(w, &s.g.Today, sp) > 0 {
		return oPrev == 0
	}
	return oPrev == 0 && overlapMs(w, s.day(1), sp) == 0 && startsIn(&s.g.Today, sp)
}

func (s *tithiSelector) trimuhurta(tithi int) bool {
	sp := s.spanOf(tithi)
	lasts := func(d *KalaDay) bool { return (sp.end-d.Sunrise)*15 >= (d.Sunset-d.Sunrise)*3 }
	today := &s.g.Today
	if udayaIn(today, sp) {
		return !udayaIn(s.day(-1), sp) && lasts(today)
	}
	if !startsIn(today, sp) {
		return false
	}
	tomorrow := s.day(1)
	return tomorrow == nil || !udayaIn(tomorrow, sp) || !lasts(tomorrow)
}

// startsBefore cuts at sunrise + num/den of the daytime: the first day whose cut follows the
// tithi's start.
func (s *tithiSelector) startsBefore(tithi int, num, den int64) bool {
	sp := s.spanOf(tithi)
	cut := func(d *KalaDay) int64 {
		return int64(float64(d.Sunrise) + float64((d.Sunset-d.Sunrise)*num)/float64(den))
	}
	if sp.start >= cut(&s.g.Today) {
		return false
	}
	yesterday := s.day(-1)
	return yesterday == nil || sp.start >= cut(yesterday)
}

// holikaDay is Holika Dahan's day relative to today: Nirnaya Sindhu's pradosha, Bhadra and prahara
// ladder.
func (s *tithiSelector) holikaDay() (int, bool) {
	if s.holikaDone {
		return s.holika, s.holikaOK
	}
	s.holikaDone = true
	sp := s.spanOf(14)
	k0, found := 0, false
	for k := -3; k <= 2 && !found; k++ {
		if startsIn(s.day(k), sp) {
			k0, found = k, true
		}
	}
	if !found {
		return 0, false
	}
	bhadraEnd := s.g.ElongationReaches(174, s.g.Today.Sunrise)
	w := kalaPradosha
	bhadraFree := func(k int) bool {
		d := s.day(k)
		if d == nil {
			return false
		}
		a, b := w(*d)
		return max(a, bhadraEnd) < min(b, sp.end)
	}
	var hits []int
	for _, k := range []int{k0, k0 + 1} {
		if overlapMs(w, s.day(k), sp) > 0 {
			hits = append(hits, k)
		}
	}
	switch len(hits) {
	case 2:
		switch {
		case bhadraFree(k0):
			s.holika = k0
		case bhadraFree(k0 + 1):
			s.holika = k0 + 1
		default:
			s.holika = k0
		}
	case 1:
		h := hits[0]
		d := s.day(h)
		next := s.day(h + 1)
		s.holika = h
		midnight := int64(float64(d.Sunset) + float64(d.NextSunrise-d.Sunset)/2)
		if !bhadraFree(h) && bhadraEnd >= midnight && next != nil {
			remaining := sp.end - next.Sunrise
			daytime := next.Sunset - next.Sunrise
			pratipadaLonger := func() bool {
				return s.g.ElongationReaches(192, s.g.Today.Sunrise)-sp.end > sp.end-sp.start
			}
			if remaining*8 >= daytime*7 || (remaining*4 >= daytime*3 && pratipadaLonger()) {
				s.holika = h + 1
			}
		}
	default:
		s.holika = k0 + 1
		if sp.start < s.day(k0).Sunset {
			s.holika = k0
		}
	}
	s.holikaOK = true
	return s.holika, true
}

// selects reports whether today is the rule's day; masa and adhika are the caller's.
func (s *tithiSelector) selects(rule *FestivalRule, tithi int) bool {
	k := 0 - rule.AnchorOffset
	switch rule.Select {
	case SelectUdayaFirst:
		return s.near(tithi, -k-2, -k+2) && s.udayaAt(tithi, k, false)
	case SelectUdayaLast:
		return s.near(tithi, -1, 0) && s.udayaAt(tithi, 0, true)
	case SelectTrimuhurta:
		return s.near(tithi, -1, 0) && s.trimuhurta(tithi)
	case SelectMadhyahna:
		return s.near(tithi, -1, 0) && s.maxOverlap(tithi, kalaMadhyahna, true)
	case SelectPradosha:
		return s.near(tithi, -1, 0) && s.maxOverlap(tithi, kalaPradosha, true)
	case SelectDaytime:
		return s.near(tithi, -1, 0) && s.maxOverlap(tithi, kalaDaytime, true)
	case SelectMadhyahnaLast:
		return s.near(tithi, -1, 0) && s.lastOverlap(tithi, kalaMadhyahna)
	case SelectAparahnaLast:
		return s.near(tithi, -1, 0) && s.lastOverlap(tithi, kalaAparahna)
	case SelectAparahna:
		return s.near(tithi, -1, 0) && s.vijaya(tithi, rule.UdayaNakshatra)
	case SelectNishita:
		return s.near(tithi, -1, 0) && s.nishitaLadder(tithi)
	case SelectArunodaya:
		return s.near(tithi, -1, 1) && s.arunodayaFirst(tithi)
	case SelectSangavaStart:
		return s.near(tithi, -1, 0) && s.startsBefore(tithi, 2, 5)
	case SelectNavamiStart:
		return s.near(tithi, -1, 0) && s.startsBefore(tithi, 13, 15)
	case SelectHolika:
		if !s.near(tithi, -1, 2) {
			return false
		}
		h, ok := s.holikaDay()
		return ok && h == k
	case SelectUdayaEach:
		return s.ctx.TithiIndex == tithi
	}
	return false
}

// nextMonth is the masa of a span that opens the next month after today's sunrise.
func (s *tithiSelector) nextMonth() (int, bool) {
	if s.ctx.NextDayMasa != nil {
		return s.ctx.NextDayMasa()
	}
	if s.ctx.HasNextDayMasa {
		return s.ctx.NextDayMasaIndex, s.ctx.NextDayIsAdhika
	}
	return s.ctx.ChandraMasaIndex, s.ctx.IsAdhika
}

// shivaratri and pradosh are one day per span; a Trayodashi touching no pradosha has none.
func (s *tithiSelector) shivaratri() bool { return s.near(28, -1, 0) && s.nishitaLadder(28) }

func (s *tithiSelector) vinayaka() bool {
	return s.near(3, -1, 0) && s.maxOverlap(3, kalaMadhyahna, true)
}

func (s *tithiSelector) pradosh(tithi int) bool {
	return s.near(tithi, -1, 0) && s.maxOverlap(tithi, kalaPradosha, false)
}

// varaBefore: the Friday (or any Vara) in the 7 days that end on the tithi's udaya day.
func (s *tithiSelector) varaBefore(tithi int) bool {
	if !s.near(tithi, -9, 0) {
		return false
	}
	for k := 0; k < 7; k++ {
		if s.udayaAt(tithi, k, false) {
			return true
		}
	}
	return false
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

	pushRule := func(rule *FestivalRule) {
		if rule.Regions != nil && !regionAllows(region, rule.Regions) {
			return
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

	var selector *tithiSelector
	if ctx.DayGeometry != nil {
		selector = newTithiSelector(ctx, ctx.DayGeometry)
	}

	for i := range festivalRegistry {
		rule := &festivalRegistry[i]

		adhikaBehaviour := rule.AdhikaBehaviour
		if adhikaBehaviour == "" {
			adhikaBehaviour = AdhikaSkip
		}

		dateRule := rule.DateRule
		if dateRule == "" {
			dateRule = RuleSunrise
		}

		if selector != nil && rule.Kind == KindMasaTithi && rule.Select != SelectUdayaEach &&
			(rule.Select != SelectUdayaFirst || dateRule == RuleSunrise) {
			anchor := rule.Tithi
			if rule.AnchorTithi != nil {
				anchor = *rule.AnchorTithi
			}
			if !selector.selects(rule, anchor) {
				continue
			}
			masa, masaAdhika := ctx.ChandraMasaIndex, ctx.IsAdhika
			if ctx.TithiIndex-anchor > 15 {
				masa, masaAdhika = selector.nextMonth()
			}
			if masaAdhika && adhikaBehaviour != AdhikaObserveInBoth {
				continue
			}
			if masa != rule.Masa {
				continue
			}
			pushRule(rule)
			continue
		}

		kshayaTithi := len(ctx.KshayaTithiIndices) == 1 && ctx.KshayaTithiIndices[rule.Tithi]
		kshaya := rule.Kind == KindMasaTithi && dateRule == RuleSunrise &&
			rule.KshayaRule != KshayaExclude && kshayaTithi
		masaIndex, isAdhika := ctx.ChandraMasaIndex, ctx.IsAdhika
		if kshaya && rule.Tithi == 0 && ctx.HasNextDayMasa {
			masaIndex, isAdhika = ctx.NextDayMasaIndex, ctx.NextDayIsAdhika
		}

		if isAdhika && adhikaBehaviour == AdhikaSkip {
			continue
		}
		if isAdhika && adhikaBehaviour == AdhikaShiftToNija {
			continue
		}
		masaMatches := rule.Masa == masaIndex &&
			(adhikaBehaviour != AdhikaShiftToNija || !isAdhika) &&
			(adhikaBehaviour != AdhikaSkip || !isAdhika)

		match := false
		switch rule.Kind {
		case KindSolarNakshatra:
			// One day per solar month: vriddha takes the first sunrise, kshaya the
			// day holding it, two transits the later.
			if rule.SolarMasa == ctx.SolarMasaIndex {
				n := rule.Nakshatra
				priorSolarMasa := ctx.SolarMasaIndex
				if ctx.HasPriorDaySolarMasaIndex {
					priorSolarMasa = ctx.PriorDaySolarMasaIndex
				}
				vriddhaSecondDay := ctx.HasPriorDayNakshatraIndex && ctx.PriorDayNakshatraIndex == n &&
					priorSolarMasa == rule.SolarMasa
				firstSunrise := ctx.NakshatraIndex == n && !vriddhaSecondDay
				kshayaNakshatra := ctx.HasNextDayNakshatraIndex &&
					ctx.NakshatraIndex == (n+26)%27 && ctx.NextDayNakshatraIndex == (n+1)%27
				match = (firstSunrise || kshayaNakshatra) &&
					(ctx.NakshatraLaterInSolarMonth == nil || !ctx.NakshatraLaterInSolarMonth(n))
			}
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
			if rule.FollowsMasaSystem && ctx.HasVaraMasaIndex {
				masaMatches = rule.Masa == ctx.VaraMasaIndex
			}
			inTithiRange := true
			if selector != nil && rule.VaraBeforeTithi != nil {
				inTithiRange = rule.Vara == ctx.VaraIndex && selector.varaBefore(*rule.VaraBeforeTithi)
			} else if rule.TithiRange != nil {
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
		pushRule(rule)
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
	case isEkadashiAtSunrise && ctx.EkadashiVriddhaTrisprisha:
		namedDescription := nameResolver(ekadashiNameKey(ctx.ChandraMasaIndex, paksha, ctx.IsAdhika))
		push("smarta_ekadashi", types.FestivalSmartaEkadashi, namedDescription)
		push("ekadashi", types.FestivalEkadashi, namedDescription)

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

	if v.prevailsInKala(18, RuleChandrodaya, false) {
		push("sankashti_chaturthi", types.FestivalMajor, "")
	}

	if isMahaShivaratriMonth := !ctx.IsAdhika && ctx.ChandraMasaIndex == 10; !isMahaShivaratriMonth {
		if selector != nil && selector.shivaratri() || selector == nil && v.prevailsInKala(28, RuleNishita, false) {
			push("masik_shivaratri", types.FestivalMinor, "")
		}
	}

	if isGaneshChaturthiMonth := !ctx.IsAdhika && ctx.ChandraMasaIndex == 5; !isGaneshChaturthiMonth {
		if selector != nil && selector.vinayaka() || selector == nil && v.prevailsInKala(3, RuleMadhyahna, false) {
			push("vinayaka_chaturthi", types.FestivalMinor, "")
		}
	}

	if ctx.NakshatraIndex == 7 {
		if ctx.VaraIndex == 0 {
			push("ravi_pushya", types.FestivalMinor, "")
		} else if ctx.VaraIndex == 4 {
			push("guru_pushya", types.FestivalMinor, "")
		}
	}

	masikKarthigai := ctx.NakshatraIndex == 2
	if ctx.HasMasikKarthigai {
		masikKarthigai = ctx.MasikKarthigaiToday
	}
	if masikKarthigai {
		if regionAllows(region, karthigaiDeepamRegions) && ctx.KarthigaiDeepamToday != nil &&
			ctx.KarthigaiDeepamToday() {
			push("karthigai_deepam", types.FestivalMajor, "")
		} else {
			push("masik_karthigai", types.FestivalMinor, "")
		}
	}

	pradoshaTithi := v.tithiForRule(RulePradosha)
	pradoshaToday := pradoshaTithi == 12 || pradoshaTithi == 27
	if selector != nil {
		pradoshaToday = selector.pradosh(12) || selector.pradosh(27)
	}
	if pradoshaToday {
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
