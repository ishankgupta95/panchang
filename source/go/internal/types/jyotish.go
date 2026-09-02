package types

import (
	"encoding/json"
	"fmt"
)

type Graha int

const (
	GrahaSun Graha = iota
	GrahaMoon
	GrahaMars
	GrahaMercury
	GrahaJupiter
	GrahaVenus
	GrahaSaturn
	GrahaRahu
	GrahaKetu
	GrahaCount = 9
)

var grahaNames = [GrahaCount]string{
	"Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu",
}

var AllGrahas = [GrahaCount]Graha{
	GrahaSun, GrahaMoon, GrahaMars, GrahaMercury, GrahaJupiter,
	GrahaVenus, GrahaSaturn, GrahaRahu, GrahaKetu,
}

func (g Graha) Valid() bool { return g >= 0 && g < GrahaCount }

func (g Graha) String() string {
	if !g.Valid() {
		return fmt.Sprintf("Graha(%d)", int(g))
	}
	return grahaNames[g]
}

func (g Graha) MarshalJSON() ([]byte, error) {
	if !g.Valid() {
		return nil, NewPanchangError(fmt.Sprintf("graha out of range: %d", int(g)), ErrInvalidInput)
	}
	return []byte(`"` + grahaNames[g] + `"`), nil
}

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

func (g Graha) Visible() (VisibleGraha, bool) {
	if g < 0 || g >= VisibleGrahaCount {
		return 0, false
	}
	return VisibleGraha(g), true
}

func (g Graha) IsNode() bool { return g == GrahaRahu || g == GrahaKetu }

type VisibleGraha int

const (
	VisibleSun VisibleGraha = iota
	VisibleMoon
	VisibleMars
	VisibleMercury
	VisibleJupiter
	VisibleVenus
	VisibleSaturn
	VisibleGrahaCount = 7
)

var AllVisibleGrahas = [VisibleGrahaCount]VisibleGraha{
	VisibleSun, VisibleMoon, VisibleMars, VisibleMercury,
	VisibleJupiter, VisibleVenus, VisibleSaturn,
}

func (v VisibleGraha) Valid() bool { return v >= 0 && v < VisibleGrahaCount }

func (v VisibleGraha) Graha() Graha { return Graha(v) }

func (v VisibleGraha) String() string { return v.Graha().String() }

func (v VisibleGraha) MarshalJSON() ([]byte, error) { return v.Graha().MarshalJSON() }

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

type GrahaPosition struct {
	Planet            Graha         `json:"planet"`
	SiderealLongitude float64       `json:"siderealLongitude"`
	Rashi             RashiInfo     `json:"rashi"`
	DegreeInRashi     float64       `json:"degreeInRashi"`
	Nakshatra         NakshatraInfo `json:"nakshatra"`
	IsRetrograde      bool          `json:"isRetrograde"`
}

type PlanetaryPositions struct {
	Sun     GrahaPosition `json:"sun"`
	Moon    GrahaPosition `json:"moon"`
	Mars    GrahaPosition `json:"mars"`
	Mercury GrahaPosition `json:"mercury"`
	Jupiter GrahaPosition `json:"jupiter"`
	Venus   GrahaPosition `json:"venus"`
	Saturn  GrahaPosition `json:"saturn"`
	Rahu    GrahaPosition `json:"rahu"`
	Ketu    GrahaPosition `json:"ketu"`
}

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

type DashaLord int

const (
	DashaKetu DashaLord = iota
	DashaVenus
	DashaSun
	DashaMoon
	DashaMars
	DashaRahu
	DashaJupiter
	DashaSaturn
	DashaMercury
	DashaLordCount = 9
)

var dashaLordNames = [DashaLordCount]string{
	"Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
}

var AllDashaLords = [DashaLordCount]DashaLord{
	DashaKetu, DashaVenus, DashaSun, DashaMoon, DashaMars,
	DashaRahu, DashaJupiter, DashaSaturn, DashaMercury,
}

