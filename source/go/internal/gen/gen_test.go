package gen

import (
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy/series"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
)

func sourceDir(t *testing.T) string {
	t.Helper()
	return repopath.TestData("ephemeris")
}

var (
	reTsArray  = regexp.MustCompile(`export const (\w+) = new (Float64Array|Int8Array)\(\[`)
	reTsScalar = regexp.MustCompile(`export const (\w+) = (-?[\d.eE+-]+);`)
)

type tsSeries struct {
	floats  map[string][]float64
	int8s   map[string][]float64
	scalars map[string]float64
}

func readTsSeries(t *testing.T) tsSeries {
	t.Helper()
	out := tsSeries{
		floats:  map[string][]float64{},
		int8s:   map[string][]float64{},
		scalars: map[string]float64{},
	}
	dir := repopath.Src("astronomy", "series")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read %s: %v", dir, err)
	}
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".ts") {
			continue
		}
		b, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			t.Fatalf("read %s: %v", e.Name(), err)
		}
		text := string(b)
		for _, m := range reTsArray.FindAllStringSubmatchIndex(text, -1) {
			name := text[m[2]:m[3]]
			kind := text[m[4]:m[5]]
			end := strings.Index(text[m[1]:], "]);")
			if end < 0 {
				t.Fatalf("%s: unterminated array %s", e.Name(), name)
			}
			values := parseNumberList(t, e.Name(), name, text[m[1]:m[1]+end])
			if kind == "Float64Array" {
				out.floats[name] = values
			} else {
				out.int8s[name] = values
			}
		}
		for _, m := range reTsScalar.FindAllStringSubmatch(text, -1) {
			v, err := strconv.ParseFloat(m[2], 64)
			if err != nil {
				continue
			}
			out.scalars[m[1]] = v
		}
	}
	if len(out.floats) == 0 {
		t.Fatal("read no Float64Array literals from src/astronomy/series: the lexer no longer matches")
	}
	return out
}

func parseNumberList(t *testing.T, file, name, body string) []float64 {
	t.Helper()
	fields := strings.Split(body, ",")
	out := make([]float64, 0, len(fields))
	for _, f := range fields {
		f = strings.TrimSpace(f)
		if f == "" {
			continue
		}
		v, err := strconv.ParseFloat(f, 64)
		if err != nil {
			t.Fatalf("%s: %s: unparseable element %q", file, name, f)
		}
		out = append(out, v)
	}
	return out
}

func TestCoefficientIdentity(t *testing.T) {
	ts := readTsSeries(t)

	if got, want := len(series.Float64Series), len(ts.floats); got != want {
		t.Errorf("Go emits %d float64 series, TS has %d", got, want)
	}
	if got, want := len(series.Int8Series), len(ts.int8s); got != want {
		t.Errorf("Go emits %d int8 series, TS has %d", got, want)
	}
	if got, want := len(series.Scalars), len(ts.scalars); got != want {
		t.Errorf("Go emits %d scalars, TS has %d", got, want)
	}

	for name, want := range ts.floats {
		got, ok := series.Float64Series[name]
		if !ok {
			t.Errorf("%s: present in TS, absent from Go", name)
			continue
		}
		if len(got) != len(want) {
			t.Errorf("%s: Go has %d values, TS has %d, so the truncation diverged", name, len(got), len(want))
			continue
		}
		for i := range want {
			if math.Float64bits(got[i]) != math.Float64bits(want[i]) {
				t.Errorf("%s[%d]: Go %v (bits %#016x), TS %v (bits %#016x)",
					name, i, got[i], math.Float64bits(got[i]), want[i], math.Float64bits(want[i]))
				break
			}
		}
	}
	for name := range series.Float64Series {
		if _, ok := ts.floats[name]; !ok {
			t.Errorf("%s: present in Go, absent from TS", name)
		}
	}

	for name, want := range ts.int8s {
		got, ok := series.Int8Series[name]
		if !ok {
			t.Errorf("%s: present in TS, absent from Go", name)
			continue
		}
		if len(got) != len(want) {
			t.Errorf("%s: Go has %d values, TS has %d", name, len(got), len(want))
			continue
		}
		for i := range want {
			if float64(got[i]) != want[i] {
				t.Errorf("%s[%d]: Go %d, TS %v", name, i, got[i], want[i])
				break
			}
		}
	}

	for name, want := range ts.scalars {
		got, ok := series.Scalars[name]
		if !ok {
			t.Errorf("%s: present in TS, absent from Go", name)
			continue
		}
		if got != want {
			t.Errorf("%s: Go %v, TS %v", name, got, want)
		}
	}
}

