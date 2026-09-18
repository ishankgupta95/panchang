package calendar

var AllTableLanguages = []FestivalsTableLanguage{TableLangEn, TableLangHi}

func Localized(pairs ...LocalizedPair) LocalizedString {
	var s LocalizedString
	for i, p := range pairs {
		switch p.Lang {
		case TableLangEn:
			if !s.HasEn && i > 0 && s.HasHi {
				s.HiFirst = true
			}
			s.En, s.HasEn = p.Value, true
		case TableLangHi:
			s.Hi, s.HasHi = p.Value, true
		}
	}
	return s
}

type LocalizedPair struct {
	Lang  FestivalsTableLanguage
	Value string
}

var AllFestivalsTableTypes = []FestivalsTableType{
	TableTypeMajor, TableTypeMinor, TableTypeEkadashi, TableTypeSmartaEkadashi,
	TableTypeVaishnavaEkadashi, TableTypePradosha, TableTypeSankranti, TableTypeEclipse,
}

type FestivalTableEntry struct {
	Key            string             `json:"key"`
	Name           string             `json:"name"`
	Type           FestivalsTableType `json:"type"`
	Description    string             `json:"description,omitempty"`
	HasDescription bool               `json:"-"`
}

type FestivalTableDay struct {
	Date      string               `json:"date"`
	Festivals []FestivalTableEntry `json:"festivals"`
}
