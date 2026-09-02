package utils

import (
	"strconv"
	"strings"
	"time"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

func ResolveUtcOffset(timezone types.Timezone, referenceMs int64) (int, error) {
	if !timezone.IsSet() {
		return 0, types.NewPanchangError(
			"A timezone is required: pass a UTC offset in minutes or an IANA zone name",
			types.ErrInvalidTimezone)
	}
	if !timezone.IsNamed() {
		if err := validateOffset(timezone); err != nil {
			return 0, err
		}
		return timezone.OffsetMinutes(), nil
	}

	loc, err := time.LoadLocation(timezone.Name())
	if err != nil {
		return 0, types.Codef(types.ErrTimezoneResolutionFailed,
			"Cannot resolve timezone %q. On React Native (Hermes), pass a numeric "+
				"UTC offset in minutes instead (e.g. 330 for IST +05:30, -300 for EST -05:00).",
			timezone.Name())
	}
	_, offsetSeconds := time.UnixMilli(referenceMs).In(loc).Zone()
	return offsetSeconds / 60, nil
}

func GetLocalMidnightUtc(ms int64, offsetMinutes int) int64 {
	localDisplay := time.UnixMilli(ms + int64(offsetMinutes)*60_000).UTC()
	year := localDisplay.Year()
	if year >= 0 && year <= 99 {
		year += 1900
	}
	midnightUtc := time.Date(year, localDisplay.Month(), localDisplay.Day(),
		0, 0, 0, 0, time.UTC).UnixMilli()
	return midnightUtc - int64(offsetMinutes)*60_000
}

func UtcToLocalDisplay(ms int64, offsetMinutes int) int64 {
	return ms + int64(offsetMinutes)*60_000
}

func FormatInZone(ms int64, offsetMinutes int) string {
	shifted := time.UnixMilli(ms + int64(offsetMinutes)*60_000).UTC()
	abs := offsetMinutes
	if abs < 0 {
		abs = -abs
	}
	year := shifted.Year()

	var b strings.Builder
	b.Grow(29)
	if year < 1000 {
		s := strconv.Itoa(year)
		for i := len(s); i < 4; i++ {
			b.WriteByte('0')
		}
		b.WriteString(s)
	} else {
		b.WriteString(strconv.Itoa(year))
	}
	b.WriteByte('-')
	b.WriteString(twoDigits[int(shifted.Month())])
	b.WriteByte('-')
	b.WriteString(twoDigits[shifted.Day()])
	b.WriteByte('T')
	b.WriteString(twoDigits[shifted.Hour()])
	b.WriteByte(':')
	b.WriteString(twoDigits[shifted.Minute()])
	b.WriteByte(':')
	b.WriteString(twoDigits[shifted.Second()])
	b.WriteByte('.')
	b.WriteString(threeDigits[shifted.Nanosecond()/1_000_000])
	if offsetMinutes < 0 {
		b.WriteByte('-')
	} else {
		b.WriteByte('+')
	}
	b.WriteString(twoDigits[abs/60])
	b.WriteByte(':')
	b.WriteString(twoDigits[abs%60])
	return b.String()
}

var twoDigits, threeDigits = func() ([61]string, [1000]string) {
	var two [61]string
	var three [1000]string
	for i := 0; i < 1000; i++ {
		if i < 61 {
			if i < 10 {
				two[i] = "0" + strconv.Itoa(i)
			} else {
				two[i] = strconv.Itoa(i)
			}
		}
		switch {
		case i < 10:
			three[i] = "00" + strconv.Itoa(i)
		case i < 100:
			three[i] = "0" + strconv.Itoa(i)
		default:
			three[i] = strconv.Itoa(i)
		}
	}
	return two, three
}()

func validateOffset(tz types.Timezone) error {
	offset := tz.OffsetMinutes()
	if spelled := tz.FractionalSpelling(); spelled != "" {
		return types.Codef(types.ErrInvalidTimezone,
			"UTC offset must be an integer between -720 and 840, got %s", spelled)
	}
	if offset < -720 || offset > 840 {
		return types.Codef(types.ErrInvalidTimezone,
			"UTC offset must be an integer between -720 and 840, got %d", offset)
	}
	return nil
}
