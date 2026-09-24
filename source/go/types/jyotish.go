package types

import (
	"encoding/json"
	"fmt"
)

// Graha is one of the nine grahas of jyotish: the seven visible grahas Sun
// through Saturn followed by the lunar nodes Rahu and Ketu. Values run from
// GrahaSun (0) to GrahaKetu (8) in that order and index arrays of length
// [GrahaCount]. JSON carries a Graha as its English name string ("Sun"
// through "Ketu"), never as a number; see [Graha.MarshalJSON].
type Graha int

const (
	// GrahaSun is the Sun, value 0.
	GrahaSun Graha = iota
	// GrahaMoon is the Moon, value 1.
	GrahaMoon
	// GrahaMars is Mars, value 2.
	GrahaMars
	// GrahaMercury is Mercury, value 3.
	GrahaMercury
	// GrahaJupiter is Jupiter, value 4.
	GrahaJupiter
	// GrahaVenus is Venus, value 5.
	GrahaVenus
	// GrahaSaturn is Saturn, value 6.
	GrahaSaturn
	// GrahaRahu is Rahu, the ascending lunar node, value 7.
	GrahaRahu
	// GrahaKetu is Ketu, the descending lunar node, value 8.
	GrahaKetu
	// GrahaCount is the number of grahas, 9, and the length of AllGrahas.
	// It is an untyped constant so it can size arrays indexed by Graha.
	GrahaCount = 9
)

var grahaNames = [GrahaCount]string{
	"Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu",
}

// AllGrahas lists the nine grahas in value order, Sun, Moon, Mars, Mercury,
// Jupiter, Venus, Saturn, Rahu, Ketu, so AllGrahas[i] == Graha(i).
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllGrahas = [GrahaCount]Graha{
	GrahaSun, GrahaMoon, GrahaMars, GrahaMercury, GrahaJupiter,
	GrahaVenus, GrahaSaturn, GrahaRahu, GrahaKetu,
}

// Valid reports whether g is one of the nine defined grahas, 0 to 8.
func (g Graha) Valid() bool { return g >= 0 && g < GrahaCount }

// String returns the English name, "Sun" through "Ketu", or "Graha(n)" with
// the numeric value for a g outside the defined range.
func (g Graha) String() string {
	if !g.Valid() {
		return fmt.Sprintf("Graha(%d)", int(g))
	}
	return grahaNames[g]
}

// MarshalJSON emits the English name as a JSON string, for example
// "Jupiter". A g outside the defined range returns a [PanchangError] with
// code [ErrInvalidInput].
func (g Graha) MarshalJSON() ([]byte, error) {
	if !g.Valid() {
		return nil, NewPanchangError(fmt.Sprintf("graha out of range: %d", int(g)), ErrInvalidInput)
	}
	return []byte(`"` + grahaNames[g] + `"`), nil
}

// UnmarshalJSON accepts exactly the nine name strings [Graha.String]
// produces, case sensitive. A non-string JSON value or an unknown name
// returns a [PanchangError] with code [ErrInvalidInput] and leaves g
// unchanged.
func (g *Graha) UnmarshalJSON(b []byte) error {
	var name string
	if err := json.Unmarshal(b, &name); err != nil {
		return NewPanchangError("graha must be a JSON string: "+err.Error(), ErrInvalidInput)
	}
	for i, n := range grahaNames {
		if n == name {
			*g = Graha(i)
			return nil
		}
	}
	return NewPanchangError("unknown graha: "+name, ErrInvalidInput)
}

// Visible narrows g to the [VisibleGraha] with the same value. The bool is
// false, and the VisibleGraha 0, for Rahu, Ketu and any g outside the
// defined range.
func (g Graha) Visible() (VisibleGraha, bool) {
	if g < 0 || g >= VisibleGrahaCount {
		return 0, false
	}
	return VisibleGraha(g), true
}

// IsNode reports whether g is a lunar node, Rahu or Ketu.
func (g Graha) IsNode() bool { return g == GrahaRahu || g == GrahaKetu }

// VisibleGraha is one of the seven physical grahas, Sun through Saturn, with
// the nodes Rahu and Ketu excluded. Shadbala and ashtakavarga results are
// keyed by it and the lordship fields (sign lord, year lord, arudha lord)
// hold one. Values equal the matching [Graha] values, VisibleSun (0) to
// VisibleSaturn (6), and index arrays of length [VisibleGrahaCount]. JSON
// carries the same English name string as [Graha].
type VisibleGraha int

const (
	// VisibleSun is the Sun, value 0, the same value as GrahaSun.
	VisibleSun VisibleGraha = iota
	// VisibleMoon is the Moon, value 1.
	VisibleMoon
	// VisibleMars is Mars, value 2.
	VisibleMars
	// VisibleMercury is Mercury, value 3.
	VisibleMercury
	// VisibleJupiter is Jupiter, value 4.
	VisibleJupiter
	// VisibleVenus is Venus, value 5.
	VisibleVenus
	// VisibleSaturn is Saturn, value 6, the last visible graha.
	VisibleSaturn
	// VisibleGrahaCount is the number of visible grahas, 7, and the length
	// of AllVisibleGrahas. It is an untyped constant so it can size arrays
	// indexed by VisibleGraha.
	VisibleGrahaCount = 7
)

// AllVisibleGrahas lists the seven visible grahas in value order, Sun, Moon,
// Mars, Mercury, Jupiter, Venus, Saturn, so AllVisibleGrahas[i] ==
// VisibleGraha(i).
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllVisibleGrahas = [VisibleGrahaCount]VisibleGraha{
	VisibleSun, VisibleMoon, VisibleMars, VisibleMercury,
	VisibleJupiter, VisibleVenus, VisibleSaturn,
}

// Valid reports whether v is one of the seven visible grahas, 0 to 6.
func (v VisibleGraha) Valid() bool { return v >= 0 && v < VisibleGrahaCount }

// Graha widens v to the [Graha] with the same value and name.
func (v VisibleGraha) Graha() Graha { return Graha(v) }

// String returns the English name of the widened [Graha], so "Sun" through
// "Saturn" for a valid v, "Rahu" or "Ketu" for 7 or 8, and "Graha(n)" with
// the numeric value for any other v.
func (v VisibleGraha) String() string { return v.Graha().String() }

// MarshalJSON emits the English name as a JSON string, exactly as
// [Graha.MarshalJSON] does for the widened value: 7 and 8 marshal as "Rahu"
// and "Ketu" without error, and any other v outside 0 to 6 returns a
// [PanchangError] with code [ErrInvalidInput].
func (v VisibleGraha) MarshalJSON() ([]byte, error) { return v.Graha().MarshalJSON() }

// UnmarshalJSON accepts the seven visible graha name strings, case
// sensitive. "Rahu", "Ketu", an unknown name or a non-string JSON value
// returns a [PanchangError] with code [ErrInvalidInput] and leaves v
// unchanged.
func (v *VisibleGraha) UnmarshalJSON(b []byte) error {
	var g Graha
	if err := g.UnmarshalJSON(b); err != nil {
		return err
	}
	nv, ok := g.Visible()
	if !ok {
		return NewPanchangError("not a visible graha: "+g.String(), ErrInvalidInput)
	}
	*v = nv
	return nil
}

// GrahaPosition is the sidereal position of one graha at one instant, one of
// the nine entries of [PlanetaryPositions] that the session method
// ComputePlanetaryPositions returns. Longitudes are geocentric ecliptic
// longitudes in degrees with the requested ayanamsa subtracted.
type GrahaPosition struct {
	// Planet identifies the graha; JSON carries its name string.
	Planet Graha `json:"planet"`
	// SiderealLongitude is the geocentric ecliptic longitude in degrees, 0
	// inclusive to 360 exclusive, with the ayanamsa already subtracted.
	SiderealLongitude float64 `json:"siderealLongitude"`
	// Rashi is the sign holding the longitude. Index is 0-based, 0 = Mesha
	// (Aries) through 11 = Meena; Name comes from the rashiName callback, or
	// is the index in decimal when no callback was given.
	Rashi RashiInfo `json:"rashi"`
	// DegreeInRashi is the longitude within the sign, in degrees, 0
	// inclusive to 30 exclusive.
	DegreeInRashi float64 `json:"degreeInRashi"`
	// Nakshatra is the nakshatra and pada holding the longitude. Index is
	// 0-based, 0 = Ashwini through 26 = Revati, Pada is 1 to 4, and EndTime
	// is always nil because no transit is computed for a planetary position.
	Nakshatra NakshatraInfo `json:"nakshatra"`
	// IsRetrograde is true when the tropical longitude one hour after the
	// instant is behind the longitude one hour before it. Always false for
	// the Sun and Moon and always true for Rahu and Ketu.
	IsRetrograde bool `json:"isRetrograde"`
}

// PlanetaryPositions holds the [GrahaPosition] of all nine grahas at one
// instant, as returned by the session method ComputePlanetaryPositions and
// used as the natal basis of every birth chart. Rahu is the mean or true
// node per the [NodeType] requested and Ketu is Rahu plus 180 degrees.
// [PlanetaryPositions.Get] and [PlanetaryPositions.Set] address the fields
// by [Graha]; ranging over [AllGrahas] visits them in field order.
type PlanetaryPositions struct {
	// Sun is the position of the Sun; IsRetrograde is always false.
	Sun GrahaPosition `json:"sun"`
	// Moon is the position of the Moon; IsRetrograde is always false.
	Moon GrahaPosition `json:"moon"`
	// Mars is the position of Mars.
	Mars GrahaPosition `json:"mars"`
	// Mercury is the position of Mercury.
	Mercury GrahaPosition `json:"mercury"`
	// Jupiter is the position of Jupiter.
	Jupiter GrahaPosition `json:"jupiter"`
	// Venus is the position of Venus.
	Venus GrahaPosition `json:"venus"`
	// Saturn is the position of Saturn.
	Saturn GrahaPosition `json:"saturn"`
	// Rahu is the ascending node, mean or true per the requested NodeType;
	// IsRetrograde is always true.
	Rahu GrahaPosition `json:"rahu"`
	// Ketu is the descending node, opposite Rahu: 180 degrees away up to
	// floating-point rounding, since the ayanamsa is subtracted from each
	// separately. IsRetrograde is always true.
	Ketu GrahaPosition `json:"ketu"`
}

// Set stores pos in the field for g and reports true. For a g that is not
// one of the nine grahas it reports false and leaves p unchanged.
func (p *PlanetaryPositions) Set(g Graha, pos GrahaPosition) bool {
	switch g {
	case GrahaSun:
		p.Sun = pos
	case GrahaMoon:
		p.Moon = pos
	case GrahaMars:
		p.Mars = pos
	case GrahaMercury:
		p.Mercury = pos
	case GrahaJupiter:
		p.Jupiter = pos
	case GrahaVenus:
		p.Venus = pos
	case GrahaSaturn:
		p.Saturn = pos
	case GrahaRahu:
		p.Rahu = pos
	case GrahaKetu:
		p.Ketu = pos
	default:
		return false
	}
	return true
}

// Get returns a pointer into p to the field for g, and true. For a g that is
// not one of the nine grahas it returns nil and false.
func (p *PlanetaryPositions) Get(g Graha) (*GrahaPosition, bool) {
	switch g {
	case GrahaSun:
		return &p.Sun, true
	case GrahaMoon:
		return &p.Moon, true
	case GrahaMars:
		return &p.Mars, true
	case GrahaMercury:
		return &p.Mercury, true
	case GrahaJupiter:
		return &p.Jupiter, true
	case GrahaVenus:
		return &p.Venus, true
	case GrahaSaturn:
		return &p.Saturn, true
	case GrahaRahu:
		return &p.Rahu, true
	case GrahaKetu:
		return &p.Ketu, true
	}
	return nil, false
}

// DashaLord is one of the nine Vimshottari dasha lords, numbered in
// Vimshottari order: 0 Ketu, 1 Venus, 2 Sun, 3 Moon, 4 Mars, 5 Rahu, 6
// Jupiter, 7 Saturn, 8 Mercury. Dasha results and the KP star and sub lords
// carry it. MarshalJSON emits the English name as a JSON string ("Ketu"),
// not the number, and UnmarshalJSON reads the same string.
type DashaLord int

const (
	// DashaKetu is Ketu, the first lord of the Vimshottari cycle.
	DashaKetu DashaLord = iota
	// DashaVenus is Venus.
	DashaVenus
	// DashaSun is the Sun.
	DashaSun
	// DashaMoon is the Moon.
	DashaMoon
	// DashaMars is Mars.
	DashaMars
	// DashaRahu is Rahu.
	DashaRahu
	// DashaJupiter is Jupiter.
	DashaJupiter
	// DashaSaturn is Saturn.
	DashaSaturn
	// DashaMercury is Mercury, the last lord of the Vimshottari cycle.
	DashaMercury
	// DashaLordCount is the number of dasha lords, 9, and the size of every
	// array indexed by DashaLord.
	DashaLordCount = 9
)

var dashaLordNames = [DashaLordCount]string{
	"Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
}

// AllDashaLords lists the nine lords in Vimshottari order, Ketu through
// Mercury, so AllDashaLords[i] has value i. The Vimshottari and KP sub-lord
// sequences step through this array cyclically.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllDashaLords = [DashaLordCount]DashaLord{
	DashaKetu, DashaVenus, DashaSun, DashaMoon, DashaMars,
	DashaRahu, DashaJupiter, DashaSaturn, DashaMercury,
}

// Valid reports whether d is one of the nine named lords, 0 to 8.
func (d DashaLord) Valid() bool { return d >= 0 && d < DashaLordCount }

// String returns the English name ("Ketu", "Venus", ...), or "DashaLord(n)"
// for a value outside 0 to 8.
func (d DashaLord) String() string {
	if !d.Valid() {
		return fmt.Sprintf("DashaLord(%d)", int(d))
	}
	return dashaLordNames[d]
}

// MarshalJSON encodes d as its English name in a JSON string, for example
// "Ketu". It returns a [PanchangError] with code [ErrInvalidInput] when d is
// outside 0 to 8.
func (d DashaLord) MarshalJSON() ([]byte, error) {
	if !d.Valid() {
		return nil, NewPanchangError(fmt.Sprintf("dasha lord out of range: %d", int(d)), ErrInvalidInput)
	}
	return []byte(`"` + dashaLordNames[d] + `"`), nil
}

// UnmarshalJSON reads a JSON string holding one of the nine English names
// and sets d. It returns a [PanchangError] with code [ErrInvalidInput] when
// b is not a JSON string or the name is unknown.
func (d *DashaLord) UnmarshalJSON(b []byte) error {
	var name string
	if err := json.Unmarshal(b, &name); err != nil {
		return NewPanchangError("dasha lord must be a JSON string: "+err.Error(), ErrInvalidInput)
	}
	for i, n := range dashaLordNames {
		if n == name {
			*d = DashaLord(i)
			return nil
		}
	}
	return NewPanchangError("unknown dasha lord: "+name, ErrInvalidInput)
}

// Graha returns the [Graha] of the same body, or Graha(-1) when d is not a
// valid lord.
func (d DashaLord) Graha() Graha {
	if !d.Valid() {
		return Graha(-1)
	}
	return dashaLordToGraha[d]
}

