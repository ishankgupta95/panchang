package calendar

type EclipseTableKind string

const (
	EclipseSolar EclipseTableKind = "solar"
	EclipseLunar EclipseTableKind = "lunar"
)

var AllEclipseTableKinds = []EclipseTableKind{EclipseSolar, EclipseLunar}

type EclipseTableSubtype string

const (
	EclipsePartial   EclipseTableSubtype = "partial"
	EclipseTotal     EclipseTableSubtype = "total"
	EclipseAnnular   EclipseTableSubtype = "annular"
	EclipsePenumbral EclipseTableSubtype = "penumbral"
)

var AllEclipseTableSubtypes = []EclipseTableSubtype{
	EclipsePartial, EclipseTotal, EclipseAnnular, EclipsePenumbral,
}

type EclipseSutak struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

type EclipseTableEntryRaw struct {
	Name                LocalizedString     `json:"name"`
	Kind                EclipseTableKind    `json:"kind"`
	Subtype             EclipseTableSubtype `json:"subtype"`
	Start               string              `json:"start"`
	Peak                string              `json:"peak"`
	End                 string              `json:"end"`
	Obscuration         float64             `json:"obscuration"`
	Magnitude           float64             `json:"magnitude"`
	VisibleFromLocation bool                `json:"visibleFromLocation"`
	VisibleAtPeak       bool                `json:"visibleAtPeak"`
	Description         *LocalizedString    `json:"description,omitempty"`
	Sutak               *EclipseSutak       `json:"sutak,omitempty"`
}

// Sutak before Description here, unlike the raw shape; both orders are pinned.
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

type RawEclipseTableDay struct {
	Date     string                 `json:"date"`
	Eclipses []EclipseTableEntryRaw `json:"eclipses"`
}

type EclipseTableDay struct {
	Date     string              `json:"date"`
	Eclipses []EclipseTableEntry `json:"eclipses"`
}

type EclipseTableMeta struct {
	ReferenceLocation     string                   `json:"referenceLocation"`
	Latitude              float64                  `json:"latitude"`
	Longitude             float64                  `json:"longitude"`
	TimezoneOffsetMinutes int                      `json:"timezoneOffsetMinutes"`
	VisibleOnly           bool                     `json:"visibleOnly"`
	Languages             []FestivalsTableLanguage `json:"languages"`
	StartYear             int                      `json:"startYear"`
	EndYear               int                      `json:"endYear"`
	GeneratedAt           string                   `json:"generatedAt"`
	Note                  string                   `json:"note"`
}

type EclipsesFile struct {
	Meta  EclipseTableMeta                `json:"_meta"`
	Years map[string][]RawEclipseTableDay `json:"years"`
}
