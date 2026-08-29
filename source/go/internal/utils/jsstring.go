package utils

import (
	"time"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
)

func jsString(x float64) string { return jsnum.FormatFloat(x) }

func isoString(ms int64) string {
	return time.UnixMilli(ms).UTC().Format("2006-01-02T15:04:05.000Z")
}

func utcYear(ms int64) int {
	return time.UnixMilli(ms).UTC().Year()
}
