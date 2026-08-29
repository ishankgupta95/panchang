package repopath

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

// Compile-time path, not the working directory.
var root = func() string {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		return ""
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "..", ".."))
}()

func Root() string { return root }

// TestData resolves a path under the repository's shared testdata/ tree, which
// the TypeScript tests read too. It sits above this module, so `go get` never
// fetches it: these are repository tests, not module tests.
func TestData(parts ...string) string {
	return filepath.Join(append([]string{root, "testdata"}, parts...)...)
}

// ReadTestData is the one loader every test reads its data through.
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
