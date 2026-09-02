package jyotish

type Rajju string

const (
	RajjuPada   Rajju = "Pada"
	RajjuKati   Rajju = "Kati"
	RajjuNabhi  Rajju = "Nabhi"
	RajjuKantha Rajju = "Kantha"
	RajjuSira   Rajju = "Sira"
)

var AllRajjus = []Rajju{RajjuPada, RajjuKati, RajjuNabhi, RajjuKantha, RajjuSira}

var NakshatraRajju = [27]Rajju{
	RajjuPada,   // 0  Ashwini
	RajjuKati,   // 1  Bharani
	RajjuNabhi,  // 2  Krittika
	RajjuKantha, // 3  Rohini
	RajjuSira,   // 4  Mrigashira
	RajjuKantha, // 5  Ardra
	RajjuNabhi,  // 6  Punarvasu
	RajjuKati,   // 7  Pushya
	RajjuPada,   // 8  Ashlesha
	RajjuPada,   // 9  Magha
	RajjuKati,   // 10 P. Phalguni
	RajjuNabhi,  // 11 U. Phalguni
	RajjuKantha, // 12 Hasta
	RajjuSira,   // 13 Chitra
	RajjuKantha, // 14 Swati
	RajjuNabhi,  // 15 Vishakha
	RajjuKati,   // 16 Anuradha
	RajjuPada,   // 17 Jyeshtha
	RajjuPada,   // 18 Mula
	RajjuKati,   // 19 P. Ashadha
	RajjuNabhi,  // 20 U. Ashadha
	RajjuKantha, // 21 Shravana
	RajjuSira,   // 22 Dhanishtha
	RajjuKantha, // 23 Shatabhisha
	RajjuNabhi,  // 24 P. Bhadrapada
	RajjuKati,   // 25 U. Bhadrapada
	RajjuPada,   // 26 Revati
}

var VedhaPairs = [13][2]int{
	{0, 17},  // Ashwini ↔ Jyeshtha
	{1, 16},  // Bharani ↔ Anuradha
	{2, 15},  // Krittika ↔ Vishakha
	{3, 14},  // Rohini ↔ Swati
	{4, 22},  // Mrigashira ↔ Dhanishtha
	{5, 21},  // Ardra ↔ Shravana
	{6, 20},  // Punarvasu ↔ U. Ashadha
	{7, 19},  // Pushya ↔ P. Ashadha
	{8, 18},  // Ashlesha ↔ Mula
	{9, 26},  // Magha ↔ Revati
	{10, 25}, // P. Phalguni ↔ U. Bhadrapada
	{11, 24}, // U. Phalguni ↔ P. Bhadrapada
	{12, 23}, // Hasta ↔ Shatabhisha
}

func VedhaOf(nakIdx int) (int, bool) {
	for _, p := range VedhaPairs {
		if p[0] == nakIdx {
			return p[1], true
		}
		if p[1] == nakIdx {
			return p[0], true
		}
	}
	return 0, false
}

var MahendraAuspiciousDistances = [8]int{4, 7, 10, 13, 16, 19, 22, 25}

var DinaAuspiciousRemainders = [5]int{0, 2, 4, 6, 8}

var RashiDoshicDistances = [4][2]int{
	{2, 12}, {12, 2},
	{6, 8}, {8, 6},
}
