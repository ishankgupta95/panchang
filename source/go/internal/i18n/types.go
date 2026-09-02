package i18n

import "github.com/ishankgupta95/panchang/source/go/v5/internal/types"

type EclipseTranslations struct {
	Template   string
	Kind       EclipseKindNames
	Subtype    EclipseSubtypeNames
	Visibility EclipseVisibilityNames
}

type EclipseKindNames struct {
	Solar string
	Lunar string
}

type EclipseSubtypeNames struct {
	Partial   string
	Total     string
	Annular   string
	Penumbral string
}

type EclipseVisibilityNames struct {
	Visible    string
	NotVisible string
}

type VaraName = types.VaraName

type KaranaNames struct {
	Movable [7]string
	Fixed   [4]string
}

type PakshaNames struct {
	Shukla  string
	Krishna string
}

type MiscNames struct {
	Purnima   string
	Amavasya  string
	Adhika    string
	Ekadashi  string
	Pradosha  string
	Sankranti string
}

func (t PanchangTranslations) MiscByKey(key string) (string, bool) {
	switch key {
	case "purnima":
		return t.Misc.Purnima, true
	case "amavasya":
		return t.Misc.Amavasya, true
	case "adhika":
		return t.Misc.Adhika, true
	case "ekadashi":
		return t.Misc.Ekadashi, true
	case "pradosha":
		return t.Misc.Pradosha, true
	case "sankranti":
		return t.Misc.Sankranti, true
	}
	return "", false
}

var MiscKeys = []string{"purnima", "amavasya", "adhika", "ekadashi", "pradosha", "sankranti"}

type QualityNames struct {
	Auspicious   string
	Inauspicious string
	Neutral      string
}

func (t PanchangTranslations) Quality(q types.ChoghadiyaQuality) string {
	switch q {
	case types.QualityAuspicious:
		return t.QualityNames.Auspicious
	case types.QualityInauspicious:
		return t.QualityNames.Inauspicious
	case types.QualityNeutral:
		return t.QualityNames.Neutral
	}
	return ""
}

type SpecialYogaNames struct {
	AmritSiddhi     string
	SarvarthaSiddhi string
	RaviPushya      string
	GuruPushya      string
	Dwipushkar      string
	Tripushkar      string
	Jwalamukhi      string
	Aadal           string
	Vidaal          string
	Ravi            string
}

func (t PanchangTranslations) SpecialYoga(y types.SpecialYogaType) string {
	switch y {
	case types.YogaAmritSiddhi:
		return t.SpecialYogaNames.AmritSiddhi
	case types.YogaSarvarthaSiddhi:
		return t.SpecialYogaNames.SarvarthaSiddhi
	case types.YogaRaviPushya:
		return t.SpecialYogaNames.RaviPushya
	case types.YogaGuruPushya:
		return t.SpecialYogaNames.GuruPushya
	case types.YogaDwipushkar:
		return t.SpecialYogaNames.Dwipushkar
	case types.YogaTripushkar:
		return t.SpecialYogaNames.Tripushkar
	case types.YogaJwalamukhi:
		return t.SpecialYogaNames.Jwalamukhi
	case types.YogaAadal:
		return t.SpecialYogaNames.Aadal
	case types.YogaVidaal:
		return t.SpecialYogaNames.Vidaal
	case types.YogaRavi:
		return t.SpecialYogaNames.Ravi
	}
	return ""
}

type BhadraLocationNames struct {
	Earth  string
	Heaven string
	Paatal string
}

func (t PanchangTranslations) BhadraLocation(l types.BhadraLocation) string {
	switch l {
	case types.BhadraEarth:
		return t.BhadraLocationNames.Earth
	case types.BhadraHeaven:
		return t.BhadraLocationNames.Heaven
	case types.BhadraPaatal:
		return t.BhadraLocationNames.Paatal
	}
	return ""
}

type PanchakaTypeNames struct {
	Roga    string
	Raja    string
	Agni    string
	Chora   string
	Mrityu  string
	Samanya string
}

func (t PanchangTranslations) PanchakaType(p types.PanchakaType) string {
	switch p {
	case types.PanchakaRoga:
		return t.PanchakaTypeNames.Roga
	case types.PanchakaRaja:
		return t.PanchakaTypeNames.Raja
	case types.PanchakaAgni:
		return t.PanchakaTypeNames.Agni
	case types.PanchakaChora:
		return t.PanchakaTypeNames.Chora
	case types.PanchakaMrityu:
		return t.PanchakaTypeNames.Mrityu
	case types.PanchakaSamanya:
		return t.PanchakaTypeNames.Samanya
	}
	return ""
}

type ChandraBalamNames struct {
	Shubha  string
	Ashubha string
}

func (t PanchangTranslations) Tarabala(taraIndex int) string {
	return t.TarabalaNames[taraIndex]
}

func (t PanchangTranslations) Festival(key string) string {
	return t.FestivalNames[key]
}

type PanchangTranslations struct {
	TithiNames          [14]string
	NakshatraNames      [27]string
	YogaNames           [27]string
	KaranaNames         KaranaNames
	VaraNames           [7]types.VaraName
	PakshaNames         PakshaNames
	MasaNames           [12]string
	ChandraMasaNames    [12]string
	ChoghadiyaNames     [7]string
	GowriNames          [8]string
	DoGhatiNames        [30]string
	GrahaNames          [7]string
	SpecialYogaNames    SpecialYogaNames
	AnandadiYogaNames   [28]string
	ChandraBalamNames   ChandraBalamNames
	TarabalaNames       [9]string
	QualityNames        QualityNames
	BhadraLocationNames BhadraLocationNames
	PanchakaTypeNames   PanchakaTypeNames
	Eclipse             EclipseTranslations
	FestivalNames       map[string]string
	Misc                MiscNames
}
