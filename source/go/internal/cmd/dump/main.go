// Command dump is the Go half of the parity harness: it writes the JSON document
// that is compared leaf for leaf against the TypeScript twin's output.
package main

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/calendar"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/core"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/jyotish"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/muhurta"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/muhurta/rules"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/tablejson"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

var out = bufio.NewWriterSize(os.Stdout, 4<<20)

func raw(s string) {
	if _, err := out.WriteString(s); err != nil {
		fatal(err)
	}
}

func fatal(err error) {
	out.Flush()
	fmt.Fprintln(os.Stderr, "dump:", err)
	os.Exit(1)
}

func enc(v any) string {
	var b []byte
	buf := &jsonBuf{}
	e := json.NewEncoder(buf)
	e.SetEscapeHTML(false)
	if err := e.Encode(v); err != nil {
		fatal(err)
	}
	b = buf.b
	if n := len(b); n > 0 && b[n-1] == '\n' {
		b = b[:n-1]
	}
	return string(b)
}

type jsonBuf struct{ b []byte }

func (j *jsonBuf) Write(p []byte) (int, error) { j.b = append(j.b, p...); return len(p), nil }

type obj struct{ first bool }

func newObj() *obj { raw("{"); return &obj{first: true} }

func (o *obj) key(k string) {
	if !o.first {
		raw(",")
	}
	o.first = false
	raw(enc(k) + ":")
}

func (o *obj) put(k string, v any) { o.key(k); raw(enc(v)) }
func (o *obj) obj(k string) *obj   { o.key(k); return newObj() }
func (o *obj) arr(k string) *arr   { o.key(k); return newArr() }
func (o *obj) end()                { raw("}") }

type arr struct{ first bool }

func newArr() *arr { raw("["); return &arr{first: true} }

func (a *arr) push(v any) {
	if !a.first {
		raw(",")
	}
	a.first = false
	raw(enc(v))
}

func (a *arr) end() { raw("]") }

type errorLeaf struct {
	Error struct {
		Kind string `json:"kind"`
		Code string `json:"code"`
	} `json:"_error"`
}

func leafFor(err error) errorLeaf {
	var l errorLeaf
	var pe *types.PanchangError
	if errors.As(err, &pe) {
		l.Error.Kind = "PanchangError"
		l.Error.Code = string(pe.Code)
		return l
	}
	l.Error.Kind = "unknown"
	return l
}

func safe2[T any](v T, err error) any {
	if err != nil {
		return leafFor(err)
	}
	return v
}

func blankInstantFestivals(v any) any {
	r, ok := v.(types.InstantPanchangResult)
	if !ok || !reduced() {
		return v
	}
	r.Festivals = []types.FestivalInfo{}
	return r
}

func safe[T any](v T, ok bool, err error) any {
	if err != nil {
		return leafFor(err)
	}
	if !ok {
		return nil
	}
	return v
}

const dayMS = 86_400_000

type dumpLocation struct {
	Name      string         `json:"name"`
	Latitude  float64        `json:"latitude"`
	Longitude float64        `json:"longitude"`
	Timezone  types.Timezone `json:"timezone"`
	geo       types.GeoLocation
}

func loc(name string, lat, lon float64, tz types.Timezone) dumpLocation {
	return dumpLocation{
		Name: name, Latitude: lat, Longitude: lon, Timezone: tz,
		geo: types.GeoLocation{Latitude: lat, Longitude: lon},
	}
}

var locations = []dumpLocation{
	loc("Pune", 18.5204, 73.8567, types.TimezoneOffset(330)),
	loc("Delhi", 28.6139, 77.2090, types.TimezoneOffset(330)),
	loc("Chennai", 13.0827, 80.2707, types.TimezoneOffset(330)),
	loc("NewYork", 40.7128, -74.0060, types.TimezoneName("America/New_York")),
	loc("London", 51.5074, -0.1278, types.TimezoneName("Europe/London")),
	loc("Reykjavik", 64.1466, -21.9426, types.TimezoneOffset(0)),
}

type epoch struct {
	Name    string `json:"name"`
	StartMs int64  `json:"-"`
	Start   string `json:"start"`
	Days    int    `json:"days"`
	Year    int    `json:"year"`
}

func mkEpoch(name string, startMs int64, days, year int) epoch {
	return epoch{Name: name, StartMs: startMs, Start: types.Date(startMs).ISOString(), Days: days, Year: year}
}

var epochs = []epoch{
	mkEpoch("1912", types.DateUTC(1912, 5, 1).Ms(), 60, 1912),
	mkEpoch("2025", types.DateUTC(2025, 0, 1).Ms(), 200, 2025),
	mkEpoch("2088", types.DateUTC(2088, 5, 1).Ms(), 60, 2088),
}

var g2Sections = core.Sections(core.SectionEclipse, core.SectionMoonTimes, core.SectionLunarWindows)

type shape struct {
	name  string
	build func(tz types.Timezone) core.PanchangOptions
}

func boolPtr(b bool) *bool { return &b }
func intPtr(i int) *int    { return &i }

var shapes = []shape{
	{"s1-default", func(tz types.Timezone) core.PanchangOptions {
		return core.PanchangOptions{Timezone: tz}
	}},
	{"s2-narrow", func(tz types.Timezone) core.PanchangOptions {
		return core.PanchangOptions{
			Timezone:               tz,
			Sections:               core.NoSections(),
			SectionsGiven:          true,
			InstantPanchangOptions: core.InstantPanchangOptions{ComputeEndTimes: boolPtr(false)},
		}
	}},
	{"s3-hi", func(tz types.Timezone) core.PanchangOptions {
		return core.PanchangOptions{
			Timezone:               tz,
			InstantPanchangOptions: core.InstantPanchangOptions{Language: types.LanguageHi},
		}
	}},
	{"s4-amanta-tn-raman", func(tz types.Timezone) core.PanchangOptions {
		return core.PanchangOptions{
			Timezone: tz,
			InstantPanchangOptions: core.InstantPanchangOptions{
				MasaSystem: types.Amanta, Region: types.RegionTamilNadu, Ayanamsa: types.Raman,
			},
		}
	}},
	{"s5-janma0", func(tz types.Timezone) core.PanchangOptions {
		return core.PanchangOptions{
			Timezone: tz,
			InstantPanchangOptions: core.InstantPanchangOptions{
				JanmaRashi: intPtr(0), JanmaNakshatra: intPtr(0),
			},
		}
	}},
}

