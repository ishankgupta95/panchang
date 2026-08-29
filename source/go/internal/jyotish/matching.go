package jyotish

import (
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

type NatalMoon struct {
	Rashi         int
	Nakshatra     int
	LagnaRashi    *int
	NavamsaRashi  *int
	NakshatraPada *int // validated, never read
}

type KootName string

const (
	KootVarna       KootName = "Varna"
	KootVashya      KootName = "Vashya"
	KootTara        KootName = "Tara"
	KootYoni        KootName = "Yoni"
	KootGrahaMaitri KootName = "Graha Maitri"
	KootGana        KootName = "Gana"
	KootBhakoot     KootName = "Bhakoot"
	KootNadi        KootName = "Nadi"
)

var AllKootNames = [8]KootName{
	KootVarna, KootVashya, KootTara, KootYoni,
	KootGrahaMaitri, KootGana, KootBhakoot, KootNadi,
}

var KootMaxScores = [8]float64{1, 2, 3, 4, 5, 6, 7, 8}

type AshtakootOptions struct {
	GanaCancellation bool // the reference almanac's 36-guna table applies no Gana cancellation
}

type KootScore struct {
	Name        KootName `json:"name"`
	Score       float64  `json:"score"` // float64 for Tara alone: 1.5 per auspicious direction
	MaxScore    float64  `json:"maxScore"`
	Description string   `json:"description"`
}

type AshtakootResult struct {
	TotalScore    float64     `json:"totalScore"`
	Koots         []KootScore `json:"koots"`
	Cancellations []string    `json:"cancellations"` // non-nil even when empty
}

func ComputeAshtakoot(boy, girl NatalMoon, options AshtakootOptions) (AshtakootResult, error) {
	if err := validateNatalMoon(boy, "boy"); err != nil {
		return AshtakootResult{}, err
	}
	if err := validateNatalMoon(girl, "girl"); err != nil {
		return AshtakootResult{}, err
	}

	cancellations := make([]string, 0, 3)

	koots := []KootScore{
		scoreVarna(boy, girl),
		scoreVashya(boy, girl),
		scoreTara(boy, girl),
		scoreYoni(boy, girl),
		scoreGrahaMaitri(boy, girl),
		scoreGana(boy, girl, &cancellations, options.GanaCancellation),
		scoreBhakoot(boy, girl, &cancellations),
		scoreNadi(boy, girl, &cancellations),
	}

	total := 0.0
	for _, k := range koots {
		total += k.Score
	}
	return AshtakootResult{TotalScore: total, Koots: koots, Cancellations: cancellations}, nil
}

func validateNatalMoon(m NatalMoon, label string) error {
	if m.Rashi < 0 || m.Rashi >= 12 {
		return types.Codef(types.ErrInvalidInput,
			"%s.rashi must be integer in [0, 11], got %d", label, m.Rashi)
	}
	if err := utils.AssertNakshatraIndex(m.Nakshatra, label+".nakshatra"); err != nil {
		return err
	}
	if m.LagnaRashi != nil && (*m.LagnaRashi < 0 || *m.LagnaRashi >= 12) {
		return types.Codef(types.ErrInvalidInput,
			"%s.lagnaRashi must be integer in [0, 11], got %d", label, *m.LagnaRashi)
	}
	if m.NavamsaRashi != nil && (*m.NavamsaRashi < 0 || *m.NavamsaRashi >= 12) {
		return types.Codef(types.ErrInvalidInput,
			"%s.navamsaRashi must be integer in [0, 11], got %d", label, *m.NavamsaRashi)
	}
	if m.NakshatraPada != nil && (*m.NakshatraPada < 1 || *m.NakshatraPada > 4) {
		return types.Codef(types.ErrInvalidInput,
			"%s.nakshatraPada must be integer in [1, 4], got %d", label, *m.NakshatraPada)
	}
	return nil
}

func scoreVarna(boy, girl NatalMoon) KootScore {
	boyVarna := RashiVarna[boy.Rashi]
	girlVarna := RashiVarna[girl.Rashi]
	score := 0.0
	if VarnaRank[boyVarna] >= VarnaRank[girlVarna] {
		score = 1
	}
	return KootScore{
		Name: KootVarna, Score: score, MaxScore: 1,
		Description: "Boy's varna (" + string(boyVarna) + ") vs girl's (" + string(girlVarna) + ")",
	}
}

func scoreVashya(boy, girl NatalMoon) KootScore {
	bv := RashiVashya[boy.Rashi]
	gv := RashiVashya[girl.Rashi]
	return KootScore{
		Name: KootVashya, Score: VashyaScore[VashyaIndex(bv)][VashyaIndex(gv)], MaxScore: 2,
		Description: string(bv) + " ↔ " + string(gv),
	}
}

func scoreTara(boy, girl NatalMoon) KootScore {
	dBoyToGirl := ((girl.Nakshatra-boy.Nakshatra+27)%27 + 1)
	dGirlToBoy := ((boy.Nakshatra-girl.Nakshatra+27)%27 + 1)
	remBoyToGirl := dBoyToGirl % 9
	remGirlToBoy := dGirlToBoy % 9
	auspiciousBoyToGirl := !inauspiciousTara(remBoyToGirl)
	auspiciousGirlToBoy := !inauspiciousTara(remGirlToBoy)
	score := 0.0
	if auspiciousBoyToGirl {
		score += 1.5
	}
	if auspiciousGirlToBoy {
		score += 1.5
	}
	return KootScore{
		Name: KootTara, Score: score, MaxScore: 3,
		Description: "Boy→Girl rem " + jsnum.FormatInt(int64(remBoyToGirl)) +
			" (" + auspiciousLabel(auspiciousBoyToGirl) + "); Girl→Boy rem " +
			jsnum.FormatInt(int64(remGirlToBoy)) + " (" + auspiciousLabel(auspiciousGirlToBoy) + ")",
	}
}

func inauspiciousTara(rem int) bool {
	for _, r := range InauspiciousTaraRemainders {
		if r == rem {
			return true
		}
	}
	return false
}

func auspiciousLabel(ok bool) string {
	if ok {
		return "auspicious"
	}
	return "inauspicious"
}

func scoreYoni(boy, girl NatalMoon) KootScore {
	by := NakshatraYoni[boy.Nakshatra]
	gy := NakshatraYoni[girl.Nakshatra]
	return KootScore{
		Name: KootYoni, Score: float64(YoniScore[YoniIndex(by)][YoniIndex(gy)]), MaxScore: 4,
		Description: string(by) + " ↔ " + string(gy),
	}
}

func scoreGrahaMaitri(boy, girl NatalMoon) KootScore {
	boyLord := RashiLord[boy.Rashi]
	girlLord := RashiLord[girl.Rashi]
	var score float64
	var description string
	if boyLord == girlLord {
		score = 5
		// the published string reads "graha 2", not the lord's name
		description = "Same rashi-lord (graha " + jsnum.FormatInt(int64(boyLord)) + "), full marks"
	} else {
		boyView := NaisargikaMaitri[boyLord][girlLord]
		girlView := NaisargikaMaitri[girlLord][boyLord]
		score = GrahaMaitriScore[MaitriIdx(boyView)][MaitriIdx(girlView)]
		description = "Boy lord views girl lord as " + maitriLabel(boyView) +
			"; girl lord views boy lord as " + maitriLabel(girlView)
	}
	return KootScore{Name: KootGrahaMaitri, Score: score, MaxScore: 5, Description: description}
}

func maitriLabel(v int) string {
	switch v {
	case 1:
		return "friend"
	case -1:
		return "enemy"
	}
	return "neutral"
}

func scoreGana(boy, girl NatalMoon, cancellations *[]string, applyCancellation bool) KootScore {
	bg := NakshatraGana[boy.Nakshatra]
	gg := NakshatraGana[girl.Nakshatra]
	score := float64(GanaScore[GanaIdx(bg)][GanaIdx(gg)])
	description := string(bg) + " ↔ " + string(gg)

	// score ≤ 1 is the doshic pair: Manushya-Rakshasa (0) or Deva-Rakshasa (1)
	if applyCancellation && score <= 1 {
		boyLord := RashiLord[boy.Rashi]
		girlLord := RashiLord[girl.Rashi]
		sameLord := boyLord == girlLord
		mutualFriend := NaisargikaMaitri[boyLord][girlLord] == 1 &&
			NaisargikaMaitri[girlLord][boyLord] == 1
		if sameLord || mutualFriend {
			score = 6
			reason := lordReason(sameLord)
			description += ", cancelled by " + reason
			*cancellations = append(*cancellations, "Gana: "+reason)
		}
	}

	return KootScore{Name: KootGana, Score: score, MaxScore: 6, Description: description}
}

func lordReason(sameLord bool) string {
	if sameLord {
		return "same rashi-lord"
	}
	return "mutual friendship of rashi-lords"
}

func scoreBhakoot(boy, girl NatalMoon, cancellations *[]string) KootScore {
	dBoyToGirl := ((girl.Rashi-boy.Rashi+12)%12 + 1)
	dGirlToBoy := ((boy.Rashi-girl.Rashi+12)%12 + 1)

	isDoshic := false
	for _, p := range BhakootDoshicDistances {
		if p[0] == dBoyToGirl && p[1] == dGirlToBoy {
			isDoshic = true
			break
		}
	}

	score := 7.0
	description := "Distance (" + jsnum.FormatInt(int64(dBoyToGirl)) + ", " +
		jsnum.FormatInt(int64(dGirlToBoy)) + ")"
	if isDoshic {
		score = 0
		description = "Doshic distance (" + jsnum.FormatInt(int64(dBoyToGirl)) + ", " +
			jsnum.FormatInt(int64(dGirlToBoy)) + ")"
	}

	if isDoshic {
		boyLord := RashiLord[boy.Rashi]
		girlLord := RashiLord[girl.Rashi]
		sameLord := boyLord == girlLord
		mutualFriend := NaisargikaMaitri[boyLord][girlLord] == 1 &&
			NaisargikaMaitri[girlLord][boyLord] == 1
		if sameLord || mutualFriend {
			score = 7
			reason := lordReason(sameLord)
			description += ", cancelled by " + reason
			*cancellations = append(*cancellations, "Bhakoot: "+reason)
		} else {
			if boy.LagnaRashi != nil && girl.LagnaRashi != nil {
				boyLagnaLord := RashiLord[*boy.LagnaRashi]
				girlLagnaLord := RashiLord[*girl.LagnaRashi]
				if boyLagnaLord == girlLagnaLord {
					score = 7
					description += ", cancelled by same lagna-lord"
					*cancellations = append(*cancellations, "Bhakoot: same lagna-lord")
				} else {
					boySeventhLord := RashiLord[(*boy.LagnaRashi+6)%12]
					girlSeventhLord := RashiLord[(*girl.LagnaRashi+6)%12]
					if boySeventhLord == girlSeventhLord {
						score = 7
						description += ", cancelled by same 7th-house lord"
						*cancellations = append(*cancellations, "Bhakoot: same 7th-house lord")
					}
				}
			}
			if score == 0 && boy.NavamsaRashi != nil && girl.NavamsaRashi != nil {
				if RashiLord[*boy.NavamsaRashi] == RashiLord[*girl.NavamsaRashi] {
					score = 7
					description += ", cancelled by same Navamsa lord"
					*cancellations = append(*cancellations, "Bhakoot: same Navamsa lord")
				}
			}
		}
	}
	return KootScore{Name: KootBhakoot, Score: score, MaxScore: 7, Description: description}
}

func scoreNadi(boy, girl NatalMoon, cancellations *[]string) KootScore {
	bn := NakshatraNadi[boy.Nakshatra]
	gn := NakshatraNadi[girl.Nakshatra]
	sameNadi := bn == gn
	score := 8.0
	if sameNadi {
		score = 0
	}
	description := string(bn) + " ↔ " + string(gn)

	if sameNadi {
		sameNakshatra := boy.Nakshatra == girl.Nakshatra
		sameRashi := boy.Rashi == girl.Rashi
		if sameNakshatra || sameRashi {
			score = 8
			reason := "same rashi"
			if sameNakshatra {
				reason = "same nakshatra"
			}
			description += ", cancelled by " + reason
			*cancellations = append(*cancellations, "Nadi: "+reason)
		}
	}
	return KootScore{Name: KootNadi, Score: score, MaxScore: 8, Description: description}
}
