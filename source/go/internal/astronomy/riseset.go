package astronomy

import (
	"math"
	"sort"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/store"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
)

const moonRadiusAU = MoonRadiusKm / AuKm

type RiseSetBody string

const (
	RiseSetSun  RiseSetBody = "sun"
	RiseSetMoon RiseSetBody = "moon"
)

const (
	trackBlockDays = 4
	trackNodes     = 11
)

const scanStepDays float64 = 12.0 / (60 * 24)

const maxAltitudeSlopeDegPerDay = 380

const rootToleranceDays float64 = 1e-8

type positionTrack struct {
	nodeX    [trackNodes]float64
	weight   [trackNodes]float64
	px       [trackNodes]float64
	py       [trackNodes]float64
	pz       [trackNodes]float64
	midMs    float64
	halfMs   float64
	radiusAu float64
}

func newPositionTrack(ctx *EphemerisCtx, body RiseSetBody, blockIndex int64) *positionTrack {
	startMs := float64(blockIndex * trackBlockDays * dayMS)
	endMs := startMs + trackBlockDays*dayMS
	tr := &positionTrack{
		midMs:  (startMs + endMs) / 2,
		halfMs: (endMs - startMs) / 2,
	}
	if body == RiseSetSun {
		tr.radiusAu = SunRadiusAU
	} else {
		tr.radiusAu = moonRadiusAU
	}

	for k := 0; k < trackNodes; k++ {
		x := math.Cos((jsnum.PI * float64(k)) / float64(trackNodes-1))
		tr.nodeX[k] = x
		end := 1.0
		if k == 0 || k == trackNodes-1 {
			end = 0.5
		}
		sign := 1.0
		if k%2 != 0 {
			sign = -1
		}
		tr.weight[k] = end * sign

		msf := tr.midMs + float64(tr.halfMs*x)
		ms := int64(msf)
		t := TTDaysSinceJ2000(ms) / 36525
		_, deps := Nutation(ctx, t)
		eps := (MeanObliquityArcsec(t) + deps) * ArcsecToRad

		var lonDeg, latDeg, distAu float64
		if body == RiseSetSun {
			p := GetSunPosition(ctx, ms)
			lonDeg, latDeg, distAu = p.Longitude, p.Latitude, p.Distance
		} else {
			p := GetMoonPositionForTrack(ctx, ms)
			lonDeg, latDeg, distAu = p.Longitude, p.Latitude, p.Distance/AuKm
		}
		lon := lonDeg * degToRad
		lat := latDeg * degToRad
		cosLat := distAu * math.Cos(lat)
		ex := cosLat * math.Cos(lon)
		ey := cosLat * math.Sin(lon)
		ez := distAu * math.Sin(lat)
		tr.px[k] = ex
		tr.py[k] = float64(math.Cos(eps)*ey) - float64(math.Sin(eps)*ez)
		tr.pz[k] = float64(math.Sin(eps)*ey) + float64(math.Cos(eps)*ez)
	}
	return tr
}

func (tr *positionTrack) position(ms float64) [3]float64 {
	x := (ms - tr.midMs) / tr.halfMs
	var nx, ny, nz, den float64
	for k := 0; k < trackNodes; k++ {
		dx := x - tr.nodeX[k]
		if dx == 0 {
			return [3]float64{tr.px[k], tr.py[k], tr.pz[k]}
		}
		q := tr.weight[k] / dx
		nx += float64(q * tr.px[k])
		ny += float64(q * tr.py[k])
		nz += float64(q * tr.pz[k])
		den += q
	}
	return [3]float64{nx / den, ny / den, nz / den}
}

type dayFrame struct {
	eqeq0      float64
	eqeq1      float64
	deltaTDays float64
	dayStartMs float64
}

func newDayFrame(ctx *EphemerisCtx, dayIndex int64) *dayFrame {
	dayStartMs := dayIndex * dayMS
	dayEndMs := dayStartMs + dayMS
	midMs := (dayStartMs + dayEndMs) / 2
	return &dayFrame{
		eqeq0:      equationOfEquinoxes(ctx, dayStartMs),
		eqeq1:      equationOfEquinoxes(ctx, dayEndMs),
		deltaTDays: TTDaysSinceJ2000(midMs) - float64(midMs-j2000NoonMS)/dayMS,
		dayStartMs: float64(dayStartMs),
	}
}

