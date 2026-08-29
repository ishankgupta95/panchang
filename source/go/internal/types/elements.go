package types

import "encoding/json"

type ChoghadiyaQuality string

const (
	QualityAuspicious   ChoghadiyaQuality = "auspicious"
	QualityInauspicious ChoghadiyaQuality = "inauspicious"
	QualityNeutral      ChoghadiyaQuality = "neutral"
)

var AllChoghadiyaQualities = []ChoghadiyaQuality{
	QualityAuspicious, QualityInauspicious, QualityNeutral,
}

type ElementBase struct {
	Index                int     `json:"index"`
	Name                 string  `json:"name"`
	CompletionPercentage float64 `json:"completionPercentage"`
	EndTime              *JSDate `json:"endTime"`
}

type TithiInfo struct {
	Index  int    `json:"index"`
	Name   string `json:"name"`
	Paksha string `json:"paksha"`
	// Number is 1-15 within the paksha: index+1 in Shukla, index−14 in Krishna.
	Number               int     `json:"number"`
	CompletionPercentage float64 `json:"completionPercentage"`
	EndTime              *JSDate `json:"endTime"`
}

type NakshatraInfo struct {
	Index                int     `json:"index"`
	Name                 string  `json:"name"`
	Pada                 int     `json:"pada"`
	DegreesInNakshatra   float64 `json:"degreesInNakshatra"`
	CompletionPercentage float64 `json:"completionPercentage"`
	EndTime              *JSDate `json:"endTime"`
}

type YogaInfo struct {
	Index                int     `json:"index"`
	Name                 string  `json:"name"`
	CompletionPercentage float64 `json:"completionPercentage"`
	EndTime              *JSDate `json:"endTime"`
}

type KaranaType string

const (
	KaranaFixed   KaranaType = "fixed"
	KaranaMovable KaranaType = "movable"
)

var AllKaranaTypes = []KaranaType{KaranaFixed, KaranaMovable}

type KaranaInfo struct {
	Index                int        `json:"index"`
	Name                 string     `json:"name"`
	Type                 KaranaType `json:"type"`
	CompletionPercentage float64    `json:"completionPercentage"`
	EndTime              *JSDate    `json:"endTime"`
}

type VaraName struct {
	Name  string
	Short string
}

type VaraInfo struct {
	Index       int    `json:"index"`
	Name        string `json:"name"`
	ShortName   string `json:"shortName"`
	EnglishName string `json:"englishName"`
}

type RashiInfo struct {
	Index int    `json:"index"`
	Name  string `json:"name"`
}

type NakshatraIndexInfo struct {
	Index int    `json:"index"`
	Name  string `json:"name"`
}

// Index and Name follow System; the Amanta and Purnimanta pairs are always both published.
type ChandraMasaInfo struct {
	Index           int        `json:"index"`
	Name            string     `json:"name"`
	IsAdhika        bool       `json:"isAdhika"`
	System          MasaSystem `json:"system"`
	AmantaIndex     int        `json:"amantaIndex"`
	AmantaName      string     `json:"amantaName"`
	PurnimantaIndex int        `json:"purnimantaIndex"`
	PurnimantaName  string     `json:"purnimantaName"`
}

type SamvatInfo struct {
	VikramSamvat     int    `json:"vikramSamvat"`
	ShakaSamvat      int    `json:"shakaSamvat"`
	VikramSamvatsara string `json:"vikramSamvatsara"`
	ShakaSamvatsara  string `json:"shakaSamvatsara"`
}

type UtcWindow struct {
	StartMs int64 `json:"start"`
	EndMs   int64 `json:"end"`
}

// Start and End are true instants, never shifted by the zone offset; the *Local strings carry it.
type TimePeriod struct {
	Start      JSDate `json:"start"`
	End        JSDate `json:"end"`
	StartLocal string `json:"startLocal"`
	EndLocal   string `json:"endLocal"`
}

// The slot pairs must not embed a window: embedding would put startLocal and endLocal ahead of index in the emitted key order.
type UnlocalizedChoghadiyaSlot struct {
	StartMs int64 `json:"start"`
	EndMs   int64 `json:"end"`
	// Index is the position in the 7-name cycle, not the slot ordinal.
	Index       int               `json:"index"`
	Name        string            `json:"name"`
	Quality     ChoghadiyaQuality `json:"quality"`
	QualityName string            `json:"qualityName"`
}

type ChoghadiyaSlot struct {
	Start       JSDate            `json:"start"`
	End         JSDate            `json:"end"`
	Index       int               `json:"index"`
	Name        string            `json:"name"`
	Quality     ChoghadiyaQuality `json:"quality"`
	QualityName string            `json:"qualityName"`
	StartLocal  string            `json:"startLocal"`
	EndLocal    string            `json:"endLocal"`
}

