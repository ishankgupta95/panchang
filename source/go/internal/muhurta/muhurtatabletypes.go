package muhurta

type MuhurtaTableLanguage string

const (
	MuhurtaLangEn MuhurtaTableLanguage = "en"
	MuhurtaLangHi MuhurtaTableLanguage = "hi"
)

type MuhurtaFactorAxis string

const (
	AxisTithi         MuhurtaFactorAxis = "tithi"
	AxisNakshatra     MuhurtaFactorAxis = "nakshatra"
	AxisVara          MuhurtaFactorAxis = "vara"
	AxisKarana        MuhurtaFactorAxis = "karana"
	AxisYoga          MuhurtaFactorAxis = "yoga"
	AxisSpecialYoga   MuhurtaFactorAxis = "specialYoga"
	AxisVaraTithiYoga MuhurtaFactorAxis = "varaTithiYoga"
	AxisExclusion     MuhurtaFactorAxis = "exclusion"
)

var AllMuhurtaFactorAxes = []MuhurtaFactorAxis{
	AxisTithi, AxisNakshatra, AxisVara, AxisKarana, AxisYoga, AxisSpecialYoga,
	AxisVaraTithiYoga, AxisExclusion,
}

type MuhurtaFactor struct {
	Code  string            `json:"code"`
	Axis  MuhurtaFactorAxis `json:"axis"`
	Index *int              `json:"index,omitempty"`
	Delta int               `json:"delta"`
}

func factorIndex(n int) *int { return &n }

type MuhurtaTableDay struct {
	Date    string          `json:"date"`
	Score   int             `json:"score"`
	Passes  bool            `json:"passes"`
	Factors []MuhurtaFactor `json:"factors"`
}

type PackedMuhurtaTableDay struct {
	Date string `json:"date"`
	S    int    `json:"s"`
	P    int    `json:"p"`
	F    []int  `json:"f"` // indices into [MuhurtaFile.Dict]
}

// Field order is wire order.
type MuhurtaTableMeta struct {
	Format                int     `json:"format"`
	Occasion              string  `json:"occasion"`
	ReferenceLocation     string  `json:"referenceLocation"`
	Latitude              float64 `json:"latitude"`
	Longitude             float64 `json:"longitude"`
	TimezoneOffsetMinutes int     `json:"timezoneOffsetMinutes"`
	Ayanamsa              string  `json:"ayanamsa"`
	MasaSystem            string  `json:"masaSystem"`
	StartYear             int     `json:"startYear"`
	EndYear               int     `json:"endYear"`
	IncludeFailures       bool    `json:"includeFailures"`
	GeneratedAt           string  `json:"generatedAt"`
	Note                  string  `json:"note"`
	OccasionName          string  `json:"occasionName,omitempty"`
}

type MuhurtaFile struct {
	Meta  MuhurtaTableMeta                   `json:"_meta"`
	Dict  []MuhurtaFactor                    `json:"_dict"`
	Years map[string][]PackedMuhurtaTableDay `json:"years"`
}