var instantShapes = []struct {
	name string
	opts core.InstantPanchangOptions
}{
	{"i1-default", core.InstantPanchangOptions{}},
	{"i2-full", core.InstantPanchangOptions{
		Ayanamsa: types.Raman, Language: types.LanguageHi, MasaSystem: types.Amanta,
		JanmaRashi: intPtr(0), JanmaNakshatra: intPtr(0), Region: types.RegionTamilNadu,
	}},
}

var polar = loc("Longyearbyen", 78.2232, 15.6267, types.TimezoneOffset(60))

var polarWindows = []struct {
	Name    string `json:"name"`
	startMs int64
	days    int
}{
	{"midnight-sun", types.DateUTC(2025, 5, 15).Ms(), 12},
	{"polar-night", types.DateUTC(2025, 11, 15).Ms(), 12},
	{"shoulder-spring", types.DateUTC(2025, 3, 15).Ms(), 12},
	{"shoulder-autumn", types.DateUTC(2025, 9, 20).Ms(), 12},
}

const pinnedGeneratedAt = "2026-08-23T00:00:00.000Z"

var pinMs = types.DateUTC(2026, 7, 23).Ms()

type parityStage string

const (
	stageG2   parityStage = "g2"
	stageG3   parityStage = "g3"
	stageFull parityStage = "full"
)

func resolveStage() parityStage {
	raw := os.Getenv("PARITY_STAGE")
	legacy := os.Getenv("PARITY_G2") == "1"
	if raw == "" {
		return stageG2
	}
	if legacy && raw != string(stageG2) {
		fatal(fmt.Errorf("PARITY_G2=1 and PARITY_STAGE=%s disagree; set one", raw))
	}
	switch parityStage(raw) {
	case stageG2, stageG3, stageFull:
		return parityStage(raw)
	}
	fatal(fmt.Errorf("PARITY_STAGE must be g2 | g3 | full, got %q", raw))
	return stageG2
}

var stage = resolveStage()

func chartsIn() bool { return stage == stageG3 || stage == stageFull }

func reduced() bool { return stage == stageG2 || stage == stageG3 }

type chartEvent struct {
	Name string            `json:"name"`
	ISO  string            `json:"iso"`
	Loc  types.GeoLocation `json:"loc"`
	ms   int64
}

func mkChartEvent(name, iso string, lat, lon float64) chartEvent {
	t, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		fatal(fmt.Errorf("chart event %s: %w", name, err))
	}
	ms := t.UnixMilli()
	if got := types.Date(ms).ISOString(); got != iso {
		fatal(fmt.Errorf("chart event %s: %q parsed to %q", name, iso, got))
	}
	return chartEvent{Name: name, ISO: iso, Loc: types.GeoLocation{Latitude: lat, Longitude: lon}, ms: ms}
}

var chartEvents = []chartEvent{
	mkChartEvent("e1-1912-pune", "1912-06-14T03:22:10.000Z", 18.5204, 73.8567),
	mkChartEvent("e2-1976-newyork", "1976-11-02T21:47:00.000Z", 40.7128, -74.0060),
	mkChartEvent("e3-1995-delhi", "1995-08-15T05:30:00.000Z", 28.6139, 77.2090),
	mkChartEvent("e4-2039-sydney", "2039-03-21T11:11:11.000Z", -33.8688, 151.2093),
	mkChartEvent("e5-2088-reykjavik", "2088-06-19T18:05:33.000Z", 64.1466, -21.9426),
}

var houseSystems = []types.HouseSystem{
	types.HouseSystemWholeSign, types.HouseSystemEqual, types.HouseSystemPlacidusKP,
}

var divisionals = []types.Divisional{
	types.DivisionalD2, types.DivisionalD3, types.DivisionalD7,
	types.DivisionalD10, types.DivisionalD12, types.DivisionalD30,
}

var ayanamsas = []types.AyanamsaType{
	types.Lahiri, types.Raman, types.Krishnamurti, types.TrueChitra, types.Thirukanitham,
}

var lahiriOpts = jyotish.BirthChartOptions{Ayanamsa: types.Lahiri}

func isoDay(ms int64) string { return types.Date(ms).ISOString()[:10] }

var natalResolvers = jyotish.CoreNatalResolvers()

func newCtx() *astronomy.EphemerisCtx { return &astronomy.EphemerisCtx{} }

func writeMeta(doc *obj) {
	m := doc.obj("_meta")
	m.put("document", "panchang-ts parity dump (diff-compare half)")
	m.put("pinnedNow", types.Date(pinMs).ISOString())
	m.put("generatedAtStamp", pinnedGeneratedAt)
	m.put("locations", locations)
	m.put("epochs", epochs)

	ds := m.obj("daySplit")
	ds.put("1912", 60)
	ds.put("2025", 200)
	ds.put("2088", 60)
	ds.put("total", 320)
	ds.put("perLocation", true)
	ds.end()

	m.put("shapes", shapeNames())
	m.put("instantShapes", instantShapeNames())

	if stage == stageFull {
		m.put("g2", nil)
	} else {
		writeG2Descriptor(m)
	}
	if chartsIn() {
		m.put("chartEvents", chartEvents)
	}

	pm := m.obj("polar")
	pm.put("location", polar)
	pm.put("windows", polarWindowNames())
	pm.end()

	ml := m.obj("pinnedLeaves")
	ml.put("reason", "dasha.ts's five current* leaves read the wall clock; asOfDate injects it")
	ml.put("leaves", "currentIndex, currentMahaDashaLord, currentYogini, currentRashi")
	ml.put("asOf", pinnedGeneratedAt)
	ml.end()

	m.end()
}