type UnlocalizedChoghadiyaInfo struct {
	Day   []UnlocalizedChoghadiyaSlot `json:"day"`
	Night []UnlocalizedChoghadiyaSlot `json:"night"`
}

type ChoghadiyaInfo struct {
	Day   []ChoghadiyaSlot `json:"day"`
	Night []ChoghadiyaSlot `json:"night"`
}

type UnlocalizedHoraSlot struct {
	StartMs int64 `json:"start"`
	EndMs   int64 `json:"end"`
	// PlanetIndex is 0-6 Chaldean: Sun, Venus, Mercury, Moon, Saturn, Jupiter, Mars.
	PlanetIndex int    `json:"planetIndex"`
	Planet      string `json:"planet"`
}

type HoraSlot struct {
	Start       JSDate `json:"start"`
	End         JSDate `json:"end"`
	PlanetIndex int    `json:"planetIndex"`
	Planet      string `json:"planet"`
	StartLocal  string `json:"startLocal"`
	EndLocal    string `json:"endLocal"`
}

type UnlocalizedHoraInfo struct {
	Day   []UnlocalizedHoraSlot `json:"day"`
	Night []UnlocalizedHoraSlot `json:"night"`
}

type HoraInfo struct {
	Day   []HoraSlot `json:"day"`
	Night []HoraSlot `json:"night"`
}

type UnlocalizedGowriSlot struct {
	StartMs     int64             `json:"start"`
	EndMs       int64             `json:"end"`
	Index       int               `json:"index"`
	Name        string            `json:"name"`
	Quality     ChoghadiyaQuality `json:"quality"`
	QualityName string            `json:"qualityName"`
}

type GowriSlot struct {
	Start       JSDate            `json:"start"`
	End         JSDate            `json:"end"`
	Index       int               `json:"index"`
	Name        string            `json:"name"`
	Quality     ChoghadiyaQuality `json:"quality"`
	QualityName string            `json:"qualityName"`
	StartLocal  string            `json:"startLocal"`
	EndLocal    string            `json:"endLocal"`
}

type UnlocalizedGowriInfo struct {
	Day   []UnlocalizedGowriSlot `json:"day"`
	Night []UnlocalizedGowriSlot `json:"night"`
}

type GowriInfo struct {
	Day   []GowriSlot `json:"day"`
	Night []GowriSlot `json:"night"`
}

type UnlocalizedDoGhatiSlot struct {
	StartMs int64 `json:"start"`
	EndMs   int64 `json:"end"`
	// Index is the global 0-29 slot: 0-14 daytime, 15-29 nighttime.
	Index       int               `json:"index"`
	Name        string            `json:"name"`
	Quality     ChoghadiyaQuality `json:"quality"`
	QualityName string            `json:"qualityName"`
}

type DoGhatiSlot struct {
	Start       JSDate            `json:"start"`
	End         JSDate            `json:"end"`
	Index       int               `json:"index"`
	Name        string            `json:"name"`
	Quality     ChoghadiyaQuality `json:"quality"`
	QualityName string            `json:"qualityName"`
	StartLocal  string            `json:"startLocal"`
	EndLocal    string            `json:"endLocal"`
}

type UnlocalizedDoGhatiInfo struct {
	Day   []UnlocalizedDoGhatiSlot `json:"day"`
	Night []UnlocalizedDoGhatiSlot `json:"night"`
}

type DoGhatiInfo struct {
	Day   []DoGhatiSlot `json:"day"`
	Night []DoGhatiSlot `json:"night"`
}

type UnlocalizedDurMuhurtaPeriod struct {
	StartMs int64           `json:"start"`
	EndMs   int64           `json:"end"`
	Segment DayNightSegment `json:"segment"`
}

type DurMuhurtaPeriod struct {
	Start      JSDate          `json:"start"`
	End        JSDate          `json:"end"`
	StartLocal string          `json:"startLocal"`
	EndLocal   string          `json:"endLocal"`
	Segment    DayNightSegment `json:"segment"`
}

type DayNightSegment string

const (
	SegmentDay   DayNightSegment = "day"
	SegmentNight DayNightSegment = "night"
)

var AllDayNightSegments = []DayNightSegment{SegmentDay, SegmentNight}

type GandaMulaSeverity string

const (
	GandaMulaMild   GandaMulaSeverity = "mild"
	GandaMulaSevere GandaMulaSeverity = "severe"
)

var AllGandaMulaSeverities = []GandaMulaSeverity{GandaMulaMild, GandaMulaSevere}

type GandaMulaInfo struct {
	Active        bool              `json:"active"`
	NakshatraName string            `json:"nakshatraName"`
	Severity      GandaMulaSeverity `json:"severity"`
}

