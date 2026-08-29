package jyotish

import "strconv"

// Error messages only; published strings go through jsnum.FormatInt.
func itoa(v int) string { return strconv.Itoa(v) }
