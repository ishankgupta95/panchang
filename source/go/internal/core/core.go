// Package core assembles the panchang itself: the five angas with their end times,
// sunrise-to-sunrise day boundaries, muhurta and inauspicious windows, choghadiya
// and hora periods, calendar labels and the day's festivals.
package core

import "errors"

var (
	errMissingChandraBalam = errors.New(
		"core: options.janmaRashi is set but NatalResolvers.ChandraBalam is nil")
	errMissingTarabala = errors.New(
		"core: options.janmaNakshatra is set but NatalResolvers.Tarabala is nil")
)
