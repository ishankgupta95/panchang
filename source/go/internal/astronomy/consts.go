package astronomy

import "github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"

const dayMS = 86_400_000

// jsnum.PI, not math.Pi.
const (
	degToRad = jsnum.PI / 180
	radToDeg = 180 / jsnum.PI
)

const ArcsecToRad = jsnum.PI / 648000

// Typed so quotients do not constant-fold.
const SynodicMonthDays float64 = 29.530588853
