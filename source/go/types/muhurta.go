package types

// BuildMuhurtaTableOptions configures BuildMuhurtaTable, which scores every
// day of the years StartYear to EndYear inclusive against Rule at Location
// and packs the result into a [MuhurtaFile]. It carries no JSON tags. Rule
// and Location are required; an empty Ayanamsa, MasaSystem or Language falls
// back to [Lahiri], [Purnimanta] and [LanguageEn].
type BuildMuhurtaTableOptions struct {
	// Rule is the occasion to score. Its Occasion must be non-empty, else
	// BuildMuhurtaTable reports ErrInvalidInput; a non-empty Name becomes
	// MuhurtaTableMeta.OccasionName.
	Rule MuhurtaRule
	// Location is the place every day is scored for, validated the same way
	// the daily panchang validates its location.
	Location GeoLocation
	// TimezoneOffsetMinutes is a fixed UTC offset in minutes east of UTC
	// (330 for IST) that bounds each year and keys each day's Date. It must
	// lie in -720 to 840, else the build reports ErrInvalidTimezone.
	TimezoneOffsetMinutes int
	// StartYear is the first calendar year scored, inclusive.
	StartYear int
	// EndYear is the last calendar year scored, inclusive; a value below
	// StartYear reports ErrInvalidInput.
	EndYear int
	// IncludeFailures keeps days that fail the rule; when false only passing
	// days are stored.
	IncludeFailures bool
	// Ayanamsa selects the sidereal zero point; empty means Lahiri.
	Ayanamsa AyanamsaType
	// MasaSystem selects the lunar month reckoning; empty means
	// Purnimanta.
	MasaSystem MasaSystem
	// Language is passed to the scorer; empty means LanguageEn. The packed
	// table stores no localized text, so it does not change the output.
	Language Language
	// ReferenceLocation is a free-text label for Location, copied into
	// MuhurtaTableMeta.ReferenceLocation; empty by default.
	ReferenceLocation string
	// GeneratedAt is copied verbatim into MuhurtaTableMeta.GeneratedAt and
	// is not validated; the TypeScript builder documents it as an ISO
	// timestamp.
	GeneratedAt string
	// Note replaces the library's standard note in MuhurtaTableMeta.Note
	// when non-nil; nil selects the standard text.
	Note *string
}

// BhadraMode says how a [MuhurtaRule] treats a day on which Bhadra (Vishti
// karana) is active anywhere between sunrise and the next sunrise. The
// values are the strings ignore, penalize and exclude.
type BhadraMode string

const (
	// BhadraIgnore leaves the score untouched; the default when
	// MuhurtaRule.Bhadra is nil and ExcludeBhadra is false.
	BhadraIgnore BhadraMode = "ignore"
	// BhadraPenalize subtracts 15 with a bhadra factor on AxisKarana; the
	// thirteen stock rules use it.
	BhadraPenalize BhadraMode = "penalize"
	// BhadraExclude zeroes the day with a bhadra factor on AxisExclusion.
	BhadraExclude BhadraMode = "exclude"
)