func TestSeriesShape(t *testing.T) {
	strides := map[string]int{
		"MOON_MEAN_LONGITUDE": 5,
	}
	for name, values := range series.Float64Series {
		stride, ok := strides[name]
		if !ok {
			switch {
			case strings.HasSuffix(name, "_QUARTIC"):
				stride = 6
			case strings.HasSuffix(name, "_LINEAR"):
				stride = 4
			case strings.HasPrefix(name, "NUTATION_"):
				stride = 3
			default:
				stride = 4 // A, B, C, power
			}
		}
		if len(values)%stride != 0 {
			t.Errorf("%s: %d values is not a multiple of stride %d", name, len(values), stride)
		}
	}
	for name, values := range series.Int8Series {
		if len(values)%14 != 0 {
			t.Errorf("%s: %d values is not a multiple of stride 14", name, len(values))
		}
	}
	maxMult, ok := series.Scalars["NUTATION_MAX_MULTIPLIER"]
	if !ok {
		t.Fatal("NUTATION_MAX_MULTIPLIER missing")
	}
	for name, values := range series.Int8Series {
		for i, v := range values {
			if m := math.Abs(float64(v)); m > maxMult {
				t.Fatalf("%s[%d] = %d exceeds NUTATION_MAX_MULTIPLIER = %v", name, i, v, maxMult)
			}
		}
	}
}

func vsopReference(s *vsopSeries, jdTt float64) (l, b, r float64) {
	tau := (jdTt - 2451545.0) / 365250
	var out [4]float64
	for variable := 1; variable <= 3; variable++ {
		total := 0.0
		powers := s[variable]
		for power := 0; power < len(powers); power++ {
			sum := 0.0
			for _, term := range powers[power] {
				sum += term.A * math.Cos(term.B+term.C*tau)
			}
			total += sum * ipow(tau, power)
		}
		out[variable] = total
	}
	return out[1], out[2], out[3]
}

func TestVsopParserAgainstCheckFile(t *testing.T) {
	dir := sourceDir(t)
	if _, err := os.Stat(filepath.Join(dir, "vsop87d.txt.gz")); err != nil {
		t.Skipf("ephemeris sources absent (%v); this test regenerates from them", err)
	}
	vsop, err := readVsop87d(dir)
	if err != nil {
		t.Fatalf("readVsop87d: %v", err)
	}
	rows, err := readVsop87Check(dir)
	if err != nil {
		t.Fatalf("readVsop87Check: %v", err)
	}
	bodyFile := map[string]string{
		"MERCURY": "mer", "VENUS": "ven", "EARTH": "ear",
		"MARS": "mar", "JUPITER": "jup", "SATURN": "sat",
	}
	checked, worst := 0, 0.0
	for _, row := range rows {
		body, ok := bodyFile[row.body]
		if !ok {
			continue
		}
		s := vsop[body]
		if s == nil {
			t.Fatalf("body %q absent from the parsed tables", body)
		}
		l, b, r := vsopReference(s, row.jd)
		dl := math.Abs(math.Mod(math.Mod(l-row.l, 2*math.Pi)+3*math.Pi, 2*math.Pi) - math.Pi)
		worst = math.Max(worst, math.Max(dl, math.Max(math.Abs(b-row.b), math.Abs(r-row.r))))
		checked++
	}
	if checked < 60 {
		t.Errorf("checked only %d rows, expected ≥ 60", checked)
	}
	if worst >= 1e-9 {
		t.Errorf("worst |Δ| vs vsop87.chk was %.3e, bound 1e-9", worst)
	}
	t.Logf("checked %d rows, worst |Δ| %.3e rad", checked, worst)
}

func TestGeneratorReproducesCommittedSeries(t *testing.T) {
	if os.Getenv("GEN_FULL") == "" {
		t.Skip("set GEN_FULL=1 to run the full regeneration (~2 min)")
	}
	dir := sourceDir(t)
	if _, err := os.Stat(filepath.Join(dir, "vsop87d.txt.gz")); err != nil {
		t.Skipf("ephemeris sources absent (%v)", err)
	}
	tmp := t.TempDir()
	if _, err := Generate(dir, tmp); err != nil {
		t.Fatalf("Generate: %v", err)
	}
	committed := repopath.Go("internal", "astronomy", "series")
	for _, name := range []string{"elp2000-82b.go", "vsop87d.go", "nutation-iau2000.go", "registry.go"} {
		got, err := os.ReadFile(filepath.Join(tmp, name))
		if err != nil {
			t.Errorf("%s: %v", name, err)
			continue
		}
		want, err := os.ReadFile(filepath.Join(committed, name))
		if err != nil {
			t.Errorf("%s: %v", name, err)
			continue
		}
		if string(got) != string(want) {
			t.Errorf("%s: regenerated output differs from the committed file", name)
		}
	}
}
