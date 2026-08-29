package types

// No field is ever absent: null for an inapplicable scalar, an empty non-nil slice for an inapplicable collection.

type MasaInfo struct {
	Index int    `json:"index"`
	Name  string `json:"name"`
}

type ResolvedTimezone struct {
	OffsetMinutes int    `json:"offsetMinutes"`
	Zone          string `json:"zone,omitempty"`
}

type SunPosition struct {
	SiderealLongitude float64            `json:"siderealLongitude"`
	Nakshatra         NakshatraIndexInfo `json:"nakshatra"`
}

type MoonPosition struct {
	SiderealLongitude float64   `json:"siderealLongitude"`
	Rashi             RashiInfo `json:"rashi"`
}

// Not an embedding of [SunPosition]: key order puts the position fields last.
type DailySun struct {
	Rise                 JSDate             `json:"rise"`
	Set                  JSDate             `json:"set"`
	NextRise             JSDate             `json:"nextRise"`
	RiseLocal            string             `json:"riseLocal"`
	SetLocal             string             `json:"setLocal"`
	NextRiseLocal        string             `json:"nextRiseLocal"`
	DayDurationMinutes   int                `json:"dayDurationMinutes"`
	NightDurationMinutes int                `json:"nightDurationMinutes"`
	DinamanaMinutes      int                `json:"dinamanaMinutes"`
	RatrimanaMinutes     int                `json:"ratrimanaMinutes"`
	SiderealLongitude    float64            `json:"siderealLongitude"`
	Nakshatra            NakshatraIndexInfo `json:"nakshatra"`
}

// Rise and Set are null on the days the Moon does not rise or set in the window.
type DailyMoon struct {
	Rise              *JSDate   `json:"rise"`
	Set               *JSDate   `json:"set"`
	RiseLocal         *string   `json:"riseLocal"`
	SetLocal          *string   `json:"setLocal"`
	SiderealLongitude float64   `json:"siderealLongitude"`
	Rashi             RashiInfo `json:"rashi"`
}

type DailyTithiInfo struct {
	Index                int     `json:"index"`
	Name                 string  `json:"name"`
	Paksha               string  `json:"paksha"`
	Number               int     `json:"number"`
	CompletionPercentage float64 `json:"completionPercentage"`
	EndTime              *JSDate `json:"endTime"`
	StartTime            *JSDate `json:"startTime"`
	IsActiveAtSunrise    bool    `json:"isActiveAtSunrise"`
	StartTimeLocal       *string `json:"startTimeLocal"`
	EndTimeLocal         *string `json:"endTimeLocal"`
}

type DailyNakshatraInfo struct {
	Index                int     `json:"index"`
	Name                 string  `json:"name"`
	Pada                 int     `json:"pada"`
	DegreesInNakshatra   float64 `json:"degreesInNakshatra"`
	CompletionPercentage float64 `json:"completionPercentage"`
	EndTime              *JSDate `json:"endTime"`
	StartTime            *JSDate `json:"startTime"`
	IsActiveAtSunrise    bool    `json:"isActiveAtSunrise"`
	StartTimeLocal       *string `json:"startTimeLocal"`
	EndTimeLocal         *string `json:"endTimeLocal"`
}

type DailyYogaInfo struct {
	Index                int     `json:"index"`
	Name                 string  `json:"name"`
	CompletionPercentage float64 `json:"completionPercentage"`
	EndTime              *JSDate `json:"endTime"`
	StartTime            *JSDate `json:"startTime"`
	IsActiveAtSunrise    bool    `json:"isActiveAtSunrise"`
	StartTimeLocal       *string `json:"startTimeLocal"`
	EndTimeLocal         *string `json:"endTimeLocal"`
}

type DailyKaranaInfo struct {
	Index                int        `json:"index"`
	Name                 string     `json:"name"`
	Type                 KaranaType `json:"type"`
	CompletionPercentage float64    `json:"completionPercentage"`
	EndTime              *JSDate    `json:"endTime"`
	StartTime            *JSDate    `json:"startTime"`
	IsActiveAtSunrise    bool       `json:"isActiveAtSunrise"`
	StartTimeLocal       *string    `json:"startTimeLocal"`
	EndTimeLocal         *string    `json:"endTimeLocal"`
}

