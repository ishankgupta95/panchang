package astronomy

import (
	"math"
	"sync"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy/series"
)

func nutationDirect(t float64) (dpsi, deps float64) {
	args := fundamentalArguments(t)
	multSin, multCos := fillMultipleTables(args)
	return sumNutation(series.NUTATION_PSI, series.NUTATION_PSI_ARGS, t, &multSin, &multCos),
		sumNutation(series.NUTATION_EPS, series.NUTATION_EPS_ARGS, t, &multSin, &multCos)
}

func TestNutationMemoHitEqualsMiss(t *testing.T) {
	ctx := NewEphemerisCtx()
	epochs := []float64{0, 0.25, -0.25, 1.0, -1.5, 1e-9, 0.123456789}
	for _, tt := range epochs {
		missPsi, missEps := Nutation(ctx, tt)
		hitPsi, hitEps := Nutation(ctx, tt)
		if math.Float64bits(missPsi) != math.Float64bits(hitPsi) ||
			math.Float64bits(missEps) != math.Float64bits(hitEps) {
			t.Errorf("t=%v: miss (%v, %v), hit (%v, %v)", tt, missPsi, missEps, hitPsi, hitEps)
		}
		wantPsi, wantEps := nutationDirect(tt)
		if math.Float64bits(missPsi) != math.Float64bits(wantPsi) ||
			math.Float64bits(missEps) != math.Float64bits(wantEps) {
			t.Errorf("t=%v: memoised (%v, %v), direct (%v, %v)", tt, missPsi, missEps, wantPsi, wantEps)
		}
	}
}

func TestNutationMemoEviction(t *testing.T) {
	ctx := NewEphemerisCtx()
	for pass := 0; pass < 2; pass++ {
		for i := 0; i < 20; i++ {
			tt := float64(i) * 0.05
			gotPsi, gotEps := Nutation(ctx, tt)
			wantPsi, wantEps := nutationDirect(tt)
			if math.Float64bits(gotPsi) != math.Float64bits(wantPsi) ||
				math.Float64bits(gotEps) != math.Float64bits(wantEps) {
				t.Fatalf("pass %d, t=%v: memo returned (%v, %v), want (%v, %v)",
					pass, tt, gotPsi, gotEps, wantPsi, wantEps)
			}
		}
	}
	if ctx.nutMemoLive != nutationMemoSize {
		t.Errorf("memo live count is %d after 40 inserts, want %d", ctx.nutMemoLive, nutationMemoSize)
	}
}

func TestNutationAtJ2000(t *testing.T) {
	ctx := NewEphemerisCtx()
	dpsi, deps := Nutation(ctx, 0)
	if dpsi == 0 && deps == 0 {
		t.Fatal("nutation at J2000 returned (0, 0): an unwritten memo slot matched")
	}
	wantPsi, wantEps := nutationDirect(0)
	if dpsi != wantPsi || deps != wantEps {
		t.Fatalf("Nutation(0) = (%v, %v), direct gives (%v, %v)", dpsi, deps, wantPsi, wantEps)
	}
	// The physical envelope is ±17.2″ and ±9.2″.
	if math.Abs(dpsi) > 20 || math.Abs(deps) > 12 {
		t.Errorf("nutation at J2000 = (%v, %v)″, outside the physical envelope", dpsi, deps)
	}
}

func TestNutationEnvelope(t *testing.T) {
	ctx := NewEphemerisCtx()
	var maxPsi, maxEps float64
	for i := -300; i <= 300; i++ {
		tt := float64(i) / 200
		dpsi, deps := Nutation(ctx, tt)
		maxPsi = math.Max(maxPsi, math.Abs(dpsi))
		maxEps = math.Max(maxEps, math.Abs(deps))
	}
	if maxPsi < 15 || maxPsi > 20 {
		t.Errorf("max |Δψ| over 1850-2150 is %v″, expected ~17.2″", maxPsi)
	}
	if maxEps < 8 || maxEps > 12 {
		t.Errorf("max |Δε| over 1850-2150 is %v″, expected ~9.2″", maxEps)
	}
	t.Logf("max |Δψ| %.4f″, max |Δε| %.4f″ over |t| ≤ 1.5", maxPsi, maxEps)
}

func TestMeanObliquityAtJ2000(t *testing.T) {
	if got := MeanObliquityArcsec(0); got != eps0Arcsec {
		t.Errorf("MeanObliquityArcsec(0) = %v, want eps0Arcsec = %v", got, eps0Arcsec)
	}
	if got := MeanObliquityArcsec(1); math.Abs(got-84334.57) > 0.1 {
		t.Errorf("MeanObliquityArcsec(1) = %v″, expected ≈ 84334.57″", got)
	}
}

