package muhurta

type MuhurtaTableLanguage string

const (
	MuhurtaLangEn MuhurtaTableLanguage = "en"
	MuhurtaLangHi MuhurtaTableLanguage = "hi"
)

var AllMuhurtaFactorAxes = []MuhurtaFactorAxis{
	AxisTithi, AxisNakshatra, AxisVara, AxisKarana, AxisYoga, AxisSpecialYoga,
	AxisVaraTithiYoga, AxisExclusion,
}

func factorIndex(n int) *int { return &n }

type MuhurtaTableDay struct {
	Date    string          `json:"date"`
	Score   int             `json:"score"`
	Passes  bool            `json:"passes"`
	Factors []MuhurtaFactor `json:"factors"`
}
