package i18n

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

func TestEveryLanguageHasEveryEclipseString(t *testing.T) {
	for _, lang := range AllLanguages {
		e := GetTranslations(lang).Eclipse
		for name, s := range map[string]string{
			"template":              e.Template,
			"kind.solar":            e.Kind.Solar,
			"kind.lunar":            e.Kind.Lunar,
			"subtype.partial":       e.Subtype.Partial,
			"subtype.total":         e.Subtype.Total,
			"subtype.annular":       e.Subtype.Annular,
			"subtype.penumbral":     e.Subtype.Penumbral,
			"visibility.visible":    e.Visibility.Visible,
			"visibility.notVisible": e.Visibility.NotVisible,
		} {
			if s == "" {
				t.Errorf("%s: eclipse.%s is empty", lang, name)
			}
			if !utf8.ValidString(s) {
				t.Errorf("%s: eclipse.%s is not valid UTF-8", lang, name)
			}
		}
		for _, ph := range []string{"{subtype}", "{kind}", "{percent}", "{visibility}"} {
			if n := strings.Count(e.Template, ph); n != 1 {
				t.Errorf("%s: template contains %s %d times, want 1", lang, ph, n)
			}
		}
	}
	if len(AllLanguages) != 2 {
		t.Errorf("%d languages; src/i18n/ ships exactly en and hi (no Sanskrit)", len(AllLanguages))
	}
}

func TestUnknownLanguageFallsBackToEnglish(t *testing.T) {
	for _, lang := range []types.Language{"fr", "", "EN", "sa"} {
		if got := GetTranslations(lang).Eclipse.Template; got != en.Eclipse.Template {
			t.Errorf("GetTranslations(%q) did not fall back to English: %q", lang, got)
		}
	}
	if GetTranslations(types.LanguageHi).Eclipse.Template == en.Eclipse.Template {
		t.Error("Hindi resolved to the English template")
	}
}

func TestHindiIsRawUTF8InJSON(t *testing.T) {
	b, err := json.Marshal(hi.Eclipse.Kind.Solar)
	if err != nil {
		t.Fatal(err)
	}
	const want = `"सूर्य ग्रहण"`
	if string(b) != want {
		t.Errorf("marshalled as %s, want %s", b, want)
	}
	if strings.Contains(string(b), `\u`) {
		t.Errorf("Devanagari was \\u-escaped: %s", b)
	}
	if !strings.HasSuffix(hi.Eclipse.Template, "।") {
		t.Errorf("the Hindi template does not end in a danda: %q", hi.Eclipse.Template)
	}
}

func TestMiscByKeyIsTotal(t *testing.T) {
	fields := reflect.TypeOf(MiscNames{})
	if fields.NumField() != len(MiscKeys) {
		t.Fatalf("MiscNames has %d fields and MiscKeys lists %d, so the switch in "+
			"MiscByKey cannot be total", fields.NumField(), len(MiscKeys))
	}
	for i := 0; i < fields.NumField(); i++ {
		want := strings.ToLower(fields.Field(i).Name[:1]) + fields.Field(i).Name[1:]
		if MiscKeys[i] != want {
			t.Errorf("MiscKeys[%d] = %q, want %q (field %s)", i, MiscKeys[i], want,
				fields.Field(i).Name)
		}
	}
	for _, lang := range AllLanguages {
		tr := GetTranslations(lang)
		v := reflect.ValueOf(tr.Misc)
		for i, key := range MiscKeys {
			got, ok := tr.MiscByKey(key)
			if !ok {
				t.Errorf("%s: MiscByKey(%q) reported absent; the switch is missing an arm", lang, key)
				continue
			}
			if want := v.Field(i).String(); got != want {
				t.Errorf("%s: MiscByKey(%q) = %q, want %q", lang, key, got, want)
			}
			if got == "" {
				t.Errorf("%s: misc.%s is empty", lang, key)
			}
		}
	}
	if v, ok := GetTranslations(types.LanguageEn).MiscByKey("not_a_misc_key"); ok || v != "" {
		t.Errorf(`MiscByKey("not_a_misc_key") = (%q, %v), want ("", false)`, v, ok)
	}
}
