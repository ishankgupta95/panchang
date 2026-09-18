// Package treecheck enforces the file-for-file correspondence between
// source/ts/src and source/go, reading the two allowlist tables in docs/porting.md
// so that every exemption carries a written justification.
package treecheck

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
)

const (
	titleGoOnly = "why it has no TypeScript counterpart"
	titleTSOnly = "why it has no Go counterpart"
)

const (
	tsRoot = "source/ts/src/"
	goRoot = "source/go/"
)

type Entry struct {
	Pattern string
	Reason  string
	Line    int
}

type Allowlists struct {
	GoOnly []Entry
	TSOnly []Entry
}

type Tree struct {
	TS      []string
	DTS     []string
	Go      []string
	GoTests []string
}

type Pair struct{ TS, Go string }

type Collision struct {
	Go string
	TS []string
}

type AllowedFile struct {
	Path  string
	Entry Entry
}

type Report struct {
	Tree  Tree
	Pairs []Pair

	MissingGo  []Pair
	Unallowed  []string
	UnusedGo   []Entry
	UnusedTS   []Entry
	Collisions []Collision
	Shadowed   []AllowedFile

	AllowedGo []AllowedFile
	AllowedTS []AllowedFile
}

func (r *Report) OK() bool { return len(r.Problems()) == 0 }

func (r *Report) Problems() []string {
	var out []string
	for _, p := range r.MissingGo {
		out = append(out, fmt.Sprintf(
			"%s has no Go counterpart: expected %s (port it, or add a `%s` row to docs/porting.md §3's second table)",
			p.TS, p.Go, p.TS))
	}
	for _, g := range r.Unallowed {
		out = append(out, fmt.Sprintf(
			"%s mirrors no TypeScript file and has no allowlist row: add a `%s` row to docs/porting.md §3's first table, with its reason, in this same change",
			g, strings.TrimPrefix(g, goRoot)))
	}
	for _, e := range r.UnusedGo {
		out = append(out, fmt.Sprintf(
			"docs/porting.md:%d allowlists `%s`, which matches no Go file on disk; delete the row",
			e.Line, e.Pattern))
	}
	for _, e := range r.UnusedTS {
		out = append(out, fmt.Sprintf(
			"docs/porting.md:%d allowlists `%s`, which matches no TypeScript file on disk; delete the row",
			e.Line, e.Pattern))
	}
	for _, c := range r.Collisions {
		out = append(out, fmt.Sprintf(
			"%s is the mapped path of %d TypeScript files that differ only in case: %s",
			c.Go, len(c.TS), strings.Join(c.TS, ", ")))
	}
	for _, s := range r.Shadowed {
		out = append(out, fmt.Sprintf(
			"docs/porting.md:%d allowlists `%s` as having no counterpart, but %s does have one; delete the row",
			s.Entry.Line, s.Entry.Pattern, s.Path))
	}
	return out
}

func GoPathFor(ts string) (string, error) {
	if !strings.HasPrefix(ts, tsRoot) {
		return "", fmt.Errorf("treecheck: %q is not under %s", ts, tsRoot)
	}
	if !strings.HasSuffix(ts, ".ts") || strings.HasSuffix(ts, ".d.ts") {
		return "", fmt.Errorf("treecheck: %q is not a portable .ts file", ts)
	}
	rel := strings.TrimPrefix(ts, tsRoot)
	dir, base := path.Split(rel)
	base = strings.ToLower(strings.TrimSuffix(base, ".ts")) + ".go"
	// The shared types live at the module root rather than under internal/, so
	// that their fields and methods render on pkg.go.dev and a caller can
	// import them. Everything else is implementation and stays internal.
	if dir == "types/" {
		return path.Join(goRoot, dir, base), nil
	}
	return path.Join(goRoot+"internal", dir, base), nil
}

