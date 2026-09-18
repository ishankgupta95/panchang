// Package types holds every data type the panchang engine takes and returns:
// the panchang and chart results, the option structs, the enums and the error
// type. It is the companion to the panchang package, which holds the engine
// itself; a caller normally imports both.
//
// Nothing here computes anything. The result types carry JSON tags and are safe
// to marshal as they stand. The option and other input structs are not: apart
// from [MoonPhasesForYearOptions] they carry no JSON tags, and any of them
// holding a callback cannot be marshalled at all, because encoding/json
// rejects func fields even when they are nil.
// That covers every struct with a [RegionAliasWarner] field, plus
// [NatalResolvers] and [SyzygyLongitudes]. Angles are degrees, and instants are
// UTC unless a field name says otherwise.
package types

import "encoding/json"

// ChoghadiyaQuality is the auspiciousness label the engine attaches to a
// Choghadiya, Gowri, Do Ghati or Anandadi yoga slot. It is a plain string
// type, so JSON carries the value itself: "auspicious", "inauspicious" or
// "neutral".
type ChoghadiyaQuality string

const (
	// QualityAuspicious marks a favourable slot.
	QualityAuspicious ChoghadiyaQuality = "auspicious"
	// QualityInauspicious marks an unfavourable slot.
	QualityInauspicious ChoghadiyaQuality = "inauspicious"
	// QualityNeutral marks a slot that is neither favourable nor
	// unfavourable.
	QualityNeutral ChoghadiyaQuality = "neutral"
)

// AllChoghadiyaQualities lists every [ChoghadiyaQuality] in declaration
// order: auspicious, inauspicious, neutral.
var AllChoghadiyaQualities = []ChoghadiyaQuality{
	QualityAuspicious, QualityInauspicious, QualityNeutral,
}

// ElementBase names the four fields that [TithiInfo], [NakshatraInfo],
// [YogaInfo] and [KaranaInfo] have in common. Nothing embeds it and no
// operation returns it; it mirrors the TypeScript ElementBase interface.
type ElementBase struct {
	// Index is the 0-based position of the element in its cycle.
	Index int `json:"index"`
	// Name is the localized element name.
	Name string `json:"name"`
	// CompletionPercentage is the elapsed fraction of the element, 0 to 100,
	// rounded to two decimals.
	CompletionPercentage float64 `json:"completionPercentage"`
	// EndTime is the UTC instant the element ends; nil when end times were
	// not computed.
	EndTime *JSDate `json:"endTime"`
}

// TithiInfo is the tithi at one instant, computed from the sidereal Moon
// minus Sun elongation in 12 degree steps. GetInstantPanchang returns it in
// its Angas; the daily result uses [DailyTithiInfo], which adds a start and
// a sunrise flag.
type TithiInfo struct {
	// Index is 0 to 29 over the lunar month: 0 = Shukla Pratipada, 14 =
	// Purnima, 15 = Krishna Pratipada, 29 = Amavasya.
	Index int `json:"index"`
	// Name is the localized tithi name with its paksha, for example "Shukla
	// Dwitiya"; Purnima and Amavasya carry no paksha prefix.
	Name string `json:"name"`
	// Paksha is the localized half-month name: Shukla for Index 0 to 14,
	// Krishna for Index 15 to 29.
	Paksha string `json:"paksha"`
	// Number is the 1-based tithi within its paksha, 1 to 15: Index + 1 in
	// Shukla, Index minus 14 in Krishna.
	Number int `json:"number"`
	// CompletionPercentage is the elapsed fraction of the tithi's 12
	// degrees, 0 to 100, rounded to two decimals.
	CompletionPercentage float64 `json:"completionPercentage"`
	// EndTime is the UTC instant the tithi ends; nil when
	// InstantPanchangOptions.ComputeEndTimes is false (it defaults to
	// true).
	EndTime *JSDate `json:"endTime"`
}

// NakshatraInfo is the nakshatra of a sidereal longitude, the ecliptic split
// into 27 equal arcs of 13 degrees 20 minutes. GetInstantPanchang returns
// the Moon's in its Angas and birth charts carry one per graha position; the
// daily result uses [DailyNakshatraInfo].
type NakshatraInfo struct {
	// Index is 0 = Ashwini to 26 = Revati.
	Index int `json:"index"`
	// Name is the localized nakshatra name.
	Name string `json:"name"`
	// Pada is the 1-based quarter of the nakshatra, 1 to 4, each 3 degrees
	// 20 minutes wide.
	Pada int `json:"pada"`
	// DegreesInNakshatra is the longitude past the nakshatra's start, 0 to
	// 13.3333 degrees, rounded to four decimals.
	DegreesInNakshatra float64 `json:"degreesInNakshatra"`
	// CompletionPercentage is the elapsed fraction of the nakshatra, 0 to
	// 100, rounded to two decimals.
	CompletionPercentage float64 `json:"completionPercentage"`
	// EndTime is the UTC instant the nakshatra ends; nil when
	// InstantPanchangOptions.ComputeEndTimes is false, and always nil in
	// birth-chart positions.
	EndTime *JSDate `json:"endTime"`
}

// YogaInfo is the nitya yoga at one instant, computed from the sum of the
// sidereal Sun and Moon longitudes in 27 equal steps. GetInstantPanchang
// returns it in its Angas; the daily result uses [DailyYogaInfo].
type YogaInfo struct {
	// Index is 0 = Vishkambha to 26 = Vaidhriti.
	Index int `json:"index"`
	// Name is the localized yoga name.
	Name string `json:"name"`
	// CompletionPercentage is the elapsed fraction of the yoga, 0 to 100,
	// rounded to two decimals.
	CompletionPercentage float64 `json:"completionPercentage"`
	// EndTime is the UTC instant the yoga ends; nil when
	// InstantPanchangOptions.ComputeEndTimes is false (it defaults to
	// true).
	EndTime *JSDate `json:"endTime"`
}

