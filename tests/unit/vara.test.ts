import { describe, it, expect } from 'vitest';
import { computeVara } from '../../src/core/vara';

// Minimal vara names for testing (index matches day of week)
const VARA_NAMES = [
  { name: 'Ravivara', short: 'Ravi' },    // 0 = Sunday
  { name: 'Somavara', short: 'Soma' },    // 1 = Monday
  { name: 'Mangalavara', short: 'Mangal' }, // 2 = Tuesday
  { name: 'Budhavara', short: 'Budh' },   // 3 = Wednesday
  { name: 'Guruvara', short: 'Guru' },    // 4 = Thursday
  { name: 'Shukravara', short: 'Shukra' }, // 5 = Friday
  { name: 'Shanivara', short: 'Shani' },  // 6 = Saturday
] as const;

// Jan 8, 2024 = Monday (Jan 1 2024 is Monday, +7 days is also Monday)
// Sunrise at 06:00 UTC
const MONDAY_SUNRISE = new Date('2024-01-08T06:00:00Z');

describe('computeVara — day boundary', () => {
  it('post-sunrise moment on Monday gives Monday vara', () => {
    const moment = new Date('2024-01-08T07:00:00Z'); // 1h after sunrise
    const vara = computeVara(moment, MONDAY_SUNRISE, VARA_NAMES);
    expect(vara.index).toBe(1);
    expect(vara.englishName).toBe('Monday');
  });

  it('pre-sunrise moment on Monday gives Sunday vara (previous day)', () => {
    const moment = new Date('2024-01-08T05:00:00Z'); // 1h before sunrise
    const vara = computeVara(moment, MONDAY_SUNRISE, VARA_NAMES);
    expect(vara.index).toBe(0);
    expect(vara.englishName).toBe('Sunday');
  });

  it('exactly at sunrise gives Monday vara (not before)', () => {
    const vara = computeVara(MONDAY_SUNRISE, MONDAY_SUNRISE, VARA_NAMES);
    expect(vara.index).toBe(1);
    expect(vara.englishName).toBe('Monday');
  });

  it('1ms before sunrise gives Sunday vara', () => {
    const moment = new Date(MONDAY_SUNRISE.getTime() - 1);
    const vara = computeVara(moment, MONDAY_SUNRISE, VARA_NAMES);
    expect(vara.index).toBe(0);
    expect(vara.englishName).toBe('Sunday');
  });
});

describe('computeVara — name resolution', () => {
  it('returns correct localized name and shortName', () => {
    const moment = new Date('2024-01-08T07:00:00Z'); // Monday post-sunrise
    const vara = computeVara(moment, MONDAY_SUNRISE, VARA_NAMES);
    expect(vara.name).toBe('Somavara');
    expect(vara.shortName).toBe('Soma');
  });

  it('pre-sunrise returns previous day name', () => {
    const moment = new Date('2024-01-08T05:00:00Z'); // pre-sunrise → Sunday
    const vara = computeVara(moment, MONDAY_SUNRISE, VARA_NAMES);
    expect(vara.name).toBe('Ravivara');
    expect(vara.shortName).toBe('Ravi');
  });
});

describe('computeVara — all seven days', () => {
  // Jan 1-7, 2024: Mon, Tue, Wed, Thu, Fri, Sat, Sun
  // Sunrise at 06:00 UTC each day; test at 07:00 (post-sunrise)
  const expected = [
    { date: '2024-01-01', index: 1, english: 'Monday' },
    { date: '2024-01-02', index: 2, english: 'Tuesday' },
    { date: '2024-01-03', index: 3, english: 'Wednesday' },
    { date: '2024-01-04', index: 4, english: 'Thursday' },
    { date: '2024-01-05', index: 5, english: 'Friday' },
    { date: '2024-01-06', index: 6, english: 'Saturday' },
    { date: '2024-01-07', index: 0, english: 'Sunday' },
  ];

  for (const { date, index, english } of expected) {
    it(`${date} post-sunrise → ${english} (index ${index})`, () => {
      const sunrise = new Date(`${date}T06:00:00Z`);
      const moment = new Date(`${date}T07:00:00Z`);
      const vara = computeVara(moment, sunrise, VARA_NAMES);
      expect(vara.index).toBe(index);
      expect(vara.englishName).toBe(english);
    });
  }
});
