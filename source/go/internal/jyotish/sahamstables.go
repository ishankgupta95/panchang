package jyotish

import (
	"encoding/json"
	"fmt"
)

type SahamName int

const (
	SahamPunya SahamName = iota
	SahamVidya
	SahamYasas
	SahamMitra
	SahamKarma
	SahamVivaha
	SahamPutra
	SahamRoga
	SahamMarana
	SahamRajya
	SahamRaja
	SahamBandhu
	SahamDharma
	SahamGnati
	SahamApamrityu
	SahamBhratri
	SahamMatri
	SahamPitri
	SahamSama
	SahamBandhana
	SahamKaryasiddhi
	SahamVyapara
	SahamSastra
	SahamAsha
	SahamLabha
	SahamSusha
	SahamTapas

	SahamNameCount = 27
)

var sahamNames = [SahamNameCount]string{
	"Punya", "Vidya", "Yasas", "Mitra", "Karma", "Vivaha", "Putra", "Roga",
	"Marana", "Rajya", "Raja", "Bandhu", "Dharma", "Gnati", "Apamrityu",
	"Bhratri", "Matri", "Pitri", "Sama", "Bandhana", "Karyasiddhi", "Vyapara",
	"Sastra", "Asha", "Labha", "Susha", "Tapas",
}

var AllSahamNames [SahamNameCount]SahamName

func init() {
	for i, f := range SahamFormulas {
		AllSahamNames[i] = f.Name
	}
}

func (n SahamName) Valid() bool { return n >= 0 && n < SahamNameCount }

func (n SahamName) String() string {
	if !n.Valid() {
		return fmt.Sprintf("SahamName(%d)", int(n))
	}
	return sahamNames[n]
}

func (n SahamName) MarshalJSON() ([]byte, error) {
	if !n.Valid() {
		return nil, fmt.Errorf("jyotish: invalid SahamName %d", int(n))
	}
	return json.Marshal(sahamNames[n])
}

func (n *SahamName) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return fmt.Errorf("jyotish: SahamName must be a string")
	}
	for i, name := range sahamNames {
		if name == s {
			*n = SahamName(i)
			return nil
		}
	}
	return fmt.Errorf("jyotish: unknown SahamName %q", s)
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