// KaranaType says whether a karana is one of the four fixed karanas or one
// of the seven repeating movable ones. It is a plain string type, so JSON
// carries "fixed" or "movable".
type KaranaType string

const (
	// KaranaFixed covers karana Index 0 (Kimstughna) and 57 to 59 (Shakuni,
	// Chatushpada, Naga).
	KaranaFixed KaranaType = "fixed"
	// KaranaMovable covers karana Index 1 to 56, the seven names Bava to
	// Vishti repeated eight times.
	KaranaMovable KaranaType = "movable"
)

// AllKaranaTypes lists both [KaranaType] values, fixed then movable.
var AllKaranaTypes = []KaranaType{KaranaFixed, KaranaMovable}

// KaranaInfo is the karana (half tithi) at one instant, computed from the
// sidereal Moon minus Sun elongation in 6 degree steps. GetInstantPanchang
// returns it in its Angas; the daily result uses [DailyKaranaInfo].
type KaranaInfo struct {
	// Index is 0 to 59 over the lunar month. 0 and 57 to 59 are the fixed
	// karanas; 1 to 56 cycle Bava, Balava, Kaulava, Taitila, Gara, Vanija,
	// Vishti.
	Index int `json:"index"`
	// Name is the localized karana name.
	Name string `json:"name"`
	// Type is KaranaFixed or KaranaMovable, decided by Index alone.
	Type KaranaType `json:"type"`
	// CompletionPercentage is the elapsed fraction of the karana's 6
	// degrees, 0 to 100, rounded to two decimals.
	CompletionPercentage float64 `json:"completionPercentage"`
	// EndTime is the UTC instant the karana ends; nil when
	// InstantPanchangOptions.ComputeEndTimes is false (it defaults to
	// true).
	EndTime *JSDate `json:"endTime"`
}

// VaraName is one entry of a seven-entry weekday name table indexed 0 =
// Sunday, as held by the engine's built-in en and hi translations. It is an
// input-side type and carries no JSON tags.
type VaraName struct {
	// Name is the full weekday name, for example "Raviwara".
	Name string
	// Short is the abbreviated form, for example "Ravi".
	Short string
}

// VaraInfo is the weekday of a panchang day. The day begins at sunrise, so
// Index is the local weekday of that sunrise, not of the civil date. Both
// GetDailyPanchang and GetInstantPanchang return it in their Angas.
type VaraInfo struct {
	// Index is 0 = Sunday to 6 = Saturday.
	Index int `json:"index"`
	// Name is the localized weekday name, for example "Raviwara".
	Name string `json:"name"`
	// ShortName is the localized short form, for example "Ravi".
	ShortName string `json:"shortName"`
	// EnglishName is the English weekday name, "Sunday" to "Saturday",
	// whatever the language option.
	EnglishName string `json:"englishName"`
}

// RashiInfo is a sidereal zodiac sign with its localized name: the Moon's
// rashi in the panchang results, and the sign of each graha, lagna, bhava
// and divisional position in birth charts.
type RashiInfo struct {
	// Index is 0 = Mesha to 11 = Meena, the floor of the sidereal longitude
	// divided by 30.
	Index int `json:"index"`
	// Name is the localized rashi name.
	Name string `json:"name"`
}

// NakshatraIndexInfo is a nakshatra identified by index and localized name
// only, without pada or progress. The panchang results use it for the Sun's
// nakshatra.
type NakshatraIndexInfo struct {
	// Index is 0 = Ashwini to 26 = Revati.
	Index int `json:"index"`
	// Name is the localized nakshatra name.
	Name string `json:"name"`
}

// ChandraMasaInfo is the lunar month at one instant. Index and Name follow
// the [MasaSystem] in System; the Amanta and Purnimanta readings are both
// always filled. Both panchang results return it in their Calendar labels.
type ChandraMasaInfo struct {
	// Index is 0 = Chaitra to 11 = Phalguna in the system named by System.
	Index int `json:"index"`
	// Name is the localized month name, prefixed with the localized "Adhika"
	// when IsAdhika is true.
	Name string `json:"name"`
	// IsAdhika is true for a leap month: the sidereal Sun is in the same
	// rashi at both of the new moons bounding the month.
	IsAdhika bool `json:"isAdhika"`
	// System is the MasaSystem that Index and Name follow, Purnimanta
	// unless the options asked for Amanta.
	System MasaSystem `json:"system"`
	// AmantaIndex is the month by new-moon-to-new-moon reckoning, 0 =
	// Chaitra: the rashi of the Sun at the previous new moon, plus one.
	AmantaIndex int `json:"amantaIndex"`
	// AmantaName is the localized name for AmantaIndex.
	AmantaName string `json:"amantaName"`
	// PurnimantaIndex is the month by full-moon-to-full-moon reckoning, 0 =
	// Chaitra: AmantaIndex plus one during Krishna paksha of a non-adhika
	// month, otherwise equal to AmantaIndex.
	PurnimantaIndex int `json:"purnimantaIndex"`
	// PurnimantaName is the localized name for PurnimantaIndex.
	PurnimantaName string `json:"purnimantaName"`
}

