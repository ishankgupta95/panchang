package types

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"
)

type JSDate int64

func (d JSDate) Ms() int64 { return int64(d) }

func Date(ms int64) JSDate { return JSDate(ms) }

func NullableDate(ms *int64) *JSDate {
	if ms == nil {
		return nil
	}
	d := JSDate(*ms)
	return &d
}

func DateUTC(year, month, day int) JSDate {
	if year >= 0 && year <= 99 {
		year += 1900
	}
	t := time.Date(year, time.Month(month+1), day, 0, 0, 0, 0, time.UTC)
	return JSDate(t.UnixMilli())
}

func (d JSDate) UTCFullYear() int { return d.utc().Year() }

func (d JSDate) UTCMonth() int { return int(d.utc().Month()) - 1 }

func (d JSDate) UTCDate() int { return d.utc().Day() }

func (d JSDate) UTCHours() int { return d.utc().Hour() }

func (d JSDate) UTCMinutes() int { return d.utc().Minute() }

func (d JSDate) UTCDay() int { return int(d.utc().Weekday()) }

func (d JSDate) utc() time.Time { return time.UnixMilli(int64(d)).UTC() }

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

func (d JSDate) MarshalJSON() ([]byte, error) {
	b := make([]byte, 0, 29)
	b = append(b, '"')
	b = append(b, d.ISOString()...)
	b = append(b, '"')
	return b, nil
}

var errJSDateShape = errors.New("types: JSDate must be an ISO 8601 string or null")

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
