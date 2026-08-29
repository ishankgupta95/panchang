package astronomy

import "time"

// ΔT = TT − UT, piecewise from Espenak & Meeus, Five Millennium Canon of Solar Eclipses §4.
// Explicit products, not math.Pow; anti-FMA barriers throughout.

const daysPerTropicalYear = 365.24217

const j2000JD = 2451545.0

const j2000NoonMS int64 = 946_728_000_000

func DeltaTSecondsForYear(y float64) float64 {
	var u, t float64

	if y < -500 {
		u = (y - 1820) / 100
		return -20 + float64(32*u*u)
	}
	if y < 500 {
		u = y / 100
		u2, u3, u4, u5, u6 := u*u, u*u*u, u*u*u*u, u*u*u*u*u, u*u*u*u*u*u
		return 10583.6 - float64(1014.41*u) + float64(33.78311*u2) - float64(5.952053*u3) -
			float64(0.1798452*u4) + float64(0.022174192*u5) + float64(0.0090316521*u6)
	}
	if y < 1600 {
		u = (y - 1000) / 100
		u2, u3, u4, u5, u6 := u*u, u*u*u, u*u*u*u, u*u*u*u*u, u*u*u*u*u*u
		return 1574.2 - float64(556.01*u) + float64(71.23472*u2) + float64(0.319781*u3) -
			float64(0.8503463*u4) - float64(0.005050998*u5) + float64(0.0083572073*u6)
	}
	if y < 1700 {
		t = y - 1600
		return 120 - float64(0.9808*t) - float64(0.01532*(t*t)) + t*t*t/7129
	}
	if y < 1800 {
		t = y - 1700
		return 8.83 + float64(0.1603*t) - float64(0.0059285*(t*t)) + float64(0.00013336*(t*t*t)) -
			t*t*t*t/1174000
	}
	if y < 1860 {
		t = y - 1800
		t2, t3, t4 := t*t, t*t*t, t*t*t*t
		t5, t6, t7 := t*t*t*t*t, t*t*t*t*t*t, t*t*t*t*t*t*t
		return 13.72 - float64(0.332447*t) + float64(0.0068612*t2) + float64(0.0041116*t3) -
			float64(0.00037436*t4) + float64(0.0000121272*t5) - float64(0.0000001699*t6) +
			float64(0.000000000875*t7)
	}
	if y < 1900 {
		t = y - 1860
		t2, t3, t4, t5 := t*t, t*t*t, t*t*t*t, t*t*t*t*t
		return 7.62 + float64(0.5737*t) - float64(0.251754*t2) + float64(0.01680668*t3) -
			float64(0.0004473624*t4) + t5/233174
	}
	if y < 1920 {
		t = y - 1900
		t2, t3, t4 := t*t, t*t*t, t*t*t*t
		return -2.79 + float64(1.494119*t) - float64(0.0598939*t2) + float64(0.0061966*t3) -
			float64(0.000197*t4)
	}
	if y < 1941 {
		t = y - 1920
		return 21.20 + float64(0.84493*t) - float64(0.076100*(t*t)) + float64(0.0020936*(t*t*t))
	}
	if y < 1961 {
		t = y - 1950
		return 29.07 + float64(0.407*t) - t*t/233 + t*t*t/2547
	}
	if y < 1986 {
		t = y - 1975
		return 45.45 + float64(1.067*t) - t*t/260 - t*t*t/718
	}
	if y < 2005 {
		t = y - 2000
		t2, t3, t4, t5 := t*t, t*t*t, t*t*t*t, t*t*t*t*t
		return 63.86 + float64(0.3345*t) - float64(0.060374*t2) + float64(0.0017275*t3) +
			float64(0.000651814*t4) + float64(0.00002373599*t5)
	}
	if y < 2050 {
		t = y - 2000
		return 62.92 + float64(0.32217*t) + float64(0.005589*(t*t))
	}
	if y < 2150 {
		u = (y - 1820) / 100
		return -20 + float64(32*u*u) - float64(0.5628*(2150-y))
	}
	u = (y - 1820) / 100
	return -20 + float64(32*u*u)
}

func DeltaTSeconds(ms int64) float64 {
	// −14: Espenak's y = 2000 is 2000-Jan-15.
	utDays := float64(ms-j2000NoonMS) / 86_400_000
	year := 2000 + (utDays-14)/daysPerTropicalYear

	if ms < leapSecondEpochMS {
		return DeltaTSecondsForYear(year)
	}
	if ms <= observedThroughMS {
		return ttMinusTAI + taiMinusUTC(ms)
	}
	return DeltaTSecondsForYear(year) + observedMinusModelAtHandoff
}

func utcMS(y, zeroBasedMonth, d int) int64 {
	return time.Date(y, time.Month(zeroBasedMonth+1), d, 0, 0, 0, 0, time.UTC).UnixMilli()
}

var taiMinusUTCTable = [][2]int64{
	{utcMS(1972, 0, 1), 10}, {utcMS(1972, 6, 1), 11}, {utcMS(1973, 0, 1), 12},
	{utcMS(1974, 0, 1), 13}, {utcMS(1975, 0, 1), 14}, {utcMS(1976, 0, 1), 15},
	{utcMS(1977, 0, 1), 16}, {utcMS(1978, 0, 1), 17}, {utcMS(1979, 0, 1), 18},
	{utcMS(1980, 0, 1), 19}, {utcMS(1981, 6, 1), 20}, {utcMS(1982, 6, 1), 21},
	{utcMS(1983, 6, 1), 22}, {utcMS(1985, 6, 1), 23}, {utcMS(1988, 0, 1), 24},
	{utcMS(1990, 0, 1), 25}, {utcMS(1991, 0, 1), 26}, {utcMS(1992, 6, 1), 27},
	{utcMS(1993, 6, 1), 28}, {utcMS(1994, 6, 1), 29}, {utcMS(1996, 0, 1), 30},
	{utcMS(1997, 6, 1), 31}, {utcMS(1999, 0, 1), 32}, {utcMS(2006, 0, 1), 33},
	{utcMS(2009, 0, 1), 34}, {utcMS(2012, 6, 1), 35}, {utcMS(2015, 6, 1), 36},
	{utcMS(2017, 0, 1), 37},
}

const ttMinusTAI = 32.184

var leapSecondEpochMS = taiMinusUTCTable[0][0]

// Leap seconds are announced six months ahead; bump with the table above.
var observedThroughMS = utcMS(2027, 0, 1)

func taiMinusUTC(ms int64) float64 {
	offset := taiMinusUTCTable[0][1]
	for _, row := range taiMinusUTCTable {
		if ms < row[0] {
			break
		}
		offset = row[1]
	}
	return float64(offset)
}

var observedMinusModelAtHandoff = func() float64 {
	utDays := float64(observedThroughMS-j2000NoonMS) / 86_400_000
	year := 2000 + (utDays-14)/daysPerTropicalYear
	return ttMinusTAI + taiMinusUTC(observedThroughMS) - DeltaTSecondsForYear(year)
}()

func TTDaysSinceJ2000(ms int64) float64 {
	utDays := float64(ms-j2000NoonMS) / 86_400_000
	return utDays + DeltaTSeconds(ms)/86400
}

// Lossy by ~10 µs; prefer TTDaysSinceJ2000 except at a JD boundary.
func TerrestrialTimeJd(ms int64) float64 {
	return j2000JD + TTDaysSinceJ2000(ms)
}

func JulianCenturiesTt(ms int64) float64 {
	return TTDaysSinceJ2000(ms) / 36525
}
