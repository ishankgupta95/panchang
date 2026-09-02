package astronomy

import (
	"encoding/json"
	"fmt"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"math"
	"os"
	"sort"
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
)

type positionsGolden struct {
	Meta         map[string]any       `json:"_meta"`
	Seed         uint32               `json:"seed"`
	Samples      int                  `json:"samples"`
	SamplesShort int                  `json:"samplesShort"`
	MsLo         int64                `json:"msLo"`
	MsHi         int64                `json:"msHi"`
	Digests      map[string]string    `json:"digests"`
	DigestsShort map[string]string    `json:"digestsShort"`
	CaseInstants []int64              `json:"caseInstants"`
	Cases        map[string][]float64 `json:"cases"`

	RefractionAltitudes []float64 `json:"refractionAltitudes"`
	RefractionValues    []float64 `json:"refractionValues"`
}

func loadPositionsGolden(t *testing.T) positionsGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "astronomy", "positions-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v (regenerate with `bash go/parity/goldens.sh`)", err)
	}
	var g positionsGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	return g
}

func positionAccessors() map[string]func(int64) float64 {
	out := map[string]func(int64) float64{
		"getTropicalSunLongitude":  func(ms int64) float64 { return GetTropicalSunLongitude(NewEphemerisCtx(), ms) },
		"getTropicalMoonLongitude": func(ms int64) float64 { return GetTropicalMoonLongitude(NewEphemerisCtx(), ms) },
		"dateToJulianDay":          DateToJulianDay,
		"getSiderealSunLongitude:lahiri": func(ms int64) float64 {
			v, err := GetSiderealSunLongitude(NewEphemerisCtx(), ms, types.Lahiri)
			if err != nil {
				panic(err)
			}
			return v
		},
		"getSiderealMoonLongitude:lahiri": func(ms int64) float64 {
			v, err := GetSiderealMoonLongitude(NewEphemerisCtx(), ms, types.Lahiri)
			if err != nil {
				panic(err)
			}
			return v
		},
	}
	planets := map[string]PlanetBody{
		"mercury": PlanetMercury, "venus": PlanetVenus, "mars": PlanetMars,
		"jupiter": PlanetJupiter, "saturn": PlanetSaturn,
	}
	field := func(i int) func(lon, lat, dist float64) float64 {
		switch i {
		case 0:
			return func(lon, _, _ float64) float64 { return lon }
		case 1:
			return func(_, lat, _ float64) float64 { return lat }
		default:
			return func(_, _, dist float64) float64 { return dist }
		}
	}
	for i, name := range []string{"longitude", "latitude", "distance"} {
		pick := field(i)
		out["getSunPosition:"+name] = func(ms int64) float64 {
			p := GetSunPosition(NewEphemerisCtx(), ms)
			return pick(p.Longitude, p.Latitude, p.Distance)
		}
		out["getMoonPosition:"+name] = func(ms int64) float64 {
			p := GetMoonPosition(NewEphemerisCtx(), ms)
			return pick(p.Longitude, p.Latitude, p.Distance)
		}
		out["getMoonPositionForTrack:"+name] = func(ms int64) float64 {
			p := GetMoonPositionForTrack(NewEphemerisCtx(), ms)
			return pick(p.Longitude, p.Latitude, p.Distance)
		}
		for bodyName, body := range planets {
			b := body
			out[fmt.Sprintf("getPlanetPosition:%s:%s", bodyName, name)] = func(ms int64) float64 {
				p := GetPlanetPosition(NewEphemerisCtx(), b, ms)
				return pick(p.Longitude, p.Latitude, p.Distance)
			}
		}
	}
	for _, typ := range types.AllAyanamsaTypes {
		ty := typ
		out["computeAyanamsa:"+string(ty)] = func(ms int64) float64 {
			v, err := ComputeAyanamsa(ms, ty)
			if err != nil {
				panic(err)
			}
			return v
		}
	}

	locs := map[string]types.GeoLocation{
		"pune":  {Latitude: 18.5204, Longitude: 73.8567, Elevation: 560},
		"polar": {Latitude: 78.2232, Longitude: 15.6267, Elevation: 0},
	}
	utDaysOf := func(ms int64) float64 { return float64(ms-j2000NoonMS) / 86_400_000 }
	gastOf := func(ms int64) float64 {
		return GastDegrees(NewEphemerisCtx(), TTDaysSinceJ2000(ms), utDaysOf(ms))
	}
	out["gastDegrees"] = gastOf
	out["greenwichApparentSiderealDegrees"] = func(ms int64) float64 {
		return GreenwichApparentSiderealDegrees(NewEphemerisCtx(), ms)
	}
	for locName, loc := range locs {
		l := loc
		for axis := 0; axis < 3; axis++ {
			a := axis
			out[fmt.Sprintf("observerVector:%s:%d", locName, axis)] = func(ms int64) float64 {
				return ObserverVector(l.Latitude, l.Longitude, l.Elevation, gastOf(ms))[a]
			}
		}
		out["sunAltitudeDegrees:"+locName] = func(ms int64) float64 {
			return BodyAltitudeDegrees(NewEphemerisCtx(), ms, l, HorizonSun)
		}
		out["moonAltitudeDegrees:"+locName] = func(ms int64) float64 {
			return BodyAltitudeDegrees(NewEphemerisCtx(), ms, l, HorizonMoon)
		}
		out["isSunAboveHorizon:"+locName] = func(ms int64) float64 {
			if IsSunAboveHorizon(NewEphemerisCtx(), ms, l) {
				return 1
			}
			return 0
		}
	}
	for axis := 0; axis < 3; axis++ {
		a := axis
		out[fmt.Sprintf("eclipticToEquatorial:%d", axis)] = func(ms int64) float64 {
			ctx := NewEphemerisCtx()
			p := GetMoonPosition(ctx, ms)
			return EclipticToEquatorial(ctx, p.Longitude, p.Latitude, p.Distance, TTDaysSinceJ2000(ms)/36525)[a]
		}
	}
	out["altitudeDegrees:synthetic"] = func(ms int64) float64 {
		return AltitudeDegrees([3]float64{0.3, -0.7, 0.5}, 18.5204, 73.8567, gastOf(ms))
	}
	return out
}

