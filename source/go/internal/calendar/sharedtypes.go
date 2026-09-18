package calendar

import "github.com/ishankgupta95/panchang/source/go/v5/types"

// These declarations live in the shared types package so that a caller can
// import them and their fields and methods render in the documentation. The
// aliases here keep this package's own references spelled unqualified.

type (
	AnyFestivalsFile            = types.AnyFestivalsFile
	AnyMoonPhasesFile           = types.AnyMoonPhasesFile
	BuildEclipsesTableOptions   = types.BuildEclipsesTableOptions
	BuildFestivalsTableOptions  = types.BuildFestivalsTableOptions
	BuildMoonPhasesTableOptions = types.BuildMoonPhasesTableOptions
	ConvertOptions              = types.ConvertOptions
	EclipseSutak                = types.EclipseSutak
	EclipseTableEntryRaw        = types.EclipseTableEntryRaw
	EclipseTableKind            = types.EclipseTableKind
	EclipseTableMeta            = types.EclipseTableMeta
	EclipseTableSubtype         = types.EclipseTableSubtype
	EclipsesFile                = types.EclipsesFile
	FestivalDay                 = types.FestivalDay
	FestivalDictEntry           = types.FestivalDictEntry
	FestivalTableEntryRaw       = types.FestivalTableEntryRaw
	FestivalTableMeta           = types.FestivalTableMeta
	FestivalsFile               = types.FestivalsFile
	FestivalsTableLanguage      = types.FestivalsTableLanguage
	FestivalsTableType          = types.FestivalsTableType
	HinduCalendarCoords         = types.HinduCalendarCoords
	HinduDateCoords             = types.HinduDateCoords
	LocalizedString             = types.LocalizedString
	MoonPhaseDictEntry          = types.MoonPhaseDictEntry
	MoonPhaseTableEntryRaw      = types.MoonPhaseTableEntryRaw
	MoonPhaseTableMeta          = types.MoonPhaseTableMeta
	MoonPhaseTableName          = types.MoonPhaseTableName
	MoonPhasesFile              = types.MoonPhasesFile
	PackedFestivalTableDay      = types.PackedFestivalTableDay
	PackedMoonPhaseEvent        = types.PackedMoonPhaseEvent
	PackedMoonPhaseTableDay     = types.PackedMoonPhaseTableDay
	Paksha                      = types.Paksha
	RawEclipseTableDay          = types.RawEclipseTableDay
	SankrantiEvent              = types.SankrantiEvent
	YearlyListingOptions        = types.YearlyListingOptions
)

const (
	EclipseAnnular             = types.EclipseTableAnnular
	EclipseLunar               = types.EclipseTableLunar
	EclipsePartial             = types.EclipseTablePartial
	EclipsePenumbral           = types.EclipseTablePenumbral
	EclipseSolar               = types.EclipseTableSolar
	EclipseTotal               = types.EclipseTableTotal
	PakshaKrishna              = types.PakshaKrishna
	PakshaShukla               = types.PakshaShukla
	PhaseFirstQuarter          = types.PhaseFirstQuarter
	PhaseFull                  = types.PhaseFull
	PhaseLastQuarter           = types.PhaseLastQuarter
	PhaseNew                   = types.PhaseNew
	TableLangEn                = types.TableLangEn
	TableLangHi                = types.TableLangHi
	TableTypeEclipse           = types.TableTypeEclipse
	TableTypeEkadashi          = types.TableTypeEkadashi
	TableTypeMajor             = types.TableTypeMajor
	TableTypeMinor             = types.TableTypeMinor
	TableTypePradosha          = types.TableTypePradosha
	TableTypeSankranti         = types.TableTypeSankranti
	TableTypeSmartaEkadashi    = types.TableTypeSmartaEkadashi
	TableTypeVaishnavaEkadashi = types.TableTypeVaishnavaEkadashi
)

// Resolution helpers for the shared option types. They are package-level
// functions rather than methods so that they stay unexported: the types they
// act on live in the shared types package, where an unexported method would
// be unreachable from here.
func convertPanchangOptions(o types.ConvertOptions) types.PanchangOptions {
	return types.PanchangOptions{
		InstantPanchangOptions: types.InstantPanchangOptions{
			Ayanamsa:   o.Ayanamsa,
			Language:   o.Language,
			MasaSystem: o.MasaSystem,
		},
		Timezone: o.Timezone,
	}
}

func convertResolvedAyanamsa(o types.ConvertOptions) types.AyanamsaType {
	if o.Ayanamsa == "" {
		return types.Lahiri
	}
	return o.Ayanamsa
}

func convertResolvedMasaSystem(o types.ConvertOptions) types.MasaSystem {
	if o.MasaSystem == "" {
		return types.Purnimanta
	}
	return o.MasaSystem
}

func yearlyPanchangOptions(o types.YearlyListingOptions) types.PanchangOptions {
	return types.PanchangOptions{
		InstantPanchangOptions: types.InstantPanchangOptions{
			Ayanamsa:          o.Ayanamsa,
			Language:          o.Language,
			MasaSystem:        o.MasaSystem,
			Region:            o.Region,
			RegionAliasWarner: o.RegionAliasWarner,
		},
		Timezone: o.Timezone,
	}
}

func yearlyResolvedAyanamsa(o types.YearlyListingOptions) types.AyanamsaType {
	if o.Ayanamsa == "" {
		return types.Lahiri
	}
	return o.Ayanamsa
}

func yearlyResolvedLanguage(o types.YearlyListingOptions) types.Language {
	if o.Language == "" {
		return types.LanguageEn
	}
	return o.Language
}
