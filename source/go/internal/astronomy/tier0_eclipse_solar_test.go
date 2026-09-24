package astronomy

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

func TestTier0SolarEclipsesGeocentric(t *testing.T) {
	canon := loadEclipseCanon(t)
	if len(canon.Solar) != 452 {
		t.Fatalf("fixture has %d solar rows, expected 452", len(canon.Solar))
	}

	type result struct{ gamma, peak worst }
	results := make([]result, len(canon.Solar))

	parallelRows(len(canon.Solar), func(ctx *EphemerisCtx, i int) {
		row := canon.Solar[i]
		r := &results[i]
		approximate := float64(ttJulianDateToUtc(row.JdGreatestTt))
		peakMs := scanMinimum(
			func(ms float64) float64 { return math.Abs(shadowAxisGamma(ctx, ms)) },
			approximate-1800_000, approximate+1800_000, 60_000,
		)
		r.gamma.add(math.Abs(shadowAxisGamma(ctx, peakMs))-math.Abs(row.Gamma), row.Date)
		r.peak.add((utcToTtJulianDate(int64(peakMs))-row.JdGreatestTt)*86400, row.Date)
	})

	var gamma, peak worst
	for i := range results {
		gamma.merge(&results[i].gamma)
		peak.merge(&results[i].peak)
	}

	if math.Abs(gamma.value) >= 0.0002 {
		t.Errorf("gamma (Earth radii): %s, bound 0.0002", gamma.label())
	}
	if math.Abs(peak.value) >= 3.0 {
		t.Errorf("greatest eclipse (s TT): %s, bound 3.0", peak.label())
	}
	t.Logf("gamma (Earth radii): %s", gamma.label())
	t.Logf("greatest eclipse (s TT): %s", peak.label())
}

func TestTier0SolarTypeAndMagnitudeAtGreatestPoint(t *testing.T) {
	canon := loadEclipseCanon(t)
	const nearCentralBand = 0.025
	const grazingAltitudeDeg = 5

	type result struct {
		magnitude, altitude           worst
		typeMismatches, notFound      []string
		inScope, nearCentral, grazing int
	}
	results := make([]result, len(canon.Solar))

	parallelRows(len(canon.Solar), func(ctx *EphemerisCtx, i int) {
		row := canon.Solar[i]
		r := &results[i]
		approximate := ttJulianDateToUtc(row.JdGreatestTt)
		location := types.GeoLocation{Latitude: row.GreatestLatitude, Longitude: row.GreatestLongitude}
		conjunction, ok := SearchMoonPhase(ctx, 0, approximate-2*dayMS, 5)
		if !ok {
			r.notFound = append(r.notFound, "no conjunction near "+row.Date)
			return
		}
		eclipse, found := FindLocalSolarEclipse(ctx, conjunction, location)
		if !found {
			r.notFound = append(r.notFound, row.Date+": no eclipse at the canon's greatest-eclipse point")
			return
		}

		view := SolarViewAt(ctx, eclipse.PeakMs, location)
		r.altitude.add(eclipse.PeakAltitude-row.GreatestSunAltitude, row.Date)

		ours := view.MoonSemidiameter / view.SunSemidiameter
		if row.Kind == "P" {
			ours = eclipse.Magnitude
		}

		if math.Abs(row.Magnitude-1) < nearCentralBand {
			r.nearCentral++
			return
		}

		var expected []SolarEclipseKind
		switch row.Kind {
		case "T":
			expected = []SolarEclipseKind{SolarTotal}
		case "A":
			expected = []SolarEclipseKind{SolarAnnular}
		case "H":
			expected = []SolarEclipseKind{SolarTotal, SolarAnnular}
		default:
			expected = []SolarEclipseKind{SolarPartial}
		}
		matched := false
		for _, e := range expected {
			if eclipse.Kind == e {
				matched = true
			}
		}
		if !matched {
			r.typeMismatches = append(r.typeMismatches,
				fmt.Sprintf("%s canon %s vs ours %s", row.Date, row.Type, eclipse.Kind))
		}

		if row.Kind != "P" && row.GreatestSunAltitude < grazingAltitudeDeg {
			r.grazing++
			return
		}
		r.inScope++
		r.magnitude.add(ours-row.Magnitude, row.Date)
	})

	var magnitude, altitude worst
	var typeMismatches, notFound []string
	inScope, nearCentral, grazing := 0, 0, 0
	for i := range results {
		magnitude.merge(&results[i].magnitude)
		altitude.merge(&results[i].altitude)
		typeMismatches = append(typeMismatches, results[i].typeMismatches...)
		notFound = append(notFound, results[i].notFound...)
		inScope += results[i].inScope
		nearCentral += results[i].nearCentral
		grazing += results[i].grazing
	}

	if len(notFound) != 0 {
		t.Errorf("%d rows unreachable: %v", len(notFound), first(notFound, 5))
	}
	if inScope != 376 {
		t.Errorf("%d rows in scope, expected 376", inScope)
	}
	if nearCentral != 72 {
		t.Errorf("%d rows excluded as near-central, expected 72", nearCentral)
	}
	if grazing != 4 {
		t.Errorf("%d rows excluded as central-and-grazing, expected 4", grazing)
	}
	if len(typeMismatches) != 0 {
		t.Errorf("solar eclipse type is an invariant; %d mismatches: %v",
			len(typeMismatches), first(typeMismatches, 5))
	}
	if math.Abs(magnitude.value) >= 0.002 {
		t.Errorf("magnitude: %s, bound 0.002", magnitude.label())
	}
	if math.Abs(altitude.value) >= 1.2 {
		t.Errorf("sun altitude (deg): %s, bound 1.2", altitude.label())
	}
	t.Logf("magnitude: %s", magnitude.label())
	t.Logf("sun altitude (deg): %s", altitude.label())
	t.Logf("%d in scope, %d near-central excluded, %d grazing excluded", inScope, nearCentral, grazing)
}

