package jyotish

import (
	"encoding/json"
	"errors"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"math"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

const varshaphalaLonBound = 1e-9 // a thousand times the observed ~5e-13° sum of three chart longitudes

type varshaphalaGolden struct {
	Ages      []int `json:"ages"`
	Locations []struct {
		Name      string  `json:"name"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	} `json:"locations"`
	SiderealYearDays float64  `json:"siderealYearDays"`
	SunDegPerDay     float64  `json:"sunDegPerDay"`
	SahamNames       []string `json:"sahamNames"`
	SahamFormulas    []struct {
		Name string `json:"name"`
		X    string `json:"x"`
		Y    string `json:"y"`
		Z    string `json:"z"`
		Swap bool   `json:"swap"`
	} `json:"sahamFormulas"`
	Births []int64 `json:"births"`
	Sweep  []struct {
		Ms    int64            `json:"ms"`
		Loc   string           `json:"loc"`
		Age   int              `json:"age"`
		Chart VarshaphalaChart `json:"chart"`
	} `json:"sweep"`
	SolarReturns []struct {
		Ms       int64   `json:"ms"`
		Age      int     `json:"age"`
		NatalSun float64 `json:"natalSun"`
		Instant  int64   `json:"instant"`
	} `json:"solarReturns"`
	SolarReturnsByAyanamsa []struct {
		Ayanamsa types.AyanamsaType `json:"ayanamsa"`
		Ms       int64              `json:"ms"`
		NatalSun float64            `json:"natalSun"`
		Instant  int64              `json:"instant"`
	} `json:"solarReturnsByAyanamsa"`
	Triraashi []struct {
		Rashi int    `json:"rashi"`
		Day   string `json:"day"`
		Night string `json:"night"`
	} `json:"triraashi"`
	SahamAt    int64 `json:"sahamAt"`
	PerFormula []struct {
		IsDay bool `json:"isDay"`
		Rows  []struct {
			Name      string  `json:"name"`
			Longitude float64 `json:"longitude"`
		} `json:"rows"`
	} `json:"perFormula"`
	BadAges []struct {
		Age   float64 `json:"age"`
		Threw bool    `json:"threw"`
		Code  *string `json:"code"`
	} `json:"badAges"`
}

func loadVarshaphalaGolden(t *testing.T) varshaphalaGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "jyotish", "varshaphala-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g varshaphalaGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.Sweep) == 0 || len(g.SolarReturns) == 0 {
		t.Fatal("golden is empty")
	}
	return g
}

func varshaLoc(g varshaphalaGolden, name string) types.GeoLocation {
	for _, l := range g.Locations {
		if l.Name == name {
			return types.GeoLocation{Latitude: l.Latitude, Longitude: l.Longitude}
		}
	}
	panic("unknown location " + name)
}

func TestSunDegPerDayIsTwoStepped(t *testing.T) {
	g := loadVarshaphalaGolden(t)

	if siderealYearDays != g.SiderealYearDays {
		t.Errorf("siderealYearDays = %.17g, TypeScript %.17g", siderealYearDays, g.SiderealYearDays)
	}
	if sunDegPerDay != g.SunDegPerDay {
		t.Errorf("sunDegPerDay = %.20g, TypeScript %.20g", sunDegPerDay, g.SunDegPerDay)
	}
	var y float64 = 365.25636
	if want := 360 / y; sunDegPerDay != want {
		t.Errorf("sunDegPerDay = %.20g but the two-step form gives %.20g; "+
			"siderealYearDays has lost its float64 type and the constant is being "+
			"folded at arbitrary precision", sunDegPerDay, want)
	}
	const folded = 360.0 / 365.25636
	if float64(folded) == sunDegPerDay {
		t.Log("note: the folded and two-step forms now agree; they differed by one " +
			"ULP when this was written, so either the constant changed or the " +
			"measurement was wrong")
	} else {
		t.Logf("the arbitrary-precision fold would give %.20g, one ULP from the "+
			"JavaScript value %.20g", float64(folded), sunDegPerDay)
	}
}

func TestSahamTablesMatchTypeScript(t *testing.T) {
	g := loadVarshaphalaGolden(t)

	if len(g.SahamFormulas) != SahamNameCount {
		t.Fatalf("golden has %d formulas, Go has %d", len(g.SahamFormulas), SahamNameCount)
	}
	for i, want := range g.SahamFormulas {
		got := SahamFormulas[i]
		if got.Name.String() != want.Name {
			t.Errorf("formula %d: name %s, TypeScript %s", i, got.Name, want.Name)
		}
		if got.X.String() != want.X || got.Y.String() != want.Y || got.Z.String() != want.Z {
			t.Errorf("%s: (%s − %s + %s), TypeScript (%s − %s + %s)",
				got.Name, got.X, got.Y, got.Z, want.X, want.Y, want.Z)
		}
		if got.Swap != want.Swap {
			t.Errorf("%s: swap %v, TypeScript %v", got.Name, got.Swap, want.Swap)
		}
	}
	for i, want := range g.SahamNames {
		if AllSahamNames[i].String() != want {
			t.Errorf("AllSahamNames[%d] = %s, TypeScript %s", i, AllSahamNames[i], want)
		}
	}
	for i := range SahamFormulas {
		if AllSahamNames[i] != SahamFormulas[i].Name {
			t.Errorf("AllSahamNames[%d] = %s but SahamFormulas[%d].Name = %s",
				i, AllSahamNames[i], i, SahamFormulas[i].Name)
		}
	}
}

func TestSahamDependenciesPrecedeTheirUse(t *testing.T) {
	computedAt := map[SahamName]int{}
	users := 0
	for i, f := range SahamFormulas {
		for _, op := range []SahamOperand{f.X, f.Y, f.Z} {
			if op != OperandPunya {
				continue
			}
			users++
			at, ok := computedAt[SahamPunya]
			if !ok {
				t.Errorf("%s (row %d) reads Punya before Punya's own row", f.Name, i)
				continue
			}
			if at >= i {
				t.Errorf("%s is at row %d and Punya at row %d", f.Name, i, at)
			}
		}
		computedAt[f.Name] = i
	}
	if users != 3 {
		t.Errorf("%d rows reference Punya; Yasas, Mitra and Susha are the three "+
			"the sources define that way", users)
	}
	for _, f := range SahamFormulas {
		for _, op := range []SahamOperand{f.X, f.Y, f.Z} {
			if op > OperandPunya {
				t.Errorf("%s uses operand %v, which is outside the known set", f.Name, op)
			}
		}
	}
}

func TestSahamOperandGrahasMatchTheEnum(t *testing.T) {
	for i, v := range types.AllVisibleGrahas {
		op := SahamOperand(i)
		if op.String() != v.String() {
			t.Errorf("SahamOperand(%d) is %s but AllVisibleGrahas[%d] is %s; "+
				"resolveOperand converts by ordinal and would resolve the wrong graha",
				i, op, i, v)
		}
	}
	if OperandSaturn != SahamOperand(types.VisibleGrahaCount-1) {
		t.Errorf("OperandSaturn = %d, expected %d", OperandSaturn, types.VisibleGrahaCount-1)
	}
}

func TestVisibleGrahaIndexOrderMatchesTheEnum(t *testing.T) {
	want := []string{"Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"}
	if len(want) != types.VisibleGrahaCount {
		t.Fatalf("VISIBLE_GRAHAS_BY_INDEX has %d entries, the enum %d",
			len(want), types.VisibleGrahaCount)
	}
	for i, name := range want {
		if types.AllVisibleGrahas[i].String() != name {
			t.Errorf("AllVisibleGrahas[%d] = %s, VISIBLE_GRAHAS_BY_INDEX[%d] = %s",
				i, types.AllVisibleGrahas[i], i, name)
		}
	}
}

func TestFindSolarReturnMatchesTypeScript(t *testing.T) {
	g := loadVarshaphalaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	ages := map[int]int{}

	for _, c := range g.SolarReturns {
		got, err := FindSolarReturn(ctx, c.Ms, c.Age, c.NatalSun, "lahiri")
		if err != nil {
			t.Fatalf("birth=%d age=%d: %v", c.Ms, c.Age, err)
		}
		if got != c.Instant {
			t.Errorf("birth=%d age=%d: %d (%s), TypeScript %d (%s), delta %d ms",
				c.Ms, c.Age, got, types.Date(got).ISOString(),
				c.Instant, types.Date(c.Instant).ISOString(), got-c.Instant)
		}
		ages[c.Age]++
	}
	for _, c := range g.SolarReturnsByAyanamsa {
		got, err := FindSolarReturn(ctx, c.Ms, 30, c.NatalSun, c.Ayanamsa)
		if err != nil {
			t.Fatalf("ayanamsa %s: %v", c.Ayanamsa, err)
		}
		if got != c.Instant {
			t.Errorf("ayanamsa %s: %d, TypeScript %d, delta %d ms",
				c.Ayanamsa, got, c.Instant, got-c.Instant)
		}
	}

	neg := 0
	for _, c := range g.SolarReturns {
		if c.Instant < 0 {
			neg++
		}
	}
	if neg == 0 {
		t.Error("no solar return landed before 1970; the Math.round-vs-math.Round " +
			"distinction in the exit conversion is untested")
	}
	t.Logf("%d solar returns across %d ages (%d before 1970) plus %d ayanamsas, all exact",
		len(g.SolarReturns), len(ages), neg, len(g.SolarReturnsByAyanamsa))
}

func TestSolarReturnConvergesToTolerance(t *testing.T) {
	g := loadVarshaphalaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	var worst float64
	for _, c := range g.SolarReturns {
		lon, err := astronomy.GetSiderealSunLongitude(ctx, c.Instant, "lahiri")
		if err != nil {
			t.Fatalf("%v", err)
		}
		d := math.Abs(utils.Normalize360(lon-c.NatalSun+180) - 180)
		if d > worst {
			worst = d
		}
	}
	if worst > 1e-4 {
		t.Errorf("worst |sidereal Sun − natal Sun| at a returned instant is %g deg, "+
			"above the documented 1e-4", worst)
	}
	t.Logf("worst |sidereal Sun − natal Sun| at the returned instant: %g deg", worst)
}

func TestTriraashiPatiMatchesTypeScript(t *testing.T) {
	g := loadVarshaphalaGolden(t)
	for _, c := range g.Triraashi {
		if got := TriraashiPatiForTest(c.Rashi, true); got.String() != c.Day {
			t.Errorf("rashi %d day: %s, TypeScript %s", c.Rashi, got, c.Day)
		}
		if got := TriraashiPatiForTest(c.Rashi, false); got.String() != c.Night {
			t.Errorf("rashi %d night: %s, TypeScript %s", c.Rashi, got, c.Night)
		}
	}
	for r := 0; r < 12; r++ {
		if got, want := TriraashiPatiForTest(r, true), TriraashiPatiForTest(r%4, true); got != want {
			t.Errorf("day rashi %d gives %s but element %d gives %s", r, got, r%4, want)
		}
		if got, want := TriraashiPatiForTest(r, false), TriraashiPatiForTest(r%4, false); got != want {
			t.Errorf("night rashi %d gives %s but element %d gives %s", r, got, r%4, want)
		}
	}
	if TriraashiPatiForTest(1, true) != types.VisibleVenus ||
		TriraashiPatiForTest(3, true) != types.VisibleVenus {
		t.Error("Venus is the day ruler of both earth and water triplicities " +
			"(B.V. Raman, Annual Horoscope Ch. 2)")
	}
}

func TestVarshaphalaMatchesTypeScript(t *testing.T) {
	g := loadVarshaphalaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	var worstLon float64
	days, nights := 0, 0
	lords := map[types.VisibleGraha]int{}

	for _, c := range g.Sweep {
		loc := varshaLoc(g, c.Loc)
		got, err := ComputeVarshaphala(ctx, c.Ms, c.Age, loc, BirthChartOptions{})
		if err != nil {
			t.Fatalf("birth=%d age=%d loc=%s: %v", c.Ms, c.Age, c.Loc, err)
		}
		w := c.Loc + "/age" + itoa(c.Age)

		if got.SolarReturnInstant.Ms() != c.Chart.SolarReturnInstant.Ms() {
			t.Errorf("%s: solar return %d, TypeScript %d (delta %d ms)", w,
				got.SolarReturnInstant.Ms(), c.Chart.SolarReturnInstant.Ms(),
				got.SolarReturnInstant.Ms()-c.Chart.SolarReturnInstant.Ms())
		}
		if got.IsDayBirth != c.Chart.IsDayBirth {
			t.Errorf("%s: isDayBirth %v, TypeScript %v, so every swapped Saham and the "+
				"Triraashi Pati change with it", w, got.IsDayBirth, c.Chart.IsDayBirth)
		}
		if got.YearLord != c.Chart.YearLord {
			t.Errorf("%s: yearLord %s, TypeScript %s", w, got.YearLord, c.Chart.YearLord)
		}
		if got.Muntha != c.Chart.Muntha {
			t.Errorf("%s: muntha %+v, TypeScript %+v", w, got.Muntha, c.Chart.Muntha)
		}
		if d := math.Abs(got.VarshaLagna.SiderealLongitude - c.Chart.VarshaLagna.SiderealLongitude); d > varshaphalaLonBound {
			t.Errorf("%s: varsha lagna %.17g, TypeScript %.17g (delta %g)",
				w, got.VarshaLagna.SiderealLongitude, c.Chart.VarshaLagna.SiderealLongitude, d)
		} else if d > worstLon {
			worstLon = d
		}
		if got.VarshaLagna.Rashi.Index != c.Chart.VarshaLagna.Rashi.Index {
			t.Errorf("%s: varsha lagna rashi %d, TypeScript %d",
				w, got.VarshaLagna.Rashi.Index, c.Chart.VarshaLagna.Rashi.Index)
		}

		for _, name := range AllSahamNames {
			gp, _ := got.Sahams.Get(name)
			wp, _ := c.Chart.Sahams.Get(name)
			if d := math.Abs(gp.Longitude - wp.Longitude); d > varshaphalaLonBound {
				t.Errorf("%s/%s: longitude %.17g, TypeScript %.17g (delta %g)",
					w, name, gp.Longitude, wp.Longitude, d)
			} else if d > worstLon {
				worstLon = d
			}
			if gp.Rashi != wp.Rashi || gp.House != wp.House || gp.RashiName != wp.RashiName {
				t.Errorf("%s/%s: rashi %d/%q house %d, TypeScript rashi %d/%q house %d",
					w, name, gp.Rashi, gp.RashiName, gp.House, wp.Rashi, wp.RashiName, wp.House)
			}
		}

		if len(got.Planets) != len(c.Chart.Planets) {
			t.Errorf("%s: %d planets, TypeScript %d", w, len(got.Planets), len(c.Chart.Planets))
		}
		if len(got.Bhava.Houses) != len(c.Chart.Bhava.Houses) {
			t.Errorf("%s: %d houses, TypeScript %d", w, len(got.Bhava.Houses), len(c.Chart.Bhava.Houses))
		}

		if got.IsDayBirth {
			days++
		} else {
			nights++
		}
		lords[got.YearLord]++
	}

	if days == 0 || nights == 0 {
		t.Errorf("only one day/night arm reached: %d day, %d night", days, nights)
	}
	if len(lords) < 3 {
		t.Errorf("only %d distinct year lords across %d charts; the four-candidate "+
			"selection is barely exercised: %v", len(lords), len(g.Sweep), lords)
	}
	t.Logf("%d charts: %d day-returns, %d night, %d distinct year lords; "+
		"worst longitude delta %g deg (bound %g)",
		len(g.Sweep), days, nights, len(lords), worstLon, varshaphalaLonBound)
}

func TestSahamPerFormulaMatchesTypeScript(t *testing.T) {
	g := loadVarshaphalaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	loc := varshaLoc(g, g.Locations[0].Name)

	natalSun, err := astronomy.GetSiderealSunLongitude(ctx, g.SahamAt, "lahiri")
	if err != nil {
		t.Fatal(err)
	}
	srMs, err := FindSolarReturn(ctx, g.SahamAt, 30, natalSun, "lahiri")
	if err != nil {
		t.Fatal(err)
	}
	chart, err := ComputeRashiChart(ctx, srMs, loc, BirthChartOptions{})
	if err != nil {
		t.Fatal(err)
	}

	swapped := 0
	for _, arm := range g.PerFormula {
		if len(arm.Rows) != SahamNameCount {
			t.Fatalf("isDay=%v: %d rows, expected %d", arm.IsDay, len(arm.Rows), SahamNameCount)
		}
		var punya float64
		var havePunya bool
		for i, row := range arm.Rows {
			f := SahamFormulas[i]
			var prior *float64
			if havePunya {
				prior = &punya
			}
			got, err := EvaluateSahamForTest(f, arm.IsDay, &chart, prior)
			if err != nil {
				t.Fatalf("isDay=%v %s: %v", arm.IsDay, f.Name, err)
			}
			if d := math.Abs(got - row.Longitude); d > varshaphalaLonBound {
				t.Errorf("isDay=%v %s: %.17g, TypeScript %.17g (delta %g)",
					arm.IsDay, f.Name, got, row.Longitude, d)
			}
			if f.Name == SahamPunya {
				punya, havePunya = got, true
			}
		}
	}

	if len(g.PerFormula) != 2 {
		t.Fatalf("expected a day and a night arm, got %d", len(g.PerFormula))
	}
	dayArm, nightArm := g.PerFormula[0], g.PerFormula[1]
	if !dayArm.IsDay || nightArm.IsDay {
		dayArm, nightArm = nightArm, dayArm
	}
	for i, f := range SahamFormulas {
		same := dayArm.Rows[i].Longitude == nightArm.Rows[i].Longitude
		if f.Swap {
			swapped++
			if same {
				t.Errorf("%s has swap:true but its day and night values are identical "+
					"(%.6f); either X and Y coincide on this chart or the swap is not "+
					"being applied", f.Name, dayArm.Rows[i].Longitude)
			}
		} else if !same {
			t.Errorf("%s has swap:false but its day and night values differ (%.6f vs "+
				"%.6f). The only route is an operand that inherits Punya's swap, and "+
				"Yasas, Mitra and Susha all carry swap:true themselves",
				f.Name, dayArm.Rows[i].Longitude, nightArm.Rows[i].Longitude)
		}
	}
	if swapped != 12 {
		t.Errorf("%d rows carry swap:true, expected 12", swapped)
	}
	wantSwap := map[string]bool{
		"Punya": true, "Vidya": true, "Yasas": true, "Mitra": true, "Karma": true,
		"Roga": true, "Rajya": true, "Bandhu": true, "Gnati": true, "Matri": true,
		"Pitri": true, "Susha": true,
	}
	for _, f := range SahamFormulas {
		if f.Swap != wantSwap[f.Name.String()] {
			t.Errorf("%s: swap %v, the table says %v", f.Name, f.Swap, wantSwap[f.Name.String()])
		}
	}
	t.Logf("54 formula evaluations (27 rows x 2 arms), %d swapping rows", swapped)
}

func TestSahamCompletionRuleFiresBothWays(t *testing.T) {
	g := loadVarshaphalaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	added, notAdded, exactTies := 0, 0, 0
	closest := math.Inf(1)

	for _, c := range g.Sweep {
		loc := varshaLoc(g, c.Loc)
		natalSun, err := astronomy.GetSiderealSunLongitude(ctx, c.Ms, "lahiri")
		if err != nil {
			t.Fatal(err)
		}
		srMs, err := FindSolarReturn(ctx, c.Ms, c.Age, natalSun, "lahiri")
		if err != nil {
			t.Fatal(err)
		}
		chart, err := ComputeRashiChart(ctx, srMs, loc, BirthChartOptions{})
		if err != nil {
			t.Fatal(err)
		}
		isDay := c.Chart.IsDayBirth

		var lon [SahamNameCount]float64
		var done [SahamNameCount]bool
		for _, f := range SahamFormulas {
			xOp, yOp := f.X, f.Y
			if f.Swap && !isDay {
				xOp, yOp = f.Y, f.X
			}
			x, err := resolveOperand(xOp, &chart, &lon, &done)
			if err != nil {
				t.Fatal(err)
			}
			y, err := resolveOperand(yOp, &chart, &lon, &done)
			if err != nil {
				t.Fatal(err)
			}
			z, err := resolveOperand(f.Z, &chart, &lon, &done)
			if err != nil {
				t.Fatal(err)
			}
			zy, xy := utils.Normalize360(z-y), utils.Normalize360(x-y)
			if zy <= xy {
				notAdded++
			} else {
				added++
			}
			if x == z {
				exactTies++
			} else if d := math.Abs(zy - xy); d < closest {
				closest = d
			}
			v, err := evaluateSaham(f, isDay, &chart, &lon, &done)
			if err != nil {
				t.Fatal(err)
			}
			lon[f.Name], done[f.Name] = v, true
		}
	}

	if added == 0 || notAdded == 0 {
		t.Errorf("the completion rule fired only one way: %d added 30 deg, %d did "+
			"not. Both arms must be exercised or the sweep is not testing the rule",
			added, notAdded)
	}
	if closest < 1e-9 {
		t.Errorf("the arc comparison came within %g deg of a tie; at that distance "+
			"a 1e-13 deg longitude difference could flip it and the 30 deg step "+
			"would differ between the languages", closest)
	}
	if exactTies > 0 {
		for _, f := range SahamFormulas {
			if f.X == f.Z {
				t.Errorf("%s has X == Z in the table itself, which is not the "+
					"mechanism this test assumes", f.Name)
			}
		}
	}
	total := added + notAdded
	t.Logf("%d Saham evaluations: %d added 30 deg (%.0f%%), %d did not; %d exact "+
		"ties from X and Z resolving to the same operand; closest genuine approach "+
		"to a tie %g deg", total, added, 100*float64(added)/float64(total),
		notAdded, exactTies, closest)
}

func TestVarshaphalaRejectsBadYearAge(t *testing.T) {
	g := loadVarshaphalaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	loc := varshaLoc(g, g.Locations[0].Name)
	checked := 0

	for _, c := range g.BadAges {
		if c.Age != math.Trunc(c.Age) {
			continue
		}
		if !c.Threw {
			t.Errorf("yearAge %v did not throw in the TypeScript", c.Age)
			continue
		}
		_, err := ComputeVarshaphala(ctx, g.Births[0], int(c.Age), loc, BirthChartOptions{})
		if err == nil {
			t.Errorf("yearAge %v was accepted", c.Age)
			continue
		}
		var pe *types.PanchangError
		if !errors.As(err, &pe) || c.Code == nil || string(pe.Code) != *c.Code {
			t.Errorf("yearAge %v: error %v, TypeScript code %v", c.Age, err, c.Code)
		}
		want := "Varshaphala yearAge must be a positive integer (1 = first solar " +
			"return); got " + itoa(int(c.Age))
		if err.Error() != want {
			t.Errorf("yearAge %v: message %q, expected %q", c.Age, err.Error(), want)
		}
		checked++
	}
	if checked == 0 {
		t.Fatal("no representable bad age in the golden")
	}
	t.Logf("%d of %d recorded bad ages are representable as a Go int and were "+
		"checked; the rest are non-integers the signature already excludes",
		checked, len(g.BadAges))
}

func TestVarshaphalaDayFlagIsTheApparentCentre(t *testing.T) {
	g := loadVarshaphalaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	trues, falses, differsFromSegmentRule := 0, 0, 0

	for _, c := range g.Sweep {
		loc := varshaLoc(g, c.Loc)
		ms := c.Chart.SolarReturnInstant.Ms()

		got := varshaphalaIsDayBirth(ctx, ms, loc)
		if want := astronomy.IsSunAboveHorizon(ctx, ms, loc); got != want {
			t.Errorf("%s@%d: the flag is %v but isSunAboveHorizon says %v", c.Loc, ms, got, want)
		}
		if got != c.Chart.IsDayBirth {
			t.Errorf("%s@%d: flag %v, golden %v", c.Loc, ms, got, c.Chart.IsDayBirth)
		}
		if got {
			trues++
		} else {
			falses++
		}

		sunrise, err := findSunriseBeforeBirth(ctx, ms, loc)
		if err != nil {
			continue
		}
		sunset, err := astronomy.ComputeSunset(ctx, sunrise, loc, astronomy.DefaultRiseSetLimitDays)
		if err != nil {
			continue
		}
		if got != (ms < sunset) {
			differsFromSegmentRule++
		}
	}
	if trues == 0 || falses == 0 {
		t.Errorf("the day flag returned only %v across the sweep", trues > 0)
	}
	t.Logf("%d solar-return instants: %d day, %d night; %d where the "+
		"apparent-centre convention differs from Gulika's segment-boundary one",
		len(g.Sweep), trues, falses, differsFromSegmentRule)
}