// GrahaAsDashaLord returns the [DashaLord] of the same body as g and true,
// or 0 and false when g is not a valid [Graha]. Every graha, Rahu and Ketu
// included, has a dasha lord.
func GrahaAsDashaLord(g Graha) (DashaLord, bool) {
	if !g.Valid() {
		return 0, false
	}
	return grahaToDashaLord[g], true
}

var (
	dashaLordToGraha = [DashaLordCount]Graha{
		DashaKetu: GrahaKetu, DashaVenus: GrahaVenus, DashaSun: GrahaSun,
		DashaMoon: GrahaMoon, DashaMars: GrahaMars, DashaRahu: GrahaRahu,
		DashaJupiter: GrahaJupiter, DashaSaturn: GrahaSaturn, DashaMercury: GrahaMercury,
	}
	grahaToDashaLord = [GrahaCount]DashaLord{
		GrahaSun: DashaSun, GrahaMoon: DashaMoon, GrahaMars: DashaMars,
		GrahaMercury: DashaMercury, GrahaJupiter: DashaJupiter, GrahaVenus: DashaVenus,
		GrahaSaturn: DashaSaturn, GrahaRahu: DashaRahu, GrahaKetu: DashaKetu,
	}
)

// AntarDasha is one sub-period (antardasha, bhukti) of a [MahaDasha]. Within
// a mahadasha the antardashas run in lord order beginning with the
// mahadasha's own lord, each lasting its lord's share of the full mahadasha.
// The first mahadasha drops every antardasha that ended before birth, the
// mahadasha's own included, and starts the one straddling birth at birth, so
// its list can begin with a later lord's antardasha.
// ComputeVimshottariPratyantar takes one as input, and
// ComputeVimshottariPratyantarIn takes the birth-clipped one.
type AntarDasha struct {
	// Lord is the lord of the antardasha.
	Lord DashaLord `json:"lord"`
	// StartDate is the UTC instant the antardasha begins, as epoch
	// milliseconds; JSON renders it as an ISO 8601 string.
	StartDate JSDate `json:"startDate"`
	// EndDate is the UTC instant the antardasha ends and the next begins, as
	// epoch milliseconds; JSON renders it as an ISO 8601 string.
	EndDate JSDate `json:"endDate"`
}

// PratyantarDasha is one of the sub-periods of an [AntarDasha] that
// ComputeVimshottariPratyantar and ComputeVimshottariPratyantarIn return. They
// run in Vimshottari order beginning with the antardasha's own lord, each
// taking its lord's Vimshottari years out of 120 of the full antardasha, and
// the last ends exactly when the antardasha does. For an antardasha clipped at
// birth, ComputeVimshottariPratyantarIn drops those over before birth, so its
// list can hold fewer than nine.
type PratyantarDasha struct {
	// Lord is the lord of the pratyantardasha.
	Lord DashaLord `json:"lord"`
	// StartDate is the UTC instant the pratyantardasha begins, as epoch
	// milliseconds; JSON renders it as an ISO 8601 string.
	StartDate JSDate `json:"startDate"`
	// EndDate is the UTC instant the pratyantardasha ends and the next
	// begins, as epoch milliseconds; JSON renders it as an ISO 8601 string.
	EndDate JSDate `json:"endDate"`
}

// MahaDasha is one major period of a [VimshottariDashaResult], with its
// antardashas. The first mahadasha of a result is the one running at birth,
// so its dates cover only the balance remaining at birth.
type MahaDasha struct {
	// Lord is the lord of the mahadasha.
	Lord DashaLord `json:"lord"`
	// StartDate is the UTC instant the mahadasha begins, as epoch
	// milliseconds; for the first entry it is the birth instant. JSON
	// renders it as an ISO 8601 string.
	StartDate JSDate `json:"startDate"`
	// EndDate is the UTC instant the mahadasha ends and the next begins, as
	// epoch milliseconds; JSON renders it as an ISO 8601 string.
	EndDate JSDate `json:"endDate"`
	// Years is the lord's full mahadasha length in years (Vimshottari 6 to
	// 20, Ashtottari 6 to 21). It stays the full length for the first entry,
	// whose StartDate to EndDate span is only the balance at birth.
	Years float64 `json:"years"`
	// AntarDashas holds the sub-periods in order, the last ending exactly at
	// EndDate. Every mahadasha but the first begins with Lord's own
	// antardasha; the first mahadasha drops every antardasha that ended
	// before birth, Lord's own included, so its list can begin with a later
	// lord's antardasha and hold fewer than nine (eight in Ashtottari).
	AntarDashas []AntarDasha `json:"antarDashas"`
}

// VimshottariDashaResult is the mahadasha sequence from birth that
// ComputeVimshottariDasha, ComputeVimshottariDashaFromBirth and
// ComputeAshtottariDasha return: nine Vimshottari mahadashas covering 120
// years, or eight Ashtottari ones covering 108. Years are 365.25 days and
// every instant is UTC.
type VimshottariDashaResult struct {
	// CurrentMahaDashaLord is the lord of MahaDashas[CurrentIndex].
	CurrentMahaDashaLord DashaLord `json:"currentMahaDashaLord"`
	// CurrentIndex is the 0-based position in MahaDashas of the period
	// holding the as-of instant (StartDate <= asOf < EndDate). It is 0 when
	// the instant falls outside every mahadasha.
	CurrentIndex int `json:"currentIndex"`
	// MahaDashas lists the mahadashas in cycle order starting with the one
	// running at birth: nine for Vimshottari, eight for Ashtottari.
	MahaDashas []MahaDasha `json:"mahaDashas"`
}

// ChandraBalamQuality says whether the transiting Moon is strong or weak
// from the natal Moon sign. It is a plain string in JSON.
type ChandraBalamQuality string

const (
	// ChandraBalamStrong is Shubha: the transit Moon in house 1, 3, 6, 7, 10
	// or 11 from the janma rashi.
	ChandraBalamStrong ChandraBalamQuality = "strong"
	// ChandraBalamWeak is Ashubha: the transit Moon in any other house.
	ChandraBalamWeak ChandraBalamQuality = "weak"
)

// AllChandraBalamQualities lists both qualities, strong then weak.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllChandraBalamQualities = []ChandraBalamQuality{ChandraBalamStrong, ChandraBalamWeak}

// ChandraBalamInfo is the transiting Moon's strength relative to a natal
// Moon rashi, as ComputeChandraBalam returns it and as the daily and instant
// panchang results carry it (as a pointer, nil unless the JanmaRashi option
// is set). Strong houses are 1, 3, 6, 7, 10 and 11 from the janma rashi
// (BPHS chapter 3).
type ChandraBalamInfo struct {
	// House is the transit Moon rashi counted from the janma rashi, 1 when
	// they coincide through 12.
	House int `json:"house"`
	// Quality is strong for House 1, 3, 6, 7, 10 or 11, otherwise weak.
	Quality ChandraBalamQuality `json:"quality"`
	// EnglishName is "Shubha" when Quality is strong and "Ashubha" when
	// weak, regardless of the requested language.
	EnglishName string `json:"englishName"`
	// Name is the same label in the requested language (Hindi gives
	// "शुभ" or "अशुभ").
	Name string `json:"name"`
}

// LagnaInfo is a lagna (ascendant) at the birth instant: the rising point
// ComputeLagna returns, and the special lagnas ComputeHoraLagna,
// ComputeGhatiLagna, ComputeBhavaLagna and ComputeSripatiLagna return. It is
// also the Lagna of a [BirthChart]. Angles are sidereal degrees under the
// requested ayanamsa, and names are in the requested language.
type LagnaInfo struct {
	// SiderealLongitude is the lagna's sidereal ecliptic longitude in
	// degrees, 0 (inclusive) to 360.
	SiderealLongitude float64 `json:"siderealLongitude"`
	// Rashi is the sign holding the lagna; Index is 0 for Mesha through 11
	// for Meena and Name is localized.
	Rashi RashiInfo `json:"rashi"`
	// DegreeInRashi is the lagna's offset into Rashi in degrees, 0 to 30.
	DegreeInRashi float64 `json:"degreeInRashi"`
	// Nakshatra is the nakshatra holding the lagna, index and name only; its
	// pada is in Pada.
	Nakshatra LagnaNakshatra `json:"nakshatra"`
	// Pada is the quarter of Nakshatra the lagna falls in, 1 to 4.
	Pada int `json:"pada"`
}

// LagnaNakshatra is the nakshatra of a [LagnaInfo]: index and localized name
// only, without the pada, degrees and end time a [NakshatraInfo] carries.
type LagnaNakshatra struct {
	// Index is 0 for Ashwini through 26 for Revati.
	Index int `json:"index"`
	// Name is the nakshatra name in the requested language.
	Name string `json:"name"`
}

// SripatiLagnaInfo is a [LagnaInfo] extended with the twelve Sripati house
// cusps (bhava madhyas), as the session method ComputeSripatiLagnaWithCusps
// in the panchang package returns it. The embedded lagna is the same one
// ComputeLagna gives; only the cusps are Sripati's.
type SripatiLagnaInfo struct {
	LagnaInfo
	// Cusps holds twelve sidereal longitudes in degrees, 0 to 360; Cusps[i]
	// is the bhava madhya of house i+1. Cusps[0] is the ascendant, Cusps[3]
	// the IC, Cusps[6] the descendant and Cusps[9] the MC, with each
	// quadrant between them trisected.
	Cusps []float64 `json:"cusps"`
}

// HouseSystem selects how [BhavaChart] cusps are drawn. It is the
// HouseSystem field of BirthChartOptions, where the empty string means
// [HouseSystemWholeSign], and any other unknown value is rejected with
// [ErrInvalidInput]. It is a plain string in JSON.
type HouseSystem string

const (
	// HouseSystemWholeSign starts every house at a rashi boundary: cusp 1 is
	// the start of the ascendant's rashi and each next cusp is 30 degrees
	// on. It is the default.
	HouseSystemWholeSign HouseSystem = "whole-sign"
	// HouseSystemEqual starts house 1 at the ascendant itself and each next
	// cusp 30 degrees on.
	HouseSystemEqual HouseSystem = "equal"
	// HouseSystemPlacidusKP computes Placidus cusps, the system KP uses.
	// ComputeBhava then fails with ErrCircumpolar at latitudes where a
	// cusp is undefined and ErrPlacidusDiverged if the iteration does not
	// converge; both happen only beyond the polar circles (|latitude| above
	// about 66.56 degrees).
	HouseSystemPlacidusKP HouseSystem = "placidus-kp"
)

// AllHouseSystems lists the three house systems: whole-sign, equal,
// placidus-kp.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllHouseSystems = []HouseSystem{
	HouseSystemWholeSign, HouseSystemEqual, HouseSystemPlacidusKP,
}

// HouseInfo is one house of a [BhavaChart]: its cusp longitude and the rashi
// that longitude falls in.
type HouseInfo struct {
	// House is the house number, 1 to 12.
	House int `json:"house"`
	// CuspLongitude is the cusp's sidereal ecliptic longitude in degrees, 0
	// (inclusive) to 360, under the chart's ayanamsa.
	CuspLongitude float64 `json:"cuspLongitude"`
	// Rashi is the sign holding the cusp; Index is 0 for Mesha through 11
	// for Meena and Name is localized.
	Rashi RashiInfo `json:"rashi"`
	// DegreeInRashi is the cusp's offset into Rashi in degrees, 0 to 30.
	DegreeInRashi float64 `json:"degreeInRashi"`
}

// BhavaChart is the twelve house cusps ComputeBhava returns, and the Bhava
// of a [BirthChart]. Angles are sidereal degrees under the chart ayanamsa.
type BhavaChart struct {
	// System is the house system the cusps were drawn with, after the empty
	// default resolved to whole-sign.
	System HouseSystem `json:"system"`
	// Houses holds the twelve houses in order, Houses[0] being house 1.
	Houses []HouseInfo `json:"houses"`
	// AscendantLongitude is the lagna's sidereal longitude in degrees, the
	// same value as LagnaInfo.SiderealLongitude. Under whole-sign it differs
	// from Houses[0].CuspLongitude, which is the rashi start.
	AscendantLongitude float64 `json:"ascendantLongitude"`
	// MCLongitude is the sidereal longitude of the midheaven in degrees, 0
	// to 360. It is the same under every house system and equals
	// Houses[9].CuspLongitude only under placidus-kp.
	MCLongitude float64 `json:"mcLongitude"`
}

// PlanetPlacement is one graha placed in a [BirthChart] or
// [DivisionalChart]: its sidereal longitude, rashi and house. In a
// divisional chart Longitude, Rashi and DegreeInRashi are the transformed
// (varga) values, not the D1 ones.
type PlanetPlacement struct {
	// Planet is the graha placed.
	Planet Graha `json:"planet"`
	// Longitude is the sidereal ecliptic longitude in degrees, 0 (inclusive)
	// to 360: the natal longitude in D1, the varga longitude in a divisional
	// chart.
	Longitude float64 `json:"longitude"`
	// Rashi is the sign holding Longitude; Index is 0 for Mesha through 11
	// for Meena and Name is localized.
	Rashi RashiInfo `json:"rashi"`
	// DegreeInRashi is the offset of Longitude into Rashi in degrees, 0 to
	// 30.
	DegreeInRashi float64 `json:"degreeInRashi"`
	// House is the house holding the graha, 1 to 12. In D1 it is found from
	// the cusps of the chart's house system; in a divisional chart it is
	// counted whole-sign from the divisional lagna rashi.
	House int `json:"house"`
	// IsRetrograde reports retrograde motion at birth, copied from the natal
	// position in every chart.
	IsRetrograde bool `json:"isRetrograde"`
}

// PlanetsByGraha is the ByPlanet lookup of a [BirthChart], one
// [PlanetPlacement] per graha, filled from the chart's Planets slice. Its
// JSON keys are the capitalized graha names ("Sun", "Rahu"). Use
// [PlanetsByGraha.Get] and [PlanetsByGraha.Set] to address a field by
// [Graha].
type PlanetsByGraha struct {
	// Sun is the placement of the Sun.
	Sun PlanetPlacement `json:"Sun"`
	// Moon is the placement of the Moon.
	Moon PlanetPlacement `json:"Moon"`
	// Mars is the placement of Mars.
	Mars PlanetPlacement `json:"Mars"`
	// Mercury is the placement of Mercury.
	Mercury PlanetPlacement `json:"Mercury"`
	// Jupiter is the placement of Jupiter.
	Jupiter PlanetPlacement `json:"Jupiter"`
	// Venus is the placement of Venus.
	Venus PlanetPlacement `json:"Venus"`
	// Saturn is the placement of Saturn.
	Saturn PlanetPlacement `json:"Saturn"`
	// Rahu is the placement of Rahu.
	Rahu PlanetPlacement `json:"Rahu"`
	// Ketu is the placement of Ketu.
	Ketu PlanetPlacement `json:"Ketu"`
}