func Scan(t Tree, a Allowlists) (*Report, error) {
	switch {
	case len(t.TS) == 0:
		return nil, errors.New("treecheck: no TypeScript sources in the census: the walk found nothing, so every check below would pass vacuously")
	case len(t.Go) == 0:
		return nil, errors.New("treecheck: no Go sources in the census: the walk found nothing, so every check below would pass vacuously")
	case len(a.GoOnly) == 0:
		return nil, errors.New("treecheck: the GoOnly allowlist parsed empty: docs/porting.md §3's first table was not found or has no rows")
	case len(a.TSOnly) == 0:
		return nil, errors.New("treecheck: the TSOnly allowlist parsed empty: docs/porting.md §3's second table was not found or has no rows")
	}

	r := &Report{Tree: t}

	goSet := make(map[string]bool, len(t.Go))
	for _, g := range t.Go {
		goSet[g] = true
	}

	mappedFrom := map[string][]string{}
	usedTS := make([]bool, len(a.TSOnly))
	for _, ts := range t.TS {
		g, err := GoPathFor(ts)
		if err != nil {
			return nil, err
		}
		mappedFrom[g] = append(mappedFrom[g], ts)

		i, allowed := matchIndex(a.TSOnly, ts)
		if allowed {
			usedTS[i] = true
		}
		if goSet[g] {
			r.Pairs = append(r.Pairs, Pair{TS: ts, Go: g})
			if allowed {
				r.Shadowed = append(r.Shadowed, AllowedFile{Path: ts, Entry: a.TSOnly[i]})
			}
			continue
		}
		if allowed {
			r.AllowedTS = append(r.AllowedTS, AllowedFile{Path: ts, Entry: a.TSOnly[i]})
			continue
		}
		r.MissingGo = append(r.MissingGo, Pair{TS: ts, Go: g})
	}
	for g, srcs := range mappedFrom {
		if len(srcs) > 1 {
			sort.Strings(srcs)
			r.Collisions = append(r.Collisions, Collision{Go: g, TS: srcs})
		}
	}
	sort.Slice(r.Collisions, func(i, j int) bool { return r.Collisions[i].Go < r.Collisions[j].Go })

	usedGo := make([]bool, len(a.GoOnly))
	for _, g := range t.Go {
		i, allowed := matchIndex(a.GoOnly, g)
		if allowed {
			usedGo[i] = true
		}
		if len(mappedFrom[g]) > 0 {
			if allowed {
				r.Shadowed = append(r.Shadowed, AllowedFile{Path: g, Entry: a.GoOnly[i]})
			}
			continue
		}
		if allowed {
			r.AllowedGo = append(r.AllowedGo, AllowedFile{Path: g, Entry: a.GoOnly[i]})
			continue
		}
		r.Unallowed = append(r.Unallowed, g)
	}

	for i, used := range usedGo {
		if !used {
			r.UnusedGo = append(r.UnusedGo, a.GoOnly[i])
		}
	}
	for i, used := range usedTS {
		if !used {
			r.UnusedTS = append(r.UnusedTS, a.TSOnly[i])
		}
	}
	return r, nil
}

func matchIndex(entries []Entry, p string) (int, bool) {
	for i, e := range entries {
		if MatchPattern(e.Pattern, p) {
			return i, true
		}
	}
	return 0, false
}

func MatchPattern(pattern, p string) bool {
	return matchSegments(strings.Split(pattern, "/"), strings.Split(p, "/"))
}

func matchSegments(pat, seg []string) bool {
	for len(pat) > 0 {
		if pat[0] == "**" {
			for i := 0; i <= len(seg); i++ {
				if matchSegments(pat[1:], seg[i:]) {
					return true
				}
			}
			return false
		}
		if len(seg) == 0 {
			return false
		}
		ok, err := path.Match(pat[0], seg[0])
		if err != nil || !ok {
			return false
		}
		pat, seg = pat[1:], seg[1:]
	}
	return len(seg) == 0
}

func ParseAllowlists(md []byte) (Allowlists, error) {
	lines := strings.Split(string(md), "\n")
	goOnly, err := parseTable(lines, titleGoOnly, goRoot, implicitRootOK)
	if err != nil {
		return Allowlists{}, err
	}
	tsOnly, err := parseTable(lines, titleTSOnly, tsRoot, rootRequired)
	if err != nil {
		return Allowlists{}, err
	}
	return Allowlists{GoOnly: goOnly, TSOnly: tsOnly}, nil
}

func ParseAllowlistsFile(p string) (Allowlists, error) {
	b, err := os.ReadFile(p)
	if err != nil {
		return Allowlists{}, err
	}
	a, err := ParseAllowlists(b)
	if err != nil {
		return Allowlists{}, fmt.Errorf("%s: %w", p, err)
	}
	return a, nil
}

func parseTable(lines []string, title, root string, policy rootPolicy) ([]Entry, error) {
	start := -1
	for i, ln := range lines {
		cells, ok := tableCells(ln)
		if !ok || len(cells) < 2 {
			continue
		}
		if cells[1] == title {
			if start >= 0 {
				return nil, fmt.Errorf("treecheck: two tables titled %q (lines %d and %d); the parser anchors on the title, so it must be unique", title, start+1, i+1)
			}
			start = i
		}
	}
	if start < 0 {
		return nil, fmt.Errorf("treecheck: no table titled %q found", title)
	}
	if start+1 >= len(lines) || !isSeparatorRow(lines[start+1]) {
		return nil, fmt.Errorf("treecheck: table %q at line %d is not followed by a `|---|---|` separator", title, start+1)
	}

	var out []Entry
	for i := start + 2; i < len(lines); i++ {
		cells, ok := tableCells(lines[i])
		if !ok {
			break
		}
		if len(cells) != 2 {
			return nil, fmt.Errorf("treecheck: docs/porting.md:%d has %d cells, want 2 (escape a literal pipe as `\\|`)", i+1, len(cells))
		}
		pattern, err := backtickedPath(cells[0])
		if err != nil {
			return nil, fmt.Errorf("treecheck: docs/porting.md:%d: %w", i+1, err)
		}
		reason := strings.TrimSpace(cells[1])
		if reason == "" {
			return nil, fmt.Errorf("treecheck: docs/porting.md:%d: `%s` has no reason; D1/D6 exemptions carry one", i+1, pattern)
		}
		p, err := normalisePattern(pattern, root, policy)
		if err != nil {
			return nil, fmt.Errorf("treecheck: docs/porting.md:%d: %w", i+1, err)
		}
		out = append(out, Entry{Pattern: p, Reason: reason, Line: i + 1})
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("treecheck: table %q at line %d has no rows", title, start+1)
	}
	return out, nil
}