// SamvatInfo is the Vikram and Shaka year numbers and their samvatsara names
// at one instant. Both eras turn over at the year's Chaitra new moon, the
// new moon at which the sidereal Sun is in Meena. Both panchang results
// return it in their Calendar labels.
type SamvatInfo struct {
	// VikramSamvat is the Gregorian year plus 57 from the Chaitra new moon
	// onward and plus 56 before it.
	VikramSamvat int `json:"vikramSamvat"`
	// ShakaSamvat is the Gregorian year minus 78 from the Chaitra new moon
	// onward and minus 79 before it, 135 behind VikramSamvat.
	ShakaSamvat int `json:"shakaSamvat"`
	// VikramSamvatsara is the name of VikramSamvat's year in the 60-name
	// samvatsara cycle by the Vikram count. The names are English in every
	// language.
	VikramSamvatsara string `json:"vikramSamvatsara"`
	// ShakaSamvatsara is the samvatsara name by the Shaka count, which is
	// offset from the Vikram count, so the two names differ.
	ShakaSamvatsara string `json:"shakaSamvatsara"`
}

// UtcWindow is a time span as two UTC epoch milliseconds. The package-level
// muhurta functions (ComputeRahuKalam, ComputeBrahmaMuhurta and the rest)
// return it; the panchang results convert it to [TimePeriod]. JSON writes
// start and end as integers, not ISO strings.
type UtcWindow struct {
	// StartMs is the start instant, UTC epoch milliseconds (JSON key
	// "start").
	StartMs int64 `json:"start"`
	// EndMs is the end instant, UTC epoch milliseconds (JSON key "end").
	EndMs int64 `json:"end"`
}

// TimePeriod is a time span carried both as UTC instants and as strings in
// the result's timezone. The daily panchang result uses it for most muhurta
// and inauspicious windows; DurMuhurta, Bhadra and DoGhati use
// [DurMuhurtaPeriod], [BhadraInfo] and [DoGhatiInfo] instead.
type TimePeriod struct {
	// Start is the UTC start instant; JSON writes it as an ISO 8601 string
	// ending in Z.
	Start JSDate `json:"start"`
	// End is the UTC end instant; JSON writes it as an ISO 8601 string
	// ending in Z.
	End JSDate `json:"end"`
	// StartLocal is Start in the result's timezone as ISO 8601 with an
	// explicit offset, for example "2026-09-11T06:12:34.000+05:30".
	StartLocal string `json:"startLocal"`
	// EndLocal is End in the result's timezone as ISO 8601 with an explicit
	// offset, in the same form as StartLocal.
	EndLocal string `json:"endLocal"`
}

// UnlocalizedChoghadiyaSlot is a [ChoghadiyaSlot] before the local time
// strings are attached, with epoch millisecond bounds. The engine builds it
// internally and no panchang package function returns it; results carry
// [ChoghadiyaSlot]. JSON writes start and end as integers.
type UnlocalizedChoghadiyaSlot struct {
	// StartMs is the slot start, UTC epoch milliseconds (JSON key "start").
	StartMs int64 `json:"start"`
	// EndMs is the slot end, UTC epoch milliseconds (JSON key "end").
	EndMs int64 `json:"end"`
	// Index is 0 to 6 in the Choghadiya cycle: 0 Udveg, 1 Char, 2 Labh, 3
	// Amrit, 4 Kaal, 5 Shubh, 6 Rog.
	Index int `json:"index"`
	// Name is the localized name for Index.
	Name string `json:"name"`
	// Quality is fixed by Index: Labh, Amrit and Shubh are auspicious, Char
	// is neutral, Udveg, Kaal and Rog are inauspicious.
	Quality ChoghadiyaQuality `json:"quality"`
	// QualityName is the localized label for Quality.
	QualityName string `json:"qualityName"`
}

// ChoghadiyaSlot is one Choghadiya period of a day or night, with UTC
// instants and local strings. The daily panchang result holds them in
// Periods.Choghadiya.
type ChoghadiyaSlot struct {
	// Start is the UTC start instant; JSON writes it as an ISO 8601 string.
	Start JSDate `json:"start"`
	// End is the UTC end instant; JSON writes it as an ISO 8601 string.
	End JSDate `json:"end"`
	// Index is 0 to 6 in the Choghadiya cycle: 0 Udveg, 1 Char, 2 Labh, 3
	// Amrit, 4 Kaal, 5 Shubh, 6 Rog.
	Index int `json:"index"`
	// Name is the localized name for Index.
	Name string `json:"name"`
	// Quality is fixed by Index: Labh, Amrit and Shubh are auspicious, Char
	// is neutral, Udveg, Kaal and Rog are inauspicious.
	Quality ChoghadiyaQuality `json:"quality"`
	// QualityName is the localized label for Quality.
	QualityName string `json:"qualityName"`
	// StartLocal is Start in the result's timezone as ISO 8601 with an
	// explicit offset.
	StartLocal string `json:"startLocal"`
	// EndLocal is End in the result's timezone as ISO 8601 with an explicit
	// offset.
	EndLocal string `json:"endLocal"`
}

// UnlocalizedChoghadiyaInfo is a [ChoghadiyaInfo] whose slots have epoch
// millisecond bounds and no local strings. The engine builds it internally
// and no panchang package function returns it.
type UnlocalizedChoghadiyaInfo struct {
	// Day is the eight equal slots from sunrise to sunset; the weekday picks
	// the first one.
	Day []UnlocalizedChoghadiyaSlot `json:"day"`
	// Night is the eight equal slots from sunset to the next sunrise.
	Night []UnlocalizedChoghadiyaSlot `json:"night"`
}

// ChoghadiyaInfo is the day's Choghadiya table: eight equal slots from
// sunrise to sunset and eight from sunset to the next sunrise. The daily
// panchang result carries it in Periods.
type ChoghadiyaInfo struct {
	// Day is the eight equal slots from sunrise to sunset; the weekday picks
	// the first one.
	Day []ChoghadiyaSlot `json:"day"`
	// Night is the eight equal slots from sunset to the next sunrise.
	Night []ChoghadiyaSlot `json:"night"`
}

