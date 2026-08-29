package astronomy

import (
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

// The seed lands within 0.96 d of the true new moon over 1900-2100.
const seedHalfWindowDays = 2.5

type NewMoonBounds struct {
	PrevMs int64
	NextMs int64
}

// Actual instants, not mean motion: mean motion flickers Adhika Jyeshtha / Ashadha near aphelion.
func BoundingNewMoons(ctx *EphemerisCtx, refMs int64) (NewMoonBounds, error) {
	elapsedFraction := MoonSunElongation(ctx, refMs) / 360
	seedMs := float64(refMs) - float64(elapsedFraction*SynodicMonthDays*dayMS)

	foundMs, foundOK := newMoonNear(ctx, seedMs)
	// `found` can land 1-2 ms after `ref` when `ref` is itself a rounded new-moon instant.
	prevMs, prevOK := foundMs, foundOK
	if foundOK && foundMs > refMs && foundMs-refMs <= PhaseAgreementMS {
		prevMs = refMs
	}
	if prevOK && prevMs <= refMs {
		nextMs, nextOK := newMoonNear(ctx, float64(prevMs)+SynodicMonthDays*dayMS)
		if nextOK && nextMs > refMs {
			return NewMoonBounds{PrevMs: prevMs, NextMs: nextMs}, nil
		}
	}

	return boundingNewMoonsByScan(ctx, refMs)
}

func newMoonNear(ctx *EphemerisCtx, estimateMs float64) (int64, bool) {
	return SearchMoonPhase(ctx, 0, int64(estimateMs-seedHalfWindowDays*dayMS), seedHalfWindowDays*2)
}

func boundingNewMoonsByScan(ctx *EphemerisCtx, refMs int64) (NewMoonBounds, error) {
	first, ok := SearchMoonPhase(ctx, 0, refMs-40*dayMS, 45)
	if !ok {
		return NewMoonBounds{}, types.NewPanchangError(
			"boundingNewMoons: no new moon found preceding reference instant",
			types.ErrSearchDiverged)
	}
	prev := first
	next, err := advanceToNextNewMoon(ctx, prev)
	if err != nil {
		return NewMoonBounds{}, err
	}

	for next <= refMs {
		prev = next
		next, err = advanceToNextNewMoon(ctx, prev)
		if err != nil {
			return NewMoonBounds{}, err
		}
	}
	return NewMoonBounds{PrevMs: prev, NextMs: next}, nil
}

func advanceToNextNewMoon(ctx *EphemerisCtx, afterMs int64) (int64, error) {
	event, ok := SearchMoonPhase(ctx, 0, afterMs+dayMS, 45)
	if !ok {
		return 0, types.NewPanchangError(
			"boundingNewMoons: no subsequent new moon found", types.ErrSearchDiverged)
	}
	return event, nil
}

// Abstains within PhaseAgreementMS of an endpoint, where ±1 ms would decide a whole month.
type NewMoonCache struct {
	entries []NewMoonBounds

	Hits   int
	Misses int
}

const newMoonCacheMaxEntries = 4

func (c *NewMoonCache) Bounding(ctx *EphemerisCtx, refMs int64) (NewMoonBounds, error) {
	for _, e := range c.entries {
		if e.PrevMs > refMs || refMs >= e.NextMs {
			continue
		}
		if refMs-e.PrevMs <= PhaseAgreementMS || e.NextMs-refMs <= PhaseAgreementMS {
			break
		}
		c.Hits++
		return e, nil
	}
	c.Misses++
	bounds, err := BoundingNewMoons(ctx, refMs)
	if err != nil {
		return NewMoonBounds{}, err
	}
	c.entries = append(c.entries, bounds)
	if len(c.entries) > newMoonCacheMaxEntries {
		c.entries = c.entries[1:]
	}
	return bounds, nil
}
