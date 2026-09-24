package treecheck

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
)

func TestTreeCorrespondence(t *testing.T) {
	r, err := CheckRepo(repopath.Root())
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range r.Problems() {
		t.Error(p)
	}
	t.Logf("%d src/↔go/ pairs · %d Go files exempt · %d TypeScript files exempt",
		len(r.Pairs), len(r.AllowedGo), len(r.AllowedTS))
}

func TestTreeCensusIsPinned(t *testing.T) {
	const (
		wantTS        = 119
		wantDTS       = 1
		wantGo        = 153
		wantGoTests   = 85
		wantPairs     = 117
		wantAllowedTS = 2
		wantAllowedGo = 36
	)

	r, err := CheckRepo(repopath.Root())
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range []struct {
		name string
		got  int
		want int
	}{
		{"source/ts/src/**/*.ts", len(r.Tree.TS), wantTS},
		{"source/ts/src/**/*.d.ts", len(r.Tree.DTS), wantDTS},
		{"source/go/**/*.go", len(r.Tree.Go), wantGo},
		{"source/go/**/*_test.go", len(r.Tree.GoTests), wantGoTests},
		{"pairs", len(r.Pairs), wantPairs},
		{"TypeScript files exempt", len(r.AllowedTS), wantAllowedTS},
		{"Go files exempt", len(r.AllowedGo), wantAllowedGo},
	} {
		if c.got != c.want {
			t.Errorf("%s: %d, want %d", c.name, c.got, c.want)
		}
	}
	if len(r.Pairs)+len(r.AllowedGo) != len(r.Tree.Go) {
		t.Errorf("%d pairs + %d exempt != %d Go files", len(r.Pairs), len(r.AllowedGo), len(r.Tree.Go))
	}
	if len(r.Pairs)+len(r.AllowedTS) != len(r.Tree.TS) {
		t.Errorf("%d pairs + %d exempt != %d TypeScript files", len(r.Pairs), len(r.AllowedTS), len(r.Tree.TS))
	}
}

func TestGeneratorRidesOneGlobRow(t *testing.T) {
	r, err := CheckRepo(repopath.Root())
	if err != nil {
		t.Fatal(err)
	}
	var gen []string
	for _, a := range r.AllowedGo {
		if strings.HasPrefix(a.Path, "source/go/internal/gen/") {
			if a.Entry.Pattern != "source/go/internal/gen/*.go" {
				t.Errorf("%s is exempted by %q, want the glob row", a.Path, a.Entry.Pattern)
			}
			gen = append(gen, a.Path)
		}
	}
	if len(gen) < 2 {
		t.Fatalf("the glob row matched %d files (%v); it exists to cover a whole directory", len(gen), gen)
	}
	t.Logf("one row covers %d generator files: %s", len(gen), strings.Join(gen, " "))
}

func TestGoPathFor(t *testing.T) {
	for _, c := range []struct{ ts, want string }{
		{"source/ts/src/core/panchang.ts", "source/go/internal/core/panchang.go"},
		{"source/ts/src/jyotish/kpSubLord.ts", "source/go/internal/jyotish/kpsublord.go"},
		{"source/ts/src/astronomy/series/moonSeries.ts", "source/go/internal/astronomy/series/moonseries.go"},
		{"source/ts/src/muhurta/rules/index.ts", "source/go/internal/muhurta/rules/index.go"},
		{"source/ts/src/types/jyotish.ts", "source/go/types/jyotish.go"},
	} {
		got, err := GoPathFor(c.ts)
		if err != nil {
			t.Errorf("%s: %v", c.ts, err)
			continue
		}
		if got != c.want {
			t.Errorf("%s -> %s, want %s", c.ts, got, c.want)
		}
	}
	for _, bad := range []string{"source/ts/tests/unit/foo.ts", "source/go/parity/dump.src.ts", "source/ts/src/global.d.ts", "source/ts/src/core/panchang.js"} {
		if _, err := GoPathFor(bad); err == nil {
			t.Errorf("%s: want an error", bad)
		}
	}
}