func localToUtcMs(site localSite, date, hhmm string) int64 {
	d := strings.Split(date, "-")
	y, _ := strconv.Atoi(d[0])
	mo, _ := strconv.Atoi(d[1])
	dd, _ := strconv.Atoi(d[2])
	t := strings.Split(hhmm, ":")
	hh, _ := strconv.Atoi(t[0])
	mm, _ := strconv.Atoi(t[1])
	return time.Date(y, time.Month(mo), dd, hh, mm, 0, 0, time.UTC).UnixMilli() -
		int64(site.UtcOffsetHours*3600_000)
}

func localEclipseFor(ctx *EphemerisCtx, site localSite, row localRow) (LocalSolarEclipse, bool) {
	location := types.GeoLocation{Latitude: site.Latitude, Longitude: site.Longitude}
	localNoon := localToUtcMs(site, row.Date, "12:00")
	conjunction, ok := SearchMoonPhase(ctx, 0, localNoon-2*dayMS, 5)
	if !ok {
		return LocalSolarEclipse{}, false
	}
	return FindLocalSolarEclipse(ctx, conjunction, location)
}

type flatLocalRow struct {
	site localSite
	row  localRow
}

func flattenLocal(c localCanonFile) []flatLocalRow {
	var out []flatLocalRow
	for _, s := range c.Sites {
		for _, r := range s.Eclipses {
			out = append(out, flatLocalRow{s, r})
		}
	}
	return out
}

