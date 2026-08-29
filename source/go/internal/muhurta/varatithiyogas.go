package muhurta

import (
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

// Tables from Ernst Wilhelm's *Muhurta Yogas*; they contradict in six cells, so every match is reported.

type VaraTithiYogaType string

const (
	YogaSiddha     VaraTithiYogaType = "siddha"
	YogaAmrita     VaraTithiYogaType = "amrita"
	YogaDagdha     VaraTithiYogaType = "dagdha"
	YogaVisha      VaraTithiYogaType = "visha"
	YogaHutasana   VaraTithiYogaType = "hutasana"
	YogaKrakacha   VaraTithiYogaType = "krakacha"
	YogaSamvartaka VaraTithiYogaType = "samvartaka"
)

var AllVaraTithiYogaTypes = []VaraTithiYogaType{
	YogaSiddha, YogaAmrita,
	YogaDagdha, YogaVisha, YogaHutasana, YogaKrakacha, YogaSamvartaka,
}

type YogaPolarity string

const (
	PolarityAuspicious   YogaPolarity = "auspicious"
	PolarityInauspicious YogaPolarity = "inauspicious"
)

type VaraTithiYoga struct {
	Type     VaraTithiYogaType `json:"type"`
	Polarity YogaPolarity      `json:"polarity"`
}

type varaTable [7][]int

// A slice, not a map: entry order is observable in the emitted factors.
type varaTithiRow struct {
	yoga  VaraTithiYogaType
	table varaTable
}

var auspiciousTables = []varaTithiRow{
	{YogaSiddha, varaTable{{}, {}, {3, 8, 13}, {2, 7, 12}, {5, 10, 15}, {1, 6, 11}, {4, 9, 14}}},
	{YogaAmrita, varaTable{{1, 6, 11}, {2, 7, 12}, {1, 6, 11}, {3, 8, 13}, {4, 9, 14}, {2, 7, 12}, {5, 10, 15}}},
}

var inauspiciousTables = []varaTithiRow{
	// Mercury's Dagdha cell is given as "the 2nd or 3rd"; both are carried.
	{YogaDagdha, varaTable{{12}, {11}, {5}, {2, 3}, {6}, {8}, {9}}},
	{YogaVisha, varaTable{{4}, {6}, {7}, {2}, {8}, {9}, {7}}},
	{YogaHutasana, varaTable{{12}, {6}, {7}, {8}, {9}, {10}, {11}}},
	{YogaKrakacha, varaTable{{12}, {11}, {10}, {9}, {8}, {7}, {6}}},
	{YogaSamvartaka, varaTable{{7}, {}, {}, {1}, {}, {}, {}}},
}

func ComputeVaraTithiYogas(varaIndex, tithiIndex int) ([]VaraTithiYoga, error) {
	if err := utils.AssertVaraIndex(varaIndex, ""); err != nil {
		return nil, err
	}
	if err := utils.AssertTithiIndex(tithiIndex, ""); err != nil {
		return nil, err
	}

	tithiNumber := tithiIndex%15 + 1
	// Non-nil: `[]` on the wire, never `null`.
	out := []VaraTithiYoga{}

	for _, row := range auspiciousTables {
		if containsInt(row.table[varaIndex], tithiNumber) {
			out = append(out, VaraTithiYoga{Type: row.yoga, Polarity: PolarityAuspicious})
		}
	}
	for _, row := range inauspiciousTables {
		if containsInt(row.table[varaIndex], tithiNumber) {
			out = append(out, VaraTithiYoga{Type: row.yoga, Polarity: PolarityInauspicious})
		}
	}
	return out, nil
}

func containsInt(haystack []int, needle int) bool {
	for _, v := range haystack {
		if v == needle {
			return true
		}
	}
	return false
}