func TestMatchPattern(t *testing.T) {
	for _, c := range []struct {
		pattern, path string
		want          bool
	}{
		{"source/go/internal/store/store.go", "source/go/internal/store/store.go", true},
		{"source/go/internal/store/store.go", "source/go/internal/store/other.go", false},
		{"source/go/internal/gen/*.go", "source/go/internal/gen/registry.go", true},
		{"source/go/internal/gen/*.go", "source/go/internal/gen/sub/registry.go", false},
		{"source/go/internal/gen/*.go", "source/go/internal/gen/notes.md", false},
		{"source/go/parity/**", "source/go/parity/x.go", true},
		{"source/go/parity/**", "source/go/parity/a/b/c.go", true},
		{"source/go/parity/**", "source/go/parityx/a.go", false},
		{"source/go/**", "source/go/a.go", true},
		{"source/go/**/main.go", "source/go/internal/cmd/dump/main.go", true},
		{"source/go/**/main.go", "source/go/main.go", true},
		{"source/go/**/main.go", "source/go/internal/cmd/dump/other.go", false},
	} {
		if got := MatchPattern(c.pattern, c.path); got != c.want {
			t.Errorf("MatchPattern(%q, %q) = %v, want %v", c.pattern, c.path, got, c.want)
		}
	}
}

func fixture() (Tree, Allowlists) {
	return Tree{
			TS: []string{"source/ts/src/core/panchang.ts", "source/ts/src/index.ts", "source/ts/src/jyotish/kpSubLord.ts"},
			Go: []string{"source/go/internal/core/panchang.go", "source/go/internal/jyotish/kpsublord.go", "source/go/internal/store/store.go"},
		}, Allowlists{
			GoOnly: []Entry{{Pattern: "source/go/internal/store/store.go", Reason: "D19 class D", Line: 1}},
			TSOnly: []Entry{{Pattern: "source/ts/src/index.ts", Reason: "barrel", Line: 2}},
		}
}

