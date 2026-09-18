// Package repopath locates the repository root so tests and tooling can reach
// shared fixtures without depending on the working directory.
package repopath

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

var root = func() string {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		return ""
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "..", ".."))
}()

func Root() string { return root }

func TestData(parts ...string) string {
	return filepath.Join(append([]string{root, "testdata"}, parts...)...)
}

func ReadTestData(parts ...string) ([]byte, error) {
	b, err := os.ReadFile(TestData(parts...))
	if err != nil {
		return nil, fmt.Errorf("%w: testdata/ is a repository directory; run these tests from a checkout, not a module cache", err)
	}
	return b, nil
}

func Src(parts ...string) string {
	return filepath.Join(append([]string{root, "source", "ts", "src"}, parts...)...)
}

func Doc(parts ...string) string {
	return filepath.Join(append([]string{root, "docs"}, parts...)...)
}

func Go(parts ...string) string {
	return filepath.Join(append([]string{root, "source", "go"}, parts...)...)
}
