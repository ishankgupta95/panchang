package types

// MasaInfo is the solar month (saura masa) of a daily panchang result: the
// sidereal rashi the Sun occupies at sunrise. Names come from the rashi
// table, so Name is Mesha, Vrishabha and so on in the requested language.
// Produced as [DailyCalendarLabels.Masa].
type MasaInfo struct {
	// Index is the rashi the Sun is in at sunrise, 0 = Mesha through 11 =
	// Meena.
	Index int `json:"index"`
	// Name is the rashi name for Index in the requested language.
	Name string `json:"name"`
}

// ResolvedTimezone is the UTC offset a daily panchang result renders its
// *Local strings in. It is resolved once, at the requested instant, so every
// *Local string in the result uses this one offset even when the zone
// changes its offset later that day.
type ResolvedTimezone struct {
	// OffsetMinutes is minutes east of UTC, for example 330 for IST.
	OffsetMinutes int `json:"offsetMinutes"`
	// Zone is the IANA zone name the caller passed. Empty, and omitted from
	// the JSON, when the caller passed a numeric offset instead.
	Zone string `json:"zone,omitempty"`
}

// SunPosition is the Sun section of an instant panchang result, taken at the
// requested instant.
type SunPosition struct {
	// SiderealLongitude is the Sun's geocentric apparent ecliptic longitude
	// minus the ayanamsa, in degrees in [0, 360).
	SiderealLongitude float64 `json:"siderealLongitude"`
	// Nakshatra is the nakshatra containing SiderealLongitude.
	Nakshatra NakshatraIndexInfo `json:"nakshatra"`
}

// MoonPosition is the Moon section of an instant panchang result, taken at
// the requested instant.
type MoonPosition struct {
	// SiderealLongitude is the Moon's geocentric apparent ecliptic longitude
	// minus the ayanamsa, in degrees in [0, 360).
	SiderealLongitude float64 `json:"siderealLongitude"`
	// Rashi is the rashi containing SiderealLongitude, 0 = Mesha through 11
	// = Meena.
	Rashi RashiInfo `json:"rashi"`
}

// DailySun is the Sun section of a daily panchang result. The Hindu day runs
// from Rise to NextRise with Set inside it, and every window in the result
// is cut from those three instants. Rise, Set and NextRise are upper-limb
// events with 34 arcminutes of refraction, computed for the requested
// location.
type DailySun struct {
	// Rise is the first sunrise at or after local midnight of the requested
	// date in the result timezone. Every UTC instant here is a JSDate.
	Rise JSDate `json:"rise"`
	// Set is the first sunset after Rise.
	Set JSDate `json:"set"`
	// NextRise is the first sunrise after Set; the Hindu day ends here.
	NextRise JSDate `json:"nextRise"`
	// RiseLocal is Rise as ISO 8601 with the result timezone's offset, for
	// example 2025-01-14T07:15:02.410+05:30.
	RiseLocal string `json:"riseLocal"`
	// SetLocal is Set as ISO 8601 with the result timezone's offset.
	SetLocal string `json:"setLocal"`
	// NextRiseLocal is NextRise as ISO 8601 with the result timezone's
	// offset.
	NextRiseLocal string `json:"nextRiseLocal"`
	// DayDurationMinutes is Set minus Rise, rounded to whole minutes.
	DayDurationMinutes int `json:"dayDurationMinutes"`
	// NightDurationMinutes is NextRise minus Set, rounded to whole minutes.
	NightDurationMinutes int `json:"nightDurationMinutes"`
	// DinamanaMinutes is the classical name for, and the same number as,
	// DayDurationMinutes.
	DinamanaMinutes int `json:"dinamanaMinutes"`
	// RatrimanaMinutes is the classical name for, and the same number as,
	// NightDurationMinutes.
	RatrimanaMinutes int `json:"ratrimanaMinutes"`
	// SiderealLongitude is the Sun's sidereal longitude at Rise, in degrees
	// in [0, 360).
	SiderealLongitude float64 `json:"siderealLongitude"`
	// Nakshatra is the nakshatra containing SiderealLongitude at Rise.
	Nakshatra NakshatraIndexInfo `json:"nakshatra"`
}

