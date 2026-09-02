package astronomy

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
)

const sunRadiusKm = SunRadiusAU * AuKm

const danjonEnlargement = 1 + 1.0/85 - 1.0/594

const contactToleranceMS = 1

func separationDegrees(lon1Deg, lat1Deg, lon2Deg, lat2Deg float64) float64 {
	l1, b1 := lon1Deg/radToDeg, lat1Deg/radToDeg
	l2, b2 := lon2Deg/radToDeg, lat2Deg/radToDeg
	c1, c2 := math.Cos(b1), math.Cos(b2)
	x1, y1, z1 := c1*math.Cos(l1), c1*math.Sin(l1), math.Sin(b1)
	x2, y2, z2 := c2*math.Cos(l2), c2*math.Sin(l2), math.Sin(b2)
	cx := float64(y1*z2) - float64(z1*y2)
	cy := float64(z1*x2) - float64(x1*z2)
	cz := float64(x1*y2) - float64(y1*x2)
	return math.Atan2(jsnum.Hypot3(cx, cy, cz),
		float64(x1*x2)+float64(y1*y2)+float64(z1*z2)) * radToDeg
}

func DiscObscuration(separation, discRadius, coverRadius float64) float64 {
	if discRadius <= 0 {
		return 0
	}
	if separation >= discRadius+coverRadius {
		return 0
	}
	if separation <= math.Abs(discRadius-coverRadius) {
		return math.Min(1, (coverRadius*coverRadius)/(discRadius*discRadius))
	}
	d, r, s := separation, discRadius, coverRadius
	a1 := float64(r * r * math.Acos(math.Max(-1, math.Min(1, (float64(d*d)+float64(r*r)-float64(s*s))/(2*d*r)))))
	a2 := float64(s * s * math.Acos(math.Max(-1, math.Min(1, (float64(d*d)+float64(s*s)-float64(r*r))/(2*d*s)))))
	a3 := float64(0.5 * math.Sqrt(math.Max(0, (-d+r+s)*(d+r-s)*(d-r+s)*(d+r+s))))
	return math.Min(1, (a1+a2-a3)/(jsnum.PI*r*r))
}

func refineMinimum(f func(ms float64) float64, seedMs float64, halfWidthsMs []float64) float64 {
	t := seedMs
	for _, h := range halfWidthsMs {
		y1, y2, y3 := f(t-h), f(t), f(t+h)
		denominator := float64(y1-2*y2) + y3
		if denominator <= 0 {
			if y1 < y2 {
				if y1 < y3 {
					t = t - h
				} else {
					t = t + h
				}
			} else if y3 < y2 {
				t = t + h
			}
			continue
		}
		shift := (h * (y1 - y3)) / (2 * denominator)
		t += math.Max(-h, math.Min(h, shift))
	}
	return t
}

func solveCrossing(
	f func(ms float64) float64, peakMs float64, direction int, seedMs, limitMs float64,
) (float64, bool) {
	fPeak := f(peakMs)
	if !(fPeak < 0) {
		return 0, false
	}

	lo, flo := peakMs, fPeak
	var hi, fhi float64
	span := math.Max(seedMs, 60_000)
	bracketed := false
	for i := 0; i < 12 && span <= limitMs; i++ {
		hi = peakMs + float64(float64(direction)*span)
		fhi = f(hi)
		if fhi >= 0 {
			bracketed = true
			break
		}
		lo, flo = hi, fhi
		span *= 1.6
	}
	if !bracketed {
		hi = peakMs + float64(float64(direction)*limitMs)
		fhi = f(hi)
		if fhi < 0 {
			return 0, false
		}
	}

	side := 0
	for i := 0; i < 60; i++ {
		t := (float64(lo*fhi) - float64(hi*flo)) / (fhi - flo)
		ft := f(t)
		if math.Abs(hi-lo) <= contactToleranceMS || ft == 0 {
			return t, true
		}
		if ft < 0 {
			lo, flo = t, ft
			if side == -1 {
				fhi /= 2
			}
			side = -1
		} else {
			hi, fhi = t, ft
			if side == 1 {
				flo /= 2
			}
			side = 1
		}
	}
	return (lo + hi) / 2, true
}

type LunarShadow struct {
	Separation       float64
	Umbra            float64
	Penumbra         float64
	MoonSemidiameter float64
}

