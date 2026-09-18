package types

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"
)

// JSDate is an instant as milliseconds since the Unix epoch in UTC, the
// value JavaScript's Date.getTime returns; an int64 rather than a time.Time
// keeps the port bit-identical. A result field typed JSDate is always a UTC
// instant. Where a same-named *Local string sits beside it, that string is
// the same instant rendered in the result's timezone; many JSDate fields (an
// echoed-back input, a Dasha boundary, an EclipseInfo contact, every field
// of InstantPanchangResult) have no Local companion. A nil *JSDate is
// TypeScript's null and marshals as JSON null. The methods mirror the Date
// UTC accessors, index bases included, and JSON is the ISO 8601 string
// JSON.stringify gives a Date; all of it is checked against a golden
// generated from those built-ins.
type JSDate int64

// Ms returns the instant as epoch milliseconds.
func (d JSDate) Ms() int64 { return int64(d) }

// Date wraps epoch milliseconds as a [JSDate].
func Date(ms int64) JSDate { return JSDate(ms) }

// NullableDate wraps an optional epoch-millisecond value: nil in, nil out.
// The result does not alias ms.
func NullableDate(ms *int64) *JSDate {
	if ms == nil {
		return nil
	}
	d := JSDate(*ms)
	return &d
}

// DateUTC is JavaScript's Date.UTC(year, month, day) at 00:00:00.000 UTC:
// month is 0-based (0 = January), a year from 0 to 99 means 1900 to 1999,
// and an out-of-range month or day rolls over into the neighbouring month or
// year.
func DateUTC(year, month, day int) JSDate {
	if year >= 0 && year <= 99 {
		year += 1900
	}
	t := time.Date(year, time.Month(month+1), day, 0, 0, 0, 0, time.UTC)
	return JSDate(t.UnixMilli())
}

// UTCFullYear returns the year in UTC, as getUTCFullYear does.
func (d JSDate) UTCFullYear() int { return d.utc().Year() }

// UTCMonth returns the month in UTC, 0-based: 0 = January, 11 = December.
func (d JSDate) UTCMonth() int { return int(d.utc().Month()) - 1 }

// UTCDate returns the day of the month in UTC, 1 to 31.
func (d JSDate) UTCDate() int { return d.utc().Day() }

// UTCHours returns the hour in UTC, 0 to 23.
func (d JSDate) UTCHours() int { return d.utc().Hour() }

// UTCMinutes returns the minute in UTC, 0 to 59.
func (d JSDate) UTCMinutes() int { return d.utc().Minute() }

// UTCDay returns the weekday in UTC, 0 = Sunday to 6 = Saturday, as
// getUTCDay does.
func (d JSDate) UTCDay() int { return int(d.utc().Weekday()) }

func (d JSDate) utc() time.Time { return time.UnixMilli(int64(d)).UTC() }

// ISOString renders the instant as Date.prototype.toISOString does:
// "YYYY-MM-DDTHH:mm:ss.sssZ", always UTC with millisecond precision, and a
// signed six-digit year ("+275760-09-13T...", "-271821-04-20T...") when the
// year is outside 0 to 9999.
func (d JSDate) ISOString() string {
	t := d.utc()
	b := make([]byte, 0, 27)
	b = appendISOYear(b, t.Year())
	b = append(b, '-')
	b = appendPad(b, int(t.Month()), 2)
	b = append(b, '-')
	b = appendPad(b, t.Day(), 2)
	b = append(b, 'T')
	b = appendPad(b, t.Hour(), 2)
	b = append(b, ':')
	b = appendPad(b, t.Minute(), 2)
	b = append(b, ':')
	b = appendPad(b, t.Second(), 2)
	b = append(b, '.')
	b = appendPad(b, t.Nanosecond()/1_000_000, 3)
	b = append(b, 'Z')
	return string(b)
}

func appendISOYear(b []byte, year int) []byte {
	if year >= 0 && year <= 9999 {
		return appendPad(b, year, 4)
	}
	if year < 0 {
		b = append(b, '-')
		year = -year
	} else {
		b = append(b, '+')
	}
	return appendPad(b, year, 6)
}

func appendPad(b []byte, v, width int) []byte {
	s := strconv.Itoa(v)
	for i := len(s); i < width; i++ {
		b = append(b, '0')
	}
	return append(b, s...)
}

// MarshalJSON emits the [JSDate.ISOString] text as a JSON string, which is
// what JSON.stringify does with a Date. A nil *JSDate marshals as null.
func (d JSDate) MarshalJSON() ([]byte, error) {
	b := make([]byte, 0, 29)
	b = append(b, '"')
	b = append(b, d.ISOString()...)
	b = append(b, '"')
	return b, nil
}

var errJSDateShape = errors.New("types: JSDate must be an ISO 8601 string or null")

// UnmarshalJSON accepts exactly the string shape [JSDate.ISOString]
// produces, the signed six-digit year included, and rejects anything else: a
// bare number, an offset other than Z, or missing milliseconds. JSON null
// leaves the value unchanged, so a *JSDate field stays nil.
func (d *JSDate) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		return nil
	}
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return errJSDateShape
	}
	ms, err := parseISOString(s)
	if err != nil {
		return err
	}
	*d = JSDate(ms)
	return nil
}

func parseISOString(s string) (int64, error) {
	year, rest := 0, ""
	switch {
	case len(s) >= 7 && (s[0] == '+' || s[0] == '-'):
		y, err := strconv.Atoi(s[1:7])
		if err != nil {
			return 0, errISOShape(s)
		}
		if s[0] == '-' {
			y = -y
		}
		year, rest = y, s[7:]
	case len(s) >= 4:
		y, err := strconv.Atoi(s[0:4])
		if err != nil {
			return 0, errISOShape(s)
		}
		year, rest = y, s[4:]
	default:
		return 0, errISOShape(s)
	}

	if len(rest) != 20 || rest[0] != '-' || rest[3] != '-' || rest[6] != 'T' ||
		rest[9] != ':' || rest[12] != ':' || rest[15] != '.' || rest[19] != 'Z' {
		return 0, errISOShape(s)
	}
	nums := [6]int{}
	for i, span := range [6][2]int{{1, 3}, {4, 6}, {7, 9}, {10, 12}, {13, 15}, {16, 19}} {
		v, err := strconv.Atoi(rest[span[0]:span[1]])
		if err != nil {
			return 0, errISOShape(s)
		}
		nums[i] = v
	}
	t := time.Date(year, time.Month(nums[0]), nums[1], nums[2], nums[3], nums[4],
		nums[5]*1_000_000, time.UTC)
	return t.UnixMilli(), nil
}

func errISOShape(s string) error {
	return fmt.Errorf("types: %q is not an ISO 8601 instant of the form "+
		"YYYY-MM-DDTHH:mm:ss.sssZ (or ±YYYYYY-…)", s)
}

// ParseISODay parses a "YYYY-MM-DD" calendar day and returns 00:00:00.000
// UTC on that day as epoch milliseconds. Any other shape is an error.
func ParseISODay(s string) (int64, error) {
	if len(s) != 10 || s[4] != '-' || s[7] != '-' {
		return 0, errISOShape(s)
	}
	y, err := strconv.Atoi(s[0:4])
	if err != nil {
		return 0, errISOShape(s)
	}
	m, err := strconv.Atoi(s[5:7])
	if err != nil {
		return 0, errISOShape(s)
	}
	d, err := strconv.Atoi(s[8:10])
	if err != nil {
		return 0, errISOShape(s)
	}
	return time.Date(y, time.Month(m), d, 0, 0, 0, 0, time.UTC).UnixMilli(), nil
}