// Set stores p as the placement of g. It reports false, and changes nothing,
// when g is not one of the nine grahas.
func (b *PlanetsByGraha) Set(g Graha, p PlanetPlacement) bool {
	switch g {
	case GrahaSun:
		b.Sun = p
	case GrahaMoon:
		b.Moon = p
	case GrahaMars:
		b.Mars = p
	case GrahaMercury:
		b.Mercury = p
	case GrahaJupiter:
		b.Jupiter = p
	case GrahaVenus:
		b.Venus = p
	case GrahaSaturn:
		b.Saturn = p
	case GrahaRahu:
		b.Rahu = p
	case GrahaKetu:
		b.Ketu = p
	default:
		return false
	}
	return true
}

// Get returns a pointer to the placement of g, into b itself, and true; or
// nil and false when g is not one of the nine grahas.
func (b *PlanetsByGraha) Get(g Graha) (*PlanetPlacement, bool) {
	switch g {
	case GrahaSun:
		return &b.Sun, true
	case GrahaMoon:
		return &b.Moon, true
	case GrahaMars:
		return &b.Mars, true
	case GrahaMercury:
		return &b.Mercury, true
	case GrahaJupiter:
		return &b.Jupiter, true
	case GrahaVenus:
		return &b.Venus, true
	case GrahaSaturn:
		return &b.Saturn, true
	case GrahaRahu:
		return &b.Rahu, true
	case GrahaKetu:
		return &b.Ketu, true
	}
	return nil, false
}

// BirthChart is the natal D1 (rashi) chart ComputeRashiChart returns: the
// sidereal lagna, the bhava cusps under the requested house system
// (whole-sign when BirthChartOptions.HouseSystem is empty) and all nine
// grahas placed in houses. It is the input the dosha, aspect and yoga
// helpers take.
type BirthChart struct {
	// Divisional is always "D1" for a rashi chart. It is a plain string, not
	// a Divisional, since D1 is not one of the Divisional values.
	Divisional string `json:"divisional"`
	// Lagna is the ascendant at birth, sidereal under the chart's ayanamsa.
	Lagna LagnaInfo `json:"lagna"`
	// Bhava holds the twelve house cusps that the placements' House numbers
	// are measured against.
	Bhava BhavaChart `json:"bhava"`
	// Planets is one placement per graha, all nine, with House 1 to 12 found
	// from the bhava cusps.
	Planets []PlanetPlacement `json:"planets"`
	// ByPlanet indexes copies of the Planets entries by graha, so one graha
	// can be read without scanning the slice. Unlike the TypeScript library,
	// editing a copy here does not change Planets. The dosha and yoga helpers
	// read Planets, as the TypeScript does, so an edit to Planets reaches them
	// even while ByPlanet still holds the old copy.
	ByPlanet PlanetsByGraha `json:"byPlanet"`
}

// Divisional names a varga (divisional) chart accepted by
// ComputeDivisionalChart: one of the seven [AllDivisionals] members. Any
// other value is an [ErrInvalidInput] error there. It marshals as a plain
// JSON string.
type Divisional string

const (
	// DivisionalD2 is the Hora chart, two halves per rashi.
	DivisionalD2 Divisional = "D2"
	// DivisionalD3 is the Drekkana chart, three parts of 10 degrees per
	// rashi.
	DivisionalD3 Divisional = "D3"
	// DivisionalD7 is the Saptamsa chart, seven parts per rashi.
	DivisionalD7 Divisional = "D7"
	// DivisionalD9 is the Navamsa chart, nine parts per rashi.
	DivisionalD9 Divisional = "D9"
	// DivisionalD10 is the Dasamsa chart, ten parts of 3 degrees per rashi.
	DivisionalD10 Divisional = "D10"
	// DivisionalD12 is the Dwadasamsa chart, twelve parts per rashi.
	DivisionalD12 Divisional = "D12"
	// DivisionalD30 is the Trimsamsa chart, five unequal parts per rashi.
	DivisionalD30 Divisional = "D30"
)

// AllDivisionals lists the seven supported vargas in ascending division
// count: D2, D3, D7, D9, D10, D12, D30.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllDivisionals = []Divisional{
	DivisionalD2, DivisionalD3, DivisionalD7, DivisionalD9,
	DivisionalD10, DivisionalD12, DivisionalD30,
}

// Valid reports whether d is one of the seven supported vargas, D2, D3, D7,
// D9, D10, D12 and D30, the members of [AllDivisionals]. It does not read that
// variable, so modifying it does not change the answer.
func (d Divisional) Valid() bool {
	switch d {
	case DivisionalD2, DivisionalD3, DivisionalD7, DivisionalD9,
		DivisionalD10, DivisionalD12, DivisionalD30:
		return true
	}
	return false
}

// DivisionalChart is a varga chart from ComputeNavamsa (D9) or
// ComputeDivisionalChart. Every longitude in it is the transformed
// divisional longitude, and houses are always whole-sign, counted from the
// divisional lagna's rashi, whatever house system the D1 used.
type DivisionalChart struct {
	// Divisional is the varga this chart was computed for.
	Divisional Divisional `json:"divisional"`
	// LagnaRashi is the rashi of the transformed lagna: Index 0 is Mesha,
	// Name is localized in the chart's language.
	LagnaRashi RashiInfo `json:"lagnaRashi"`
	// Planets is one placement per graha, all nine. Longitude and
	// DegreeInRashi are in the divisional frame, and House is 1 to 12
	// counted whole-sign from LagnaRashi.
	Planets []PlanetPlacement `json:"planets"`
}

// MangalDoshaSeverity grades a Mangal Dosha by how many of the three
// references (lagna, Moon, Venus) flag Mars: none for 0, anshik for 1 or 2,
// purna for all 3. It is graded before cancellations, so purna can sit
// beside Afflicted false. It marshals as a plain JSON string.
type MangalDoshaSeverity string

const (
	// MangalNone means no reference flags Mars.
	MangalNone MangalDoshaSeverity = "none"
	// MangalAnshik (partial) means one or two references flag Mars.
	MangalAnshik MangalDoshaSeverity = "anshik"
	// MangalPurna (full) means all three references flag Mars.
	MangalPurna MangalDoshaSeverity = "purna"
)

// AllMangalDoshaSeverities lists the grades in ascending order: none,
// anshik, purna.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllMangalDoshaSeverities = []MangalDoshaSeverity{MangalNone, MangalAnshik, MangalPurna}

// MangalReference is Mars's placement measured from one reference point (the
// lagna, the Moon or Venus) inside a [MangalDoshaInfo].
type MangalReference struct {
	// Afflicted is true when House is 1, 2, 4, 7, 8 or 12.
	Afflicted bool `json:"afflicted"`
	// House is Mars's house, 1 to 12, counted by rashi from the reference's
	// rashi rather than from the D1 cusps.
	House int `json:"house"`
}

// MangalDoshaInfo is the Manglik verdict ComputeMangalDosha returns for one
// D1 chart: Mars in house 1, 2, 4, 7, 8 or 12 from the lagna, the Moon or
// Venus, less the classical cancellations.
type MangalDoshaInfo struct {
	// Afflicted is true when at least one reference flags Mars and no
	// cancellation applies.
	Afflicted bool `json:"afflicted"`
	// Severity is the grade before cancellations, so it can be anshik or
	// purna while Afflicted is false.
	Severity MangalDoshaSeverity `json:"severity"`
	// FromLagna is Mars counted from the lagna's rashi.
	FromLagna MangalReference `json:"fromLagna"`
	// FromMoon is Mars counted from the Moon's rashi.
	FromMoon MangalReference `json:"fromMoon"`
	// FromVenus is Mars counted from Venus's rashi.
	FromVenus MangalReference `json:"fromVenus"`
	// Cancellations lists, in English, each rule that cleared the dosha:
	// Mars in its own sign (Aries or Scorpio) or exalted in Capricorn, Mars
	// in the same D1 house as Jupiter, the Moon or Venus, or Mars in the
	// 5th, 7th or 9th rashi from Jupiter. It is never nil (JSON []) and is
	// empty when no reference flags Mars.
	Cancellations []string `json:"cancellations"`
}

// MangalCompatibility is the pairwise Manglik verdict
// ComputeMangalCompatibility returns: each native's own [MangalDoshaInfo]
// plus the mutual cancellation rule, under which two Manglik natives cancel
// each other.
type MangalCompatibility struct {
	// Boy is the first chart's own verdict.
	Boy MangalDoshaInfo `json:"boy"`
	// Girl is the second chart's own verdict.
	Girl MangalDoshaInfo `json:"girl"`
	// Afflicted is true only when exactly one of Boy and Girl is afflicted.
	Afflicted bool `json:"afflicted"`
	// Cancellations holds the single entry "both natives Manglik, mutual
	// cancellation" when both are afflicted, and is otherwise empty. It is
	// never nil (JSON []).
	Cancellations []string `json:"cancellations"`
	// Description is a one-line English summary: which natives are Manglik,
	// with their severity when any is, or that neither is.
	Description string `json:"description"`
}

// SadeSatiInfo is the Sade Sati status ComputeSadeSati returns for a natal
// Moon rashi (0-based, 0 is Mesha) at an instant: Saturn's transit of the
// three rashis centred on the Moon (the 12th, the Moon's own and the 2nd),
// located in sidereal longitude under the requested ayanamsa.
type SadeSatiInfo struct {
	// Active is true while Saturn's rashi at the instant is one of the three
	// arc rashis.
	Active bool `json:"active"`
	// Phase is nil (JSON null) when not active. Otherwise 1 means Saturn is
	// in the rashi before the Moon's (the 12th), 2 in the Moon's rashi, 3 in
	// the rashi after it (the 2nd).
	Phase *int `json:"phase"`
	// CurrentArcStart is when Saturn entered the current arc, found to one
	// day resolution. It is nil when not active, and also nil if the scan
	// (12 years back in 7 day steps) finds no exit stable for 90 days.
	CurrentArcStart *JSDate `json:"currentArcStart"`
	// CurrentArcEnd is when Saturn leaves the current arc, found to one day
	// resolution. It is nil when not active, and also nil if the scan (30
	// years forward in 7 day steps) finds no exit stable for 90 days.
	CurrentArcEnd *JSDate `json:"currentArcEnd"`
	// NextArcStart is set only when not active: Saturn's next entry into any
	// of the three arc rashis (a retrograde return into the rashi after the
	// Moon's counts), bisected to within one day. It is nil when active, and
	// nil if no entry lies within 30 years.
	NextArcStart *JSDate `json:"nextArcStart"`
}

// TarabalaQuality says whether a tara is favourable. Vipat (2), Pratyari (4)
// and Vadha (6) are inauspicious; the other six are auspicious. It marshals
// as a plain JSON string.
type TarabalaQuality string

const (
	// TarabalaAuspicious marks the six favourable taras.
	TarabalaAuspicious TarabalaQuality = "auspicious"
	// TarabalaInauspicious marks Vipat, Pratyari and Vadha.
	TarabalaInauspicious TarabalaQuality = "inauspicious"
)

// AllTarabalaQualities lists the two qualities: auspicious, then
// inauspicious.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllTarabalaQualities = []TarabalaQuality{TarabalaAuspicious, TarabalaInauspicious}

// TarabalaInfo is the tara ComputeTarabala returns for a transit nakshatra
// counted from the janma nakshatra, both given 0-based (0 is Ashwini).
type TarabalaInfo struct {
	// TaraIndex is (transit - janma) mod 9, in 0 to 8, so 0 is Janma and 8
	// is Ati-Mitra; the nine-tara cycle repeats three times over the 27
	// nakshatras.
	TaraIndex int `json:"taraIndex"`
	// EnglishName is the fixed English name for TaraIndex: Janma, Sampat,
	// Vipat, Kshema, Pratyari, Sadhaka, Vadha, Mitra, Ati-Mitra.
	EnglishName string `json:"englishName"`
	// Name is the same tara in the requested language.
	Name string `json:"name"`
	// Quality is inauspicious for TaraIndex 2, 4 and 6, auspicious
	// otherwise.
	Quality TarabalaQuality `json:"quality"`
}

// AspectMap is what ComputeAspects returns: for each graha, the chart houses
// it aspects. Values are house numbers 1 to 12 in the chart's own numbering
// from the lagna (the 7th from a graha in house 12 is house 6), sorted
// ascending and without duplicates, never nil. Every graha aspects its 7th;
// Mars adds its 4th and 8th, Jupiter its 5th and 9th, Saturn its 3rd and
// 10th; Rahu and Ketu get the 5th and 9th only under [NodeAspects5And9].
// JSON keys are the graha names, "Sun" to "Ketu".
type AspectMap struct {
	// Sun is the houses the Sun aspects: its 7th only.
	Sun []int `json:"Sun"`
	// Moon is the houses the Moon aspects: its 7th only.
	Moon []int `json:"Moon"`
	// Mars is the houses Mars aspects: its 4th, 7th and 8th.
	Mars []int `json:"Mars"`
	// Mercury is the houses Mercury aspects: its 7th only.
	Mercury []int `json:"Mercury"`
	// Jupiter is the houses Jupiter aspects: its 5th, 7th and 9th.
	Jupiter []int `json:"Jupiter"`
	// Venus is the houses Venus aspects: its 7th only.
	Venus []int `json:"Venus"`
	// Saturn is the houses Saturn aspects: its 3rd, 7th and 10th.
	Saturn []int `json:"Saturn"`
	// Rahu is the houses Rahu aspects: its 7th, plus its 5th and 9th under
	// NodeAspects5And9.
	Rahu []int `json:"Rahu"`
	// Ketu is the houses Ketu aspects: its 7th, plus its 5th and 9th under
	// NodeAspects5And9.
	Ketu []int `json:"Ketu"`
}

// SetForGraha stores houses for g and reports true; for a [Graha] outside
// the nine it changes nothing and reports false.
func (m *AspectMap) SetForGraha(g Graha, houses []int) bool {
	switch g {
	case GrahaSun:
		m.Sun = houses
	case GrahaMoon:
		m.Moon = houses
	case GrahaMars:
		m.Mars = houses
	case GrahaMercury:
		m.Mercury = houses
	case GrahaJupiter:
		m.Jupiter = houses
	case GrahaVenus:
		m.Venus = houses
	case GrahaSaturn:
		m.Saturn = houses
	case GrahaRahu:
		m.Rahu = houses
	case GrahaKetu:
		m.Ketu = houses
	default:
		return false
	}
	return true
}

// ForGraha returns the houses stored for g and true; for a [Graha] outside
// the nine it returns nil and false.
func (m AspectMap) ForGraha(g Graha) ([]int, bool) {
	switch g {
	case GrahaSun:
		return m.Sun, true
	case GrahaMoon:
		return m.Moon, true
	case GrahaMars:
		return m.Mars, true
	case GrahaMercury:
		return m.Mercury, true
	case GrahaJupiter:
		return m.Jupiter, true
	case GrahaVenus:
		return m.Venus, true
	case GrahaSaturn:
		return m.Saturn, true
	case GrahaRahu:
		return m.Rahu, true
	case GrahaKetu:
		return m.Ketu, true
	}
	return nil, false
}