// UnlocalizedHoraSlot is a [HoraSlot] before the local time strings are
// attached, with epoch millisecond bounds. The engine builds it internally
// and no panchang package function returns it; results carry [HoraSlot].
// JSON writes start and end as integers.
type UnlocalizedHoraSlot struct {
	// StartMs is the hora start, UTC epoch milliseconds (JSON key "start").
	StartMs int64 `json:"start"`
	// EndMs is the hora end, UTC epoch milliseconds (JSON key "end").
	EndMs int64 `json:"end"`
	// PlanetIndex is the ruling graha, 0 to 6 in Chaldean order: 0 Sun, 1
	// Venus, 2 Mercury, 3 Moon, 4 Saturn, 5 Jupiter, 6 Mars.
	PlanetIndex int `json:"planetIndex"`
	// Planet is the localized graha name for PlanetIndex.
	Planet string `json:"planet"`
}

// HoraSlot is one planetary hour of a day or night, with UTC instants and
// local strings. The daily panchang result holds them in Periods.Hora.
type HoraSlot struct {
	// Start is the UTC start instant; JSON writes it as an ISO 8601 string.
	Start JSDate `json:"start"`
	// End is the UTC end instant; JSON writes it as an ISO 8601 string.
	End JSDate `json:"end"`
	// PlanetIndex is the ruling graha, 0 to 6 in Chaldean order: 0 Sun, 1
	// Venus, 2 Mercury, 3 Moon, 4 Saturn, 5 Jupiter, 6 Mars.
	PlanetIndex int `json:"planetIndex"`
	// Planet is the localized graha name for PlanetIndex.
	Planet string `json:"planet"`
	// StartLocal is Start in the result's timezone as ISO 8601 with an
	// explicit offset.
	StartLocal string `json:"startLocal"`
	// EndLocal is End in the result's timezone as ISO 8601 with an explicit
	// offset.
	EndLocal string `json:"endLocal"`
}

// UnlocalizedHoraInfo is a [HoraInfo] whose slots have epoch millisecond
// bounds and no local strings. The engine builds it internally and no
// panchang package function returns it.
type UnlocalizedHoraInfo struct {
	// Day is the twelve equal horas from sunrise to sunset; the first is
	// ruled by the weekday's lord.
	Day []UnlocalizedHoraSlot `json:"day"`
	// Night is the twelve equal horas from sunset to the next sunrise,
	// continuing the Chaldean sequence from the day's twelfth.
	Night []UnlocalizedHoraSlot `json:"night"`
}

// HoraInfo is the day's planetary hours: twelve equal horas from sunrise to
// sunset and twelve from sunset to the next sunrise, each ruled by a graha
// in Chaldean order. The daily panchang result carries it in Periods.
type HoraInfo struct {
	// Day is the twelve equal horas from sunrise to sunset; the first is
	// ruled by the weekday's lord.
	Day []HoraSlot `json:"day"`
	// Night is the twelve equal horas from sunset to the next sunrise,
	// continuing the Chaldean sequence from the day's twelfth.
	Night []HoraSlot `json:"night"`
}

// UnlocalizedGowriSlot is one Gowri Panchangam slot before the local time
// strings are added: the form ComputeGowriPanchangam returns inside
// [UnlocalizedGowriInfo]. Its JSON keys are start and end, holding integer
// epoch milliseconds rather than the ISO strings a [GowriSlot] emits.
type UnlocalizedGowriSlot struct {
	// StartMs is the slot start as UTC epoch milliseconds.
	StartMs int64 `json:"start"`
	// EndMs is the slot end as UTC epoch milliseconds; the last slot of a
	// half ends exactly at sunset (day) or the next sunrise (night).
	EndMs int64 `json:"end"`
	// Index is the position in the 8-name Gowri cycle, 0 = Udyog, 1 = Amrit,
	// 2 = Roga, 3 = Laabh, 4 = Shubh, 5 = Kaal, 6 = Dhan, 7 = Chal.
	Index int `json:"index"`
	// Name is the Gowri name for Index in the requested language.
	Name string `json:"name"`
	// Quality is the fixed quality of the name: QualityAuspicious or
	// QualityInauspicious, never QualityNeutral.
	Quality ChoghadiyaQuality `json:"quality"`
	// QualityName is Quality rendered in the requested language.
	QualityName string `json:"qualityName"`
}

// GowriSlot is one of the eight equal Gowri Panchangam (Nalla Neram) slots
// of a day or night half, as carried in [GowriInfo] under Periods.Gowri of
// the daily panchang result GetDailyPanchang returns. The eight names rotate
// by weekday; Saturday night lists Chal twice and never Roga.
type GowriSlot struct {
	// Start is the slot start instant (UTC epoch milliseconds).
	Start JSDate `json:"start"`
	// End is the slot end instant; the eighth slot ends exactly at sunset
	// (day) or the next sunrise (night).
	End JSDate `json:"end"`
	// Index is the position in the 8-name Gowri cycle, 0 = Udyog, 1 = Amrit,
	// 2 = Roga, 3 = Laabh, 4 = Shubh, 5 = Kaal, 6 = Dhan, 7 = Chal.
	Index int `json:"index"`
	// Name is the Gowri name for Index in the requested language.
	Name string `json:"name"`
	// Quality is the fixed quality of the name: QualityAuspicious or
	// QualityInauspicious, never QualityNeutral.
	Quality ChoghadiyaQuality `json:"quality"`
	// QualityName is Quality rendered in the requested language.
	QualityName string `json:"qualityName"`
	// StartLocal is Start as ISO 8601 with an explicit offset in the
	// result's timezone.
	StartLocal string `json:"startLocal"`
	// EndLocal is End as ISO 8601 with an explicit offset in the result's
	// timezone.
	EndLocal string `json:"endLocal"`
}

