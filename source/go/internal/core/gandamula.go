package core

import (
	"github.com/ishankgupta95/panchang/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

var gandaMulaSeverity = func() [utils.TotalNakshatras]types.GandaMulaSeverity {
	var t [utils.TotalNakshatras]types.GandaMulaSeverity
	t[0] = types.GandaMulaMild    // Ashwini
	t[8] = types.GandaMulaMild    // Ashlesha
	t[9] = types.GandaMulaMild    // Magha
	t[17] = types.GandaMulaSevere // Jyeshtha
	t[18] = types.GandaMulaSevere // Mula
	t[26] = types.GandaMulaMild   // Revati
	return t
}()

func ComputeGandaMula(currentNakshatraIndex int, lang types.Language) (types.GandaMulaInfo, error) {
	if err := utils.AssertNakshatraIndex(currentNakshatraIndex, "currentNakshatraIndex"); err != nil {
		return types.GandaMulaInfo{}, err
	}

	severity := gandaMulaSeverity[currentNakshatraIndex]
	if severity == "" {
		return types.GandaMulaInfo{Active: false}, nil
	}

	return types.GandaMulaInfo{
		Active:        true,
		NakshatraName: i18n.ResolveNakshatraName(currentNakshatraIndex, lang),
		Severity:      severity,
	}, nil
}
