package muhurta

import "github.com/ishankgupta95/panchang/source/go/v5/types"

// These types are declared in the shared types package so that a caller can
// import them and their fields and methods render in the documentation. The
// aliases here keep this package's own references spelled unqualified.

type (
	BuildMuhurtaTableOptions = types.BuildMuhurtaTableOptions
	BhadraMode               = types.BhadraMode
	Paksha                   = types.Paksha
	MuhurtaRule              = types.MuhurtaRule
	MuhurtaScore             = types.MuhurtaScore
	MuhurtaDay               = types.MuhurtaDay
	MuhurtaScoreOptions      = types.MuhurtaScoreOptions
	MuhurtaFactorAxis        = types.MuhurtaFactorAxis
	MuhurtaFactor            = types.MuhurtaFactor
	PackedMuhurtaTableDay    = types.PackedMuhurtaTableDay
	MuhurtaTableMeta         = types.MuhurtaTableMeta
	MuhurtaFile              = types.MuhurtaFile
	MuhurtaTableDay          = types.MuhurtaTableDay
	MuhurtaYearRange         = types.TableYearRange
	VaraTithiYogaType        = types.VaraTithiYogaType
	VaraTithiYoga            = types.VaraTithiYoga
)

const (
	BhadraIgnore         = types.BhadraIgnore
	BhadraPenalize       = types.BhadraPenalize
	BhadraExclude        = types.BhadraExclude
	PakshaShukla         = types.PakshaShukla
	PakshaKrishna        = types.PakshaKrishna
	AxisTithi            = types.AxisTithi
	AxisNakshatra        = types.AxisNakshatra
	AxisVara             = types.AxisVara
	AxisKarana           = types.AxisKarana
	AxisYoga             = types.AxisYoga
	AxisSpecialYoga      = types.AxisSpecialYoga
	AxisVaraTithiYoga    = types.AxisVaraTithiYoga
	AxisExclusion        = types.AxisExclusion
	YogaSiddha           = types.YogaSiddha
	YogaAmrita           = types.YogaAmrita
	YogaDagdha           = types.YogaDagdha
	YogaVisha            = types.YogaVisha
	YogaHutasana         = types.YogaHutasana
	YogaKrakacha         = types.YogaKrakacha
	YogaSamvartaka       = types.YogaSamvartaka
	PolarityAuspicious   = types.PolarityAuspicious
	PolarityInauspicious = types.PolarityInauspicious
)

// Resolution helpers for the shared option types. They are package-level
// functions rather than methods so that they stay unexported: the types they
// act on live in the shared types package, where an unexported method would
// be unreachable from here.
func ruleResolvedBhadra(r types.MuhurtaRule) types.BhadraMode {
	if r.Bhadra != nil {
		return *r.Bhadra
	}
	if r.ExcludeBhadra {
		return types.BhadraExclude
	}
	return types.BhadraIgnore
}

func ruleScoresVaraTithiYogas(r types.MuhurtaRule) bool {
	return r.VaraTithiYogas == nil || *r.VaraTithiYogas
}

func scoreOptionsPanchangOptions(o types.MuhurtaScoreOptions) types.PanchangOptions {
	return types.PanchangOptions{
		InstantPanchangOptions: types.InstantPanchangOptions{
			Ayanamsa:   o.Ayanamsa,
			Language:   o.Language,
			MasaSystem: o.MasaSystem,
		},
		Timezone: o.Timezone,
	}
}