func positionsUsePlatformTrig(name string) bool {
	switch {
	case name == "getTropicalMoonLongitude",
		name == "getSiderealMoonLongitude:lahiri",
		name == "getSunPosition:latitude":
		return true
	case name == "gastDegrees", name == "greenwichApparentSiderealDegrees",
		name == "altitudeDegrees:synthetic":
		return true
	case strings.HasPrefix(name, "observerVector:"),
		strings.HasPrefix(name, "sunAltitudeDegrees:"),
		strings.HasPrefix(name, "moonAltitudeDegrees:"),
		strings.HasPrefix(name, "isSunAboveHorizon:"),
		strings.HasPrefix(name, "eclipticToEquatorial:"):
		return true
	case strings.HasPrefix(name, "getPlanetPosition:"):
		return true
	case strings.HasPrefix(name, "getMoonPosition:"),
		strings.HasPrefix(name, "getMoonPositionForTrack:"):
		return !strings.HasSuffix(name, ":distance")
	}
	return false
}

func TestPositionsBitIdenticalToTypeScript(t *testing.T) {
	g := loadPositionsGolden(t)
	accessors := positionAccessors()
	samples, digests := g.Samples, g.Digests
	if os.Getenv("GEN_FULL") == "" {
		samples, digests = g.SamplesShort, g.DigestsShort
	}
	if len(accessors) != len(g.Digests) {
		t.Errorf("Go has %d accessors, the golden has %d", len(accessors), len(g.Digests))
	}

	instants := func(count int, yield func(float64)) {
		unit01(g.Seed, count, func(u float64) {
			yield(math.Floor(float64(g.MsLo) + u*float64(g.MsHi-g.MsLo)))
		})
	}

	names := make([]string, 0, len(digests))
	for n := range digests {
		names = append(names, n)
	}
	sort.Strings(names)
	exact := 0
	for _, name := range names {
		fn, ok := accessors[name]
		if !ok {
			t.Errorf("%s: in the golden, not in the Go accessor map", name)
			continue
		}
		if positionsUsePlatformTrig(name) {
			continue
		}
		exact++
		got := deltaTDigest(samples, instants, func(ms float64) float64 { return fn(int64(ms)) })
		if got != digests[name] {
			t.Errorf("%s: digest %s, golden %s. Go and TS have diverged over %d instants",
				name, got, digests[name], samples)
		}
	}
	for name := range accessors {
		if _, ok := g.Digests[name]; !ok {
			t.Errorf("%s: in the Go accessor map, not in the golden", name)
		}
	}
	if exact != 12 {
		t.Errorf("%d accessors were held to bit-identity; expected exactly 12", exact)
	}
	t.Logf("%d of %d accessors bit-identical over %d instants; the rest go through "+
		"math.Atan2/math.Asin and are bounded below", exact, len(accessors), samples)
}

