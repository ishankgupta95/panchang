package utils

import (
	"math"
	"testing"
	"time"

	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

func codeOf(err error) types.ErrorCode {
	if pe, ok := err.(*types.PanchangError); ok {
		return pe.Code
	}
	return ""
}

func TestValidateLocation(t *testing.T) {
	for _, tc := range []struct {
		name string
		loc  types.GeoLocation
		want types.ErrorCode
	}{
		{"Pune", types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567, Elevation: 560}, ""},
		{"the origin", types.GeoLocation{}, ""},
		{"both poles are inclusive", types.GeoLocation{Latitude: 90, Longitude: 180}, ""},
		{"and the other ends", types.GeoLocation{Latitude: -90, Longitude: -180}, ""},
		{"the Dead Sea shore is below sea level", types.GeoLocation{Latitude: 31.5, Longitude: 35.5, Elevation: -430}, ""},
		{"latitude past the pole", types.GeoLocation{Latitude: 90.0001}, types.ErrInvalidLatitude},
		{"latitude past the other pole", types.GeoLocation{Latitude: -90.0001}, types.ErrInvalidLatitude},
		{"NaN latitude", types.GeoLocation{Latitude: math.NaN()}, types.ErrInvalidLatitude},
		{"infinite latitude", types.GeoLocation{Latitude: math.Inf(1)}, types.ErrInvalidLatitude},
		{"longitude past the antimeridian", types.GeoLocation{Longitude: 180.0001}, types.ErrInvalidLongitude},
		{"NaN longitude", types.GeoLocation{Longitude: math.NaN()}, types.ErrInvalidLongitude},
		{"below the Dead Sea", types.GeoLocation{Elevation: -500.0001}, types.ErrInvalidElevation},
		{"exactly -500 is allowed", types.GeoLocation{Elevation: -500}, ""},
		{"NaN elevation", types.GeoLocation{Elevation: math.NaN()}, types.ErrInvalidElevation},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateLocation(tc.loc)
			if tc.want == "" {
				if err != nil {
					t.Errorf("rejected a valid location: %v", err)
				}
				return
			}
			if err == nil {
				t.Fatalf("accepted %+v", tc.loc)
			}
			if got := codeOf(err); got != tc.want {
				t.Errorf("code %q, want %q (%v)", got, tc.want, err)
			}
		})
	}

	both := types.GeoLocation{Latitude: 100, Longitude: 200, Elevation: -9999}
	if got := codeOf(ValidateLocation(both)); got != types.ErrInvalidLatitude {
		t.Errorf("a location wrong in three ways reported %q, want INVALID_LATITUDE first", got)
	}
}

func TestValidateLocationMessagesUseJSNumberFormatting(t *testing.T) {
	err := ValidateLocation(types.GeoLocation{Latitude: 0.000028547284 + 1000})
	if err == nil {
		t.Fatal("expected a rejection")
	}
	if want := "Latitude must be a finite number between -90 and 90, got 1000.000028547284"; err.Error() != want {
		t.Errorf("message %q, want %q", err.Error(), want)
	}
	err = ValidateLocation(types.GeoLocation{Elevation: -1e21})
	if err == nil {
		t.Fatal("expected a rejection")
	}
	if want := "Elevation must be >= -500 meters, got -1e+21"; err.Error() != want {
		t.Errorf("message %q, want %q", err.Error(), want)
	}
}

func TestValidateDate(t *testing.T) {
	ms := func(y int) int64 {
		return time.Date(y, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()
	}
	for _, tc := range []struct {
		name string
		ms   int64
		ok   bool
	}{
		{"1900-01-01 is the first supported instant", ms(1900), true},
		{"one millisecond before it is not", ms(1900) - 1, false},
		{"2100 is supported", ms(2100), true},
		{"the last instant of 2100 is supported", ms(2101) - 1, true},
		{"2101 is not", ms(2101), false},
		{"the epoch", 0, true},
		{"1912, the parity dump's early epoch", ms(1912), true},
		{"2088, its late one", ms(2088), true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateDate(tc.ms)
			if tc.ok && err != nil {
				t.Errorf("rejected %v: %v", time.UnixMilli(tc.ms).UTC(), err)
			}
			if !tc.ok {
				if err == nil {
					t.Errorf("accepted %v", time.UnixMilli(tc.ms).UTC())
				} else if got := codeOf(err); got != types.ErrInvalidDate {
					t.Errorf("code %q, want INVALID_DATE", got)
				}
			}
		})
	}
}

