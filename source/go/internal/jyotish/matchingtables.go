package jyotish

import "github.com/ishankgupta95/panchang/source/go/v5/types"

type Varna string

const (
	VarnaBrahmin   Varna = "brahmin"
	VarnaKshatriya Varna = "kshatriya"
	VarnaVaishya   Varna = "vaishya"
	VarnaShudra    Varna = "shudra"
)

var AllVarnas = []Varna{VarnaBrahmin, VarnaKshatriya, VarnaVaishya, VarnaShudra}

var VarnaRank = map[Varna]int{
	VarnaBrahmin: 4, VarnaKshatriya: 3, VarnaVaishya: 2, VarnaShudra: 1,
}

var RashiVarna = [12]Varna{
	VarnaKshatriya, // 0  Aries       (fire)
	VarnaVaishya,   // 1  Taurus      (earth)
	VarnaShudra,    // 2  Gemini      (air)
	VarnaBrahmin,   // 3  Cancer      (water)
	VarnaKshatriya, // 4  Leo         (fire)
	VarnaVaishya,   // 5  Virgo       (earth)
	VarnaShudra,    // 6  Libra       (air)
	VarnaBrahmin,   // 7  Scorpio     (water)
	VarnaKshatriya, // 8  Sagittarius (fire)
	VarnaVaishya,   // 9  Capricorn   (earth)
	VarnaShudra,    // 10 Aquarius    (air)
	VarnaBrahmin,   // 11 Pisces      (water)
}

type Vashya string

const (
	VashyaQuadruped Vashya = "quadruped"
	VashyaHuman     Vashya = "human"
	VashyaWater     Vashya = "water"
	VashyaWild      Vashya = "wild"
	VashyaInsect    Vashya = "insect"
)

var AllVashyas = []Vashya{VashyaQuadruped, VashyaHuman, VashyaWater, VashyaWild, VashyaInsect}

var RashiVashya = [12]Vashya{
	VashyaQuadruped, // 0  Aries
	VashyaQuadruped, // 1  Taurus
	VashyaHuman,     // 2  Gemini
	VashyaWater,     // 3  Cancer
	VashyaWild,      // 4  Leo
	VashyaHuman,     // 5  Virgo
	VashyaHuman,     // 6  Libra
	VashyaInsect,    // 7  Scorpio
	VashyaHuman,     // 8  Sagittarius, front half human
	VashyaQuadruped, // 9  Capricorn, front half quadruped
	VashyaHuman,     // 10 Aquarius
	VashyaWater,     // 11 Pisces
}

var vIndex = map[Vashya]int{
	VashyaQuadruped: 0, VashyaHuman: 1, VashyaWater: 2, VashyaWild: 3, VashyaInsect: 4,
}

var VashyaScore = [5][5]float64{
	{2, 0, 1, 0, 1},       // Quadruped
	{0, 2, 0.5, 0, 0.5},   // Human
	{1, 0.5, 2, 0, 0.5},   // Water
	{0, 0, 0, 2, 0},       // Wild
	{0.5, 0.5, 0.5, 0, 2}, // Insect
}

func VashyaIndex(v Vashya) int { return vIndex[v] }

type YoniAnimal string

const (
	YoniHorse    YoniAnimal = "horse"
	YoniElephant YoniAnimal = "elephant"
	YoniSheep    YoniAnimal = "sheep"
	YoniSnake    YoniAnimal = "snake"
	YoniDog      YoniAnimal = "dog"
	YoniCat      YoniAnimal = "cat"
	YoniRat      YoniAnimal = "rat"
	YoniCow      YoniAnimal = "cow"
	YoniBuffalo  YoniAnimal = "buffalo"
	YoniTiger    YoniAnimal = "tiger"
	YoniDeer     YoniAnimal = "deer"
	YoniMonkey   YoniAnimal = "monkey"
	YoniMongoose YoniAnimal = "mongoose"
	YoniLion     YoniAnimal = "lion"
)

var AllYoniAnimals = []YoniAnimal{
	YoniHorse, YoniElephant, YoniSheep, YoniSnake, YoniDog, YoniCat, YoniRat,
	YoniCow, YoniBuffalo, YoniTiger, YoniDeer, YoniMonkey, YoniMongoose, YoniLion,
}

