package types

import (
	"bytes"
	"encoding/json"
	"strconv"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
)

type Timezone struct {
	offsetMinutes int
	name          string
	named         bool
	set           bool
	fractional    string
}

func TimezoneOffset(minutes int) Timezone {
	return Timezone{offsetMinutes: minutes, set: true}
}

func TimezoneName(name string) Timezone {
	return Timezone{name: name, named: true, set: true}
}

func (t Timezone) IsSet() bool { return t.set }

func (t Timezone) IsNamed() bool { return t.named }

func (t Timezone) Name() string { return t.name }

func (t Timezone) OffsetMinutes() int { return t.offsetMinutes }

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

func (t Timezone) MarshalJSON() ([]byte, error) {
	if !t.set {
		return []byte("null"), nil
	}
	if t.named {
		return json.Marshal(t.name)
	}
	return json.Marshal(t.offsetMinutes)
}

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
	// A non-integer offset is rejected later, by ResolveUtcOffset.
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

func (t Timezone) FractionalSpelling() string { return t.fractional }