func TestTier0SolarLocalCircumstances(t *testing.T) {
	local := loadLocalCanon(t)
	if len(local.Sites) != 10 {
		t.Fatalf("fixture has %d sites, expected 10", len(local.Sites))
	}
	rows := flattenLocal(local)
	if len(rows) != 788 {
		t.Fatalf("fixture has %d local rows, expected 788", len(rows))
	}

	type result struct {
		begin, maximum, end                       worst
		altitude, azimuth, magnitude, obscuration worst
		historical, future                        worst
		missing                                   []string
		clipped                                   int
	}
	results := make([]result, len(rows))

	parallelRows(len(rows), func(ctx *EphemerisCtx, i int) {
		site, row := rows[i].site, rows[i].row
		r := &results[i]
		eclipse, ok := localEclipseFor(ctx, site, row)
		if !ok {
			r.missing = append(r.missing, site.Name+" "+row.Date)
			return
		}
		where := site.Name + " " + row.Date

		if row.BeginsFlag != "" {
			r.clipped++
		} else {
			r.begin.add(float64(eclipse.PartialBeginMs-localToUtcMs(site, row.Date, row.Begins))/1000, where)
		}
		if row.EndsFlag != "" {
			r.clipped++
		} else {
			r.end.add(float64(eclipse.PartialEndMs-localToUtcMs(site, row.Date, row.Ends))/1000, where)
		}

		if row.MaximumFlag != "" {
			r.clipped++
			return
		}
		delta := float64(eclipse.PeakMs-localToUtcMs(site, row.Date, row.Maximum)) / 1000
		r.maximum.add(delta, where)
		year, _ := strconv.Atoi(row.Date[:4])
		if year < 2003 {
			r.historical.add(delta, where)
		} else {
			r.future.add(delta, where)
		}
		r.altitude.add(eclipse.PeakAltitude-row.SunAltitudeDeg, where)
		r.azimuth.add(eclipse.PeakAzimuth-row.SunAzimuthDeg, where)
		r.magnitude.add(eclipse.Magnitude-row.Magnitude, where)
		r.obscuration.add(eclipse.Obscuration-row.Obscuration, where)
	})

	var begin, maximum, end, altitude, azimuth, magnitude, obscuration, historical, future worst
	var missing []string
	clipped := 0
	for i := range results {
		begin.merge(&results[i].begin)
		maximum.merge(&results[i].maximum)
		end.merge(&results[i].end)
		altitude.merge(&results[i].altitude)
		azimuth.merge(&results[i].azimuth)
		magnitude.merge(&results[i].magnitude)
		obscuration.merge(&results[i].obscuration)
		historical.merge(&results[i].historical)
		future.merge(&results[i].future)
		missing = append(missing, results[i].missing...)
		clipped += results[i].clipped
	}

	if len(missing) != 0 {
		t.Errorf("a catalogued local eclipse this library cannot find: %v", first(missing, 5))
	}
	if clipped <= 300 {
		t.Errorf("only %d horizon-clipped times; the exclusion is not being exercised", clipped)
	}

	for _, c := range []struct {
		label string
		w     *worst
		bound float64
	}{
		{"first contact (s)", &begin, 80},
		{"maximum (s)", &maximum, 80},
		{"last contact (s)", &end, 80},
		{"sun altitude (deg)", &altitude, 0.8},
		{"sun azimuth (deg)", &azimuth, 0.8},
		{"magnitude", &magnitude, 0.004},
		{"obscuration", &obscuration, 0.004},
	} {
		if math.Abs(c.w.value) >= c.bound {
			t.Errorf("%s: %s, bound %v", c.label, c.w.label(), c.bound)
		}
		t.Logf("%-20s %s", c.label, c.w.label())
	}

	if math.Abs(historical.bias()) >= 2 {
		t.Errorf("1901-2002 bias (s): %s, bound 2", historical.label())
	}
	if math.Abs(historical.value) >= 50 {
		t.Errorf("1901-2002 max (s): %s, bound 50", historical.label())
	}
	if !(future.bias() > 5 && future.bias() < 30) {
		t.Errorf("2003-2100 bias (s): %s, expected between 5 and 30", future.label())
	}
	t.Logf("1901-2002: %s", historical.label())
	t.Logf("2003-2100: %s", future.label())
	t.Logf("%d clipped times excluded", clipped)
}

func TestTier0SolarPublishedFields(t *testing.T) {
	local := loadLocalCanon(t)
	site := local.Sites[0]
	var rowsInScope []localRow
	for _, row := range site.Eclipses {
		if row.MaximumFlag == "" {
			rowsInScope = append(rowsInScope, row)
		}
	}

	type result struct {
		magnitude, obscuration worst
		notFound               []string
		compared               int
	}
	results := make([]result, len(rowsInScope))

	parallelRows(len(rowsInScope), func(ctx *EphemerisCtx, i int) {
		row := rowsInScope[i]
		r := &results[i]
		maximumMs := localToUtcMs(site, row.Date, row.Maximum)
		info, ok := GetUpcomingSolarEclipse(ctx, maximumMs-2*dayMS,
			types.GeoLocation{Latitude: site.Latitude, Longitude: site.Longitude}, 4, types.LanguageEn)
		if !ok || abs64(info.PeakMs.Ms()-maximumMs) > 6*3600_000 {
			r.notFound = append(r.notFound, site.Name+" "+row.Date)
			return
		}
		r.compared++
		r.magnitude.add(info.Magnitude-row.Magnitude, site.Name+" "+row.Date)
		r.obscuration.add(info.Obscuration-row.Obscuration, site.Name+" "+row.Date)
	})

	var magnitude, obscuration worst
	var notFound []string
	compared := 0
	for i := range results {
		magnitude.merge(&results[i].magnitude)
		obscuration.merge(&results[i].obscuration)
		notFound = append(notFound, results[i].notFound...)
		compared += results[i].compared
	}

	if len(notFound) != 0 {
		t.Errorf("every catalogued local eclipse must be reachable publicly: %v", first(notFound, 5))
	}
	if compared <= 20 {
		t.Errorf("only %d rows compared", compared)
	}
	if math.Abs(magnitude.value) >= 0.004 {
		t.Errorf("published magnitude: %s, bound 0.004", magnitude.label())
	}
	if math.Abs(obscuration.value) >= 0.004 {
		t.Errorf("published obscuration: %s, bound 0.004", obscuration.label())
	}
	t.Logf("%d rows: published magnitude %s; obscuration %s", compared, magnitude.label(), obscuration.label())
}

