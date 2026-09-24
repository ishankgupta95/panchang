package core

import (
	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/store"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

const samvatDayMs = 86_400_000

var samvatsaraNames = [60]string{
	"Prabhava", "Vibhava", "Shukla", "Pramoda", "Prajapati", "Angirasa",
	"Shrimukha", "Bhava", "Yuva", "Dhata", "Ishvara", "Bahudhanya",
	"Pramathi", "Vikrama", "Vrisha", "Chitrabhanu", "Svabhanu", "Tarana",
	"Parthiva", "Vyaya", "Sarvajit", "Sarvadhari", "Virodhi", "Vikriti",
	"Khara", "Nandana", "Vijaya", "Jaya", "Manmatha", "Durmukhi",
	"Hevilambi", "Vilambi", "Vikari", "Sharvari", "Plava", "Shubhakrit",
	"Shobhakrit", "Krodhi", "Vishvavasu", "Parabhava", "Plavanga", "Kilaka",
	"Saumya", "Sadharana", "Virodhakrit", "Paridhavi", "Pramadi", "Ananda",
	"Rakshasa", "Nala", "Pingala", "Kalayukta", "Siddharthi", "Raudra",
	"Durmati", "Dundubhi", "Rudhirodgari", "Raktakshi", "Krodhana", "Akshaya",
}

const chaitraCacheYears = 512

var chaitraStore = store.New[int64, int64](chaitraCacheYears, store.DefaultStripes, store.HashInt64)

func ChaitraNewMoon(ctx *astronomy.EphemerisCtx, gregYear int) (int64, error) {
	key := int64(gregYear)
	if cached, ok := chaitraStore.Get(key); ok {
		return cached, nil
	}

	ref := utils.UtcDateMs(gregYear, 0, 20)
	result := utils.UtcDateMs(gregYear, 2, 22)
	for i := 0; i < 6; i++ {
		bounds, err := astronomy.BoundingNewMoons(ctx, ref)
		if err != nil {
			return 0, err
		}
		sun, err := astronomy.GetSiderealSunLongitude(ctx, bounds.NextMs, types.Lahiri)
		if err != nil {
			return 0, err
		}
		if sun >= 330 && sun < 360 {
			result = bounds.NextMs
			break
		}
		ref = bounds.NextMs + samvatDayMs
	}
	chaitraStore.Put(key, result)
	return result, nil
}

func ComputeSamvat(ctx *astronomy.EphemerisCtx, dateMs int64) (types.SamvatInfo, error) {
	gregYear := types.Date(dateMs).UTCFullYear()
	chaitra, err := ChaitraNewMoon(ctx, gregYear)
	if err != nil {
		return types.SamvatInfo{}, err
	}
	pastNewYear := dateMs >= chaitra

	vikramSamvat := gregYear + 56
	shakaSamvat := gregYear - 79
	if pastNewYear {
		vikramSamvat = gregYear + 57
		shakaSamvat = gregYear - 78
	}

	return types.SamvatInfo{
		VikramSamvat:     vikramSamvat,
		ShakaSamvat:      shakaSamvat,
		VikramSamvatsara: samvatsaraNames[samvatsaraIndex(vikramSamvat+9)],
		ShakaSamvatsara:  samvatsaraNames[samvatsaraIndex(shakaSamvat+11)],
	}, nil
}

func samvatsaraIndex(n int) int {
	return ((n % 60) + 60) % 60
}

func ClearChaitraCache() { chaitraStore.Clear() }