// UnlocalizedGowriInfo is the Gowri Panchangam of one day without local time
// strings, as ComputeGowriPanchangam returns it; the daily panchang adds the
// strings and reports it as [GowriInfo].
type UnlocalizedGowriInfo struct {
	// Day holds the eight equal slots from sunrise to sunset, in time order.
	Day []UnlocalizedGowriSlot `json:"day"`
	// Night holds the eight equal slots from sunset to the next sunrise, in
	// time order.
	Night []UnlocalizedGowriSlot `json:"night"`
}

// GowriInfo is the Gowri Panchangam of one day, sixteen slots split into the
// day and night halves, under Periods.Gowri of the daily panchang result
// GetDailyPanchang returns.
type GowriInfo struct {
	// Day holds the eight equal slots from sunrise to sunset, in time order.
	Day []GowriSlot `json:"day"`
	// Night holds the eight equal slots from sunset to the next sunrise, in
	// time order.
	Night []GowriSlot `json:"night"`
}

// UnlocalizedDoGhatiSlot is one Do Ghati Muhurta slot before the local time
// strings are added: the form ComputeDoGhati returns inside
// [UnlocalizedDoGhatiInfo]. Its JSON keys are start and end, holding integer
// epoch milliseconds rather than the ISO strings a [DoGhatiSlot] emits.
type UnlocalizedDoGhatiSlot struct {
	// StartMs is the slot start as UTC epoch milliseconds.
	StartMs int64 `json:"start"`
	// EndMs is the slot end as UTC epoch milliseconds; the last slot of a
	// half ends exactly at sunset (day) or the next sunrise (night).
	EndMs int64 `json:"end"`
	// Index is the slot's place in the fixed 30-name Do Ghati sequence: 0 to
	// 14 are the day slots (0 = Rudra through 14 = Bhaga) and 15 to 29 the
	// night slots (15 = Ishwara through 29 = Samirana). There is no weekday
	// rotation.
	Index int `json:"index"`
	// Name is the deity name for Index in the requested language.
	Name string `json:"name"`
	// Quality is the fixed quality of the name: QualityAuspicious or
	// QualityInauspicious, never QualityNeutral.
	Quality ChoghadiyaQuality `json:"quality"`
	// QualityName is Quality rendered in the requested language.
	QualityName string `json:"qualityName"`
}

// DoGhatiSlot is one of the fifteen equal Do Ghati Muhurta slots of a day or
// night half, as carried in [DoGhatiInfo] under Muhurtas.DoGhati of the
// daily panchang result GetDailyPanchang returns.
type DoGhatiSlot struct {
	// Start is the slot start instant (UTC epoch milliseconds).
	Start JSDate `json:"start"`
	// End is the slot end instant; the fifteenth slot ends exactly at sunset
	// (day) or the next sunrise (night).
	End JSDate `json:"end"`
	// Index is the slot's place in the fixed 30-name Do Ghati sequence: 0 to
	// 14 are the day slots (0 = Rudra through 14 = Bhaga) and 15 to 29 the
	// night slots (15 = Ishwara through 29 = Samirana). There is no weekday
	// rotation.
	Index int `json:"index"`
	// Name is the deity name for Index in the requested language.
	Name string `json:"name"`
	// Quality is the fixed quality of the name: QualityAuspicious or
	// QualityInauspicious, never QualityNeutral.
	Quality ChoghadiyaQuality `json:"quality"`
	// QualityName is Quality rendered in the requested language.
	QualityName string `json:"qualityName"`
	// StartLocal is Start as ISO 8601 with an explicit offset in the
	// result's timezone.
	StartLocal string `json:"startLocal"`
	// EndLocal is End as ISO 8601 with an explicit offset in the result's
	// timezone.
	EndLocal string `json:"endLocal"`
}

// UnlocalizedDoGhatiInfo is the Do Ghati Muhurta table of one day without
// local time strings, as ComputeDoGhati returns it; the daily panchang adds
// the strings and reports it as [DoGhatiInfo].
type UnlocalizedDoGhatiInfo struct {
	// Day holds the fifteen equal slots from sunrise to sunset, in time
	// order, with Index 0 to 14.
	Day []UnlocalizedDoGhatiSlot `json:"day"`
	// Night holds the fifteen equal slots from sunset to the next sunrise,
	// in time order, with Index 15 to 29.
	Night []UnlocalizedDoGhatiSlot `json:"night"`
}

// DoGhatiInfo is the Do Ghati Muhurta table of one day, thirty slots split
// into the day and night halves, under Muhurtas.DoGhati of the daily
// panchang result GetDailyPanchang returns.
type DoGhatiInfo struct {
	// Day holds the fifteen equal slots from sunrise to sunset, in time
	// order, with Index 0 to 14.
	Day []DoGhatiSlot `json:"day"`
	// Night holds the fifteen equal slots from sunset to the next sunrise,
	// in time order, with Index 15 to 29.
	Night []DoGhatiSlot `json:"night"`
}

// UnlocalizedDurMuhurtaPeriod is one Dur Muhurta window before the local
// time strings are added, the form the engine computes from sunrise, sunset
// and the weekday. Its JSON keys are start and end, holding integer epoch
// milliseconds.
type UnlocalizedDurMuhurtaPeriod struct {
	// StartMs is the window start as UTC epoch milliseconds.
	StartMs int64 `json:"start"`
	// EndMs is the window end as UTC epoch milliseconds, one fifteenth of
	// the Segment half after StartMs.
	EndMs int64 `json:"end"`
	// Segment is the half of the day the window's muhurta is counted in.
	Segment DayNightSegment `json:"segment"`
}