// DailyMoon is the Moon section of a daily panchang result. Rise and Set are
// pointers because the Moon can skip a rise or a set on a civil day, and
// because the moonTimes section can be left out of the request.
type DailyMoon struct {
	// Rise is the first moonrise at or after local midnight of the requested
	// date. Nil when that moonrise falls on a later civil day, when none is
	// found within two days, or when neither the moonTimes nor the festivals
	// section was requested.
	Rise *JSDate `json:"rise"`
	// Set is the first moonset after Rise, or, when Rise is nil, the first
	// moonset of the civil day itself. Nil when Rise is nil and no moonset
	// falls on that civil day, when none is found within two days, or when
	// the moonTimes section was not requested.
	Set *JSDate `json:"set"`
	// RiseLocal is Rise as ISO 8601 with the result timezone's offset; nil
	// exactly when Rise is nil.
	RiseLocal *string `json:"riseLocal"`
	// SetLocal is Set as ISO 8601 with the result timezone's offset; nil
	// exactly when Set is nil.
	SetLocal *string `json:"setLocal"`
	// SiderealLongitude is the Moon's sidereal longitude at sunrise, in
	// degrees in [0, 360).
	SiderealLongitude float64 `json:"siderealLongitude"`
	// Rashi is the rashi containing SiderealLongitude at sunrise, 0 = Mesha
	// through 11 = Meena.
	Rashi RashiInfo `json:"rashi"`
}

// DailyTithiInfo is one tithi segment of the Hindu day, an entry of
// [DailyAngas.Tithis]: a [TithiInfo] plus the segment's start and end and
// whether it was current at sunrise.
type DailyTithiInfo struct {
	// Index is the tithi within the lunar month, 0 = Shukla Pratipada
	// through 14 = Purnima and 15 = Krishna Pratipada through 29 = Amavasya,
	// from the Moon minus Sun elongation in 12 degree steps.
	Index int `json:"index"`
	// Name is the tithi name for Index in the requested language.
	Name string `json:"name"`
	// Paksha is the localized paksha name: Shukla when Index is below 15,
	// Krishna otherwise.
	Paksha string `json:"paksha"`
	// Number is the tithi within its paksha, 1 to 15: Index+1 in Shukla and
	// Index-14 in Krishna, so both Purnima and Amavasya are 15.
	Number int `json:"number"`
	// CompletionPercentage is how much of the tithi had elapsed when the
	// segment was sampled, 0 to 100 rounded to two decimals: at sunrise for
	// the first entry, at the segment's start for later ones.
	CompletionPercentage float64 `json:"completionPercentage"`
	// EndTime is when the tithi ends, clamped to next sunrise for the last
	// segment so the segments tile the Hindu day. Nil when ComputeEndTimes
	// is false.
	EndTime *JSDate `json:"endTime"`
	// StartTime is when the tithi began: the true boundary instant for the
	// first entry, however far before sunrise, and the previous segment's
	// end for later ones. Nil when ComputeEndTimes is false.
	StartTime *JSDate `json:"startTime"`
	// IsActiveAtSunrise is true only for the first entry, the tithi current
	// at sunrise.
	IsActiveAtSunrise bool `json:"isActiveAtSunrise"`
	// StartTimeLocal is StartTime as ISO 8601 with the result timezone's
	// offset; nil exactly when StartTime is nil.
	StartTimeLocal *string `json:"startTimeLocal"`
	// EndTimeLocal is EndTime as ISO 8601 with the result timezone's offset;
	// nil exactly when EndTime is nil.
	EndTimeLocal *string `json:"endTimeLocal"`
}

// DailyNakshatraInfo is one nakshatra segment of the Hindu day, an entry of
// [DailyAngas.Nakshatras]: a [NakshatraInfo] plus the segment's start and
// end and whether it was current at sunrise.
type DailyNakshatraInfo struct {
	// Index is the nakshatra the Moon is in, 0 = Ashwini through 26 =
	// Revati, each spanning 360/27 degrees of sidereal longitude.
	Index int `json:"index"`
	// Name is the nakshatra name for Index in the requested language.
	Name string `json:"name"`
	// Pada is the quarter of the nakshatra the Moon is in, 1 to 4.
	Pada int `json:"pada"`
	// DegreesInNakshatra is how far the Moon has travelled into the
	// nakshatra, 0 to 13.3333 degrees, rounded to four decimals.
	DegreesInNakshatra float64 `json:"degreesInNakshatra"`
	// CompletionPercentage is how much of the nakshatra had elapsed when the
	// segment was sampled, 0 to 100 rounded to two decimals: at sunrise for
	// the first entry, at the segment's start for later ones.
	CompletionPercentage float64 `json:"completionPercentage"`
	// EndTime is when the nakshatra ends, clamped to next sunrise for the
	// last segment. Nil when ComputeEndTimes is false.
	EndTime *JSDate `json:"endTime"`
	// StartTime is when the nakshatra began: the true boundary instant for
	// the first entry, however far before sunrise, and the previous
	// segment's end for later ones. Nil when ComputeEndTimes is false.
	StartTime *JSDate `json:"startTime"`
	// IsActiveAtSunrise is true only for the first entry, the nakshatra
	// current at sunrise.
	IsActiveAtSunrise bool `json:"isActiveAtSunrise"`
	// StartTimeLocal is StartTime as ISO 8601 with the result timezone's
	// offset; nil exactly when StartTime is nil.
	StartTimeLocal *string `json:"startTimeLocal"`
	// EndTimeLocal is EndTime as ISO 8601 with the result timezone's offset;
	// nil exactly when EndTime is nil.
	EndTimeLocal *string `json:"endTimeLocal"`
}