func TestPositionsWithinPlatformTrigBound(t *testing.T) {
	const angleBoundDeg = 1e-11
	const relativeBound = 1e-9
	g := loadPositionsGolden(t)
	accessors := positionAccessors()

	worstAngle, worstAngleAt := 0.0, ""
	worstRel, worstRelAt := 0.0, ""
	checked := 0
	for name, want := range g.Cases {
		if !positionsUsePlatformTrig(name) {
			continue
		}
		checked++
		fn := accessors[name]
		isDistance := strings.HasSuffix(name, ":distance") ||
			strings.HasPrefix(name, "observerVector:") ||
			strings.HasPrefix(name, "eclipticToEquatorial:")
		for i, ms := range g.CaseInstants {
			got := fn(ms)
			if isDistance {
				if d := math.Abs(got-want[i]) / math.Abs(want[i]); d > worstRel {
					worstRel, worstRelAt = d, name
				}
				continue
			}
			d := math.Abs(angularDelta(got, want[i]))
			if d > worstAngle {
				worstAngle, worstAngleAt = d, name
			}
		}
	}
	if checked == 0 {
		t.Fatal("no platform-trig accessors were checked; the classifier has stopped matching")
	}
	if worstAngle > angleBoundDeg {
		t.Errorf("worst angular |Δ| %.3e deg (%s), bound %.0e", worstAngle, worstAngleAt, angleBoundDeg)
	}
	if worstRel > relativeBound {
		t.Errorf("worst relative |Δ| %.3e (%s), bound %.0e", worstRel, worstRelAt, relativeBound)
	}
	t.Logf("%d bounded accessors over %d instants: worst angle %.3e deg (%s), worst relative %.3e (%s)",
		checked, len(g.CaseInstants), worstAngle, worstAngleAt, worstRel, worstRelAt)
}

func TestRefractionMatchesTypeScript(t *testing.T) {
	g := loadPositionsGolden(t)
	if len(g.RefractionAltitudes) == 0 || len(g.RefractionAltitudes) != len(g.RefractionValues) {
		t.Fatalf("golden refraction sweep is malformed: %d altitudes, %d values",
			len(g.RefractionAltitudes), len(g.RefractionValues))
	}
	worst, worstAt := 0.0, 0.0
	for i, alt := range g.RefractionAltitudes {
		if d := math.Abs(RefractionDegrees(alt) - g.RefractionValues[i]); d > worst {
			worst, worstAt = d, alt
		}
	}
	if worst > 1e-12 {
		t.Errorf("refraction: worst |Δ| %.3e deg at altitude %v°, bound 1e-12", worst, worstAt)
	}
	t.Logf("refraction over %d altitudes in [-95, 95]: worst |Δ| %.3e deg at %v°",
		len(g.RefractionAltitudes), worst, worstAt)
}