func tableCells(ln string) ([]string, bool) {
	s := strings.TrimSpace(ln)
	if !strings.HasPrefix(s, "|") || !strings.HasSuffix(s, "|") || len(s) < 2 {
		return nil, false
	}
	var cells []string
	var cur strings.Builder
	for i := 1; i < len(s)-1; i++ {
		switch {
		case s[i] == '\\' && i+1 < len(s)-1 && s[i+1] == '|':
			cur.WriteByte('|')
			i++
		case s[i] == '|':
			cells = append(cells, strings.TrimSpace(cur.String()))
			cur.Reset()
		default:
			cur.WriteByte(s[i])
		}
	}
	cells = append(cells, strings.TrimSpace(cur.String()))
	return cells, true
}

func isSeparatorRow(ln string) bool {
	cells, ok := tableCells(ln)
	if !ok || len(cells) == 0 {
		return false
	}
	for _, c := range cells {
		if c == "" || strings.Trim(c, "-: ") != "" {
			return false
		}
	}
	return true
}

func backtickedPath(cell string) (string, error) {
	var spans []string
	for {
		i := strings.Index(cell, "`")
		if i < 0 {
			break
		}
		j := strings.Index(cell[i+1:], "`")
		if j < 0 {
			return "", errors.New("unterminated ` in the file cell")
		}
		spans = append(spans, cell[i+1:i+1+j])
		cell = cell[i+2+j:]
	}
	switch len(spans) {
	case 0:
		return "", errors.New("the file cell has no `backticked` path")
	case 1:
		return spans[0], nil
	default:
		return "", fmt.Errorf("the file cell has %d backticked spans, want exactly 1: %v", len(spans), spans)
	}
}

type rootPolicy int

const (
	rootRequired rootPolicy = iota
	implicitRootOK
)

func normalisePattern(p, root string, policy rootPolicy) (string, error) {
	p = strings.TrimSpace(p)
	if p == "" {
		return "", errors.New("empty pattern")
	}
	if strings.HasPrefix(p, "/") || strings.Contains(p, "//") {
		return "", fmt.Errorf("%q is not a clean relative path", p)
	}
	if strings.HasPrefix(p, root) {
		return p, nil
	}
	if policy == rootRequired {
		return "", fmt.Errorf("%q is not under %s", p, root)
	}
	return root + p, nil
}

var skipDirs = map[string]bool{
	"source/go/parity/out": true,
	"node_modules":         true,
}

func WalkRepo(root string) (Tree, error) {
	var t Tree
	collect := func(sub string, fn func(rel string)) error {
		return filepath.WalkDir(filepath.Join(root, sub), func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			rel, rerr := filepath.Rel(root, p)
			if rerr != nil {
				return rerr
			}
			rel = filepath.ToSlash(rel)
			if d.IsDir() {
				if skipDirs[rel] || skipDirs[d.Name()] {
					return fs.SkipDir
				}
				return nil
			}
			fn(rel)
			return nil
		})
	}
	if err := collect(strings.TrimSuffix(tsRoot, "/"), func(rel string) {
		switch lower := strings.ToLower(rel); {
		case strings.HasSuffix(lower, ".d.ts"):
			t.DTS = append(t.DTS, rel)
		case strings.HasSuffix(lower, ".ts"):
			t.TS = append(t.TS, rel)
		}
	}); err != nil {
		return Tree{}, err
	}
	if err := collect(strings.TrimSuffix(goRoot, "/"), func(rel string) {
		switch lower := strings.ToLower(rel); {
		case strings.HasSuffix(lower, "_test.go"):
			t.GoTests = append(t.GoTests, rel)
		case strings.HasSuffix(lower, ".go"):
			t.Go = append(t.Go, rel)
		}
	}); err != nil {
		return Tree{}, err
	}
	sort.Strings(t.TS)
	sort.Strings(t.DTS)
	sort.Strings(t.Go)
	sort.Strings(t.GoTests)
	return t, nil
}

func CheckRepo(root string) (*Report, error) {
	t, err := WalkRepo(root)
	if err != nil {
		return nil, err
	}
	a, err := ParseAllowlistsFile(filepath.Join(root, "docs", "porting.md"))
	if err != nil {
		return nil, err
	}
	return Scan(t, a)
}