// PlanetShadbala is one visible graha's six-fold strength, every field in
// virupas (60 virupas = 1 rupa), as ComputeShadbala fills it.
type PlanetShadbala struct {
	// Sthana is positional strength: uchcha (exaltation arc) plus
	// saptavargaja (dignity in D1, D2, D3, D7, D9, D12 and D30) plus
	// ojha-yugma (odd or even rashi and navamsa) plus drekkana.
	Sthana float64 `json:"sthana"`
	// Dig is directional strength, 0 to 60, from the graha's arc to the cusp
	// of its strong house (the 1st, 4th, 7th or 10th, whole-sign from the
	// lagna).
	Dig float64 `json:"dig"`
	// Kala is temporal strength: nathonatha plus paksha. Nathonatha is 5
	// virupas per hour from apparent midnight, 0 there and 60 at apparent
	// noon (the midpoint of the sunrise at or before birth and the next
	// sunset), for the Sun, Jupiter and Venus; the Moon, Mars and Saturn take
	// 60 minus that, and Mercury always takes 60. Paksha is the Moon's
	// distance from the Sun, 0 to 180 degrees, favouring benefics as it grows.
	Kala float64 `json:"kala"`
	// Chesta is motional strength: 30 for the Sun and Moon, 60 when
	// retrograde, 15 within 10 degrees of the Sun, otherwise 30.
	Chesta float64 `json:"chesta"`
	// Naisargika is the fixed natural strength: Sun 60, Moon 51.43, Venus
	// 42.86, Jupiter 34.29, Mercury 25.71, Mars 17.14, Saturn 8.57.
	Naisargika float64 `json:"naisargika"`
	// Drik is net aspectual strength from the other visible grahas, benefic
	// aspects positive and malefic negative, so it can be below zero. Its
	// weights are 60 for the 7th and 45, 30 or 15 for the special aspects.
	Drik float64 `json:"drik"`
	// Total is the sum of the six components with a negative Drik counted as
	// zero, so Total can exceed the raw sum by |Drik|.
	Total float64 `json:"total"`
}

// ShadbalaResult is the Shadbala of the seven visible grahas that
// ComputeShadbala returns. Rahu and Ketu have no Shadbala. JSON keys are the
// graha names, "Sun" to "Saturn".
type ShadbalaResult struct {
	// Sun is the Sun's six-fold strength.
	Sun PlanetShadbala `json:"Sun"`
	// Moon is the Moon's six-fold strength.
	Moon PlanetShadbala `json:"Moon"`
	// Mars is Mars's six-fold strength.
	Mars PlanetShadbala `json:"Mars"`
	// Mercury is Mercury's six-fold strength.
	Mercury PlanetShadbala `json:"Mercury"`
	// Jupiter is Jupiter's six-fold strength.
	Jupiter PlanetShadbala `json:"Jupiter"`
	// Venus is Venus's six-fold strength.
	Venus PlanetShadbala `json:"Venus"`
	// Saturn is Saturn's six-fold strength.
	Saturn PlanetShadbala `json:"Saturn"`
}

// Set stores b for v and reports true; for a [VisibleGraha] outside the
// seven it changes nothing and reports false.
func (r *ShadbalaResult) Set(v VisibleGraha, b PlanetShadbala) bool {
	switch v {
	case VisibleSun:
		r.Sun = b
	case VisibleMoon:
		r.Moon = b
	case VisibleMars:
		r.Mars = b
	case VisibleMercury:
		r.Mercury = b
	case VisibleJupiter:
		r.Jupiter = b
	case VisibleVenus:
		r.Venus = b
	case VisibleSaturn:
		r.Saturn = b
	default:
		return false
	}
	return true
}

// Get returns the strength stored for v and true; for a [VisibleGraha]
// outside the seven it returns the zero value and false.
func (r ShadbalaResult) Get(v VisibleGraha) (PlanetShadbala, bool) {
	switch v {
	case VisibleSun:
		return r.Sun, true
	case VisibleMoon:
		return r.Moon, true
	case VisibleMars:
		return r.Mars, true
	case VisibleMercury:
		return r.Mercury, true
	case VisibleJupiter:
		return r.Jupiter, true
	case VisibleVenus:
		return r.Venus, true
	case VisibleSaturn:
		return r.Saturn, true
	}
	return PlanetShadbala{}, false
}

// KaalSarpSubtype names the Kaal Sarp variant, which is decided by the house
// Rahu occupies: [AllKaalSarpSubtypes] is indexed by that house minus one.
// The string is what the JSON field carries.
type KaalSarpSubtype string

const (
	// KaalSarpAnant is the subtype for Rahu in house 1.
	KaalSarpAnant KaalSarpSubtype = "anant"
	// KaalSarpKulik is the subtype for Rahu in house 2.
	KaalSarpKulik KaalSarpSubtype = "kulik"
	// KaalSarpVasuki is the subtype for Rahu in house 3.
	KaalSarpVasuki KaalSarpSubtype = "vasuki"
	// KaalSarpShankhpal is the subtype for Rahu in house 4.
	KaalSarpShankhpal KaalSarpSubtype = "shankhpal"
	// KaalSarpPadma is the subtype for Rahu in house 5.
	KaalSarpPadma KaalSarpSubtype = "padma"
	// KaalSarpMahapadma is the subtype for Rahu in house 6.
	KaalSarpMahapadma KaalSarpSubtype = "mahapadma"
	// KaalSarpTakshak is the subtype for Rahu in house 7.
	KaalSarpTakshak KaalSarpSubtype = "takshak"
	// KaalSarpKarkotak is the subtype for Rahu in house 8.
	KaalSarpKarkotak KaalSarpSubtype = "karkotak"
	// KaalSarpShankhachud is the subtype for Rahu in house 9.
	KaalSarpShankhachud KaalSarpSubtype = "shankhachud"
	// KaalSarpGhatak is the subtype for Rahu in house 10.
	KaalSarpGhatak KaalSarpSubtype = "ghatak"
	// KaalSarpVishdhar is the subtype for Rahu in house 11.
	KaalSarpVishdhar KaalSarpSubtype = "vishdhar"
	// KaalSarpSheshnag is the subtype for Rahu in house 12.
	KaalSarpSheshnag KaalSarpSubtype = "sheshnag"
)

// AllKaalSarpSubtypes lists the subtypes in Rahu-house order: element i is
// the subtype for Rahu in house i+1, Anant for house 1 through Sheshnag for
// house 12. ComputeKaalSarp indexes it with RahuHouse minus one.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllKaalSarpSubtypes = [12]KaalSarpSubtype{
	KaalSarpAnant, KaalSarpKulik, KaalSarpVasuki, KaalSarpShankhpal,
	KaalSarpPadma, KaalSarpMahapadma, KaalSarpTakshak, KaalSarpKarkotak,
	KaalSarpShankhachud, KaalSarpGhatak, KaalSarpVishdhar, KaalSarpSheshnag,
}

// KaalSarpDoshaInfo is what ComputeKaalSarp reports for a D1 birth chart:
// whether every visible graha lies inside one 180 degree arc bounded by Rahu
// and Ketu, in either direction, and which variant that makes it.
type KaalSarpDoshaInfo struct {
	// Afflicted is true only when all seven visible grahas (Sun through
	// Saturn) lie strictly on the same side of the Rahu-Ketu axis.
	Afflicted bool `json:"afflicted"`
	// Subtype is the variant decided by Rahu's house. It is nil, JSON null,
	// unless Afflicted is true.
	Subtype *KaalSarpSubtype `json:"subtype"`
	// Partial (Paritha) is true when exactly one visible graha lies outside
	// the axis. It is informational: Afflicted is then false and Subtype
	// nil.
	Partial bool `json:"partial"`
	// RahuHouse is the bhava Rahu occupies in the chart, 1 to 12.
	RahuHouse int `json:"rahuHouse"`
	// KetuHouse is the bhava Ketu occupies in the chart, 1 to 12.
	KetuHouse int `json:"ketuHouse"`
}

// PitruDoshaInfo is what ComputePitruDosha reports for a D1 birth chart. The
// triggers are the Sun in the same house as Rahu, the Sun in the same house
// as Saturn, Rahu in house 9, and the 9th lord (when it is not the Sun) in
// the same house as Rahu.
type PitruDoshaInfo struct {
	// Afflicted is true when at least one trigger matched, so it is exactly
	// len(Reasons) > 0.
	Afflicted bool `json:"afflicted"`
	// Reasons holds one English line per matched trigger, in the order Sun
	// with Rahu, Sun with Saturn, Rahu in the 9th, 9th lord with Rahu. It is
	// empty, never nil, when nothing matched.
	Reasons []string `json:"reasons"`
}

// BhinnashtakaGrid holds bindus per rashi: 12 cells, index 0 Mesha through
// 11 Meena. One graha's grid holds 0 to 8 per cell, at most one from each of
// the 8 contributors (the seven visible grahas and the lagna).
type BhinnashtakaGrid []int

// BhinnashtakaByGraha holds one [BhinnashtakaGrid] per receiving graha. Rahu
// and Ketu neither receive nor contribute, so there are seven grids. The
// JSON keys are the graha names, "Sun" through "Saturn".
type BhinnashtakaByGraha struct {
	// Sun is the grid of bindus Sun receives.
	Sun BhinnashtakaGrid `json:"Sun"`
	// Moon is the grid of bindus Moon receives.
	Moon BhinnashtakaGrid `json:"Moon"`
	// Mars is the grid of bindus Mars receives.
	Mars BhinnashtakaGrid `json:"Mars"`
	// Mercury is the grid of bindus Mercury receives.
	Mercury BhinnashtakaGrid `json:"Mercury"`
	// Jupiter is the grid of bindus Jupiter receives.
	Jupiter BhinnashtakaGrid `json:"Jupiter"`
	// Venus is the grid of bindus Venus receives.
	Venus BhinnashtakaGrid `json:"Venus"`
	// Saturn is the grid of bindus Saturn receives.
	Saturn BhinnashtakaGrid `json:"Saturn"`
}

// Set stores g as v's grid. It reports false, and changes nothing, when v is
// not one of the seven visible grahas.
func (b *BhinnashtakaByGraha) Set(v VisibleGraha, g BhinnashtakaGrid) bool {
	switch v {
	case VisibleSun:
		b.Sun = g
	case VisibleMoon:
		b.Moon = g
	case VisibleMars:
		b.Mars = g
	case VisibleMercury:
		b.Mercury = g
	case VisibleJupiter:
		b.Jupiter = g
	case VisibleVenus:
		b.Venus = g
	case VisibleSaturn:
		b.Saturn = g
	default:
		return false
	}
	return true
}

// Get returns v's grid. The bool is false, and the grid nil, when v is not
// one of the seven visible grahas.
func (b *BhinnashtakaByGraha) Get(v VisibleGraha) (BhinnashtakaGrid, bool) {
	switch v {
	case VisibleSun:
		return b.Sun, true
	case VisibleMoon:
		return b.Moon, true
	case VisibleMars:
		return b.Mars, true
	case VisibleMercury:
		return b.Mercury, true
	case VisibleJupiter:
		return b.Jupiter, true
	case VisibleVenus:
		return b.Venus, true
	case VisibleSaturn:
		return b.Saturn, true
	}
	return nil, false
}

// AshtakavargaReduced holds the grids after Trikona Sodhana and then
// Ekadhipatya Sodhana (BPHS Ch. 67). ComputeAshtakavarga fills it only when
// [AshtakavargaOptions].Reductions is true.
type AshtakavargaReduced struct {
	// Sarvashtaka is the cell-wise sum of the seven reduced Bhinnashtaka
	// grids; index 0 is Mesha.
	Sarvashtaka BhinnashtakaGrid `json:"sarvashtaka"`
	// Bhinnashtaka holds each receiving graha's grid after both reductions.
	Bhinnashtaka BhinnashtakaByGraha `json:"bhinnashtaka"`
}

// AshtakavargaResult is what ComputeAshtakavarga returns for a D1 birth
// chart (BPHS Ch. 66): the seven Bhinnashtaka grids, their Sarvashtaka sum,
// and the reduced grids when they were requested.
type AshtakavargaResult struct {
	// Sarvashtaka is the cell-wise sum of the seven Bhinnashtaka grids, so
	// each cell is 0 to 56; index 0 is Mesha.
	Sarvashtaka BhinnashtakaGrid `json:"sarvashtaka"`
	// Bhinnashtaka holds each receiving graha's unreduced grid.
	Bhinnashtaka BhinnashtakaByGraha `json:"bhinnashtaka"`
	// Reduced is nil, and omitted from JSON, unless
	// AshtakavargaOptions.Reductions was set.
	Reduced *AshtakavargaReduced `json:"reduced,omitempty"`
}

// YogaType is the family a catalog yoga belongs to. [ComputeYogasOptions]
// Types filters ComputeYogas by these values, and a value outside
// [AllYogaTypes] is an [ErrInvalidInput] error. The string is what the JSON
// field carries.
type YogaType string

const (
	// YogaMahapurusha is the Pancha Mahapurusha family: Ruchaka, Bhadra,
	// Hamsa, Malavya and Sasha.
	YogaMahapurusha YogaType = "mahapurusha"
	// YogaLunar groups the Moon-anchored yogas: Gajakesari, Sunapha, Anapha,
	// Durudhura and Kemadruma.
	YogaLunar YogaType = "lunar"
	// YogaSolar groups the Sun-anchored yogas: Budha-Aditya, Veshi, Vasi and
	// Ubhayachari.
	YogaSolar YogaType = "solar"
	// YogaRaja groups Raja Yoga, Dharma-Karmadhipati, Vipareeta Raja Yoga
	// and Lakshmi Yoga.
	YogaRaja YogaType = "raja"
	// YogaDhana groups the wealth yogas: Dhana Yoga (2-11), Dhana Yoga (5-9)
	// and Vasumati Yoga.
	YogaDhana YogaType = "dhana"
	// YogaSpecial groups Vargottama and Yogakaraka.
	YogaSpecial YogaType = "special"
	// YogaCancellation is the family of Neecha Bhanga.
	YogaCancellation YogaType = "cancellation"
	// YogaNegative is the family of Daridra Yoga.
	YogaNegative YogaType = "negative"
)

// AllYogaTypes lists every [YogaType], in the order the catalog evaluates
// them. ComputeYogas checks the Types option against it.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllYogaTypes = []YogaType{
	YogaMahapurusha, YogaLunar, YogaSolar, YogaRaja,
	YogaDhana, YogaSpecial, YogaCancellation, YogaNegative,
}

// YogaName is the transliterated proper noun of a catalog yoga. Names are
// transliterations on purpose and are not locale-resolved; the string is
// what the JSON field carries.
type YogaName string

