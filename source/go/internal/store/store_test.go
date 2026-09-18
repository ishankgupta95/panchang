package store

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"unsafe"
)

func newIntStore(capacity, stripes int) *Store[int64, *int64] {
	return New[int64, *int64](capacity, stripes, HashInt64)
}

func TestNewRejectsBadArguments(t *testing.T) {
	for _, tc := range []struct {
		name     string
		capacity int
		stripes  int
		hash     func(int64) uint64
	}{
		{"zero stripes", 1024, 0, HashInt64},
		{"negative stripes", 1024, -4, HashInt64},
		{"stripes not a power of two", 1024, 12, HashInt64},
		{"capacity below the stripe count", 8, 16, HashInt64},
		{"nil hash", 1024, 16, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			defer func() {
				if recover() == nil {
					t.Error("expected a panic")
				}
			}()
			New[int64, *int64](tc.capacity, tc.stripes, tc.hash)
		})
	}
}

func TestGetOrBuildBuildsOnceThenServes(t *testing.T) {
	s := newIntStore(1024, 16)
	calls := 0
	build := func(k int64) func() *int64 {
		return func() *int64 { calls++; v := k * 3; return &v }
	}

	v1, built1 := s.GetOrBuild(7, build(7))
	if !built1 || calls != 1 || *v1 != 21 {
		t.Fatalf("first call: built=%v calls=%d value=%v", built1, calls, *v1)
	}
	v2, built2 := s.GetOrBuild(7, build(7))
	if built2 || calls != 1 {
		t.Errorf("second call: built=%v calls=%d, want false and 1", built2, calls)
	}
	if v1 != v2 {
		t.Errorf("two distinct instances for one key: %p and %p", v1, v2)
	}
	if _, ok := s.Get(7); !ok {
		t.Error("Get missed a key GetOrBuild had just stored")
	}
	if _, ok := s.Get(8); ok {
		t.Error("Get found a key that was never stored")
	}
	if s.Len() != 1 {
		t.Errorf("Len=%d, want 1", s.Len())
	}
}

func TestCapIsNeverExceeded(t *testing.T) {
	const capacity, stripes = 1024, 16
	s := newIntStore(capacity, stripes)
	if s.ShardCap() != capacity/stripes {
		t.Fatalf("ShardCap=%d, want %d", s.ShardCap(), capacity/stripes)
	}
	for i := int64(0); i < 100_000; i++ {
		v := i
		s.GetOrBuild(i, func() *int64 { return &v })
		if n := s.Len(); n > capacity {
			t.Fatalf("Len=%d after %d inserts, cap is %d", n, i+1, capacity)
		}
	}
	rebuilt := false
	got, built := s.GetOrBuild(0, func() *int64 { rebuilt = true; v := int64(0); return &v })
	if !built || !rebuilt || *got != 0 {
		t.Errorf("a key evicted by the cap did not rebuild: built=%v rebuilt=%v", built, rebuilt)
	}
	s.Clear()
	if s.Len() != 0 {
		t.Errorf("Len=%d after Clear, want 0", s.Len())
	}
}

func TestPutAppliesTheSameCap(t *testing.T) {
	const capacity, stripes = 64, 16
	s := newIntStore(capacity, stripes)
	for i := int64(0); i < 10_000; i++ {
		v := i
		s.Put(i, &v)
		if n := s.Len(); n > capacity {
			t.Fatalf("Len=%d after %d Puts, cap is %d", n, i+1, capacity)
		}
	}
	s.Clear()
	a, b := int64(1), int64(2)
	s.Put(5, &a)
	s.Put(5, &b)
	if got, _ := s.Get(5); *got != 2 {
		t.Errorf("Put did not overwrite: %v", *got)
	}
	if s.Len() != 1 {
		t.Errorf("Len=%d after two Puts of one key, want 1", s.Len())
	}
}

