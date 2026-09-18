package types

import (
	"encoding/json"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"testing"
)

type jsDateGolden struct {
	Meta     map[string]any `json:"_meta"`
	Instants []struct {
		Ms          int64  `json:"ms"`
		ISO         string `json:"iso"`
		JSON        string `json:"json"`
		UTCFullYear int    `json:"utcFullYear"`
		UTCDay      int    `json:"utcDay"`
	} `json:"instants"`
	DateUTC []struct {
		Year  int   `json:"year"`
		Month int   `json:"month"`
		Day   int   `json:"day"`
		Ms    int64 `json:"ms"`
	} `json:"dateUtc"`
}

func loadJSDateGolden(t *testing.T) jsDateGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "types", "jsdate-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g jsDateGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.Instants) == 0 || len(g.DateUTC) == 0 {
		t.Fatal("golden is empty")
	}
	return g
}

func TestJSDateMatchesJavaScript(t *testing.T) {
	g := loadJSDateGolden(t)

	expanded, negative, subMillennium := 0, 0, 0
	for _, c := range g.Instants {
		d := Date(c.Ms)
		if got := d.ISOString(); got != c.ISO {
			t.Errorf("ms=%d ISOString: got %q want %q", c.Ms, got, c.ISO)
		}
		if got := d.UTCFullYear(); got != c.UTCFullYear {
			t.Errorf("ms=%d UTCFullYear: got %d want %d", c.Ms, got, c.UTCFullYear)
		}
		if got := d.UTCDay(); got != c.UTCDay {
			t.Errorf("ms=%d UTCDay: got %d want %d", c.Ms, got, c.UTCDay)
		}
		b, err := json.Marshal(d)
		if err != nil {
			t.Fatalf("ms=%d marshal: %v", c.Ms, err)
		}
		if string(b) != c.JSON {
			t.Errorf("ms=%d MarshalJSON: got %s want %s", c.Ms, b, c.JSON)
		}
		if got := d.Ms(); got != c.Ms {
			t.Errorf("Ms() round-trip: got %d want %d", got, c.Ms)
		}

		switch {
		case c.ISO[0] == '+' || c.ISO[0] == '-':
			expanded++
		case c.UTCFullYear < 1000:
			subMillennium++
		}
		if c.Ms < 0 {
			negative++
		}
	}

	if expanded < 4 {
		t.Errorf("only %d expanded-year instants in the sample; the ±YYYYYY branch is barely covered", expanded)
	}
	if negative < 10 {
		t.Errorf("only %d negative-epoch instants; the pre-1970 half is barely covered", negative)
	}
	if subMillennium < 2 {
		t.Errorf("only %d instants with a year below 1000; the zero-padding branch is barely covered", subMillennium)
	}
}

func TestDateUTCMatchesJavaScript(t *testing.T) {
	g := loadJSDateGolden(t)
	sawMapping, sawRollover := false, false
	for _, c := range g.DateUTC {
		got := DateUTC(c.Year, c.Month, c.Day)
		if got.Ms() != c.Ms {
			t.Errorf("DateUTC(%d, %d, %d): got %d (%s) want %d (%s)",
				c.Year, c.Month, c.Day, got.Ms(), got.ISOString(), c.Ms, Date(c.Ms).ISOString())
		}
		if c.Year >= 0 && c.Year <= 99 {
			sawMapping = true
			if y := got.UTCFullYear(); y != c.Year+1900 {
				t.Errorf("DateUTC(%d, …) gave year %d, want %d", c.Year, y, c.Year+1900)
			}
		}
		if c.Month < 0 || c.Month > 11 || c.Day < 1 || c.Day > 28 {
			sawRollover = true
		}
	}
	if !sawMapping {
		t.Error("no [0,99] year in the golden: the 1900+year mapping is untested")
	}
	if !sawRollover {
		t.Error("no out-of-range month or day in the golden: rollover is untested")
	}
}

func TestJSDateJSONRoundTrip(t *testing.T) {
	g := loadJSDateGolden(t)
	for _, c := range g.Instants {
		var d JSDate
		if err := json.Unmarshal([]byte(c.JSON), &d); err != nil {
			t.Fatalf("unmarshal %s: %v", c.JSON, err)
		}
		if d.Ms() != c.Ms {
			t.Errorf("round-trip %s: got %d want %d", c.JSON, d.Ms(), c.Ms)
		}
	}

	d := Date(12345)
	if err := json.Unmarshal([]byte("null"), &d); err != nil || d.Ms() != 12345 {
		t.Errorf("null: err=%v value=%d, want no error and 12345 unchanged", err, d.Ms())
	}
	var holder struct {
		A *JSDate `json:"a"`
		B *JSDate `json:"b"`
	}
	if err := json.Unmarshal([]byte(`{"a":null,"b":"2025-01-14T01:39:44.172Z"}`), &holder); err != nil {
		t.Fatal(err)
	}
	if holder.A != nil {
		t.Errorf("null pointer field parsed to %v, want nil", holder.A)
	}
	if holder.B == nil || holder.B.Ms() != 1736818784172 {
		t.Errorf("pointer field: got %v, want 1736818784172", holder.B)
	}

	if err := json.Unmarshal([]byte("123"), &d); err == nil {
		t.Error("a bare number parsed as a JSDate; it should be rejected")
	}
}

func TestNullableDateIsTheNullArm(t *testing.T) {
	if got := NullableDate(nil); got != nil {
		t.Errorf("NullableDate(nil) = %v, want nil", got)
	}
	ms := int64(1736818784172)
	got := NullableDate(&ms)
	if got == nil || got.Ms() != ms {
		t.Fatalf("NullableDate(&%d) = %v", ms, got)
	}
	ms = 0
	if got.Ms() != 1736818784172 {
		t.Error("NullableDate aliased its argument")
	}

	b, err := json.Marshal(struct {
		EndTime *JSDate `json:"endTime"`
	}{nil})
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != `{"endTime":null}` {
		t.Errorf("nil *JSDate marshalled as %s, want {\"endTime\":null}", b)
	}
}
