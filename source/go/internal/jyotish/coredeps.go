package jyotish

import "github.com/ishankgupta95/panchang/source/go/v5/internal/core"

func CoreNatalResolvers() core.NatalResolvers {
	return core.NatalResolvers{
		ChandraBalam: ComputeChandraBalam,
		Tarabala:     ComputeTarabala,
	}
}
