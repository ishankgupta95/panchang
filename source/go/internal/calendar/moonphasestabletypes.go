package calendar

var PhaseOrder = []MoonPhaseTableName{PhaseNew, PhaseFirstQuarter, PhaseFull, PhaseLastQuarter}

type MoonPhaseTableEntry struct {
	Name           string             `json:"name"`
	Phase          MoonPhaseTableName `json:"phase"`
	Time           string             `json:"time"`
	Description    string             `json:"description,omitempty"`
	HasDescription bool               `json:"-"`
}

type MoonPhaseTableDay struct {
	Date   string                `json:"date"`
	Phases []MoonPhaseTableEntry `json:"phases"`
}
