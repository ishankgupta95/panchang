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
