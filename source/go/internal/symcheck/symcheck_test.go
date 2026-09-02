package symcheck

import (
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
)

func TestSymbolCorrespondence(t *testing.T) {
	r, err := CheckRepo(repopath.Root())
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range r.Problems() {
		t.Error(p)
	}
	t.Logf("checked %d symbols: %d matched, %d allowlisted", r.Checked, r.Matched, len(r.Allowed))
}

func TestSymbolCensusIsPinned(t *testing.T) {
	r, err := CheckRepo(repopath.Root())
	if err != nil {
		t.Fatal(err)
	}
	const (
		wantChecked = 441
		wantMatched = 413
		wantAllowed = 28
	)
	if r.Checked != wantChecked {
		t.Errorf("checked = %d, want %d", r.Checked, wantChecked)
	}
	if r.Matched != wantMatched {
		t.Errorf("matched = %d, want %d", r.Matched, wantMatched)
	}
	if len(r.Allowed) != wantAllowed {
		t.Errorf("allowed = %d, want %d", len(r.Allowed), wantAllowed)
	}
	if r.Checked != r.Matched+len(r.Allowed)+len(r.Missing) {
		t.Errorf("census identity broken: %d != %d+%d+%d",
			r.Checked, r.Matched, len(r.Allowed), len(r.Missing))
	}
}

func TestExtractTSFile(t *testing.T) {
	src := `
export function computeFoo(a: number): number { return a }
export function computeFoo(a: string): string  // overload collapses
export async function fetchBar(): Promise<void> {}
export const TABLE_A = [1, 2]
export let mutable = 3
export class Widget {}
export enum Color { Red }
export interface Skipped {}
export type AlsoSkipped = string
export type { TypeOnly } from './x'
export { localA, localB as renamedB }
export { reExported } from './other'
function notExported() {}
`
	syms := ExtractTSFile("source/ts/src/core/foo.ts", []byte(src))
	got := map[string]string{}
	for _, s := range syms {
		got[s.Name] = s.Kind
	}
	want := map[string]string{
		"computeFoo": "function", "fetchBar": "function",
		"TABLE_A": "const", "mutable": "const",
		"Widget": "class", "Color": "enum",
		"localA": "export-list", "renamedB": "export-list",
	}
	for n, k := range want {
		if got[n] != k {
			t.Errorf("%s: got kind %q, want %q", n, got[n], k)
		}
	}
	for n := range got {
		if _, ok := want[n]; !ok {
			t.Errorf("extracted %s, which should have been skipped", n)
		}
	}
}

func TestNormalize(t *testing.T) {
	for _, c := range [][2]string{
		{"AMRIT_SIDDHI_TABLE", "amritsiddhitable"},
		{"amritSiddhiTable", "amritsiddhitable"},
		{"ttDaysSinceJ2000", "ttdayssincej2000"},
		{"TTDaysSinceJ2000", "ttdayssincej2000"},
		{"__resetRegionAliasWarnings", "resetregionaliaswarnings"},
	} {
		if got := Normalize(c[0]); got != c[1] {
			t.Errorf("Normalize(%q) = %q, want %q", c[0], got, c[1])
		}
	}
}

func TestGoPathFor(t *testing.T) {
	g, ok := GoPathFor("source/ts/src/jyotish/kpSubLord.ts")
	if !ok || g != "source/go/internal/jyotish/kpsublord.go" {
		t.Errorf("got %q, %v", g, ok)
	}
	if _, ok := GoPathFor("source/ts/src/global.d.ts"); ok {
		t.Error("a .d.ts must not map")
	}
	if _, ok := GoPathFor("source/go/parity/dump.src.ts"); ok {
		t.Error("a file outside the TS root must not map")
	}
}

func synAllow() []Entry {
	return []Entry{{FilePattern: "core/allowed.ts", NamePattern: "legacyAlias", Reason: "r", Line: 1}}
}

func TestScanFindsAMissingSymbol(t *testing.T) {
	syms := []TSSymbol{
		{File: "source/ts/src/core/varjyam.ts", Name: "computeVarjyamWindows", Kind: "function"},
		{File: "source/ts/src/core/varjyam.ts", Name: "computeVarjyam", Kind: "function"},
	}
	decls := map[string]map[string]bool{
		"source/go/internal/core": {"computevarjyamwindows": true},
	}
	r, err := Scan(syms, decls, synAllow())
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Missing) != 1 || r.Missing[0].Name != "computeVarjyam" {
		t.Fatalf("Missing = %+v, want exactly computeVarjyam", r.Missing)
	}
	if got := len(r.Problems()); got != 2 {
		t.Errorf("Problems() = %d lines, want 2 (missing + unused row):\n%s",
			got, strings.Join(r.Problems(), "\n"))
	}
}

