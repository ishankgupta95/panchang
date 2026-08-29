package jyotish

import "github.com/ishankgupta95/panchang-ts/source/go/v5/internal/core"

// Breaks the core/jyotish import cycle; never hand-build one, a half-filled set compiles.
func CoreNatalResolvers() core.NatalResolvers {
	return core.NatalResolvers{
		ChandraBalam: ComputeChandraBalam,
		Tarabala:     ComputeTarabala,
	}
}
