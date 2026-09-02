package astronomy

type EphemerisCtx struct {
	nutMemoT    [nutationMemoSize]float64
	nutMemoPsi  [nutationMemoSize]float64
	nutMemoEps  [nutationMemoSize]float64
	nutMemoNext int
	nutMemoLive int

	earthMemoKey  [earthMemoSize]float64
	earthMemoVal  [earthMemoSize][3]float64
	earthMemoNext int
	earthMemoLive int
}

const (
	nutationMemoSize = 16
	earthMemoSize    = 4
)

func NewEphemerisCtx() *EphemerisCtx { return &EphemerisCtx{} }
