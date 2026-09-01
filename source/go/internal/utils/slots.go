package utils

func BuildEqualSlots[T any](
	referenceMs int64, durationMs float64, count int,
	make func(ordinal int, startMs, endMs int64) T,
) []T {
	refMs := float64(referenceMs)
	slotMs := durationMs / float64(count)
	slots := make2[T](count)
	for i := 0; i < count; i++ {
		startMs := refMs + float64(float64(i)*slotMs)
		var endMs float64
		if i == count-1 {
			endMs = refMs + durationMs
		} else {
			endMs = refMs + float64(float64(i+1)*slotMs)
		}
		slots = append(slots, make(i, int64(startMs), int64(endMs)))
	}
	return slots
}

func make2[T any](n int) []T { return make([]T, 0, n) }

var VaraChaldeanStart = [7]int{0, 3, 6, 2, 5, 1, 4}
