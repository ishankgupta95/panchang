package gen

import (
	"fmt"
	"strconv"
)

// Not fmt.Sscan: it accepts forms Go source does not.
func fmtSscan(s string, out *float64) (int, error) {
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, fmt.Errorf("parse %q: %w", s, err)
	}
	*out = v
	return 1, nil
}