// DailyYogaInfo is one yoga segment of the Hindu day, an entry of
// [DailyAngas.Yogas]: a [YogaInfo] plus the segment's start and end and
// whether it was current at sunrise.
type DailyYogaInfo struct {
	// Index is the yoga, 0 = Vishkambha through 26 = Vaidhriti, from the sum
	// of the Sun's and Moon's sidereal longitudes in 360/27 degree steps.
	Index int `json:"index"`
	// Name is the yoga name for Index in the requested language.
	Name string `json:"name"`
	// CompletionPercentage is how much of the yoga had elapsed when the
	// segment was sampled, 0 to 100 rounded to two decimals: at sunrise for
	// the first entry, at the segment's start for later ones.
	CompletionPercentage float64 `json:"completionPercentage"`
	// EndTime is when the yoga ends, clamped to next sunrise for the last
	// segment. Nil when ComputeEndTimes is false.
	EndTime *JSDate `json:"endTime"`
	// StartTime is when the yoga began: the true boundary instant for the
	// first entry, however far before sunrise, and the previous segment's
	// end for later ones. Nil when ComputeEndTimes is false.
	StartTime *JSDate `json:"startTime"`
	// IsActiveAtSunrise is true only for the first entry, the yoga current
	// at sunrise.
	IsActiveAtSunrise bool `json:"isActiveAtSunrise"`
	// StartTimeLocal is StartTime as ISO 8601 with the result timezone's
	// offset; nil exactly when StartTime is nil.
	StartTimeLocal *string `json:"startTimeLocal"`
	// EndTimeLocal is EndTime as ISO 8601 with the result timezone's offset;
	// nil exactly when EndTime is nil.
	EndTimeLocal *string `json:"endTimeLocal"`
}

// DailyKaranaInfo is one karana segment of the Hindu day, an entry of
// [DailyAngas.Karanas]: a [KaranaInfo] plus the segment's start and end and
// whether it was current at sunrise.
type DailyKaranaInfo struct {
	// Index is the karana within the lunar month, 0 to 59, from the Moon
	// minus Sun elongation in 6 degree steps (two per tithi).
	Index int `json:"index"`
	// Name is the karana name for Index in the requested language.
	Name string `json:"name"`
	// Type is KaranaFixed for Index 0 and 57 to 59, the four fixed karanas
	// at the month's ends, and KaranaMovable otherwise.
	Type KaranaType `json:"type"`
	// CompletionPercentage is how much of the karana had elapsed when the
	// segment was sampled, 0 to 100 rounded to two decimals: at sunrise for
	// the first entry, at the segment's start for later ones.
	CompletionPercentage float64 `json:"completionPercentage"`
	// EndTime is when the karana ends, clamped to next sunrise for the last
	// segment. Nil when ComputeEndTimes is false.
	EndTime *JSDate `json:"endTime"`
	// StartTime is when the karana began: the true boundary instant for the
	// first entry, however far before sunrise, and the previous segment's
	// end for later ones. Nil when ComputeEndTimes is false.
	StartTime *JSDate `json:"startTime"`
	// IsActiveAtSunrise is true only for the first entry, the karana current
	// at sunrise.
	IsActiveAtSunrise bool `json:"isActiveAtSunrise"`
	// StartTimeLocal is StartTime as ISO 8601 with the result timezone's
	// offset; nil exactly when StartTime is nil.
	StartTimeLocal *string `json:"startTimeLocal"`
	// EndTimeLocal is EndTime as ISO 8601 with the result timezone's offset;
	// nil exactly when EndTime is nil.
	EndTimeLocal *string `json:"endTimeLocal"`
}

// DailyAngas lists every tithi, nakshatra, yoga and karana that runs during
// the Hindu day, sunrise to next sunrise, plus the weekday. Entry 0 of each
// slice is the anga current at sunrise, the one almanacs print; later
// entries are the transitions before next sunrise in time order. When
// ComputeEndTimes is false each slice holds exactly that first entry, with
// nil start and end times.
type DailyAngas struct {
	// Tithis is the tithi sequence of the day, at most three entries.
	Tithis []DailyTithiInfo `json:"tithis"`
	// Nakshatras is the nakshatra sequence of the day, at most three
	// entries.
	Nakshatras []DailyNakshatraInfo `json:"nakshatras"`
	// Yogas is the yoga sequence of the day, at most three entries.
	Yogas []DailyYogaInfo `json:"yogas"`
	// Karanas is the karana sequence of the day, at most five entries since
	// a karana is half a tithi.
	Karanas []DailyKaranaInfo `json:"karanas"`
	// Vara is the weekday of the day's sunrise in the result timezone, Index
	// 0 = Sunday through 6 = Saturday.
	Vara VaraInfo `json:"vara"`
}

