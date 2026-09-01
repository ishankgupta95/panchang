package jyotish

import (
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
)

type PoruthamName string

const (
	PoruthamDina           PoruthamName = "Dina"
	PoruthamGana           PoruthamName = "Gana"
	PoruthamMahendra       PoruthamName = "Mahendra"
	PoruthamSthreeDeergha  PoruthamName = "SthreeDeergha"
	PoruthamYoni           PoruthamName = "Yoni"
	PoruthamRashi          PoruthamName = "Rashi"
	PoruthamRashyathipathi PoruthamName = "Rashyathipathi"
	PoruthamVasya          PoruthamName = "Vasya"
	PoruthamRajju          PoruthamName = "Rajju"
	PoruthamVedha          PoruthamName = "Vedha"
)

var AllPoruthamNames = [10]PoruthamName{
	PoruthamDina, PoruthamGana, PoruthamMahendra, PoruthamSthreeDeergha,
	PoruthamYoni, PoruthamRashi, PoruthamRashyathipathi, PoruthamVasya,
	PoruthamRajju, PoruthamVedha,
}

var VetoPoruthams = [3]PoruthamName{PoruthamYoni, PoruthamRajju, PoruthamVedha}

type PoruthamScore struct {
	Name        PoruthamName `json:"name"`
	Passes      bool         `json:"passes"`
	Description string       `json:"description"`
	Veto        *bool        `json:"veto,omitempty"`
}

type PathuPoruthamResult struct {
	TotalPasses int             `json:"totalPasses"`
	Recommended bool            `json:"recommended"`
	Poruthams   []PoruthamScore `json:"poruthams"`
}

func ComputePathuPorutham(boy, girl NatalMoon) (PathuPoruthamResult, error) {
	if err := validateNatalMoon(boy, "boy"); err != nil {
		return PathuPoruthamResult{}, err
	}
	if err := validateNatalMoon(girl, "girl"); err != nil {
		return PathuPoruthamResult{}, err
	}

	poruthams := []PoruthamScore{
		scoreDina(boy, girl),
		scorePoruthamGana(boy, girl),
		scoreMahendra(boy, girl),
		scoreSthreeDeergha(boy, girl),
		scorePoruthamYoni(boy, girl),
		scoreRashi(boy, girl),
		scoreRashyathipathi(boy, girl),
		scoreVasya(boy, girl),
		scoreRajju(boy, girl),
		scoreVedha(boy, girl),
	}

	totalPasses := 0
	vetoFailed := false
	for _, k := range poruthams {
		if k.Passes {
			totalPasses++
		}
		if k.Veto != nil && *k.Veto {
			vetoFailed = true
		}
	}

	return PathuPoruthamResult{
		TotalPasses: totalPasses,
		Recommended: !vetoFailed && totalPasses >= 5, // AstroVed / reference-almanac threshold
		Poruthams:   poruthams,
	}, nil
}

func vetoTrue() *bool { t := true; return &t }

func scoreDina(boy, girl NatalMoon) PoruthamScore {
	distance := ((boy.Nakshatra-girl.Nakshatra+27)%27 + 1)
	remainder := distance % 9
	passes := false
	for _, r := range DinaAuspiciousRemainders {
		if r == remainder {
			passes = true
			break
		}
	}
	return PoruthamScore{
		Name: PoruthamDina, Passes: passes,
		Description: "Girl→Boy nakshatra distance " + jsnum.FormatInt(int64(distance)) +
			" (mod 9 = " + jsnum.FormatInt(int64(remainder)) + "), " + auspiciousLabel(passes),
	}
}

func scorePoruthamGana(boy, girl NatalMoon) PoruthamScore {
	boyGana := NakshatraGana[boy.Nakshatra]
	girlGana := NakshatraGana[girl.Nakshatra]
	fails := (boyGana == GanaManushya && girlGana == GanaRakshasa) ||
		(boyGana == GanaRakshasa && girlGana == GanaManushya)
	description := "Boy " + string(boyGana) + " ↔ Girl " + string(girlGana)
	if fails {
		description += ", clash"
	}
	return PoruthamScore{Name: PoruthamGana, Passes: !fails, Description: description}
}

func scoreMahendra(boy, girl NatalMoon) PoruthamScore {
	distance := ((boy.Nakshatra-girl.Nakshatra+27)%27 + 1)
	passes := false
	for _, d := range MahendraAuspiciousDistances {
		if d == distance {
			passes = true
			break
		}
	}
	tail := "not in Mahendra set"
	if passes {
		tail = "in Mahendra set {4,7,10,13,16,19,22,25}"
	}
	return PoruthamScore{
		Name: PoruthamMahendra, Passes: passes,
		Description: "Girl→Boy nakshatra distance " + jsnum.FormatInt(int64(distance)) + ", " + tail,
	}
}