func mustScan(t *testing.T, tr Tree, a Allowlists) *Report {
	t.Helper()
	r, err := Scan(tr, a)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func TestFixtureIsClean(t *testing.T) {
	tr, a := fixture()
	r := mustScan(t, tr, a)
	if !r.OK() {
		t.Fatalf("the clean fixture reports problems: %v", r.Problems())
	}
	if len(r.Pairs) != 2 {
		t.Errorf("pairs = %d, want 2", len(r.Pairs))
	}
}

func TestScanReportsAMissingGoCounterpart(t *testing.T) {
	tr, a := fixture()
	tr.TS = append(tr.TS, "source/ts/src/core/newThing.ts")
	sort.Strings(tr.TS)

	r := mustScan(t, tr, a)
	if len(r.MissingGo) != 1 || r.MissingGo[0].Go != "source/go/internal/core/newthing.go" {
		t.Fatalf("MissingGo = %+v, want the one mapped path", r.MissingGo)
	}
	assertProblemMentions(t, r, "source/ts/src/core/newThing.ts", "source/go/internal/core/newthing.go")
}

func TestScanReportsAnUnallowedGoFile(t *testing.T) {
	tr, a := fixture()
	tr.Go = append(tr.Go, "source/go/internal/core/invented.go")
	sort.Strings(tr.Go)

	r := mustScan(t, tr, a)
	if len(r.Unallowed) != 1 || r.Unallowed[0] != "source/go/internal/core/invented.go" {
		t.Fatalf("Unallowed = %v, want the one new file", r.Unallowed)
	}
	assertProblemMentions(t, r, "source/go/internal/core/invented.go", "docs/porting.md")
}

func TestScanReportsAnUnusedGoRow(t *testing.T) {
	tr, a := fixture()
	tr.Go = tr.Go[:2]

	r := mustScan(t, tr, a)
	if len(r.UnusedGo) != 1 || r.UnusedGo[0].Pattern != "source/go/internal/store/store.go" {
		t.Fatalf("UnusedGo = %+v, want the orphaned row", r.UnusedGo)
	}
	assertProblemMentions(t, r, "docs/porting.md:1", "matches no Go file")
}

func TestScanReportsAnUnusedTSRow(t *testing.T) {
	tr, a := fixture()
	a.TSOnly = append(a.TSOnly, Entry{Pattern: "source/ts/src/types/index.ts", Reason: "barrel", Line: 3})

	r := mustScan(t, tr, a)
	if len(r.UnusedTS) != 1 || r.UnusedTS[0].Pattern != "source/ts/src/types/index.ts" {
		t.Fatalf("UnusedTS = %+v, want the row with no file", r.UnusedTS)
	}
	assertProblemMentions(t, r, "docs/porting.md:3", "matches no TypeScript file")
}

func TestScanReportsACaseCollision(t *testing.T) {
	tr, a := fixture()
	tr.TS = append(tr.TS, "source/ts/src/jyotish/kpsublord.ts")
	sort.Strings(tr.TS)

	r := mustScan(t, tr, a)
	if len(r.Collisions) != 1 {
		t.Fatalf("Collisions = %+v, want 1", r.Collisions)
	}
	c := r.Collisions[0]
	if c.Go != "source/go/internal/jyotish/kpsublord.go" || len(c.TS) != 2 {
		t.Fatalf("collision = %+v, want both spellings on one Go path", c)
	}
	assertProblemMentions(t, r, "differ only in case")
}

func TestScanReportsAShadowedRow(t *testing.T) {
	tr, a := fixture()
	a.GoOnly = append(a.GoOnly, Entry{Pattern: "source/go/internal/core/panchang.go", Reason: "wrong", Line: 9})

	r := mustScan(t, tr, a)
	if len(r.Shadowed) != 1 || r.Shadowed[0].Path != "source/go/internal/core/panchang.go" {
		t.Fatalf("Shadowed = %+v, want the untrue row", r.Shadowed)
	}
	assertProblemMentions(t, r, "docs/porting.md:9", "does have one")
}

func TestScanReportsAShadowedBarrel(t *testing.T) {
	tr, a := fixture()
	tr.Go = append(tr.Go, "source/go/internal/index.go")
	sort.Strings(tr.Go)
	a.GoOnly = append(a.GoOnly, Entry{Pattern: "source/go/internal/index.go", Reason: "would be wrong too", Line: 7})

	r := mustScan(t, tr, a)
	if len(r.Shadowed) != 2 {
		t.Fatalf("Shadowed = %+v, want both rows", r.Shadowed)
	}
	if len(r.Pairs) != 3 {
		t.Errorf("pairs = %d, want 3: the ported barrel is a pair", len(r.Pairs))
	}
	if len(r.AllowedTS) != 0 || len(r.UnusedTS) != 0 {
		t.Errorf("allowedTS=%d unusedTS=%d, want 0/0", len(r.AllowedTS), len(r.UnusedTS))
	}
	assertProblemMentions(t, r, "source/ts/src/index.ts", "source/go/internal/index.go", "does have one")
}

func TestScanRefusesAnEmptyCensus(t *testing.T) {
	tr, a := fixture()
	for _, c := range []struct {
		name string
		mut  func(*Tree, *Allowlists)
	}{
		{"no TypeScript", func(t *Tree, _ *Allowlists) { t.TS = nil }},
		{"no Go", func(t *Tree, _ *Allowlists) { t.Go = nil }},
		{"no GoOnly rows", func(_ *Tree, a *Allowlists) { a.GoOnly = nil }},
		{"no TSOnly rows", func(_ *Tree, a *Allowlists) { a.TSOnly = nil }},
	} {
		tt, aa := tr, a
		c.mut(&tt, &aa)
		if _, err := Scan(tt, aa); err == nil {
			t.Errorf("%s: Scan returned no error", c.name)
		}
	}
}

func assertProblemMentions(t *testing.T, r *Report, subs ...string) {
	t.Helper()
	if r.OK() {
		t.Fatal("Report.OK() is true, want a problem")
	}
	all := strings.Join(r.Problems(), "\n")
	for _, s := range subs {
		if !strings.Contains(all, s) {
			t.Errorf("no problem line mentions %q; got:\n%s", s, all)
		}
	}
}

func table(title string, rows ...string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "some prose\n\n| file | %s |\n|---|---|\n", title)
	for _, r := range rows {
		fmt.Fprintf(&b, "%s\n", r)
	}
	b.WriteString("\nmore prose\n")
	return b.String()
}