var NakshatraYoni = [27]YoniAnimal{
	YoniHorse,    // 0  Ashwini
	YoniElephant, // 1  Bharani
	YoniSheep,    // 2  Krittika
	YoniSnake,    // 3  Rohini
	YoniSnake,    // 4  Mrigashira
	YoniDog,      // 5  Ardra
	YoniCat,      // 6  Punarvasu
	YoniSheep,    // 7  Pushya
	YoniCat,      // 8  Ashlesha
	YoniRat,      // 9  Magha
	YoniRat,      // 10 P. Phalguni
	YoniCow,      // 11 U. Phalguni
	YoniBuffalo,  // 12 Hasta
	YoniTiger,    // 13 Chitra
	YoniBuffalo,  // 14 Swati
	YoniTiger,    // 15 Vishakha
	YoniDeer,     // 16 Anuradha
	YoniDeer,     // 17 Jyeshtha
	YoniDog,      // 18 Mula
	YoniMonkey,   // 19 P. Ashadha
	YoniMongoose, // 20 U. Ashadha
	YoniMonkey,   // 21 Shravana
	YoniLion,     // 22 Dhanishtha
	YoniHorse,    // 23 Shatabhisha
	YoniLion,     // 24 P. Bhadrapada
	YoniCow,      // 25 U. Bhadrapada
	YoniElephant, // 26 Revati
}

var yIndex = map[YoniAnimal]int{
	YoniHorse: 0, YoniElephant: 1, YoniSheep: 2, YoniSnake: 3, YoniDog: 4,
	YoniCat: 5, YoniRat: 6, YoniCow: 7, YoniBuffalo: 8, YoniTiger: 9,
	YoniDeer: 10, YoniMonkey: 11, YoniMongoose: 12, YoniLion: 13,
}

func YoniIndex(y YoniAnimal) int { return yIndex[y] }

// YoniScore is the Ashtakoot Yoni koota, boy row by girl column in YoniIndex
// order; it is symmetric. 4 is the same animal, 3 friendly, 2 neutral, 1
// unfriendly and 0 the seven mahavaira pairs, the only cells Muhurta
// Chintamani (vivaha 25-26) fixes itself. The rest is the Yoni chakra of
// Mahidhar Sharma's Hindi tika on that text as carried by Frawley and the
// Jagannatha Hora port PyJHora, whose table this equals except horse-deer 3
// and tiger-lion 2, which follow the printed chakra.
var YoniScore = [14][14]int{
	{4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1}, // Horse
	{2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0}, // Elephant
	{2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1}, // Sheep
	{3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2}, // Snake
	{2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1}, // Dog
	{2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1}, // Cat
	{2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2}, // Rat
	{1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1}, // Cow
	{0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1}, // Buffalo
	{1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 2}, // Tiger
	{3, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1}, // Deer
	{3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2}, // Monkey
	{2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2}, // Mongoose
	{1, 0, 1, 2, 1, 1, 2, 1, 1, 2, 1, 2, 2, 4}, // Lion
}

var RashiLord = [12]types.VisibleGraha{
	types.VisibleMars,    // 0  Aries
	types.VisibleVenus,   // 1  Taurus
	types.VisibleMercury, // 2  Gemini
	types.VisibleMoon,    // 3  Cancer
	types.VisibleSun,     // 4  Leo
	types.VisibleMercury, // 5  Virgo
	types.VisibleVenus,   // 6  Libra
	types.VisibleMars,    // 7  Scorpio
	types.VisibleJupiter, // 8  Sagittarius
	types.VisibleSaturn,  // 9  Capricorn
	types.VisibleSaturn,  // 10 Aquarius
	types.VisibleJupiter, // 11 Pisces
}

var NaisargikaMaitri = [7][7]int{
	{0, 1, 1, 0, 1, -1, -1},  // Sun
	{1, 0, 0, 1, 0, 0, 0},    // Moon
	{1, 1, 0, -1, 1, 0, 0},   // Mars
	{1, -1, 0, 0, 0, 1, 0},   // Mercury
	{1, 1, 1, -1, 0, -1, 0},  // Jupiter
	{-1, -1, 0, 1, 0, 0, 1},  // Venus
	{-1, -1, -1, 1, 0, 1, 0}, // Saturn
}

