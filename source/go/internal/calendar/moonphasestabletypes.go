package calendar

import "encoding/json"

type MoonPhaseTableName string

const (
	PhaseNew          MoonPhaseTableName = "new"
	PhaseFirstQuarter MoonPhaseTableName = "first_quarter"
	PhaseFull         MoonPhaseTableName = "full"
	PhaseLastQuarter  MoonPhaseTableName = "last_quarter"
)

var PhaseOrder = []MoonPhaseTableName{PhaseNew, PhaseFirstQuarter, PhaseFull, PhaseLastQuarter}

type MoonPhaseDictEntry struct {
	Phase       MoonPhaseTableName `json:"phase"`
	Name        LocalizedString    `json:"name"`
	Description *LocalizedString   `json:"description,omitempty"`
}

type MoonPhaseTableEntry struct {
	Name           string             `json:"name"`
	Phase          MoonPhaseTableName `json:"phase"`
	Time           string             `json:"time"`
	Description    string             `json:"description,omitempty"`
	HasDescription bool               `json:"-"`
}

type PackedMoonPhaseEvent struct {
	I int   `json:"i"`
	T int64 `json:"t"`
}

type PackedMoonPhaseTableDay struct {
	Date   string                 `json:"date"`
	Phases []PackedMoonPhaseEvent `json:"phases"`
}

type MoonPhaseTableDay struct {
	Date   string                `json:"date"`
	Phases []MoonPhaseTableEntry `json:"phases"`
}

type MoonPhaseTableMeta struct {
	Format                int                      `json:"format"`
	ReferenceLocation     string                   `json:"referenceLocation"`
	TimezoneOffsetMinutes int                      `json:"timezoneOffsetMinutes"`
	Languages             []FestivalsTableLanguage `json:"languages"`
	StartYear             int                      `json:"startYear"`
	EndYear               int                      `json:"endYear"`
	GeneratedAt           string                   `json:"generatedAt"`
	Note                  string                   `json:"note"`
}

type MoonPhasesFile struct {
	Meta  MoonPhaseTableMeta                   `json:"_meta"`
	Dict  []MoonPhaseDictEntry                 `json:"_dict"`
	Years map[string][]PackedMoonPhaseTableDay `json:"years"`
}

type MoonPhaseTableEntryRaw struct {
	Name        LocalizedString    `json:"name"`
	Phase       MoonPhaseTableName `json:"phase"`
	Time        string             `json:"time"`
	Description *LocalizedString   `json:"description,omitempty"`
}

type RawMoonPhaseTableDay struct {
	Date   string                   `json:"date"`
	Phases []MoonPhaseTableEntryRaw `json:"phases"`
}

type AnyMoonPhasesFile struct {
	Meta     MoonPhaseTableMeta
	IsPacked bool
	Dict     []MoonPhaseDictEntry
	Packed   map[string][]PackedMoonPhaseTableDay
	Raw      map[string][]RawMoonPhaseTableDay
}

type anyMoonPhasesWire struct {
	Meta  MoonPhaseTableMeta         `json:"_meta"`
	Dict  json.RawMessage            `json:"_dict"`
	Years map[string]json.RawMessage `json:"years"`
}

func (f *AnyMoonPhasesFile) UnmarshalJSON(data []byte) error {
	var w anyMoonPhasesWire
	if err := json.Unmarshal(data, &w); err != nil {
		return err
	}
	f.Meta = w.Meta
	f.IsPacked = isJSONArray(w.Dict)
	f.Dict, f.Packed, f.Raw = nil, nil, nil
	if f.IsPacked {
		if err := json.Unmarshal(w.Dict, &f.Dict); err != nil {
			return err
		}
		f.Packed = map[string][]PackedMoonPhaseTableDay{}
		for k, v := range w.Years {
			var days []PackedMoonPhaseTableDay
			if err := json.Unmarshal(v, &days); err != nil {
				return err
			}
			f.Packed[k] = days
		}
		return nil
	}
	f.Raw = map[string][]RawMoonPhaseTableDay{}
	for k, v := range w.Years {
		var days []RawMoonPhaseTableDay
		if err := json.Unmarshal(v, &days); err != nil {
			return err
		}
		f.Raw[k] = days
	}
	return nil
}

func (f MoonPhasesFile) AsAny() AnyMoonPhasesFile {
	return AnyMoonPhasesFile{Meta: f.Meta, IsPacked: true, Dict: f.Dict, Packed: f.Years}
}