// DurMuhurtaPeriod is one Dur Muhurta window, an inauspicious muhurta fixed
// by the weekday: one fifteenth of the day half (sunrise to sunset) or of
// the night half (sunset to the next sunrise). A weekday yields one or two
// windows; only Tuesday's second one is a night window. The list sits under
// Inauspicious.DurMuhurta of the daily panchang result GetDailyPanchang
// returns.
type DurMuhurtaPeriod struct {
	// Start is the window start instant (UTC epoch milliseconds).
	Start JSDate `json:"start"`
	// End is the window end instant, one fifteenth of the Segment half after
	// Start.
	End JSDate `json:"end"`
	// StartLocal is Start as ISO 8601 with an explicit offset in the
	// result's timezone.
	StartLocal string `json:"startLocal"`
	// EndLocal is End as ISO 8601 with an explicit offset in the result's
	// timezone.
	EndLocal string `json:"endLocal"`
	// Segment is the half of the day the window's muhurta is counted in.
	Segment DayNightSegment `json:"segment"`
}

// DayNightSegment names a half of the Hindu day, the span a
// [DurMuhurtaPeriod] is measured within.
type DayNightSegment string

const (
	// SegmentDay is the half from sunrise to sunset.
	SegmentDay DayNightSegment = "day"
	// SegmentNight is the half from sunset to the next sunrise.
	SegmentNight DayNightSegment = "night"
)

// AllDayNightSegments lists both segments, day then night.
var AllDayNightSegments = []DayNightSegment{SegmentDay, SegmentNight}

// GandaMulaSeverity grades a Ganda Mula nakshatra. Ashwini, Ashlesha, Magha
// and Revati are mild; Jyeshtha and Mula are severe.
type GandaMulaSeverity string

const (
	// GandaMulaMild is the grade of Ashwini, Ashlesha, Magha and Revati.
	GandaMulaMild GandaMulaSeverity = "mild"
	// GandaMulaSevere is the grade of Jyeshtha and Mula.
	GandaMulaSevere GandaMulaSeverity = "severe"
)

// AllGandaMulaSeverities lists both severities, mild then severe.
var AllGandaMulaSeverities = []GandaMulaSeverity{GandaMulaMild, GandaMulaSevere}

// GandaMulaInfo says whether the Moon's nakshatra is one of the six Ganda
// Mula nakshatras (Ashwini, Ashlesha, Magha, Jyeshtha, Mula, Revati).
// ComputeGandaMula builds it from a 0-based nakshatra index; the daily
// panchang uses the nakshatra at sunrise and the instant panchang the
// nakshatra at the instant, both under Inauspicious.GandaMula. When Active
// is false the other fields are zero and the JSON form is {"active":false}
// only.
type GandaMulaInfo struct {
	// Active is true when the nakshatra is one of the six Ganda Mula
	// nakshatras.
	Active bool `json:"active"`
	// NakshatraName is the nakshatra's name in the requested language; empty
	// when Active is false.
	NakshatraName string `json:"nakshatraName"`
	// Severity is the grade of the nakshatra; empty when Active is false.
	Severity GandaMulaSeverity `json:"severity"`
}

// MarshalJSON emits {"active":false} when Active is false and otherwise the
// full struct under its json tags, matching the TypeScript union.
func (g GandaMulaInfo) MarshalJSON() ([]byte, error) {
	if !g.Active {
		return []byte(`{"active":false}`), nil
	}
	type alias GandaMulaInfo
	return json.Marshal(alias(g))
}

// PanchakaType classifies a Panchaka spell by the weekday it began on. Five
// of the values name a dosha; samanya is the spell that began on a Wednesday
// or Thursday and carries none.
type PanchakaType string

const (
	// PanchakaRoga is the spell that began on a Sunday (illness).
	PanchakaRoga PanchakaType = "roga"
	// PanchakaRaja is the spell that began on a Monday (royalty).
	PanchakaRaja PanchakaType = "raja"
	// PanchakaAgni is the spell that began on a Tuesday (fire).
	PanchakaAgni PanchakaType = "agni"
	// PanchakaChora is the spell that began on a Friday (theft).
	PanchakaChora PanchakaType = "chora"
	// PanchakaMrityu is the spell that began on a Saturday (death).
	PanchakaMrityu PanchakaType = "mrityu"
	// PanchakaSamanya is the spell that began on a Wednesday or Thursday; it
	// is not a dosha.
	PanchakaSamanya PanchakaType = "samanya"
)

// AllPanchakaTypes lists the six types in weekday order of onset, Sunday
// through Saturday, with the shared Wednesday and Thursday value samanya
// last.
var AllPanchakaTypes = []PanchakaType{
	PanchakaRoga, PanchakaRaja, PanchakaAgni, PanchakaChora, PanchakaMrityu, PanchakaSamanya,
}