func (f *dayFrame) gast(ms float64) float64 {
	utDays := (ms - float64(j2000NoonMS)) / dayMS
	theta := float64(360 * jsnum.Mod(jsnum.Mod(0.7790572732640+float64(0.00273781191135448*utDays), 1)+jsnum.Mod(utDays, 1), 1))
	frac := (ms - f.dayStartMs) / dayMS
	eqeq := f.eqeq0 + float64((f.eqeq1-f.eqeq0)*frac)
	t := (utDays + f.deltaTDays) / 36525
	precession := 0.014506 + float64((4612.156534+float64((1.3915817+float64((-0.00000044+float64((-0.000029956+float64(-0.0000000368*t))*t))*t))*t))*t)
	gast := jsnum.Mod(theta+(eqeq+precession)/3600, 360)
	if gast < 0 {
		return gast + 360
	}
	return gast
}

func equationOfEquinoxes(ctx *EphemerisCtx, ms int64) float64 {
	t := TTDaysSinceJ2000(ms) / 36525
	dpsi, deps := Nutation(ctx, t)
	return dpsi * math.Cos((MeanObliquityArcsec(t)+deps)*ArcsecToRad)
}

const (
	maxTracks = 1024
	maxFrames = 8192
)

var (
	trackStore = store.New[string, *positionTrack](maxTracks, store.DefaultStripes, store.HashString)
	frameStore = store.New[int64, *dayFrame](maxFrames, store.DefaultStripes, store.HashInt64)
)

func trackFor(ctx *EphemerisCtx, body RiseSetBody, dayIndex int64) *positionTrack {
	blockIndex := floorDivInt(dayIndex, trackBlockDays)
	key := string(body) + "|" + jsnum.FormatInt(blockIndex)
	track, _ := trackStore.GetOrBuild(key, func() *positionTrack {
		return newPositionTrack(ctx, body, blockIndex)
	})
	return track
}

func frameFor(ctx *EphemerisCtx, dayIndex int64) *dayFrame {
	frame, _ := frameStore.GetOrBuild(dayIndex, func() *dayFrame {
		return newDayFrame(ctx, dayIndex)
	})
	return frame
}

func ClearRiseSetTracks() {
	trackStore.Clear()
	frameStore.Clear()
	scanCache.Clear()
	clearRiseSetEventCache()
}

type observerGeometry struct {
	sinPhi       float64
	cosPhi       float64
	equatorialAu float64
	polarAu      float64
	longitude    float64
}

func newObserverGeometry(location types.GeoLocation) observerGeometry {
	phi := location.Latitude * degToRad
	g := observerGeometry{
		sinPhi:    math.Sin(phi),
		cosPhi:    math.Cos(phi),
		longitude: location.Longitude,
	}
	flattened := float64(EarthFlatteningSquared * g.sinPhi * g.sinPhi)
	c := 1 / math.Sqrt(float64(g.cosPhi*g.cosPhi)+flattened)
	s := EarthFlatteningSquared * c
	heightKm := location.Elevation / 1000
	g.equatorialAu = (float64(EarthEquatorialRadiusKm*c) + heightKm) / AuKm * g.cosPhi
	g.polarAu = (float64(EarthEquatorialRadiusKm*s) + heightKm) / AuKm * g.sinPhi
	return g
}

func altitudeExcess(track *positionTrack, frame *dayFrame, geometry observerGeometry, ms float64) float64 {
	bodyVec := track.position(ms)
	local := (frame.gast(ms) + geometry.longitude) * degToRad
	cosLocal := Cos(local)
	sinLocal := Sin(local)

	x := bodyVec[0] - float64(geometry.equatorialAu*cosLocal)
	y := bodyVec[1] - float64(geometry.equatorialAu*sinLocal)
	z := bodyVec[2] - geometry.polarAu
	distance := math.Sqrt(float64(x*x) + float64(y*y) + float64(z*z))

	dot := (float64(float64(x*geometry.cosPhi)*cosLocal) +
		float64(float64(y*geometry.cosPhi)*sinLocal) +
		float64(z*geometry.sinPhi)) / distance
	clamped := dot
	if dot < -1 {
		clamped = -1
	} else if dot > 1 {
		clamped = 1
	}
	centre := float64(math.Asin(clamped) * radToDeg)
	return centre + float64((track.radiusAu/distance)*radToDeg) + RefractionNearHorizonDeg
}

