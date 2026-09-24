package utils

import (
	"strconv"
	"time"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/store"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

// zoneStore keeps the zones time.LoadLocation has resolved: LoadLocation
// opens and parses the zoneinfo data on every call, and a *time.Location is
// immutable and safe to share, so a kept one answers exactly as a new load
// would. Failures are never kept, nor is "Local", which follows time.Local.
// LoadLocation accepts endless spellings of one zone ("Asia//Kolkata"), so
// the store's capacity is what bounds it.
var zoneStore = store.New[string, *time.Location](1024, store.DefaultStripes, store.HashString)

func loadZone(name string) (*time.Location, error) {
	if name == "Local" {
		return time.LoadLocation(name)
	}
	if loc, ok := zoneStore.Get(name); ok {
		return loc, nil
	}
	loc, err := time.LoadLocation(name)
	if err != nil {
		return nil, err
	}
	zoneStore.Put(name, loc)
	return loc, nil
}

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

	loc, err := loadZone(timezone.Name())
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

const civilDayMs int64 = 86_400_000

// SupportedStartMs and SupportedEndMs are the first and last instants
// ValidateDate accepts: 1900-01-01T00:00:00.000Z and 2100-12-31T23:59:59.999Z.
const (
	SupportedStartMs int64 = -2208988800000
	SupportedEndMs   int64 = 4133980799999
)

func ClampToSupported(ms int64) int64 {
	return min(max(ms, SupportedStartMs), SupportedEndMs)
}

// UtcDateMs is Date.UTC(year, month, day) without its reading of years 0 to
// 99 as 1900 to 1999: month is 0-based and out-of-range values roll over.
func UtcDateMs(year, month, day int) int64 {
	return time.Date(year, time.Month(month+1), day, 0, 0, 0, 0, time.UTC).UnixMilli()
}

func floorDivMs(a, b int64) int64 {
	q := a / b
	if a%b != 0 && (a < 0) != (b < 0) {
		q--
	}
	return q
}

// WallClockToUtc returns the instant timezone shows wall-clock time wallMs
// (local time written as epoch ms) and the offset in force then. A time a DST
// change skips moves forward across the gap; a repeated one takes its first
// occurrence. A non-nil hint is an offset likely in force, tried first.
func WallClockToUtc(wallMs int64, timezone types.Timezone, hint *int) (int64, int, error) {
	if !timezone.IsNamed() {
		offset, err := ResolveUtcOffset(timezone, wallMs)
		if err != nil {
			return 0, 0, err
		}
		return wallMs - int64(offset)*60_000, offset, nil
	}
	if hint != nil {
		o, err := ResolveUtcOffset(timezone, wallMs-int64(*hint)*60_000)
		if err != nil {
			return 0, 0, err
		}
		if o == *hint {
			return wallMs - int64(o)*60_000, o, nil
		}
	}
	before, err := ResolveUtcOffset(timezone, wallMs-civilDayMs)
	if err != nil {
		return 0, 0, err
	}
	after, err := ResolveUtcOffset(timezone, wallMs+civilDayMs)
	if err != nil {
		return 0, 0, err
	}
	early := wallMs - int64(before)*60_000
	earlyOffset, err := ResolveUtcOffset(timezone, early)
	if err != nil {
		return 0, 0, err
	}
	if before == after {
		return early, earlyOffset, nil
	}
	late := wallMs - int64(after)*60_000
	lateOffset, err := ResolveUtcOffset(timezone, late)
	if err != nil {
		return 0, 0, err
	}
	earlyValid := earlyOffset == before
	lateValid := lateOffset == after
	switch {
	case earlyValid && lateValid && early < late:
		return early, before, nil
	case earlyValid && lateValid:
		return late, after, nil
	case lateValid:
		return late, after, nil
	}
	return early, earlyOffset, nil
}

// PaddedYearWindow runs from the UTC midnight two days before startYear to
// the end of the second day after endYear, which holds every local date of
// those years at any offset; it is cut to the supported span when both years
// lie within it, as nothing lands in the part cut away.
func PaddedYearWindow(startYear, endYear int) (int64, int64) {
	start := UtcDateMs(startYear, 0, 1) - 2*civilDayMs
	end := UtcDateMs(endYear+1, 0, 1) - 1 + 2*civilDayMs
	if startYear < 1900 || endYear > 2100 {
		return start, end
	}
	return max(start, SupportedStartMs), min(end, SupportedEndMs)
}

// LocalYearWindow returns the local midnight opening calendar year year in
// timezone and the instant before the next one, each at its own offset.
func LocalYearWindow(year int, timezone types.Timezone) (int64, int64, error) {
	start, _, err := WallClockToUtc(UtcDateMs(year, 0, 1), timezone, nil)
	if err != nil {
		return 0, 0, err
	}
	next, _, err := WallClockToUtc(UtcDateMs(year+1, 0, 1), timezone, nil)
	if err != nil {
		return 0, 0, err
	}
	return start, next - 1, nil
}

// CivilDayStepper returns one instant per civil day of timezone on each call:
// startMs, then the same local time of day on each following date at that
// date's own offset. A time of day a DST change skips moves forward (to the
// date's midnight if it would leave the date) and a date the zone skips is
// passed over, so each call returns a later instant. A fixed offset steps
// exactly 24 hours.
func CivilDayStepper(startMs int64, timezone types.Timezone) (func() (int64, error), error) {
	if !timezone.IsNamed() {
		t := startMs - civilDayMs
		return func() (int64, error) {
			t += civilDayMs
			return t, nil
		}, nil
	}
	offset, err := ResolveUtcOffset(timezone, startMs)
	if err != nil {
		return nil, err
	}
	startWall := startMs + int64(offset)*60_000
	day := floorDivMs(startWall, civilDayMs)
	timeOfDay := startWall - day*civilDayMs
	prev, started := int64(0), false
	onDay := func(t int64, o int) bool {
		return floorDivMs(t+int64(o)*60_000, civilDayMs) == day
	}
	return func() (int64, error) {
		if !started {
			started, prev = true, startMs
			return startMs, nil
		}
		for {
			day++
			t, o, err := WallClockToUtc(day*civilDayMs+timeOfDay, timezone, &offset)
			if err != nil {
				return 0, err
			}
			if !onDay(t, o) {
				t, o, err = WallClockToUtc(day*civilDayMs, timezone, &offset)
				if err != nil {
					return 0, err
				}
				if !onDay(t, o) {
					continue
				}
			}
			if t <= prev {
				continue
			}
			offset, prev = o, t
			return t, nil
		}
	}, nil
}

// InstantInCivilDay returns an instant on the civil date whose UTC midnight
// is dayMs, in timezone: dayMs itself where it already falls on that date
// (every offset at or east of UTC), else the date's local midnight. ok is
// false for a date the zone skips.
func InstantInCivilDay(dayMs int64, timezone types.Timezone) (int64, bool, error) {
	offset, err := ResolveUtcOffset(timezone, dayMs)
	if err != nil {
		return 0, false, err
	}
	if offset >= 0 {
		return dayMs, true, nil
	}
	t, o, err := WallClockToUtc(dayMs, timezone, &offset)
	if err != nil {
		return 0, false, err
	}
	return t, floorDivMs(t+int64(o)*60_000, civilDayMs)*civilDayMs == dayMs, nil
}

func CivilDayValue(dayMs int64, timezone types.Timezone) (int64, error) {
	offset, err := ResolveUtcOffset(timezone, dayMs)
	if err != nil {
		return 0, err
	}
	if offset < 0 {
		return dayMs + civilDayMs, nil
	}
	return dayMs, nil
}

// FormatInZone writes into a stack buffer and splits the instant into its
// calendar fields once, so a call allocates only the string it returns.
func FormatInZone(ms int64, offsetMinutes int) string {
	shifted := time.UnixMilli(ms + int64(offsetMinutes)*60_000).UTC()
	abs := uint64(offsetMinutes)
	if offsetMinutes < 0 {
		abs = -abs
	}
	year, month, day := shifted.Date()
	hour, minute, second := shifted.Clock()

	var buf [48]byte
	b := buf[:0]
	if year < 1000 {
		var digits [24]byte
		s := strconv.AppendInt(digits[:0], int64(year), 10)
		for i := len(s); i < 4; i++ {
			b = append(b, '0')
		}
		b = append(b, s...)
	} else {
		b = strconv.AppendInt(b, int64(year), 10)
	}
	b = append(b, '-')
	b = append(b, twoDigits[int(month)]...)
	b = append(b, '-')
	b = append(b, twoDigits[day]...)
	b = append(b, 'T')
	b = append(b, twoDigits[hour]...)
	b = append(b, ':')
	b = append(b, twoDigits[minute]...)
	b = append(b, ':')
	b = append(b, twoDigits[second]...)
	b = append(b, '.')
	b = append(b, threeDigits[shifted.Nanosecond()/1_000_000]...)
	if offsetMinutes < 0 {
		b = append(b, '-')
	} else {
		b = append(b, '+')
	}
	if hours := abs / 60; hours < uint64(len(twoDigits)) {
		b = append(b, twoDigits[hours]...)
	} else {
		b = strconv.AppendUint(b, hours, 10)
	}
	b = append(b, ':')
	b = append(b, twoDigits[abs%60]...)
	return string(b)
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
