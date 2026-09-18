package utils

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

const (
	TithiSpan         float64 = 12
	NakshatraSpan     float64 = 360.0 / 27
	NakshatraPadaSpan float64 = NakshatraSpan / 4
	YogaSpan          float64 = 360.0 / 27
	KaranaSpan        float64 = 6
	RashiSpan         float64 = 30
)

func NakshatraOf(siderealLongitude float64) int {
	return int(math.Floor(siderealLongitude / NakshatraSpan))
}

func RashiOf(siderealLongitude float64) int {
	return int(math.Floor(siderealLongitude / RashiSpan))
}

var (
	RahuKalamSlots = [7]int{7, 1, 6, 4, 5, 3, 2}
	YamagandaSlots = [7]int{4, 3, 2, 1, 0, 6, 5}
	GulikaSlots    = [7]int{6, 5, 4, 3, 2, 1, 0}
)

var EnglishDayNames = [7]string{
	"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
}

const (
	TotalTithis     = 30
	TotalNakshatras = 27
	TotalYogas      = 27
	TotalKaranas    = 60
)

const (
	MaxDailyTithis     = 3
	MaxDailyNakshatras = 3
	MaxDailyYogas      = 3
	MaxDailyKaranas    = 5
)

const (
	TithiSearchHours     float64 = 36
	NakshatraSearchHours float64 = 36
	YogaSearchHours      float64 = 36
	KaranaSearchHours    float64 = 18
)

var VarjyamOffsetGhatikas = [27]int{
	50, // 0  Ashwini
	24, // 1  Bharani
	30, // 2  Krittika
	40, // 3  Rohini
	14, // 4  Mrigashira
	21, // 5  Ardra
	30, // 6  Punarvasu
	20, // 7  Pushya
	32, // 8  Ashlesha
	30, // 9  Magha
	20, // 10 Purva Phalguni
	18, // 11 Uttara Phalguni
	21, // 12 Hasta
	20, // 13 Chitra
	14, // 14 Swati
	14, // 15 Vishakha
	10, // 16 Anuradha
	14, // 17 Jyeshtha
	56, // 18 Mula
	24, // 19 Purva Ashadha
	20, // 20 Uttara Ashadha
	10, // 21 Shravana
	10, // 22 Dhanishta
	18, // 23 Shatabhisha
	16, // 24 Purva Bhadrapada
	24, // 25 Uttara Bhadrapada
	30, // 26 Revati
}

var VarjyamSecondOffsetGhatikas = map[int]int{
	18: 20, // Mula
}

var AnandadiTable = buildAnandadiTable()

func buildAnandadiTable() [7][27]int {
	var rows [7][27]int
	for v := 0; v < 7; v++ {
		for n27 := 0; n27 < 27; n27++ {
			n28 := n27
			if n27 >= 21 {
				n28 = n27 + 1
			}
			rows[v][n27] = (n28 - 4*v + 28) % 28
		}
	}
	return rows
}

var AnandadiQuality = [28]types.ChoghadiyaQuality{
	types.QualityAuspicious,   //  0 Ananda
	types.QualityInauspicious, //  1 Kaladanda
	types.QualityInauspicious, //  2 Dhumra
	types.QualityAuspicious,   //  3 Prajapati
	types.QualityAuspicious,   //  4 Saumya
	types.QualityInauspicious, //  5 Dhwanksha
	types.QualityAuspicious,   //  6 Dhwaja
	types.QualityAuspicious,   //  7 Shrivatsa
	types.QualityInauspicious, //  8 Vajra
	types.QualityInauspicious, //  9 Mudgara
	types.QualityAuspicious,   // 10 Chhatra
	types.QualityAuspicious,   // 11 Maitra
	types.QualityAuspicious,   // 12 Manasa
	types.QualityAuspicious,   // 13 Padma
	types.QualityInauspicious, // 14 Lumba
	types.QualityInauspicious, // 15 Utpaata
	types.QualityInauspicious, // 16 Mrityu
	types.QualityInauspicious, // 17 Kana
	types.QualityAuspicious,   // 18 Siddhi
	types.QualityAuspicious,   // 19 Shubha
	types.QualityAuspicious,   // 20 Amrita
	types.QualityInauspicious, // 21 Musala
	types.QualityInauspicious, // 22 Gada
	types.QualityAuspicious,   // 23 Matanga
	types.QualityInauspicious, // 24 Raksha
	types.QualityAuspicious,   // 25 Charma
	types.QualityAuspicious,   // 26 Sthira
	types.QualityAuspicious,   // 27 Vardhamana
}

const TotalAnandadiYogas = 28
