package gen

import (
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

func slice(s string, start, end int) string {
	if start < 0 {
		start = 0
	}
	if end > len(s) {
		end = len(s)
	}
	if start >= end {
		return ""
	}
	return s[start:end]
}

func jsNumber(s string) (float64, bool) {
	t := strings.TrimSpace(s)
	if t == "" {
		return 0, true
	}
	v, err := strconv.ParseFloat(t, 64)
	if err != nil || math.IsInf(v, 0) || math.IsNaN(v) {
		return 0, false
	}
	return v, true
}

func number(s string) float64 {
	v, ok := jsNumber(s)
	if !ok {
		panic(fmt.Sprintf("unparseable coefficient field %q", s))
	}
	return v
}

var bundleHeader = regexp.MustCompile(`^===== (\S+) =====$`)

type bundleSection struct {
	name  string
	lines []string
}

func readBundle(sourceDir, file string) ([]bundleSection, error) {
	raw, err := os.ReadFile(filepath.Join(sourceDir, file+".gz"))
	if err != nil {
		return nil, err
	}
	zr, err := gzip.NewReader(bytes.NewReader(raw))
	if err != nil {
		return nil, fmt.Errorf("%s: %w", file, err)
	}
	defer zr.Close()
	text, err := io.ReadAll(zr)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", file, err)
	}

	var out []bundleSection
	cur := -1
	for _, line := range strings.Split(string(text), "\n") {
		if m := bundleHeader.FindStringSubmatch(line); m != nil {
			out = append(out, bundleSection{name: m[1]})
			cur = len(out) - 1
			continue
		}
		if cur >= 0 && strings.TrimSpace(line) != "" {
			out[cur].lines = append(out[cur].lines, line)
		}
	}
	return out, nil
}

type vsopTerm struct{ A, B, C float64 }

type vsopSeries [4][][]vsopTerm

var vsopBodies = []string{"ear", "mer", "ven", "mar", "jup", "sat"}

func readVsop87d(sourceDir string) (map[string]*vsopSeries, error) {
	sections, err := readBundle(sourceDir, "vsop87d.txt")
	if err != nil {
		return nil, err
	}
	out := map[string]*vsopSeries{}
	for _, sec := range sections {
		body := strings.TrimPrefix(sec.name, "VSOP87D.")
		series := &vsopSeries{}
		variable, power := 1, 0
		for _, line := range sec.lines {
			if strings.Contains(line, "VSOP87 VERSION") {
				variable = int(number(slice(line, 41, 42)))
				power = int(number(slice(line, 59, 60)))
				for len(series[variable]) <= power {
					series[variable] = append(series[variable], nil)
				}
				series[variable][power] = []vsopTerm{}
				continue
			}
			series[variable][power] = append(series[variable][power], vsopTerm{
				A: number(slice(line, 79, 97)),
				B: number(slice(line, 97, 111)),
				C: number(slice(line, 111, 131)),
			})
		}
		out[body] = series
	}
	return out, nil
}

type vsopCheck struct {
	body    string
	jd      float64
	l, b, r float64
}

var vsopCheckHead = regexp.MustCompile(`VSOP87D\s+(\w+)\s+JD([\d.]+)`)

func readVsop87Check(sourceDir string) ([]vsopCheck, error) {
	raw, err := os.ReadFile(filepath.Join(sourceDir, "vsop87.chk.txt.gz"))
	if err != nil {
		return nil, err
	}
	zr, err := gzip.NewReader(bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	defer zr.Close()
	text, err := io.ReadAll(zr)
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(text), "\n")
	var out []vsopCheck
	for i := 0; i < len(lines)-1; i++ {
		m := vsopCheckHead.FindStringSubmatch(lines[i])
		if m == nil {
			continue
		}
		f := strings.Fields(strings.TrimSpace(lines[i+1]))
		if len(f) < 8 {
			continue
		}
		jd, _ := strconv.ParseFloat(m[2], 64)
		l, _ := strconv.ParseFloat(f[1], 64)
		b, _ := strconv.ParseFloat(f[4], 64)
		r, _ := strconv.ParseFloat(f[7], 64)
		out = append(out, vsopCheck{body: m[1], jd: jd, l: l, b: b, r: r})
	}
	return out, nil
}

type elpMainTerm struct {
	ilu  [4]float64
	coef [8]float64
}

