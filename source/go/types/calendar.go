package types

import (
	"bytes"
	"encoding/json"
	"errors"
)

// BuildEclipsesTableOptions configures the eclipse table the session method
// BuildEclipsesTable precomputes for StartYear to EndYear inclusive at one
// location. Option struct: no JSON tags. StartYear above EndYear or an empty
// non-nil Languages is an [ErrInvalidInput] error.
type BuildEclipsesTableOptions struct {
	// Location is the reference observer, degrees north and east, used for
	// the local solar circumstances and for visibility. Latitude and
	// Longitude are copied into the meta; Elevation is not.
	Location GeoLocation
	// TimezoneOffsetMinutes is minutes east of UTC (330 for IST). It only
	// decides which local date each eclipse's peak is filed under, and is
	// recorded in the meta.
	TimezoneOffsetMinutes int
	// StartYear is the first Gregorian year included. The scan overhangs the
	// range by two days at each end, so 1901 is the earliest year accepted.
	StartYear int
	// EndYear is the last Gregorian year included, at or after StartYear;
	// 2099 is the latest year accepted because of the two day overhang.
	EndYear int
	// Languages lists the table languages in emission order. nil means
	// TableLangEn then TableLangHi; an empty non-nil slice is an error.
	Languages []FestivalsTableLanguage
	// VisibleOnly nil or true keeps only eclipses observable from Location
	// during some phase; false also lists eclipses that never rise there,
	// which carry no sutak.
	VisibleOnly *bool
	// ReferenceLocation is a free text label for Location, for example
	// "Varanasi", copied verbatim into the meta.
	ReferenceLocation string
	// GeneratedAt is copied verbatim into the meta; it is not filled in when
	// empty.
	GeneratedAt string
	// Note replaces the default explanatory note in the meta when non-nil.
	Note *string
}

// BuildFestivalsTableOptions configures the festival table the session
// method BuildFestivalsTable precomputes for StartYear to EndYear inclusive
// at one location and UTC offset. Option struct: no JSON tags, and it cannot
// be marshalled at all because of the func field. Empty string fields take
// the defaults given below.
type BuildFestivalsTableOptions struct {
	// Location is the observer, degrees north and east, at which sunrise and
	// the other day anchors are computed. Latitude and Longitude are copied
	// into the meta; Elevation is not.
	Location GeoLocation
	// TimezoneOffsetMinutes is minutes east of UTC (330 for IST): the fixed
	// offset the festivals are computed in and that each date key is written
	// in.
	TimezoneOffsetMinutes int
	// StartYear is the first Gregorian year included; years outside the
	// engine's 1900 to 2100 span are rejected.
	StartYear int
	// EndYear is the last Gregorian year included, at or after StartYear.
	EndYear int
	// Languages lists the table languages in emission order. nil means
	// TableLangEn then TableLangHi; an empty non-nil slice is an error.
	Languages []FestivalsTableLanguage
	// Ayanamsa selects the sidereal zero point; empty means Lahiri. The
	// resolved value is recorded in the meta.
	Ayanamsa AyanamsaType
	// MasaSystem picks how lunar months are counted and named; empty means
	// Purnimanta. The resolved value is recorded in the meta.
	MasaSystem MasaSystem
	// Region filters the regional festivals; empty means RegionAll. A
	// legacy alias is resolved during the computation but recorded in the
	// meta as given.
	Region FestivalRegion
	// ReferenceLocation is a free text label for Location, for example
	// "Varanasi", copied verbatim into the meta.
	ReferenceLocation string
	// GeneratedAt is copied verbatim into the meta; it is not filled in when
	// empty.
	GeneratedAt string
	// Note replaces the default explanatory note in the meta when non-nil.
	Note *string
	// RegionAliasWarner receives one deprecation message per process the
	// first time a legacy Region alias is seen; nil disables the warning.
	RegionAliasWarner RegionAliasWarner
}

// BuildMoonPhasesTableOptions configures the Moon phase table the session
// method BuildMoonPhasesTable precomputes for StartYear to EndYear
// inclusive. Phases are worldwide instants, so there is no location. Option
// struct: no JSON tags. StartYear above EndYear or an empty non-nil
// Languages is an [ErrInvalidInput] error.
type BuildMoonPhasesTableOptions struct {
	// TimezoneOffsetMinutes is minutes east of UTC (330 for IST). It only
	// decides which local date each phase instant is filed under, and is
	// recorded in the meta.
	TimezoneOffsetMinutes int
	// StartYear is the first Gregorian year included. The scan overhangs the
	// range by two days at each end, so 1901 is the earliest year accepted.
	StartYear int
	// EndYear is the last Gregorian year included, at or after StartYear;
	// 2099 is the latest year accepted because of the two day overhang.
	EndYear int
	// Languages lists the table languages in emission order. nil means
	// TableLangEn then TableLangHi; an empty non-nil slice is an error.
	Languages []FestivalsTableLanguage
	// ReferenceLocation is a free text label copied verbatim into the meta.
	ReferenceLocation string
	// GeneratedAt is copied verbatim into the meta; it is not filled in when
	// empty.
	GeneratedAt string
	// Note replaces the default explanatory note in the meta when non-nil.
	Note *string
}

