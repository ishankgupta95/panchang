package calendar

import (
	"strconv"
	"strings"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
)

func tableDateKey(ms int64, offsetMinutes int) string {
	shifted := types.Date(ms + int64(offsetMinutes)*60_000)
	var b strings.Builder
	b.Grow(10)
	b.WriteString(strconv.Itoa(shifted.UTCFullYear()))
	b.WriteByte('-')
	b.WriteString(pad2(shifted.UTCMonth() + 1))
	b.WriteByte('-')
	b.WriteString(pad2(shifted.UTCDate()))
	return b.String()
}

func pad2(n int) string {
	s := strconv.Itoa(n)
	if len(s) < 2 {
		return "0" + s
	}
	return s
}

func itoa(n int) string { return strconv.Itoa(n) }