func TestRefractionIsMonotonic(t *testing.T) {
	prev := math.Inf(-1)
	for a := -90.0; a <= 90.0; a += 0.01 {
		refracted := a + RefractionDegrees(a)
		if refracted < prev {
			t.Fatalf("refracted altitude is not monotonic at %v°: %v after %v", a, refracted, prev)
		}
		prev = refracted
	}
	for _, a := range []float64{-90.0001, 90.0001, 180, -180} {
		if got := RefractionDegrees(a); got != 0 {
			t.Errorf("RefractionDegrees(%v) = %v, want 0 outside [-90, 90]", a, got)
		}
	}
	if got := RefractionDegrees(0); math.Abs(got-0.4833) > 0.001 {
		t.Errorf("Saemundsson at geometric 0° is %v°, expected ≈0.4833°", got)
	}
	if RefractionNearHorizonDeg <= RefractionDegrees(0) {
		t.Error("the 34′ rise/set convention should exceed Saemundsson at geometric zero")
	}
}

func TestObserverVectorEllipsoid(t *testing.T) {
	const auPerKm = 1 / AuKm
	eq := ObserverVector(0, 0, 0, 0)
	if d := math.Abs(math.Sqrt(eq[0]*eq[0]+eq[1]*eq[1]+eq[2]*eq[2])/auPerKm - EarthEquatorialRadiusKm); d > 1e-6 {
		t.Errorf("equatorial observer radius is off by %v km", d)
	}
	pole := ObserverVector(90, 0, 0, 0)
	wantPolar := EarthEquatorialRadiusKm * EarthFlatteningSquared / earthFlattening
	if d := math.Abs(math.Abs(pole[2])/auPerKm - wantPolar); d > 1e-6 {
		t.Errorf("polar observer radius is %v km, want %v km", math.Abs(pole[2])/auPerKm, wantPolar)
	}
	if d := EarthEquatorialRadiusKm - wantPolar; d < 21.0 || d > 21.6 {
		t.Errorf("equatorial − polar radius is %v km, expected ~21.4 km", d)
	}
	high := ObserverVector(0, 0, 1000, 0)
	if d := math.Abs((math.Sqrt(high[0]*high[0]+high[1]*high[1]+high[2]*high[2])-
		math.Sqrt(eq[0]*eq[0]+eq[1]*eq[1]+eq[2]*eq[2]))/auPerKm - 1.0); d > 1e-9 {
		t.Errorf("1000 m of elevation moved the observer by %v km off 1 km", d)
	}
}

func TestGastAdvancesOneSiderealDay(t *testing.T) {
	ctx := NewEphemerisCtx()
	start := utcMS(2025, 5, 15)
	siderealDaySec := 86164.0905
	siderealDayMS := int64(siderealDaySec * 1000)
	g0 := GreenwichApparentSiderealDegrees(ctx, start)
	g1 := GreenwichApparentSiderealDegrees(ctx, start+siderealDayMS)
	d := math.Abs(angularDelta(g1, g0))
	if d > 0.01 {
		t.Errorf("GAST advanced %v° over one sidereal day, expected ~0°", d)
	}
	g2 := GreenwichApparentSiderealDegrees(ctx, start+86_400_000)
	adv := g2 - g0
	for adv < 0 {
		adv += 360
	}
	if math.Abs(adv-0.9856) > 0.01 {
		t.Errorf("GAST advanced %v° beyond a full turn in one solar day, expected 0.9856°", adv)
	}
	for i := 0; i < 500; i++ {
		g := GreenwichApparentSiderealDegrees(ctx, start+int64(i)*3_600_000)
		if g < 0 || g >= 360 {
			t.Fatalf("GAST = %v, outside [0, 360)", g)
		}
	}
}