func writeG2Descriptor(m *obj) {
	g2 := m.obj("g2")
	switch stage {
	case stageG3:
		g2.put("mode", "PARITY_STAGE=g3: G2 plus the jyotish chart sections")
		g2.put("dailySections", []string{"eclipse", "moonTimes", "lunarWindows"})
		g2.put("instantFestivalsBlanked", true)
		g2.put("omittedSections", []string{
			"yearly", "muhurta", "convert", "constants", "helpers", "tables",
		})
		g2.put("note",
			"Adds charts, chartPairs and matching to the G2 document. The festival "+
				"exclusion is unchanged: festivals.ts / dayFestivals.ts are Stage G4 "+
				"in g3 too. `constants` and `helpers` are omitted deliberately rather "+
				"than by oversight: they are pure tables and enum totality, already "+
				"covered leaf-for-leaf by go/internal/**/testdata goldens, so emitting "+
				"them here would add 2 MB of document and no new information.")
	default:
		g2.put("mode", "PARITY_G2=1: the reduced document Stage G2 can answer")
		g2.put("dailySections", []string{"eclipse", "moonTimes", "lunarWindows"})
		g2.put("instantFestivalsBlanked", true)
		g2.put("omittedSections", []string{
			"yearly", "charts", "chartPairs", "matching", "muhurta", "convert",
			"constants", "helpers", "tables",
		})
		g2.put("note",
			"festivals.ts / dayFestivals.ts are deferred to Stage G4, so the daily "+
				"shapes are narrowed away from the festivals block and the instant "+
				"results have their festivals array blanked. Everything else in both "+
				"sections, including the eclipse block, is compared in full.")
	}
	g2.end()
}

func polarWindowNames() []string {
	out := make([]string, 0, len(polarWindows))
	for _, w := range polarWindows {
		out = append(out, w.Name)
	}
	return out
}

func shapeNames() []string {
	out := make([]string, 0, len(shapes))
	for _, s := range shapes {
		out = append(out, s.name)
	}
	return out
}

func instantShapeNames() []string {
	out := make([]string, 0, len(instantShapes))
	for _, s := range instantShapes {
		out = append(out, s.name)
	}
	return out
}

func writeDaily(doc *obj) {
	daily := doc.obj("daily")
	for _, l := range locations {
		for _, ep := range epochs {
			for i := 0; i < ep.Days; i++ {
				ms := ep.StartMs + int64(i)*dayMS
				for _, sh := range shapes {
					opts := sh.build(l.Timezone)
					if reduced() && !opts.SectionsGiven {
						opts.Sections = g2Sections
						opts.SectionsGiven = true
					}
					r, ok, err := core.GetDailyPanchang(newCtx(), ms, l.geo, opts, natalResolvers)
					daily.put(
						fmt.Sprintf("%s|%s|%s|%s", l.Name, ep.Name, isoDay(ms), sh.name),
						safe(r, ok, err))
				}
			}
		}
	}
	daily.end()
}

func instantsFor(ep epoch) []int64 {
	return []int64{
		ep.StartMs + 17*60_000,
		ep.StartMs + 6*3_600_000 + 41*60_000 + 23_456,
		ep.StartMs + 37*dayMS + 12*3_600_000,
		ep.StartMs + 53*dayMS + dayMS - 1,
	}
}

func writeInstant(doc *obj) {
	inst := doc.obj("instant")
	for _, l := range locations {
		for _, ep := range epochs {
			for _, ms := range instantsFor(ep) {
				for _, sh := range instantShapes {
					r, ok, err := core.GetInstantPanchang(newCtx(), ms, l.geo, sh.opts, natalResolvers)
					inst.put(
						fmt.Sprintf("%s|%s|%s|%s", l.Name, ep.Name, types.Date(ms).ISOString(), sh.name),
						blankInstantFestivals(safe(r, ok, err)))
				}
			}
		}
	}
	inst.end()
}

func writePolar(doc *obj) {
	p := doc.obj("polar")
	for _, w := range polarWindows {
		for i := 0; i < w.days; i++ {
			ms := w.startMs + int64(i)*dayMS
			o := p.obj(fmt.Sprintf("%s|%s", w.Name, isoDay(ms)))

			dailyOpts := core.PanchangOptions{Timezone: polar.Timezone}
			if reduced() {
				dailyOpts.Sections = g2Sections
				dailyOpts.SectionsGiven = true
			}
			r, ok, err := core.GetDailyPanchang(newCtx(), ms, polar.geo, dailyOpts, natalResolvers)
			o.put("daily", safe(r, ok, err))

			ir, iok, ierr := core.GetInstantPanchang(newCtx(), ms, polar.geo, core.InstantPanchangOptions{}, natalResolvers)
			o.put("instant", blankInstantFestivals(safe(ir, iok, ierr)))

			o.put("sunrise", riseSetLeaf(astronomy.ComputeSunrise(newCtx(), ms, polar.geo,
				astronomy.DefaultRiseSetLimitDays)))
			o.put("sunset", riseSetLeaf(astronomy.ComputeSunset(newCtx(), ms, polar.geo,
				astronomy.DefaultRiseSetLimitDays)))
			o.put("moonrise", moonLeaf(astronomy.GetMoonrise(newCtx(), ms, polar.geo,
				astronomy.DefaultRiseSetLimitDays)))
			o.put("moonset", moonLeaf(astronomy.GetMoonset(newCtx(), ms, polar.geo,
				astronomy.DefaultRiseSetLimitDays)))
			if stage == stageFull {
				o.put("convert", safe2(calendar.ConvertGregorianToHindu(newCtx(), ms, polar.geo,
					calendar.ConvertOptions{Timezone: polar.Timezone})))
			}
			o.end()
		}
	}
	p.end()
}

func riseSetLeaf(ms int64, err error) any {
	if err != nil {
		return leafFor(err)
	}
	return types.Date(ms)
}

func moonLeaf(ms int64, found bool, err error) any {
	if err != nil {
		return leafFor(err)
	}
	if !found {
		return nil
	}
	return types.Date(ms)
}

