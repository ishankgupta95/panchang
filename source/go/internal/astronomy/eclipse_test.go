package astronomy

import (
	"math"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

func TestEclipseContactsAreOrdered(t *testing.T) {
	ctx := NewEphemerisCtx()
	checked, withUmbra, withTotality := 0, 0, 0
	cursor := utcMS(2000, 0, 1)
	for i := 0; i < 400; i++ {
		opposition, ok := SearchMoonPhase(ctx, 180, cursor, 45)
		if !ok {
			break
		}
		cursor = opposition + 10*dayMS
		e, found := FindLunarEclipse(ctx, opposition)
		if !found {
			continue
		}
		checked++
		if !(e.PenumbralBeginMs < e.PeakMs && e.PeakMs < e.PenumbralEndMs) {
			t.Errorf("peak %d is outside [%d, %d]", e.PeakMs, e.PenumbralBeginMs, e.PenumbralEndMs)
		}
		if e.PartialBeginMs != nil && e.PartialEndMs != nil {
			withUmbra++
			if !(e.PenumbralBeginMs < *e.PartialBeginMs && *e.PartialBeginMs < e.PeakMs) {
				t.Errorf("U1 %d is not between P1 %d and peak %d", *e.PartialBeginMs, e.PenumbralBeginMs, e.PeakMs)
			}
			if !(e.PeakMs < *e.PartialEndMs && *e.PartialEndMs < e.PenumbralEndMs) {
				t.Errorf("U4 %d is not between peak %d and P4 %d", *e.PartialEndMs, e.PeakMs, e.PenumbralEndMs)
			}
		}
		if e.TotalBeginMs != nil && e.TotalEndMs != nil {
			withTotality++
			if e.PartialBeginMs == nil || *e.TotalBeginMs <= *e.PartialBeginMs {
				t.Errorf("U2 %d is not inside the umbral phase", *e.TotalBeginMs)
			}
			if e.PartialEndMs == nil || *e.TotalEndMs >= *e.PartialEndMs {
				t.Errorf("U3 %d is not inside the umbral phase", *e.TotalEndMs)
			}
			if !(*e.TotalBeginMs < e.PeakMs && e.PeakMs < *e.TotalEndMs) {
				t.Errorf("peak %d is outside totality [%d, %d]", e.PeakMs, *e.TotalBeginMs, *e.TotalEndMs)
			}
		}
		switch e.Kind {
		case LunarTotal:
			if e.UmbralMagnitude < 1 || e.TotalBeginMs == nil {
				t.Errorf("a total eclipse with umbral magnitude %v and totality %v", e.UmbralMagnitude, e.TotalBeginMs)
			}
		case LunarPartial:
			if !(e.UmbralMagnitude > 0 && e.UmbralMagnitude < 1) || e.PartialBeginMs == nil || e.TotalBeginMs != nil {
				t.Errorf("a partial eclipse with umbral magnitude %v", e.UmbralMagnitude)
			}
		case LunarPenumbral:
			if e.UmbralMagnitude > 0 || e.PartialBeginMs != nil {
				t.Errorf("a penumbral eclipse with umbral magnitude %v and umbral contacts %v",
					e.UmbralMagnitude, e.PartialBeginMs)
			}
			if e.UmbralObscuration != 0 {
				t.Errorf("a penumbral eclipse with umbral obscuration %v", e.UmbralObscuration)
			}
		}
		if e.PenumbralMagnitude <= e.UmbralMagnitude {
			t.Errorf("penumbral magnitude %v is not above umbral %v", e.PenumbralMagnitude, e.UmbralMagnitude)
		}
	}
	if checked < 40 || withUmbra < 20 || withTotality < 10 {
		t.Errorf("thin sample: %d eclipses, %d with umbra, %d with totality", checked, withUmbra, withTotality)
	}
	t.Logf("%d lunar eclipses: %d with an umbral phase, %d total, all correctly ordered",
		checked, withUmbra, withTotality)
}

func TestSolarContactsAreOrdered(t *testing.T) {
	ctx := NewEphemerisCtx()
	casper := types.GeoLocation{Latitude: 42.8666, Longitude: -106.3131, Elevation: 1580}
	conjunction, ok := SearchMoonPhase(ctx, 0, utcMS(2017, 7, 19), 5)
	if !ok {
		t.Fatal("no conjunction near 2017-08-21")
	}
	e, found := FindLocalSolarEclipse(ctx, conjunction, casper)
	if !found {
		t.Fatal("Casper sees no eclipse on 2017-08-21; it is inside the path of totality")
	}
	if e.Kind != SolarTotal {
		t.Errorf("Casper 2017-08-21 is %s, expected total", e.Kind)
	}
	if !(e.PartialBeginMs < e.PeakMs && e.PeakMs < e.PartialEndMs) {
		t.Errorf("peak %d outside [C1 %d, C4 %d]", e.PeakMs, e.PartialBeginMs, e.PartialEndMs)
	}
	if e.CentralBeginMs == nil || e.CentralEndMs == nil {
		t.Fatal("a total eclipse with no central contacts")
	}
	if !(e.PartialBeginMs < *e.CentralBeginMs && *e.CentralBeginMs < e.PeakMs &&
		e.PeakMs < *e.CentralEndMs && *e.CentralEndMs < e.PartialEndMs) {
		t.Errorf("C2/C3 %d/%d are not nested inside C1/C4", *e.CentralBeginMs, *e.CentralEndMs)
	}
	if d := *e.CentralEndMs - *e.CentralBeginMs; d < 120_000 || d > 180_000 {
		t.Errorf("totality lasted %d ms; the published duration at Casper is ~146 s", d)
	}
	if e.Magnitude < 1 {
		t.Errorf("a total eclipse with magnitude %v", e.Magnitude)
	}
	if math.Abs(e.Obscuration-1) > 1e-9 {
		t.Errorf("a total eclipse obscures %v of the disc, expected 1", e.Obscuration)
	}
	london := types.GeoLocation{Latitude: 51.5074, Longitude: -0.1278}
	p, ok := FindLocalSolarEclipse(ctx, conjunction, london)
	if ok {
		if p.Kind != SolarPartial {
			t.Errorf("London 2017-08-21 is %s, expected partial", p.Kind)
		}
		if p.CentralBeginMs != nil || p.CentralEndMs != nil {
			t.Error("a partial eclipse with central contacts")
		}
		if p.Magnitude >= 1 || p.Obscuration >= 1 {
			t.Errorf("a partial eclipse with magnitude %v and obscuration %v", p.Magnitude, p.Obscuration)
		}
		if p.Obscuration >= p.Magnitude {
			t.Errorf("at magnitude %v the area fraction %v should be smaller", p.Magnitude, p.Obscuration)
		}
	}
	t.Logf("Casper 2017-08-21: %s, totality %d ms, magnitude %.4f", e.Kind, *e.CentralEndMs-*e.CentralBeginMs, e.Magnitude)
}

func TestSutakAnchoring(t *testing.T) {
	ctx := NewEphemerisCtx()
	site := types.GeoLocation{Latitude: 25.3176, Longitude: 82.9739}
	penumbralSeen, umbralSeen, solarSeen := 0, 0, 0

	const lunarWindowDays = 2000
	const solarWindowDays = 4000
	cursor := utcMS(2000, 0, 1)
	for i := 0; i < 40; i++ {
		info, ok := GetUpcomingLunarEclipse(ctx, cursor, site, lunarWindowDays, types.LanguageEn)
		if !ok {
			break
		}
		cursor = info.PeakMs.Ms() + 20*dayMS
		if info.Subtype == EclipsePenumbral {
			penumbralSeen++
			if info.SutakStartMs != nil || info.SutakEndMs != nil {
				t.Errorf("penumbral eclipse at %d carries sutak", info.PeakMs.Ms())
			}
			continue
		}
		umbralSeen++
		if info.SutakStartMs == nil || info.SutakEndMs == nil {
			t.Errorf("umbral eclipse at %d carries no sutak", info.PeakMs.Ms())
			continue
		}
		if info.SutakEndMs.Ms()-info.SutakStartMs.Ms() <= lunarSutakHours*3600_000 {
			t.Errorf("lunar sutak at %d is shorter than its 9 h lead-in", info.PeakMs.Ms())
		}
		if info.SutakStartMs.Ms() >= info.StartMs.Ms() {
			t.Errorf("lunar sutak at %d starts at or after P1", info.PeakMs.Ms())
		}
		if info.SutakEndMs.Ms() >= info.EndMs.Ms() {
			t.Errorf("lunar sutak at %d ends at or after P4; it should end at U4", info.PeakMs.Ms())
		}
	}

	cursor = utcMS(2000, 0, 1)
	for i := 0; i < 40; i++ {
		info, ok := GetUpcomingSolarEclipse(ctx, cursor, site, solarWindowDays, types.LanguageEn)
		if !ok {
			break
		}
		cursor = info.PeakMs.Ms() + 20*dayMS
		solarSeen++
		if info.SutakStartMs == nil || info.SutakEndMs == nil {
			t.Errorf("solar eclipse at %d carries no sutak", info.PeakMs.Ms())
			continue
		}
		if info.SutakStartMs.Ms() != info.StartMs.Ms()-solarSutakHours*3600_000 {
			t.Errorf("solar sutak at %d does not start 12 h before C1", info.PeakMs.Ms())
		}
		if info.SutakEndMs.Ms() != info.EndMs.Ms() {
			t.Errorf("solar sutak at %d does not end at C4", info.PeakMs.Ms())
		}
	}

	if penumbralSeen == 0 || umbralSeen == 0 || solarSeen == 0 {
		t.Fatalf("thin sample: %d penumbral, %d umbral, %d solar", penumbralSeen, umbralSeen, solarSeen)
	}
	t.Logf("%d penumbral (no sutak), %d umbral, %d solar eclipses checked",
		penumbralSeen, umbralSeen, solarSeen)
}

func TestSyzygyGuardRejectsMostDays(t *testing.T) {
	ctx := NewEphemerisCtx()
	site := types.GeoLocation{Latitude: 25.3176, Longitude: 82.9739}
	lon := DirectLongitudes(ctx)

	const days = 365
	start := utcMS(2025, 0, 1)
	rejected, passed, found := 0, 0, 0
	var missedEclipse []int64
	for d := 0; d < days; d++ {
		sunrise := start + int64(d)*dayMS + 3600_000
		guardFrom := sunrise - syzygyGuardMarginMS
		guardTo := sunrise + dayMS + syzygyGuardMarginMS
		letThrough := syzygyBetween(guardFrom, guardTo, 0, lon) ||
			syzygyBetween(guardFrom, guardTo, 180, lon)
		if letThrough {
			passed++
		} else {
			rejected++
		}
		info, ok := GetEclipseDuringDay(ctx, sunrise, sunrise+dayMS, site, types.LanguageEn, lon)
		if ok {
			found++
			if !letThrough {
				missedEclipse = append(missedEclipse, info.PeakMs.Ms())
			}
		}
	}
	if len(missedEclipse) != 0 {
		t.Errorf("the guard rejected %d days that carry an eclipse: %v", len(missedEclipse), missedEclipse)
	}
	if rejected < days*8/10 {
		t.Errorf("the guard rejected only %d of %d days; the geometry implies ~86.5%%",
			rejected, days)
	}
	if passed == 0 {
		t.Fatal("the guard rejected every day; no eclipse could ever be reported")
	}
	t.Logf("guard rejected %d of %d days (%.1f%%), let %d through, %d carried an eclipse",
		rejected, days, 100*float64(rejected)/days, passed, found)
}

func BenchmarkLunarShadowAt(b *testing.B) {
	ctx := NewEphemerisCtx()
	base := utcMS(2025, 2, 14)
	for i := 0; i < b.N; i++ {
		LunarShadowAt(ctx, base+int64(i))
	}
}

func BenchmarkSolarViewAt(b *testing.B) {
	ctx := NewEphemerisCtx()
	site := types.GeoLocation{Latitude: 42.8666, Longitude: -106.3131, Elevation: 1580}
	base := utcMS(2017, 7, 21)
	for i := 0; i < b.N; i++ {
		SolarViewAt(ctx, base+int64(i), site)
	}
}

func BenchmarkFindLunarEclipse(b *testing.B) {
	ctx := NewEphemerisCtx()
	opposition, _ := SearchMoonPhase(ctx, 180, utcMS(2025, 2, 10), 45)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		FindLunarEclipse(ctx, opposition)
	}
}

func BenchmarkFindLocalSolarEclipse(b *testing.B) {
	ctx := NewEphemerisCtx()
	site := types.GeoLocation{Latitude: 42.8666, Longitude: -106.3131, Elevation: 1580}
	conjunction, _ := SearchMoonPhase(ctx, 0, utcMS(2017, 7, 19), 5)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		FindLocalSolarEclipse(ctx, conjunction, site)
	}
}

func BenchmarkGetEclipseDuringDayNoEclipse(b *testing.B) {
	ctx := NewEphemerisCtx()
	site := types.GeoLocation{Latitude: 25.3176, Longitude: 82.9739}
	lon := DirectLongitudes(ctx)
	sunrise := utcMS(2025, 0, 14) + 3600_000
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		GetEclipseDuringDay(ctx, sunrise, sunrise+dayMS, site, types.LanguageEn, lon)
	}
}
