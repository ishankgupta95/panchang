package types

// LongitudeAt returns a sidereal ecliptic longitude in degrees, 0 to 360, at
// an instant given as UTC epoch milliseconds. The engine hands its cached
// Moon and Sun longitudes to the window searches in this form, and
// ComputeAmritKalaWindows, ComputePanchakaRahita, ComputeVarjyamWindows and
// FindPanchakaOnset take one from the caller.
type LongitudeAt func(ms int64) float64

// NatalResolvers supplies the Chandra Balam and Tarabala calculators the
// daily and instant panchang call when [InstantPanchangOptions.JanmaRashi]
// or JanmaNakshatra is set. A Session fills both from the jyotish package; a
// nil resolver whose option is set makes the panchang return an error. It
// cannot be marshalled to JSON (func fields).
type NatalResolvers struct {
	// ChandraBalam takes the janma rashi and the transit Moon rashi, both 0
	// = Mesha to 11 = Meena (the Moon's rashi at sunrise, or at the
	// instant), and the language for names.
	ChandraBalam func(janmaRashiIndex, transitMoonRashiIndex int, lang Language) (ChandraBalamInfo, error)
	// Tarabala takes the janma nakshatra and the transit Moon nakshatra,
	// both 0 = Ashwini to 26 = Revati, and the language for names.
	Tarabala func(janmaNakshatraIndex, transitNakshatraIndex int, lang Language) (TarabalaInfo, error)
}

// Reference names the frame a location came from: one of the two fixed
// reference points, or a place the caller supplied. ResolveLocation reports
// it beside the location it picked.
type Reference string

const (
	// ReferenceTraditional is Ujjain, 23.1765 N 75.7885 E.
	ReferenceTraditional Reference = "traditional"
	// ReferenceModern is the Central Station, 23.1833 N 82.5 E, on the
	// meridian that defines IST.
	ReferenceModern Reference = "modern"
	// ReferencePractical marks a location the caller supplied. It is output
	// only: ReferenceLocation reports ErrInvalidInput for it.
	ReferencePractical Reference = "practical"
)

// ISTTimezone is the IANA zone name of both reference points.
const ISTTimezone = "Asia/Kolkata"

// ISTOffsetMinutes is the IST offset, 330 minutes (+05:30) east of UTC: the
// local mean time of the 82.5 E meridian, and the civil offset at Ujjain.
const ISTOffsetMinutes = 330

// InstantPanchangOptions configures the instant panchang GetInstantPanchang
// returns, and is embedded in [PanchangOptions] for the daily one. Every
// field has a default, so the zero value is usable. It carries no JSON tags
// and cannot be marshalled, since RegionAliasWarner is a func.
type InstantPanchangOptions struct {
	// Ayanamsa selects the sidereal zero point; empty means Lahiri.
	Ayanamsa AyanamsaType
	// Language localizes the names in the result; empty means LanguageEn.
	Language Language
	// ComputeEndTimes solves the anga transition times; nil means true. When
	// false the instant result's EndTime fields stay nil and each daily anga
	// list holds only the element current at sunrise, with no times given.
	// The daily SpecialYogas are unaffected: they still cover every tithi
	// and nakshatra of the day.
	ComputeEndTimes *bool
	// MasaSystem selects purnimanta or amanta lunar months; empty means
	// Purnimanta.
	MasaSystem MasaSystem
	// JanmaRashi is the natal Moon rashi, 0 = Mesha to 11 = Meena; nil
	// leaves the result's ChandraBalam nil, and a value outside that range
	// reports ErrInvalidInput.
	JanmaRashi *int
	// JanmaNakshatra is the natal Moon nakshatra, 0 = Ashwini to 26 =
	// Revati; nil leaves the result's Tarabala nil.
	JanmaNakshatra *int
	// Region scopes regional festival variants; empty means RegionAll. The
	// legacy values LegacyRegionTamil, LegacyRegionBengal and
	// LegacyRegionNorthIndia map to tamil-nadu, west-bengal and all.
	Region FestivalRegion
	// RegionAliasWarner is called once per process for each legacy Region
	// value seen; nil means no warning.
	RegionAliasWarner RegionAliasWarner
}

// PanchangSection names an optional block of the daily panchang that a
// [SectionSet] can switch off. A skipped section leaves its own fields nil
// or empty, with the couplings each constant states: festivals also fills
// Moon.Rise and Bhadra, and eclipse adds its entry to Festivals.
type PanchangSection string

const (
	// SectionFestivals fills Festivals; off, the list holds only the eclipse
	// entry the eclipse section may add.
	SectionFestivals PanchangSection = "festivals"
	// SectionEclipse fills Eclipse and its festival entry; off, Eclipse is
	// nil.
	SectionEclipse PanchangSection = "eclipse"
	// SectionMoonTimes fills Moon.Set, nil when off. Moon.Rise is also found
	// for festivals, so it is nil only when both sections are off.
	SectionMoonTimes PanchangSection = "moonTimes"
	// SectionLunarWindows fills Varjyam and PanchakaRahita, empty when off,
	// and Bhadra, which festivals also need; Bhadra is nil when both
	// sections are off.
	SectionLunarWindows PanchangSection = "lunarWindows"
)

// SectionSet selects which optional sections the daily panchang computes.
// All true selects every section whatever Set holds; otherwise only the
// sections mapped to true in Set are computed, so the zero value selects
// none. It applies only when [PanchangOptions.SectionsGiven] is true;
// AllSections, NoSections and Sections build one.
type SectionSet struct {
	// All selects every section when true, whatever Set holds.
	All bool
	// Set holds the sections to compute when All is false; a missing or
	// false entry is off.
	Set map[PanchangSection]bool
}

// Wants reports whether section is selected: true when All is set, otherwise
// the value in Set for that key, false when absent.
func (s SectionSet) Wants(section PanchangSection) bool {
	return s.All || s.Set[section]
}

// PanchangOptions configures the daily panchang GetDailyPanchang returns.
// Only Timezone and the section fields are its own; everything else comes
// from the embedded [InstantPanchangOptions]. It carries no JSON tags.
type PanchangOptions struct {
	InstantPanchangOptions
	// Timezone is required: it fixes the local calendar day the date falls
	// in and renders the *Local strings. An unset value or an offset outside
	// -720 to 840 reports ErrInvalidTimezone; a zone name the host cannot
	// resolve reports ErrTimezoneResolutionFailed.
	Timezone Timezone
	// Sections is the SectionSet to compute, read only when SectionsGiven
	// is true.
	Sections SectionSet
	// SectionsGiven makes Sections take effect; false, the default, computes
	// every section whatever Sections holds.
	SectionsGiven bool
}

// RegionAliasWarner receives the deprecation message for a legacy
// [FestivalRegion] value. It is called at most once per process for each
// such value, from the first panchang that resolves it.
type RegionAliasWarner func(message string)
