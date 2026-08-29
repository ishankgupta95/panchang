import { describe, it, expect } from 'vitest';
import { computeVara } from '../../src/core/vara';

const VARA_NAMES = [
  { name: 'Raviwara', short: 'Ravi' },    // 0 = Sunday
  { name: 'Somawara', short: 'Soma' },    // 1 = Monday
  { name: 'Mangalawara', short: 'Mangal' }, // 2 = Tuesday
  { name: 'Budhawara', short: 'Budh' },   // 3 = Wednesday
  { name: 'Guruwara', short: 'Guru' },    // 4 = Thursday
  { name: 'Shukrawara', short: 'Shukra' }, // 5 = Friday
  { name: 'Shaniwara', short: 'Shani' },  // 6 = Saturday
] as const;

// Jan 8, 2024 is a Monday.
const MONDAY_SUNRISE = new Date('2024-01-08T06:00:00Z');

describe('computeVara: day boundary', () => {
  it('post-sunrise moment on Monday gives Monday vara', () => {
    const moment = new Date('2024-01-08T07:00:00Z');
    const vara = computeVara(moment, MONDAY_SUNRISE, VARA_NAMES);
    expect(vara.index).toBe(1);
    expect(vara.englishName).toBe('Monday');
  });

  it('pre-sunrise moment on Monday gives Sunday vara (previous day)', () => {
    const moment = new Date('2024-01-08T05:00:00Z');
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

describe('computeVara: name resolution', () => {
  it('returns correct localized name and shortName', () => {
    const moment = new Date('2024-01-08T07:00:00Z');
    const vara = computeVara(moment, MONDAY_SUNRISE, VARA_NAMES);
    expect(vara.name).toBe('Somawara');
    expect(vara.shortName).toBe('Soma');
  });

  it('pre-sunrise returns previous day name', () => {
    const moment = new Date('2024-01-08T05:00:00Z');
    const vara = computeVara(moment, MONDAY_SUNRISE, VARA_NAMES);
    expect(vara.name).toBe('Raviwara');
    expect(vara.shortName).toBe('Ravi');
  });
});

describe('computeVara: all seven days', () => {
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