func (g GandaMulaInfo) MarshalJSON() ([]byte, error) {
	if !g.Active {
		return []byte(`{"active":false}`), nil
	}
	type alias GandaMulaInfo
	return json.Marshal(alias(g))
}

// PanchakaType samanya covers a spell begun on a Wednesday or Thursday: no affliction.
type PanchakaType string

const (
	PanchakaRoga    PanchakaType = "roga"
	PanchakaRaja    PanchakaType = "raja"
	PanchakaAgni    PanchakaType = "agni"
	PanchakaChora   PanchakaType = "chora"
	PanchakaMrityu  PanchakaType = "mrityu"
	PanchakaSamanya PanchakaType = "samanya"
)

var AllPanchakaTypes = []PanchakaType{
	PanchakaRoga, PanchakaRaja, PanchakaAgni, PanchakaChora, PanchakaMrityu, PanchakaSamanya,
}

// The applicable Panchaka is fixed by the weekday the spell began on, for the whole spell.
type PanchakaInfo struct {
	Active    bool         `json:"active"`
	Type      PanchakaType `json:"type"`
	Name      string       `json:"name"`
	IsDosha   bool         `json:"isDosha"`
	OnsetVara int          `json:"onsetVara"`
}

// Hand-written rather than omitempty, which would drop isDosha:false and onsetVara:0.
func (p PanchakaInfo) MarshalJSON() ([]byte, error) {
	if !p.Active {
		return []byte(`{"active":false}`), nil
	}
	type alias PanchakaInfo
	return json.Marshal(alias(p))
}

type AnandadiYogaInfo struct {
	Index   int               `json:"index"`
	Name    string            `json:"name"`
	Quality ChoghadiyaQuality `json:"quality"`
}

type BhadraLocation string

const (
	BhadraEarth  BhadraLocation = "earth"
	BhadraHeaven BhadraLocation = "heaven"
	BhadraPaatal BhadraLocation = "paatal"
)

var AllBhadraLocations = []BhadraLocation{BhadraEarth, BhadraHeaven, BhadraPaatal}

type UnlocalizedBhadraVasaSegment struct {
	StartMs      int64          `json:"start"`
	EndMs        int64          `json:"end"`
	Location     BhadraLocation `json:"location"`
	LocationName string         `json:"locationName"`
}

type BhadraVasaSegment struct {
	Start        JSDate         `json:"start"`
	End          JSDate         `json:"end"`
	Location     BhadraLocation `json:"location"`
	LocationName string         `json:"locationName"`
	StartLocal   string         `json:"startLocal"`
	EndLocal     string         `json:"endLocal"`
}

type UnlocalizedBhadraInfo struct {
	StartMs int64 `json:"start"`
	EndMs   int64 `json:"end"`
	// Location is the Moon's rashi at the window's start; Vasa has the piecewise breakdown.
	Location     BhadraLocation                 `json:"location"`
	LocationName string                         `json:"locationName"`
	Vasa         []UnlocalizedBhadraVasaSegment `json:"vasa"`
	IsActive     bool                           `json:"isActive"`
}

type BhadraInfo struct {
	Start        JSDate              `json:"start"`
	End          JSDate              `json:"end"`
	StartLocal   string              `json:"startLocal"`
	EndLocal     string              `json:"endLocal"`
	Location     BhadraLocation      `json:"location"`
	LocationName string              `json:"locationName"`
	Vasa         []BhadraVasaSegment `json:"vasa"`
	IsActive     bool                `json:"isActive"`
}

type SpecialYogaType string

const (
	YogaAmritSiddhi     SpecialYogaType = "amrit_siddhi"
	YogaSarvarthaSiddhi SpecialYogaType = "sarvartha_siddhi"
	YogaRaviPushya      SpecialYogaType = "ravi_pushya"
	YogaGuruPushya      SpecialYogaType = "guru_pushya"
	YogaDwipushkar      SpecialYogaType = "dwipushkar"
	YogaTripushkar      SpecialYogaType = "tripushkar"
	YogaJwalamukhi      SpecialYogaType = "jwalamukhi"
	YogaAadal           SpecialYogaType = "aadal"
	YogaVidaal          SpecialYogaType = "vidaal"
	YogaRavi            SpecialYogaType = "ravi"
)

// Also the emission order: a computed result is a subsequence of this.
var AllSpecialYogaTypes = []SpecialYogaType{
	YogaAmritSiddhi, YogaSarvarthaSiddhi, YogaRaviPushya, YogaGuruPushya,
	YogaDwipushkar, YogaTripushkar, YogaJwalamukhi, YogaAadal, YogaVidaal, YogaRavi,
}

type SpecialYogaInfo struct {
	Name string          `json:"name"`
	Type SpecialYogaType `json:"type"`
}