func writeCharts(doc *obj) {
	charts := doc.obj("charts")
	for _, ev := range chartEvents {
		ms, loc := ev.ms, ev.Loc
		c := charts.obj(ev.Name)

		c.put("positionsMean", safe2(jyotish.ComputePlanetaryPositions(newCtx(), ms, types.Lahiri, nil, nil, jyotish.NodeMean)))
		c.put("positionsTrue", safe2(jyotish.ComputePlanetaryPositions(newCtx(), ms, types.Lahiri, nil, nil, jyotish.NodeTrue)))

		c.put("lagna", safe2(jyotish.ComputeLagna(newCtx(), ms, loc, types.Lahiri, types.LanguageEn)))
		c.put("lagnaHi", safe2(jyotish.ComputeLagna(newCtx(), ms, loc, types.Lahiri, types.LanguageHi)))
		c.put("horaLagna", safe2(jyotish.ComputeHoraLagna(newCtx(), ms, loc, types.Lahiri, types.LanguageEn)))
		c.put("ghatiLagna", safe2(jyotish.ComputeGhatiLagna(newCtx(), ms, loc, types.Lahiri, types.LanguageEn)))
		c.put("bhavaLagna", safe2(jyotish.ComputeBhavaLagna(newCtx(), ms, loc, types.Lahiri, types.LanguageEn)))
		c.put("sripatiLagna", safe2(jyotish.ComputeSripatiLagna(newCtx(), ms, loc, types.Lahiri, types.LanguageEn)))
		c.put("sripatiCusps", safe2(jyotish.ComputeSripatiLagnaWithCusps(newCtx(), ms, loc, types.Lahiri, types.LanguageEn)))

		bh := c.obj("bhava")
		for _, hs := range houseSystems {
			bh.put(string(hs), safe2(jyotish.ComputeBhava(newCtx(), ms, loc,
				jyotish.BirthChartOptions{Ayanamsa: types.Lahiri, HouseSystem: hs})))
		}
		bh.end()

		chart, chartErr := jyotish.ComputeRashiChart(newCtx(), ms, loc, lahiriOpts)
		navamsa, navErr := jyotish.ComputeNavamsa(newCtx(), ms, loc, lahiriOpts)
		if chartErr != nil {
			fatal(fmt.Errorf("%s rashiChart: %w", ev.Name, chartErr))
		}
		if navErr != nil {
			fatal(fmt.Errorf("%s navamsa: %w", ev.Name, navErr))
		}
		c.put("rashiChart", chart)
		c.put("navamsa", navamsa)
		dv := c.obj("divisionals")
		for _, d := range divisionals {
			dv.put(string(d), safe2(jyotish.ComputeDivisionalChart(newCtx(), ms, loc, d, lahiriOpts)))
		}
		dv.end()

		c.put("shadbala", safe2(jyotish.ComputeShadbala(newCtx(), ms, loc, lahiriOpts)))
		c.put("bhavaBala", safe2(jyotish.ComputeBhavaBala(newCtx(), ms, loc, lahiriOpts)))

		c.put("ashtakavarga", jyotish.ComputeAshtakavarga(&chart, jyotish.AshtakavargaOptions{}))
		c.put("ashtakavargaReduced", jyotish.ComputeAshtakavarga(&chart, jyotish.AshtakavargaOptions{Reductions: true}))

		c.put("yogas", safe2(jyotish.ComputeYogas(&chart, jyotish.ComputeYogasOptions{})))
		c.put("yogasWithNavamsa", safe2(jyotish.ComputeYogas(&chart, jyotish.ComputeYogasOptions{Navamsa: &navamsa})))
		c.put("yogasRaja", safe2(jyotish.ComputeYogas(&chart, jyotish.ComputeYogasOptions{Types: []types.YogaType{types.YogaRaja}})))

		vim, vimErr := jyotish.ComputeVimshottariDashaFromBirth(newCtx(), ms, types.Lahiri, pinMs)
		if vimErr != nil {
			fatal(fmt.Errorf("%s vimshottari: %w", ev.Name, vimErr))
		}
		putVimshottari(c, "vimshottari", vim)
		if len(vim.MahaDashas) > 0 && len(vim.MahaDashas[0].AntarDashas) > 0 {
			c.put("vimshottariPratyantar", safe2(jyotish.ComputeVimshottariPratyantar(vim.MahaDashas[0].AntarDashas[0])))
			c.put("vimshottariPratyantarIn", safe2(jyotish.ComputeVimshottariPratyantarIn(vim.MahaDashas[0], vim.MahaDashas[0].AntarDashas[0])))
		} else {
			c.put("vimshottariPratyantar", nil)
			c.put("vimshottariPratyantarIn", nil)
		}

		moonSid, moonErr := astronomy.GetSiderealMoonLongitude(newCtx(), ms, types.Lahiri)
		if moonErr != nil {
			fatal(fmt.Errorf("%s siderealMoon: %w", ev.Name, moonErr))
		}
		asht, ashtErr := jyotish.ComputeAshtottariDasha(ms, moonSid, pinMs)
		if ashtErr != nil {
			fatal(fmt.Errorf("%s ashtottari: %w", ev.Name, ashtErr))
		}
		putVimshottari(c, "ashtottari", asht)

		yog, yogErr := jyotish.ComputeYoginiDasha(ms, moonSid, pinMs)
		if yogErr != nil {
			fatal(fmt.Errorf("%s yogini: %w", ev.Name, yogErr))
		}
		putYogini(c, "yogini", yog)

		chara, charaErr := jyotish.ComputeCharaDasha(newCtx(), ms, loc, types.Lahiri, pinMs)
		if charaErr != nil {
			fatal(fmt.Errorf("%s chara: %w", ev.Name, charaErr))
		}
		putChara(c, "chara", chara)

		narFixed, nfErr := jyotish.ComputeNarayanDasha(newCtx(), ms, loc, types.Lahiri, pinMs)
		if nfErr != nil {
			fatal(fmt.Errorf("%s narayanFixed: %w", ev.Name, nfErr))
		}
		putNarayan(c, "narayanFixed", narFixed)

		narVar, nvErr := jyotish.ComputeNarayanDashaVariable(newCtx(), ms, loc, types.Lahiri, pinMs)
		if nvErr != nil {
			fatal(fmt.Errorf("%s narayanVariable: %w", ev.Name, nvErr))
		}
		putNarayan(c, "narayanVariable", narVar)

		c.put("karakas7", safe2(jyotish.ComputeJaiminiKarakas(&chart)))
		c.put("karakas8", safe2(jyotish.ComputeJaimini8Karakas(&chart)))

		c.put("upagrahas", safe2(jyotish.ComputeUpagrahas(newCtx(), ms, loc, lahiriOpts)))
		c.put("arudhas", safe2(jyotish.ComputeArudhas(&chart, types.LanguageEn)))
		c.put("argala", jyotish.ComputeArgala(&chart))
		c.put("argalaTrikona", jyotish.ComputeArgalaWithTrikonargala(&chart))
		c.put("aspects7", safe2(jyotish.ComputeAspects(&chart, jyotish.AspectsOptions{})))
		c.put("aspects59", safe2(jyotish.ComputeAspects(&chart, jyotish.AspectsOptions{NodeAspects: jyotish.NodeAspects5And9})))

		c.put("mangal", jyotish.ComputeMangalDosha(&chart))
		c.put("kaalSarp", jyotish.ComputeKaalSarp(&chart))
		c.put("pitru", jyotish.ComputePitruDosha(&chart))
		c.put("sadeSati", safe2(jyotish.ComputeSadeSati(newCtx(), chart.ByPlanet.Moon.Rashi.Index, pinMs, types.Lahiri)))

		c.put("varshaphalaAge30", safe2(jyotish.ComputeVarshaphala(newCtx(), ms, 30, loc, lahiriOpts)))
		c.put("varshaphalaAge5", safe2(jyotish.ComputeVarshaphala(newCtx(), ms, 5, loc, lahiriOpts)))
		c.put("tithiPraveshaAge30", safe2(jyotish.ComputeTithiPravesha(newCtx(), ms, 30, loc, lahiriOpts)))
		c.put("tithiPraveshaAge5", safe2(jyotish.ComputeTithiPravesha(newCtx(), ms, 5, loc, lahiriOpts)))

		c.put("kpCuspalSubLords", safe2(jyotish.ComputeKpCuspalSubLords(newCtx(), ms, loc, jyotish.BirthChartOptions{})))
		c.put("kpSignificators", jyotish.ComputeKpSignificators(&chart))
		c.put("prashnaChart", safe2(jyotish.ComputePrashnaChart(newCtx(), ms, loc, jyotish.BirthChartOptions{})))

		sunSid, sunErr := astronomy.GetSiderealSunLongitude(newCtx(), ms, types.Lahiri)
		if sunErr != nil {
			fatal(fmt.Errorf("%s siderealSun: %w", ev.Name, sunErr))
		}
		c.put("siderealSun", sunSid)
		c.put("siderealMoon", moonSid)
		ay := c.obj("ayanamsa")
		for _, a := range ayanamsas {
			v, err := astronomy.ComputeAyanamsa(ms, a)
			if err != nil {
				fatal(fmt.Errorf("%s ayanamsa %s: %w", ev.Name, a, err))
			}
			ay.put(string(a), v)
		}
		ay.end()
		c.put("sunrise", riseSetLeaf(astronomy.ComputeSunrise(newCtx(), ms, loc, astronomy.DefaultRiseSetLimitDays)))
		c.put("sunset", riseSetLeaf(astronomy.ComputeSunset(newCtx(), ms, loc, astronomy.DefaultRiseSetLimitDays)))
		c.put("moonrise", moonLeaf(astronomy.GetMoonrise(newCtx(), ms, loc, astronomy.DefaultRiseSetLimitDays)))
		c.put("moonset", moonLeaf(astronomy.GetMoonset(newCtx(), ms, loc, astronomy.DefaultRiseSetLimitDays)))

		c.end()
	}
	charts.end()
}

