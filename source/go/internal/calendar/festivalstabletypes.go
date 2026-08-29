package calendar

import (
	"bytes"
	"encoding/json"
	"errors"
)

type FestivalsTableLanguage string

const (
	TableLangEn FestivalsTableLanguage = "en"
	TableLangHi FestivalsTableLanguage = "hi"
)

var AllTableLanguages = []FestivalsTableLanguage{TableLangEn, TableLangHi}

// A struct, not a map: locale key order must round-trip and presence differs from emptiness.
type LocalizedString struct {
	En, Hi       string
	HasEn, HasHi bool
	HiFirst      bool
}

func Localized(pairs ...LocalizedPair) LocalizedString {
	var s LocalizedString
	for i, p := range pairs {
		switch p.Lang {
		case TableLangEn:
			// En's first record decides: ["en","hi","en"] must not flip the order.
			if !s.HasEn && i > 0 && s.HasHi {
				s.HiFirst = true
			}
			s.En, s.HasEn = p.Value, true
		case TableLangHi:
			s.Hi, s.HasHi = p.Value, true
		}
	}
	return s
}

type LocalizedPair struct {
	Lang  FestivalsTableLanguage
	Value string
}

func (s LocalizedString) Empty() bool { return !s.HasEn && !s.HasHi }

func (s LocalizedString) Pick(lang FestivalsTableLanguage) string {
	if lang == TableLangEn && s.HasEn {
		return s.En
	}
	if lang == TableLangHi && s.HasHi {
		return s.Hi
	}
	if s.HiFirst {
		if s.HasHi {
			return s.Hi
		}
		if s.HasEn {
			return s.En
		}
		return ""
	}
	if s.HasEn {
		return s.En
	}
	if s.HasHi {
		return s.Hi
	}
	return ""
}

