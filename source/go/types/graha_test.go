package types

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestGrahaEnumIsTotalAndOrdered(t *testing.T) {
	want := []struct {
		g    Graha
		name string
	}{
		{GrahaSun, "Sun"},
		{GrahaMoon, "Moon"},
		{GrahaMars, "Mars"},
		{GrahaMercury, "Mercury"},
		{GrahaJupiter, "Jupiter"},
		{GrahaVenus, "Venus"},
		{GrahaSaturn, "Saturn"},
		{GrahaRahu, "Rahu"},
		{GrahaKetu, "Ketu"},
	}
	if len(want) != GrahaCount {
		t.Fatalf("this test names %d grahas, GrahaCount is %d", len(want), GrahaCount)
	}
	for i, w := range want {
		if int(w.g) != i {
			t.Errorf("%s is %d, want %d: a reordered enum silently remaps every "+
				"[9]T table in the jyotish package", w.name, int(w.g), i)
		}
		if got := w.g.String(); got != w.name {
			t.Errorf("Graha(%d).String() = %q, want %q", i, got, w.name)
		}
		if !w.g.Valid() {
			t.Errorf("%s reports itself invalid", w.name)
		}
		if AllGrahas[i] != w.g {
			t.Errorf("AllGrahas[%d] = %v, want %v", i, AllGrahas[i], w.g)
		}
	}

	for _, bad := range []Graha{-1, GrahaCount, 99} {
		if bad.Valid() {
			t.Errorf("Graha(%d) reports valid", int(bad))
		}
		if s := bad.String(); s == "" {
			t.Errorf("Graha(%d).String() is empty", int(bad))
		}
		if _, err := bad.MarshalJSON(); err == nil {
			t.Errorf("Graha(%d) marshalled without error", int(bad))
		}
	}
}

func TestVisibleGrahaIsAPrefixOfGraha(t *testing.T) {
	if VisibleGrahaCount != 7 || GrahaCount != 9 {
		t.Fatalf("counts moved: VisibleGrahaCount=%d GrahaCount=%d", VisibleGrahaCount, GrahaCount)
	}
	for i, v := range AllVisibleGrahas {
		if int(v) != i {
			t.Errorf("AllVisibleGrahas[%d] = %d, want %d", i, int(v), i)
		}
		if v.Graha() != AllGrahas[i] {
			t.Errorf("VisibleGraha %v widens to %v, want %v", v, v.Graha(), AllGrahas[i])
		}
		if v.String() != AllGrahas[i].String() {
			t.Errorf("names disagree at %d: %q vs %q", i, v.String(), AllGrahas[i].String())
		}
	}

	narrowed, nodes := 0, 0
	for _, g := range AllGrahas {
		v, ok := g.Visible()
		if g.IsNode() {
			if ok {
				t.Errorf("%v is a node but narrowed to VisibleGraha %v", g, v)
			}
			nodes++
			continue
		}
		if !ok {
			t.Errorf("%v failed to narrow to a VisibleGraha", g)
			continue
		}
		if v.Graha() != g {
			t.Errorf("%v narrowed to %v, which widens back to %v", g, v, v.Graha())
		}
		narrowed++
	}
	if narrowed != VisibleGrahaCount {
		t.Errorf("%d grahas narrowed, want %d", narrowed, VisibleGrahaCount)
	}
	if nodes != 2 {
		t.Errorf("%d nodes found, want 2 (Rahu and Ketu)", nodes)
	}
}

func TestGrahaJSONRoundTripsThroughItsName(t *testing.T) {
	for _, g := range AllGrahas {
		b, err := json.Marshal(g)
		if err != nil {
			t.Fatalf("marshal %v: %v", g, err)
		}
		if want := `"` + g.String() + `"`; string(b) != want {
			t.Errorf("marshal %v = %s, want %s", g, b, want)
		}
		var back Graha
		if err := json.Unmarshal(b, &back); err != nil {
			t.Fatalf("unmarshal %s: %v", b, err)
		}
		if back != g {
			t.Errorf("round trip %v -> %s -> %v", g, b, back)
		}
	}
	for _, v := range AllVisibleGrahas {
		b, err := json.Marshal(v)
		if err != nil {
			t.Fatalf("marshal %v: %v", v, err)
		}
		var back VisibleGraha
		if err := json.Unmarshal(b, &back); err != nil {
			t.Fatalf("unmarshal %s: %v", b, err)
		}
		if back != v {
			t.Errorf("round trip %v -> %s -> %v", v, b, back)
		}
	}

	for _, bad := range []string{`"Rahu"`, `"Ketu"`} {
		var v VisibleGraha
		if err := json.Unmarshal([]byte(bad), &v); err == nil {
			t.Errorf("VisibleGraha accepted %s as %v", bad, v)
		}
	}
	for _, bad := range []string{`"Pluto"`, `""`, `2`, `null`, `{}`} {
		var g Graha
		if err := json.Unmarshal([]byte(bad), &g); err == nil {
			t.Errorf("Graha accepted %s as %v", bad, g)
		}
	}
}