// MuhurtaRule is the plain data a muhurta score is computed against: which
// angas at sunrise help or hurt, and which conditions veto the day. It
// carries no JSON tags. A day starts at 50; a listed auspicious index adds
// 10, an inauspicious one subtracts 15, and any exclusion sets the score to
// 0. Index bases: tithi 0 to 29 (0 = Shukla Pratipada, 14 = Purnima, 15 =
// Krishna Pratipada, 29 = Amavasya), nakshatra 0 to 26 (0 = Ashwini), vara 0
// to 6 (0 = Sunday), yoga 0 to 26 (0 = Vishkambha). Thirteen stock rules
// ship with the engine, VivahRule among them.
type MuhurtaRule struct {
	// Occasion identifies the rule, such as vivah. BuildMuhurtaTable
	// requires it non-empty and stamps it into MuhurtaTableMeta.Occasion.
	Occasion string
	// Name is an optional display label such as Vivah (wedding); when set it
	// becomes MuhurtaTableMeta.OccasionName.
	Name string

	// AuspiciousTithis lists tithi indices (0 to 29) that add 10 when the
	// tithi at sunrise is one of them.
	AuspiciousTithis []int
	// InauspiciousTithis lists tithi indices (0 to 29) that subtract 15 when
	// the tithi at sunrise is one of them and AuspiciousTithis did not
	// match.
	InauspiciousTithis []int
	// AuspiciousNakshatras lists nakshatra indices (0 = Ashwini to 26 =
	// Revati) that add 10 when the nakshatra at sunrise is one of them.
	AuspiciousNakshatras []int
	// InauspiciousNakshatras lists nakshatra indices (0 to 26) that subtract
	// 15 when the nakshatra at sunrise is one of them and the auspicious
	// list did not match.
	InauspiciousNakshatras []int
	// AuspiciousVaras lists vara indices (0 = Sunday to 6 = Saturday) that
	// add 10 when the day's vara is one of them.
	AuspiciousVaras []int
	// InauspiciousVaras lists vara indices (0 to 6) that subtract 15 when
	// the day's vara is one of them and AuspiciousVaras did not match.
	InauspiciousVaras []int
	// AuspiciousYogas lists yoga indices (0 = Vishkambha to 26) that add 10
	// when the yoga at sunrise is one of them.
	AuspiciousYogas []int
	// InauspiciousYogas lists yoga indices (0 to 26) that subtract 15 when
	// the yoga at sunrise is one of them and AuspiciousYogas did not match.
	InauspiciousYogas []int

	// Bhadra selects the BhadraMode. Nil falls back to ExcludeBhadra, so
	// nil with ExcludeBhadra false means BhadraIgnore; the stock rules set
	// BhadraPenalize.
	Bhadra *BhadraMode
	// ExcludeBhadra is the older spelling of Bhadra set to BhadraExclude;
	// it is read only when Bhadra is nil.
	ExcludeBhadra bool
	// ExcludeEkadashi zeroes a day whose tithi at sunrise is index 10 or 25
	// (Shukla or Krishna Ekadashi); factor code ekadashi.
	ExcludeEkadashi bool
	// RequirePaksha, when non-empty, zeroes a day whose tithi at sunrise
	// lies in the other fortnight: indices 0 to 14 are PakshaShukla, 15 to
	// 29 PakshaKrishna. Factor code paksha.
	RequirePaksha Paksha
	// ExcludeAdhikaMasa zeroes a day in an intercalary lunar month, read
	// from the daily panchang's Calendar.Chandramasa.IsAdhika; factor code
	// adhika_masa.
	ExcludeAdhikaMasa bool
	// ExcludeEclipse zeroes a day whose daily panchang Eclipse is non-nil;
	// factor code eclipse.
	ExcludeEclipse bool
	// ExcludeGandaMula zeroes a day whose nakshatra at sunrise is a Ganda
	// Mula one (Inauspicious.GandaMula.Active); factor code ganda_mula.
	ExcludeGandaMula bool
	// ExcludePanchaka zeroes a day whose Panchaka is active and carries a
	// dosha (PanchakaInfo.Active and IsDosha); a Wednesday or Thursday onset
	// is samanya and has none. Factor code panchaka.
	ExcludePanchaka bool
	// VaraTithiYogas scores the vara and tithi combination yogas from
	// ComputeVaraTithiYogas at +10 or -15 each; nil means true.
	VaraTithiYogas *bool
}

// MuhurtaScore is one day's verdict against a [MuhurtaRule], returned by
// ScoreMuhurta and embedded in every [MuhurtaDay]. It marshals to JSON.
type MuhurtaScore struct {
	// Date is the instant the caller passed in, unchanged, as a JSDate
	// (epoch milliseconds, marshalled as an ISO 8601 UTC string).
	Date JSDate `json:"date"`
	// Score is 0 to 100: it starts at 50, moves by the Factors deltas and is
	// clamped; it is 0 whenever an exclusion fired.
	Score int `json:"score"`
	// Passes is true when Score is 50 or more, which no excluded day
	// reaches.
	Passes bool `json:"passes"`
	// Reasons are English diagnostics, one per factor, in no stable format
	// and not localized; branch on Factors instead.
	Reasons []string `json:"reasons"`
	// Factors lists every input to the score with a stable code, in the
	// order applied; a zeroed day has exactly one factor, on
	// AxisExclusion.
	Factors []MuhurtaFactor `json:"factors"`
}

// MuhurtaDay is a scored day as ComputeAuspiciousDatesInRange and
// ComputeAuspiciousDatesForYear return it: the [MuhurtaScore] fields plus
// the day's whole panchang. The score fields marshal at the top level beside
// panchang.
type MuhurtaDay struct {
	MuhurtaScore
	// Panchang is the full daily panchang the score was read from, computed
	// with every optional section.
	Panchang DailyPanchangResult `json:"panchang"`
}

