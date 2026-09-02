package store

import (
	"sync"
	"unsafe"
)

const DefaultStripes = 16

const cacheLine = 64

type shard[K comparable, V any] struct {
	mu sync.Mutex
	m  map[K]V
	_  [cacheLine - unsafe.Sizeof(sync.Mutex{}) - unsafe.Sizeof(uintptr(0))]byte
}

type Store[K comparable, V any] struct {
	shards []shard[K, V]
	mask   uint64
	hash   func(K) uint64

	capacity int
	shardCap int
}

func New[K comparable, V any](capacity, stripes int, hash func(K) uint64) *Store[K, V] {
	if stripes <= 0 || stripes&(stripes-1) != 0 {
		panic("store: stripes must be a positive power of two")
	}
	if capacity < stripes {
		panic("store: capacity must be at least the stripe count")
	}
	if hash == nil {
		panic("store: hash must not be nil")
	}
	s := &Store[K, V]{
		shards:   make([]shard[K, V], stripes),
		mask:     uint64(stripes - 1),
		hash:     hash,
		capacity: capacity,
		shardCap: (capacity + stripes - 1) / stripes,
	}
	for i := range s.shards {
		s.shards[i].m = make(map[K]V)
	}
	return s
}

func (s *Store[K, V]) shardFor(k K) *shard[K, V] {
	return &s.shards[s.hash(k)&s.mask]
}

func (s *Store[K, V]) Get(k K) (V, bool) {
	sh := s.shardFor(k)
	sh.mu.Lock()
	v, ok := sh.m[k]
	sh.mu.Unlock()
	return v, ok
}

func (s *Store[K, V]) GetOrBuild(k K, build func() V) (V, bool) {
	sh := s.shardFor(k)

	sh.mu.Lock()
	if v, ok := sh.m[k]; ok {
		sh.mu.Unlock()
		return v, false
	}
	sh.mu.Unlock()

	built := build()

	sh.mu.Lock()
	defer sh.mu.Unlock()
	if v, ok := sh.m[k]; ok {
		return v, true
	}
	if len(sh.m) >= s.shardCap {
		clear(sh.m)
	}
	sh.m[k] = built
	return built, true
}

func (s *Store[K, V]) Put(k K, v V) {
	sh := s.shardFor(k)
	sh.mu.Lock()
	defer sh.mu.Unlock()
	if _, ok := sh.m[k]; !ok && len(sh.m) >= s.shardCap {
		clear(sh.m)
	}
	sh.m[k] = v
}

func (s *Store[K, V]) Len() int {
	n := 0
	for i := range s.shards {
		s.shards[i].mu.Lock()
		n += len(s.shards[i].m)
		s.shards[i].mu.Unlock()
	}
	return n
}

func (s *Store[K, V]) Clear() {
	for i := range s.shards {
		s.shards[i].mu.Lock()
		clear(s.shards[i].m)
		s.shards[i].mu.Unlock()
	}
}

func (s *Store[K, V]) Stripes() int { return len(s.shards) }

func (s *Store[K, V]) Cap() int { return s.capacity }

func (s *Store[K, V]) ShardCap() int { return s.shardCap }

func HashInt64(k int64) uint64 {
	x := uint64(k)
	x ^= x >> 30
	x *= 0xbf58476d1ce4e5b9
	x ^= x >> 27
	x *= 0x94d049bb133111eb
	x ^= x >> 31
	return x
}

func HashString(s string) uint64 {
	const (
		offset64 = 14695981039346656037
		prime64  = 1099511628211
	)
	h := uint64(offset64)
	for i := 0; i < len(s); i++ {
		h ^= uint64(s[i])
		h *= prime64
	}
	return h
}
