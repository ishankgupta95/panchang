package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/gen"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
)

func main() {
	sourceDir := repopath.TestData("ephemeris")
	outDir := repopath.Go("internal", "astronomy", "series")
	if len(os.Args) > 1 {
		sourceDir = filepath.Join(os.Args[1], "testdata", "ephemeris")
		outDir = filepath.Join(os.Args[1], "source", "go", "internal", "astronomy", "series")
	}

	report, err := gen.Generate(sourceDir, outDir)
	if err != nil {
		fail(err)
	}
	for _, line := range report {
		fmt.Fprintln(os.Stderr, line)
	}
	fmt.Fprintf(os.Stderr, "wrote %s\n", outDir)
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "gen:", err)
	os.Exit(1)
}