func TestScanAcceptsUnexportedAndRenamedDecls(t *testing.T) {
	syms := []TSSymbol{
		{File: "source/ts/src/core/t.ts", Name: "AMRIT_SIDDHI_TABLE", Kind: "const"},
		{File: "source/ts/src/core/t.ts", Name: "computeThing", Kind: "function"},
	}
	decls := map[string]map[string]bool{
		"source/go/internal/core": {"amritsiddhitable": true, "computething": true},
	}
	r, err := Scan(syms, decls, synAllow())
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Missing) != 0 || r.Matched != 2 {
		t.Errorf("Matched=%d Missing=%v", r.Matched, r.Missing)
	}
}

func TestScanReportsUnusedAndShadowedRows(t *testing.T) {
	syms := []TSSymbol{
		{File: "source/ts/src/core/allowed.ts", Name: "legacyAlias", Kind: "const"},
	}
	decls := map[string]map[string]bool{
		"source/go/internal/core": {"legacyalias": true},
	}
	r, err := Scan(syms, decls, synAllow())
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Shadowed) != 1 {
		t.Errorf("Shadowed = %+v, want 1", r.Shadowed)
	}
	if len(r.Unused) != 0 {
		t.Errorf("a shadowed row is used, not unused: %+v", r.Unused)
	}
}

func TestScanRefusesAnEmptyCensus(t *testing.T) {
	if _, err := Scan(nil, nil, synAllow()); err == nil {
		t.Error("an empty symbol census must be an error, not a pass")
	}
	if _, err := Scan([]TSSymbol{{File: "source/ts/src/a.ts", Name: "x"}}, nil, nil); err == nil {
		t.Error("an empty allowlist must be an error, not a pass")
	}
}

func TestParseAllowlist(t *testing.T) {
	md := []byte("intro prose\n\n| symbol | why it has no Go counterpart |\n|---|---|\n" +
		"| `**:_*ForTest` | test idiom |\n" +
		"| `calendar/yearly.ts:getFestivalsInRange` | deprecated alias |\n")
	a, err := ParseAllowlist(md)
	if err != nil {
		t.Fatal(err)
	}
	if len(a) != 2 || a[0].FilePattern != "**" || a[0].NamePattern != "_*ForTest" ||
		a[1].FilePattern != "calendar/yearly.ts" || a[1].NamePattern != "getFestivalsInRange" {
		t.Errorf("parsed %+v", a)
	}
}

func TestParseAllowlistRejectsBadInput(t *testing.T) {
	for name, md := range map[string]string{
		"no table":     "just prose",
		"no separator": "| symbol | why it has no Go counterpart |\n| `a.ts:b` | r |",
		"no colon":     "| symbol | why it has no Go counterpart |\n|---|---|\n| `aWholeName` | r |",
		"no reason":    "| symbol | why it has no Go counterpart |\n|---|---|\n| `a.ts:b` | |",
		"no backticks": "| symbol | why it has no Go counterpart |\n|---|---|\n| a.ts:b | r |",
		"two spans":    "| symbol | why it has no Go counterpart |\n|---|---|\n| `a.ts:b` and `c.ts:d` | r |",
		"three cells":  "| symbol | why it has no Go counterpart |\n|---|---|\n| `a.ts:b` | r | extra |",
		"no rows":      "| symbol | why it has no Go counterpart |\n|---|---|\n",
		"twin tables":  "| s | why it has no Go counterpart |\n|---|---|\n| `a.ts:b` | r |\n\n| s | why it has no Go counterpart |\n|---|---|\n| `c.ts:d` | r |",
	} {
		if _, err := ParseAllowlist([]byte(md)); err == nil {
			t.Errorf("%s: parsed without error", name)
		}
	}
}

func TestEntryMatching(t *testing.T) {
	forTest := Entry{FilePattern: "**", NamePattern: "_*ForTest"}
	if !forTest.matches(TSSymbol{File: "source/ts/src/jyotish/charts.ts", Name: "_navamsaLongitudeForTest"}) {
		t.Error("** glob should match any mirrored file")
	}
	if forTest.matches(TSSymbol{File: "source/ts/src/jyotish/charts.ts", Name: "computeNavamsa"}) {
		t.Error("name glob must still gate")
	}
	lit := Entry{FilePattern: "calendar/yearly.ts", NamePattern: "getFestivalsInRange"}
	if lit.matches(TSSymbol{File: "source/ts/src/calendar/festivalsTable.ts", Name: "getFestivalsInRange"}) {
		t.Error("a literal file pattern must not match a different file")
	}
}