func bothTables(goRows, tsRows []string) []byte {
	return []byte(table(titleGoOnly, goRows...) + table(titleTSOnly, tsRows...))
}

func TestParseAllowlistsReadsBothTables(t *testing.T) {
	md := bothTables(
		[]string{"| `internal/store/store.go` | D19 class D |", "| `source/go/internal/cmd/dump/main.go` | the harness |"},
		[]string{"| `source/ts/src/index.ts` | a barrel |"},
	)
	a, err := ParseAllowlists(md)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"source/go/internal/store/store.go", "source/go/internal/cmd/dump/main.go"}
	for i, e := range a.GoOnly {
		if e.Pattern != want[i] {
			t.Errorf("GoOnly[%d] = %q, want %q", i, e.Pattern, want[i])
		}
	}
	if len(a.TSOnly) != 1 || a.TSOnly[0].Pattern != "source/ts/src/index.ts" {
		t.Errorf("TSOnly = %+v", a.TSOnly)
	}
	if a.GoOnly[0].Reason != "D19 class D" {
		t.Errorf("reason = %q", a.GoOnly[0].Reason)
	}
	if a.GoOnly[0].Line != 5 {
		t.Errorf("line = %d, want 5", a.GoOnly[0].Line)
	}
}

func TestParseAllowlistsHandlesEscapedPipes(t *testing.T) {
	md := bothTables(
		[]string{`| ` + "`internal/types/timezone.go`" + ` | the ` + "`number \\| string`" + ` union |`},
		[]string{"| `source/ts/src/index.ts` | a barrel |"},
	)
	a, err := ParseAllowlists(md)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := a.GoOnly[0].Reason, "the `number | string` union"; got != want {
		t.Errorf("reason = %q, want %q", got, want)
	}
}

func TestParseAllowlistsRejects(t *testing.T) {
	good := "| `internal/store/store.go` | D19 class D |"
	barrel := "| `source/ts/src/index.ts` | a barrel |"
	for _, c := range []struct{ name, md, want string }{
		{"no GoOnly table", table(titleTSOnly, barrel), "no table titled"},
		{"no TSOnly table", table(titleGoOnly, good), "no table titled"},
		{"a duplicated title", table(titleGoOnly, good) + table(titleGoOnly, good) + table(titleTSOnly, barrel), "two tables titled"},
		{"no reason", string(bothTables([]string{"| `internal/store/store.go` |  |"}, []string{barrel})), "has no reason"},
		{"no backticked path", string(bothTables([]string{"| internal/store/store.go | D19 |"}, []string{barrel})), "no `backticked` path"},
		{"two backticked paths", string(bothTables([]string{"| `a.go` and `b.go` | D19 |"}, []string{barrel})), "want exactly 1"},
		{"three cells", string(bothTables([]string{"| `a.go` | D19 | extra |"}, []string{barrel})), "want 2"},
		{"an empty table", string(bothTables([]string{}, []string{barrel})), "has no rows"},
		{"a TSOnly row outside the TypeScript root", string(bothTables([]string{good}, []string{"| `source/ts/tests/foo.ts` | nope |"})), "is not under source/ts/src/"},
	} {
		_, err := ParseAllowlists([]byte(c.md))
		if err == nil {
			t.Errorf("%s: no error", c.name)
			continue
		}
		if !strings.Contains(err.Error(), c.want) {
			t.Errorf("%s: error %q does not mention %q", c.name, err, c.want)
		}
	}
}

func TestParseAllowlistsMissingSeparator(t *testing.T) {
	md := "| file | " + titleGoOnly + " |\n| `a.go` | why |\n"
	if _, err := ParseAllowlists([]byte(md)); err == nil || !strings.Contains(err.Error(), "separator") {
		t.Errorf("error = %v, want the separator complaint", err)
	}
}