func (d DashaLord) Valid() bool { return d >= 0 && d < DashaLordCount }

func (d DashaLord) String() string {
	if !d.Valid() {
		return fmt.Sprintf("DashaLord(%d)", int(d))
	}
	return dashaLordNames[d]
}

func (d DashaLord) MarshalJSON() ([]byte, error) {
	if !d.Valid() {
		return nil, NewPanchangError(fmt.Sprintf("dasha lord out of range: %d", int(d)), ErrInvalidInput)
	}
	return []byte(`"` + dashaLordNames[d] + `"`), nil
}

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

func (d DashaLord) Graha() Graha {
	if !d.Valid() {
		return Graha(-1)
	}
	return dashaLordToGraha[d]
}

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

type AntarDasha struct {
	Lord      DashaLord `json:"lord"`
	StartDate JSDate    `json:"startDate"`
	EndDate   JSDate    `json:"endDate"`
}

type PratyantarDasha struct {
	Lord      DashaLord `json:"lord"`
	StartDate JSDate    `json:"startDate"`
	EndDate   JSDate    `json:"endDate"`
}

type MahaDasha struct {
	Lord        DashaLord    `json:"lord"`
	StartDate   JSDate       `json:"startDate"`
	EndDate     JSDate       `json:"endDate"`
	Years       float64      `json:"years"`
	AntarDashas []AntarDasha `json:"antarDashas"`
}

type VimshottariDashaResult struct {
	CurrentMahaDashaLord DashaLord   `json:"currentMahaDashaLord"`
	CurrentIndex         int         `json:"currentIndex"`
	MahaDashas           []MahaDasha `json:"mahaDashas"`
}

type ChandraBalamQuality string

const (
	ChandraBalamStrong ChandraBalamQuality = "strong"
	ChandraBalamWeak   ChandraBalamQuality = "weak"
)

var AllChandraBalamQualities = []ChandraBalamQuality{ChandraBalamStrong, ChandraBalamWeak}

type ChandraBalamInfo struct {
	House       int                 `json:"house"`
	Quality     ChandraBalamQuality `json:"quality"`
	EnglishName string              `json:"englishName"`
	Name        string              `json:"name"`
}

type LagnaInfo struct {
	SiderealLongitude float64        `json:"siderealLongitude"`
	Rashi             RashiInfo      `json:"rashi"`
	DegreeInRashi     float64        `json:"degreeInRashi"`
	Nakshatra         LagnaNakshatra `json:"nakshatra"`
	Pada              int            `json:"pada"`
}

type LagnaNakshatra struct {
	Index int    `json:"index"`
	Name  string `json:"name"`
}

type SripatiLagnaInfo struct {
	LagnaInfo
	Cusps []float64 `json:"cusps"`
}

type HouseSystem string

const (
	HouseSystemWholeSign  HouseSystem = "whole-sign"
	HouseSystemEqual      HouseSystem = "equal"
	HouseSystemPlacidusKP HouseSystem = "placidus-kp"
)

var AllHouseSystems = []HouseSystem{
	HouseSystemWholeSign, HouseSystemEqual, HouseSystemPlacidusKP,
}

type HouseInfo struct {
	House         int       `json:"house"`
	CuspLongitude float64   `json:"cuspLongitude"`
	Rashi         RashiInfo `json:"rashi"`
	DegreeInRashi float64   `json:"degreeInRashi"`
}

type BhavaChart struct {
	System             HouseSystem `json:"system"`
	Houses             []HouseInfo `json:"houses"`
	AscendantLongitude float64     `json:"ascendantLongitude"`
	MCLongitude        float64     `json:"mcLongitude"`
}

type PlanetPlacement struct {
	Planet        Graha     `json:"planet"`
	Longitude     float64   `json:"longitude"`
	Rashi         RashiInfo `json:"rashi"`
	DegreeInRashi float64   `json:"degreeInRashi"`
	House         int       `json:"house"`
	IsRetrograde  bool      `json:"isRetrograde"`
}

