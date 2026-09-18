package jyotish

import "github.com/ishankgupta95/panchang/source/go/v5/types"

// These types are declared in the shared types package so that a caller can
// import them and their fields and methods render in the documentation. The
// aliases here keep this package's own references spelled unqualified.

type (
	AshtakavargaOptions = types.AshtakavargaOptions
	NodeAspects         = types.NodeAspects
	AspectsOptions      = types.AspectsOptions
	YoginiName          = types.YoginiName
	YoginiMahaDasha     = types.YoginiMahaDasha
	YoginiAntarDasha    = types.YoginiAntarDasha
	YoginiDashaResult   = types.YoginiDashaResult
	CharaMahaDasha      = types.CharaMahaDasha
	CharaDashaResult    = types.CharaDashaResult
	NarayanDirection    = types.NarayanDirection
	NarayanMahaDasha    = types.NarayanMahaDasha
	NarayanDashaResult  = types.NarayanDashaResult
	Dignity             = types.Dignity
	KpSubLordInfo       = types.KpSubLordInfo
	KpCuspalSubLords    = types.KpCuspalSubLords
	KpByPlanet          = types.KpByPlanet
	KpByHouse           = types.KpByHouse
	KpSignificators     = types.KpSignificators
	NatalMoon           = types.NatalMoon
	KootName            = types.KootName
	AshtakootOptions    = types.AshtakootOptions
	KootScore           = types.KootScore
	AshtakootResult     = types.AshtakootResult
	BirthChartOptions   = types.BirthChartOptions
	PoruthamName        = types.PoruthamName
	PoruthamScore       = types.PoruthamScore
	PathuPoruthamResult = types.PathuPoruthamResult
	NodeType            = types.NodeType
	SahamName           = types.SahamName
	TithiPraveshaChart  = types.TithiPraveshaChart
	SahamPosition       = types.SahamPosition
	MunthaInfo          = types.MunthaInfo
	Sahams              = types.Sahams
	VarshaphalaChart    = types.VarshaphalaChart
	ComputeYogasOptions = types.ComputeYogasOptions
)

const (
	SahamPunya             = types.SahamPunya
	SahamVidya             = types.SahamVidya
	SahamYasas             = types.SahamYasas
	SahamMitra             = types.SahamMitra
	SahamKarma             = types.SahamKarma
	SahamVivaha            = types.SahamVivaha
	SahamPutra             = types.SahamPutra
	SahamRoga              = types.SahamRoga
	SahamMarana            = types.SahamMarana
	SahamRajya             = types.SahamRajya
	SahamRaja              = types.SahamRaja
	SahamBandhu            = types.SahamBandhu
	SahamDharma            = types.SahamDharma
	SahamGnati             = types.SahamGnati
	SahamApamrityu         = types.SahamApamrityu
	SahamBhratri           = types.SahamBhratri
	SahamMatri             = types.SahamMatri
	SahamPitri             = types.SahamPitri
	SahamSama              = types.SahamSama
	SahamBandhana          = types.SahamBandhana
	SahamKaryasiddhi       = types.SahamKaryasiddhi
	SahamVyapara           = types.SahamVyapara
	SahamSastra            = types.SahamSastra
	SahamAsha              = types.SahamAsha
	SahamLabha             = types.SahamLabha
	SahamSusha             = types.SahamSusha
	SahamTapas             = types.SahamTapas
	SahamNameCount         = types.SahamNameCount
	NodeAspects7Only       = types.NodeAspects7Only
	NodeAspects5And9       = types.NodeAspects5And9
	NarayanForward         = types.NarayanForward
	NarayanBackward        = types.NarayanBackward
	KootVarna              = types.KootVarna
	KootVashya             = types.KootVashya
	KootTara               = types.KootTara
	KootYoni               = types.KootYoni
	KootGrahaMaitri        = types.KootGrahaMaitri
	KootGana               = types.KootGana
	KootBhakoot            = types.KootBhakoot
	KootNadi               = types.KootNadi
	PoruthamDina           = types.PoruthamDina
	PoruthamGana           = types.PoruthamGana
	PoruthamMahendra       = types.PoruthamMahendra
	PoruthamSthreeDeergha  = types.PoruthamSthreeDeergha
	PoruthamYoni           = types.PoruthamYoni
	PoruthamRashi          = types.PoruthamRashi
	PoruthamRashyathipathi = types.PoruthamRashyathipathi
	PoruthamVasya          = types.PoruthamVasya
	PoruthamRajju          = types.PoruthamRajju
	PoruthamVedha          = types.PoruthamVedha
	NodeMean               = types.NodeMean
	NodeTrue               = types.NodeTrue

	DignityExalted      = types.DignityExalted
	DignityMoolatrikona = types.DignityMoolatrikona
	DignityOwn          = types.DignityOwn
	DignityFriend       = types.DignityFriend
	DignityNeutral      = types.DignityNeutral
	DignityEnemy        = types.DignityEnemy
	DignityDebilitated  = types.DignityDebilitated
)

// Resolution helpers for the shared option types. They are package-level
// functions rather than methods so that they stay unexported: the types they
// act on live in the shared types package, where an unexported method would
// be unreachable from here.
func resolveAspectsOptions(o types.AspectsOptions) (types.NodeAspects, error) {
	switch o.NodeAspects {
	case "":
		return types.NodeAspects7Only, nil
	case types.NodeAspects7Only, types.NodeAspects5And9:
		return o.NodeAspects, nil
	}
	return "", types.NewPanchangError(
		`nodeAspects must be "7-only" or "5-and-9", got "`+string(o.NodeAspects)+`"`,
		types.ErrInvalidInput)
}

// AllDignities is the shared value list, aliased for the same reason.
var AllDignities = types.AllDignities