// Index 0 of each array is the anga active at sunrise.
type DailyAngas struct {
	Tithis     []DailyTithiInfo     `json:"tithis"`
	Nakshatras []DailyNakshatraInfo `json:"nakshatras"`
	Yogas      []DailyYogaInfo      `json:"yogas"`
	Karanas    []DailyKaranaInfo    `json:"karanas"`
	Vara       VaraInfo             `json:"vara"`
}

type InstantAngas struct {
	Tithi     TithiInfo     `json:"tithi"`
	Nakshatra NakshatraInfo `json:"nakshatra"`
	Yoga      YogaInfo      `json:"yoga"`
	Karana    KaranaInfo    `json:"karana"`
	Vara      VaraInfo      `json:"vara"`
}

type CalendarLabels struct {
	Chandramasa ChandraMasaInfo `json:"chandramasa"`
	Samvat      SamvatInfo      `json:"samvat"`
}

// Not an embedding of [CalendarLabels]: masa is emitted first.
type DailyCalendarLabels struct {
	// Masa is the solar month (the Sun's rashi), not the lunar Chandramasa.
	Masa        MasaInfo        `json:"masa"`
	Chandramasa ChandraMasaInfo `json:"chandramasa"`
	Samvat      SamvatInfo      `json:"samvat"`
}

type MuhurtaWindows struct {
	// Abhijit is null on Wednesday.
	Abhijit        *TimePeriod  `json:"abhijit"`
	Brahma         TimePeriod   `json:"brahma"`
	Vijaya         TimePeriod   `json:"vijaya"`
	Godhuli        TimePeriod   `json:"godhuli"`
	Nishita        TimePeriod   `json:"nishita"`
	AmritKala      []TimePeriod `json:"amritKala"`
	Madhyahna      TimePeriod   `json:"madhyahna"`
	PratahSandhya  TimePeriod   `json:"pratahSandhya"`
	SayahnaSandhya TimePeriod   `json:"sayahnaSandhya"`
	DoGhati        DoGhatiInfo  `json:"doGhati"`
}

type InauspiciousWindows struct {
	RahuKalam      TimePeriod         `json:"rahuKalam"`
	GulikaKalam    TimePeriod         `json:"gulikaKalam"`
	Yamaganda      TimePeriod         `json:"yamaganda"`
	DurMuhurta     []DurMuhurtaPeriod `json:"durMuhurta"`
	Varjyam        []TimePeriod       `json:"varjyam"`
	Bhadra         *BhadraInfo        `json:"bhadra"`
	GandaMula      GandaMulaInfo      `json:"gandaMula"`
	Panchaka       bool               `json:"panchaka"`
	PanchakaInfo   PanchakaInfo       `json:"panchakaInfo"`
	PanchakaRahita []TimePeriod       `json:"panchakaRahita"`
}

type InstantInauspicious struct {
	Panchaka     bool          `json:"panchaka"`
	PanchakaInfo PanchakaInfo  `json:"panchakaInfo"`
	GandaMula    GandaMulaInfo `json:"gandaMula"`
}

type DayPeriods struct {
	Choghadiya ChoghadiyaInfo `json:"choghadiya"`
	Hora       HoraInfo       `json:"hora"`
	Gowri      GowriInfo      `json:"gowri"`
}

type FestivalType string

const (
	FestivalMajor             FestivalType = "major"
	FestivalMinor             FestivalType = "minor"
	FestivalEkadashi          FestivalType = "ekadashi"
	FestivalSmartaEkadashi    FestivalType = "smarta_ekadashi"
	FestivalVaishnavaEkadashi FestivalType = "vaishnava_ekadashi"
	FestivalPradosha          FestivalType = "pradosha"
	FestivalSankranti         FestivalType = "sankranti"
	FestivalEclipse           FestivalType = "eclipse"
)

