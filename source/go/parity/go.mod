// Not a real module. A directory holding a go.mod is excluded from its parent module's
// zip, and this one keeps the parity harness (a 263 KB TypeScript dump generator, plus
// shell and mjs) out of what `go get` hands a consumer. There are no .go files here.
module github.com/ishankgupta95/panchang/source/go/parity

go 1.22