func refine(f func(ms float64) float64, loMs, hiMs, fLoIn float64, wantRise bool) float64 {
	tolMs := rootToleranceDays * dayMS
	lo, hi, fLo := loMs, hiMs, fLoIn
	below := func(v float64) bool {
		if wantRise {
			return v < 0
		}
		return v >= 0
	}
	for hi-lo > tolMs {
		mid := (lo + hi) / 2
		fMid := f(mid)
		if below(fLo) == below(fMid) {
			lo, fLo = mid, fMid
		} else {
			hi = mid
		}
	}
	return (lo + hi) / 2
}

type dayEventPair struct {
	rise []float64
	set  []float64
}

func scanDay(ctx *EphemerisCtx, body RiseSetBody, location types.GeoLocation, dayIndex int64) dayEventPair {
	track := trackFor(ctx, body, dayIndex)
	frame := frameFor(ctx, dayIndex)
	geometry := newObserverGeometry(location)
	dayStart := float64(dayIndex * dayMS)
	dayEnd := dayStart + dayMS
	f := func(ms float64) float64 { return altitudeExcess(track, frame, geometry, ms) }

	var rise, set []float64

	var scan func(loMs, hiMs, fLo, fHi float64, depth int)
	scan = func(loMs, hiMs, fLo, fHi float64, depth int) {
		if fLo < 0 && fHi >= 0 {
			rise = append(rise, refine(f, loMs, hiMs, fLo, true))
			return
		}
		if fLo >= 0 && fHi < 0 {
			set = append(set, refine(f, loMs, hiMs, fLo, false))
			return
		}
		if depth >= 12 {
			return
		}

		span := float64(maxAltitudeSlopeDegPerDay * ((hiMs - loMs) / dayMS))
		highest := (fLo + fHi + span) / 2
		lowest := (fLo + fHi - span) / 2
		if fLo < 0 {
			if highest < 0 {
				return
			}
		} else if lowest >= 0 {
			return
		}

		midMs := (loMs + hiMs) / 2
		fMid := f(midMs)
		scan(loMs, midMs, fLo, fMid, depth+1)
		scan(midMs, hiMs, fMid, fHi, depth+1)
	}

	stepMs := scanStepDays * dayMS
	prevMs := dayStart
	prevF := f(prevMs)
	for ms := dayStart + stepMs; ; ms += stepMs {
		capped := math.Min(ms, dayEnd)
		value := f(capped)
		scan(prevMs, capped, prevF, value, 0)
		prevMs = capped
		prevF = value
		if capped >= dayEnd {
			break
		}
	}

	inside := func(list []float64) []float64 {
		out := make([]float64, 0, len(list))
		for _, e := range list {
			if e >= dayStart && e < dayEnd {
				out = append(out, e)
			}
		}
		sort.Float64s(out)
		return out
	}
	return dayEventPair{rise: inside(rise), set: inside(set)}
}

const maxScans = 20_000

var scanCache = store.New[string, dayEventPair](maxScans, store.DefaultStripes, store.HashString)

func DayEvents(ctx *EphemerisCtx, body RiseSetBody, direction int, location types.GeoLocation, dayIndex int64) []float64 {
	return append([]float64(nil), dayEventsShared(ctx, body, direction, location, dayIndex)...)
}

func dayEventsShared(ctx *EphemerisCtx, body RiseSetBody, direction int, location types.GeoLocation, dayIndex int64) []float64 {
	key := riseSetScanKey(body, location, dayIndex)
	pair, _ := scanCache.GetOrBuild(key, func() dayEventPair {
		return scanDay(ctx, body, location, dayIndex)
	})
	if direction == 1 {
		return pair.rise
	}
	return pair.set
}

func riseSetScanKey(body RiseSetBody, location types.GeoLocation, dayIndex int64) string {
	return string(body) + "|" +
		jsnum.FormatFloat(location.Latitude) + "|" +
		jsnum.FormatFloat(location.Longitude) + "|" +
		jsnum.FormatFloat(location.Elevation) + "|" +
		jsnum.FormatInt(dayIndex)
}

func floorDivInt(a, b int64) int64 {
	q := a / b
	if a%b != 0 && (a < 0) != (b < 0) {
		q--
	}
	return q
}