func TestAyanamsaMatchesAlmanac(t *testing.T) {
	const arcsec = 1.0 / 3600
	almanac := []struct {
		ms        int64
		published float64
	}{
		{utcMS(1950, 0, 1), 23.165393},
		{utcMS(1975, 0, 1), 23.514568},
		{utcMS(2000, 0, 1), 23.863782},
		{utcMS(2010, 0, 1), 24.003501},
		{utcMS(2020, 0, 1), 24.143189},
		{utcMS(2025, 0, 14), 24.213570},
		{utcMS(2030, 0, 1), 24.282920},
		{utcMS(2050, 0, 1), 24.562364},
	}
	worst := 0.0
	for _, c := range almanac {
		ours, err := ComputeAyanamsa(c.ms, types.Lahiri)
		if err != nil {
			t.Fatalf("ComputeAyanamsa: %v", err)
		}
		drift := math.Abs(ours-c.published) / arcsec
		if drift >= 0.01 {
			t.Errorf("%d: ours %.6f vs almanac %.6f, %.4f″ apart, bound 0.01″", c.ms, ours, c.published, drift)
		}
		worst = math.Max(worst, drift)
	}
	t.Logf("worst drift from the almanac's published Lahiri across 1950-2050: %.5f″ (bound 0.01″)", worst)
}

func TestAyanamsaAnchors(t *testing.T) {
	j2000 := int64(946_728_000_000)
	for _, c := range []struct {
		typ  types.AyanamsaType
		want float64
	}{
		{types.Lahiri, 23.863801},
		{types.Raman, 22.410791},
	} {
		got, err := ComputeAyanamsa(j2000, c.typ)
		if err != nil {
			t.Fatalf("ComputeAyanamsa: %v", err)
		}
		if math.Abs(got-c.want) > 1e-5 {
			t.Errorf("%s at J2000 = %.6f°, anchor %.6f°", c.typ, got, c.want)
		}
	}
}

func TestAyanamsaOffsetsFromLahiri(t *testing.T) {
	j2000 := int64(946_728_000_000)
	lahiri, err := ComputeAyanamsa(j2000, types.Lahiri)
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range []struct {
		typ    types.AyanamsaType
		offset float64
	}{
		{types.TrueChitra, -0.0006},
		{types.Krishnamurti, -0.079605},
		{types.Thirukanitham, +0.018456},
		{types.Raman, -1.453010},
	} {
		got, err := ComputeAyanamsa(j2000, c.typ)
		if err != nil {
			t.Fatal(err)
		}
		if d := math.Abs((got - lahiri) - c.offset); d > 1e-6 {
			t.Errorf("%s offset from Lahiri at J2000 = %.6f°, documented %.6f°", c.typ, got-lahiri, c.offset)
		}
	}
}

func TestAyanamsaSharesOnePrecessionRate(t *testing.T) {
	t0, t1 := utcMS(2000, 0, 1), utcMS(2050, 0, 1)
	expected := (5029.0966 / 3600) * (50.0 / 100)
	for _, typ := range types.AllAyanamsaTypes {
		a0, _ := ComputeAyanamsa(t0, typ)
		a1, _ := ComputeAyanamsa(t1, typ)
		if d := math.Abs((a1 - a0) - expected); d > 0.05 {
			t.Errorf("%s advances %.6f° over 50 years, expected %.6f°", typ, a1-a0, expected)
		}
	}
}

func TestAyanamsaRejectsUnknownType(t *testing.T) {
	for _, bad := range []types.AyanamsaType{"", "unknown", "LAHIRI", "sayana"} {
		_, err := ComputeAyanamsa(0, bad)
		if err == nil {
			t.Errorf("ComputeAyanamsa accepted %q", bad)
			continue
		}
		var pe *types.PanchangError
		if !asPanchangError(err, &pe) || pe.Code != types.ErrInvalidAyanamsa {
			t.Errorf("ComputeAyanamsa(%q) returned %v, want a PanchangError with code INVALID_AYANAMSA", bad, err)
		}
	}
}

func asPanchangError(err error, out **types.PanchangError) bool {
	pe, ok := err.(*types.PanchangError)
	if ok {
		*out = pe
	}
	return ok
}