// HinduCalendarCoords is the Hindu lunisolar date the session method
// ConvertGregorianToHindu returns. Every value is read at sunrise of the
// converted day, with names in [ConvertOptions].Language. Result struct with
// JSON tags.
type HinduCalendarCoords struct {
	// TithiName is the localized name of the tithi current at sunrise.
	TithiName string `json:"tithiName"`
	// Tithi is 1-based across the whole lunar month: 1 is Shukla Pratipada,
	// 15 Purnima and 30 Amavasya (the engine's 0 to 29 index plus one).
	Tithi int `json:"tithi"`
	// PakshaTithi is the tithi's 1 to 15 number within its paksha; 15 is
	// Purnima in Shukla and Amavasya in Krishna.
	PakshaTithi int `json:"pakshaTithi"`
	// Paksha is PakshaShukla for tithi indices 0 to 14 (Tithi 1 to 15) and
	// PakshaKrishna otherwise.
	Paksha Paksha `json:"paksha"`
	// MasaName is the localized lunar month name, prefixed with the
	// localized "Adhika" when IsAdhika is true.
	MasaName string `json:"masaName"`
	// MasaIndex is 0-based: 0 is Chaitra and 11 is Phalguna, counted in
	// ConvertOptions.MasaSystem (Purnimanta when unset).
	MasaIndex int `json:"masaIndex"`
	// IsAdhika is true in an intercalary (adhika) month: the Sun is in the
	// same sidereal sign at both new moons bounding the lunation.
	IsAdhika bool `json:"isAdhika"`
	// VikramSamvat is the Vikram year, which advances at the new moon that
	// begins Chaitra: Gregorian year plus 57 from then on, plus 56 before.
	VikramSamvat int `json:"vikramSamvat"`
	// ShakaSamvat is the Shaka year, advancing at the same new moon:
	// Gregorian year minus 78 from then on, minus 79 before.
	ShakaSamvat int `json:"shakaSamvat"`
	// VaraName is the localized weekday name.
	VaraName string `json:"varaName"`
	// VaraIndex is 0 for Sunday through 6 for Saturday, for the day that
	// runs from the sunrise the conversion is read at.
	VaraIndex int `json:"varaIndex"`
}

// Paksha names the lunar fortnight; its JSON is the lowercase string. It is
// the type of [HinduCalendarCoords].Paksha and [HinduDateCoords].Paksha.
type Paksha string

const (
	// PakshaShukla is the waxing fortnight: tithi 1 to 15, ending at
	// Purnima.
	PakshaShukla Paksha = "shukla"
	// PakshaKrishna is the waning fortnight: tithi 16 to 30, ending at
	// Amavasya.
	PakshaKrishna Paksha = "krishna"
)

// ConvertOptions configures the calendar conversion session methods
// ConvertGregorianToHindu, ConvertHinduToGregorian and GetHinduNewYear.
// Option struct: no JSON tags. Only Timezone is required.
type ConvertOptions struct {
	// Timezone is required: it fixes the local calendar day whose sunrise is
	// read. Unset is an ErrInvalidTimezone error and a zone name that
	// cannot be loaded is ErrTimezoneResolutionFailed.
	Timezone Timezone
	// Ayanamsa selects the sidereal zero point; empty means Lahiri.
	Ayanamsa AyanamsaType
	// MasaSystem picks how lunar months are counted and named; empty means
	// Purnimanta.
	MasaSystem MasaSystem
	// Language picks the language of the returned names; empty means
	// LanguageEn.
	Language Language
}

// HinduDateCoords is the Hindu lunisolar date the session method
// ConvertHinduToGregorian looks up. Input struct: no JSON tags. A MasaIndex,
// PakshaTithi or Paksha out of range is an [ErrInvalidInput] error.
type HinduDateCoords struct {
	// VikramSamvat is the Vikram year the date falls in; the scan is centred
	// on Gregorian year VikramSamvat minus 57 and matches only days in that
	// samvat.
	VikramSamvat int
	// MasaIndex is 0-based, 0 is Chaitra and 11 is Phalguna, counted in
	// ConvertOptions.MasaSystem; values outside 0 to 11 are rejected.
	MasaIndex int
	// Paksha must be PakshaShukla or PakshaKrishna.
	Paksha Paksha
	// PakshaTithi is the 1 to 15 tithi number within the paksha; values
	// outside that range are rejected.
	PakshaTithi int
	// AdhikaOnly restricts matches to an adhika (intercalary) month. When
	// false, adhika and regular months both match.
	AdhikaOnly bool
}

// EclipseTableKind is the eclipsed body of a table entry, the same strings
// as [EclipseKind].
type EclipseTableKind string

const (
	// EclipseTableSolar is a solar eclipse.
	EclipseTableSolar EclipseTableKind = "solar"
	// EclipseTableLunar is a lunar eclipse.
	EclipseTableLunar EclipseTableKind = "lunar"
)

// EclipseTableSubtype is the eclipse's depth as a table entry stores it, the
// same strings as [EclipseSubtype]. Solar entries carry the subtype seen
// from the reference location; lunar ones are the same worldwide.
type EclipseTableSubtype string

const (
	// EclipseTablePartial is a partial eclipse of either kind.
	EclipseTablePartial EclipseTableSubtype = "partial"
	// EclipseTableTotal is a total eclipse of either kind.
	EclipseTableTotal EclipseTableSubtype = "total"
	// EclipseTableAnnular is an annular eclipse; solar only.
	EclipseTableAnnular EclipseTableSubtype = "annular"
	// EclipseTablePenumbral is a penumbral eclipse; lunar only, and it never
	// carries a sutak.
	EclipseTablePenumbral EclipseTableSubtype = "penumbral"
)

