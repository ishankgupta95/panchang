// Package tablejson serializes byte-identically to JSON.stringify(v, null, 2) + "\n".
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