type PlanetsByGraha struct {
	Sun     PlanetPlacement `json:"Sun"`
	Moon    PlanetPlacement `json:"Moon"`
	Mars    PlanetPlacement `json:"Mars"`
	Mercury PlanetPlacement `json:"Mercury"`
	Jupiter PlanetPlacement `json:"Jupiter"`
	Venus   PlanetPlacement `json:"Venus"`
	Saturn  PlanetPlacement `json:"Saturn"`
	Rahu    PlanetPlacement `json:"Rahu"`
	Ketu    PlanetPlacement `json:"Ketu"`
}

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

type BirthChart struct {
	Divisional string            `json:"divisional"`
	Lagna      LagnaInfo         `json:"lagna"`
	Bhava      BhavaChart        `json:"bhava"`
	Planets    []PlanetPlacement `json:"planets"`
	ByPlanet   PlanetsByGraha    `json:"byPlanet"`
}

type Divisional string

const (
	DivisionalD2  Divisional = "D2"
	DivisionalD3  Divisional = "D3"
	DivisionalD7  Divisional = "D7"
	DivisionalD9  Divisional = "D9"
	DivisionalD10 Divisional = "D10"
	DivisionalD12 Divisional = "D12"
	DivisionalD30 Divisional = "D30"
)

var AllDivisionals = []Divisional{
	DivisionalD2, DivisionalD3, DivisionalD7, DivisionalD9,
	DivisionalD10, DivisionalD12, DivisionalD30,
}

func (d Divisional) Valid() bool {
	for _, x := range AllDivisionals {
		if x == d {
			return true
		}
	}
	return false
}

type DivisionalChart struct {
	Divisional Divisional        `json:"divisional"`
	LagnaRashi RashiInfo         `json:"lagnaRashi"`
	Planets    []PlanetPlacement `json:"planets"`
}

type MangalDoshaSeverity string

const (
	MangalNone   MangalDoshaSeverity = "none"
	MangalAnshik MangalDoshaSeverity = "anshik"
	MangalPurna  MangalDoshaSeverity = "purna"
)

var AllMangalDoshaSeverities = []MangalDoshaSeverity{MangalNone, MangalAnshik, MangalPurna}

type MangalReference struct {
	Afflicted bool `json:"afflicted"`
	House     int  `json:"house"`
}

type MangalDoshaInfo struct {
	Afflicted     bool                `json:"afflicted"`
	Severity      MangalDoshaSeverity `json:"severity"`
	FromLagna     MangalReference     `json:"fromLagna"`
	FromMoon      MangalReference     `json:"fromMoon"`
	FromVenus     MangalReference     `json:"fromVenus"`
	Cancellations []string            `json:"cancellations"`
}

type MangalCompatibility struct {
	Boy           MangalDoshaInfo `json:"boy"`
	Girl          MangalDoshaInfo `json:"girl"`
	Afflicted     bool            `json:"afflicted"`
	Cancellations []string        `json:"cancellations"`
	Description   string          `json:"description"`
}

type SadeSatiInfo struct {
	Active          bool    `json:"active"`
	Phase           *int    `json:"phase"`
	CurrentArcStart *JSDate `json:"currentArcStart"`
	CurrentArcEnd   *JSDate `json:"currentArcEnd"`
	NextArcStart    *JSDate `json:"nextArcStart"`
}

type TarabalaQuality string

const (
	TarabalaAuspicious   TarabalaQuality = "auspicious"
	TarabalaInauspicious TarabalaQuality = "inauspicious"
)

var AllTarabalaQualities = []TarabalaQuality{TarabalaAuspicious, TarabalaInauspicious}

type TarabalaInfo struct {
	TaraIndex   int             `json:"taraIndex"`
	EnglishName string          `json:"englishName"`
	Name        string          `json:"name"`
	Quality     TarabalaQuality `json:"quality"`
}