// EclipseSutak is the sutak window of a table entry, present only on
// eclipses visible from the reference location that warrant one. Both
// instants are ISO 8601 UTC strings (YYYY-MM-DDTHH:MM:SS.mmmZ).
type EclipseSutak struct {
	// Start is 12 hours before first contact for a solar eclipse and 9 hours
	// before umbral first contact for a lunar one.
	Start string `json:"start"`
	// End is last contact for a solar eclipse and umbral last contact for a
	// lunar one, which precedes the entry's penumbral End.
	End string `json:"end"`
}

// EclipseTableEntryRaw is one eclipse as the eclipses table stores it, with
// every table language present in Name and Description. Result struct with
// JSON tags. Times are ISO 8601 UTC strings (YYYY-MM-DDTHH:MM:SS.mmmZ);
// solar contacts, subtype, obscuration and magnitude are as seen from the
// reference location.
type EclipseTableEntryRaw struct {
	// Name is "<Subtype> <Kind>" in each table language, for example
	// "Partial Solar Eclipse".
	Name LocalizedString `json:"name"`
	// Kind is solar or lunar.
	Kind EclipseTableKind `json:"kind"`
	// Subtype is the depth: as seen locally for solar, worldwide for lunar.
	Subtype EclipseTableSubtype `json:"subtype"`
	// Start is first contact: partial begin at the location for solar,
	// penumbral begin for lunar.
	Start string `json:"start"`
	// Peak is the instant of greatest eclipse; its local date at the table
	// offset is the day the entry is filed under.
	Peak string `json:"peak"`
	// End is last contact: partial end at the location for solar, penumbral
	// end for lunar.
	End string `json:"end"`
	// Obscuration is the fraction of the disc area covered at Peak, 0 to 1:
	// the Sun's disc for solar, the Moon's disc by the umbra for lunar (0
	// for penumbral).
	Obscuration float64 `json:"obscuration"`
	// Magnitude is the catalogue diameter fraction at Peak: above 1 for a
	// total eclipse, and zero or negative for a penumbral lunar one (the
	// umbral magnitude is stored, and a lunar eclipse is penumbral whenever
	// that value is not above 0).
	Magnitude float64 `json:"magnitude"`
	// VisibleFromLocation is true when the eclipsed body is above the
	// horizon at the reference location during some phase (sampled at 13
	// instants from Start to End); always true unless VisibleOnly was false.
	VisibleFromLocation bool `json:"visibleFromLocation"`
	// VisibleAtPeak is true when the eclipsed body is above the horizon at
	// Peak.
	VisibleAtPeak bool `json:"visibleAtPeak"`
	// Description is a one line summary per language giving the obscuration
	// percentage, or the no sutak note for penumbral. The builder always
	// sets it; nil only when absent from a decoded file.
	Description *LocalizedString `json:"description,omitempty"`
	// Sutak is non-nil only when VisibleFromLocation is true and Subtype is
	// not penumbral.
	Sutak *EclipseSutak `json:"sutak,omitempty"`
}

// RawEclipseTableDay is one local date of an eclipses table with its
// entries. Result struct with JSON tags.
type RawEclipseTableDay struct {
	// Date is the local calendar date, YYYY-MM-DD, at the table's
	// TimezoneOffsetMinutes.
	Date string `json:"date"`
	// Eclipses holds at least one entry, ascending by Peak.
	Eclipses []EclipseTableEntryRaw `json:"eclipses"`
}

// EclipseTableMeta is the _meta block of an [EclipsesFile]: the options the
// table was built with, after defaults were applied. Result struct with JSON
// tags.
type EclipseTableMeta struct {
	// ReferenceLocation is the label given in the build options, verbatim.
	ReferenceLocation string `json:"referenceLocation"`
	// Latitude is the reference location's latitude, degrees north.
	Latitude float64 `json:"latitude"`
	// Longitude is the reference location's longitude, degrees east.
	Longitude float64 `json:"longitude"`
	// TimezoneOffsetMinutes is the fixed offset, minutes east of UTC, that
	// the date keys are written in.
	TimezoneOffsetMinutes int `json:"timezoneOffsetMinutes"`
	// VisibleOnly is the resolved option: true when nil was given.
	VisibleOnly bool `json:"visibleOnly"`
	// Languages is the resolved list in emission order; TableLangEn then
	// TableLangHi when none was given.
	Languages []FestivalsTableLanguage `json:"languages"`
	// StartYear is the first year the table covers, inclusive.
	StartYear int `json:"startYear"`
	// EndYear is the last year the table covers, inclusive.
	EndYear int `json:"endYear"`
	// GeneratedAt is the build option verbatim, empty when it was not set.
	GeneratedAt string `json:"generatedAt"`
	// Note is the explanatory note: the caller's, or the default text
	// describing the visibility and sutak rules.
	Note string `json:"note"`
}

// EclipsesFile is the eclipses table the session method BuildEclipsesTable
// returns, in the JSON layout the TypeScript panchang-ts/eclipses reader
// consumes. Result struct with JSON tags.
type EclipsesFile struct {
	// Meta is serialised under the key _meta.
	Meta EclipseTableMeta `json:"_meta"`
	// Years is keyed by four digit year string, with a key for every year in
	// the range (an empty slice when a year has no eclipse), each holding
	// its days ascending by date.
	Years map[string][]RawEclipseTableDay `json:"years"`
}