func TestFundamentalArgumentsAreReduced(t *testing.T) {
	for _, tt := range []float64{-1.5, -1, 0, 1, 1.5} {
		args := fundamentalArguments(tt)
		for k := 0; k < 5; k++ {
			if math.Abs(args[k]) > 2*math.Pi {
				t.Errorf("t=%v: Delaunay argument %d = %v rad, not reduced modulo a turn", tt, k, args[k])
			}
		}
		// Arguments 5-13 are deliberately unreduced; the fastest reaches ~3900 rad, inside trig.go's Cody-Waite domain.
		for k := 5; k < 14; k++ {
			if math.Abs(args[k]) > 1e5 {
				t.Errorf("t=%v: argument %d = %v rad, outside trig.go's stated domain", tt, k, args[k])
			}
		}
	}
}

func TestFillMultipleTablesRecurrence(t *testing.T) {
	const bound = 1e-9
	for _, tt := range []float64{-1.5, 0, 0.37, 1.5} {
		args := fundamentalArguments(tt)
		multSin, multCos := fillMultipleTables(args)

		worstIdentity := 0.0
		for i := 0; i < 14*multipleCount; i++ {
			d := math.Abs(multSin[i]*multSin[i] + multCos[i]*multCos[i] - 1)
			worstIdentity = math.Max(worstIdentity, d)
		}
		if worstIdentity > bound {
			t.Errorf("t=%v: sin² + cos² − 1 reaches %.3e in the multiple tables, bound %.0e",
				tt, worstIdentity, bound)
		}

		worstDirect := 0.0
		for a := 0; a < 5; a++ { // the reduced Delaunay arguments only
			for k := 0; k < multipleCount; k++ {
				i := a*multipleCount + k
				worstDirect = math.Max(worstDirect, math.Abs(multSin[i]-Sin(float64(k)*args[a])))
				worstDirect = math.Max(worstDirect, math.Abs(multCos[i]-Cos(float64(k)*args[a])))
			}
		}
		if worstDirect > bound {
			t.Errorf("t=%v: Delaunay multiples drift from direct evaluation by %.3e, bound %.0e",
				tt, worstDirect, bound)
		}
		t.Logf("t=%+.2f: identity %.3e, Delaunay-vs-direct %.3e", tt, worstIdentity, worstDirect)
	}
}

func TestNutationMaxMultiplierBoundsTheTables(t *testing.T) {
	for name, table := range map[string][]int8{
		"NUTATION_PSI_ARGS": series.NUTATION_PSI_ARGS,
		"NUTATION_EPS_ARGS": series.NUTATION_EPS_ARGS,
	} {
		for i, v := range table {
			m := int(v)
			if m < 0 {
				m = -m
			}
			if m > series.NUTATION_MAX_MULTIPLIER {
				t.Fatalf("%s[%d] = %d exceeds NUTATION_MAX_MULTIPLIER = %d; "+
					"fillMultipleTables would be indexed past its end",
					name, i, v, series.NUTATION_MAX_MULTIPLIER)
			}
		}
	}
}

func TestElpToEclipticOfDateIsARotation(t *testing.T) {
	for _, tt := range []float64{-1.5, -0.5, 0, 0.37, 1.0, 1.5} {
		lon := MoonElpLongitude(tt)
		lat := MoonElpLatitudeCoarse(tt)
		dist := MoonElpDistanceCoarse(tt)
		v := ElpToEclipticOfDate(lon, lat, dist, tt)
		got := math.Sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2])
		if d := math.Abs(got-dist) / dist; d > 1e-14 {
			t.Errorf("t=%v: |out| = %v km, input distance %v km (rel %.3e)", tt, got, dist, d)
		}
		w := ElpToEclipticOfDate(lon, lat, 1, tt)
		for axis := 0; axis < 3; axis++ {
			if d := math.Abs(v[axis]/dist - w[axis]); d > 1e-14 {
				t.Errorf("t=%v axis %d: not radius-homogeneous, off by %.3e", tt, axis, d)
			}
		}
	}
}

