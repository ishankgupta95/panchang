// Package tablejson reproduces JSON.stringify(file, null, 2) plus a trailing
// newline, so a table file written by Go is byte-identical to the TypeScript one.
package tablejson

import (
	"bytes"
	"encoding/json"
)

func Marshal(v any) ([]byte, error) {
	var buf bytes.Buffer
	e := json.NewEncoder(&buf)
	e.SetEscapeHTML(false)
	e.SetIndent("", "  ")
	if err := e.Encode(v); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