// MuhurtaScoreOptions configures ScoreMuhurta, ComputeAuspiciousDatesInRange
// and ComputeAuspiciousDatesForYear. It carries no JSON tags. Timezone is
// required; the other fields take the daily panchang defaults.
type MuhurtaScoreOptions struct {
	// Timezone fixes the local calendar day and, for the year form, the year
	// boundaries. It is required: an unset value reports
	// ErrInvalidTimezone.
	Timezone Timezone
	// Ayanamsa selects the sidereal zero point; empty means Lahiri.
	Ayanamsa AyanamsaType
	// Language localizes names in the MuhurtaDay panchang; empty means
	// LanguageEn. MuhurtaScore.Reasons stay English either way.
	Language Language
	// MasaSystem selects the lunar month reckoning; empty means
	// Purnimanta.
	MasaSystem MasaSystem
	// IncludeFailures keeps days with Passes false in the range and year
	// results; ScoreMuhurta ignores it.
	IncludeFailures bool
}

// MuhurtaFactorAxis names which part of the day a [MuhurtaFactor] came from.
// The values are the eight strings below.
type MuhurtaFactorAxis string

const (
	// AxisTithi is a tithi list match; the factor carries the tithi index.
	AxisTithi MuhurtaFactorAxis = "tithi"
	// AxisNakshatra is a nakshatra list match; the factor carries the index.
	AxisNakshatra MuhurtaFactorAxis = "nakshatra"
	// AxisVara is a vara list match; the factor carries the vara index.
	AxisVara MuhurtaFactorAxis = "vara"
	// AxisKarana carries only the Bhadra penalty (code bhadra, delta -15).
	AxisKarana MuhurtaFactorAxis = "karana"
	// AxisYoga is a yoga list match; the factor carries the yoga index.
	AxisYoga MuhurtaFactorAxis = "yoga"
	// AxisSpecialYoga is a day-level special yoga: +5 for Amrit Siddhi,
	// Sarvartha Siddhi, Ravi Pushya or Guru Pushya, -10 for Jwalamukhi.
	AxisSpecialYoga MuhurtaFactorAxis = "specialYoga"
	// AxisVaraTithiYoga is a vara and tithi combination yoga, code
	// vara_tithi_ followed by the VaraTithiYogaType.
	AxisVaraTithiYoga MuhurtaFactorAxis = "varaTithiYoga"
	// AxisExclusion means the day was zeroed; Delta is 0 and Code says why:
	// no_sunrise, bhadra, ekadashi, eclipse, adhika_masa, ganda_mula,
	// panchaka or paksha.
	AxisExclusion MuhurtaFactorAxis = "exclusion"
)

// MuhurtaFactor is one input to a [MuhurtaScore], the data form of a Reasons
// line, with a code that is stable across releases and languages. It
// marshals to JSON.
type MuhurtaFactor struct {
	// Code names the factor: auspicious_ or inauspicious_ plus tithi,
	// nakshatra, vara or yoga; vara_tithi_ plus the yoga type; bhadra; a
	// special yoga type; or an exclusion code.
	Code string `json:"code"`
	// Axis is the MuhurtaFactorAxis the factor belongs to.
	Axis MuhurtaFactorAxis `json:"axis"`
	// Index is the matched anga index for the tithi, nakshatra, vara and
	// yoga axes, in the MuhurtaRule bases, and nil for every other axis,
	// where the JSON key is omitted.
	Index *int `json:"index,omitempty"`
	// Delta is the points contributed: +10, -15, +5 or -10, and 0 for an
	// exclusion.
	Delta int `json:"delta"`
}

// PackedMuhurtaTableDay is one scored day as it sits in a [MuhurtaFile]:
// keys terse and factors interned as indices into the file's Dict.
type PackedMuhurtaTableDay struct {
	// Date is the local calendar date, YYYY-MM-DD, at the table's
	// TimezoneOffsetMinutes.
	Date string `json:"date"`
	// S is the score, 0 to 100.
	S int `json:"s"`
	// P is 1 when the day passes the rule and 0 otherwise.
	P int `json:"p"`
	// F holds indices into the Dict field of MuhurtaFile, one per factor.
	F []int `json:"f"`
}