// FestivalsTableLanguage is a language a precomputed table carries, shared
// by the festivals, eclipses and Moon phase tables; the values match
// [Language].
type FestivalsTableLanguage string

const (
	// TableLangEn is English.
	TableLangEn FestivalsTableLanguage = "en"
	// TableLangHi is Hindi.
	TableLangHi FestivalsTableLanguage = "hi"
)

// LocalizedString is a name or description held in each table language at
// once, the Go form of the TypeScript Partial<Record<lang, string>>. Its
// JSON is an object holding only the present keys, "en" and "hi", which its
// own marshalling methods produce and accept. The zero value is empty and
// marshals as {}.
type LocalizedString struct {
	// En and Hi are the English and Hindi texts; each is meaningful only
	// when the matching Has flag is set.
	En, Hi string
	// HasEn and HasHi report which languages are present; an empty string
	// with the flag set is a present, empty text.
	HasEn, HasHi bool
	// HiFirst records that Hindi came before English, in the pairs given to
	// the builder or in the keys of the decoded JSON. It fixes the key order
	// MarshalJSON emits and the fallback order LocalizedString.Pick uses.
	HiFirst bool
}

// Empty reports whether neither language is present.
func (s LocalizedString) Empty() bool { return !s.HasEn && !s.HasHi }

// Pick returns the text for lang when present, otherwise the first present
// language in key order (English first unless HiFirst), and "" when none is;
// the same fallback as the TypeScript reader.
func (s LocalizedString) Pick(lang FestivalsTableLanguage) string {
	if lang == TableLangEn && s.HasEn {
		return s.En
	}
	if lang == TableLangHi && s.HasHi {
		return s.Hi
	}
	if s.HiFirst {
		if s.HasHi {
			return s.Hi
		}
		if s.HasEn {
			return s.En
		}
		return ""
	}
	if s.HasEn {
		return s.En
	}
	if s.HasHi {
		return s.Hi
	}
	return ""
}