func TestTier0SolarSubtypeAndDescriptionAsSeen(t *testing.T) {
	local := loadLocalCanon(t)
	rows := flattenLocal(local)
	localType := map[string]EclipseSubtype{"p": EclipsePartial, "a": EclipseAnnular, "t": EclipseTotal}
	percent := regexp.MustCompile(`(\d+)%`)

	type result struct {
		mismatch, invisible []string
		seen                worst
		clipped             int
	}
	results := make([]result, len(rows))
	parallelRows(len(rows), func(ctx *EphemerisCtx, i int) {
		site, row := rows[i].site, rows[i].row
		r := &results[i]
		where := site.Name + " " + row.Date
		info, ok := GetUpcomingSolarEclipse(ctx, localToUtcMs(site, row.Date, "12:00")-2*dayMS,
			types.GeoLocation{Latitude: site.Latitude, Longitude: site.Longitude}, 4, types.LanguageEn)
		if !ok {
			r.mismatch = append(r.mismatch, where+" not found")
			return
		}
		if info.Subtype != localType[strings.ToLower(row.LocalType)] {
			r.mismatch = append(r.mismatch, where+" "+string(info.Subtype))
		}
		if strings.Contains(info.Description, "not visible") {
			r.invisible = append(r.invisible, where)
		}
		if row.MaximumFlag == "" {
			return
		}
		r.clipped++
		m := percent.FindStringSubmatch(info.Description)
		p, _ := strconv.Atoi(m[1])
		r.seen.add(float64(p)-row.Obscuration*100, where)
	})

	var mismatch, invisible []string
	var seen worst
	clipped := 0
	for i := range results {
		mismatch = append(mismatch, results[i].mismatch...)
		invisible = append(invisible, results[i].invisible...)
		seen.merge(&results[i].seen)
		clipped += results[i].clipped
	}
	if clipped != 126 {
		t.Errorf("%d rows with a clipped maximum, want 126", clipped)
	}
	if len(mismatch) != 0 {
		t.Errorf("local type differs from the catalog: %v", first(mismatch, 5))
	}
	if len(invisible) != 0 {
		t.Errorf("a returned solar eclipse is always seen at some phase: %v", first(invisible, 5))
	}
	if math.Abs(seen.value) >= 6 {
		t.Errorf("described percent vs catalog at sunrise or sunset: %s, bound 6", seen.label())
	}
}

func TestTier0SolarPartialAndInvisible(t *testing.T) {
	local := loadLocalCanon(t)
	canon := loadEclipseCanon(t)
	byName := map[string]localSite{}
	for _, s := range local.Sites {
		byName[s.Name] = s
	}
	sydney, okS := byName["Sydney, Australia"]
	london, okL := byName["London, England"]
	if !okS || !okL {
		t.Fatal("the fixture no longer carries Sydney and London")
	}

	ctx := NewEphemerisCtx()
	var partialRow *localRow
	for i := range sydney.Eclipses {
		if sydney.Eclipses[i].Date == "2028-07-22" {
			partialRow = &sydney.Eclipses[i]
		}
	}
	if partialRow == nil {
		t.Fatal("Sydney should be listed for the 2028 Jul 22 eclipse")
	}
	partial, ok := localEclipseFor(ctx, sydney, *partialRow)
	if !ok {
		t.Fatal("no eclipse found at Sydney for 2028-07-22")
	}
	wantKind := SolarPartial
	if partialRow.LocalType == "t" {
		wantKind = SolarTotal
	}
	if partial.Kind != wantKind {
		t.Errorf("Sydney 2028-07-22 is %s, catalog says %s", partial.Kind, wantKind)
	}

	listed := map[string]bool{}
	for _, r := range london.Eclipses {
		listed[r.Date] = true
	}
	var invisible []solarRow
	for _, r := range canon.Solar {
		if r.Date >= "1901" && r.Date < "2000" && !listed[r.Date] {
			invisible = append(invisible, r)
		}
	}
	if len(invisible) <= 40 {
		t.Errorf("only %d eclipses London is not listed for; the negative case is thin", len(invisible))
	}
	if len(invisible) > 60 {
		invisible = invisible[:60]
	}

	var wronglyVisible []string
	location := types.GeoLocation{Latitude: london.Latitude, Longitude: london.Longitude}
	for _, row := range invisible {
		approximate := ttJulianDateToUtc(row.JdGreatestTt)
		conjunction, ok := SearchMoonPhase(ctx, 0, approximate-2*dayMS, 5)
		if !ok {
			continue
		}
		eclipse, found := FindLocalSolarEclipse(ctx, conjunction, location)
		if found && (eclipse.BeginAltitude > 0 || eclipse.EndAltitude > 0) {
			wronglyVisible = append(wronglyVisible, row.Date+" "+row.Type)
		}
	}
	if len(wronglyVisible) != 0 {
		t.Errorf("reported an eclipse at London that NASA says is not visible from London: %v",
			first(wronglyVisible, 5))
	}
	t.Logf("Sydney 2028-07-22 is %s; %d London non-visible eclipses all correctly absent",
		partial.Kind, len(invisible))
}