func scoreSthreeDeergha(boy, girl NatalMoon) PoruthamScore {
	distance := ((boy.Nakshatra-girl.Nakshatra+27)%27 + 1)
	passes := distance > 13
	tail := "longevity weak (≤ 13)"
	if passes {
		tail = "longevity favorable (> 13)"
	}
	return PoruthamScore{
		Name: PoruthamSthreeDeergha, Passes: passes,
		Description: "Girl→Boy nakshatra distance " + jsnum.FormatInt(int64(distance)) + ", " + tail,
	}
}

func scorePoruthamYoni(boy, girl NatalMoon) PoruthamScore {
	boyYoni := NakshatraYoni[boy.Nakshatra]
	girlYoni := NakshatraYoni[girl.Nakshatra]
	score := YoniScore[YoniIndex(boyYoni)][YoniIndex(girlYoni)]
	out := PoruthamScore{
		Name: PoruthamYoni, Passes: score >= 2,
		Description: string(boyYoni) + " ↔ " + string(girlYoni) +
			" (Ashtakoot Yoni score " + jsnum.FormatInt(int64(score)) + "/4)",
	}
	if score == 0 {
		out.Veto = vetoTrue()
	}
	return out
}

func scoreRashi(boy, girl NatalMoon) PoruthamScore {
	dBoyToGirl := ((girl.Rashi-boy.Rashi+12)%12 + 1)
	dGirlToBoy := ((boy.Rashi-girl.Rashi+12)%12 + 1)
	isDoshic := false
	for _, p := range RashiDoshicDistances {
		if p[0] == dBoyToGirl && p[1] == dGirlToBoy {
			isDoshic = true
			break
		}
	}
	description := "Rashi distance (" + jsnum.FormatInt(int64(dBoyToGirl)) + ", " +
		jsnum.FormatInt(int64(dGirlToBoy)) + ")"
	if isDoshic {
		description += ", doshic"
	}
	return PoruthamScore{Name: PoruthamRashi, Passes: !isDoshic, Description: description}
}

func scoreRashyathipathi(boy, girl NatalMoon) PoruthamScore {
	boyLord := RashiLord[boy.Rashi]
	girlLord := RashiLord[girl.Rashi]
	if boyLord == girlLord {
		return PoruthamScore{
			Name: PoruthamRashyathipathi, Passes: true,
			Description: "Same rashi-lord (graha index " +
				jsnum.FormatInt(int64(boyLord)) + "), full compatibility",
		}
	}
	boyView := NaisargikaMaitri[boyLord][girlLord]
	girlView := NaisargikaMaitri[girlLord][boyLord]
	return PoruthamScore{
		Name: PoruthamRashyathipathi, Passes: boyView != -1 && girlView != -1,
		Description: "Boy lord views girl lord as " + maitriLabel(boyView) +
			"; girl lord views boy lord as " + maitriLabel(girlView),
	}
}

func scoreVasya(boy, girl NatalMoon) PoruthamScore {
	boyVashya := RashiVashya[boy.Rashi]
	girlVashya := RashiVashya[girl.Rashi]
	score := VashyaScore[VashyaIndex(boyVashya)][VashyaIndex(girlVashya)]
	return PoruthamScore{
		Name: PoruthamVasya, Passes: score > 0,
		Description: string(boyVashya) + " ↔ " + string(girlVashya) +
			" (Ashtakoot Vashya score " + jsnum.FormatFloat(score) + "/2)",
	}
}

func scoreRajju(boy, girl NatalMoon) PoruthamScore {
	boyRajju := NakshatraRajju[boy.Nakshatra]
	girlRajju := NakshatraRajju[girl.Nakshatra]
	sameRajju := boyRajju == girlRajju
	description := "Boy " + string(boyRajju) + " ↔ Girl " + string(girlRajju) + ", different rajju"
	if sameRajju {
		description = "Both in " + string(boyRajju) + " Rajju, strong veto (longevity threat)"
	}
	out := PoruthamScore{Name: PoruthamRajju, Passes: !sameRajju, Description: description}
	if sameRajju {
		out.Veto = vetoTrue()
	}
	return out
}

func scoreVedha(boy, girl NatalMoon) PoruthamScore {
	partner, hasPartner := VedhaOf(boy.Nakshatra)
	isVedha := hasPartner && partner == girl.Nakshatra
	description := "No Vedha obstruction"
	if isVedha {
		description = "Boy nakshatra " + jsnum.FormatInt(int64(boy.Nakshatra)) +
			" ↔ Girl nakshatra " + jsnum.FormatInt(int64(girl.Nakshatra)) +
			" are vedha partners, strong veto"
	}
	out := PoruthamScore{Name: PoruthamVedha, Passes: !isVedha, Description: description}
	if isVedha {
		out.Veto = vetoTrue()
	}
	return out
}