func TestConcurrentGetOrBuildIsSingleInstance(t *testing.T) {
	const goroutines = 32
	const keys = 64
	s := newIntStore(1024, 16)

	var builds int64
	seen := make([][]*int64, goroutines)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for g := 0; g < goroutines; g++ {
		wg.Add(1)
		seen[g] = make([]*int64, keys)
		go func(g int) {
			defer wg.Done()
			<-start
			for k := 0; k < keys; k++ {
				i := int64((k + g) % keys)
				v, _ := s.GetOrBuild(i, func() *int64 {
					atomic.AddInt64(&builds, 1)
					x := i * 11
					return &x
				})
				seen[g][i] = v
			}
		}(g)
	}
	close(start)
	wg.Wait()

	for k := int64(0); k < keys; k++ {
		want, ok := s.Get(k)
		if !ok {
			t.Fatalf("key %d is missing after the race", k)
		}
		if *want != k*11 {
			t.Fatalf("key %d holds %d, want %d", k, *want, k*11)
		}
		for g := 0; g < goroutines; g++ {
			if seen[g][k] != want {
				t.Fatalf("goroutine %d got a different instance for key %d", g, k)
			}
		}
	}
	if builds < keys {
		t.Errorf("%d builds for %d keys; every key must be built at least once", builds, keys)
	}
	t.Logf("%d goroutines × %d keys: %d builds (%d minimum, duplicates are the "+
		"deliberate cost of building outside the lock)", goroutines, keys, builds, keys)
}

func TestStripesAreUsed(t *testing.T) {
	const stripes = 16
	s := newIntStore(1<<20, stripes)
	counts := make([]int, stripes)
	for i := int64(0); i < 4096; i++ {
		counts[HashInt64(i)&uint64(stripes-1)]++
	}
	for i, n := range counts {
		if n < 128 || n > 512 {
			t.Errorf("stripe %d took %d of 4096 consecutive keys; expected ~256", i, n)
		}
	}
	if s.Stripes() != stripes || s.Cap() != 1<<20 {
		t.Errorf("Stripes=%d Cap=%d", s.Stripes(), s.Cap())
	}
}

func TestHashStringIsFNV1a(t *testing.T) {
	for _, tc := range []struct {
		in   string
		want uint64
	}{
		{"", 0xcbf29ce484222325},
		{"a", 0xaf63dc4c8601ec8c},
		{"foobar", 0x85944171f73967e8},
	} {
		if got := HashString(tc.in); got != tc.want {
			t.Errorf("HashString(%q) = %#x, want %#x", tc.in, got, tc.want)
		}
	}
	keys := map[uint64]string{}
	for _, k := range []string{
		"sun|18.5204|73.8567|560|20000",
		"sun|18.5204|73.8567|560|20001",
		"moon|18.5204|73.8567|560|20000",
		"sun|18.5205|73.8567|560|20000",
		"sun|18.5204|73.8568|560|20000",
		"sun|18.5204|73.8567|561|20000",
	} {
		h := HashString(k)
		if prev, ok := keys[h]; ok {
			t.Errorf("%q and %q collide at %#x", prev, k, h)
		}
		keys[h] = k
	}
}

func TestShardIsOneCacheLine(t *testing.T) {
	got := unsafe.Sizeof(shard[int64, *int64]{})
	if got != cacheLine {
		t.Errorf("shard is %d bytes, want %d", got, cacheLine)
	}
	if n := unsafe.Sizeof((*Store[int64, *int64])(nil).shards[0]); n != cacheLine {
		t.Errorf("shard in a slice is %d bytes, want %d", n, cacheLine)
	}
}

func BenchmarkGetOrBuildHit(b *testing.B) {
	s := newIntStore(1024, 16)
	v := int64(1)
	for i := int64(0); i < 512; i++ {
		s.GetOrBuild(i, func() *int64 { return &v })
	}
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := int64(0)
		for pb.Next() {
			s.Get(i % 512)
			i++
		}
	})
}

func BenchmarkGetOrBuildHitByStripes(b *testing.B) {
	for _, stripes := range []int{1, 2, 4, 8, 16, 32, 64} {
		b.Run(fmt.Sprintf("stripes=%d", stripes), func(b *testing.B) {
			s := newIntStore(4096, stripes)
			v := int64(1)
			for i := int64(0); i < 512; i++ {
				s.GetOrBuild(i, func() *int64 { return &v })
			}
			b.ResetTimer()
			b.RunParallel(func(pb *testing.PB) {
				i := int64(0)
				for pb.Next() {
					s.Get(i % 512)
					i++
				}
			})
		})
	}
}