type AspectMap struct {
	Sun     []int `json:"Sun"`
	Moon    []int `json:"Moon"`
	Mars    []int `json:"Mars"`
	Mercury []int `json:"Mercury"`
	Jupiter []int `json:"Jupiter"`
	Venus   []int `json:"Venus"`
	Saturn  []int `json:"Saturn"`
	Rahu    []int `json:"Rahu"`
	Ketu    []int `json:"Ketu"`
}

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

type PlanetShadbala struct {
	Sthana     float64 `json:"sthana"`
	Dig        float64 `json:"dig"`
	Kala       float64 `json:"kala"`
	Chesta     float64 `json:"chesta"`
	Naisargika float64 `json:"naisargika"`
	Drik       float64 `json:"drik"`
	Total      float64 `json:"total"`
}

type ShadbalaResult struct {
	Sun     PlanetShadbala `json:"Sun"`
	Moon    PlanetShadbala `json:"Moon"`
	Mars    PlanetShadbala `json:"Mars"`
	Mercury PlanetShadbala `json:"Mercury"`
	Jupiter PlanetShadbala `json:"Jupiter"`
	Venus   PlanetShadbala `json:"Venus"`
	Saturn  PlanetShadbala `json:"Saturn"`
}

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

type KaalSarpSubtype string

const (
	KaalSarpAnant       KaalSarpSubtype = "anant"
	KaalSarpKulik       KaalSarpSubtype = "kulik"
	KaalSarpVasuki      KaalSarpSubtype = "vasuki"
	KaalSarpShankhpal   KaalSarpSubtype = "shankhpal"
	KaalSarpPadma       KaalSarpSubtype = "padma"
	KaalSarpMahapadma   KaalSarpSubtype = "mahapadma"
	KaalSarpTakshak     KaalSarpSubtype = "takshak"
	KaalSarpKarkotak    KaalSarpSubtype = "karkotak"
	KaalSarpShankhachud KaalSarpSubtype = "shankhachud"
	KaalSarpGhatak      KaalSarpSubtype = "ghatak"
	KaalSarpVishdhar    KaalSarpSubtype = "vishdhar"
	KaalSarpSheshnag    KaalSarpSubtype = "sheshnag"
)

var AllKaalSarpSubtypes = [12]KaalSarpSubtype{
	KaalSarpAnant, KaalSarpKulik, KaalSarpVasuki, KaalSarpShankhpal,
	KaalSarpPadma, KaalSarpMahapadma, KaalSarpTakshak, KaalSarpKarkotak,
	KaalSarpShankhachud, KaalSarpGhatak, KaalSarpVishdhar, KaalSarpSheshnag,
}

type KaalSarpDoshaInfo struct {
	Afflicted bool             `json:"afflicted"`
	Subtype   *KaalSarpSubtype `json:"subtype"`
	Partial   bool             `json:"partial"`
	RahuHouse int              `json:"rahuHouse"`
	KetuHouse int              `json:"ketuHouse"`
}

type PitruDoshaInfo struct {
	Afflicted bool     `json:"afflicted"`
	Reasons   []string `json:"reasons"`
}

type BhinnashtakaGrid []int

type BhinnashtakaByGraha struct {
	Sun     BhinnashtakaGrid `json:"Sun"`
	Moon    BhinnashtakaGrid `json:"Moon"`
	Mars    BhinnashtakaGrid `json:"Mars"`
	Mercury BhinnashtakaGrid `json:"Mercury"`
	Jupiter BhinnashtakaGrid `json:"Jupiter"`
	Venus   BhinnashtakaGrid `json:"Venus"`
	Saturn  BhinnashtakaGrid `json:"Saturn"`
}

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

type AshtakavargaReduced struct {
	Sarvashtaka  BhinnashtakaGrid    `json:"sarvashtaka"`
	Bhinnashtaka BhinnashtakaByGraha `json:"bhinnashtaka"`
}