const (
	// YogaRuchaka is Mars own, moolatrikona or exalted in a kendra house (1,
	// 4, 7 or 10).
	YogaRuchaka YogaName = "Ruchaka"
	// YogaBhadra is Mercury own, moolatrikona or exalted in a kendra house
	// (1, 4, 7 or 10).
	YogaBhadra YogaName = "Bhadra"
	// YogaHamsa is Jupiter own, moolatrikona or exalted in a kendra house
	// (1, 4, 7 or 10).
	YogaHamsa YogaName = "Hamsa"
	// YogaMalavya is Venus own, moolatrikona or exalted in a kendra house
	// (1, 4, 7 or 10).
	YogaMalavya YogaName = "Malavya"
	// YogaSasha is Saturn own, moolatrikona or exalted in a kendra house (1,
	// 4, 7 or 10).
	YogaSasha YogaName = "Sasha"
	// YogaGajakesari is Jupiter in a kendra (1st, 4th, 7th or 10th) from the
	// Moon.
	YogaGajakesari YogaName = "Gajakesari"
	// YogaSunapha is Mars, Mercury, Jupiter, Venus or Saturn in the 2nd
	// rashi from the Moon.
	YogaSunapha YogaName = "Sunapha"
	// YogaAnapha is Mars, Mercury, Jupiter, Venus or Saturn in the 12th
	// rashi from the Moon.
	YogaAnapha YogaName = "Anapha"
	// YogaDurudhura is Sunapha and Anapha at once: one of Mars, Mercury,
	// Jupiter, Venus or Saturn in each of the 2nd and 12th rashis from the
	// Moon.
	YogaDurudhura YogaName = "Durudhura"
	// YogaKemadruma is the Moon with no visible graha other than the Sun
	// conjunct, 2nd or 12th from it: the case where none of Sunapha, Anapha
	// and Durudhura forms.
	YogaKemadruma YogaName = "Kemadruma"
	// YogaBudhaAditya is the Sun and Mercury in the same rashi.
	YogaBudhaAditya YogaName = "Budha-Aditya"
	// YogaVeshi is Mars, Mercury, Jupiter, Venus or Saturn in the 2nd rashi
	// from the Sun.
	YogaVeshi YogaName = "Veshi"
	// YogaVasi is Mars, Mercury, Jupiter, Venus or Saturn in the 12th rashi
	// from the Sun.
	YogaVasi YogaName = "Vasi"
	// YogaUbhayachari is Veshi and Vasi at once: one of Mars, Mercury,
	// Jupiter, Venus or Saturn in each of the 2nd and 12th rashis from the
	// Sun.
	YogaUbhayachari YogaName = "Ubhayachari"
	// YogaRajaYoga is a kendra lord and a trikona lord conjunct or in mutual
	// aspect.
	YogaRajaYoga YogaName = "Raja Yoga"
	// YogaDharmaKarmadhipati is the 9th and 10th lords, when distinct,
	// conjunct or in mutual aspect.
	YogaDharmaKarmadhipati YogaName = "Dharma-Karmadhipati"
	// YogaVipareetaRaja is the distinct lords of houses 6, 8 and 12 all in
	// one rashi, with the first of those lords placed in house 6, 8 or 12.
	YogaVipareetaRaja YogaName = "Vipareeta Raja Yoga"
	// YogaLakshmi is the 9th lord and Venus both own, moolatrikona or
	// exalted.
	YogaLakshmi YogaName = "Lakshmi Yoga"
	// YogaDhana211 is the 2nd and 11th lords, when distinct, in one rashi.
	YogaDhana211 YogaName = "Dhana Yoga (2-11)"
	// YogaDhana59 is the 5th and 9th lords, when distinct, in one rashi.
	YogaDhana59 YogaName = "Dhana Yoga (5-9)"
	// YogaVasumati is every natural benefic in an upachaya house (3, 6, 10
	// or 11) from the lagna.
	YogaVasumati YogaName = "Vasumati Yoga"
	// YogaVargottama is a graha in the same rashi in D1 and D9. It needs
	// ComputeYogasOptions.Navamsa and is skipped silently without it.
	YogaVargottama YogaName = "Vargottama"
	// YogaYogakaraka is the lagna's Yogakaraka graha, reported for lagnas
	// that have one.
	YogaYogakaraka YogaName = "Yogakaraka"
	// YogaNeechaBhanga is a debilitated graha whose debility is cancelled;
	// type cancellation.
	YogaNeechaBhanga YogaName = "Neecha Bhanga"
	// YogaDaridra is the 11th lord in house 12, or the 2nd lord in house 6,
	// 8 or 12.
	YogaDaridra YogaName = "Daridra Yoga"
)

// AllYogaNames lists every [YogaName] in catalog order, which is also the
// order ComputeYogas emits matched yogas.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllYogaNames = []YogaName{
	YogaRuchaka, YogaBhadra, YogaHamsa, YogaMalavya, YogaSasha,
	YogaGajakesari, YogaSunapha, YogaAnapha, YogaDurudhura, YogaKemadruma,
	YogaBudhaAditya, YogaVeshi, YogaVasi, YogaUbhayachari,
	YogaRajaYoga, YogaDharmaKarmadhipati, YogaVipareetaRaja, YogaLakshmi,
	YogaDhana211, YogaDhana59, YogaVasumati,
	YogaVargottama, YogaYogakaraka, YogaNeechaBhanga, YogaDaridra,
}

// YogaBhanga records whether a matched yoga is cancelled and why. Only the
// five Mahapurusha yogas and Gajakesari carry one; the yoga is still
// reported when Applies is true.
type YogaBhanga struct {
	// Applies is true when at least one cancelling condition holds, so it is
	// exactly len(Reasons) > 0.
	Applies bool `json:"applies"`
	// Reasons holds one English line per cancelling condition: the yoga's
	// graha conjunct the Sun or Moon (Mahapurusha), or Jupiter combust
	// within 10 degrees of the Sun or debilitated (Gajakesari). Empty, never
	// nil.
	Reasons []string `json:"reasons"`
}

// Yoga is one matched entry of the yoga catalog, as ComputeYogas returns
// them for a D1 birth chart.
type Yoga struct {
	// Name is the catalog yoga that matched.
	Name YogaName `json:"name"`
	// Type is the family of Name.
	Type YogaType `json:"type"`
	// Reasons holds at least one English line saying which placements
	// satisfied the rule.
	Reasons []string `json:"reasons"`
	// Bhanga is set only on the five Mahapurusha yogas and Gajakesari and is
	// nil, omitted from JSON, on every other yoga.
	Bhanga *YogaBhanga `json:"bhanga,omitempty"`
}

// KarakaName is one of the seven Chara Karaka roles of the Parashara scheme
// (BPHS Ch. 32), assigned by ranking the visible grahas from the highest
// degree within its rashi down. The string is the JSON key.
type KarakaName string

const (
	// Atmakaraka is rank 1, the graha with the highest degree in rashi.
	Atmakaraka KarakaName = "Atmakaraka"
	// Amatyakaraka is rank 2, the graha with the second highest degree in
	// rashi.
	Amatyakaraka KarakaName = "Amatyakaraka"
	// Bhratrukaraka is rank 3, the graha with the third highest degree in
	// rashi.
	Bhratrukaraka KarakaName = "Bhratrukaraka"
	// Matrukaraka is rank 4, the graha with the fourth highest degree in
	// rashi.
	Matrukaraka KarakaName = "Matrukaraka"
	// Putrakaraka is rank 5, the graha with the fifth highest degree in
	// rashi.
	Putrakaraka KarakaName = "Putrakaraka"
	// Gnatikaraka is rank 6, the graha with the sixth highest degree in
	// rashi.
	Gnatikaraka KarakaName = "Gnatikaraka"
	// Darakaraka is rank 7, the graha with the lowest degree in rashi.
	Darakaraka KarakaName = "Darakaraka"
)

// AllKarakaNames lists the roles in rank order, Atmakaraka (rank 1, index 0)
// through Darakaraka (rank 7, index 6); ComputeJaiminiKarakas fills
// [JaiminiKarakas] by iterating it.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllKarakaNames = [7]KarakaName{
	Atmakaraka, Amatyakaraka, Bhratrukaraka, Matrukaraka,
	Putrakaraka, Gnatikaraka, Darakaraka,
}

// JaiminiKarakas is what ComputeJaiminiKarakas returns: the seven visible
// grahas (Ketu and Rahu excluded) assigned to the Chara Karaka roles by
// descending degree within rashi, ties kept in Sun through Saturn order.
// Each field marshals as the graha's name, so the JSON is an object of role
// name to graha name.
type JaiminiKarakas struct {
	// Atmakaraka is the graha with the highest degree in rashi (rank 1).
	Atmakaraka Graha `json:"Atmakaraka"`
	// Amatyakaraka is the graha with the second highest degree in rashi
	// (rank 2).
	Amatyakaraka Graha `json:"Amatyakaraka"`
	// Bhratrukaraka is the graha with the third highest degree in rashi
	// (rank 3).
	Bhratrukaraka Graha `json:"Bhratrukaraka"`
	// Matrukaraka is the graha with the fourth highest degree in rashi (rank
	// 4).
	Matrukaraka Graha `json:"Matrukaraka"`
	// Putrakaraka is the graha with the fifth highest degree in rashi (rank
	// 5).
	Putrakaraka Graha `json:"Putrakaraka"`
	// Gnatikaraka is the graha with the sixth highest degree in rashi (rank
	// 6).
	Gnatikaraka Graha `json:"Gnatikaraka"`
	// Darakaraka is the graha with the lowest degree in rashi (rank 7).
	Darakaraka Graha `json:"Darakaraka"`
}

// SetRank assigns g to the role at rank index i, 0 for Atmakaraka through 6
// for Darakaraka (the order of [AllKarakaNames]). It reports false, and
// changes nothing, for any other i.
func (k *JaiminiKarakas) SetRank(i int, g Graha) bool {
	switch i {
	case 0:
		k.Atmakaraka = g
	case 1:
		k.Amatyakaraka = g
	case 2:
		k.Bhratrukaraka = g
	case 3:
		k.Matrukaraka = g
	case 4:
		k.Putrakaraka = g
	case 5:
		k.Gnatikaraka = g
	case 6:
		k.Darakaraka = g
	default:
		return false
	}
	return true
}

// Get returns the graha holding role. The bool is false, with GrahaSun as
// the zero value, when role is not one of the seven [KarakaName] values.
func (k JaiminiKarakas) Get(role KarakaName) (Graha, bool) {
	switch role {
	case Atmakaraka:
		return k.Atmakaraka, true
	case Amatyakaraka:
		return k.Amatyakaraka, true
	case Bhratrukaraka:
		return k.Bhratrukaraka, true
	case Matrukaraka:
		return k.Matrukaraka, true
	case Putrakaraka:
		return k.Putrakaraka, true
	case Gnatikaraka:
		return k.Gnatikaraka, true
	case Darakaraka:
		return k.Darakaraka, true
	}
	return 0, false
}

// Karaka8Name names one of the eight Chara Karaka roles of the Jaimini
// variant: the seven [KarakaName] values plus [Pitrukaraka]. Its string
// values are the role names as written, so a [KarakaName] converts to it
// directly.
type Karaka8Name string

// Pitrukaraka is the role the eight-karaka variant adds, ranked fifth,
// between Matrukaraka and Putrakaraka.
const Pitrukaraka Karaka8Name = "Pitrukaraka"

// AllKaraka8Names lists the eight roles in rank order, Atmakaraka (highest
// degree) first and Darakaraka last; index i is the role that
// [Jaimini8Karakas.SetRank] assigns for rank i.
// It is the package's own value, so treat it as read-only: the engine and
// the panchang All functions keep their own copies, so modifying it changes
// no result.
var AllKaraka8Names = [8]Karaka8Name{
	Karaka8Name(Atmakaraka), Karaka8Name(Amatyakaraka), Karaka8Name(Bhratrukaraka),
	Karaka8Name(Matrukaraka), Pitrukaraka, Karaka8Name(Putrakaraka),
	Karaka8Name(Gnatikaraka), Karaka8Name(Darakaraka),
}

// Jaimini8Karakas holds the eight-karaka (Upadesa Sutras) Chara Karakas:
// Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn and Rahu ranked by
// descending degree within their rashi, Rahu measured as 30 minus its degree
// because it is permanently retrograde. Equal degrees keep that graha order;
// Ketu takes no role. It marshals as an object keyed by role name, each
// value the graha's name string. ComputeJaimini8Karakas in the panchang
// package returns it; ComputeJaiminiKarakas returns the seven-karaka
// [JaiminiKarakas] ranking.
type Jaimini8Karakas struct {
	// Atmakaraka is the graha with the highest degree in its rashi (rank 1).
	Atmakaraka Graha `json:"Atmakaraka"`
	// Amatyakaraka is the graha ranked 2nd by degree.
	Amatyakaraka Graha `json:"Amatyakaraka"`
	// Bhratrukaraka is the graha ranked 3rd by degree.
	Bhratrukaraka Graha `json:"Bhratrukaraka"`
	// Matrukaraka is the graha ranked 4th by degree.
	Matrukaraka Graha `json:"Matrukaraka"`
	// Pitrukaraka is the graha ranked 5th by degree, the role this variant
	// adds over JaiminiKarakas.
	Pitrukaraka Graha `json:"Pitrukaraka"`
	// Putrakaraka is the graha ranked 6th by degree.
	Putrakaraka Graha `json:"Putrakaraka"`
	// Gnatikaraka is the graha ranked 7th by degree.
	Gnatikaraka Graha `json:"Gnatikaraka"`
	// Darakaraka is the graha with the lowest degree in its rashi (rank 8).
	Darakaraka Graha `json:"Darakaraka"`
}

// SetRank stores g as the role at rank i, 0 to 7 in [AllKaraka8Names] order.
// It reports false, and changes nothing, for any other i.
func (k *Jaimini8Karakas) SetRank(i int, g Graha) bool {
	switch i {
	case 0:
		k.Atmakaraka = g
	case 1:
		k.Amatyakaraka = g
	case 2:
		k.Bhratrukaraka = g
	case 3:
		k.Matrukaraka = g
	case 4:
		k.Pitrukaraka = g
	case 5:
		k.Putrakaraka = g
	case 6:
		k.Gnatikaraka = g
	case 7:
		k.Darakaraka = g
	default:
		return false
	}
	return true
}

// Get returns the graha holding role. It reports false, with the zero
// [Graha] (the same value as [GrahaSun]), for a role that is not one of
// [AllKaraka8Names].
func (k Jaimini8Karakas) Get(role Karaka8Name) (Graha, bool) {
	switch role {
	case Karaka8Name(Atmakaraka):
		return k.Atmakaraka, true
	case Karaka8Name(Amatyakaraka):
		return k.Amatyakaraka, true
	case Karaka8Name(Bhratrukaraka):
		return k.Bhratrukaraka, true
	case Karaka8Name(Matrukaraka):
		return k.Matrukaraka, true
	case Pitrukaraka:
		return k.Pitrukaraka, true
	case Karaka8Name(Putrakaraka):
		return k.Putrakaraka, true
	case Karaka8Name(Gnatikaraka):
		return k.Gnatikaraka, true
	case Karaka8Name(Darakaraka):
		return k.Darakaraka, true
	}
	return 0, false
}