// InstantAngas holds the five angas at the instant of an instant panchang
// result. Each element's EndTime is the boundary that follows the instant
// (searched up to 36 hours ahead, 18 for the karana), and is nil when
// ComputeEndTimes is false.
type InstantAngas struct {
	// Tithi is the tithi at the instant.
	Tithi TithiInfo `json:"tithi"`
	// Nakshatra is the Moon's nakshatra at the instant.
	Nakshatra NakshatraInfo `json:"nakshatra"`
	// Yoga is the yoga at the instant.
	Yoga YogaInfo `json:"yoga"`
	// Karana is the karana at the instant.
	Karana KaranaInfo `json:"karana"`
	// Vara is the weekday of the last sunrise at or before the instant,
	// taken in the location's local mean time (longitude times four
	// minutes), not in a civil timezone. Index 0 = Sunday.
	Vara VaraInfo `json:"vara"`
}

// CalendarLabels is the lunar calendar position of an instant panchang
// result, taken at the requested instant.
type CalendarLabels struct {
	// Chandramasa is the lunar month, in the requested MasaSystem
	// (Purnimanta by default) with both systems' names alongside.
	Chandramasa ChandraMasaInfo `json:"chandramasa"`
	// Samvat is the Vikram and Shaka year and their samvatsara names.
	Samvat SamvatInfo `json:"samvat"`
}

// DailyCalendarLabels is the calendar position of a daily panchang result,
// taken at sunrise: [CalendarLabels] plus the solar month.
type DailyCalendarLabels struct {
	// Masa is the solar month: the rashi the Sun occupies at sunrise.
	Masa MasaInfo `json:"masa"`
	// Chandramasa is the lunar month at sunrise, in the requested MasaSystem
	// (Purnimanta by default) with both systems' names alongside.
	Chandramasa ChandraMasaInfo `json:"chandramasa"`
	// Samvat is the Vikram and Shaka year at sunrise and their samvatsara
	// names.
	Samvat SamvatInfo `json:"samvat"`
}

// MuhurtaWindows is the auspicious-window section of a daily panchang
// result. Every window is cut from the day's sunrise, sunset and next
// sunrise: a day-muhurta is one fifteenth of the daylight and a
// night-muhurta one fifteenth of the night, so their lengths vary with the
// season. Instants are UTC; the *Local strings inside each [TimePeriod]
// carry the result timezone's offset.
type MuhurtaWindows struct {
	// Abhijit is the 8th of the 15 day-muhurtas, 7/15 to 8/15 of the
	// daylight after sunrise, centred on the midpoint of sunrise and sunset.
	// Nil on Wednesday, when it is held inauspicious.
	Abhijit *TimePeriod `json:"abhijit"`
	// Brahma is the 14th of the 15 night-muhurtas, 2/15 to 1/15 of the
	// night (sunset to next sunrise) before sunrise; its midpoint is the
	// start of PratahSandhya.
	Brahma TimePeriod `json:"brahma"`
	// Vijaya is the 11th of the 15 day-muhurtas, 10/15 to 11/15 of the
	// daylight after sunrise.
	Vijaya TimePeriod `json:"vijaya"`
	// Godhuli is sunset plus or minus 24 minutes.
	Godhuli TimePeriod `json:"godhuli"`
	// Nishita is the 8th of the 15 night-muhurtas, 7/15 to 8/15 of the night
	// after sunset, centred on the midpoint of sunset and next sunrise.
	Nishita TimePeriod `json:"nishita"`
	// AmritKala lists the Amrit Kala windows whose start falls in the Hindu
	// day, in time order: zero, one or two. Each nakshatra's window opens a
	// fixed number of ghatikas (sixtieths of that nakshatra's duration)
	// after the nakshatra begins and lasts four ghatikas.
	AmritKala []TimePeriod `json:"amritKala"`
	// Madhyahna is the midpoint of sunrise and sunset plus or minus 24
	// minutes.
	Madhyahna TimePeriod `json:"madhyahna"`
	// PratahSandhya is the dawn twilight: it ends at sunrise and is one
	// tenth of the night length wide.
	PratahSandhya TimePeriod `json:"pratahSandhya"`
	// SayahnaSandhya is the dusk twilight: it starts at sunset and is one
	// tenth of the night length wide.
	SayahnaSandhya TimePeriod `json:"sayahnaSandhya"`
	// DoGhati is the 30 named two-ghati slots, 15 equal ones across the
	// daylight and 15 across the night, each graded by quality.
	DoGhati DoGhatiInfo `json:"doGhati"`
}