func LunarShadowAt(ctx *EphemerisCtx, ms int64) LunarShadow {
	sun := GetSunPosition(ctx, ms)
	moon := GetMoonPosition(ctx, ms)
	sunKm := sun.Distance * AuKm

	parallaxMoon := float64(math.Asin(EarthEquatorialRadiusKm/moon.Distance) * radToDeg)
	parallaxSun := float64(math.Asin(EarthEquatorialRadiusKm/sunKm) * radToDeg)
	semidiameterSun := float64(math.Asin(sunRadiusKm/sunKm) * radToDeg)

	shadowAxis := float64(danjonEnlargement * (parallaxMoon + parallaxSun))
	return LunarShadow{
		Separation: separationDegrees(
			moon.Longitude, moon.Latitude, sun.Longitude+180, -sun.Latitude),
		Umbra:            shadowAxis - semidiameterSun,
		Penumbra:         shadowAxis + semidiameterSun,
		MoonSemidiameter: math.Asin(MoonRadiusKm/moon.Distance) * radToDeg,
	}
}

type LunarEclipseKind string

const (
	LunarPenumbral LunarEclipseKind = "penumbral"
	LunarPartial   LunarEclipseKind = "partial"
	LunarTotal     LunarEclipseKind = "total"
)

type LunarEclipse struct {
	Kind               LunarEclipseKind
	PeakMs             int64
	PenumbralBeginMs   int64
	PenumbralEndMs     int64
	PartialBeginMs     *int64
	PartialEndMs       *int64
	TotalBeginMs       *int64
	TotalEndMs         *int64
	PenumbralMagnitude float64
	UmbralMagnitude    float64
	UmbralObscuration  float64
}

func umbralGap(ctx *EphemerisCtx, ms float64) float64 {
	s := LunarShadowAt(ctx, int64(ms))
	return s.Separation - (s.Umbra + s.MoonSemidiameter)
}

func totalityGap(ctx *EphemerisCtx, ms float64) float64 {
	s := LunarShadowAt(ctx, int64(ms))
	return s.Separation - (s.Umbra - s.MoonSemidiameter)
}

func penumbralGap(ctx *EphemerisCtx, ms float64) float64 {
	s := LunarShadowAt(ctx, int64(ms))
	return s.Separation - (s.Penumbra + s.MoonSemidiameter)
}

func lunarSeparationSquared(ctx *EphemerisCtx, ms float64) float64 {
	s := LunarShadowAt(ctx, int64(ms)).Separation
	return s * s
}

const lunarSeparationRateDegPerMS float64 = 0.5080 / 3_600_000

const lunarContactLimitMS = 5 * 3600_000

func seedFromChord(leastSeparation, threshold float64) float64 {
	chord := math.Sqrt(math.Max(0, float64(threshold*threshold)-float64(leastSeparation*leastSeparation)))
	return chord / lunarSeparationRateDegPerMS
}

func FindLunarEclipse(ctx *EphemerisCtx, oppositionMs int64) (LunarEclipse, bool) {
	peakMs := refineMinimum(
		func(ms float64) float64 { return lunarSeparationSquared(ctx, ms) },
		float64(oppositionMs), []float64{3600_000, 600_000, 60_000, 5_000},
	)
	peak := LunarShadowAt(ctx, int64(peakMs))
	least := peak.Separation
	umbra := peak.Umbra
	penumbra := peak.Penumbra
	moonSemidiameter := peak.MoonSemidiameter

	penumbralMagnitude := (penumbra + moonSemidiameter - least) / (2 * moonSemidiameter)
	if penumbralMagnitude <= 0 {
		return LunarEclipse{}, false
	}
	umbralMagnitude := (umbra + moonSemidiameter - least) / (2 * moonSemidiameter)

	kind := LunarPenumbral
	switch {
	case umbralMagnitude >= 1:
		kind = LunarTotal
	case umbralMagnitude > 0:
		kind = LunarPartial
	}

	contact := func(gap func(*EphemerisCtx, float64) float64, threshold float64, direction int) *int64 {
		t, ok := solveCrossing(
			func(ms float64) float64 { return gap(ctx, ms) },
			peakMs, direction, seedFromChord(least, threshold), lunarContactLimitMS,
		)
		if !ok {
			return nil
		}
		ms := int64(jsnum.Round(t))
		return &ms
	}

	penumbralBegin := contact(penumbralGap, penumbra+moonSemidiameter, -1)
	penumbralEnd := contact(penumbralGap, penumbra+moonSemidiameter, 1)
	if penumbralBegin == nil || penumbralEnd == nil {
		return LunarEclipse{}, false
	}

	hasUmbra := umbralMagnitude > 0
	hasTotality := umbralMagnitude >= 1

	out := LunarEclipse{
		Kind:               kind,
		PeakMs:             int64(jsnum.Round(peakMs)),
		PenumbralBeginMs:   *penumbralBegin,
		PenumbralEndMs:     *penumbralEnd,
		PenumbralMagnitude: penumbralMagnitude,
		UmbralMagnitude:    umbralMagnitude,
		UmbralObscuration:  DiscObscuration(least, moonSemidiameter, umbra),
	}
	if hasUmbra {
		out.PartialBeginMs = contact(umbralGap, umbra+moonSemidiameter, -1)
		out.PartialEndMs = contact(umbralGap, umbra+moonSemidiameter, 1)
	}
	if hasTotality {
		out.TotalBeginMs = contact(totalityGap, umbra-moonSemidiameter, -1)
		out.TotalEndMs = contact(totalityGap, umbra-moonSemidiameter, 1)
	}
	return out, true
}

