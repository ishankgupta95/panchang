package calendar

var AllEclipseTableKinds = []EclipseTableKind{EclipseSolar, EclipseLunar}

var AllEclipseTableSubtypes = []EclipseTableSubtype{
	EclipsePartial, EclipseTotal, EclipseAnnular, EclipsePenumbral,
}

type EclipseTableEntry struct {
	Name                string              `json:"name"`
	Kind                EclipseTableKind    `json:"kind"`
	Subtype             EclipseTableSubtype `json:"subtype"`
	Start               string              `json:"start"`
	Peak                string              `json:"peak"`
	End                 string              `json:"end"`
	Obscuration         float64             `json:"obscuration"`
	Magnitude           float64             `json:"magnitude"`
	VisibleFromLocation bool                `json:"visibleFromLocation"`
	VisibleAtPeak       bool                `json:"visibleAtPeak"`
	Sutak               *EclipseSutak       `json:"sutak,omitempty"`
	Description         string              `json:"description,omitempty"`
	HasDescription      bool                `json:"-"`
}

type EclipseTableDay struct {
	Date     string              `json:"date"`
	Eclipses []EclipseTableEntry `json:"eclipses"`
}