// BhavaBalaPerHouse is the BPHS Ch. 27 strength of one house, every
// component in Virupas (60 Virupas make one Rupa). ComputeBhavaBala on a
// Session produces twelve of them, house 1 first.
type BhavaBalaPerHouse struct {
	// Bhavadhipati is the Shadbala total of the lord of the rashi on the
	// house cusp.
	Bhavadhipati float64 `json:"bhavadhipati"`
	// Dik is a fixed value for the house number: 60, 40, 20, 0, 5, 10, 15,
	// 20, 25, 30, 40 and 50 for houses 1 to 12.
	Dik float64 `json:"dik"`
	// Drik sums the aspects of the seven visible grahas on the house,
	// benefics positive and malefics negative, then floors the sum at 0.
	Drik float64 `json:"drik"`
	// Sthana sums the Naisargika bala of the visible grahas occupying the
	// house, benefics positive and malefics negative. It is not floored, so
	// it can be negative.
	Sthana float64 `json:"sthana"`
	// Total is Bhavadhipati + Dik + Drik + Sthana.
	Total float64 `json:"total"`
}

// BhavaBalaResult is what ComputeBhavaBala on a Session returns.
type BhavaBalaResult struct {
	// Houses holds twelve entries, house 1 first (index 0 is house 1).
	Houses []BhavaBalaPerHouse `json:"houses"`
}

// Arudha is the Arudha pada of one bhava (Jaimini Upadesa Sutras Ch. 1):
// count from the bhava lord as many rashis as the lord is from the bhava,
// then take the 10th from that rashi when it lands on the bhava itself and
// the 4th when it lands on the 7th from the bhava. ComputeArudhas returns
// one per bhava, bhava 1 first.
type Arudha struct {
	// Bhava is the house number, 1 to 12.
	Bhava int `json:"bhava"`
	// ArudhaRashi is the pada's rashi as a 0-based index, 0 = Mesha.
	ArudhaRashi int `json:"arudhaRashi"`
	// ArudhaRashiName is that rashi's name in the language passed to
	// ComputeArudhas.
	ArudhaRashiName string `json:"arudhaRashiName"`
	// ArudhaLord is the visible graha ruling ArudhaRashi.
	ArudhaLord VisibleGraha `json:"arudhaLord"`
}

// UpagrahaPosition places one of the seven [Upagrahas].
type UpagrahaPosition struct {
	// Longitude is the sidereal longitude in degrees, normalized to [0,
	// 360), under the ayanamsa named in the request's BirthChartOptions
	// (Lahiri when empty).
	Longitude float64 `json:"longitude"`
	// Rashi is the 0-based rashi index, 0 = Mesha.
	Rashi int `json:"rashi"`
	// RashiName is the rashi's name in the request's language.
	RashiName string `json:"rashiName"`
	// House is the whole-sign house, 1 to 12, counted from the natal lagna
	// rashi whatever house system the options name.
	House int `json:"house"`
}

// Upagrahas holds the seven shadowy sub-planets for a birth, which
// ComputeUpagrahas on a Session returns. Gulika and Mandi are the ascendant
// at two points of Saturn's one-eighth segment of the birth day (of the
// night, for a birth after sunset); the other five are fixed offsets from
// the Sun's sidereal longitude.
type Upagrahas struct {
	// Gulika is the ascendant at the start of Saturn's eighth of the day or
	// night.
	Gulika UpagrahaPosition `json:"gulika"`
	// Mandi is the ascendant at the midpoint of that same eighth.
	Mandi UpagrahaPosition `json:"mandi"`
	// Dhuma is the Sun's sidereal longitude plus 133 degrees 20 minutes.
	Dhuma UpagrahaPosition `json:"dhuma"`
	// Vyatipata is 360 degrees minus Dhuma.
	Vyatipata UpagrahaPosition `json:"vyatipata"`
	// Parivesha is Vyatipata plus 180 degrees.
	Parivesha UpagrahaPosition `json:"parivesha"`
	// Indrachapa is 360 degrees minus Parivesha.
	Indrachapa UpagrahaPosition `json:"indrachapa"`
	// Upaketu is Indrachapa plus 16 degrees 40 minutes.
	Upaketu UpagrahaPosition `json:"upaketu"`
}

// ArgalaTrikona is the 5/9 trine Argala of one bhava, present only when
// ComputeArgalaWithTrikonargala produced the [ArgalaPerBhava].
type ArgalaTrikona struct {
	// Sources are the placements in the 5th from the bhava, except Ketu,
	// which counts here from the 9th instead.
	Sources []PlanetPlacement `json:"sources"`
	// Virodhakas are the placements in the 9th from the bhava, plus Ketu
	// when it is in the 5th.
	Virodhakas []PlanetPlacement `json:"virodhakas"`
}

// ArgalaPerBhava is the primary Argala of one bhava (Upadesa Sutras Ch. 1,
// BPHS Ch. 51). All nine grahas take part, with no benefic or malefic
// filter, listed in the order of the chart's Planets. ComputeArgala and
// ComputeArgalaWithTrikonargala return twelve, bhava 1 first.
type ArgalaPerBhava struct {
	// Bhava is the house number, 1 to 12.
	Bhava int `json:"bhava"`
	// Argala lists the planets in the 2nd, 4th and 11th houses from the
	// bhava.
	Argala []PlanetPlacement `json:"argala"`
	// Virodhargala lists the planets in the 3rd, 10th and 12th houses from
	// the bhava.
	Virodhargala []PlanetPlacement `json:"virodhargala"`
	// Trikona is nil unless ComputeArgalaWithTrikonargala built the entry;
	// it is then set even when both of its lists are empty.
	Trikona *ArgalaTrikona `json:"trikona,omitempty"`
}

// AshtakavargaOptions selects optional work for ComputeAshtakavarga.
type AshtakavargaOptions struct {
	// Reductions, when true, also fills AshtakavargaResult.Reduced with
	// the grids after Trikona Sodhana and then Ekadhipatya Sodhana (BPHS Ch.
	// 67); otherwise Reduced stays nil.
	Reductions bool
}

// NodeAspects chooses which houses Rahu and Ketu aspect in ComputeAspects;
// the seven visible grahas are unaffected.
type NodeAspects string

const (
	// NodeAspects7Only gives the nodes only the universal 7th house aspect
	// (BPHS). It is also what an empty AspectsOptions.NodeAspects means.
	NodeAspects7Only NodeAspects = "7-only"
	// NodeAspects5And9 adds the 5th and 9th house aspects to the nodes' 7th
	// (the B.V. Raman and KP convention).
	NodeAspects5And9 NodeAspects = "5-and-9"
)

// AspectsOptions configures ComputeAspects.
type AspectsOptions struct {
	// NodeAspects picks the aspect rule for Rahu and Ketu. Empty means
	// NodeAspects7Only; any value other than the two constants makes
	// ComputeAspects return ErrInvalidInput.
	NodeAspects NodeAspects
}

// YoginiName names one of the eight Yoginis of the Yogini dasha, in cycle
// order: Mangala, Pingala, Dhanya, Bhramari, Bhadrika, Ulka, Siddha and
// Sankata. The YoginiOrder function of the panchang package returns them in
// that order.
type YoginiName string

// The eight Yoginis in cycle order, each with the planet that rules it and
// the length of its mahadasha in years.
const (
	// YoginiMangala is ruled by the Moon, 1 year.
	YoginiMangala YoginiName = "Mangala"
	// YoginiPingala is ruled by the Sun, 2 years.
	YoginiPingala YoginiName = "Pingala"
	// YoginiDhanya is ruled by Jupiter, 3 years.
	YoginiDhanya YoginiName = "Dhanya"
	// YoginiBhramari is ruled by Mars, 4 years.
	YoginiBhramari YoginiName = "Bhramari"
	// YoginiBhadrika is ruled by Mercury, 5 years.
	YoginiBhadrika YoginiName = "Bhadrika"
	// YoginiUlka is ruled by Saturn, 6 years.
	YoginiUlka YoginiName = "Ulka"
	// YoginiSiddha is ruled by Venus, 7 years.
	YoginiSiddha YoginiName = "Siddha"
	// YoginiSankata is ruled by Rahu, 8 years.
	YoginiSankata YoginiName = "Sankata"
)

// YoginiMahaDasha is one of the eight mahadashas of a Yogini dasha.
type YoginiMahaDasha struct {
	// Yogini is the ruling Yogini.
	Yogini YoginiName `json:"yogini"`
	// Lord is the Yogini's planet: Moon, Sun, Jupiter, Mars, Mercury,
	// Saturn, Venus and Rahu for the eight Yoginis in cycle order. It
	// marshals as the planet's name string.
	Lord DashaLord `json:"lord"`
	// StartDate is the period's start as a UTC instant; the first period
	// starts at birth. It marshals as an ISO 8601 string ending in Z.
	StartDate JSDate `json:"startDate"`
	// EndDate is the period's end, which is the next period's StartDate.
	EndDate JSDate `json:"endDate"`
	// Years is the Yogini's full table length, 1 for Mangala through 8 for
	// Sankata, even for the first period, whose dates only span the
	// unexpired balance at birth.
	Years float64 `json:"years"`
	// AntarDashas holds the sub-periods cycling onward from this Yogini,
	// each lasting its own Years/36 of the full period, the last ending
	// exactly at EndDate. The first period drops those that ended before
	// birth and starts the one straddling birth at birth, so its list can
	// begin with a later Yogini and hold fewer than eight.
	AntarDashas []YoginiAntarDasha `json:"antarDashas"`
}

// YoginiAntarDasha is one sub-period inside a [YoginiMahaDasha].
type YoginiAntarDasha struct {
	// Yogini is the sub-period's Yogini.
	Yogini YoginiName `json:"yogini"`
	// Lord is that Yogini's planet, as in YoginiMahaDasha.Lord.
	Lord DashaLord `json:"lord"`
	// StartDate is the sub-period's start as a UTC instant; the first one
	// starts with its mahadasha, at birth in the first mahadasha.
	StartDate JSDate `json:"startDate"`
	// EndDate is the sub-period's end, the next sub-period's StartDate.
	EndDate JSDate `json:"endDate"`
}

// YoginiDashaResult is what ComputeYoginiDasha returns.
type YoginiDashaResult struct {
	// CurrentYogini is MahaDashas[CurrentIndex].Yogini.
	CurrentYogini YoginiName `json:"currentYogini"`
	// CurrentIndex is the index in MahaDashas of the period whose StartDate
	// is at or before the asOf instant and whose EndDate is after it, or 0
	// when no period holds it.
	CurrentIndex int `json:"currentIndex"`
	// MahaDashas holds eight periods, the first being the Yogini running at
	// birth (chosen from the Moon's nakshatra) and starting at birth.
	MahaDashas []YoginiMahaDasha `json:"mahaDashas"`
}

// CharaMahaDasha is one rashi period of the Jaimini Chara dasha.
type CharaMahaDasha struct {
	// Rashi is the 0-based rashi index, 0 = Mesha.
	Rashi int `json:"rashi"`
	// Lord is the rashi's ruling planet as a DashaLord: Mars for Mesha and
	// Vrischika, Venus for Vrishabha and Tula, Mercury for Mithuna and
	// Kanya, Moon for Karka, Sun for Simha, Jupiter for Dhanus and Meena,
	// Saturn for Makara and Kumbha.
	Lord DashaLord `json:"lord"`
	// StartDate is the period's start as a UTC instant; the first period
	// starts at birth.
	StartDate JSDate `json:"startDate"`
	// EndDate is the period's end, the next period's StartDate.
	EndDate JSDate `json:"endDate"`
	// Years is fixed by the rashi's modality whatever the chart: 9 for a
	// movable, 8 for a fixed and 7 for a dual sign, not the Jaimini count to
	// the sign's lord. The dates span Years times 365.25 days.
	Years float64 `json:"years"`
}

// CharaDashaResult is what ComputeCharaDasha on a Session returns.
type CharaDashaResult struct {
	// CurrentIndex is the index in MahaDashas of the period holding the asOf
	// instant (StartDate at or before it, EndDate after it), or 0 when none
	// does.
	CurrentIndex int `json:"currentIndex"`
	// CurrentRashi is MahaDashas[CurrentIndex].Rashi, 0-based.
	CurrentRashi int `json:"currentRashi"`
	// MahaDashas holds twelve periods running forward from the lagna rashi,
	// which is MahaDashas[0].Rashi.
	MahaDashas []CharaMahaDasha `json:"mahaDashas"`
}

// NarayanDirection is the way a Narayan dasha walks the rashis from the
// lagna rashi.
type NarayanDirection string

const (
	// NarayanForward is chosen when the lagna rashi is vishama pada: Mesha,
	// Vrishabha, Mithuna, Tula, Vrischika or Dhanus.
	NarayanForward NarayanDirection = "forward"
	// NarayanBackward is chosen for the sama pada rashis: Karka, Simha,
	// Kanya, Makara, Kumbha or Meena.
	NarayanBackward NarayanDirection = "backward"
)

// NarayanMahaDasha is one rashi period of a Narayan dasha.
type NarayanMahaDasha struct {
	// Rashi is the 0-based rashi index, 0 = Mesha.
	Rashi int `json:"rashi"`
	// Lord is the rashi's ruling planet as a DashaLord, the same table as
	// CharaMahaDasha.Lord.
	Lord DashaLord `json:"lord"`
	// StartDate is the period's start as a UTC instant; the first period
	// starts at birth.
	StartDate JSDate `json:"startDate"`
	// EndDate is the period's end, the next period's StartDate.
	EndDate JSDate `json:"endDate"`
	// Years is 9, 8 or 7 by the rashi's modality (movable, fixed, dual) from
	// ComputeNarayanDasha, or the variable-duration value from
	// ComputeNarayanDashaVariable. The dates span Years times 365.25 days.
	Years float64 `json:"years"`
}

// NarayanDashaResult is what ComputeNarayanDasha and
// ComputeNarayanDashaVariable on a Session return.
type NarayanDashaResult struct {
	// Direction is the walk chosen from the lagna rashi's pada, see
	// NarayanForward and NarayanBackward.
	Direction NarayanDirection `json:"direction"`
	// StartingRashi is the lagna rashi, 0-based, and equals
	// MahaDashas[0].Rashi.
	StartingRashi int `json:"startingRashi"`
	// CurrentIndex is the index in MahaDashas of the period holding the asOf
	// instant (StartDate at or before it, EndDate after it), or 0 when none
	// does.
	CurrentIndex int `json:"currentIndex"`
	// CurrentRashi is MahaDashas[CurrentIndex].Rashi, 0-based.
	CurrentRashi int `json:"currentRashi"`
	// MahaDashas holds twelve periods, one per rashi, walked in Direction
	// from StartingRashi.
	MahaDashas []NarayanMahaDasha `json:"mahaDashas"`
}

// Dignity is a graha's standing in a rashi, which ComputeDignity returns:
// "exalted", "moolatrikona", "own", "friend", "neutral", "enemy" or
// "debilitated", strongest first. Rahu and Ketu, which rule no sign and have
// no friendship row, are "neutral" wherever they are neither exalted nor
// debilitated. [AllDignities] lists the seven values, strongest first.
type Dignity string