type elpPertTerm struct {
	iz     float64
	ilu    [4]float64
	pha, a float64
}

type elpPlanetTerm struct {
	ipla   [11]float64
	pha, a float64
}

type elpTables struct {
	main   map[int][]elpMainTerm
	pert   map[int][]elpPertTerm
	planet map[int][]elpPlanetTerm
}

func readElp2000(sourceDir string) (*elpTables, error) {
	sections, err := readBundle(sourceDir, "elp2000-82b.txt")
	if err != nil {
		return nil, err
	}
	tables := &elpTables{
		main:   map[int][]elpMainTerm{},
		pert:   map[int][]elpPertTerm{},
		planet: map[int][]elpPlanetTerm{},
	}
	for _, sec := range sections {
		file, err := strconv.Atoi(sec.name[3:])
		if err != nil {
			return nil, fmt.Errorf("ELP section %q: %w", sec.name, err)
		}
		rows := sec.lines[1:]
		switch {
		case file <= 3:
			terms := make([]elpMainTerm, 0, len(rows))
			for _, l := range rows {
				var t elpMainTerm
				t.ilu = [4]float64{
					number(slice(l, 0, 3)), number(slice(l, 3, 6)),
					number(slice(l, 6, 9)), number(slice(l, 9, 12)),
				}
				t.coef[1] = number(slice(l, 14, 27))
				for k := 0; k < 6; k++ {
					t.coef[2+k] = number(slice(l, 29+k*12, 39+k*12))
				}
				terms = append(terms, t)
			}
			tables.main[file] = terms
		case file <= 9 || file >= 22:
			terms := make([]elpPertTerm, 0, len(rows))
			for _, l := range rows {
				terms = append(terms, elpPertTerm{
					iz: number(slice(l, 0, 3)),
					ilu: [4]float64{
						number(slice(l, 3, 6)), number(slice(l, 6, 9)),
						number(slice(l, 9, 12)), number(slice(l, 12, 15)),
					},
					pha: number(slice(l, 15, 25)),
					a:   number(slice(l, 25, 35)),
				})
			}
			tables.pert[file] = terms
		default:
			terms := make([]elpPlanetTerm, 0, len(rows))
			for _, l := range rows {
				var t elpPlanetTerm
				for i := 0; i < 11; i++ {
					t.ipla[i] = number(slice(l, i*3, i*3+3))
				}
				t.pha = number(slice(l, 33, 43))
				t.a = number(slice(l, 43, 53))
				terms = append(terms, t)
			}
			tables.planet[file] = terms
		}
	}
	return tables, nil
}

type nutationTerm struct {
	sinCoef, cosCoef float64
	mult             [14]float64
	power            int
}

var nutationJ = regexp.MustCompile(`^j\s*=\s*([01])`)
var allDigits = regexp.MustCompile(`^\d+$`)

func readNutation(sourceDir string) (psi, eps []nutationTerm, err error) {
	sections, err := readBundle(sourceDir, "iers-nutation.txt")
	if err != nil {
		return nil, nil, err
	}
	parse := func(lines []string) []nutationTerm {
		var out []nutationTerm
		power := 0
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if m := nutationJ.FindStringSubmatch(trimmed); m != nil {
				power, _ = strconv.Atoi(m[1])
				continue
			}
			f := strings.Fields(trimmed)
			if len(f) != 17 || !allDigits.MatchString(f[0]) {
				continue
			}
			a, aok := jsNumber(f[1])
			b, bok := jsNumber(f[2])
			if !aok || !bok {
				continue
			}
			var mult [14]float64
			ok := true
			for i := 0; i < 14; i++ {
				v, vok := jsNumber(f[3+i])
				if !vok {
					ok = false
					break
				}
				mult[i] = v
			}
			if !ok {
				continue
			}
			out = append(out, nutationTerm{sinCoef: a, cosCoef: b, mult: mult, power: power})
		}
		return out
	}
	for _, sec := range sections {
		switch sec.name {
		case "tab5.3a":
			psi = parse(sec.lines)
		case "tab5.3b":
			eps = parse(sec.lines)
		}
	}
	if psi == nil || eps == nil {
		return nil, nil, fmt.Errorf("iers-nutation.txt: missing tab5.3a or tab5.3b")
	}
	return psi, eps, nil
}
