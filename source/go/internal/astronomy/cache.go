package astronomy

import (
	"github.com/ishankgupta95/panchang/source/go/v5/internal/store"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
)

type LongitudeCacheMode string

const (
	ModeExact        LongitudeCacheMode = "exact"
	ModeInterpolated LongitudeCacheMode = "interpolated"
)

const (
	moonBlockMS = 4 * dayMS
	moonNodes   = 10
	sunBlockMS  = 8 * dayMS
	sunNodes    = 8
)

var chebyshevAbscissae = map[int][]float64{
	moonNodes: {
		1, 0.9396926207859084, 0.766044443118978, 0.5000000000000001, 0.17364817766693041,
		-0.1736481776669303, -0.4999999999999998, -0.7660444431189779, -0.9396926207859083, -1,
	},
	sunNodes: {
		1, 0.9009688679024191, 0.6234898018587336, 0.22252093395631445, -0.22252093395631434,
		-0.6234898018587335, -0.900968867902419, -1,
	},
}

func chebyshevAbscissa(k, nodes int) float64 {
	if grid, ok := chebyshevAbscissae[nodes]; ok && k < len(grid) {
		return grid[k]
	}
	return math.Cos((jsnum.PI * float64(k)) / float64(nodes-1))
}

type chebyshevLongitude struct {
	nodeX  []float64
	nodeY  []float64
	weight []float64
	midMs  float64
	halfMs float64
}

func newChebyshevLongitude(tropicalAt func(tMs float64) float64, t0Ms, t1Ms float64, nodes int) *chebyshevLongitude {
	c := &chebyshevLongitude{
		midMs:  (t0Ms + t1Ms) / 2,
		halfMs: (t1Ms - t0Ms) / 2,
		nodeX:  make([]float64, nodes),
		nodeY:  make([]float64, nodes),
		weight: make([]float64, nodes),
	}

	previous := 0.0
	for k := 0; k < nodes; k++ {
		x := chebyshevAbscissa(k, nodes)
		c.nodeX[k] = x

		y := tropicalAt(c.midMs + float64(c.halfMs*x))
		if k > 0 {
			for y-previous > 180 {
				y -= 360
			}
			for y-previous < -180 {
				y += 360
			}
		}
		c.nodeY[k] = y
		previous = y

		end := 1.0
		if k == 0 || k == nodes-1 {
			end = 0.5
		}
		sign := 1.0
		if k%2 != 0 {
			sign = -1
		}
		c.weight[k] = end * sign
	}
	return c
}

func (c *chebyshevLongitude) at(ms float64) float64 {
	x := (ms - c.midMs) / c.halfMs
	nodeX := c.nodeX
	nodeY := c.nodeY
	weight := c.weight

	numerator := 0.0
	denominator := 0.0
	for k := 0; k < len(nodeX); k++ {
		y := nodeY[k]
		dx := x - nodeX[k]
		if dx == 0 {
			return y
		}
		q := weight[k] / dx
		numerator += float64(q * y) // anti-FMA barrier
		denominator += q
	}
	return numerator / denominator
}

const maxBlocks = 1024

var (
	moonBlockStore = store.New[int64, *chebyshevLongitude](maxBlocks, store.DefaultStripes, store.HashInt64)
	sunBlockStore  = store.New[int64, *chebyshevLongitude](maxBlocks, store.DefaultStripes, store.HashInt64)
)

func blockFor(
	s *store.Store[int64, *chebyshevLongitude],
	index int64,
	spanMs int64,
	nodes int,
	tropicalAt func(tMs float64) float64,
) (*chebyshevLongitude, bool) {
	return s.GetOrBuild(index, func() *chebyshevLongitude {
		return newChebyshevLongitude(tropicalAt, float64(index*spanMs), float64((index+1)*spanMs), nodes)
	})
}

func blockIndexFor(ms int64, spanMs int64) int64 {
	q := ms / spanMs
	if ms%spanMs != 0 && (ms < 0) != (spanMs < 0) {
		q--
	}
	return q
}

type LongitudeCache struct {
	ctx          *EphemerisCtx
	ayanamsaType types.AyanamsaType
	mode         LongitudeCacheMode

	moonCache         map[int64]float64
	sunCache          map[int64]float64
	moonTropicalCache map[int64]float64
	sunTropicalCache  map[int64]float64

	Hits   int
	Misses int
}

func NewLongitudeCache(ctx *EphemerisCtx, ayanamsaType types.AyanamsaType, mode LongitudeCacheMode) (*LongitudeCache, error) {
	if ctx == nil {
		return nil, types.NewPanchangError("LongitudeCache requires an EphemerisCtx", types.ErrInvalidInput)
	}
	if _, err := ComputeAyanamsa(j2000NoonMS, ayanamsaType); err != nil {
		return nil, err
	}
	if mode != ModeExact && mode != ModeInterpolated {
		return nil, types.Codef(types.ErrInvalidInput,
			"Unknown longitude cache mode: %s", mode)
	}
	return &LongitudeCache{ctx: ctx, ayanamsaType: ayanamsaType, mode: mode}, nil
}