const (
	// DignityExalted is a graha in its exaltation rashi.
	DignityExalted Dignity = "exalted"
	// DignityMoolatrikona is a graha in its moolatrikona rashi.
	DignityMoolatrikona Dignity = "moolatrikona"
	// DignityOwn is a graha in a rashi it rules.
	DignityOwn Dignity = "own"
	// DignityFriend is a graha in a rashi ruled by a friend.
	DignityFriend Dignity = "friend"
	// DignityNeutral is a graha in a rashi ruled by a neutral, and Rahu or
	// Ketu anywhere they are neither exalted nor debilitated.
	DignityNeutral Dignity = "neutral"
	// DignityEnemy is a graha in a rashi ruled by an enemy.
	DignityEnemy Dignity = "enemy"
	// DignityDebilitated is a graha in its debilitation rashi.
	DignityDebilitated Dignity = "debilitated"
)

// AllDignities lists the seven [Dignity] values, strongest first. It is the
// package's own slice, not a copy, so treat it as read-only: the engine and the
// panchang All functions keep their own copies, so modifying it changes no
// result.
var AllDignities = []Dignity{
	DignityExalted, DignityMoolatrikona, DignityOwn, DignityFriend,
	DignityNeutral, DignityEnemy, DignityDebilitated,
}

// KpSubLordInfo is the Krishnamurti Paddhati reading of one sidereal
// longitude, which ComputeKpSubLord returns; the twelve entries of
// [KpCuspalSubLords] are the same reading at each house cusp.
type KpSubLordInfo struct {
	// Longitude is the sidereal longitude in degrees, normalized to [0,
	// 360).
	Longitude float64 `json:"longitude"`
	// Rashi is the 0-based rashi index, 0 = Mesha.
	Rashi int `json:"rashi"`
	// Nakshatra is the 0-based nakshatra index, 0 = Ashwini.
	Nakshatra int `json:"nakshatra"`
	// SignLord is the visible graha ruling Rashi.
	SignLord VisibleGraha `json:"signLord"`
	// StarLord is the Vimshottari lord of Nakshatra.
	StarLord DashaLord `json:"starLord"`
	// SubLord rules the sub-division of the nakshatra that holds Longitude:
	// nine parts sized in proportion to the Vimshottari years, starting from
	// StarLord and following the Vimshottari order.
	SubLord DashaLord `json:"subLord"`
}

// KpCuspalSubLords is what ComputeKpCuspalSubLords on a Session returns.
type KpCuspalSubLords struct {
	// Cusps holds twelve entries, house 1 first, each read at that house's
	// Placidus-KP cusp longitude.
	Cusps []KpSubLordInfo `json:"cusps"`
}

// KpByPlanet lists the houses each graha signifies in [KpSignificators]. It
// marshals as an object keyed by graha name. ComputeKpSignificators fills
// every list sorted ascending.
type KpByPlanet struct {
	// Sun holds the houses the Sun signifies, 1 to 12.
	Sun []int `json:"Sun"`
	// Moon holds the houses the Moon signifies, 1 to 12.
	Moon []int `json:"Moon"`
	// Mars holds the houses Mars signifies, 1 to 12.
	Mars []int `json:"Mars"`
	// Mercury holds the houses Mercury signifies, 1 to 12.
	Mercury []int `json:"Mercury"`
	// Jupiter holds the houses Jupiter signifies, 1 to 12.
	Jupiter []int `json:"Jupiter"`
	// Venus holds the houses Venus signifies, 1 to 12.
	Venus []int `json:"Venus"`
	// Saturn holds the houses Saturn signifies, 1 to 12.
	Saturn []int `json:"Saturn"`
	// Rahu holds the houses Rahu signifies, 1 to 12. As a node it owns no
	// house, so only occupation and its star lord contribute.
	Rahu []int `json:"Rahu"`
	// Ketu holds the houses Ketu signifies, 1 to 12. As a node it owns no
	// house, so only occupation and its star lord contribute.
	Ketu []int `json:"Ketu"`
}

// Get returns the houses g signifies. It reports false, with a nil slice,
// for a g outside [AllGrahas].
func (b *KpByPlanet) Get(g Graha) ([]int, bool) {
	f := b.field(g)
	if f == nil {
		return nil, false
	}
	return *f, true
}

// Set replaces the houses g signifies. It reports false, and changes
// nothing, for a g outside [AllGrahas].
func (b *KpByPlanet) Set(g Graha, houses []int) bool {
	f := b.field(g)
	if f == nil {
		return false
	}
	*f = houses
	return true
}

// KpByHouse lists the grahas signifying each house in [KpSignificators], the
// inverse of [KpByPlanet]. It marshals as an object keyed "1" to "12".
// ComputeKpSignificators fills each list in [AllGrahas] order (Sun through
// Ketu), empty rather than nil when no graha signifies the house.
type KpByHouse struct {
	// H1 holds the grahas signifying house 1.
	H1 []Graha `json:"1"`
	// H2 holds the grahas signifying house 2.
	H2 []Graha `json:"2"`
	// H3 holds the grahas signifying house 3.
	H3 []Graha `json:"3"`
	// H4 holds the grahas signifying house 4.
	H4 []Graha `json:"4"`
	// H5 holds the grahas signifying house 5.
	H5 []Graha `json:"5"`
	// H6 holds the grahas signifying house 6.
	H6 []Graha `json:"6"`
	// H7 holds the grahas signifying house 7.
	H7 []Graha `json:"7"`
	// H8 holds the grahas signifying house 8.
	H8 []Graha `json:"8"`
	// H9 holds the grahas signifying house 9.
	H9 []Graha `json:"9"`
	// H10 holds the grahas signifying house 10.
	H10 []Graha `json:"10"`
	// H11 holds the grahas signifying house 11.
	H11 []Graha `json:"11"`
	// H12 holds the grahas signifying house 12.
	H12 []Graha `json:"12"`
}

// Get returns the grahas signifying house, which is 1 to 12. It reports
// false, with a nil slice, for a house outside that range.
func (b *KpByHouse) Get(house int) ([]Graha, bool) {
	f := b.field(house)
	if f == nil {
		return nil, false
	}
	return *f, true
}

// KpSignificators is what ComputeKpSignificators returns: for each graha,
// the union of the house it occupies, the house its star lord occupies, and
// the houses either of them owns (the nodes own none), with the owned houses
// counted whole-sign from the lagna rashi. Houses are 1-based.
type KpSignificators struct {
	// ByPlanet gives each graha's signified houses.
	ByPlanet KpByPlanet `json:"byPlanet"`
	// ByHouse is the inverse index, the grahas signifying each house.
	ByHouse KpByHouse `json:"byHouse"`
}

// NatalMoon is the natal Moon input to ComputeAshtakoot and
// ComputePathuPorutham. Both validate it and return an [ErrInvalidInput]
// error when Rashi is outside 0..11, Nakshatra is outside 0..26, or a
// non-nil optional field is out of its range. It has no JSON tags.
type NatalMoon struct {
	// Rashi is the Moon's sidereal rashi at birth, 0 = Mesha to 11 = Meena.
	Rashi int
	// Nakshatra is the Moon's nakshatra at birth, 0 = Ashwini to 26 =
	// Revati.
	Nakshatra int
	// LagnaRashi is the lagna rashi, 0..11, or nil when unknown. When both
	// natives carry it, Bhakoot gains the same-lagna-lord and same-7th-lord
	// cancellations.
	LagnaRashi *int
	// NavamsaRashi is the Moon's Navamsa (D9) rashi, 0..11, or nil when
	// unknown. When both natives carry it, Bhakoot gains the
	// same-Navamsa-lord cancellation.
	NavamsaRashi *int
	// NakshatraPada is the Moon's nakshatra pada, 1..4, or nil. It is
	// validated but no koota or porutham reads it.
	NakshatraPada *int
}

// KootName names one of the eight Ashtakoot kootas. The constants are in
// scoring order and their maximum scores are 1 to 8 in that order, 36 in
// total. JSON encodes the plain string.
type KootName string

const (
	// KootVarna compares the varna rank of the two Moon rashis, worth 0 or
	// 1.
	KootVarna KootName = "Varna"
	// KootVashya scores the vashya classes of the Moon rashis, at most 2.
	KootVashya KootName = "Vashya"
	// KootTara awards 1.5 per auspicious nakshatra-count direction, at most
	// 3.
	KootTara KootName = "Tara"
	// KootYoni scores the yoni animals of the Moon nakshatras, at most 4.
	KootYoni KootName = "Yoni"
	// KootGrahaMaitri scores the friendship of the Moon rashi lords, at most
	// 5.
	KootGrahaMaitri KootName = "Graha Maitri"
	// KootGana scores the gana classes of the Moon nakshatras, at most 6.
	KootGana KootName = "Gana"
	// KootBhakoot is 7, or 0 for a doshic rashi distance unless cancelled.
	KootBhakoot KootName = "Bhakoot"
	// KootNadi is 8, or 0 when both nadis match unless cancelled.
	KootNadi KootName = "Nadi"
)

// AshtakootOptions holds the switches for ComputeAshtakoot. The zero value
// matches the reference almanac's 36-guna table. It has no JSON tags.
type AshtakootOptions struct {
	// GanaCancellation restores a Gana score of 1 or less to 6 when the Moon
	// rashi lords are the same graha or mutual friends, and records the
	// cancellation. Off by default; the reference almanac applies none.
	GanaCancellation bool
}

// KootScore is one koota's line in an [AshtakootResult].
type KootScore struct {
	// Name is the koota this score belongs to.
	Name KootName `json:"name"`
	// Score is float64 because three kootas award halves or one-and-a-halves:
	// Vashya and Graha Maitri have 0.5 entries in their tables, and Tara awards
	// 1.5 per auspicious direction. Yoni and Gana score whole numbers.
	Score float64 `json:"score"`
	// MaxScore is the koota's full score, 1 to 8 by koota.
	MaxScore float64 `json:"maxScore"`
	// Description explains the score in English; it is not localized and
	// ends with the cancellation reason when one fired.
	Description string `json:"description"`
}

// AshtakootResult is the 36-point Ashtakoot Guna Milan that ComputeAshtakoot
// returns.
type AshtakootResult struct {
	// TotalScore is the sum of the eight koota scores, 0 to 36.
	TotalScore float64 `json:"totalScore"`
	// Koots holds the eight kootas in scoring order, Varna first and Nadi
	// last.
	Koots []KootScore `json:"koots"`
	// Cancellations lists every cancellation that raised a score, as "Koota:
	// reason" strings. It is non-nil even when empty.
	Cancellations []string `json:"cancellations"`
}

// BirthChartOptions configures every chart computation on a Session, from
// ComputeRashiChart to ComputeVarshaphala. The zero value of each field
// selects its default. It has no JSON tags.
type BirthChartOptions struct {
	// Ayanamsa selects the sidereal zero point; empty means Lahiri.
	Ayanamsa AyanamsaType
	// Language selects the rashi and nakshatra names in the result; empty
	// means LanguageEn.
	Language Language
	// HouseSystem selects the bhava cusps; empty means
	// HouseSystemWholeSign.
	HouseSystem HouseSystem
	// NodeType selects the Rahu and Ketu model; empty means NodeMean.
	NodeType NodeType
}

// PoruthamName names one of the ten Tamil poruthams. The constants are in
// scoring order. JSON encodes the plain string.
type PoruthamName string

const (
	// PoruthamDina passes when the girl-to-boy nakshatra count modulo 9 is
	// 0, 2, 4, 6 or 8.
	PoruthamDina PoruthamName = "Dina"
	// PoruthamGana fails only for a Manushya and Rakshasa pairing.
	PoruthamGana PoruthamName = "Gana"
	// PoruthamMahendra passes when the girl-to-boy nakshatra count is 4, 7,
	// 10, 13, 16, 19, 22 or 25.
	PoruthamMahendra PoruthamName = "Mahendra"
	// PoruthamSthreeDeergha passes when the girl-to-boy nakshatra count
	// exceeds 13.
	PoruthamSthreeDeergha PoruthamName = "SthreeDeergha"
	// PoruthamYoni fails, as a veto, only when the yoni animals are one of
	// the seven enemy pairs; it does not read the Ashtakoot Yoni score.
	PoruthamYoni PoruthamName = "Yoni"
	// PoruthamRashi fails on a doshic pair of rashi distances.
	PoruthamRashi PoruthamName = "Rashi"
	// PoruthamRashyathipathi fails when either Moon rashi lord holds the
	// other as an enemy.
	PoruthamRashyathipathi PoruthamName = "Rashyathipathi"
	// PoruthamVasya passes on an Ashtakoot Vashya score above 0.
	PoruthamVasya PoruthamName = "Vasya"
	// PoruthamRajju fails, as a veto, when both nakshatras share a rajju.
	PoruthamRajju PoruthamName = "Rajju"
	// PoruthamVedha fails, as a veto, when the nakshatras are vedha
	// partners.
	PoruthamVedha PoruthamName = "Vedha"
)

// PoruthamScore is one porutham's line in a [PathuPoruthamResult].
type PoruthamScore struct {
	// Name is the porutham this line scores.
	Name PoruthamName `json:"name"`
	// Passes reports whether the porutham is satisfied.
	Passes bool `json:"passes"`
	// Description explains the outcome in English; it is not localized.
	Description string `json:"description"`
	// Veto points to true only when a veto porutham (Yoni, Rajju or Vedha)
	// failed; it is nil otherwise and then omitted from JSON.
	Veto *bool `json:"veto,omitempty"`
}

// PathuPoruthamResult is the ten-fold pass/fail match that
// ComputePathuPorutham returns.
type PathuPoruthamResult struct {
	// TotalPasses counts the poruthams that passed, 0 to 10.
	TotalPasses int `json:"totalPasses"`
	// Recommended is true when no veto porutham failed and TotalPasses is at
	// least 5.
	Recommended bool `json:"recommended"`
	// Poruthams holds the ten poruthams in scoring order, Dina first and
	// Vedha last.
	Poruthams []PoruthamScore `json:"poruthams"`
}

// NodeType selects how Rahu's longitude is computed; Ketu is always Rahu
// plus 180 degrees. Empty resolves to [NodeMean]. JSON encodes the plain
// string.
type NodeType string

const (
	// NodeMean uses the mean lunar node from the Meeus polynomial in T.
	NodeMean NodeType = "mean"
	// NodeTrue adds the -1.4979 sin(2D - 2F) degree correction to the mean
	// node.
	NodeTrue NodeType = "true"
)

// SahamName identifies one of the 27 Tajik sahams, 0 = [SahamPunya] to 26 =
// [SahamTapas] in the order of the constants. MarshalJSON emits the name
// string ("Punya") and UnmarshalJSON accepts it.
type SahamName int

// Valid reports whether n is within 0 to [SahamNameCount]-1.
func (n SahamName) Valid() bool { return n >= 0 && n < SahamNameCount }

// String returns the saham's name, or "SahamName(n)" for an invalid value.
func (n SahamName) String() string {
	if !n.Valid() {
		return fmt.Sprintf("SahamName(%d)", int(n))
	}
	return sahamNames[n]
}

// MarshalJSON encodes the saham's name as a JSON string and returns an error
// for an invalid value.
func (n SahamName) MarshalJSON() ([]byte, error) {
	if !n.Valid() {
		return nil, fmt.Errorf("types: invalid SahamName %d", int(n))
	}
	return json.Marshal(sahamNames[n])
}

