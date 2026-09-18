// Command treecheck reports the TypeScript-to-Go tree correspondence, so CI and a
// human get the same output without running the test suite.
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/treecheck"
)

func main() {
	root := flag.String("repo", repopath.Root(), "repository root holding src/ and go/")
	verbose := flag.Bool("v", false, "list every pair and every allowlisted file")
	flag.Parse()

	r, err := treecheck.CheckRepo(*root)
	if err != nil {
		fmt.Fprintln(os.Stderr, "treecheck: cannot run:", err)
		os.Exit(2)
	}

	if *verbose {
		for _, p := range r.Pairs {
			fmt.Printf("  pair      %-44s  %s\n", p.TS, p.Go)
		}
		for _, a := range r.AllowedTS {
			fmt.Printf("  exempt    %-44s  %s\n", a.Path, a.Entry.Reason)
		}
		for _, a := range r.AllowedGo {
			fmt.Printf("  exempt    %-44s  %s\n", a.Path, a.Entry.Reason)
		}
		fmt.Println()
	}

	fmt.Printf("%d pairs · %d Go files exempt · %d TypeScript files exempt · "+
		"%d src/*.ts · %d go/*.go (+%d _test.go) · %d *.d.ts excluded\n",
		len(r.Pairs), len(r.AllowedGo), len(r.AllowedTS),
		len(r.Tree.TS), len(r.Tree.Go), len(r.Tree.GoTests), len(r.Tree.DTS))

	problems := r.Problems()
	if len(problems) == 0 {
		fmt.Println("tree correspondence: OK")
		return
	}
	fmt.Fprintf(os.Stderr, "\ntree correspondence: %d problem(s)\n", len(problems))
	for _, p := range problems {
		fmt.Fprintln(os.Stderr, "  -", p)
	}
	os.Exit(1)
}