// PanchakaInfo describes the Panchaka spell in force, the stretch while the
// sidereal Moon is at or past 300 degrees (Dhanishtha's third pada through
// Revati). The type belongs to the spell, fixed by the weekday the Moon
// crossed 300 degrees. The daily panchang evaluates the Moon at sunrise and
// the instant panchang the Moon at the instant, both under
// Inauspicious.PanchakaInfo. When Active is false the other fields are zero
// and the JSON form is {"active":false} only.
type PanchakaInfo struct {
	// Active is true when the Moon is at or past 300 degrees sidereal and
	// the crossing was found within the preceding seven days; it is false
	// when the Moon was already past 300 degrees seven days earlier, even
	// though the plain Panchaka flag is true.
	Active bool `json:"active"`
	// Type is the classification by onset weekday; empty when Active is
	// false.
	Type PanchakaType `json:"type"`
	// Name is Type rendered in the requested language, "Chora Panchaka" in
	// English; empty when Active is false.
	Name string `json:"name"`
	// IsDosha is true for every Type except PanchakaSamanya; false when
	// Active is false.
	IsDosha bool `json:"isDosha"`
	// OnsetVara is the weekday the spell began on, 0 = Sunday through 6 =
	// Saturday; 0 when Active is false.
	OnsetVara int `json:"onsetVara"`
}

// MarshalJSON emits {"active":false} when Active is false and otherwise the
// full struct under its json tags, matching the TypeScript union.
func (p PanchakaInfo) MarshalJSON() ([]byte, error) {
	if !p.Active {
		return []byte(`{"active":false}`), nil
	}
	type alias PanchakaInfo
	return json.Marshal(alias(p))
}

// AnandadiYogaInfo is the Anandadi yoga, one of a 28-name cycle fixed by the
// weekday and the Moon's nakshatra. ComputeAnandadiYoga builds it from
// 0-based vara and nakshatra indices; the daily panchang uses the vara and
// the nakshatra at sunrise, the instant panchang the nakshatra at the
// instant, both as the result's AnandadiYoga field.
type AnandadiYogaInfo struct {
	// Index is the position in the 28-name cycle, 0 = Ananda through 27 =
	// Vardhamana.
	Index int `json:"index"`
	// Name is the yoga name for Index in the requested language.
	Name string `json:"name"`
	// Quality is the fixed quality of the name: QualityAuspicious or
	// QualityInauspicious, never QualityNeutral.
	Quality ChoghadiyaQuality `json:"quality"`
}

// BhadraLocation is the loka (vasa) a Bhadra, the Vishti karana, is reckoned
// to occupy, fixed by the Moon's rashi: heaven in Mesha, Vrishabha, Mithuna
// and Vrischika; earth in Karka, Simha, Kumbha and Meena; paatal in Kanya,
// Tula, Dhanu and Makara.
type BhadraLocation string

const (
	// BhadraEarth is the vasa while the Moon is in Karka, Simha, Kumbha or
	// Meena.
	BhadraEarth BhadraLocation = "earth"
	// BhadraHeaven is the vasa while the Moon is in Mesha, Vrishabha,
	// Mithuna or Vrischika.
	BhadraHeaven BhadraLocation = "heaven"
	// BhadraPaatal is the vasa while the Moon is in Kanya, Tula, Dhanu or
	// Makara.
	BhadraPaatal BhadraLocation = "paatal"
)

// AllBhadraLocations lists the three vasas: earth, heaven, paatal.
var AllBhadraLocations = []BhadraLocation{BhadraEarth, BhadraHeaven, BhadraPaatal}

// UnlocalizedBhadraVasaSegment is one vasa segment of a Bhadra window before
// the local time strings are added, as held in [UnlocalizedBhadraInfo]. Its
// JSON keys are start and end, holding integer epoch milliseconds.
type UnlocalizedBhadraVasaSegment struct {
	// StartMs is the segment start as UTC epoch milliseconds.
	StartMs int64 `json:"start"`
	// EndMs is the segment end as UTC epoch milliseconds: the instant the
	// Moon enters the next rashi, or the Bhadra end for the last segment.
	EndMs int64 `json:"end"`
	// Location is the vasa for the Moon's rashi during the segment.
	Location BhadraLocation `json:"location"`
	// LocationName is Location rendered in the requested language.
	LocationName string `json:"locationName"`
}

// BhadraVasaSegment is the part of a Bhadra window during which the Moon
// stays in one rashi, so one vasa applies. The vasa follows the Moon's
// rashi, so a rashi transition inside the window splits it.
type BhadraVasaSegment struct {
	// Start is the segment start instant (UTC epoch milliseconds).
	Start JSDate `json:"start"`
	// End is the segment end instant: the Moon's entry into the next rashi,
	// or the Bhadra end for the last segment.
	End JSDate `json:"end"`
	// Location is the vasa for the Moon's rashi during the segment.
	Location BhadraLocation `json:"location"`
	// LocationName is Location rendered in the requested language.
	LocationName string `json:"locationName"`
	// StartLocal is Start as ISO 8601 with an explicit offset in the
	// result's timezone.
	StartLocal string `json:"startLocal"`
	// EndLocal is End as ISO 8601 with an explicit offset in the result's
	// timezone.
	EndLocal string `json:"endLocal"`
}

// UnlocalizedBhadraInfo is a Bhadra (Vishti karana) window before the local
// time strings are added, the form the engine computes for a day and hands
// to the festival rules; the daily panchang reports it as [BhadraInfo]. Its
// JSON keys start and end hold integer epoch milliseconds.
type UnlocalizedBhadraInfo struct {
	// StartMs is the Vishti karana start as UTC epoch milliseconds; it is
	// not clamped to the day and can fall before sunrise.
	StartMs int64 `json:"start"`
	// EndMs is the Vishti karana end as UTC epoch milliseconds; it is not
	// clamped to the day and can fall after the next sunrise.
	EndMs int64 `json:"end"`
	// Location is the vasa at StartMs, that of the first Vasa segment.
	Location BhadraLocation `json:"location"`
	// LocationName is Location rendered in the requested language.
	LocationName string `json:"locationName"`
	// Vasa holds one segment per rashi the Moon occupies between StartMs and
	// EndMs, in time order, tiling the window; at least one.
	Vasa []UnlocalizedBhadraVasaSegment `json:"vasa"`
	// IsActive is true when the Vishti karana is already running at sunrise.
	IsActive bool `json:"isActive"`
}