func putVimshottari(c *obj, key string, r types.VimshottariDashaResult) {
	o := c.obj(key)
	o.put("currentMahaDashaLord", r.CurrentMahaDashaLord)
	o.put("currentIndex", r.CurrentIndex)
	o.put("mahaDashas", r.MahaDashas)
	o.end()
}

func putYogini(c *obj, key string, r jyotish.YoginiDashaResult) {
	o := c.obj(key)
	o.put("currentYogini", r.CurrentYogini)
	o.put("currentIndex", r.CurrentIndex)
	o.put("mahaDashas", r.MahaDashas)
	o.end()
}

func putChara(c *obj, key string, r jyotish.CharaDashaResult) {
	o := c.obj(key)
	o.put("currentIndex", r.CurrentIndex)
	o.put("currentRashi", r.CurrentRashi)
	o.put("mahaDashas", r.MahaDashas)
	o.end()
}

func putNarayan(c *obj, key string, r jyotish.NarayanDashaResult) {
	o := c.obj(key)
	o.put("direction", r.Direction)
	o.put("startingRashi", r.StartingRashi)
	o.put("currentIndex", r.CurrentIndex)
	o.put("currentRashi", r.CurrentRashi)
	o.put("mahaDashas", r.MahaDashas)
	o.end()
}

func writeChartPairs(doc *obj) {
	pairs := doc.obj("chartPairs")
	for i := range chartEvents {
		a := chartEvents[i]
		b := chartEvents[(i+1)%len(chartEvents)]
		ca, aErr := jyotish.ComputeRashiChart(newCtx(), a.ms, a.Loc, lahiriOpts)
		cb, bErr := jyotish.ComputeRashiChart(newCtx(), b.ms, b.Loc, lahiriOpts)
		if aErr != nil || bErr != nil {
			fatal(fmt.Errorf("chartPairs %s|%s: %v %v", a.Name, b.Name, aErr, bErr))
		}
		pairs.put(a.Name+"|"+b.Name, jyotish.ComputeMangalCompatibility(&ca, &cb))
	}
	pairs.end()
}

type fixturePair struct {
	label     string
	boy, girl jyotish.NatalMoon
}

