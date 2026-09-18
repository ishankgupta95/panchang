package panchang

import (
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

// The two gates in this file keep the published documentation honest. Both read
// panchang.go with go/parser, so neither adds a dependency to a module whose
// whole point is that it has none.

const facadeFile = "panchang.go"

// internalPkgs are the import names that must never appear in an exported
// signature, because a caller cannot import them. The shared types package is
// deliberately absent: it sits outside internal/ precisely so that signatures
// can name it and a caller can spell those types.
var internalPkgs = map[string]bool{
	"astronomy": true,
	"calendar":  true,
	"core":      true,
	"jyotish":   true,
	"muhurta":   true,
	"rules":     true,
	"utils":     true,
}

func parseFacade(t *testing.T) (*token.FileSet, *ast.File) {
	t.Helper()
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, facadeFile, nil, parser.ParseComments)
	if err != nil {
		t.Fatalf("parse %s: %v", facadeFile, err)
	}
	return fset, f
}

// TestNoInternalNamesInSignatures fails when an exported function or method
// spells an internal package in its parameters or results. Those signatures are
// what a reader copies, so they have to be copyable.
func TestNoInternalNamesInSignatures(t *testing.T) {
	fset, f := parseFacade(t)

	var bad []string
	for _, d := range f.Decls {
		fd, ok := d.(*ast.FuncDecl)
		if !ok || !fd.Name.IsExported() {
			continue
		}
		ast.Inspect(fd.Type, func(n ast.Node) bool {
			se, ok := n.(*ast.SelectorExpr)
			if !ok {
				return true
			}
			id, ok := se.X.(*ast.Ident)
			if !ok || !internalPkgs[id.Name] {
				return true
			}
			bad = append(bad, fset.Position(se.Pos()).String()+": "+
				fd.Name.Name+" names "+id.Name+"."+se.Sel.Name)
			return false
		})
	}
	if len(bad) > 0 {
		sort.Strings(bad)
		t.Errorf("%d exported signature(s) name an internal package; alias the type in %s and use the local name:\n\t%s",
			len(bad), facadeFile, strings.Join(bad, "\n\t"))
	}
}

// TestEveryExportedSymbolIsDocumented fails when an exported declaration ships
// without a doc comment. A grouped declaration may carry one comment for the
// whole group, which is how the enum blocks are documented.
func TestEveryExportedSymbolIsDocumented(t *testing.T) {
	fset, f := parseFacade(t)

	if f.Doc == nil {
		t.Errorf("package panchang has no package doc comment")
	}

	var undocumented []string
	note := func(pos token.Pos, kind, name string) {
		undocumented = append(undocumented, fset.Position(pos).String()+": "+kind+" "+name)
	}

	for _, d := range f.Decls {
		switch decl := d.(type) {
		case *ast.FuncDecl:
			if !decl.Name.IsExported() || decl.Doc != nil {
				continue
			}
			kind := "func"
			if decl.Recv != nil {
				kind = "method"
			}
			note(decl.Pos(), kind, decl.Name.Name)
		case *ast.GenDecl:
			if decl.Tok == token.IMPORT {
				continue
			}
			groupDoc := decl.Doc != nil
			// In an unparenthesized single-spec declaration the comment binds
			// to the GenDecl, so the spec's own Doc is nil and the group's is
			// the one the reader sees.
			soloDoc := decl.Doc != nil && !decl.Lparen.IsValid()
			for _, sp := range decl.Specs {
				switch s := sp.(type) {
				case *ast.TypeSpec:
					// A type needs its own comment even inside a grouped
					// declaration. Most of these are aliases, and an alias
					// renders as one bare line: the comment is the only thing
					// on the page that says what the type is.
					if !s.Name.IsExported() || s.Doc != nil || soloDoc {
						continue
					}
					note(s.Pos(), "type", s.Name.Name)
				case *ast.ValueSpec:
					if s.Doc != nil || groupDoc {
						continue
					}
					for _, n := range s.Names {
						if n.IsExported() {
							note(n.Pos(), strings.ToLower(decl.Tok.String()), n.Name)
						}
					}
				}
			}
		}
	}

	if len(undocumented) > 0 {
		sort.Strings(undocumented)
		shown := undocumented
		if len(shown) > 25 {
			shown = shown[:25]
		}
		t.Errorf("%d exported declaration(s) have no doc comment:\n\t%s\n\t...",
			len(undocumented), strings.Join(shown, "\n\t"))
	}
}