type SolarView struct {
	Separation       float64
	SunSemidiameter  float64
	MoonSemidiameter float64
	SunAltitude      float64
	SunAzimuth       float64
}

func SolarViewAt(ctx *EphemerisCtx, ms int64, location types.GeoLocation) SolarView {
	ttDays := TTDaysSinceJ2000(ms)
	utDays := float64(ms-j2000NoonMS) / dayMS
	t := ttDays / 36525

	sun := GetSunPosition(ctx, ms)
	moon := GetMoonPosition(ctx, ms)
	sunVector := EclipticToEquatorial(ctx, sun.Longitude, sun.Latitude, sun.Distance, t)
	moonVector := EclipticToEquatorial(ctx, moon.Longitude, moon.Latitude, moon.Distance/AuKm, t)

	gast := GastDegrees(ctx, ttDays, utDays)
	observer := ObserverVector(location.Latitude, location.Longitude, location.Elevation, gast)
	var sunTopo, moonTopo [3]float64
	for i := 0; i < 3; i++ {
		sunTopo[i] = sunVector[i] - observer[i]
		moonTopo[i] = moonVector[i] - observer[i]
	}

	sunDistance := jsnum.Hypot3(sunTopo[0], sunTopo[1], sunTopo[2])
	moonDistance := jsnum.Hypot3(moonTopo[0], moonTopo[1], moonTopo[2])

	dot := float64(sunTopo[0]*moonTopo[0]) +
		float64(sunTopo[1]*moonTopo[1]) +
		float64(sunTopo[2]*moonTopo[2])
	cx := float64(sunTopo[1]*moonTopo[2]) - float64(sunTopo[2]*moonTopo[1])
	cy := float64(sunTopo[2]*moonTopo[0]) - float64(sunTopo[0]*moonTopo[2])
	cz := float64(sunTopo[0]*moonTopo[1]) - float64(sunTopo[1]*moonTopo[0])

	geometricAltitude := AltitudeDegrees(sunTopo, location.Latitude, location.Longitude, gast)

	return SolarView{
		Separation:       math.Atan2(jsnum.Hypot3(cx, cy, cz), dot) * radToDeg,
		SunSemidiameter:  math.Asin(SunRadiusAU/sunDistance) * radToDeg,
		MoonSemidiameter: math.Asin(MoonRadiusKm/(moonDistance*AuKm)) * radToDeg,
		SunAltitude:      geometricAltitude + RefractionDegrees(geometricAltitude),
		SunAzimuth:       azimuthDegrees(sunTopo, location.Latitude, location.Longitude, gast),
	}
}

func azimuthDegrees(vec [3]float64, latitudeDeg, longitudeDeg, gastDeg float64) float64 {
	phi := latitudeDeg / radToDeg
	local := (gastDeg + longitudeDeg) / radToDeg
	sinPhi, cosPhi := math.Sin(phi), math.Cos(phi)
	x, y, z := vec[0], vec[1], vec[2]
	cosL, sinL := math.Cos(local), math.Sin(local)
	east := float64(-x*sinL) + float64(y*cosL)
	north := float64(float64(-x*sinPhi)*cosL) - float64(float64(y*sinPhi)*sinL) + float64(z*cosPhi)
	azimuth := float64(math.Atan2(east, north) * radToDeg)
	if azimuth < 0 {
		return azimuth + 360
	}
	return azimuth
}

type SolarEclipseKind string

const (
	SolarPartial SolarEclipseKind = "partial"
	SolarAnnular SolarEclipseKind = "annular"
	SolarTotal   SolarEclipseKind = "total"
)

type LocalSolarEclipse struct {
	Kind           SolarEclipseKind
	PeakMs         int64
	PartialBeginMs int64
	PartialEndMs   int64
	CentralBeginMs *int64
	CentralEndMs   *int64
	Obscuration    float64
	Magnitude      float64
	PeakAltitude   float64
	BeginAltitude  float64
	EndAltitude    float64
	PeakAzimuth    float64
}

