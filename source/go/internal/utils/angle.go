package utils

import "github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"

// Both guards earn their place: -1e-15 gives r + 360 == 360, an out-of-range nakshatra 27, and -360 % 360 is -0.
func Normalize360(degrees float64) float64 {
	r := jsnum.Mod(degrees, 360)
	if r < 0 {
		r += 360
	}
	if r >= 360 {
		r -= 360
	}
	if r == 0 {
		return 0
	}
	return r
}

func DegToRad(degrees float64) float64 { return degrees * (jsnum.PI / 180) }

func RadToDeg(radians float64) float64 { return radians * (180 / jsnum.PI) }