// InauspiciousWindows is the inauspicious-period section of a daily panchang
// result. Instants are UTC; the *Local strings inside each [TimePeriod]
// carry the result timezone's offset. The Moon-driven lists (Varjyam,
// PanchakaRahita) are empty when the lunarWindows section was not requested;
// Bhadra is nil when neither the lunarWindows nor the festivals section was
// requested.
type InauspiciousWindows struct {
	// RahuKalam is one of the eight equal daylight slots, which one
	// depending on the weekday.
	RahuKalam TimePeriod `json:"rahuKalam"`
	// GulikaKalam is one of the eight equal daylight slots, which one
	// depending on the weekday.
	GulikaKalam TimePeriod `json:"gulikaKalam"`
	// Yamaganda is one of the eight equal daylight slots, which one
	// depending on the weekday.
	Yamaganda TimePeriod `json:"yamaganda"`
	// DurMuhurta holds the weekday's one or two Dur Muhurta periods, each
	// one fifteenth of the daylight or of the night, tagged with the segment
	// it counts in. Only Tuesday's second period is a night one.
	DurMuhurta []DurMuhurtaPeriod `json:"durMuhurta"`
	// Varjyam lists the Varjyam spells whose start falls in the Hindu day,
	// in time order; a nakshatra-transition day can carry two. Empty when
	// the lunarWindows section was not requested.
	Varjyam []TimePeriod `json:"varjyam"`
	// Bhadra is the Vishti karana window that touches the Hindu day. Nil
	// when no Vishti karana runs between sunrise and next sunrise, or when
	// neither the lunarWindows nor the festivals section was requested.
	Bhadra *BhadraInfo `json:"bhadra"`
	// GandaMula says whether the nakshatra at sunrise is one of the six
	// Ganda Mula nakshatras and how severe it is; its JSON collapses to
	// {"active":false} when it is not.
	GandaMula GandaMulaInfo `json:"gandaMula"`
	// Panchaka is true when the Moon's sidereal longitude at sunrise is 300
	// degrees or more, that is from the start of Kumbha to the end of Meena.
	Panchaka bool `json:"panchaka"`
	// PanchakaInfo classifies an active Panchaka by the weekday it began on.
	// Its Active is false, and its JSON collapses to {"active":false}, when
	// Panchaka is false.
	PanchakaInfo PanchakaInfo `json:"panchakaInfo"`
	// PanchakaRahita lists the part of the Hindu day the Moon is outside
	// Panchaka: the whole day, one slice, or nothing, since the Moon crosses
	// the boundary at most once a day. Empty when the lunarWindows section
	// was not requested.
	PanchakaRahita []TimePeriod `json:"panchakaRahita"`
}

// InstantInauspicious is the inauspicious section of an instant panchang
// result: the flags that hold at a moment rather than over a day, taken at
// the requested instant.
type InstantInauspicious struct {
	// Panchaka is true when the Moon's sidereal longitude at the instant is
	// 300 degrees or more.
	Panchaka bool `json:"panchaka"`
	// PanchakaInfo classifies an active Panchaka by the weekday it began on;
	// Active is false, and the JSON is {"active":false}, otherwise.
	PanchakaInfo PanchakaInfo `json:"panchakaInfo"`
	// GandaMula says whether the Moon's nakshatra at the instant is a Ganda
	// Mula one; the JSON is {"active":false} when it is not.
	GandaMula GandaMulaInfo `json:"gandaMula"`
}

// DayPeriods is the day-division section of a daily panchang result: three
// schemes that split the daylight and the night into equal slots keyed by
// the weekday. Each slot is a [TimePeriod] with *Local strings in the result
// timezone.
type DayPeriods struct {
	// Choghadiya is the eight equal daylight and eight equal night
	// Choghadiya slots.
	Choghadiya ChoghadiyaInfo `json:"choghadiya"`
	// Hora is the twelve equal daylight and twelve equal night planetary
	// hours.
	Hora HoraInfo `json:"hora"`
	// Gowri is the Gowri Panchangam (Nalla Neram), the Tamil scheme of eight
	// equal daylight and eight equal night slots.
	Gowri GowriInfo `json:"gowri"`
}

// FestivalType classifies a [FestivalInfo] entry. The values are the strings
// the JSON carries.
type FestivalType string