func TestElpPrecessionRemovesTheJ2000Origin(t *testing.T) {
	wrap := func(x float64) float64 {
		x = math.Mod(x, 2*math.Pi)
		if x > math.Pi {
			x -= 2 * math.Pi
		} else if x <= -math.Pi {
			x += 2 * math.Pi
		}
		return x
	}
	offset := func(tt float64) float64 {
		lon := MoonElpLongitude(tt)
		v := ElpToEclipticOfDate(lon, MoonElpLatitudeCoarse(tt), 1, tt)
		return wrap(math.Atan2(v[1], v[0]) - lon)
	}
	// 5028.796″/century (IAU 2006); the ecliptic's own tilt change costs a few arcsec, hence 5″.
	perCentury := (offset(1) - offset(0)) / ArcsecToRad
	if math.Abs(perCentury-5028.796) > 5 {
		t.Errorf("frame rotation contributes %.3f″/century, expected ≈ 5028.8″ (general precession)", perCentury)
	}
	half := (offset(0.5) - offset(0)) / ArcsecToRad
	if math.Abs(half-perCentury/2) > 5 {
		t.Errorf("the drift is not linear: %.3f″ over half a century against %.3f″ over a full one",
			half, perCentury)
	}
	t.Logf("rotation contributes %.3f″/century (general precession in longitude is 5028.796″)", perCentury)
}

func TestFrameConstants(t *testing.T) {
	if VsopToFK5Arcsec != -0.09033 {
		t.Errorf("VsopToFK5Arcsec = %v, published −0.09033″", VsopToFK5Arcsec)
	}
	if VsopToFK5LatArcsec != 0.03916 {
		t.Errorf("VsopToFK5LatArcsec = %v, published 0.03916″", VsopToFK5LatArcsec)
	}
	if AuKm != 149_597_870.7 {
		t.Errorf("AuKm = %v, IAU 2012 defines 149597870.7 km", AuKm)
	}
	// A literal: the natural spelling folds from the exact decimals and would assert the bug back in.
	if KmPerLightDay != 25902068371.199997 {
		t.Errorf("KmPerLightDay = %v, JavaScript computes 25902068371.199997", KmPerLightDay)
	}
	if KmPerLightDay == 299_792.458*86_400 {
		t.Error("KmPerLightDay now equals the exactly-folded product; the float64() barrier has been lost")
	}
}

func TestAuDerivedConstantsRoundLikeJavaScript(t *testing.T) {
	if math.Float64bits(SunRadiusAU) != 0x3f730c5e4cc04fde {
		t.Errorf("SunRadiusAU = %v (%#x), V8 computes 0.004650467260962158 (0x3f730c5e4cc04fde)",
			SunRadiusAU, math.Float64bits(SunRadiusAU))
	}
	if math.Float64bits(sunRadiusAUFolded) == math.Float64bits(SunRadiusAU) {
		t.Error("SunRadiusAU now equals the exactly-folded quotient; the float64 type on AuKm has been lost")
	}
	if MoonRadiusKm != 1738.1 {
		t.Errorf("MoonRadiusKm = %v, want 1738.1", MoonRadiusKm)
	}
	if RefractionNearHorizonDeg != 34.0/60 {
		t.Error("RefractionNearHorizonDeg is not 34/60")
	}
	if math.Float64bits(RefractionNearHorizonDeg) != 0x3fe2222222222222 {
		t.Errorf("RefractionNearHorizonDeg = %#x, V8 computes 0x3fe2222222222222",
			math.Float64bits(RefractionNearHorizonDeg))
	}
}

// Untyped, so the test above fails if the type on AuKm is ever dropped.
const auKmUntyped = 149_597_870.7
const sunRadiusAUFolded = 695700.0 / auKmUntyped

func TestNutationIsPerRequest(t *testing.T) {
	epochs := []float64{0, 0.25, -0.25, 1.0, -1.5}
	want := make([][2]float64, len(epochs))
	for i, tt := range epochs {
		p, e := nutationDirect(tt)
		want[i] = [2]float64{p, e}
	}
	var wg sync.WaitGroup
	bad := make([]bool, 16)
	for w := 0; w < 16; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			ctx := NewEphemerisCtx()
			for pass := 0; pass < 40; pass++ {
				for i, tt := range epochs {
					p, e := Nutation(ctx, tt)
					if p != want[i][0] || e != want[i][1] {
						bad[w] = true
						return
					}
				}
			}
		}(w)
	}
	wg.Wait()
	for w, b := range bad {
		if b {
			t.Errorf("worker %d: nutation diverged under concurrency", w)
		}
	}
}

func BenchmarkNutationCold(b *testing.B) {
	t := 0.0
	for i := 0; i < b.N; i++ {
		t += 1e-7
		dpsi, _ := Nutation(NewEphemerisCtx(), t)
		sinkFloat += dpsi
	}
}

func BenchmarkNutationWarm(b *testing.B) {
	ctx := NewEphemerisCtx()
	Nutation(ctx, 0.25)
	for i := 0; i < b.N; i++ {
		dpsi, _ := Nutation(ctx, 0.25)
		sinkFloat += dpsi
	}
}