func TestPortingMDParses(t *testing.T) {
	a, err := ParseAllowlistsFile(repopath.Doc("porting.md"))
	if err != nil {
		t.Fatal(err)
	}
	if len(a.GoOnly) != 30 {
		t.Errorf("§3 GoOnly rows = %d, want 30", len(a.GoOnly))
	}
	if len(a.TSOnly) != 2 {
		t.Errorf("§3 TSOnly rows = %d, want 2", len(a.TSOnly))
	}
	for _, e := range a.GoOnly {
		if !strings.HasPrefix(e.Pattern, goRoot) {
			t.Errorf("GoOnly pattern %q is not repo-relative", e.Pattern)
		}
	}
	for _, e := range a.TSOnly {
		if !strings.HasPrefix(e.Pattern, tsRoot) {
			t.Errorf("TSOnly pattern %q is not repo-relative", e.Pattern)
		}
	}
}

func TestCheckRepoOnASyntheticTree(t *testing.T) {
	const porting = "prose\n\n" +
		"| file | " + titleGoOnly + " |\n|---|---|\n" +
		"| `internal/store/store.go` | D19 class D |\n\n" +
		"more prose\n\n" +
		"| file | " + titleTSOnly + " |\n|---|---|\n" +
		"| `source/ts/src/index.ts` | a barrel |\n"

	build := func(t *testing.T, extra map[string]string) string {
		t.Helper()
		root := t.TempDir()
		files := map[string]string{
			"source/ts/src/index.ts":                   "export {};\n",
			"source/ts/src/global.d.ts":                "declare const x: number;\n",
			"source/ts/src/core/panchang.ts":           "export const a = 1;\n",
			"source/ts/src/jyotish/kpSubLord.ts":       "export const b = 2;\n",
			"docs/porting.md":                          porting,
			"source/go/internal/core/panchang.go":      "package core\n",
			"source/go/internal/jyotish/kpsublord.go":  "package jyotish\n",
			"source/go/internal/store/store.go":        "package store\n",
			"source/go/internal/core/panchang_test.go": "package core\n",
			"source/go/parity/dump.src.ts":             "export {};\n",
			"source/go/parity/out/stray.go":            "package nope\n",
		}
		for p, body := range extra {
			files[p] = body
		}
		for p, body := range files {
			full := filepath.Join(root, filepath.FromSlash(p))
			if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
				t.Fatal(err)
			}
		}
		return root
	}

	t.Run("clean", func(t *testing.T) {
		r, err := CheckRepo(build(t, nil))
		if err != nil {
			t.Fatal(err)
		}
		if !r.OK() {
			t.Fatalf("problems on a correct tree: %v", r.Problems())
		}
		if len(r.Pairs) != 2 || len(r.AllowedGo) != 1 || len(r.AllowedTS) != 1 {
			t.Errorf("pairs=%d allowedGo=%d allowedTS=%d, want 2/1/1", len(r.Pairs), len(r.AllowedGo), len(r.AllowedTS))
		}
		if len(r.Tree.DTS) != 1 || len(r.Tree.GoTests) != 1 {
			t.Errorf("d.ts=%d _test.go=%d, want 1/1", len(r.Tree.DTS), len(r.Tree.GoTests))
		}
		for _, ts := range r.Tree.TS {
			if strings.HasPrefix(ts, goRoot) {
				t.Errorf("%s reached the TypeScript census", ts)
			}
		}
		for _, g := range r.Tree.Go {
			if strings.HasPrefix(g, "source/go/parity/out/") {
				t.Errorf("%s reached the Go census; go/parity/out is generated", g)
			}
		}
	})

	t.Run("an unported src file", func(t *testing.T) {
		r, err := CheckRepo(build(t, map[string]string{"source/ts/src/core/masaSystem.ts": "export const c = 3;\n"}))
		if err != nil {
			t.Fatal(err)
		}
		assertProblemMentions(t, r, "source/ts/src/core/masaSystem.ts", "source/go/internal/core/masasystem.go")
	})

	t.Run("an unjustified go file", func(t *testing.T) {
		r, err := CheckRepo(build(t, map[string]string{"source/go/internal/core/invented.go": "package core\n"}))
		if err != nil {
			t.Fatal(err)
		}
		assertProblemMentions(t, r, "source/go/internal/core/invented.go", "docs/porting.md §3")
	})

	t.Run("a malformed docs/porting.md", func(t *testing.T) {
		root := build(t, map[string]string{"docs/porting.md": "no tables here\n"})
		if _, err := CheckRepo(root); err == nil {
			t.Fatal("no error; a document the parser cannot read must not score as clean")
		}
	})
}
