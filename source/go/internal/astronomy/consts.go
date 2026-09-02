package astronomy

import "github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"

const dayMS = 86_400_000

const (
	degToRad = jsnum.PI / 180
	radToDeg = 180 / jsnum.PI
)

const ArcsecToRad = jsnum.PI / 648000

const SynodicMonthDays float64 = 29.530588853
