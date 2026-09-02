package core

import "github.com/ishankgupta95/panchang/source/go/v5/internal/utils"

var amritSiddhiTable = [7]int{
	12,
	4,
	0,
	16,
	7,
	26,
	3,
}

var sarvarthaSiddhiTable = nakshatraSets([7][]int{
	0: {0, 7, 11, 12, 18, 20, 25},
	1: {3, 4, 7, 16, 21},
	2: {0, 2, 8, 25},
	3: {2, 3, 4, 12, 16},
	4: {0, 6, 7, 16, 26},
	5: {0, 6, 16, 21, 26},
	6: {3, 14, 21},
})

var pushkarBhadraTithis = indexSet(16, 2, 7, 12)

var pushkarVaras = indexSet(7, 0, 2, 6)

var dwipushkarNakshatras = indexSet(27, 4, 13, 22)

var tripushkarNakshatras = indexSet(27, 2, 6, 11, 15, 20, 24)

var jwalamukhiTable = nakshatraSetsByTithi(map[int][]int{
	1:  {18},
	5:  {1},
	8:  {2},
	9:  {3},
	10: {8},
})

var (
	aadalDistances  = indexSet(29, 2, 7, 9, 14, 16, 21, 23, 28)
	vidaalDistances = indexSet(29, 3, 6, 10, 13, 17, 20, 24, 27)
	raviDistances   = indexSet(29, 4, 6, 9, 10, 13, 20)
)

func to28(nak27 int) int {
	if nak27 < 21 {
		return nak27 + 1
	}
	return nak27 + 2
}

func indexSet(n int, members ...int) []bool {
	s := make([]bool, n)
	for _, m := range members {
		s[m] = true
	}
	return s
}

func nakshatraSets(rows [7][]int) [7][]bool {
	var out [7][]bool
	for i, row := range rows {
		out[i] = indexSet(utils.TotalNakshatras, row...)
	}
	return out
}

func nakshatraSetsByTithi(rows map[int][]int) [16][]bool {
	var out [16][]bool
	for tithi, row := range rows {
		out[tithi] = indexSet(utils.TotalNakshatras, row...)
	}
	return out
}