func TestCyclicIndexGuards(t *testing.T) {
	for _, tc := range []struct {
		name  string
		call  func() error
		valid bool
	}{
		{"nakshatra 0", func() error { return AssertNakshatraIndex(0, "") }, true},
		{"nakshatra 26", func() error { return AssertNakshatraIndex(26, "") }, true},
		{"nakshatra 27", func() error { return AssertNakshatraIndex(27, "") }, false},
		{"nakshatra -1", func() error { return AssertNakshatraIndex(-1, "") }, false},
		{"vara 0", func() error { return AssertVaraIndex(0, "") }, true},
		{"vara 6", func() error { return AssertVaraIndex(6, "") }, true},
		{"vara 7", func() error { return AssertVaraIndex(7, "") }, false},
		{"tithi 0", func() error { return AssertTithiIndex(0, "") }, true},
		{"tithi 29", func() error { return AssertTithiIndex(29, "") }, true},
		{"tithi 30", func() error { return AssertTithiIndex(30, "") }, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.call()
			if tc.valid != (err == nil) {
				t.Errorf("valid=%v but err=%v", tc.valid, err)
			}
		})
	}
	if err := AssertNakshatraIndex(99, ""); err == nil ||
		err.Error() != "nakshatra index must be integer in [0, 26], got 99" {
		t.Errorf("default label: %v", err)
	}
	if err := AssertTithiIndex(99, "start tithi"); err == nil ||
		err.Error() != "start tithi must be integer in [0, 29], got 99" {
		t.Errorf("explicit label: %v", err)
	}
	if TotalTithis != 30 || TotalNakshatras != 27 {
		t.Errorf("TotalTithis=%d TotalNakshatras=%d, want 30 and 27", TotalTithis, TotalNakshatras)
	}
}

func TestNormalize360(t *testing.T) {
	for _, tc := range []struct{ in, want float64 }{
		{0, 0}, {1, 1}, {359.999, 359.999}, {360, 0}, {720, 0},
		{-1, 359}, {-360, 0}, {-720, 0}, {361, 1},
	} {
		if got := Normalize360(tc.in); got != tc.want {
			t.Errorf("Normalize360(%v) = %v, want %v", tc.in, got, tc.want)
		}
	}
	if got := Normalize360(-1e-15); got != 0 {
		t.Errorf("Normalize360(-1e-15) = %v, want exactly 0 (not 360)", got)
	}
	if got := Normalize360(-360); math.Signbit(got) {
		t.Error("Normalize360(-360) returned -0, which JSON would write as `-0`")
	}
	for _, base := range []float64{-1e6, -360, -1e-9, 0, 359.9999999999, 360, 1e6} {
		for _, d := range []float64{-1e-12, 0, 1e-12} {
			got := Normalize360(base + d)
			if !(got >= 0 && got < 360) {
				t.Errorf("Normalize360(%v) = %v, outside [0, 360)", base+d, got)
			}
		}
	}
}

func TestDegRadRoundTrip(t *testing.T) {
	for _, deg := range []float64{0, 1, 45, 90, 180, 270, 359.9, -12.5} {
		if back := RadToDeg(DegToRad(deg)); math.Abs(back-deg) > 1e-12 {
			t.Errorf("RadToDeg(DegToRad(%v)) = %v", deg, back)
		}
	}
	if got := DegToRad(180); math.Abs(got-math.Pi) > 1e-15 {
		t.Errorf("DegToRad(180) = %v, want pi", got)
	}
}