const (
	// FestivalMajor marks a principal festival.
	FestivalMajor FestivalType = "major"
	// FestivalMinor marks a lesser or monthly observance, for example
	// masik_shivaratri, vinayaka_chaturthi and masik_karthigai.
	FestivalMinor FestivalType = "minor"
	// FestivalEkadashi marks the general Ekadashi entry, key ekadashi;
	// Description names the specific Ekadashi.
	FestivalEkadashi FestivalType = "ekadashi"
	// FestivalSmartaEkadashi marks the Smarta Ekadashi observance day, key
	// smarta_ekadashi.
	FestivalSmartaEkadashi FestivalType = "smarta_ekadashi"
	// FestivalVaishnavaEkadashi marks the Vaishnava Ekadashi observance day,
	// key vaishnava_ekadashi.
	FestivalVaishnavaEkadashi FestivalType = "vaishnava_ekadashi"
	// FestivalPradosha marks a Pradosha day, key pradosha; Description names
	// the weekday variant.
	FestivalPradosha FestivalType = "pradosha"
	// FestivalSankranti marks the Sun's entry into a rashi (key sankranti,
	// Description names the rashi) and the regional new-year days tied to
	// it, such as baisakhi, vishu and pohela_boishakh.
	FestivalSankranti FestivalType = "sankranti"
	// FestivalEclipse marks the eclipse entry (key surya_grahan or
	// chandra_grahan) that the daily panchang prepends to Festivals when an
	// eclipse falls in the Hindu day.
	FestivalEclipse FestivalType = "eclipse"
)

// AllFestivalTypes lists every [FestivalType] in declaration order.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllFestivalTypes = []FestivalType{
	FestivalMajor, FestivalMinor, FestivalEkadashi, FestivalSmartaEkadashi,
	FestivalVaishnavaEkadashi, FestivalPradosha, FestivalSankranti, FestivalEclipse,
}

// FestivalInfo is one entry of a panchang result's Festivals list.
type FestivalInfo struct {
	// Key is the stable, language-independent id, for example ekadashi or
	// sankranti. Match on it rather than on Name.
	Key string `json:"key"`
	// Name is the display name for Key in the requested language.
	Name string `json:"name"`
	// Type is the entry's classification.
	Type FestivalType `json:"type"`
	// Description is extra localized detail when there is any: the specific
	// Ekadashi's name, the Pradosha variant, the rashi a Sankranti enters, a
	// Purnimanta or Bhadra note, or the eclipse summary. Empty, and omitted
	// from the JSON, otherwise.
	Description string `json:"description,omitempty"`
}

// DailyEclipseInfo is the eclipse of the Hindu day, as
// [DailyPanchangResult.Eclipse] attributes it: an [EclipseInfo] plus the same instants
// rendered in the result timezone. For a solar eclipse the contacts and
// figures are local to the requested location; for a lunar eclipse the
// contacts are penumbral and the figures umbral.
type DailyEclipseInfo struct {
	// Kind is solar or lunar.
	Kind EclipseKind `json:"kind"`
	// Subtype is partial, total or annular for a solar eclipse, as seen
	// from the location with the Sun up, and penumbral, partial or total
	// for a lunar one.
	Subtype EclipseSubtype `json:"subtype"`
	// Start is first contact: where the partial phase begins as seen from
	// the location for a solar eclipse, penumbral first contact for a lunar
	// one.
	Start JSDate `json:"start"`
	// Peak is the instant of greatest eclipse, the least separation of the
	// discs, as seen from the location for a solar eclipse.
	Peak JSDate `json:"peak"`
	// End is last contact: where the partial phase ends as seen from the
	// location for a solar eclipse, penumbral last contact for a lunar one.
	End JSDate `json:"end"`
	// StartLocal is Start as ISO 8601 with the result timezone's offset.
	StartLocal string `json:"startLocal"`
	// PeakLocal is Peak as ISO 8601 with the result timezone's offset.
	PeakLocal string `json:"peakLocal"`
	// EndLocal is End as ISO 8601 with the result timezone's offset.
	EndLocal string `json:"endLocal"`
	// VisibleFromLocation is true when the eclipsed body is above the
	// horizon at Peak as seen from the requested location.
	VisibleFromLocation bool `json:"visibleFromLocation"`
	// Obscuration is the fraction of the disc's area covered at Peak, 0 to
	// 1, even when the body is below the horizon then. For a lunar eclipse
	// it is the umbral cover, so a penumbral eclipse reads 0.
	Obscuration float64 `json:"obscuration"`
	// Magnitude is the fraction of the disc's diameter covered at Peak,
	// above 1 for a total eclipse. For a lunar eclipse it is the umbral
	// magnitude, so a penumbral eclipse reads zero or negative.
	Magnitude float64 `json:"magnitude"`
	// SutakStart is 12 hours before Start for a solar eclipse and 9 hours
	// before umbral first contact for a lunar one. Nil for a penumbral lunar
	// eclipse, which carries no sutak.
	SutakStart *JSDate `json:"sutakStart"`
	// SutakEnd is End for a solar eclipse and umbral last contact for a
	// lunar one. Nil for a penumbral lunar eclipse.
	SutakEnd *JSDate `json:"sutakEnd"`
	// SutakStartLocal is SutakStart as ISO 8601 with the result timezone's
	// offset; nil exactly when SutakStart is nil.
	SutakStartLocal *string `json:"sutakStartLocal"`
	// SutakEndLocal is SutakEnd as ISO 8601 with the result timezone's
	// offset; nil exactly when SutakEnd is nil.
	SutakEndLocal *string `json:"sutakEndLocal"`
	// Description is a localized one-line summary giving the subtype, the
	// kind, the obscuration as a whole percent and the visibility; a solar
	// eclipse whose Peak is below the horizon is described at its deepest
	// phase seen, at sunrise or sunset.
	Description string `json:"description"`
}