type AshtakavargaResult struct {
	Sarvashtaka  BhinnashtakaGrid     `json:"sarvashtaka"`
	Bhinnashtaka BhinnashtakaByGraha  `json:"bhinnashtaka"`
	Reduced      *AshtakavargaReduced `json:"reduced,omitempty"`
}

type YogaType string

const (
	YogaMahapurusha  YogaType = "mahapurusha"
	YogaLunar        YogaType = "lunar"
	YogaSolar        YogaType = "solar"
	YogaRaja         YogaType = "raja"
	YogaDhana        YogaType = "dhana"
	YogaSpecial      YogaType = "special"
	YogaCancellation YogaType = "cancellation"
	YogaNegative     YogaType = "negative"
)

var AllYogaTypes = []YogaType{
	YogaMahapurusha, YogaLunar, YogaSolar, YogaRaja,
	YogaDhana, YogaSpecial, YogaCancellation, YogaNegative,
}

type YogaName string

const (
	YogaRuchaka            YogaName = "Ruchaka"
	YogaBhadra             YogaName = "Bhadra"
	YogaHamsa              YogaName = "Hamsa"
	YogaMalavya            YogaName = "Malavya"
	YogaSasha              YogaName = "Sasha"
	YogaGajakesari         YogaName = "Gajakesari"
	YogaSunapha            YogaName = "Sunapha"
	YogaAnapha             YogaName = "Anapha"
	YogaDurudhura          YogaName = "Durudhura"
	YogaKemadruma          YogaName = "Kemadruma"
	YogaBudhaAditya        YogaName = "Budha-Aditya"
	YogaVeshi              YogaName = "Veshi"
	YogaVasi               YogaName = "Vasi"
	YogaUbhayachari        YogaName = "Ubhayachari"
	YogaRajaYoga           YogaName = "Raja Yoga"
	YogaDharmaKarmadhipati YogaName = "Dharma-Karmadhipati"
	YogaVipareetaRaja      YogaName = "Vipareeta Raja Yoga"
	YogaLakshmi            YogaName = "Lakshmi Yoga"
	YogaDhana211           YogaName = "Dhana Yoga (2-11)"
	YogaDhana59            YogaName = "Dhana Yoga (5-9)"
	YogaVasumati           YogaName = "Vasumati Yoga"
	YogaVargottama         YogaName = "Vargottama"
	YogaYogakaraka         YogaName = "Yogakaraka"
	YogaNeechaBhanga       YogaName = "Neecha Bhanga"
	YogaDaridra            YogaName = "Daridra Yoga"
)

var AllYogaNames = []YogaName{
	YogaRuchaka, YogaBhadra, YogaHamsa, YogaMalavya, YogaSasha,
	YogaGajakesari, YogaSunapha, YogaAnapha, YogaDurudhura, YogaKemadruma,
	YogaBudhaAditya, YogaVeshi, YogaVasi, YogaUbhayachari,
	YogaRajaYoga, YogaDharmaKarmadhipati, YogaVipareetaRaja, YogaLakshmi,
	YogaDhana211, YogaDhana59, YogaVasumati,
	YogaVargottama, YogaYogakaraka, YogaNeechaBhanga, YogaDaridra,
}

type YogaBhanga struct {
	Applies bool     `json:"applies"`
	Reasons []string `json:"reasons"`
}

type Yoga struct {
	Name    YogaName    `json:"name"`
	Type    YogaType    `json:"type"`
	Reasons []string    `json:"reasons"`
	Bhanga  *YogaBhanga `json:"bhanga,omitempty"`
}

type KarakaName string