// UnmarshalJSON accepts the saham's name as a JSON string and returns an
// error for any other JSON value or an unknown name.
func (n *SahamName) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return fmt.Errorf("types: SahamName must be a string")
	}
	for i, name := range sahamNames {
		if name == s {
			*n = SahamName(i)
			return nil
		}
	}
	return fmt.Errorf("types: unknown SahamName %q", s)
}

// TithiPraveshaChart is the annual soli-lunar return chart that
// ComputeTithiPravesha returns, cast when the Moon-Sun separation is back at
// its natal value, at the match near the solar return that has the sidereal
// Sun in its natal rashi. When two matches qualify the one nearer the solar
// return is taken; when neither does (the Sun can stay in a rashi for less
// than the ~29.5 days between matches, e.g. Vrischika, Dhanu, Makara), the
// nearer one is taken and the Sun is in an adjacent rashi.
type TithiPraveshaChart struct {
	// PraveshInstant is the return instant, a UTC epoch-millisecond JSDate
	// that JSON encodes as an ISO 8601 string.
	PraveshInstant JSDate `json:"praveshInstant"`
	// NatalTithi is the natal tithi index, 0..29: Shukla 1..15 are 0..14 and
	// Krishna 1..15 are 15..29.
	NatalTithi int `json:"natalTithi"`
	// PraveshTithi is the tithi index at PraveshInstant, 0..29, computed the
	// same way as NatalTithi. It equals NatalTithi except when the natal
	// separation lies within about 1e-4 degrees (under a second of time) of a
	// tithi boundary, the tolerance the match is found to.
	PraveshTithi int `json:"praveshTithi"`
	// VarshaLagna is the lagna at PraveshInstant for the given location.
	VarshaLagna LagnaInfo `json:"varshaLagna"`
	// Planets are the D1 placements at PraveshInstant, in AllGrahas order.
	Planets []PlanetPlacement `json:"planets"`
	// Bhava is the house chart at PraveshInstant in the requested house
	// system.
	Bhava BhavaChart `json:"bhava"`
}

// SahamPosition places one saham in a [VarshaphalaChart].
type SahamPosition struct {
	// Longitude is the saham's sidereal longitude in degrees, 0 to 360.
	Longitude float64 `json:"longitude"`
	// Rashi is Longitude divided by 30, 0 = Mesha to 11 = Meena.
	Rashi int `json:"rashi"`
	// RashiName is Rashi's name in the chart's language.
	RashiName string `json:"rashiName"`
	// House is the whole-sign house from the varsha lagna, 1 to 12.
	House int `json:"house"`
}

// MunthaInfo is the Muntha of a [VarshaphalaChart]: the natal lagna rashi
// advanced one rashi per year of age.
type MunthaInfo struct {
	// Rashi is (natal lagna rashi + yearAge) mod 12, 0 = Mesha to 11 =
	// Meena.
	Rashi int `json:"rashi"`
	// Lord is the lord of Rashi; JSON encodes its name string.
	Lord VisibleGraha `json:"lord"`
	// House is the whole-sign house of Rashi from the varsha lagna, 1 to 12.
	House int `json:"house"`
}

// Sahams holds the 27 Tajik sahams of a [VarshaphalaChart], one field per
// [SahamName]; [Sahams.Get] and [Sahams.Set] address a field by name. Each
// saham is X - Y + Z mod 360, plus 30 degrees when Z lies outside the arc
// from Y to X. JSON encodes an object keyed by saham name ("Punya", "Vidya",
// ...).
type Sahams struct {
	// Punya is the saham of merit.
	Punya SahamPosition `json:"Punya"`
	// Vidya is the saham of learning.
	Vidya SahamPosition `json:"Vidya"`
	// Yasas is the saham of fame.
	Yasas SahamPosition `json:"Yasas"`
	// Mitra is the saham of friends.
	Mitra SahamPosition `json:"Mitra"`
	// Karma is the saham of career.
	Karma SahamPosition `json:"Karma"`
	// Vivaha is the saham of marriage.
	Vivaha SahamPosition `json:"Vivaha"`
	// Putra is the saham of progeny.
	Putra SahamPosition `json:"Putra"`
	// Roga is the saham of disease.
	Roga SahamPosition `json:"Roga"`
	// Marana is the saham of death, the Roga formula without the night swap.
	Marana SahamPosition `json:"Marana"`
	// Rajya is the saham of kingdom.
	Rajya SahamPosition `json:"Rajya"`
	// Raja is the saham of royalty.
	Raja SahamPosition `json:"Raja"`
	// Bandhu is the saham of relatives.
	Bandhu SahamPosition `json:"Bandhu"`
	// Dharma is the saham of righteousness.
	Dharma SahamPosition `json:"Dharma"`
	// Gnati is the saham of kinsmen.
	Gnati SahamPosition `json:"Gnati"`
	// Apamrityu is the saham of untimely death.
	Apamrityu SahamPosition `json:"Apamrityu"`
	// Bhratri is the saham of siblings.
	Bhratri SahamPosition `json:"Bhratri"`
	// Matri is the saham of the mother.
	Matri SahamPosition `json:"Matri"`
	// Pitri is the saham of the father, the same formula as Rajya.
	Pitri SahamPosition `json:"Pitri"`
	// Sama is the saham of equanimity.
	Sama SahamPosition `json:"Sama"`
	// Bandhana is the saham of imprisonment.
	Bandhana SahamPosition `json:"Bandhana"`
	// Karyasiddhi is the saham of success in work.
	Karyasiddhi SahamPosition `json:"Karyasiddhi"`
	// Vyapara is the saham of commerce.
	Vyapara SahamPosition `json:"Vyapara"`
	// Sastra is the saham of the sciences.
	Sastra SahamPosition `json:"Sastra"`
	// Asha is the saham of hopes.
	Asha SahamPosition `json:"Asha"`
	// Labha is the saham of gain.
	Labha SahamPosition `json:"Labha"`
	// Susha is the saham of well-being.
	Susha SahamPosition `json:"Susha"`
	// Tapas is the saham of austerity.
	Tapas SahamPosition `json:"Tapas"`
}

func (s *Sahams) sahamField(n SahamName) *SahamPosition {
	switch n {
	case SahamPunya:
		return &s.Punya
	case SahamVidya:
		return &s.Vidya
	case SahamYasas:
		return &s.Yasas
	case SahamMitra:
		return &s.Mitra
	case SahamKarma:
		return &s.Karma
	case SahamVivaha:
		return &s.Vivaha
	case SahamPutra:
		return &s.Putra
	case SahamRoga:
		return &s.Roga
	case SahamMarana:
		return &s.Marana
	case SahamRajya:
		return &s.Rajya
	case SahamRaja:
		return &s.Raja
	case SahamBandhu:
		return &s.Bandhu
	case SahamDharma:
		return &s.Dharma
	case SahamGnati:
		return &s.Gnati
	case SahamApamrityu:
		return &s.Apamrityu
	case SahamBhratri:
		return &s.Bhratri
	case SahamMatri:
		return &s.Matri
	case SahamPitri:
		return &s.Pitri
	case SahamSama:
		return &s.Sama
	case SahamBandhana:
		return &s.Bandhana
	case SahamKaryasiddhi:
		return &s.Karyasiddhi
	case SahamVyapara:
		return &s.Vyapara
	case SahamSastra:
		return &s.Sastra
	case SahamAsha:
		return &s.Asha
	case SahamLabha:
		return &s.Labha
	case SahamSusha:
		return &s.Susha
	case SahamTapas:
		return &s.Tapas
	}
	return nil
}

// Set replaces the position of saham n. It reports false, and changes
// nothing, for an invalid n.
func (s *Sahams) Set(n SahamName, p SahamPosition) bool {
	f := s.sahamField(n)
	if f == nil {
		return false
	}
	*f = p
	return true
}

// Get returns the position of saham n and true, or the zero [SahamPosition]
// and false for an invalid n.
func (s *Sahams) Get(n SahamName) (SahamPosition, bool) {
	f := s.sahamField(n)
	if f == nil {
		return SahamPosition{}, false
	}
	return *f, true
}

// VarshaphalaChart is the Tajik annual chart that ComputeVarshaphala
// returns, cast at the solar return for the requested year of age.
type VarshaphalaChart struct {
	// SolarReturnInstant is when the sidereal Sun returns to its natal
	// longitude, a UTC epoch-millisecond JSDate that JSON encodes as an
	// ISO 8601 string.
	SolarReturnInstant JSDate `json:"solarReturnInstant"`
	// VarshaLagna is the lagna at SolarReturnInstant for the given location.
	VarshaLagna LagnaInfo `json:"varshaLagna"`
	// Muntha is the Muntha for the year; see MunthaInfo.
	Muntha MunthaInfo `json:"muntha"`
	// YearLord is the Varsha Pati: whichever of the lagna lord, the Muntha
	// lord, the Sun's rashi lord and the Triraashi Pati has the highest
	// Shadbala total at SolarReturnInstant. JSON encodes its name string.
	YearLord VisibleGraha `json:"yearLord"`
	// Sahams are the 27 sahams computed from this chart.
	Sahams Sahams `json:"sahams"`
	// IsDayBirth is true when the Sun is above the horizon at
	// SolarReturnInstant at the location. A night return picks the night
	// Triraashi Pati and swaps X and Y in the sahams flagged for it.
	IsDayBirth bool `json:"isDayBirth"`
	// Planets are the D1 placements at SolarReturnInstant, in AllGrahas
	// order.
	Planets []PlanetPlacement `json:"planets"`
	// Bhava is the house chart at SolarReturnInstant in the requested house
	// system.
	Bhava BhavaChart `json:"bhava"`
}

// ComputeYogasOptions configures ComputeYogas. The zero value evaluates the
// whole catalog with Rahu and Ketu aspecting the 7th only. It has no JSON
// tags.
type ComputeYogasOptions struct {
	// Types restricts the result to these yoga types; empty means the whole
	// catalog. A type outside AllYogaTypes makes ComputeYogas return an
	// ErrInvalidInput error.
	Types []YogaType
	// Navamsa is the D9 chart the Vargottama rule needs; when nil that rule
	// is skipped without error.
	Navamsa *DivisionalChart
	// NodeAspects is forwarded to the aspect computation; any value other
	// than NodeAspects5And9 gives Rahu and Ketu the 7th aspect only.
	NodeAspects NodeAspects
}

// SahamNameCount is how many sahams the library computes.
const SahamNameCount = 27

var sahamNames = [SahamNameCount]string{
	"Punya", "Vidya", "Yasas", "Mitra", "Karma", "Vivaha", "Putra", "Roga",
	"Marana", "Rajya", "Raja", "Bandhu", "Dharma", "Gnati", "Apamrityu",
	"Bhratri", "Matri", "Pitri", "Sama", "Bandhana", "Karyasiddhi", "Vyapara",
	"Sastra", "Asha", "Labha", "Susha", "Tapas",
}

// The sahams, in the order a Varshaphala chart computes them (the order of
// the TypeScript SahamName union); a SahamName indexes sahamNames, and the
// AllSahamNames accessor in the panchang package, by this order.
const (
	// SahamPunya (merit) is Moon - Sun + Asc, X and Y swapped at night.
	SahamPunya SahamName = iota
	// SahamVidya (learning) is Sun - Moon + Asc, X and Y swapped at night.
	SahamVidya
	// SahamYasas (fame) is Jupiter - Punya + Asc, X and Y swapped at night.
	SahamYasas
	// SahamMitra (friends) is Jupiter - Punya + Venus, X and Y swapped at
	// night.
	SahamMitra
	// SahamKarma (career) is Mars - Mercury + Asc, X and Y swapped at night.
	SahamKarma
	// SahamVivaha (marriage) is Venus - Saturn + Asc.
	SahamVivaha
	// SahamPutra (progeny) is Jupiter - Moon + Asc.
	SahamPutra
	// SahamRoga (disease) is Saturn - Moon + Asc, X and Y swapped at night.
	SahamRoga
	// SahamMarana (death) is Saturn - Moon + Asc with no night swap.
	SahamMarana
	// SahamRajya (kingdom) is Saturn - Sun + Asc, X and Y swapped at night.
	SahamRajya
	// SahamRaja (royalty) is Sun - Mars + Asc.
	SahamRaja
	// SahamBandhu (relatives) is Mercury - Moon + Asc, X and Y swapped at
	// night.
	SahamBandhu
	// SahamDharma (righteousness) is Sun - Jupiter + Asc.
	SahamDharma
	// SahamGnati (kinsmen) is Mars - Moon + Asc, X and Y swapped at night.
	SahamGnati
	// SahamApamrityu (untimely death) is Mars - Saturn + Asc.
	SahamApamrityu
	// SahamBhratri (siblings) is Jupiter - Saturn + Asc.
	SahamBhratri
	// SahamMatri (mother) is Moon - Venus + Asc, X and Y swapped at night.
	SahamMatri
	// SahamPitri (father) is Saturn - Sun + Asc, X and Y swapped at night.
	SahamPitri
	// SahamSama (equanimity) is Sun - Saturn + Asc.
	SahamSama
	// SahamBandhana (imprisonment) is Saturn - Mars + Mercury.
	SahamBandhana
	// SahamKaryasiddhi (success in work) is Saturn - Sun + lagna lord.
	SahamKaryasiddhi
	// SahamVyapara (commerce) is Mars - Saturn + lagna lord.
	SahamVyapara
	// SahamSastra (sciences) is Jupiter - Saturn + Mercury.
	SahamSastra
	// SahamAsha (hopes) is Mercury - Saturn + Asc.
	SahamAsha
	// SahamLabha (gain) is the whole-sign 11th cusp - lagna lord + Asc.
	SahamLabha
	// SahamSusha (well-being) is Saturn - Punya + Asc, X and Y swapped at
	// night.
	SahamSusha
	// SahamTapas (austerity) is Sun - Saturn + Mercury.
	SahamTapas
)

func (b *KpByPlanet) field(g Graha) *[]int {
	switch g {
	case GrahaSun:
		return &b.Sun
	case GrahaMoon:
		return &b.Moon
	case GrahaMars:
		return &b.Mars
	case GrahaMercury:
		return &b.Mercury
	case GrahaJupiter:
		return &b.Jupiter
	case GrahaVenus:
		return &b.Venus
	case GrahaSaturn:
		return &b.Saturn
	case GrahaRahu:
		return &b.Rahu
	case GrahaKetu:
		return &b.Ketu
	}
	return nil
}

func (b *KpByHouse) field(house int) *[]Graha {
	switch house {
	case 1:
		return &b.H1
	case 2:
		return &b.H2
	case 3:
		return &b.H3
	case 4:
		return &b.H4
	case 5:
		return &b.H5
	case 6:
		return &b.H6
	case 7:
		return &b.H7
	case 8:
		return &b.H8
	case 9:
		return &b.H9
	case 10:
		return &b.H10
	case 11:
		return &b.H11
	case 12:
		return &b.H12
	}
	return nil
}

// Set replaces the grahas signifying house, which is 1 to 12. It reports
// false, and changes nothing, for a house outside that range.
func (b *KpByHouse) Set(house int, grahas []Graha) bool {
	f := b.field(house)
	if f == nil {
		return false
	}
	*f = grahas
	return true
}
