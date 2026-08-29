package gen

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

var (
	reFloatVar = regexp.MustCompile(`(?m)^var ([A-Za-z_][A-Za-z0-9_]*) = \[\]float64\{`)
	reInt8Var  = regexp.MustCompile(`(?m)^var ([A-Za-z_][A-Za-z0-9_]*) = \[\]int8\{`)
	reConst    = regexp.MustCompile(`(?m)^const ([A-Za-z_][A-Za-z0-9_]*) = (\S+)$`)
)

func writeRegistry(outDir string, files []string) error {
	var floats, int8s []string
	consts := map[string]string{}
	for _, f := range files {
		b, err := os.ReadFile(filepath.Join(outDir, f))
		if err != nil {
			return err
		}
		text := string(b)
		for _, m := range reFloatVar.FindAllStringSubmatch(text, -1) {
			floats = append(floats, m[1])
		}
		for _, m := range reInt8Var.FindAllStringSubmatch(text, -1) {
			int8s = append(int8s, m[1])
		}
		for _, m := range reConst.FindAllStringSubmatch(text, -1) {
			consts[m[1]] = m[2]
		}
	}
	sort.Strings(floats)
	sort.Strings(int8s)
	var constNames []string
	for k := range consts {
		constNames = append(constNames, k)
	}
	sort.Strings(constNames)

	var b strings.Builder
	b.WriteString(goDirective)
	b.WriteString(`// GENERATED FILE: do not edit. The maps let the coefficient-identity test walk
// every emitted series without a hand-maintained list.
package series

`)
	b.WriteString("var Float64Series = map[string][]float64{\n")
	for _, n := range floats {
		fmt.Fprintf(&b, "\t%q: %s,\n", n, n)
	}
	b.WriteString("}\n\n")
	b.WriteString("var Int8Series = map[string][]int8{\n")
	for _, n := range int8s {
		fmt.Fprintf(&b, "\t%q: %s,\n", n, n)
	}
	b.WriteString("}\n\n")
	b.WriteString("var Scalars = map[string]float64{\n")
	for _, n := range constNames {
		fmt.Fprintf(&b, "\t%q: %s,\n", n, n)
	}
	b.WriteString("}\n")

	return writeGo(filepath.Join(outDir, "registry.go"), b.String())
}