const solarContactLimitMS = 3 * 3600_000

const (
	solarSearchHalfWidthMS = 3 * 3600_000
	solarScanSteps         = 12
)

func FindLocalSolarEclipse(ctx *EphemerisCtx, conjunctionMs int64, location types.GeoLocation) (LocalSolarEclipse, bool) {
	separationSquared := func(ms float64) float64 {
		s := SolarViewAt(ctx, int64(ms), location).Separation
		return s * s
	}

	centre := float64(conjunctionMs)
	bestMs := centre
	bestValue := math.Inf(1)
	for i := 0; i <= solarScanSteps; i++ {
		ms := centre - solarSearchHalfWidthMS + (2*solarSearchHalfWidthMS*float64(i))/solarScanSteps
		value := separationSquared(ms)
		if value < bestValue {
			bestValue, bestMs = value, ms
		}
	}
	step := float64(2*solarSearchHalfWidthMS) / solarScanSteps
	peakMs := refineMinimum(separationSquared, bestMs, []float64{step, step / 6, 60_000, 5_000})

	peakView := SolarViewAt(ctx, int64(peakMs), location)
	least := peakView.Separation
	sunSemidiameter := peakView.SunSemidiameter
	moonSemidiameter := peakView.MoonSemidiameter
	peakAltitude := peakView.SunAltitude
	peakAzimuth := peakView.SunAzimuth

	if least >= sunSemidiameter+moonSemidiameter {
		return LocalSolarEclipse{}, false
	}

	magnitude := (sunSemidiameter + moonSemidiameter - least) / (2 * sunSemidiameter)
	kind := SolarPartial
	if least < math.Abs(moonSemidiameter-sunSemidiameter) {
		if moonSemidiameter >= sunSemidiameter {
			kind = SolarTotal
		} else {
			kind = SolarAnnular
		}
	}

	const probe = 600_000
	rate := math.Max(1e-12,
		math.Abs(SolarViewAt(ctx, int64(peakMs+probe), location).Separation-least)/probe)
	seed := func(threshold float64) float64 {
		return math.Sqrt(math.Max(0, float64(threshold*threshold)-float64(least*least))) / rate
	}

	outerGap := func(ms float64) float64 {
		v := SolarViewAt(ctx, int64(ms), location)
		return v.Separation - (v.SunSemidiameter + v.MoonSemidiameter)
	}
	innerGap := func(ms float64) float64 {
		v := SolarViewAt(ctx, int64(ms), location)
		return v.Separation - math.Abs(v.MoonSemidiameter-v.SunSemidiameter)
	}

	outerThreshold := sunSemidiameter + moonSemidiameter
	innerThreshold := math.Abs(moonSemidiameter - sunSemidiameter)

	beginMs, okBegin := solveCrossing(outerGap, peakMs, -1, seed(outerThreshold), solarContactLimitMS)
	endMs, okEnd := solveCrossing(outerGap, peakMs, 1, seed(outerThreshold), solarContactLimitMS)
	if !okBegin || !okEnd {
		return LocalSolarEclipse{}, false
	}

	var centralBegin, centralEnd *int64
	if kind != SolarPartial {
		if b, ok := solveCrossing(innerGap, peakMs, -1, seed(innerThreshold), solarContactLimitMS); ok {
			ms := int64(jsnum.Round(b))
			centralBegin = &ms
		}
		if e, ok := solveCrossing(innerGap, peakMs, 1, seed(innerThreshold), solarContactLimitMS); ok {
			ms := int64(jsnum.Round(e))
			centralEnd = &ms
		}
	}

	partialBegin := int64(jsnum.Round(beginMs))
	partialEnd := int64(jsnum.Round(endMs))

	return LocalSolarEclipse{
		Kind:           kind,
		PeakMs:         int64(jsnum.Round(peakMs)),
		PartialBeginMs: partialBegin,
		PartialEndMs:   partialEnd,
		CentralBeginMs: centralBegin,
		CentralEndMs:   centralEnd,
		Obscuration:    DiscObscuration(least, sunSemidiameter, moonSemidiameter),
		Magnitude:      magnitude,
		PeakAltitude:   peakAltitude,
		BeginAltitude:  SolarViewAt(ctx, partialBegin, location).SunAltitude,
		EndAltitude:    SolarViewAt(ctx, partialEnd, location).SunAltitude,
		PeakAzimuth:    peakAzimuth,
	}, true
}