const (
	Atmakaraka    KarakaName = "Atmakaraka"
	Amatyakaraka  KarakaName = "Amatyakaraka"
	Bhratrukaraka KarakaName = "Bhratrukaraka"
	Matrukaraka   KarakaName = "Matrukaraka"
	Putrakaraka   KarakaName = "Putrakaraka"
	Gnatikaraka   KarakaName = "Gnatikaraka"
	Darakaraka    KarakaName = "Darakaraka"
)

var AllKarakaNames = [7]KarakaName{
	Atmakaraka, Amatyakaraka, Bhratrukaraka, Matrukaraka,
	Putrakaraka, Gnatikaraka, Darakaraka,
}

type JaiminiKarakas struct {
	Atmakaraka    Graha `json:"Atmakaraka"`
	Amatyakaraka  Graha `json:"Amatyakaraka"`
	Bhratrukaraka Graha `json:"Bhratrukaraka"`
	Matrukaraka   Graha `json:"Matrukaraka"`
	Putrakaraka   Graha `json:"Putrakaraka"`
	Gnatikaraka   Graha `json:"Gnatikaraka"`
	Darakaraka    Graha `json:"Darakaraka"`
}

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

type Karaka8Name string

const Pitrukaraka Karaka8Name = "Pitrukaraka"

var AllKaraka8Names = [8]Karaka8Name{
	Karaka8Name(Atmakaraka), Karaka8Name(Amatyakaraka), Karaka8Name(Bhratrukaraka),
	Karaka8Name(Matrukaraka), Pitrukaraka, Karaka8Name(Putrakaraka),
	Karaka8Name(Gnatikaraka), Karaka8Name(Darakaraka),
}

type Jaimini8Karakas struct {
	Atmakaraka    Graha `json:"Atmakaraka"`
	Amatyakaraka  Graha `json:"Amatyakaraka"`
	Bhratrukaraka Graha `json:"Bhratrukaraka"`
	Matrukaraka   Graha `json:"Matrukaraka"`
	Pitrukaraka   Graha `json:"Pitrukaraka"`
	Putrakaraka   Graha `json:"Putrakaraka"`
	Gnatikaraka   Graha `json:"Gnatikaraka"`
	Darakaraka    Graha `json:"Darakaraka"`
}

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

type BhavaBalaPerHouse struct {
	Bhavadhipati float64 `json:"bhavadhipati"`
	Dik          float64 `json:"dik"`
	Drik         float64 `json:"drik"`
	Sthana       float64 `json:"sthana"`
	Total        float64 `json:"total"`
}

type BhavaBalaResult struct {
	Houses []BhavaBalaPerHouse `json:"houses"`
}

type Arudha struct {
	Bhava           int          `json:"bhava"`
	ArudhaRashi     int          `json:"arudhaRashi"`
	ArudhaRashiName string       `json:"arudhaRashiName"`
	ArudhaLord      VisibleGraha `json:"arudhaLord"`
}

type UpagrahaPosition struct {
	Longitude float64 `json:"longitude"`
	Rashi     int     `json:"rashi"`
	RashiName string  `json:"rashiName"`
	House     int     `json:"house"`
}

type Upagrahas struct {
	Gulika     UpagrahaPosition `json:"gulika"`
	Mandi      UpagrahaPosition `json:"mandi"`
	Dhuma      UpagrahaPosition `json:"dhuma"`
	Vyatipata  UpagrahaPosition `json:"vyatipata"`
	Parivesha  UpagrahaPosition `json:"parivesha"`
	Indrachapa UpagrahaPosition `json:"indrachapa"`
	Upaketu    UpagrahaPosition `json:"upaketu"`
}

type ArgalaTrikona struct {
	Sources    []PlanetPlacement `json:"sources"`
	Virodhakas []PlanetPlacement `json:"virodhakas"`
}

type ArgalaPerBhava struct {
	Bhava        int               `json:"bhava"`
	Argala       []PlanetPlacement `json:"argala"`
	Virodhargala []PlanetPlacement `json:"virodhargala"`
	Trikona      *ArgalaTrikona    `json:"trikona,omitempty"`
}
