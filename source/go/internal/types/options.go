package types

type AyanamsaType string

const (
	Lahiri        AyanamsaType = "lahiri"
	Raman         AyanamsaType = "raman"
	Krishnamurti  AyanamsaType = "krishnamurti"
	TrueChitra    AyanamsaType = "true-chitra"
	Thirukanitham AyanamsaType = "thirukanitham"
)

var AllAyanamsaTypes = []AyanamsaType{Lahiri, Raman, Krishnamurti, TrueChitra, Thirukanitham}

type Language string

const (
	LanguageEn Language = "en"
	LanguageHi Language = "hi"
)

var AllLanguages = []Language{LanguageEn, LanguageHi}

// Amanta months end at the new moon, Purnimanta at the full moon, so in Krishna Paksha the Purnimanta name runs one month ahead.
type MasaSystem string

const (
	Purnimanta MasaSystem = "purnimanta"
	Amanta     MasaSystem = "amanta"
)

var AllMasaSystems = []MasaSystem{Purnimanta, Amanta}

type FestivalRegion string

const (
	RegionAll             FestivalRegion = "all"
	RegionTamilNadu       FestivalRegion = "tamil-nadu"
	RegionKerala          FestivalRegion = "kerala"
	RegionKarnataka       FestivalRegion = "karnataka"
	RegionAndhraPradesh   FestivalRegion = "andhra-pradesh"
	RegionTelangana       FestivalRegion = "telangana"
	RegionWestBengal      FestivalRegion = "west-bengal"
	RegionOdisha          FestivalRegion = "odisha"
	RegionAssam           FestivalRegion = "assam"
	RegionBihar           FestivalRegion = "bihar"
	RegionJharkhand       FestivalRegion = "jharkhand"
	RegionGujarat         FestivalRegion = "gujarat"
	RegionMaharashtra     FestivalRegion = "maharashtra"
	RegionGoa             FestivalRegion = "goa"
	RegionRajasthan       FestivalRegion = "rajasthan"
	RegionPunjab          FestivalRegion = "punjab"
	RegionHaryana         FestivalRegion = "haryana"
	RegionHimachalPradesh FestivalRegion = "himachal-pradesh"
	RegionUttarakhand     FestivalRegion = "uttarakhand"
	RegionUttarPradesh    FestivalRegion = "uttar-pradesh"
	RegionMadhyaPradesh   FestivalRegion = "madhya-pradesh"
	RegionNepal           FestivalRegion = "nepal"
)

var AllFestivalRegions = []FestivalRegion{
	RegionAll,
	RegionTamilNadu, RegionKerala, RegionKarnataka, RegionAndhraPradesh, RegionTelangana,
	RegionWestBengal, RegionOdisha, RegionAssam, RegionBihar, RegionJharkhand,
	RegionGujarat, RegionMaharashtra, RegionGoa, RegionRajasthan,
	RegionPunjab, RegionHaryana, RegionHimachalPradesh, RegionUttarakhand,
	RegionUttarPradesh, RegionMadhyaPradesh,
	RegionNepal,
}

// Deprecated: use the equivalent [FestivalRegion]. Removal in v6.
const (
	LegacyRegionTamil      FestivalRegion = "tamil"
	LegacyRegionBengal     FestivalRegion = "bengal"
	LegacyRegionNorthIndia FestivalRegion = "north-india"
)

var AllLegacyFestivalRegions = []FestivalRegion{
	LegacyRegionTamil, LegacyRegionBengal, LegacyRegionNorthIndia,
}
