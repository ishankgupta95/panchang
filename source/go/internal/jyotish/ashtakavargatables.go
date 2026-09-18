package jyotish

import "github.com/ishankgupta95/panchang/source/go/v5/types"

type AshtakavargaContributor int

const (
	ContributorSun                             = AshtakavargaContributor(types.VisibleSun)
	ContributorMoon                            = AshtakavargaContributor(types.VisibleMoon)
	ContributorMars                            = AshtakavargaContributor(types.VisibleMars)
	ContributorMercury                         = AshtakavargaContributor(types.VisibleMercury)
	ContributorJupiter                         = AshtakavargaContributor(types.VisibleJupiter)
	ContributorVenus                           = AshtakavargaContributor(types.VisibleVenus)
	ContributorSaturn                          = AshtakavargaContributor(types.VisibleSaturn)
	ContributorLagna   AshtakavargaContributor = types.VisibleGrahaCount
	ContributorCount                           = types.VisibleGrahaCount + 1
)

var AshtakavargaContributors = [ContributorCount]AshtakavargaContributor{
	ContributorSun, ContributorMoon, ContributorMars, ContributorMercury,
	ContributorJupiter, ContributorVenus, ContributorSaturn, ContributorLagna,
}

var AshtakavargaReceivers = types.AllVisibleGrahas

func (c AshtakavargaContributor) String() string {
	if c == ContributorLagna {
		return "Lagna"
	}
	if c < 0 || c >= types.VisibleGrahaCount {
		return "AshtakavargaContributor(" + itoa(int(c)) + ")"
	}
	return types.VisibleGraha(c).String()
}

var BeneficOffsets = [types.VisibleGrahaCount][ContributorCount][]int{
	types.VisibleSun: {
		ContributorSun:     {1, 2, 4, 7, 8, 9, 10, 11},
		ContributorMoon:    {3, 6, 10, 11},
		ContributorMars:    {1, 2, 4, 7, 8, 9, 10, 11},
		ContributorMercury: {3, 5, 6, 9, 10, 11, 12},
		ContributorJupiter: {5, 6, 9, 11},
		ContributorVenus:   {6, 7, 12},
		ContributorSaturn:  {1, 2, 4, 7, 8, 9, 10, 11},
		ContributorLagna:   {3, 4, 6, 10, 11, 12},
	},
	types.VisibleMoon: {
		ContributorSun:     {3, 6, 7, 8, 10, 11},
		ContributorMoon:    {1, 3, 6, 7, 10, 11},
		ContributorMars:    {2, 3, 5, 6, 9, 10, 11},
		ContributorMercury: {1, 3, 4, 5, 7, 8, 10, 11},
		ContributorJupiter: {1, 4, 7, 8, 10, 11, 12},
		ContributorVenus:   {3, 4, 5, 7, 9, 10, 11},
		ContributorSaturn:  {3, 5, 6, 11},
		ContributorLagna:   {3, 6, 10, 11},
	},
	types.VisibleMars: {
		ContributorSun:     {3, 5, 6, 10, 11},
		ContributorMoon:    {3, 6, 11},
		ContributorMars:    {1, 2, 4, 7, 8, 10, 11},
		ContributorMercury: {3, 5, 6, 11},
		ContributorJupiter: {6, 10, 11, 12},
		ContributorVenus:   {6, 8, 11, 12},
		ContributorSaturn:  {1, 4, 7, 8, 9, 10, 11},
		ContributorLagna:   {1, 3, 6, 10, 11},
	},
	types.VisibleMercury: {
		ContributorSun:     {5, 6, 9, 11, 12},
		ContributorMoon:    {2, 4, 6, 8, 10, 11},
		ContributorMars:    {1, 2, 4, 7, 8, 9, 10, 11},
		ContributorMercury: {1, 3, 5, 6, 9, 10, 11, 12},
		ContributorJupiter: {6, 8, 11, 12},
		ContributorVenus:   {1, 2, 3, 4, 5, 8, 9, 11},
		ContributorSaturn:  {1, 2, 4, 7, 8, 9, 10, 11},
		ContributorLagna:   {1, 2, 4, 6, 8, 10, 11},
	},
	types.VisibleJupiter: {
		ContributorSun:     {1, 2, 3, 4, 7, 8, 9, 10, 11},
		ContributorMoon:    {2, 5, 7, 9, 11},
		ContributorMars:    {1, 2, 4, 7, 8, 10, 11},
		ContributorMercury: {1, 2, 4, 5, 6, 9, 10, 11},
		ContributorJupiter: {1, 2, 3, 4, 7, 8, 10, 11},
		ContributorVenus:   {2, 5, 6, 9, 10, 11},
		ContributorSaturn:  {3, 5, 6, 12},
		ContributorLagna:   {1, 2, 4, 5, 6, 7, 9, 10, 11},
	},
	types.VisibleVenus: {
		ContributorSun:     {8, 11, 12},
		ContributorMoon:    {1, 2, 3, 4, 5, 8, 9, 11, 12},
		ContributorMars:    {3, 5, 6, 9, 11, 12},
		ContributorMercury: {3, 5, 6, 9, 11},
		ContributorJupiter: {5, 8, 9, 10, 11},
		ContributorVenus:   {1, 2, 3, 4, 5, 8, 9, 10, 11},
		ContributorSaturn:  {3, 4, 5, 8, 9, 10, 11},
		ContributorLagna:   {1, 2, 3, 4, 5, 8, 9, 11},
	},
	types.VisibleSaturn: {
		ContributorSun:     {1, 2, 4, 7, 8, 10, 11},
		ContributorMoon:    {3, 6, 11},
		ContributorMars:    {3, 5, 6, 10, 11, 12},
		ContributorMercury: {6, 8, 9, 10, 11, 12},
		ContributorJupiter: {5, 6, 11, 12},
		ContributorVenus:   {6, 11, 12},
		ContributorSaturn:  {3, 5, 6, 11},
		ContributorLagna:   {1, 3, 4, 6, 10, 11},
	},
}

var BhinnashtakaTotal = [types.VisibleGrahaCount]int{
	types.VisibleSun:     48,
	types.VisibleMoon:    49,
	types.VisibleMars:    39,
	types.VisibleMercury: 54,
	types.VisibleJupiter: 56,
	types.VisibleVenus:   52,
	types.VisibleSaturn:  39,
}

const SarvashtakaTotal = 337

var EkadhipatyaPairs = [5][2]int{
	{0, 7},
	{1, 6},
	{2, 5},
	{8, 11},
	{9, 10},
}

var TrikonaTriads = [4][3]int{
	{0, 4, 8},
	{1, 5, 9},
	{2, 6, 10},
	{3, 7, 11},
}
