// Package symcheck is the symbol-level correspondence gate. The file-level check
// in treecheck cannot see a missing function inside a file that is present, which
// is how one function survived four porting stages unnoticed.
package symcheck

import (
	"errors"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

const (
	tsRoot     = "source/ts/src/"
	goRoot     = "source/go/"
	tableTitle = "why it has no Go counterpart"
)

type TSSymbol struct {
	File string
	Name string
	Kind string
	Line int
}

type Entry struct {
	FilePattern string
	NamePattern string
	Reason      string
	Line        int
}

type Report struct {
	Checked int
	Matched int

	Missing  []TSSymbol
	Unused   []Entry
	Shadowed []struct {
		Sym   TSSymbol
		Entry Entry
	}

	Allowed []struct {
		Sym   TSSymbol
		Entry Entry
	}
}

func (r *Report) OK() bool { return len(r.Problems()) == 0 }

func (r *Report) Problems() []string {
	var out []string
	for _, s := range r.Missing {
		out = append(out, fmt.Sprintf(
			"%s:%d exports %s and the mirrored Go package declares nothing matching it. Port it, or add a `%s:%s` row to docs/symbols.md with its reason",
			s.File, s.Line, s.Name, strings.TrimPrefix(s.File, tsRoot), s.Name))
	}
	for _, e := range r.Unused {
		out = append(out, fmt.Sprintf(
			"docs/symbols.md:%d allowlists `%s:%s`, which matches no exported TypeScript value symbol. Delete the row",
			e.Line, e.FilePattern, e.NamePattern))
	}
	for _, s := range r.Shadowed {
		out = append(out, fmt.Sprintf(
			"docs/symbols.md:%d allowlists `%s:%s` as having no counterpart, but %s from %s has one. Delete the row",
			s.Entry.Line, s.Entry.FilePattern, s.Entry.NamePattern, s.Sym.Name, s.Sym.File))
	}
	return out
}

func Normalize(name string) string {
	return strings.ToLower(strings.ReplaceAll(name, "_", ""))
}

var (
	reBlockComment = regexp.MustCompile(`(?s)/\*.*?\*/`)
	reLineComment  = regexp.MustCompile(`(?m)^\s*//.*$`)
	reFunc         = regexp.MustCompile(`^export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)`)
	reConst        = regexp.MustCompile(`^export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)`)
	reClass        = regexp.MustCompile(`^export\s+(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)`)
	reEnum         = regexp.MustCompile(`^export\s+(?:const\s+)?enum\s+([A-Za-z0-9_$]+)`)
	reListOpen     = regexp.MustCompile(`^export\s*\{`)
)

func ExtractTSFile(repoRel string, src []byte) []TSSymbol {
	blank := func(m string) string {
		return strings.Map(func(r rune) rune {
			if r == '\n' {
				return '\n'
			}
			return ' '
		}, m)
	}
	text := reBlockComment.ReplaceAllStringFunc(string(src), blank)
	text = reLineComment.ReplaceAllStringFunc(text, blank)

	var out []TSSymbol
	seen := map[string]bool{}
	add := func(name, kind string, line int) {
		if name == "" || seen[name] {
			return
		}
		seen[name] = true
		out = append(out, TSSymbol{File: repoRel, Name: name, Kind: kind, Line: line})
	}

	lines := strings.Split(text, "\n")
	for i := 0; i < len(lines); i++ {
		ln := lines[i]
		if m := reFunc.FindStringSubmatch(ln); m != nil {
			add(m[1], "function", i+1)
			continue
		}
		if m := reEnum.FindStringSubmatch(ln); m != nil {
			add(m[1], "enum", i+1)
			continue
		}
		if m := reConst.FindStringSubmatch(ln); m != nil {
			add(m[1], "const", i+1)
			continue
		}
		if m := reClass.FindStringSubmatch(ln); m != nil {
			add(m[1], "class", i+1)
			continue
		}
		if reListOpen.MatchString(ln) && !strings.Contains(ln, "export type") {
			j := i
			var buf strings.Builder
			for ; j < len(lines); j++ {
				buf.WriteString(lines[j])
				buf.WriteString("\n")
				if strings.Contains(lines[j], "}") {
					break
				}
			}
			stmt := buf.String()
			open := strings.Index(stmt, "{")
			close := strings.Index(stmt, "}")
			if open < 0 || close < open {
				continue
			}
			if strings.Contains(stmt[close:], "from") {
				i = j
				continue
			}
			for _, n := range strings.Split(stmt[open+1:close], ",") {
				n = strings.TrimSpace(n)
				if n == "" || strings.HasPrefix(n, "type ") {
					continue
				}
				if k := strings.Index(n, " as "); k >= 0 {
					n = strings.TrimSpace(n[k+4:])
				}
				add(n, "export-list", i+1)
			}
			i = j
		}
	}
	return out
}

func GoPathFor(ts string) (string, bool) {
	if !strings.HasPrefix(ts, tsRoot) || !strings.HasSuffix(ts, ".ts") || strings.HasSuffix(ts, ".d.ts") {
		return "", false
	}
	rel := strings.TrimPrefix(ts, tsRoot)
	dir, base := path.Split(rel)
	base = strings.ToLower(strings.TrimSuffix(base, ".ts")) + ".go"
	// The shared types live at the module root rather than under internal/, so
	// that their fields and methods render on pkg.go.dev and a caller can
	// import them. Everything else is implementation and stays internal.
	if dir == "types/" {
		return path.Join(goRoot, dir, base), true
	}
	return path.Join(goRoot+"internal", dir, base), true
}

func GoDeclNames(dir string) (map[string]bool, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	names := map[string]bool{}
	fset := token.NewFileSet()
	for _, e := range entries {
		n := e.Name()
		if e.IsDir() || !strings.HasSuffix(n, ".go") || strings.HasSuffix(n, "_test.go") {
			continue
		}
		f, perr := parser.ParseFile(fset, filepath.Join(dir, n), nil, 0)
		if perr != nil {
			return nil, perr
		}
		for _, decl := range f.Decls {
			switch d := decl.(type) {
			case *ast.FuncDecl:
				names[Normalize(d.Name.Name)] = true
			case *ast.GenDecl:
				for _, spec := range d.Specs {
					switch sp := spec.(type) {
					case *ast.TypeSpec:
						names[Normalize(sp.Name.Name)] = true
					case *ast.ValueSpec:
						for _, id := range sp.Names {
							names[Normalize(id.Name)] = true
						}
					}
				}
			}
		}
	}
	return names, nil
}

func ParseAllowlist(md []byte) ([]Entry, error) {
	lines := strings.Split(string(md), "\n")
	start := -1
	for i, ln := range lines {
		cells, ok := tableCells(ln)
		if !ok || len(cells) < 2 {
			continue
		}
		if cells[1] == tableTitle {
			if start >= 0 {
				return nil, fmt.Errorf("symcheck: two tables titled %q (lines %d and %d)", tableTitle, start+1, i+1)
			}
			start = i
		}
	}
	if start < 0 {
		return nil, fmt.Errorf("symcheck: no table titled %q found", tableTitle)
	}
	if start+1 >= len(lines) || !isSeparatorRow(lines[start+1]) {
		return nil, fmt.Errorf("symcheck: table at line %d is not followed by a separator row", start+1)
	}
	var out []Entry
	for i := start + 2; i < len(lines); i++ {
		cells, ok := tableCells(lines[i])
		if !ok {
			break
		}
		if len(cells) != 2 {
			return nil, fmt.Errorf("symcheck: docs/symbols.md:%d has %d cells, want 2", i+1, len(cells))
		}
		pat, err := backtickedSpan(cells[0])
		if err != nil {
			return nil, fmt.Errorf("symcheck: docs/symbols.md:%d: %w", i+1, err)
		}
		colon := strings.LastIndex(pat, ":")
		if colon <= 0 || colon == len(pat)-1 {
			return nil, fmt.Errorf("symcheck: docs/symbols.md:%d: %q is not `filepattern:namepattern`", i+1, pat)
		}
		reason := strings.TrimSpace(cells[1])
		if reason == "" {
			return nil, fmt.Errorf("symcheck: docs/symbols.md:%d: `%s` has no reason", i+1, pat)
		}
		out = append(out, Entry{
			FilePattern: pat[:colon],
			NamePattern: pat[colon+1:],
			Reason:      reason,
			Line:        i + 1,
		})
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("symcheck: table at line %d has no rows", start+1)
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

func backtickedSpan(cell string) (string, error) {
	i := strings.Index(cell, "`")
	if i < 0 {
		return "", errors.New("the symbol cell has no `backticked` pattern")
	}
	j := strings.Index(cell[i+1:], "`")
	if j < 0 {
		return "", errors.New("unterminated ` in the symbol cell")
	}
	rest := cell[i+2+j:]
	if strings.Contains(rest, "`") {
		return "", errors.New("the symbol cell has more than one backticked span, want exactly 1")
	}
	return cell[i+1 : i+1+j], nil
}

func (e Entry) matches(s TSSymbol) bool {
	rel := strings.TrimPrefix(s.File, tsRoot)
	if !matchSegments(strings.Split(e.FilePattern, "/"), strings.Split(rel, "/")) {
		return false
	}
	ok, err := path.Match(e.NamePattern, s.Name)
	return err == nil && ok
}

func (e Entry) literal() bool {
	return !strings.ContainsAny(e.FilePattern+e.NamePattern, "*?[")
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

func Scan(syms []TSSymbol, declsFor map[string]map[string]bool, allow []Entry) (*Report, error) {
	if len(syms) == 0 {
		return nil, errors.New("symcheck: no TypeScript value symbols in the census (extraction found nothing, so every check below would pass vacuously)")
	}
	if len(allow) == 0 {
		return nil, errors.New("symcheck: the allowlist parsed empty (docs/symbols.md was not found or has no rows)")
	}
	r := &Report{}
	used := make([]bool, len(allow))
	for _, s := range syms {
		goFile, ok := GoPathFor(s.File)
		if !ok {
			continue
		}
		pkgDir := path.Dir(goFile)
		decls := declsFor[pkgDir]
		if decls == nil {
			continue
		}
		r.Checked++
		ai := -1
		for i, e := range allow {
			if e.matches(s) {
				ai = i
				break
			}
		}
		if decls[Normalize(s.Name)] {
			r.Matched++
			if ai >= 0 {
				used[ai] = true
				if allow[ai].literal() {
					r.Shadowed = append(r.Shadowed, struct {
						Sym   TSSymbol
						Entry Entry
					}{s, allow[ai]})
				}
			}
			continue
		}
		if ai >= 0 {
			used[ai] = true
			r.Allowed = append(r.Allowed, struct {
				Sym   TSSymbol
				Entry Entry
			}{s, allow[ai]})
			continue
		}
		r.Missing = append(r.Missing, s)
	}
	for i, u := range used {
		if !u {
			r.Unused = append(r.Unused, allow[i])
		}
	}
	sort.Slice(r.Missing, func(i, j int) bool {
		if r.Missing[i].File != r.Missing[j].File {
			return r.Missing[i].File < r.Missing[j].File
		}
		return r.Missing[i].Name < r.Missing[j].Name
	})
	return r, nil
}

func CheckRepo(root string) (*Report, error) {
	var syms []TSSymbol
	pkgDirs := map[string]bool{}
	err := filepath.WalkDir(filepath.Join(root, "source", "ts", "src"), func(p string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		if !strings.HasSuffix(p, ".ts") || strings.HasSuffix(p, ".d.ts") {
			return nil
		}
		rel, rerr := filepath.Rel(root, p)
		if rerr != nil {
			return rerr
		}
		rel = filepath.ToSlash(rel)
		goFile, ok := GoPathFor(rel)
		if !ok {
			return nil
		}
		if _, serr := os.Stat(filepath.Join(root, filepath.FromSlash(goFile))); serr != nil {
			return nil
		}
		src, rerr2 := os.ReadFile(p)
		if rerr2 != nil {
			return rerr2
		}
		syms = append(syms, ExtractTSFile(rel, src)...)
		pkgDirs[path.Dir(goFile)] = true
		return nil
	})
	if err != nil {
		return nil, err
	}
	declsFor := map[string]map[string]bool{}
	for dir := range pkgDirs {
		names, derr := GoDeclNames(filepath.Join(root, filepath.FromSlash(dir)))
		if derr != nil {
			return nil, derr
		}
		declsFor[dir] = names
	}
	allow, err := ParseAllowlistFile(filepath.Join(root, "docs", "symbols.md"))
	if err != nil {
		return nil, err
	}
	return Scan(syms, declsFor, allow)
}

func ParseAllowlistFile(p string) ([]Entry, error) {
	b, err := os.ReadFile(p)
	if err != nil {
		return nil, err
	}
	a, err := ParseAllowlist(b)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", p, err)
	}
	return a, nil
}
