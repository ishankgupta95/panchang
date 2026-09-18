package core

import (
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

func TestReferencePoints(t *testing.T) {
	if u := TraditionalReference(); u.Latitude != 23.1765 || u.Longitude != 75.7885 {
		t.Errorf("TraditionalReference() = %+v, want {23.1765 75.7885 0}", u)
	}
	s := ModernReference()
	if s.Latitude != 23.1833 || s.Longitude != 82.5 {
		t.Errorf("ModernReference() = %+v, want {23.1833 82.5 0}", s)
	}
	if got := s.Longitude * 4; got != ISTOffsetMinutes {
		t.Errorf("central station longitude*4 = %v, want %d", got, ISTOffsetMinutes)
	}
	if got := TraditionalReference().Longitude * 4; got >= ISTOffsetMinutes {
		t.Errorf("Ujjain LMT = %v, expected it west of IST's %d", got, ISTOffsetMinutes)
	}
}

func TestReferencePointsAreCopiedNotShared(t *testing.T) {
	u := TraditionalReference()
	u.Latitude = 0
	if TraditionalReference().Latitude != 23.1765 {
		t.Error("mutating a returned point changed the next caller's copy")
	}
}

func TestReferenceLocation(t *testing.T) {
	got, err := ReferenceLocation(ReferenceTraditional)
	if err != nil || got != TraditionalReference() {
		t.Errorf("traditional = %+v, %v; want the traditional point", got, err)
	}
	got, err = ReferenceLocation(ReferenceModern)
	if err != nil || got != ModernReference() {
		t.Errorf("modern = %+v, %v; want the Central Station", got, err)
	}
	if _, err := ReferenceLocation(ReferencePractical); err == nil {
		t.Error("ReferenceLocation(practical) must error; it is a reported frame, not a selectable one")
	}
	if _, err := ReferenceLocation(Reference("nonsense")); err == nil {
		t.Error("an unknown mode must error")
	}
}

func TestResolveLocation(t *testing.T) {
	got, ref, err := ResolveLocation(nil, ReferenceTraditional)
	if err != nil || ref != ReferenceTraditional || got != TraditionalReference() {
		t.Errorf("nil traditional: %+v %q %v; want the traditional point", got, ref, err)
	}

	got, ref, err = ResolveLocation(nil, ReferenceModern)
	if err != nil || ref != ReferenceModern || got != ModernReference() {
		t.Errorf("nil modern: %+v %q %v; want the station and modern", got, ref, err)
	}

	pune := types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
	got, ref, err = ResolveLocation(&pune, ReferenceTraditional)
	if err != nil || ref != ReferencePractical || got != pune {
		t.Errorf("supplied: %+v %q %v; want Pune and practical", got, ref, err)
	}

	zero := types.GeoLocation{}
	got, ref, err = ResolveLocation(&zero, ReferenceTraditional)
	if err != nil || ref != ReferencePractical || got != zero {
		t.Errorf("zero value: %+v %q %v; want Null Island and practical", got, ref, err)
	}

	bad := types.GeoLocation{Latitude: 91}
	if _, _, err := ResolveLocation(&bad, ReferenceTraditional); err == nil {
		t.Error("an out-of-range latitude must error rather than fall back to a reference point")
	}
}