// MarshalJSON writes a JSON object holding only the present languages under
// the keys "en" and "hi", "en" first unless HiFirst, without HTML escaping.
// An empty value becomes {}, never null.
func (s LocalizedString) MarshalJSON() ([]byte, error) {
	var b bytes.Buffer
	b.WriteByte('{')
	write := func(key, value string, first bool) {
		if !first {
			b.WriteByte(',')
		}
		b.WriteString(`"` + key + `":`)
		b.Write(encodeJSONString(value))
	}
	first := true
	if s.HiFirst {
		if s.HasHi {
			write("hi", s.Hi, first)
			first = false
		}
		if s.HasEn {
			write("en", s.En, first)
		}
	} else {
		if s.HasEn {
			write("en", s.En, first)
			first = false
		}
		if s.HasHi {
			write("hi", s.Hi, first)
		}
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}

// UnmarshalJSON resets the receiver, accepts null as the empty value and
// returns an error for any JSON value that is not an object. Keys other than
// "en" and "hi" are ignored, a repeated key keeps its last value, a member
// whose value is not a JSON string is skipped without error and leaves that
// language unset, and HiFirst is set when a string valued "hi" precedes the
// first string valued "en".
func (s *LocalizedString) UnmarshalJSON(data []byte) error {
	*s = LocalizedString{}
	if string(data) == "null" {
		return nil
	}
	dec := json.NewDecoder(bytes.NewReader(data))
	tok, err := dec.Token()
	if err != nil {
		return errLocalizedShape
	}
	if d, ok := tok.(json.Delim); !ok || d != '{' {
		return errLocalizedShape
	}
	seen := 0
	for dec.More() {
		keyTok, err := dec.Token()
		if err != nil {
			return errLocalizedShape
		}
		key, _ := keyTok.(string)
		var value string
		if err := dec.Decode(&value); err != nil {
			var skip json.RawMessage
			if err := dec.Decode(&skip); err != nil {
				return errLocalizedShape
			}
			continue
		}
		switch FestivalsTableLanguage(key) {
		case TableLangEn:
			if !s.HasEn && seen > 0 && s.HasHi {
				s.HiFirst = true
			}
			s.En, s.HasEn = value, true
		case TableLangHi:
			s.Hi, s.HasHi = value, true
		}
		seen++
	}
	return nil
}

// FestivalsTableType is the category string an entry in a festivals table
// carries. Its values are the same strings as FestivalType; the builder
// casts FestivalInfo.Type straight into it. BuildFestivalsTable drops
// eclipse entries, so a table it writes never contains [TableTypeEclipse].
type FestivalsTableType string

const (
	// TableTypeMajor is a major festival, the table form of FestivalMajor.
	TableTypeMajor FestivalsTableType = "major"
	// TableTypeMinor is a minor observance, the table form of FestivalMinor.
	TableTypeMinor FestivalsTableType = "minor"
	// TableTypeEkadashi is the generic Ekadashi entry; the producer always
	// emits it beside a TableTypeSmartaEkadashi entry for the same day.
	TableTypeEkadashi FestivalsTableType = "ekadashi"
	// TableTypeSmartaEkadashi is the Ekadashi fast day of the Smarta
	// tradition.
	TableTypeSmartaEkadashi FestivalsTableType = "smarta_ekadashi"
	// TableTypeVaishnavaEkadashi is the Ekadashi fast day of the Vaishnava
	// tradition, which falls a day after the Smarta one when the tithi is
	// Dashami-viddha or a vriddha Dwadashi follows.
	TableTypeVaishnavaEkadashi FestivalsTableType = "vaishnava_ekadashi"
	// TableTypePradosha is a Pradosha vrat, the table form of
	// FestivalPradosha.
	TableTypePradosha FestivalsTableType = "pradosha"
	// TableTypeSankranti is a solar ingress, the table form of
	// FestivalSankranti.
	TableTypeSankranti FestivalsTableType = "sankranti"
	// TableTypeEclipse mirrors FestivalEclipse. BuildFestivalsTable skips
	// eclipse festivals, so a table it builds never carries this value.
	TableTypeEclipse FestivalsTableType = "eclipse"
)

// FestivalDictEntry is one row of the dictionary a format 2 festivals table
// shares across all its years; [PackedFestivalTableDay.Festivals] holds
// indices into it. BuildFestivalsTable interns rows on the whole tuple (Key,
// Type, Name, Description), so one key can appear in more than one row when
// its description varies from date to date.
type FestivalDictEntry struct {
	// Key is the festival's stable identifier, copied from FestivalInfo.Key.
	Key string `json:"key"`
	// Type is the entry's category, cast from FestivalInfo.Type.
	Type FestivalsTableType `json:"type"`
	// Name holds the festival's name in each language the table was built
	// for; LocalizedString marshals as a JSON object keyed by language
	// code.
	Name LocalizedString `json:"name"`
	// Description is nil, and omitted from JSON, when no language produced a
	// description for the entry.
	Description *LocalizedString `json:"description,omitempty"`
}

// PackedFestivalTableDay is one dated row of a format 2 festivals table as
// written to JSON. BuildFestivalsTable emits rows sorted by date and only
// for dates that have at least one festival.
type PackedFestivalTableDay struct {
	// Date is the civil date as YYYY-MM-DD at the table's fixed offset
	// (FestivalTableMeta.TimezoneOffsetMinutes).
	Date string `json:"date"`
	// Festivals holds 0-based indices into FestivalsFile.Dict, in the
	// order the day's festivals were emitted.
	Festivals []int `json:"festivals"`
}

// FestivalTableMeta is the _meta block of a festivals table: the inputs
// BuildFestivalsTable was given, recorded so a reader can tell which place,
// offset, region and years the table applies to.
type FestivalTableMeta struct {
	// Format is 2 for the dictionary-encoded layout BuildFestivalsTable
	// writes. A v1 (4.x) table has no format key and decodes as 0.
	Format int `json:"format"`
	// ReferenceLocation is the free-text place name given in the build
	// options, copied verbatim; empty when none was given.
	ReferenceLocation string `json:"referenceLocation"`
	// Latitude is the build location's latitude in degrees, north positive,
	// within -90 to 90.
	Latitude float64 `json:"latitude"`
	// Longitude is the build location's longitude in degrees, east positive,
	// within -180 to 180.
	Longitude float64 `json:"longitude"`
	// TimezoneOffsetMinutes is the fixed UTC offset in minutes (330 for IST)
	// that every Date key in the table was computed in.
	TimezoneOffsetMinutes int `json:"timezoneOffsetMinutes"`
	// Ayanamsa is the AyanamsaType the festivals were computed with, as its
	// string value; "lahiri" when the build options left it empty.
	Ayanamsa string `json:"ayanamsa"`
	// MasaSystem is the MasaSystem the festivals were computed with, as its
	// string value; "purnimanta" when the build options left it empty.
	MasaSystem string `json:"masaSystem"`
	// Region is the FestivalRegion the table was built for, as its string
	// value; "all" when the build options left it empty.
	Region string `json:"region"`
	// Languages lists the languages every Name and Description carries, in
	// the order the build options gave them; en then hi when they gave none.
	Languages []FestivalsTableLanguage `json:"languages"`
	// StartYear is the first Gregorian year present in Years, inclusive.
	StartYear int `json:"startYear"`
	// EndYear is the last Gregorian year present in Years, inclusive.
	EndYear int `json:"endYear"`
	// GeneratedAt is the timestamp string given in the build options, copied
	// verbatim and never parsed; empty when none was given.
	GeneratedAt string `json:"generatedAt"`
	// Note is the free-text note given in the build options, or, when Note
	// was nil, the builder's default text saying eclipses are excluded.
	Note string `json:"note"`
}

// FestivalsFile is the format 2 festivals table BuildFestivalsTable returns
// and the shape its JSON takes: a _meta block, a shared _dict and per-year
// rows of dictionary indices. Decode saved JSON whose version is not known
// into [AnyFestivalsFile] instead, which accepts v1 as well.
type FestivalsFile struct {
	// Meta records the build inputs; it marshals under the key _meta.
	Meta FestivalTableMeta `json:"_meta"`
	// Dict is the shared entry dictionary that
	// PackedFestivalTableDay.Festivals indexes; it marshals under _dict.
	Dict []FestivalDictEntry `json:"_dict"`
	// Years maps a Gregorian year as a decimal string ("2026") to that
	// year's rows in date order. Every year from Meta.StartYear to
	// Meta.EndYear has a key, even when it has no rows.
	Years map[string][]PackedFestivalTableDay `json:"years"`
}

// FestivalTableEntryRaw is one festival as a v1 (4.x) festivals table stores
// it inline on each day: no dictionary and no stable key, so the reader
// reports such entries with an empty key.
type FestivalTableEntryRaw struct {
	// Name is the festival's name per language, a JSON object keyed by
	// language code.
	Name LocalizedString `json:"name"`
	// Type is the entry's category.
	Type FestivalsTableType `json:"type"`
	// Description is nil when the entry has none; it is omitted from JSON
	// then.
	Description *LocalizedString `json:"description,omitempty"`
}

// RawFestivalTableDay is one dated row of a v1 (4.x) festivals table, with
// its entries stored inline rather than as dictionary indices.
type RawFestivalTableDay struct {
	// Date is the civil date as YYYY-MM-DD at the table's fixed offset.
	Date string `json:"date"`
	// Festivals lists the day's entries in file order.
	Festivals []FestivalTableEntryRaw `json:"festivals"`
}

// AnyFestivalsFile is a festivals table of either layout, filled by its own
// [AnyFestivalsFile.UnmarshalJSON]: a format 2 file sets Dict and Packed, a
// v1 (4.x) file sets Raw. Wrap an in-memory table with
// [FestivalsFile.AsAny]. It has no MarshalJSON and no json tags, so encoding
// it yields a plain struct, not a table file.
type AnyFestivalsFile struct {
	// Meta is the _meta block, present in both layouts; Format is 0 for v1.
	Meta FestivalTableMeta
	// IsPacked is true when the JSON _dict key held an array (format 2);
	// Dict and Packed are then set and Raw is nil. Otherwise Raw is set and
	// Dict and Packed are nil.
	IsPacked bool
	// Dict is the shared entry dictionary; nil unless IsPacked.
	Dict []FestivalDictEntry
	// Packed maps a year string to its format 2 rows; nil unless IsPacked.
	Packed map[string][]PackedFestivalTableDay
	// Raw maps a year string to its v1 rows; nil when IsPacked.
	Raw map[string][]RawFestivalTableDay
}

// UnmarshalJSON decodes either table layout. The layout is chosen by whether
// _dict is a JSON array: a missing or non-array _dict is read as v1. Dict,
// Packed and Raw are cleared first, and the first json error met is
// returned, leaving the receiver partly filled.
func (f *AnyFestivalsFile) UnmarshalJSON(data []byte) error {
	var w anyFestivalsWire
	if err := json.Unmarshal(data, &w); err != nil {
		return err
	}
	f.Meta = w.Meta
	f.IsPacked = isJSONArray(w.Dict)
	f.Dict = nil
	f.Packed = nil
	f.Raw = nil
	if f.IsPacked {
		if err := json.Unmarshal(w.Dict, &f.Dict); err != nil {
			return err
		}
		f.Packed = map[string][]PackedFestivalTableDay{}
		for k, v := range w.Years {
			var days []PackedFestivalTableDay
			if err := json.Unmarshal(v, &days); err != nil {
				return err
			}
			f.Packed[k] = days
		}
		return nil
	}
	f.Raw = map[string][]RawFestivalTableDay{}
	for k, v := range w.Years {
		var days []RawFestivalTableDay
		if err := json.Unmarshal(v, &days); err != nil {
			return err
		}
		f.Raw[k] = days
	}
	return nil
}

// AsAny wraps the table as an [AnyFestivalsFile] with IsPacked true. The
// Dict slice and Years map are shared with the receiver, not copied.
func (f FestivalsFile) AsAny() AnyFestivalsFile {
	return AnyFestivalsFile{Meta: f.Meta, IsPacked: true, Dict: f.Dict, Packed: f.Years}
}

// MoonPhaseTableName names one of the four principal lunar phases in a Moon
// phases table. Its values are the same strings as MoonPhaseName;
// BuildMoonPhasesTable casts one into the other.
type MoonPhaseTableName string

const (
	// PhaseNew is the new Moon, the Amavasya instant.
	PhaseNew MoonPhaseTableName = "new"
	// PhaseFirstQuarter is the first quarter, the waxing half Moon.
	PhaseFirstQuarter MoonPhaseTableName = "first_quarter"
	// PhaseFull is the full Moon, the Purnima instant.
	PhaseFull MoonPhaseTableName = "full"
	// PhaseLastQuarter is the last quarter, the waning half Moon.
	PhaseLastQuarter MoonPhaseTableName = "last_quarter"
)

// MoonPhaseDictEntry is one row of a Moon phases table's dictionary.
// BuildMoonPhasesTable writes exactly four, in the order new, first quarter,
// full, last quarter, so a [PackedMoonPhaseEvent.I] of 0 in a table it built
// is the new Moon.
type MoonPhaseDictEntry struct {
	// Phase is the phase this row names.
	Phase MoonPhaseTableName `json:"phase"`
	// Name is the phase's display name in each table language, a fixed
	// string per phase such as "New Moon" or "अमावस्या".
	Name LocalizedString `json:"name"`
	// Description is a one-line gloss per language. BuildMoonPhasesTable
	// always sets it; it is nil, and omitted from JSON, only in files
	// written elsewhere.
	Description *LocalizedString `json:"description,omitempty"`
}

// PackedMoonPhaseEvent is one phase instant as a format 2 Moon phases table
// stores it: a dictionary index and an epoch millisecond time.
type PackedMoonPhaseEvent struct {
	// I is the 0-based index into MoonPhasesFile.Dict of the phase's row.
	I int `json:"i"`
	// T is the phase instant in epoch milliseconds UTC, the same value as
	// MoonPhaseEvent.TimeMs.
	T int64 `json:"t"`
}

// PackedMoonPhaseTableDay is one dated row of a format 2 Moon phases table.
// BuildMoonPhasesTable emits rows sorted by date and only for dates on which
// a phase falls.
type PackedMoonPhaseTableDay struct {
	// Date is the civil date as YYYY-MM-DD that the instant falls on at the
	// table's fixed offset (MoonPhaseTableMeta.TimezoneOffsetMinutes).
	Date string `json:"date"`
	// Phases lists the phase instants that fall on that date.
	Phases []PackedMoonPhaseEvent `json:"phases"`
}

// MoonPhaseTableMeta is the _meta block of a Moon phases table. It records
// no coordinates: a phase is a worldwide instant, and only the UTC offset
// used to date it matters.
type MoonPhaseTableMeta struct {
	// Format is 2 for the dictionary-encoded layout BuildMoonPhasesTable
	// writes. A v1 (4.x) table has no format key and decodes as 0.
	Format int `json:"format"`
	// ReferenceLocation is the free-text label given in the build options,
	// copied verbatim; empty when none was given.
	ReferenceLocation string `json:"referenceLocation"`
	// TimezoneOffsetMinutes is the fixed UTC offset in minutes (330 for IST)
	// each phase instant was shifted by to pick its Date key.
	TimezoneOffsetMinutes int `json:"timezoneOffsetMinutes"`
	// Languages lists the languages every Name and Description carries, in
	// the order the build options gave them; en then hi when they gave none.
	Languages []FestivalsTableLanguage `json:"languages"`
	// StartYear is the first Gregorian year present in Years, inclusive.
	StartYear int `json:"startYear"`
	// EndYear is the last Gregorian year present in Years, inclusive.
	EndYear int `json:"endYear"`
	// GeneratedAt is the timestamp string given in the build options, copied
	// verbatim and never parsed; empty when none was given.
	GeneratedAt string `json:"generatedAt"`
	// Note is the free-text note given in the build options, or, when Note
	// was nil, the builder's default text explaining that phases are
	// worldwide instants dated in the table's offset.
	Note string `json:"note"`
}

// MoonPhasesFile is the format 2 Moon phases table BuildMoonPhasesTable
// returns and the shape its JSON takes: a _meta block, a four-row _dict and
// per-year rows of packed events. Decode saved JSON whose version is not
// known into [AnyMoonPhasesFile] instead, which accepts v1 as well.
type MoonPhasesFile struct {
	// Meta records the build inputs; it marshals under the key _meta.
	Meta MoonPhaseTableMeta `json:"_meta"`
	// Dict is the phase dictionary that PackedMoonPhaseEvent.I indexes; it
	// marshals under _dict.
	Dict []MoonPhaseDictEntry `json:"_dict"`
	// Years maps a Gregorian year as a decimal string ("2026") to that
	// year's rows in date order. Every year from Meta.StartYear to
	// Meta.EndYear has a key.
	Years map[string][]PackedMoonPhaseTableDay `json:"years"`
}

// MoonPhaseTableEntryRaw is one phase as a v1 (4.x) Moon phases table stores
// it inline on each day, with its time as a string rather than a dictionary
// index and epoch value.
type MoonPhaseTableEntryRaw struct {
	// Name is the phase's display name per language, a JSON object keyed by
	// language code.
	Name LocalizedString `json:"name"`
	// Phase is the phase the entry records.
	Phase MoonPhaseTableName `json:"phase"`
	// Time is the phase instant as an ISO 8601 UTC string, passed through
	// unchanged by the reader.
	Time string `json:"time"`
	// Description is nil when the entry has none; it is omitted from JSON
	// then.
	Description *LocalizedString `json:"description,omitempty"`
}

// RawMoonPhaseTableDay is one dated row of a v1 (4.x) Moon phases table,
// with its entries stored inline rather than as packed events.
type RawMoonPhaseTableDay struct {
	// Date is the civil date as YYYY-MM-DD at the table's fixed offset.
	Date string `json:"date"`
	// Phases lists the day's entries in file order.
	Phases []MoonPhaseTableEntryRaw `json:"phases"`
}

// AnyMoonPhasesFile is a Moon phases table of either layout, filled by its
// own [AnyMoonPhasesFile.UnmarshalJSON]: a format 2 file sets Dict and
// Packed, a v1 (4.x) file sets Raw. Wrap an in-memory table with
// [MoonPhasesFile.AsAny]. It has no MarshalJSON and no json tags, so
// encoding it yields a plain struct, not a table file.
type AnyMoonPhasesFile struct {
	// Meta is the _meta block, present in both layouts; Format is 0 for v1.
	Meta MoonPhaseTableMeta
	// IsPacked is true when the JSON _dict key held an array (format 2);
	// Dict and Packed are then set and Raw is nil. Otherwise Raw is set and
	// Dict and Packed are nil.
	IsPacked bool
	// Dict is the phase dictionary; nil unless IsPacked.
	Dict []MoonPhaseDictEntry
	// Packed maps a year string to its format 2 rows; nil unless IsPacked.
	Packed map[string][]PackedMoonPhaseTableDay
	// Raw maps a year string to its v1 rows; nil when IsPacked.
	Raw map[string][]RawMoonPhaseTableDay
}

// UnmarshalJSON decodes either table layout. The layout is chosen by whether
// _dict is a JSON array: a missing or non-array _dict is read as v1. Dict,
// Packed and Raw are cleared first, and the first json error met is
// returned, leaving the receiver partly filled.
func (f *AnyMoonPhasesFile) UnmarshalJSON(data []byte) error {
	var w anyMoonPhasesWire
	if err := json.Unmarshal(data, &w); err != nil {
		return err
	}
	f.Meta = w.Meta
	f.IsPacked = isJSONArray(w.Dict)
	f.Dict, f.Packed, f.Raw = nil, nil, nil
	if f.IsPacked {
		if err := json.Unmarshal(w.Dict, &f.Dict); err != nil {
			return err
		}
		f.Packed = map[string][]PackedMoonPhaseTableDay{}
		for k, v := range w.Years {
			var days []PackedMoonPhaseTableDay
			if err := json.Unmarshal(v, &days); err != nil {
				return err
			}
			f.Packed[k] = days
		}
		return nil
	}
	f.Raw = map[string][]RawMoonPhaseTableDay{}
	for k, v := range w.Years {
		var days []RawMoonPhaseTableDay
		if err := json.Unmarshal(v, &days); err != nil {
			return err
		}
		f.Raw[k] = days
	}
	return nil
}

// AsAny wraps the table as an [AnyMoonPhasesFile] with IsPacked true. The
// Dict slice and Years map are shared with the receiver, not copied.
func (f MoonPhasesFile) AsAny() AnyMoonPhasesFile {
	return AnyMoonPhasesFile{Meta: f.Meta, IsPacked: true, Dict: f.Dict, Packed: f.Years}
}

// YearlyListingOptions configures the year-long listings:
// ComputeFestivalsForYear, ComputeFestivalsInRange, ComputeSankrantisForYear
// and ComputeEkadashiDatesForYear. Empty fields take the daily panchang
// defaults: Lahiri, Purnimanta, English and RegionAll. Timezone is the one
// required field. No json tags.
type YearlyListingOptions struct {
	// Timezone is required: an unset value fails with ErrInvalidTimezone.
	// Give a fixed offset (TimezoneOffset) or an IANA name (TimezoneName);
	// the per-year listings resolve a name to its offset on 1 July of that
	// year.
	Timezone Timezone
	// Ayanamsa selects the sidereal zero point; empty means Lahiri.
	Ayanamsa AyanamsaType
	// MasaSystem selects the lunar month reckoning; empty means Purnimanta.
	MasaSystem MasaSystem
	// Language selects the language of names and descriptions; empty means
	// English.
	Language Language
	// Region selects the regional festival set; empty means RegionAll, and a
	// legacy alias is mapped to its canonical region.
	Region FestivalRegion
	// RegionAliasWarner, when non-nil, receives a deprecation message the
	// first time each legacy Region alias is used in the process; nil
	// silences it.
	RegionAliasWarner RegionAliasWarner
}

// FestivalDay is one festival emission from ComputeFestivalsInRange and
// ComputeFestivalsForYear. A day with several festivals yields one
// FestivalDay per festival, all sharing the same Date.
type FestivalDay struct {
	// Date is the instant the day was queried at, epoch milliseconds: the
	// range start plus a whole number of 24 hour steps.
	// ComputeFestivalsForYear starts at local midnight in Timezone, so it is
	// not a UTC midnight.
	Date JSDate `json:"date"`
	// Festival is the daily panchang's FestivalInfo for this emission.
	Festival FestivalInfo `json:"festival"`
}

// SankrantiEvent is one solar ingress from ComputeSankrantisForYear: the
// Sun's sidereal longitude crossing a 30 degree sign boundary. Both instants
// are epoch milliseconds and marshal as ISO 8601 UTC strings.
type SankrantiEvent struct {
	// Date is the civil day the Sankranti is observed on, as the UTC
	// midnight of that local date: the sunrise-to-sunset day containing the
	// transit, else the next sunrise's day; the transit's own local date if
	// no sunrise can be computed.
	Date JSDate `json:"date"`
	// Moment is the transit instant in UTC, found by bisection to within one
	// second.
	Moment JSDate `json:"moment"`
	// Rashi is the 0-based sidereal sign the Sun entered, 0 = Mesha through
	// 11 = Meena.
	Rashi int `json:"rashi"`
	// RashiName is Rashi's name in Language: Mesha, Vrishabha, ... Meena in
	// English.
	RashiName string `json:"rashiName"`
}

var errLocalizedShape = errors.New("types: a LocalizedString must be a JSON object")

type anyFestivalsWire struct {
	Meta  FestivalTableMeta          `json:"_meta"`
	Dict  json.RawMessage            `json:"_dict"`
	Years map[string]json.RawMessage `json:"years"`
}

type anyMoonPhasesWire struct {
	Meta  MoonPhaseTableMeta         `json:"_meta"`
	Dict  json.RawMessage            `json:"_dict"`
	Years map[string]json.RawMessage `json:"years"`
}

func encodeJSONString(s string) []byte {
	var buf bytes.Buffer
	e := json.NewEncoder(&buf)
	e.SetEscapeHTML(false)
	if err := e.Encode(s); err != nil {
		panic("types: encoding a JSON string: " + err.Error())
	}
	out := buf.Bytes()
	return out[:len(out)-1]
}

func isJSONArray(raw json.RawMessage) bool {
	for _, c := range raw {
		switch c {
		case ' ', '\t', '\n', '\r':
			continue
		case '[':
			return true
		default:
			return false
		}
	}
	return false
}
