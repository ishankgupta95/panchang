package calendar

import "github.com/ishankgupta95/panchang/source/go/v5/types"

var AllTableLanguages = []FestivalsTableLanguage{TableLangEn, TableLangHi}

// checkTableLanguages rejects any language a table has no text for; repeats
// are fine.
func checkTableLanguages(languages []FestivalsTableLanguage) error {
	for _, l := range languages {
		if l != TableLangEn && l != TableLangHi {
			return types.Codef(types.ErrInvalidInput, "languages must be drawn from en, hi; got %q", string(l))
		}
	}
	return nil
}

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
