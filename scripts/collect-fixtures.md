# How to Collect DrikPanchang Fixtures

## Process
1. Go to https://www.drikpanchang.com/panchang/day-panchang.html
2. Set the city and date
3. Record these values in `tests/fixtures/drikpanchang-india.json`:
   - Sunrise and Sunset (convert to UTC)
   - Tithi name(s) and end-time(s)
   - Nakshatra name(s) and end-time(s)
   - Yoga name
   - Karana name(s) and end-time(s)
   - Vara (weekday)
   - Rahu Kalam start and end

## Converting IST to UTC
IST = UTC + 5:30
So: IST 07:04 → UTC 01:34 (subtract 5h30m)

## Target Matrix
See Section 16.1 of the implementation plan for the full list of
17 date/city combinations to collect.

## JSON Format
```json
{
  "date": "2025-01-14",
  "city": "Pune",
  "location": { "latitude": 18.5204, "longitude": 73.8567 },
  "timezone": 330,
  "expected": {
    "sunrise": "2025-01-14T01:34:00Z",
    "sunset": "2025-01-14T12:38:00Z",
    "tithis": [
      { "name": "Krishna Chaturdashi", "paksha": "Krishna",
        "endTime": "2025-01-14T14:45:00Z" }
    ],
    "nakshatras": [
      { "name": "Mrigashira", "endTime": "2025-01-14T11:10:00Z" }
    ],
    "yogas": [{ "name": "Vyatipata" }],
    "karanas": [
      { "name": "Vanija", "endTime": "2025-01-14T03:12:00Z" }
    ],
    "vara": "Mangalavara",
    "rahuKalam": {
      "start": "2025-01-14T09:41:00Z",
      "end": "2025-01-14T11:09:00Z"
    }
  }
}
```