// EclipseKind says which body is eclipsed. The values are the strings the
// JSON carries.
type EclipseKind string

const (
	// EclipseSolar is a solar eclipse, the Moon covering the Sun.
	EclipseSolar EclipseKind = "solar"
	// EclipseLunar is a lunar eclipse, the Moon entering Earth's shadow.
	EclipseLunar EclipseKind = "lunar"
)

// EclipseSubtype is the geometric type of an eclipse. Partial and total
// occur for both kinds; annular only for a solar eclipse and penumbral only
// for a lunar one. The values are the strings the JSON carries.
type EclipseSubtype string

const (
	// EclipsePartial covers part of the disc: umbral magnitude between 0 and
	// 1 for a lunar eclipse; for a solar one, the Moon never covers or rings
	// the Sun while the Sun is up at the location.
	EclipsePartial EclipseSubtype = "partial"
	// EclipseTotal covers the whole disc: a lunar eclipse is total when its
	// umbral magnitude reaches 1, a solar one when the Moon's disc is at
	// least as large as the Sun's and the local separation at the deepest
	// phase seen with the Sun up falls inside the difference of the two
	// semidiameters.
	EclipseTotal EclipseSubtype = "total"
	// EclipseAnnular is a solar eclipse where the Moon sits inside the Sun's
	// disc and leaves a ring; solar only.
	EclipseAnnular EclipseSubtype = "annular"
	// EclipsePenumbral is a lunar eclipse that touches only Earth's
	// penumbra: umbral magnitude at or below 0, and no sutak.
	EclipsePenumbral EclipseSubtype = "penumbral"
)

var (
	// AllEclipseKinds lists both kinds, solar then lunar.
	// It is the package's own value, so treat it as read-only: the engine and
	// the panchang All functions keep their own copies, so modifying it changes
	// no result.
	AllEclipseKinds = []EclipseKind{EclipseSolar, EclipseLunar}
	// AllEclipseSubtypes lists every subtype in declaration order: partial,
	// total, annular, penumbral.
	// It is the package's own value, so treat it as read-only: the engine and
	// the panchang All functions keep their own copies, so modifying it changes
	// no result.
	AllEclipseSubtypes = []EclipseSubtype{EclipsePartial, EclipseTotal, EclipseAnnular, EclipsePenumbral}
)

