package core

import "github.com/ishankgupta95/panchang/source/go/v5/types"

// These types are declared in the shared types package so that a caller can
// import them and their fields and methods render in the documentation. The
// aliases here keep this package's own references spelled unqualified.

type (
	LongitudeAt            = types.LongitudeAt
	NatalResolvers         = types.NatalResolvers
	Reference              = types.Reference
	InstantPanchangOptions = types.InstantPanchangOptions
	PanchangSection        = types.PanchangSection
	SectionSet             = types.SectionSet
	PanchangOptions        = types.PanchangOptions
	RegionAliasWarner      = types.RegionAliasWarner
)

const (
	ReferenceTraditional = types.ReferenceTraditional
	ReferenceModern      = types.ReferenceModern
	ReferencePractical   = types.ReferencePractical
	// The two IST constants mirror IST_TIMEZONE and IST_OFFSET_MINUTES in
	// src/core/defaultLocation.ts, which the symbol gate expects this package
	// to declare.
	ISTTimezone         = types.ISTTimezone
	ISTOffsetMinutes    = types.ISTOffsetMinutes
	SectionFestivals    = types.SectionFestivals
	SectionEclipse      = types.SectionEclipse
	SectionMoonTimes    = types.SectionMoonTimes
	SectionLunarWindows = types.SectionLunarWindows
)
