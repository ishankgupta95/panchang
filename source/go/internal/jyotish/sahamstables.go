package jyotish

import (
	"fmt"
)

var AllSahamNames [SahamNameCount]SahamName

func init() {
	for i, f := range SahamFormulas {
		AllSahamNames[i] = f.Name
	}
}

type SahamOperand int

const (
	OperandSun SahamOperand = iota
	OperandMoon
	OperandMars
	OperandMercury
	OperandJupiter
	OperandVenus
	OperandSaturn
	OperandAsc // the varsha-chart lagna, not the natal one
	OperandAscLord
	OperandHouse11Cusp // whole-sign: floor(asc/30)*30 + 300°
	OperandPunya

	operandCount = 11
)

var sahamOperandNames = [operandCount]string{
	"Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn",
	"Asc", "AscLord", "House11Cusp", "Punya",
}

func (o SahamOperand) String() string {
	if o < 0 || o >= operandCount {
		return fmt.Sprintf("SahamOperand(%d)", int(o))
	}
	return sahamOperandNames[o]
}

type SahamFormula struct {
	Name    SahamName
	X, Y, Z SahamOperand // (X − Y + Z) mod 360°
	Swap    bool         // X and Y exchange for night birth; rows using Punya inherit its swap
}

var SahamFormulas = [SahamNameCount]SahamFormula{
	{SahamPunya, OperandMoon, OperandSun, OperandAsc, true},              // merit
	{SahamVidya, OperandSun, OperandMoon, OperandAsc, true},              // learning
	{SahamYasas, OperandJupiter, OperandPunya, OperandAsc, true},         // fame
	{SahamMitra, OperandJupiter, OperandPunya, OperandVenus, true},       // friends
	{SahamKarma, OperandMars, OperandMercury, OperandAsc, true},          // career
	{SahamVivaha, OperandVenus, OperandSaturn, OperandAsc, false},        // marriage
	{SahamPutra, OperandJupiter, OperandMoon, OperandAsc, false},         // progeny
	{SahamRoga, OperandSaturn, OperandMoon, OperandAsc, true},            // disease
	{SahamMarana, OperandSaturn, OperandMoon, OperandAsc, false},         // death, a Roga variant
	{SahamRajya, OperandSaturn, OperandSun, OperandAsc, true},            // kingdom
	{SahamRaja, OperandSun, OperandMars, OperandAsc, false},              // royalty, distinct from Rajya by anchor
	{SahamBandhu, OperandMercury, OperandMoon, OperandAsc, true},         // relatives
	{SahamDharma, OperandSun, OperandJupiter, OperandAsc, false},         // righteousness, Sanjay Rath variant
	{SahamGnati, OperandMars, OperandMoon, OperandAsc, true},             // kinsmen
	{SahamApamrityu, OperandMars, OperandSaturn, OperandAsc, false},      // untimely death
	{SahamBhratri, OperandJupiter, OperandSaturn, OperandAsc, false},     // siblings
	{SahamMatri, OperandMoon, OperandVenus, OperandAsc, true},            // mother
	{SahamPitri, OperandSaturn, OperandSun, OperandAsc, true},            // father, the same formula as Rajya
	{SahamSama, OperandSun, OperandSaturn, OperandAsc, false},            // equanimity
	{SahamBandhana, OperandSaturn, OperandMars, OperandMercury, false},   // imprisonment
	{SahamKaryasiddhi, OperandSaturn, OperandSun, OperandAscLord, false}, // success of work
	{SahamVyapara, OperandMars, OperandSaturn, OperandAscLord, false},    // commerce
	{SahamSastra, OperandJupiter, OperandSaturn, OperandMercury, false},  // sciences
	{SahamAsha, OperandMercury, OperandSaturn, OperandAsc, false},        // hopes
	{SahamLabha, OperandHouse11Cusp, OperandAscLord, OperandAsc, false},  // gain
	{SahamSusha, OperandSaturn, OperandPunya, OperandAsc, true},          // well-being
	{SahamTapas, OperandSun, OperandSaturn, OperandMercury, false},       // austerity
}
