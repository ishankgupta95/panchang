package types

// AyanamsaType selects the sidereal zero point. The ayanamsa is a precession
// offset in degrees subtracted from a tropical longitude to give the
// sidereal one. All five share the IAU precession rate and differ from
// [Lahiri] by a fixed offset. An empty option value resolves to [Lahiri];
// any other unknown value is an ErrInvalidAyanamsa error.
type AyanamsaType string

const (
	// Lahiri is 23.863801 degrees at J2000 plus IAU general precession; the
	// default.
	Lahiri AyanamsaType = "lahiri"
	// Raman is Lahiri minus 1.453010 degrees.
	Raman AyanamsaType = "raman"
	// Krishnamurti is the KP ayanamsa, Lahiri minus 0.079605 degrees.
	Krishnamurti AyanamsaType = "krishnamurti"
	// TrueChitra is True Chitrapaksha, Lahiri minus 0.0006 degrees.
	TrueChitra AyanamsaType = "true-chitra"
	// Thirukanitham is Lahiri plus 0.018456 degrees.
	Thirukanitham AyanamsaType = "thirukanitham"
)

// AllAyanamsaTypes lists the five AyanamsaType values in declaration order:
// Lahiri, Raman, Krishnamurti, TrueChitra, Thirukanitham.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllAyanamsaTypes = []AyanamsaType{Lahiri, Raman, Krishnamurti, TrueChitra, Thirukanitham}

// Language selects the language of every user-facing string in a result. An
// empty option value resolves to [LanguageEn], and a value with no
// translation table also renders as English.
type Language string

const (
	// LanguageEn is English, the default.
	LanguageEn Language = "en"
	// LanguageHi is Hindi.
	LanguageHi Language = "hi"
)

// AllLanguages lists LanguageEn then LanguageHi.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllLanguages = []Language{LanguageEn, LanguageHi}

// MasaSystem selects the lunar month convention that fills the Index and
// Name of a [ChandraMasaInfo]; both the amanta and the purnimanta index are
// always computed and carried alongside. An empty option value resolves to
// [Purnimanta].
type MasaSystem string

const (
	// Purnimanta ends the masa at the full moon: in Krishna paksha the month
	// is one ahead of the amanta one, except in an adhika masa.
	Purnimanta MasaSystem = "purnimanta"
	// Amanta ends the masa at the new moon: the month index is the sidereal
	// rashi of the Sun at the preceding new moon plus one, so a new moon
	// with the Sun in Meena opens Chaitra.
	Amanta MasaSystem = "amanta"
)

// AllMasaSystems lists Purnimanta then Amanta.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllMasaSystems = []MasaSystem{Purnimanta, Amanta}

// FestivalRegion narrows the festivals a result reports. [RegionAll], which
// an empty option value resolves to, applies no filter; any other value
// keeps the festivals tagged for that region plus those tagged for every
// region. The region also picks the civil day a Mesha Sankranti new year
// falls on (Tamil Nadu, Kerala, Punjab, West Bengal, Assam, Odisha). The
// three Legacy values are still accepted and resolve to current ones, see
// [AllLegacyFestivalRegions].
type FestivalRegion string

const (
	// RegionAll applies no regional filter: every festival is reported.
	RegionAll FestivalRegion = "all"
	// RegionTamilNadu selects the Tamil Nadu festival set.
	RegionTamilNadu FestivalRegion = "tamil-nadu"
	// RegionKerala selects the Kerala festival set.
	RegionKerala FestivalRegion = "kerala"
	// RegionKarnataka selects the Karnataka festival set.
	RegionKarnataka FestivalRegion = "karnataka"
	// RegionAndhraPradesh selects the Andhra Pradesh festival set.
	RegionAndhraPradesh FestivalRegion = "andhra-pradesh"
	// RegionTelangana selects the Telangana festival set.
	RegionTelangana FestivalRegion = "telangana"
	// RegionWestBengal selects the West Bengal festival set.
	RegionWestBengal FestivalRegion = "west-bengal"
	// RegionOdisha selects the Odisha festival set.
	RegionOdisha FestivalRegion = "odisha"
	// RegionAssam selects the Assam festival set.
	RegionAssam FestivalRegion = "assam"
	// RegionBihar selects the Bihar festival set.
	RegionBihar FestivalRegion = "bihar"
	// RegionJharkhand selects the Jharkhand festival set.
	RegionJharkhand FestivalRegion = "jharkhand"
	// RegionGujarat selects the Gujarat festival set.
	RegionGujarat FestivalRegion = "gujarat"
	// RegionMaharashtra selects the Maharashtra festival set.
	RegionMaharashtra FestivalRegion = "maharashtra"
	// RegionGoa selects the Goa festival set.
	RegionGoa FestivalRegion = "goa"
	// RegionRajasthan selects the Rajasthan festival set.
	RegionRajasthan FestivalRegion = "rajasthan"
	// RegionPunjab selects the Punjab festival set.
	RegionPunjab FestivalRegion = "punjab"
	// RegionHaryana selects the Haryana festival set.
	RegionHaryana FestivalRegion = "haryana"
	// RegionHimachalPradesh selects the Himachal Pradesh festival set.
	RegionHimachalPradesh FestivalRegion = "himachal-pradesh"
	// RegionUttarakhand selects the Uttarakhand festival set.
	RegionUttarakhand FestivalRegion = "uttarakhand"
	// RegionUttarPradesh selects the Uttar Pradesh festival set.
	RegionUttarPradesh FestivalRegion = "uttar-pradesh"
	// RegionMadhyaPradesh selects the Madhya Pradesh festival set.
	RegionMadhyaPradesh FestivalRegion = "madhya-pradesh"
	// RegionNepal selects the Nepal festival set.
	RegionNepal FestivalRegion = "nepal"
)

// AllFestivalRegions lists every current FestivalRegion in declaration
// order: RegionAll, the twenty Indian states from RegionTamilNadu to
// RegionMadhyaPradesh, then RegionNepal. The deprecated aliases in
// AllLegacyFestivalRegions are not included.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllFestivalRegions = []FestivalRegion{
	RegionAll,
	RegionTamilNadu, RegionKerala, RegionKarnataka, RegionAndhraPradesh, RegionTelangana,
	RegionWestBengal, RegionOdisha, RegionAssam, RegionBihar, RegionJharkhand,
	RegionGujarat, RegionMaharashtra, RegionGoa, RegionRajasthan,
	RegionPunjab, RegionHaryana, RegionHimachalPradesh, RegionUttarakhand,
	RegionUttarPradesh, RegionMadhyaPradesh,
	RegionNepal,
}

const (
	// LegacyRegionTamil is deprecated; it resolves to RegionTamilNadu.
	LegacyRegionTamil FestivalRegion = "tamil"
	// LegacyRegionBengal is deprecated; it resolves to RegionWestBengal.
	LegacyRegionBengal FestivalRegion = "bengal"
	// LegacyRegionNorthIndia is deprecated; it resolves to RegionAll.
	LegacyRegionNorthIndia FestivalRegion = "north-india"
)

// AllLegacyFestivalRegions lists the three deprecated FestivalRegion values,
// LegacyRegionTamil, LegacyRegionBengal and LegacyRegionNorthIndia. Each is
// accepted as input and resolved to its current value, with a one-time
// deprecation warning when a warner is configured.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllLegacyFestivalRegions = []FestivalRegion{
	LegacyRegionTamil, LegacyRegionBengal, LegacyRegionNorthIndia,
}