func (c *LongitudeCache) ayanamsaDegrees(ms int64) float64 {
	v, _ := ComputeAyanamsa(ms, c.ayanamsaType)
	return v
}

func (c *LongitudeCache) GetMoon(ms int64) float64 {
	if c.mode == ModeExact {
		if cached, ok := c.moonCache[ms]; ok {
			c.Hits++
			return cached
		}
		c.Misses++
		lon, _ := GetSiderealMoonLongitude(c.ctx, ms, c.ayanamsaType)
		if c.moonCache == nil {
			c.moonCache = make(map[int64]float64)
		}
		c.moonCache[ms] = lon
		return lon
	}

	interpolant, built := blockFor(
		moonBlockStore, blockIndexFor(ms, moonBlockMS), moonBlockMS, moonNodes,
		c.tropicalMoonAt,
	)
	if built {
		c.Misses++
	} else {
		c.Hits++
	}
	return utils.Normalize360(interpolant.at(float64(ms)) - c.ayanamsaDegrees(ms))
}

func (c *LongitudeCache) GetSun(ms int64) float64 {
	if c.mode == ModeExact {
		if cached, ok := c.sunCache[ms]; ok {
			c.Hits++
			return cached
		}
		c.Misses++
		lon, _ := GetSiderealSunLongitude(c.ctx, ms, c.ayanamsaType)
		if c.sunCache == nil {
			c.sunCache = make(map[int64]float64)
		}
		c.sunCache[ms] = lon
		return lon
	}

	interpolant, built := blockFor(
		sunBlockStore, blockIndexFor(ms, sunBlockMS), sunBlockMS, sunNodes,
		c.tropicalSunAt,
	)
	if built {
		c.Misses++
	} else {
		c.Hits++
	}
	return utils.Normalize360(interpolant.at(float64(ms)) - c.ayanamsaDegrees(ms))
}

func (c *LongitudeCache) GetTropicalMoon(ms int64) float64 {
	if c.mode == ModeExact {
		if cached, ok := c.moonTropicalCache[ms]; ok {
			c.Hits++
			return cached
		}
		c.Misses++
		lon := GetTropicalMoonLongitude(c.ctx, ms)
		if c.moonTropicalCache == nil {
			c.moonTropicalCache = make(map[int64]float64)
		}
		c.moonTropicalCache[ms] = lon
		return lon
	}

	interpolant, built := blockFor(
		moonBlockStore, blockIndexFor(ms, moonBlockMS), moonBlockMS, moonNodes,
		c.tropicalMoonAt,
	)
	if built {
		c.Misses++
	} else {
		c.Hits++
	}
	return utils.Normalize360(interpolant.at(float64(ms)))
}

func (c *LongitudeCache) GetTropicalSun(ms int64) float64 {
	if c.mode == ModeExact {
		if cached, ok := c.sunTropicalCache[ms]; ok {
			c.Hits++
			return cached
		}
		c.Misses++
		lon := GetTropicalSunLongitude(c.ctx, ms)
		if c.sunTropicalCache == nil {
			c.sunTropicalCache = make(map[int64]float64)
		}
		c.sunTropicalCache[ms] = lon
		return lon
	}

	interpolant, built := blockFor(
		sunBlockStore, blockIndexFor(ms, sunBlockMS), sunBlockMS, sunNodes,
		c.tropicalSunAt,
	)
	if built {
		c.Misses++
	} else {
		c.Hits++
	}
	return utils.Normalize360(interpolant.at(float64(ms)))
}

func (c *LongitudeCache) tropicalMoonAt(tMs float64) float64 {
	return GetTropicalMoonLongitude(c.ctx, int64(tMs))
}

func (c *LongitudeCache) tropicalSunAt(tMs float64) float64 {
	return GetTropicalSunLongitude(c.ctx, int64(tMs))
}

func (c *LongitudeCache) Size() int {
	return len(c.moonCache) + len(c.sunCache) +
		len(c.moonTropicalCache) + len(c.sunTropicalCache) +
		moonBlockStore.Len() + sunBlockStore.Len()
}

func ClearBlockStores() {
	moonBlockStore.Clear()
	sunBlockStore.Clear()
}

// The phase search, the eclipse finders, the syzygy latitude test and the
// planet positions are memoised in stores like the block stores: exact keys of
// pure evaluations. Each value is a function of every field of its key and of
// nothing else (the EphemerisCtx memos those evaluations read are exact-key
// too), so a hit is the bits a miss would compute, whatever ran before it; a
// float input is keyed by its bits. None answers from a nearby key: a new-moon
// search seeded a millisecond differently can end a millisecond apart, and is
// its own entry.

// ClearEphemerisMemos empties those stores. Only tests and benchmarks need it:
// an entry never goes stale.
func ClearEphemerisMemos() {
	phaseSearchMemo.Clear()
	syzygyLatitudeMemo.Clear()
	lunarEclipseMemo.Clear()
	solarEclipseMemo.Clear()
	planetMemo.Clear()
}