var GrahaMaitriScore = [3][3]float64{
	{0, 1, 0.5}, // enemy
	{1, 3, 4},   // neutral
	{0.5, 4, 5}, // friend
}

func MaitriIdx(v int) int { return v + 1 }

type Gana string

const (
	GanaDeva     Gana = "deva"
	GanaManushya Gana = "manushya"
	GanaRakshasa Gana = "rakshasa"
)

var AllGanas = []Gana{GanaDeva, GanaManushya, GanaRakshasa}

var NakshatraGana = [27]Gana{
	GanaDeva,     // 0  Ashwini
	GanaManushya, // 1  Bharani
	GanaRakshasa, // 2  Krittika
	GanaManushya, // 3  Rohini
	GanaDeva,     // 4  Mrigashira
	GanaManushya, // 5  Ardra
	GanaDeva,     // 6  Punarvasu
	GanaDeva,     // 7  Pushya
	GanaRakshasa, // 8  Ashlesha
	GanaRakshasa, // 9  Magha
	GanaManushya, // 10 P. Phalguni
	GanaManushya, // 11 U. Phalguni
	GanaDeva,     // 12 Hasta
	GanaRakshasa, // 13 Chitra
	GanaDeva,     // 14 Swati
	GanaRakshasa, // 15 Vishakha
	GanaDeva,     // 16 Anuradha
	GanaRakshasa, // 17 Jyeshtha
	GanaRakshasa, // 18 Mula
	GanaManushya, // 19 P. Ashadha
	GanaManushya, // 20 U. Ashadha
	GanaDeva,     // 21 Shravana
	GanaRakshasa, // 22 Dhanishtha
	GanaRakshasa, // 23 Shatabhisha
	GanaManushya, // 24 P. Bhadrapada
	GanaManushya, // 25 U. Bhadrapada
	GanaDeva,     // 26 Revati
}

var gIndex = map[Gana]int{GanaDeva: 0, GanaManushya: 1, GanaRakshasa: 2}

func GanaIdx(g Gana) int { return gIndex[g] }

var GanaScore = [3][3]int{
	{6, 5, 1}, // Deva
	{5, 6, 0}, // Manushya
	{1, 0, 6}, // Rakshasa
}

type Nadi string

const (
	NadiAdi    Nadi = "adi"
	NadiMadhya Nadi = "madhya"
	NadiAntya  Nadi = "antya"
)

var AllNadis = []Nadi{NadiAdi, NadiMadhya, NadiAntya}

var NakshatraNadi = [27]Nadi{
	NadiAdi,    // 0  Ashwini
	NadiMadhya, // 1  Bharani
	NadiAntya,  // 2  Krittika
	NadiAntya,  // 3  Rohini
	NadiMadhya, // 4  Mrigashira
	NadiAdi,    // 5  Ardra
	NadiAdi,    // 6  Punarvasu
	NadiMadhya, // 7  Pushya
	NadiAntya,  // 8  Ashlesha
	NadiAntya,  // 9  Magha
	NadiMadhya, // 10 P. Phalguni
	NadiAdi,    // 11 U. Phalguni
	NadiAdi,    // 12 Hasta
	NadiMadhya, // 13 Chitra
	NadiAntya,  // 14 Swati
	NadiAntya,  // 15 Vishakha
	NadiMadhya, // 16 Anuradha
	NadiAdi,    // 17 Jyeshtha
	NadiAdi,    // 18 Mula
	NadiMadhya, // 19 P. Ashadha
	NadiAntya,  // 20 U. Ashadha
	NadiAntya,  // 21 Shravana
	NadiMadhya, // 22 Dhanishtha
	NadiAdi,    // 23 Shatabhisha
	NadiAdi,    // 24 P. Bhadrapada
	NadiMadhya, // 25 U. Bhadrapada
	NadiAntya,  // 26 Revati
}

var InauspiciousTaraRemainders = [3]int{3, 5, 7}

var BhakootDoshicDistances = [6][2]int{
	{2, 12}, {12, 2},
	{5, 9}, {9, 5},
	{6, 8}, {8, 6},
}
