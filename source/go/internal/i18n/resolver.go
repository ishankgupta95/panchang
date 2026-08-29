package i18n

import "github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"

var translations = map[types.Language]PanchangTranslations{
	types.LanguageEn: en,
	types.LanguageHi: hi,
}

func GetTranslations(lang types.Language) PanchangTranslations {
	if t, ok := translations[lang]; ok {
		return t
	}
	return en
}

func ResolvePakshaName(index int, lang types.Language) string {
	t := GetTranslations(lang)
	if index < 15 {
		return t.PakshaNames.Shukla
	}
	return t.PakshaNames.Krishna
}

func ResolveTithiName(index int, lang types.Language) string {
	t := GetTranslations(lang)
	if index == 14 {
		return t.Misc.Purnima
	}
	if index == 29 {
		return t.Misc.Amavasya
	}
	paksha := t.PakshaNames.Krishna
	nameIndex := index - 15
	if index < 15 {
		paksha = t.PakshaNames.Shukla
		nameIndex = index
	}
	return paksha + " " + t.TithiNames[nameIndex]
}

func ResolveNakshatraName(index int, lang types.Language) string {
	return GetTranslations(lang).NakshatraNames[index]
}

func ResolveYogaName(index int, lang types.Language) string {
	return GetTranslations(lang).YogaNames[index]
}

func ResolveAnandadiYogaName(index int, lang types.Language) string {
	return GetTranslations(lang).AnandadiYogaNames[index]
}

func ResolveKaranaName(index int, lang types.Language) string {
	t := GetTranslations(lang)
	if index == 0 {
		return t.KaranaNames.Fixed[0]
	}
	if index >= 57 {
		return t.KaranaNames.Fixed[index-56]
	}
	return t.KaranaNames.Movable[(index-1)%7]
}

func ResolveMasaName(index int, lang types.Language) string {
	return GetTranslations(lang).MasaNames[index]
}

func ResolveChandraMasaName(index int, lang types.Language, adhika bool) string {
	t := GetTranslations(lang)
	name := t.ChandraMasaNames[index]
	if adhika {
		return t.Misc.Adhika + " " + name
	}
	return name
}

var AllLanguages = []types.Language{types.LanguageEn, types.LanguageHi}