func readFixturePairs() []fixturePair {
	raw, err := repopath.ReadTestData("charts", "ashtakoot-pairs.json")
	if err != nil {
		fatal(err)
	}
	var parsed struct {
		Pairs []struct {
			Label string `json:"label"`
			Boy   struct {
				Rashi     int `json:"rashi"`
				Nakshatra int `json:"nakshatra"`
			} `json:"boy"`
			Girl struct {
				Rashi     int `json:"rashi"`
				Nakshatra int `json:"nakshatra"`
			} `json:"girl"`
		} `json:"pairs"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		fatal(err)
	}
	out := make([]fixturePair, 0, len(parsed.Pairs))
	for _, p := range parsed.Pairs {
		out = append(out, fixturePair{
			label: p.Label,
			boy:   jyotish.NatalMoon{Rashi: p.Boy.Rashi, Nakshatra: p.Boy.Nakshatra},
			girl:  jyotish.NatalMoon{Rashi: p.Girl.Rashi, Nakshatra: p.Girl.Nakshatra},
		})
	}
	return out
}

var syntheticPairs = []fixturePair{
	{
		label: "synthetic-1-full-natal-moon",
		boy:   jyotish.NatalMoon{Rashi: 0, Nakshatra: 0, LagnaRashi: intPtr(0), NavamsaRashi: intPtr(0), NakshatraPada: intPtr(1)},
		girl:  jyotish.NatalMoon{Rashi: 6, Nakshatra: 13, LagnaRashi: intPtr(6), NavamsaRashi: intPtr(6), NakshatraPada: intPtr(4)},
	},
	{
		label: "synthetic-2-shared-lords",
		boy:   jyotish.NatalMoon{Rashi: 2, Nakshatra: 6, LagnaRashi: intPtr(5), NavamsaRashi: intPtr(8), NakshatraPada: intPtr(2)},
		girl:  jyotish.NatalMoon{Rashi: 5, Nakshatra: 12, LagnaRashi: intPtr(2), NavamsaRashi: intPtr(11), NakshatraPada: intPtr(3)},
	},
}

func writeMatching(doc *obj) {
	m := doc.obj("matching")
	all := append(readFixturePairs(), syntheticPairs...)
	for _, p := range all {
		o := m.obj(p.label)
		o.put("ashtakoot", safe2(jyotish.ComputeAshtakoot(p.boy, p.girl, jyotish.AshtakootOptions{})))
		o.put("ashtakootGana", safe2(jyotish.ComputeAshtakoot(p.boy, p.girl, jyotish.AshtakootOptions{GanaCancellation: true})))
		o.put("pathuPorutham", safe2(jyotish.ComputePathuPorutham(p.boy, p.girl)))
		o.end()
	}
	m.end()
}

var muhurtaStartMs = types.DateUTC(2025, 0, 1).Ms()

const muhurtaDays = 60

var stockRuleIDs = rules.Order()

var canonicalRegions = types.AllFestivalRegions

var legacyRegions = types.AllLegacyFestivalRegions

func writeYearly(doc *obj) {
	yearly := doc.obj("yearly")
	for _, l := range locations {
		for _, ep := range epochs {
			y := ep.Year
			o := yearly.obj(fmt.Sprintf("%s|%d", l.Name, y))
			opts := calendar.YearlyListingOptions{Timezone: l.Timezone}
			o.put("festivals", safe2(calendar.ComputeFestivalsForYear(context.Background(), newCtx(), y, l.geo, opts)))
			o.put("ekadashi", safe2(calendar.ComputeEkadashiDatesForYear(context.Background(), newCtx(), y, l.geo, opts)))
			o.put("sankrantis", safe2(calendar.ComputeSankrantisForYear(context.Background(), newCtx(), y, l.geo, opts)))
			o.put("eclipses", safe2(calendar.ComputeEclipsesForYear(context.Background(), newCtx(), y, l.geo, l.Timezone)))
			o.put("moonPhases", safe2(astronomy.ComputeMoonPhasesForYear(context.Background(), newCtx(), y,
				astronomy.MoonPhasesForYearOptions{Timezone: l.Timezone})))
			o.end()
		}
	}
	yearly.end()
}

func writeMuhurta(doc *obj) {
	pune := locations[0]
	mu := doc.obj("muhurta")

	scores := mu.obj("scores")
	for _, id := range stockRuleIDs {
		rule, ok := rules.Get(id)
		if !ok {
			fatal(fmt.Errorf("dump: STOCK_MUHURTA_RULES is missing %q", id))
		}
		for i := 0; i < muhurtaDays; i++ {
			ms := muhurtaStartMs + int64(i)*dayMS
			scores.put(fmt.Sprintf("%s|%s", id, isoDay(ms)),
				safe2(muhurta.ScoreMuhurta(newCtx(), ms, pune.geo, rule,
					muhurta.MuhurtaScoreOptions{Timezone: types.TimezoneOffset(330)})))
		}
	}
	scores.end()

	startMs := muhurtaStartMs
	endMs := muhurtaStartMs + int64(muhurtaDays-1)*dayMS
	vivah, ok := rules.Get("vivah")
	if !ok {
		fatal(errors.New("dump: STOCK_MUHURTA_RULES is missing \"vivah\""))
	}
	mu.put("vivahPasses", safe2(muhurta.ComputeAuspiciousDatesInRange(context.Background(),
		newCtx(), vivah, startMs, endMs, pune.geo,
		muhurta.MuhurtaScoreOptions{Timezone: types.TimezoneOffset(330)})))
	mu.put("vivahAll", safe2(muhurta.ComputeAuspiciousDatesInRange(context.Background(),
		newCtx(), vivah, startMs, endMs, pune.geo,
		muhurta.MuhurtaScoreOptions{
			Timezone: types.TimezoneOffset(330), IncludeFailures: true,
		})))
	mu.end()
}

type convertRoundTrip struct {
	key   string
	value any
}

func writeConvert(doc *obj) {
	cv := doc.obj("convert")

	roundTrips := []convertRoundTrip{}
	g2h := cv.obj("gregorianToHindu")
	for _, l := range locations {
		for _, ep := range epochs {
			for i := 0; i < ep.Days; i += 15 {
				ms := ep.StartMs + int64(i)*dayMS
				key := fmt.Sprintf("%s|%s", l.Name, isoDay(ms))
				opts := calendar.ConvertOptions{Timezone: l.Timezone}
				ctx := newCtx()
				h, err := calendar.ConvertGregorianToHindu(ctx, ms, l.geo, opts)
				g2h.put(key, safe2(h, err))
				if err != nil {
					roundTrips = append(roundTrips, convertRoundTrip{key: key, value: nil})
					continue
				}
				roundTrips = append(roundTrips, convertRoundTrip{
					key: key,
					value: safe2(calendar.ConvertHinduToGregorian(ctx, calendar.HinduDateCoords{
						VikramSamvat: h.VikramSamvat,
						MasaIndex:    h.MasaIndex,
						Paksha:       h.Paksha,
						PakshaTithi:  h.PakshaTithi,
					}, l.geo, opts)),
				})
			}
		}
	}
	g2h.end()
	rt := cv.obj("roundTrip")
	for _, p := range roundTrips {
		rt.put(p.key, p.value)
	}
	rt.end()

	hny := cv.obj("hinduNewYear")
	regions := make([]types.FestivalRegion, 0, len(canonicalRegions)+len(legacyRegions))
	regions = append(regions, canonicalRegions...)
	regions = append(regions, legacyRegions...)
	for _, li := range []int{0, 2} {
		l := locations[li]
		for _, ep := range epochs {
			for _, r := range regions {
				v, ok, err := calendar.GetHinduNewYear(newCtx(), ep.Year, r, l.geo,
					calendar.ConvertOptions{Timezone: l.Timezone})
				hny.put(fmt.Sprintf("%s|%d|%s", l.Name, ep.Year, r), safe(v, ok, err))
			}
		}
	}
	hny.end()

	sv := cv.obj("samvat")
	for _, ep := range epochs {
		for _, md := range [][2]int{{0, 1}, {2, 15}, {2, 25}, {3, 5}, {11, 31}} {
			ms := types.DateUTC(ep.Year, md[0], md[1]).Ms()
			o := sv.obj(fmt.Sprintf("%d|%s", ep.Year, isoDay(ms)))
			o.put("samvat", safe2(calendar.ComputeSamvat(newCtx(), ms)))
			o.put("kaliYuga", safe2(calendar.GetKaliYugaYear(newCtx(), ms)))
			o.end()
		}
	}
	sv.end()

	cv.end()
}

func writeConstants(doc *obj) {
	k := doc.obj("constants")

	ga := k.obj("GRAHA_ABBR")
	for _, g := range types.AllGrahas {
		ga.put(g.String(), jyotish.GrahaAbbr[g])
	}
	ga.end()

	k.put("ASHTOTTARI_ORDER", jyotish.AshtottariOrder[:])
	ay := k.obj("ASHTOTTARI_YEARS")
	for _, lord := range jyotish.AshtottariOrder {
		ay.put(lord.String(), jyotish.AshtottariYears[lord])
	}
	ay.end()

	k.put("YOGINI_ORDER", jyotish.YoginiOrder[:])
	yy := k.obj("YOGINI_YEARS")
	for i, name := range jyotish.YoginiOrder {
		yy.put(string(name), jyotish.YoginiYears[i])
	}
	yy.end()
	yp := k.obj("YOGINI_PLANET")
	for i, name := range jyotish.YoginiOrder {
		yp.put(string(name), jyotish.YoginiPlanet[i])
	}
	yp.end()

	k.put("CHARA_RASHI_YEARS", jyotish.CharaRashiYears[:])
	k.obj("VISHAMA_PADA_RASHIS").end()
	k.obj("SAMA_PADA_RASHIS").end()
	k.put("ALL_SAHAM_NAMES", jyotish.AllSahamNames[:])

	sr := k.obj("STOCK_MUHURTA_RULES")
	for _, id := range stockRuleIDs {
		rule, ok := rules.Get(id)
		if !ok {
			fatal(fmt.Errorf("dump: STOCK_MUHURTA_RULES is missing %q", id))
		}
		writeMuhurtaRule(sr, id, rule)
	}
	sr.end()

	k.end()
}

func writeMuhurtaRule(parent *obj, id string, r muhurta.MuhurtaRule) {
	o := parent.obj(id)
	o.put("occasion", r.Occasion)
	if r.Name != "" {
		o.put("name", r.Name)
	}
	for _, f := range []struct {
		key  string
		list []int
	}{
		{"auspiciousTithis", r.AuspiciousTithis},
		{"inauspiciousTithis", r.InauspiciousTithis},
		{"auspiciousNakshatras", r.AuspiciousNakshatras},
		{"inauspiciousNakshatras", r.InauspiciousNakshatras},
		{"auspiciousVaras", r.AuspiciousVaras},
		{"inauspiciousVaras", r.InauspiciousVaras},
		{"auspiciousYogas", r.AuspiciousYogas},
		{"inauspiciousYogas", r.InauspiciousYogas},
	} {
		if f.list != nil {
			o.put(f.key, f.list)
		}
	}
	if r.Bhadra != nil {
		o.put("bhadra", string(*r.Bhadra))
	}
	if r.ExcludeBhadra {
		o.put("excludeBhadra", true)
	}
	if r.ExcludeEkadashi {
		o.put("excludeEkadashi", true)
	}
	if r.RequirePaksha != "" {
		o.put("requirePaksha", string(r.RequirePaksha))
	}
	if r.ExcludeAdhikaMasa {
		o.put("excludeAdhikaMasa", true)
	}
	if r.ExcludeEclipse {
		o.put("excludeEclipse", true)
	}
	if r.ExcludeGandaMula {
		o.put("excludeGandaMula", true)
	}
	if r.ExcludePanchaka {
		o.put("excludePanchaka", true)
	}
	if r.VaraTithiYogas != nil {
		o.put("varaTithiYogas", *r.VaraTithiYogas)
	}
	o.end()
}

type formatCase struct {
	iso    string
	offset int
}

var formatCases = []formatCase{
	{"2025-01-14T01:39:44.172Z", 330},
	{"2025-01-14T01:39:44.172Z", 0},
	{"2025-01-14T01:39:44.172Z", -300},
	{"2025-01-14T01:39:44.172Z", -270},
	{"2025-06-30T23:59:59.999Z", 840},
	{"2025-06-30T23:59:59.999Z", -720},
	{"1912-06-01T00:00:00.000Z", 330},
	{"0999-03-04T12:34:56.789Z", 60},
	{"0099-12-31T23:00:00.000Z", -60},
	{"2088-06-01T00:00:00.000Z", 345},
}

func writeHelpers(doc *obj) {
	h := doc.obj("helpers")

	fmtObj := h.obj("formatInZone")
	for _, c := range formatCases {
		ms, err := parseISOInstant(c.iso)
		if err != nil {
			fatal(err)
		}
		fmtObj.put(fmt.Sprintf("%s|%d", c.iso, c.offset), utils.FormatInZone(ms, c.offset))
	}
	fmtObj.end()

	vty := h.obj("varaTithiYogas")
	for v := 0; v < 7; v++ {
		for t := 0; t < 30; t++ {
			vty.put(fmt.Sprintf("%d|%d", v, t), safe2(muhurta.ComputeVaraTithiYogas(v, t)))
		}
	}
	vty.end()

	kp := h.arr("kpSubLord")
	for x := 0.0; x < 360; x += 0.37 {
		kp.push(jyotish.ComputeKpSubLord(x))
	}
	kp.end()

	pk := h.obj("panchaka")
	for x := 0.0; x < 360; x += 1.13 {
		pk.put(toFixed2(x), core.ComputePanchaka(x))
	}
	for v := 0; v < 7; v++ {
		t, err := core.ClassifyPanchaka(v)
		if err != nil {
			fatal(err)
		}
		o := pk.obj(fmt.Sprintf("classify|%d", v))
		o.put("type", t)
		o.put("isDosha", core.IsPanchakaDosha(t))
		o.end()
	}
	pk.end()

	dg := h.obj("dignity")
	for _, g := range types.AllGrahas {
		for r := 0; r < 12; r++ {
			dg.put(fmt.Sprintf("%s|%d", g.String(), r), safe2(jyotish.ComputeDignity(g, r)))
		}
	}
	dg.end()

	cb := h.obj("chandraBalam")
	for j := 0; j < 12; j++ {
		for t := 0; t < 12; t++ {
			cb.put(fmt.Sprintf("%d|%d|en", j, t),
				safe2(jyotish.ComputeChandraBalam(j, t, types.LanguageEn)))
			cb.put(fmt.Sprintf("%d|%d|hi", j, t),
				safe2(jyotish.ComputeChandraBalam(j, t, types.LanguageHi)))
		}
	}
	cb.end()

	tb := h.obj("tarabala")
	for j := 0; j < 27; j++ {
		for t := 0; t < 27; t++ {
			tb.put(fmt.Sprintf("%d|%d|en", j, t),
				safe2(jyotish.ComputeTarabala(j, t, types.LanguageEn)))
			tb.put(fmt.Sprintf("%d|%d|hi", j, t),
				safe2(jyotish.ComputeTarabala(j, t, types.LanguageHi)))
		}
	}
	tb.end()

	h.end()
}

func writeTables(doc *obj) {
	pune := locations[0]
	dir := filepath.Join(outDir(), "tables-"+label())
	if err := os.MkdirAll(dir, 0o755); err != nil {
		fatal(err)
	}

	hashes := doc.obj("tables")
	for _, ep := range epochs {
		y := ep.Year
		festivals, err := calendar.BuildFestivalsTable(context.Background(), newCtx(), calendar.BuildFestivalsTableOptions{
			Location: pune.geo, TimezoneOffsetMinutes: 330, StartYear: y, EndYear: y,
			ReferenceLocation: "Pune", GeneratedAt: pinnedGeneratedAt,
		})
		if err != nil {
			fatal(err)
		}
		eclipses, err := calendar.BuildEclipsesTable(context.Background(), newCtx(), calendar.BuildEclipsesTableOptions{
			Location: pune.geo, TimezoneOffsetMinutes: 330, StartYear: y, EndYear: y,
			ReferenceLocation: "Pune", GeneratedAt: pinnedGeneratedAt,
		})
		if err != nil {
			fatal(err)
		}
		phases, err := calendar.BuildMoonPhasesTable(context.Background(), newCtx(), calendar.BuildMoonPhasesTableOptions{
			TimezoneOffsetMinutes: 330, StartYear: y, EndYear: y,
			ReferenceLocation: "Pune", GeneratedAt: pinnedGeneratedAt,
		})
		if err != nil {
			fatal(err)
		}
		vivah, ok := rules.Get("vivah")
		if !ok {
			fatal(errors.New("dump: STOCK_MUHURTA_RULES is missing \"vivah\""))
		}
		muhurtaTable, err := muhurta.BuildMuhurtaTable(context.Background(), newCtx(), muhurta.BuildMuhurtaTableOptions{
			Rule: vivah, Location: pune.geo, TimezoneOffsetMinutes: 330,
			StartYear: y, EndYear: y,
			ReferenceLocation: "Pune", GeneratedAt: pinnedGeneratedAt,
		})
		if err != nil {
			fatal(err)
		}

		for _, f := range []struct {
			name string
			file any
		}{
			{fmt.Sprintf("festivals-%d.json", y), festivals},
			{fmt.Sprintf("eclipses-%d.json", y), eclipses},
			{fmt.Sprintf("moonPhases-%d.json", y), phases},
			{fmt.Sprintf("muhurta-%d.json", y), muhurtaTable},
		} {
			raw, err := tablejson.Marshal(f.file)
			if err != nil {
				fatal(err)
			}
			path := filepath.Join(dir, f.name)
			if err := os.WriteFile(path, raw, 0o644); err != nil {
				fatal(err)
			}
			if strings.HasPrefix(f.name, "eclipses-") {
				sum := sha256.Sum256(maskEclipseFloats(raw))
				hashes.put(f.name+"|floats-masked", hex.EncodeToString(sum[:]))
			} else {
				sum := sha256.Sum256(raw)
				hashes.put(f.name, hex.EncodeToString(sum[:]))
			}
		}
	}
	hashes.end()
}

func maskEclipseFloats(raw []byte) []byte {
	return dumpMagnitudePattern.ReplaceAll(
		dumpObscurationPattern.ReplaceAll(raw, []byte("${1}<float>")),
		[]byte("${1}<float>"))
}

var (
	dumpObscurationPattern = regexp.MustCompile(`("obscuration": )-?[0-9.eE+-]+`)
	dumpMagnitudePattern   = regexp.MustCompile(`("magnitude": )-?[0-9.eE+-]+`)
)

func outDir() string {
	if v := os.Getenv("PARITY_OUT"); v != "" {
		return v
	}
	return filepath.Join(repopath.Go("parity"), "out")
}

func label() string {
	if v := os.Getenv("PARITY_LABEL"); v != "" {
		return v
	}
	return "go-" + string(stage)
}

func toFixed2(x float64) string { return strconv.FormatFloat(x, 'f', 2, 64) }

func parseISOInstant(iso string) (int64, error) {
	var d types.JSDate
	if err := d.UnmarshalJSON([]byte(`"` + iso + `"`)); err != nil {
		return 0, fmt.Errorf("dump: format case %q: %w", iso, err)
	}
	return d.Ms(), nil
}

func main() {
	start := time.Now()
	doc := newObj()
	writeMeta(doc)
	writeDaily(doc)
	writeInstant(doc)
	if stage == stageFull {
		writeYearly(doc)
	}
	writePolar(doc)
	if chartsIn() {
		writeCharts(doc)
		writeChartPairs(doc)
		writeMatching(doc)
	}
	if stage == stageFull {
		writeMuhurta(doc)
		writeConvert(doc)
		writeConstants(doc)
		writeHelpers(doc)
		writeTables(doc)
	}
	doc.end()
	raw("\n")
	if err := out.Flush(); err != nil {
		fatal(err)
	}
	fmt.Fprintf(os.Stderr, "dump: %s\n", time.Since(start).Round(time.Millisecond))
}