// MuhurtaTableMeta describes how a [MuhurtaFile] was built. It marshals
// under the _meta key.
type MuhurtaTableMeta struct {
	// Format is the file layout version; the builder writes 2.
	Format int `json:"format"`
	// Occasion is the rule's Occasion.
	Occasion string `json:"occasion"`
	// ReferenceLocation is the label given at build time, empty if none.
	ReferenceLocation string `json:"referenceLocation"`
	// Latitude is the scored location's latitude in degrees.
	Latitude float64 `json:"latitude"`
	// Longitude is the scored location's longitude in degrees.
	Longitude float64 `json:"longitude"`
	// TimezoneOffsetMinutes is the fixed offset, minutes east of UTC, that
	// every Date key and year boundary was reckoned at.
	TimezoneOffsetMinutes int `json:"timezoneOffsetMinutes"`
	// Ayanamsa is the AyanamsaType used, after the Lahiri default.
	Ayanamsa string `json:"ayanamsa"`
	// MasaSystem is the MasaSystem used, after the Purnimanta default.
	MasaSystem string `json:"masaSystem"`
	// StartYear is the first year stored, inclusive.
	StartYear int `json:"startYear"`
	// EndYear is the last year stored, inclusive.
	EndYear int `json:"endYear"`
	// IncludeFailures is false when only passing days were stored.
	IncludeFailures bool `json:"includeFailures"`
	// GeneratedAt is the build-time string given, empty if none.
	GeneratedAt string `json:"generatedAt"`
	// Note is the caller's note, or the library's standard text.
	Note string `json:"note"`
	// OccasionName is the rule's Name; omitted from JSON when empty.
	OccasionName string `json:"occasionName,omitempty"`
}

// MuhurtaFile is a pre-computed muhurta table for one rule at one location,
// as BuildMuhurtaTable returns it and as the JSON file is laid out. The
// shape is shared with the TypeScript panchang-ts/muhurta readers, so a
// table either language writes reads back in the other. In Go,
// ReadMuhurtaForYear, ReadBestMuhurtaDays and the other Read functions of the
// panchang package read it.
type MuhurtaFile struct {
	// Meta is the build description, under _meta.
	Meta MuhurtaTableMeta `json:"_meta"`
	// Dict is the interned factor table, under _dict; a day's F values index
	// into it.
	Dict []MuhurtaFactor `json:"_dict"`
	// Years maps each calendar year as a decimal string (2026) to its days
	// in ascending Date order.
	Years map[string][]PackedMuhurtaTableDay `json:"years"`
}

// MuhurtaTableDay is one scored day of a [MuhurtaFile] as the muhurta table
// readers of the panchang package return it: a [PackedMuhurtaTableDay] with
// its factor indices resolved against the file's Dict. Result struct with
// JSON tags.
type MuhurtaTableDay struct {
	// Date is the local calendar date, YYYY-MM-DD, at the table's
	// TimezoneOffsetMinutes.
	Date string `json:"date"`
	// Score is the day's score, 0 to 100.
	Score int `json:"score"`
	// Passes is true when the packed P flag is 1.
	Passes bool `json:"passes"`
	// Factors holds the Dict rows the day's F indices name, in order, never
	// nil. An index outside Dict is skipped.
	Factors []MuhurtaFactor `json:"factors"`
}

// VaraTithiYogaType names one of the seven classical vara and tithi
// combination yogas ComputeVaraTithiYogas reports. The values are the
// lowercase names below.
type VaraTithiYogaType string

const (
	// YogaSiddha is auspicious.
	YogaSiddha VaraTithiYogaType = "siddha"
	// YogaAmrita is auspicious.
	YogaAmrita VaraTithiYogaType = "amrita"
	// YogaDagdha is inauspicious.
	YogaDagdha VaraTithiYogaType = "dagdha"
	// YogaVisha is inauspicious.
	YogaVisha VaraTithiYogaType = "visha"
	// YogaHutasana is inauspicious.
	YogaHutasana VaraTithiYogaType = "hutasana"
	// YogaKrakacha is inauspicious.
	YogaKrakacha VaraTithiYogaType = "krakacha"
	// YogaSamvartaka is inauspicious.
	YogaSamvartaka VaraTithiYogaType = "samvartaka"
)

// YogaPolarity says whether a [VaraTithiYoga] helps or hurts; the muhurta
// scorer adds 10 for auspicious and subtracts 15 for inauspicious.
type YogaPolarity string

const (
	// PolarityAuspicious marks Siddha and Amrita.
	PolarityAuspicious YogaPolarity = "auspicious"
	// PolarityInauspicious marks Dagdha, Visha, Hutasana, Krakacha and
	// Samvartaka.
	PolarityInauspicious YogaPolarity = "inauspicious"
)

// VaraTithiYoga is one combination yoga firing for a vara (0 = Sunday) and
// tithi pair, from ComputeVaraTithiYogas. The tithi is taken by number,
// index mod 15 plus 1, so both pakshas match alike. One pair can fire
// several yogas, the auspicious ones listed first. It marshals to JSON.
type VaraTithiYoga struct {
	// Type is the yoga.
	Type VaraTithiYogaType `json:"type"`
	// Polarity is auspicious for Siddha and Amrita, inauspicious otherwise.
	Polarity YogaPolarity `json:"polarity"`
}