var AllFestivalTypes = []FestivalType{
	FestivalMajor, FestivalMinor, FestivalEkadashi, FestivalSmartaEkadashi,
	FestivalVaishnavaEkadashi, FestivalPradosha, FestivalSankranti, FestivalEclipse,
}

type FestivalInfo struct {
	Key         string       `json:"key"`
	Name        string       `json:"name"`
	Type        FestivalType `json:"type"`
	Description string       `json:"description,omitempty"`
}

// The sutak fields are null for a penumbral lunar eclipse, which raises none.
type EclipseInfo struct {
	Kind                EclipseKind    `json:"kind"`
	Subtype             EclipseSubtype `json:"subtype"`
	Start               JSDate         `json:"start"`
	Peak                JSDate         `json:"peak"`
	End                 JSDate         `json:"end"`
	StartLocal          string         `json:"startLocal"`
	PeakLocal           string         `json:"peakLocal"`
	EndLocal            string         `json:"endLocal"`
	VisibleFromLocation bool           `json:"visibleFromLocation"`
	Obscuration         float64        `json:"obscuration"`
	Magnitude           float64        `json:"magnitude"`
	SutakStart          *JSDate        `json:"sutakStart"`
	SutakEnd            *JSDate        `json:"sutakEnd"`
	SutakStartLocal     *string        `json:"sutakStartLocal"`
	SutakEndLocal       *string        `json:"sutakEndLocal"`
	Description         string         `json:"description"`
}

type EclipseKind string

const (
	EclipseSolar EclipseKind = "solar"
	EclipseLunar EclipseKind = "lunar"
)

type EclipseSubtype string

const (
	EclipsePartial   EclipseSubtype = "partial"
	EclipseTotal     EclipseSubtype = "total"
	EclipseAnnular   EclipseSubtype = "annular"
	EclipsePenumbral EclipseSubtype = "penumbral"
)

var (
	AllEclipseKinds    = []EclipseKind{EclipseSolar, EclipseLunar}
	AllEclipseSubtypes = []EclipseSubtype{EclipsePartial, EclipseTotal, EclipseAnnular, EclipsePenumbral}
)

type DailyPanchangResult struct {
	Date         JSDate              `json:"date"`
	Location     GeoLocation         `json:"location"`
	Timezone     ResolvedTimezone    `json:"timezone"`
	Ayanamsa     float64             `json:"ayanamsa"`
	Sun          DailySun            `json:"sun"`
	Moon         DailyMoon           `json:"moon"`
	Angas        DailyAngas          `json:"angas"`
	Calendar     DailyCalendarLabels `json:"calendar"`
	Muhurtas     MuhurtaWindows      `json:"muhurtas"`
	Inauspicious InauspiciousWindows `json:"inauspicious"`
	Periods      DayPeriods          `json:"periods"`
	SpecialYogas []SpecialYogaInfo   `json:"specialYogas"`
	AnandadiYoga AnandadiYogaInfo    `json:"anandadiYoga"`
	Festivals    []FestivalInfo      `json:"festivals"`
	Eclipse      *EclipseInfo        `json:"eclipse"`
	ChandraBalam *ChandraBalamInfo   `json:"chandraBalam"`
	Tarabala     *TarabalaInfo       `json:"tarabala"`
}

type InstantPanchangResult struct {
	Timestamp    JSDate              `json:"timestamp"`
	Location     GeoLocation         `json:"location"`
	Ayanamsa     float64             `json:"ayanamsa"`
	Sun          SunPosition         `json:"sun"`
	Moon         MoonPosition        `json:"moon"`
	Angas        InstantAngas        `json:"angas"`
	Calendar     CalendarLabels      `json:"calendar"`
	Inauspicious InstantInauspicious `json:"inauspicious"`
	SpecialYogas []SpecialYogaInfo   `json:"specialYogas"`
	AnandadiYoga AnandadiYogaInfo    `json:"anandadiYoga"`
	Festivals    []FestivalInfo      `json:"festivals"`
	ChandraBalam *ChandraBalamInfo   `json:"chandraBalam"`
	Tarabala     *TarabalaInfo       `json:"tarabala"`
}