// BhadraInfo is the Bhadra window of a day: the span of the Vishti karana
// that is running at sunrise or begins before the next sunrise, with the
// vasa the Moon's rashi gives it. It sits as a pointer under
// Inauspicious.Bhadra of the daily panchang result GetDailyPanchang returns,
// and is nil when no Vishti karana touches the day or when neither the lunar
// windows nor the festivals section was requested. A muhurta rule can
// exclude or penalize a day on which it is present.
type BhadraInfo struct {
	// Start is the Vishti karana start instant (UTC epoch milliseconds); it
	// is not clamped to the day and can fall before sunrise.
	Start JSDate `json:"start"`
	// End is the Vishti karana end instant; it is not clamped to the day and
	// can fall after the next sunrise.
	End JSDate `json:"end"`
	// StartLocal is Start as ISO 8601 with an explicit offset in the
	// result's timezone.
	StartLocal string `json:"startLocal"`
	// EndLocal is End as ISO 8601 with an explicit offset in the result's
	// timezone.
	EndLocal string `json:"endLocal"`
	// Location is the vasa at Start, that of the first Vasa segment; Vasa
	// has the breakdown when the Moon changes rashi inside the window.
	Location BhadraLocation `json:"location"`
	// LocationName is Location rendered in the requested language.
	LocationName string `json:"locationName"`
	// Vasa holds one segment per rashi the Moon occupies between Start and
	// End, in time order, tiling the window; at least one.
	Vasa []BhadraVasaSegment `json:"vasa"`
	// IsActive is true when the Vishti karana is already running at sunrise.
	IsActive bool `json:"isActive"`
}

// SpecialYogaType keys the day-level special yogas the panchang reports in
// [SpecialYogaInfo]. They arise from the weekday, the Moon's nakshatra, the
// tithi, and the Moon's nakshatra distance from the Sun's.
type SpecialYogaType string

const (
	// YogaAmritSiddhi is the weekday paired with its own nakshatra: Sunday
	// with Hasta, Monday Mrigashira, Tuesday Ashwini, Wednesday Anuradha,
	// Thursday Pushya, Friday Revati, Saturday Rohini.
	YogaAmritSiddhi SpecialYogaType = "amrit_siddhi"
	// YogaSarvarthaSiddhi is a weekday paired with one of its Sarvartha
	// Siddhi nakshatras (three to seven per weekday).
	YogaSarvarthaSiddhi SpecialYogaType = "sarvartha_siddhi"
	// YogaRaviPushya is a Sunday with the Moon in Pushya.
	YogaRaviPushya SpecialYogaType = "ravi_pushya"
	// YogaGuruPushya is a Thursday with the Moon in Pushya.
	YogaGuruPushya SpecialYogaType = "guru_pushya"
	// YogaDwipushkar is a Sunday, Tuesday or Saturday on a Bhadra tithi
	// (Dwitiya, Saptami or Dwadashi of either paksha) with the Moon in
	// Mrigashira, Chitra or Dhanishtha.
	YogaDwipushkar SpecialYogaType = "dwipushkar"
	// YogaTripushkar is a Sunday, Tuesday or Saturday on a Bhadra tithi
	// (Dwitiya, Saptami or Dwadashi of either paksha) with the Moon in
	// Krittika, Punarvasu, Uttara Phalguni, Vishakha, Uttara Ashadha or
	// Purva Bhadrapada.
	YogaTripushkar SpecialYogaType = "tripushkar"
	// YogaJwalamukhi is an inauspicious tithi and nakshatra pairing:
	// Pratipada with Mula, Panchami with Bharani, Ashtami with Krittika,
	// Navami with Rohini, Dashami with Ashlesha. The muhurta engine
	// penalizes it where it rewards the Siddhi and Pushya yogas.
	YogaJwalamukhi SpecialYogaType = "jwalamukhi"
	// YogaAadal is fixed by the Moon's nakshatra counted from the Sun's in
	// the 28-star scheme that includes Abhijit.
	YogaAadal SpecialYogaType = "aadal"
	// YogaVidaal is fixed by the Moon's nakshatra counted from the Sun's in
	// the 28-star scheme that includes Abhijit.
	YogaVidaal SpecialYogaType = "vidaal"
	// YogaRavi is fixed by the Moon's nakshatra counted from the Sun's in
	// the 27-star scheme.
	YogaRavi SpecialYogaType = "ravi"
)

// AllSpecialYogaTypes lists the ten types in the order the engine tests
// them, Amrit Siddhi through Ravi.
var AllSpecialYogaTypes = []SpecialYogaType{
	YogaAmritSiddhi, YogaSarvarthaSiddhi, YogaRaviPushya, YogaGuruPushya,
	YogaDwipushkar, YogaTripushkar, YogaJwalamukhi, YogaAadal, YogaVidaal, YogaRavi,
}

// SpecialYogaInfo is one special yoga in force. The daily panchang result
// GetDailyPanchang returns lists, in SpecialYogas, every yoga found for any
// tithi and nakshatra that overlap during the day, once per Type in the
// order found; the instant panchang lists those holding at the instant. The
// slice is empty, not nil, when there are none.
type SpecialYogaInfo struct {
	// Name is Type rendered in the requested language, "Amrit Siddhi Yoga"
	// in English.
	Name string `json:"name"`
	// Type is the language-independent key; match on it, not on Name.
	Type SpecialYogaType `json:"type"`
}