func TestAspectMapAndByPlanetAccessorsAreTotal(t *testing.T) {
	var m AspectMap
	for _, g := range AllGrahas {
		if !m.SetForGraha(g, []int{int(g) + 100}) {
			t.Fatalf("AspectMap.SetForGraha(%v) reported failure", g)
		}
	}
	for _, g := range AllGrahas {
		got, ok := m.ForGraha(g)
		if !ok {
			t.Fatalf("AspectMap.ForGraha(%v) reported failure", g)
		}
		if len(got) != 1 || got[0] != int(g)+100 {
			t.Errorf("AspectMap round trip for %v gave %v: a switch arm writes the "+
				"wrong field", g, got)
		}
	}

	var b PlanetsByGraha
	for _, g := range AllGrahas {
		if !b.Set(g, PlanetPlacement{Planet: g, House: int(g) + 1}) {
			t.Fatalf("PlanetsByGraha.Set(%v) reported failure", g)
		}
	}
	for _, g := range AllGrahas {
		got, ok := b.Get(g)
		if !ok {
			t.Fatalf("PlanetsByGraha.Get(%v) reported failure", g)
		}
		if got.Planet != g || got.House != int(g)+1 {
			t.Errorf("PlanetsByGraha round trip for %v gave %+v", g, *got)
		}
	}

	for _, bad := range []Graha{-1, GrahaCount} {
		if m.SetForGraha(bad, nil) {
			t.Errorf("AspectMap.SetForGraha accepted %d", int(bad))
		}
		if _, ok := m.ForGraha(bad); ok {
			t.Errorf("AspectMap.ForGraha accepted %d", int(bad))
		}
		if b.Set(bad, PlanetPlacement{}) {
			t.Errorf("PlanetsByGraha.Set accepted %d", int(bad))
		}
		if _, ok := b.Get(bad); ok {
			t.Errorf("PlanetsByGraha.Get accepted %d", int(bad))
		}
	}
}

func TestAspectMapKeyOrderIsGrahaOrder(t *testing.T) {
	for _, tc := range []struct {
		name string
		v    any
	}{
		{"AspectMap", AspectMap{}},
		{"PlanetsByGraha", PlanetsByGraha{}},
	} {
		b, err := json.Marshal(tc.v)
		if err != nil {
			t.Fatalf("marshal %s: %v", tc.name, err)
		}
		keys := jsonKeyOrder(t, b)
		if len(keys) != GrahaCount {
			t.Fatalf("%s marshalled %d keys, want %d: %v", tc.name, len(keys), GrahaCount, keys)
		}
		for i, g := range AllGrahas {
			if keys[i] != g.String() {
				t.Errorf("%s key %d is %q, want %q", tc.name, i, keys[i], g.String())
			}
		}
	}
}

func jsonKeyOrder(t *testing.T, b []byte) []string {
	t.Helper()
	dec := json.NewDecoder(bytes.NewReader(b))
	tok, err := dec.Token()
	if err != nil || tok != json.Delim('{') {
		t.Fatalf("expected an object, got %v (%v)", tok, err)
	}
	var keys []string
	depth := 0
	for dec.More() || depth > 0 {
		tok, err := dec.Token()
		if err != nil {
			t.Fatalf("token: %v", err)
		}
		switch v := tok.(type) {
		case json.Delim:
			switch v {
			case '{', '[':
				depth++
			case '}', ']':
				depth--
				if depth < 0 {
					return keys
				}
			}
		case string:
			if depth == 0 {
				keys = append(keys, v)
				if err := skipOneValue(dec); err != nil {
					t.Fatalf("skip: %v", err)
				}
			}
		}
	}
	return keys
}

func skipOneValue(dec *json.Decoder) error {
	tok, err := dec.Token()
	if err != nil {
		return err
	}
	d, ok := tok.(json.Delim)
	if !ok || (d != '{' && d != '[') {
		return nil
	}
	depth := 1
	for depth > 0 {
		tok, err := dec.Token()
		if err != nil {
			return err
		}
		if d, ok := tok.(json.Delim); ok {
			if d == '{' || d == '[' {
				depth++
			} else {
				depth--
			}
		}
	}
	return nil
}

func TestGrahaAsDashaLordRoundTrips(t *testing.T) {
	for _, g := range AllGrahas {
		d, ok := GrahaAsDashaLord(g)
		if !ok {
			t.Errorf("GrahaAsDashaLord(%v) reported no lord", g)
			continue
		}
		if back := d.Graha(); back != g {
			t.Errorf("GrahaAsDashaLord(%v) = %v, whose Graha() is %v", g, d, back)
		}
	}
	if _, ok := GrahaAsDashaLord(Graha(GrahaCount)); ok {
		t.Errorf("GrahaAsDashaLord(%d) accepted an out of range graha", GrahaCount)
	}
}