func (s LocalizedString) MarshalJSON() ([]byte, error) {
	var b bytes.Buffer
	b.WriteByte('{')
	write := func(key, value string, first bool) {
		if !first {
			b.WriteByte(',')
		}
		b.WriteString(`"` + key + `":`)
		b.Write(encodeJSONString(value))
	}
	first := true
	if s.HiFirst {
		if s.HasHi {
			write("hi", s.Hi, first)
			first = false
		}
		if s.HasEn {
			write("en", s.En, first)
		}
	} else {
		if s.HasEn {
			write("en", s.En, first)
			first = false
		}
		if s.HasHi {
			write("hi", s.Hi, first)
		}
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}

// json.Marshal escapes <, >, & and only an Encoder can unset that.
func encodeJSONString(s string) []byte {
	var buf bytes.Buffer
	e := json.NewEncoder(&buf)
	e.SetEscapeHTML(false)
	if err := e.Encode(s); err != nil {
		panic("calendar: encoding a JSON string: " + err.Error())
	}
	out := buf.Bytes()
	return out[:len(out)-1]
}

var errLocalizedShape = errors.New("calendar: a LocalizedString must be a JSON object")

func (s *LocalizedString) UnmarshalJSON(data []byte) error {
	*s = LocalizedString{}
	if string(data) == "null" {
		return nil
	}
	dec := json.NewDecoder(bytes.NewReader(data))
	tok, err := dec.Token()
	if err != nil {
		return errLocalizedShape
	}
	if d, ok := tok.(json.Delim); !ok || d != '{' {
		return errLocalizedShape
	}
	seen := 0
	for dec.More() {
		keyTok, err := dec.Token()
		if err != nil {
			return errLocalizedShape
		}
		key, _ := keyTok.(string)
		var value string
		if err := dec.Decode(&value); err != nil {
			var skip json.RawMessage
			if err := dec.Decode(&skip); err != nil {
				return errLocalizedShape
			}
			continue
		}
		switch FestivalsTableLanguage(key) {
		case TableLangEn:
			if !s.HasEn && seen > 0 && s.HasHi {
				s.HiFirst = true
			}
			s.En, s.HasEn = value, true
		case TableLangHi:
			s.Hi, s.HasHi = value, true
		}
		seen++
	}
	return nil
}

type FestivalsTableType string

const (
	TableTypeMajor             FestivalsTableType = "major"
	TableTypeMinor             FestivalsTableType = "minor"
	TableTypeEkadashi          FestivalsTableType = "ekadashi"
	TableTypeSmartaEkadashi    FestivalsTableType = "smarta_ekadashi"
	TableTypeVaishnavaEkadashi FestivalsTableType = "vaishnava_ekadashi"
	TableTypePradosha          FestivalsTableType = "pradosha"
	TableTypeSankranti         FestivalsTableType = "sankranti"
	TableTypeEclipse           FestivalsTableType = "eclipse"
)

var AllFestivalsTableTypes = []FestivalsTableType{
	TableTypeMajor, TableTypeMinor, TableTypeEkadashi, TableTypeSmartaEkadashi,
	TableTypeVaishnavaEkadashi, TableTypePradosha, TableTypeSankranti, TableTypeEclipse,
}

type FestivalDictEntry struct {
	Key         string             `json:"key"`
	Type        FestivalsTableType `json:"type"`
	Name        LocalizedString    `json:"name"`
	Description *LocalizedString   `json:"description,omitempty"`
}

type FestivalTableEntry struct {
	Key            string             `json:"key"`
	Name           string             `json:"name"`
	Type           FestivalsTableType `json:"type"`
	Description    string             `json:"description,omitempty"`
	HasDescription bool               `json:"-"`
}

type FestivalTableDay struct {
	Date      string               `json:"date"`
	Festivals []FestivalTableEntry `json:"festivals"`
}

type PackedFestivalTableDay struct {
	Date      string `json:"date"`
	Festivals []int  `json:"festivals"`
}

type FestivalTableMeta struct {
	// 2 is the dictionary-encoded layout; absent means v1.
	Format                int                      `json:"format"`
	ReferenceLocation     string                   `json:"referenceLocation"`
	Latitude              float64                  `json:"latitude"`
	Longitude             float64                  `json:"longitude"`
	TimezoneOffsetMinutes int                      `json:"timezoneOffsetMinutes"`
	Ayanamsa              string                   `json:"ayanamsa"`
	MasaSystem            string                   `json:"masaSystem"`
	Region                string                   `json:"region"`
	Languages             []FestivalsTableLanguage `json:"languages"`
	StartYear             int                      `json:"startYear"`
	EndYear               int                      `json:"endYear"`
	GeneratedAt           string                   `json:"generatedAt"`
	Note                  string                   `json:"note"`
}

type FestivalsFile struct {
	Meta  FestivalTableMeta                   `json:"_meta"`
	Dict  []FestivalDictEntry                 `json:"_dict"`
	Years map[string][]PackedFestivalTableDay `json:"years"`
}

type FestivalTableEntryRaw struct {
	Name        LocalizedString    `json:"name"`
	Type        FestivalsTableType `json:"type"`
	Description *LocalizedString   `json:"description,omitempty"`
}

type RawFestivalTableDay struct {
	Date      string                  `json:"date"`
	Festivals []FestivalTableEntryRaw `json:"festivals"`
}

type AnyFestivalsFile struct {
	Meta     FestivalTableMeta
	IsPacked bool
	Dict     []FestivalDictEntry
	Packed   map[string][]PackedFestivalTableDay
	Raw      map[string][]RawFestivalTableDay
}

type anyFestivalsWire struct {
	Meta  FestivalTableMeta          `json:"_meta"`
	Dict  json.RawMessage            `json:"_dict"`
	Years map[string]json.RawMessage `json:"years"`
}

func (f *AnyFestivalsFile) UnmarshalJSON(data []byte) error {
	var w anyFestivalsWire
	if err := json.Unmarshal(data, &w); err != nil {
		return err
	}
	f.Meta = w.Meta
	f.IsPacked = isJSONArray(w.Dict)
	f.Dict = nil
	f.Packed = nil
	f.Raw = nil
	if f.IsPacked {
		if err := json.Unmarshal(w.Dict, &f.Dict); err != nil {
			return err
		}
		f.Packed = map[string][]PackedFestivalTableDay{}
		for k, v := range w.Years {
			var days []PackedFestivalTableDay
			if err := json.Unmarshal(v, &days); err != nil {
				return err
			}
			f.Packed[k] = days
		}
		return nil
	}
	f.Raw = map[string][]RawFestivalTableDay{}
	for k, v := range w.Years {
		var days []RawFestivalTableDay
		if err := json.Unmarshal(v, &days); err != nil {
			return err
		}
		f.Raw[k] = days
	}
	return nil
}

func isJSONArray(raw json.RawMessage) bool {
	for _, c := range raw {
		switch c {
		case ' ', '\t', '\n', '\r':
			continue
		case '[':
			return true
		default:
			return false
		}
	}
	return false
}

func (f FestivalsFile) AsAny() AnyFestivalsFile {
	return AnyFestivalsFile{Meta: f.Meta, IsPacked: true, Dict: f.Dict, Packed: f.Years}
}
