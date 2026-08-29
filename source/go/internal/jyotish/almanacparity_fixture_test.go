package jyotish

import (
	"encoding/json"
	"math"
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

// Expectations derived from the reference almanac's stated rules, with no library output consulted.

const almanacSadeSatiAsOfISO = "2026-05-04T12:00:00Z"

var almanacSadeSatiAsOfMs = types.DateUTC(2026, 4, 4).Ms() + 12*3_600_000

// Barbara Pijan's Shani Gochara table; firstAlt is the pre-retrograde ingress, either date passes.
var saturnEnters = map[string][]struct{ date, firstAlt string }{
	"Tula":      {{date: "2012-08-03", firstAlt: "2011-11-14"}},
	"Vrischika": {{date: "2014-11-02"}},
	"Dhanu":     {{date: "2017-10-26", firstAlt: "2017-01-26"}},
	"Makara":    {{date: "2020-01-23"}},
	"Kumbha":    {{date: "2023-01-17", firstAlt: "2022-04-28"}},
	"Meena":     {{date: "2025-03-29"}},
	"Mesha":     {{date: "2028-02-23", firstAlt: "2027-06-02"}},
}

const almanacArcToleranceDays = 2.0

func withinIngress(t *testing.T, boundaryMs int64, rashiName string) bool {
	t.Helper()
	for _, c := range saturnEnters[rashiName] {
		for _, iso := range []string{c.date, c.firstAlt} {
			if iso == "" {
				continue
			}
			ms, err := types.ParseISODay(iso)
			if err != nil {
				t.Fatalf("saturnEnters date %q: %v", iso, err)
			}
			if math.Abs(float64(boundaryMs-ms))/86_400_000 <= almanacArcToleranceDays {
				return true
			}
		}
	}
	return false
}

type almanacExpectedMangalRef struct {
	Afflicted bool `json:"afflicted"`
	House     int  `json:"house"`
}

type almanacChart struct {
	Name      string  `json:"name"`
	DateLocal string  `json:"dateLocal"`
	Tzh       float64 `json:"tzh"`
	Lat       float64 `json:"lat"`
	Lon       float64 `json:"lon"`

	NatalMoonRashi int `json:"natalMoonRashi"`

	Mangal struct {
		Afflicted            bool                     `json:"afflicted"`
		Severity             string                   `json:"severity"`
		FromLagna            almanacExpectedMangalRef `json:"fromLagna"`
		FromMoon             almanacExpectedMangalRef `json:"fromMoon"`
		FromVenus            almanacExpectedMangalRef `json:"fromVenus"`
		CancellationsContain []string                 `json:"cancellationsContain"`
	} `json:"mangal"`

	KaalSarp struct {
		Afflicted bool    `json:"afflicted"`
		Subtype   *string `json:"subtype"`
		RahuHouse int     `json:"rahuHouse"`
		KetuHouse int     `json:"ketuHouse"`
	} `json:"kaalSarp"`

	SadeSati struct {
		Active                bool   `json:"active"`
		Phase                 *int   `json:"phase"`
		ExpectedArcStartRashi string `json:"expectedArcStartRashi"`
		ExpectedArcEndRashi   string `json:"expectedArcEndRashi"`
	} `json:"sadeSati_2026_05_04"`
}

type almanacFile struct {
	Meta struct {
		Tolerance       string `json:"tolerance"`
		AsOfForSadesati string `json:"asOf_for_sadesati"`
		Scope           string `json:"scope"`
	} `json:"_meta"`
	Charts []almanacChart `json:"charts"`
}

func loadAlmanacParity(t *testing.T) almanacFile {
	t.Helper()
	raw, err := repopath.ReadTestData("almanac", "almanac-parity", "charts.json")
	if err != nil {
		t.Fatalf("reading almanac-parity/charts.json: %v", err)
	}
	var f almanacFile
	if err := json.Unmarshal(raw, &f); err != nil {
		t.Fatalf("parsing almanac-parity/charts.json: %v", err)
	}
	if len(f.Charts) != 12 {
		t.Fatalf("fixture holds %d charts, want 12 reference natives", len(f.Charts))
	}
	return f
}

func TestAlmanacParityToleranceIsTheDeclaredOne(t *testing.T) {
	f := loadAlmanacParity(t)
	if !strings.Contains(f.Meta.Tolerance, "±2 days") {
		t.Errorf("_meta.tolerance no longer states ±2 days for the arc boundaries: %q", f.Meta.Tolerance)
	}
	if !strings.Contains(f.Meta.Tolerance, "set-superset") {
		t.Errorf("_meta.tolerance no longer states the set-superset rule for cancellations: %q", f.Meta.Tolerance)
	}
	if !strings.Contains(f.Meta.Tolerance, "exact") {
		t.Errorf("_meta.tolerance no longer states exactness for the dosha bool/int fields: %q", f.Meta.Tolerance)
	}
	if !strings.HasPrefix(f.Meta.AsOfForSadesati, almanacSadeSatiAsOfISO) {
		t.Errorf("_meta.asOf_for_sadesati is %q; this test pins %s",
			f.Meta.AsOfForSadesati, almanacSadeSatiAsOfISO)
	}
	if got := types.Date(almanacSadeSatiAsOfMs).ISOString(); got != "2026-05-04T12:00:00.000Z" {
		t.Errorf("almanacSadeSatiAsOfMs is %s, want 2026-05-04T12:00:00.000Z", got)
	}
	if !strings.Contains(f.Meta.Scope, "OUT OF SCOPE") {
		t.Errorf("_meta.scope no longer records the Yoga/Pitru exclusion: %q", f.Meta.Scope)
	}
}

func TestAlmanacParityMangalAndKaalSarp(t *testing.T) {
	f := loadAlmanacParity(t)
	afflictedMangal, afflictedKaalSarp, withCancellations := 0, 0, 0
	severities := map[string]int{}
	for _, c := range f.Charts {
		ms := astrosageBirthMs(t, c.DateLocal, c.Tzh)
		loc := types.GeoLocation{Latitude: c.Lat, Longitude: c.Lon}
		chart, err := ComputeRashiChart(astronomy.NewEphemerisCtx(), ms, loc,
			BirthChartOptions{Ayanamsa: types.Lahiri})
		if err != nil {
			t.Fatalf("%s: ComputeRashiChart: %v", c.Name, err)
		}

		m := ComputeMangalDosha(&chart)
		exp := c.Mangal
		if m.Afflicted != exp.Afflicted {
			t.Errorf("%s mangal.afflicted: got %v, want %v", c.Name, m.Afflicted, exp.Afflicted)
		}
		if string(m.Severity) != exp.Severity {
			t.Errorf("%s mangal.severity: got %q, want %q", c.Name, m.Severity, exp.Severity)
		}
		for _, ref := range []struct {
			what string
			got  types.MangalReference
			want almanacExpectedMangalRef
		}{
			{"fromLagna", m.FromLagna, exp.FromLagna},
			{"fromMoon", m.FromMoon, exp.FromMoon},
			{"fromVenus", m.FromVenus, exp.FromVenus},
		} {
			if ref.got.Afflicted != ref.want.Afflicted || ref.got.House != ref.want.House {
				t.Errorf("%s mangal.%s: got {afflicted:%v house:%d}, want {afflicted:%v house:%d}",
					c.Name, ref.what, ref.got.Afflicted, ref.got.House, ref.want.Afflicted, ref.want.House)
			}
		}
		if len(exp.CancellationsContain) > 0 {
			withCancellations++
			for _, wantPrefix := range exp.CancellationsContain {
				found := false
				for _, got := range m.Cancellations {
					if strings.Contains(got, wantPrefix) {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("%s mangal.cancellations: no entry contains %q; got [%s]",
						c.Name, wantPrefix, strings.Join(m.Cancellations, "; "))
				}
			}
		} else if len(m.Cancellations) != 0 {
			// The empty arm is an equality, not a superset.
			t.Errorf("%s mangal.cancellations: want [], got [%s]",
				c.Name, strings.Join(m.Cancellations, "; "))
		}
		if m.Afflicted {
			afflictedMangal++
		}
		severities[string(m.Severity)]++

		k := ComputeKaalSarp(&chart)
		ek := c.KaalSarp
		if k.Afflicted != ek.Afflicted {
			t.Errorf("%s kaalSarp.afflicted: got %v, want %v", c.Name, k.Afflicted, ek.Afflicted)
		}
		gotSubtype := ""
		if k.Subtype != nil {
			gotSubtype = string(*k.Subtype)
		}
		wantSubtype := ""
		if ek.Subtype != nil {
			wantSubtype = *ek.Subtype
		}
		if gotSubtype != wantSubtype {
			t.Errorf("%s kaalSarp.subtype: got %q, want %q", c.Name, gotSubtype, wantSubtype)
		}
		if k.RahuHouse != ek.RahuHouse {
			t.Errorf("%s kaalSarp.rahuHouse: got %d, want %d", c.Name, k.RahuHouse, ek.RahuHouse)
		}
		if k.KetuHouse != ek.KetuHouse {
			t.Errorf("%s kaalSarp.ketuHouse: got %d, want %d", c.Name, k.KetuHouse, ek.KetuHouse)
		}
		// `partial` is not asserted: the reference almanac does not list partial Kaal Sarpa.
		if k.Afflicted {
			afflictedKaalSarp++
		}
	}
	if afflictedMangal == 0 {
		t.Error("no chart is Mangal-afflicted; the corpus has stopped exercising the flagged branch")
	}
	if withCancellations == 0 {
		t.Error("no chart expects a cancellation; the set-superset rule is untested")
	}
	if len(severities) < 2 {
		t.Errorf("only %d distinct severities across 12 charts: %v", len(severities), severities)
	}
	t.Logf("12 charts: %d Mangal-afflicted, %d with expected cancellations, severities %v; "+
		"%d Kaal-Sarp-afflicted", afflictedMangal, withCancellations, severities, afflictedKaalSarp)
}

func TestAlmanacParitySadeSati(t *testing.T) {
	f := loadAlmanacParity(t)
	active, inactive, startsChecked, endsChecked, endsSkipped := 0, 0, 0, 0, 0
	for _, c := range f.Charts {
		s, err := ComputeSadeSati(astronomy.NewEphemerisCtx(), c.NatalMoonRashi,
			almanacSadeSatiAsOfMs, types.Lahiri)
		if err != nil {
			t.Fatalf("%s: ComputeSadeSati: %v", c.Name, err)
		}
		exp := c.SadeSati

		if s.Active != exp.Active {
			t.Errorf("%s sadeSati.active: got %v, want %v", c.Name, s.Active, exp.Active)
			continue
		}
		gotPhase, wantPhase := -1, -1
		if s.Phase != nil {
			gotPhase = *s.Phase
		}
		if exp.Phase != nil {
			wantPhase = *exp.Phase
		}
		if gotPhase != wantPhase {
			t.Errorf("%s sadeSati.phase: got %d, want %d (-1 = null)", c.Name, gotPhase, wantPhase)
		}

		if exp.Active {
			active++
			if exp.ExpectedArcStartRashi != "" {
				if s.CurrentArcStart == nil {
					t.Errorf("%s sadeSati.currentArcStart is null while active", c.Name)
				} else {
					startsChecked++
					if !withinIngress(t, s.CurrentArcStart.Ms(), exp.ExpectedArcStartRashi) {
						t.Errorf("%s sadeSati arc start %s is not within ±%.0f days of Saturn entering %s",
							c.Name, s.CurrentArcStart.ISOString(), almanacArcToleranceDays, exp.ExpectedArcStartRashi)
					}
				}
			}
			if exp.ExpectedArcEndRashi != "" {
				if _, known := saturnEnters[exp.ExpectedArcEndRashi]; !known {
					// ~2030 Vrishabha: unpinned, so only non-nullness holds.
					endsSkipped++
					if s.CurrentArcEnd == nil {
						t.Errorf("%s sadeSati.currentArcEnd is null while active", c.Name)
					}
				} else if s.CurrentArcEnd == nil {
					t.Errorf("%s sadeSati.currentArcEnd is null while active", c.Name)
				} else {
					endsChecked++
					if !withinIngress(t, s.CurrentArcEnd.Ms(), exp.ExpectedArcEndRashi) {
						t.Errorf("%s sadeSati arc end %s is not within ±%.0f days of Saturn entering %s",
							c.Name, s.CurrentArcEnd.ISOString(), almanacArcToleranceDays, exp.ExpectedArcEndRashi)
					}
				}
			}
		} else {
			inactive++
			if s.CurrentArcStart != nil || s.CurrentArcEnd != nil {
				t.Errorf("%s inactive but carries an arc: start=%v end=%v",
					c.Name, s.CurrentArcStart, s.CurrentArcEnd)
			}
			if s.NextArcStart == nil {
				t.Errorf("%s inactive but nextArcStart is null", c.Name)
			}
		}
	}
	if active == 0 || inactive == 0 {
		t.Errorf("sade sati arms: %d active, %d inactive. Both must be exercised", active, inactive)
	}
	if startsChecked == 0 {
		t.Error("no arc start was checked against an ingress; the ±2-day tolerance is untested")
	}
	t.Logf("12 charts: %d active (%d arc starts and %d arc ends checked against ingress, "+
		"%d ends skipped for want of a reference), %d inactive with nextArcStart populated",
		active, startsChecked, endsChecked, endsSkipped, inactive)
}
