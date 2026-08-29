package jyotish

import (
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

func TestSevenKarakaVariantAcceptsAChartWithoutRahu(t *testing.T) {
	chart := &types.BirthChart{}
	for i := 0; i < 7; i++ {
		chart.Planets = append(chart.Planets, types.PlanetPlacement{
			Planet: types.Graha(i), DegreeInRashi: float64(i * 3),
		})
	}
	if _, err := ComputeJaiminiKarakas(chart); err != nil {
		t.Errorf("7-variant rejected a 7-planet chart: %v", err)
	}
	if _, err := ComputeJaimini8Karakas(chart); err == nil {
		t.Error("8-variant accepted a chart with no Rahu; it must not")
	}
}