// TestEveryExportedTypesSymbolIsDocumented is the same gate over the public
// types package, one directory up, and it also covers exported struct fields:
// the types page is where a caller reads what a field holds, so a field with
// no comment is a hole in the documentation. It parses the files rather than
// importing anything, for the same reason as the gate above.
func TestEveryExportedTypesSymbolIsDocumented(t *testing.T) {
	files, err := filepath.Glob(filepath.Join("..", "types", "*.go"))
	if err != nil || len(files) == 0 {
		t.Fatalf("no files in the types package: %v", err)
	}
	fset := token.NewFileSet()
	var undocumented []string
	note := func(pos token.Pos, kind, name string) {
		undocumented = append(undocumented, fset.Position(pos).String()+": "+kind+" "+name)
	}
	sawPackageDoc := false
	for _, file := range files {
		if strings.HasSuffix(file, "_test.go") {
			continue
		}
		f, err := parser.ParseFile(fset, file, nil, parser.ParseComments)
		if err != nil {
			t.Fatalf("parse %s: %v", file, err)
		}
		if f.Doc != nil {
			sawPackageDoc = true
		}
		for _, d := range f.Decls {
			switch decl := d.(type) {
			case *ast.FuncDecl:
				if !decl.Name.IsExported() || decl.Doc != nil {
					continue
				}
				if decl.Recv != nil {
					rt := decl.Recv.List[0].Type
					if se, ok := rt.(*ast.StarExpr); ok {
						rt = se.X
					}
					if id, ok := rt.(*ast.Ident); ok && !id.IsExported() {
						continue
					}
					note(decl.Pos(), "method", decl.Name.Name)
					continue
				}
				note(decl.Pos(), "func", decl.Name.Name)
			case *ast.GenDecl:
				if decl.Tok == token.IMPORT {
					continue
				}
				groupDoc := decl.Doc != nil
				soloDoc := decl.Doc != nil && !decl.Lparen.IsValid()
				for _, sp := range decl.Specs {
					switch s := sp.(type) {
					case *ast.TypeSpec:
						if !s.Name.IsExported() {
							continue
						}
						if s.Doc == nil && !soloDoc {
							note(s.Pos(), "type", s.Name.Name)
						}
						st, ok := s.Type.(*ast.StructType)
						if !ok {
							continue
						}
						for _, fld := range st.Fields.List {
							if fld.Doc != nil || fld.Comment != nil {
								continue
							}
							for _, n := range fld.Names {
								if n.IsExported() {
									note(n.Pos(), "field", s.Name.Name+"."+n.Name)
								}
							}
						}
					case *ast.ValueSpec:
						if s.Doc != nil || s.Comment != nil || groupDoc {
							continue
						}
						for _, n := range s.Names {
							if n.IsExported() {
								note(n.Pos(), strings.ToLower(decl.Tok.String()), n.Name)
							}
						}
					}
				}
			}
		}
	}
	if !sawPackageDoc {
		t.Errorf("package types has no package doc comment")
	}
	if len(undocumented) > 0 {
		sort.Strings(undocumented)
		shown := undocumented
		if len(shown) > 25 {
			shown = shown[:25]
		}
		t.Errorf("%d exported declaration(s) or field(s) in types have no doc comment:\n\t%s\n\t...",
			len(undocumented), strings.Join(shown, "\n\t"))
	}
}
