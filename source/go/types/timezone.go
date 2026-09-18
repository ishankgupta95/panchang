package types

import (
	"bytes"
	"encoding/json"
	"strconv"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
)

// Timezone is the timezone an option struct carries: either a fixed UTC
// offset in minutes from [TimezoneOffset] or an IANA zone name from
// [TimezoneName], mirroring TypeScript's number | string. The zero value is
// unset, and an operation that needs a timezone reports [ErrInvalidTimezone]
// for it. An offset is checked when used, not when built: it must be an
// integer from -720 to 840. A name is resolved against the host's zone
// database at the instant it applies, so it follows DST, and one the
// database cannot load reports [ErrTimezoneResolutionFailed]. JSON is a
// string for a name, a number for an offset and null when unset; see
// [Timezone.MarshalJSON].
type Timezone struct {
	offsetMinutes int
	name          string
	named         bool
	set           bool
	fractional    string
}

// TimezoneOffset returns a Timezone fixed at minutes east of UTC, 330 for
// IST. The range is checked when the timezone is used, not here.
func TimezoneOffset(minutes int) Timezone {
	return Timezone{offsetMinutes: minutes, set: true}
}

// TimezoneName returns a Timezone identified by an IANA zone name such as
// "Asia/Kolkata". The name is resolved when the timezone is used, not here.
func TimezoneName(name string) Timezone {
	return Timezone{name: name, named: true, set: true}
}

// IsSet reports whether the value came from a constructor or from non-null
// JSON; the zero value is unset.
func (t Timezone) IsSet() bool { return t.set }

// IsNamed reports whether the timezone is an IANA name rather than a fixed
// offset.
func (t Timezone) IsNamed() bool { return t.named }

// Name returns the IANA zone name, or "" for an offset or unset timezone.
func (t Timezone) Name() string { return t.name }

// OffsetMinutes returns the fixed offset in minutes east of UTC, or 0 for a
// named or unset timezone.
func (t Timezone) OffsetMinutes() int { return t.offsetMinutes }

// String returns the zone name, the offset in minutes as decimal text, the
// original spelling of a non-integral offset parsed from JSON, or "<unset>".
func (t Timezone) String() string {
	if !t.set {
		return "<unset>"
	}
	if t.named {
		return t.name
	}
	if t.fractional != "" {
		return t.fractional
	}
	return strconv.Itoa(t.offsetMinutes)
}

// MarshalJSON emits the zone name as a JSON string, the offset as a JSON
// number, or null when unset: the shape of the TypeScript timezone option. A
// non-integral offset parsed from JSON marshals as its truncated integer.
func (t Timezone) MarshalJSON() ([]byte, error) {
	if !t.set {
		return []byte("null"), nil
	}
	if t.named {
		return json.Marshal(t.name)
	}
	return json.Marshal(t.offsetMinutes)
}

// UnmarshalJSON accepts a JSON string (a zone name), a JSON number (an
// offset in minutes) or null (unset). A non-integral number is truncated
// toward zero and its JavaScript spelling recorded, so the later check
// rejects it with [ErrInvalidTimezone] naming the value as written.
func (t *Timezone) UnmarshalJSON(b []byte) error {
	b = bytes.TrimSpace(b)
	if string(b) == "null" {
		*t = Timezone{}
		return nil
	}
	if len(b) > 0 && b[0] == '"' {
		var s string
		if err := json.Unmarshal(b, &s); err != nil {
			return err
		}
		*t = TimezoneName(s)
		return nil
	}
	var f float64
	if err := json.Unmarshal(b, &f); err != nil {
		return err
	}
	*t = Timezone{offsetMinutes: int(f), set: true}
	if float64(int(f)) != f {
		t.fractional = jsnum.FormatFloat(f)
	}
	return nil
}

// FractionalSpelling returns the JavaScript spelling of a non-integral
// offset parsed from JSON, or "" for every other Timezone, the
// constructor-built ones included.
func (t Timezone) FractionalSpelling() string { return t.fractional }