// DailyPanchangResult is the full panchang for one Hindu day, sunrise to
// next sunrise, as GetDailyPanchang returns it for a date, location and
// timezone. Instants are UTC [JSDate] values, which marshal as ISO 8601 UTC
// strings; every *Local string is the same instant as ISO 8601 with the
// result timezone's offset. The angas, calendar labels and positions are
// taken at sunrise. Sections the caller left out of PanchangOptions.Sections
// come back empty or nil rather than absent.
type DailyPanchangResult struct {
	// Date is the requested instant, echoed back unchanged. The Hindu day
	// computed is the one whose sunrise follows local midnight of this
	// instant's civil date in Timezone.
	Date JSDate `json:"date"`
	// Location is the requested location, echoed back unchanged.
	Location GeoLocation `json:"location"`
	// Timezone is the offset every *Local string in the result uses.
	Timezone ResolvedTimezone `json:"timezone"`
	// Ayanamsa is the value of the requested ayanamsa (Lahiri by default) at
	// sunrise, in degrees.
	Ayanamsa float64 `json:"ayanamsa"`
	// Sun is the day's sunrise, sunset and next sunrise, the day and night
	// lengths, and the Sun's position at sunrise.
	Sun DailySun `json:"sun"`
	// Moon is the day's moonrise and moonset, when any, and the Moon's
	// position at sunrise.
	Moon DailyMoon `json:"moon"`
	// Angas is every tithi, nakshatra, yoga and karana of the day, plus the
	// weekday.
	Angas DailyAngas `json:"angas"`
	// Calendar is the solar month, lunar month and samvat at sunrise.
	Calendar DailyCalendarLabels `json:"calendar"`
	// Muhurtas is the day's auspicious windows.
	Muhurtas MuhurtaWindows `json:"muhurtas"`
	// Inauspicious is the day's inauspicious periods and flags.
	Inauspicious InauspiciousWindows `json:"inauspicious"`
	// Periods is the Choghadiya, Hora and Gowri divisions of the day and
	// night.
	Periods DayPeriods `json:"periods"`
	// SpecialYogas lists the special yogas (Amrit Siddhi, Sarvartha Siddhi
	// and the rest) that the weekday forms with any tithi and nakshatra pair
	// overlapping during the day, each type at most once, in the order
	// found. Empty when none.
	SpecialYogas []SpecialYogaInfo `json:"specialYogas"`
	// AnandadiYoga is the Anandadi yoga formed by the weekday and the
	// nakshatra at sunrise.
	AnandadiYoga AnandadiYogaInfo `json:"anandadiYoga"`
	// Festivals lists the day's festivals and observances for the requested
	// region. Empty when there are none or the festivals section was not
	// requested, except that an eclipse entry is still prepended whenever
	// Eclipse is set.
	Festivals []FestivalInfo `json:"festivals"`
	// Eclipse is the eclipse of the Hindu day: a lunar eclipse whose peak
	// falls between sunrise and next sunrise, or a solar eclipse first seen
	// in that span (at its peak, else first contact, else last contact,
	// whichever first has the Sun up). Nil when there is none or the
	// eclipse section was not requested.
	Eclipse *DailyEclipseInfo `json:"eclipse"`
	// ChandraBalam is the Moon's transit position at sunrise counted from
	// the caller's JanmaRashi. Nil unless JanmaRashi was given.
	ChandraBalam *ChandraBalamInfo `json:"chandraBalam"`
	// Tarabala is the Moon's nakshatra at sunrise counted from the caller's
	// JanmaNakshatra. Nil unless JanmaNakshatra was given.
	Tarabala *TarabalaInfo `json:"tarabala"`
}

// InstantPanchangResult is the panchang at one instant, as
// GetInstantPanchang returns it: [DailyPanchangResult] minus what belongs to
// a day rather than a moment (rise and set times, muhurtas, day periods, the
// solar month, the eclipse). Angas and positions are taken at the instant,
// not at sunrise. There is no timezone, so no *Local strings; instants are
// UTC [JSDate] values.
type InstantPanchangResult struct {
	// Timestamp is the requested instant, echoed back unchanged.
	Timestamp JSDate `json:"timestamp"`
	// Location is the requested location, echoed back unchanged.
	Location GeoLocation `json:"location"`
	// Ayanamsa is the value of the requested ayanamsa (Lahiri by default) at
	// Timestamp, in degrees.
	Ayanamsa float64 `json:"ayanamsa"`
	// Sun is the Sun's sidereal longitude and nakshatra at Timestamp.
	Sun SunPosition `json:"sun"`
	// Moon is the Moon's sidereal longitude and rashi at Timestamp.
	Moon MoonPosition `json:"moon"`
	// Angas is the five angas at Timestamp.
	Angas InstantAngas `json:"angas"`
	// Calendar is the lunar month and samvat at Timestamp.
	Calendar CalendarLabels `json:"calendar"`
	// Inauspicious is the Panchaka and Ganda Mula state at Timestamp.
	Inauspicious InstantInauspicious `json:"inauspicious"`
	// SpecialYogas lists the special yogas formed by the weekday, tithi,
	// nakshatra and Sun's nakshatra at Timestamp. Empty when none.
	SpecialYogas []SpecialYogaInfo `json:"specialYogas"`
	// AnandadiYoga is the Anandadi yoga formed by the weekday and the Moon's
	// nakshatra at Timestamp.
	AnandadiYoga AnandadiYogaInfo `json:"anandadiYoga"`
	// Festivals lists the festivals whose rules match the angas at Timestamp
	// for the requested region. Empty when none.
	Festivals []FestivalInfo `json:"festivals"`
	// ChandraBalam is the Moon's rashi at Timestamp counted from the
	// caller's JanmaRashi. Nil unless JanmaRashi was given.
	ChandraBalam *ChandraBalamInfo `json:"chandraBalam"`
	// Tarabala is the Moon's nakshatra at Timestamp counted from the
	// caller's JanmaNakshatra. Nil unless JanmaNakshatra was given.
	Tarabala *TarabalaInfo `json:"tarabala"`
}
