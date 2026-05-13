# Delta for Weather Data Service

## ADDED Requirements

### Requirement: R4 — Daily Forecast with ET₀

The system MUST expose `GET /api/v1/weather/forecast/daily` accepting `lat`, `lng`, and optional `days` (default 7, max 16). MUST return daily arrays of: `date`, `temperature_2m_max`, `temperature_2m_min`, `precipitation_sum`, and `et0_mm` (Hargreaves-Samani). Forecast data MUST be cached with a 60-minute TTL.

#### Scenario: Happy path — forecast returned
- GIVEN the Open-Meteo forecast API is reachable
- WHEN a client calls `GET /api/v1/weather/forecast/daily?lat=9.93&lng=-84.09&days=3`
- THEN the response returns 200 with a `daily` array of 3 entries
- AND each entry includes `date`, `temperature_2m_max`, `temperature_2m_min`, `precipitation_sum`, `et0_mm`

#### Scenario: Edge case — days parameter out of range
- GIVEN the client requests `days=20`
- WHEN the endpoint is called
- THEN the API returns 422: "days must be between 1 and 16"

#### Scenario: Cache hit within TTL
- GIVEN a forecast was fetched for (9.93, -84.09) within the last 60 minutes
- WHEN the same coordinates are requested
- THEN the response is returned from cache
- AND no outgoing HTTP call is made to Open-Meteo

### Requirement: R5 — ET₀ Calculation

The system MUST implement Hargreaves-Samani: ET₀ = 0.0023 × Ra × (T_mean + 17.8) × √(T_max − T_min), where Ra is extraterrestrial radiation from latitude and day of year.

#### Scenario: ET₀ computed correctly
- GIVEN daily forecast temperatures (T_max=32°C, T_min=22°C) at lat=9.93
- WHEN ET₀ is computed for a given day
- THEN the result is a positive float within valid tropical range (2-8 mm/day)

## Acceptance Criteria

| ID | Criterion | Pass/Fail |
|----|-----------|-----------|
| AC1 | Forecast endpoint returns valid ET₀ values | Pass if ET₀ is within 2-8 mm/day for tropics |
| AC2 | Cache serves forecast within 50ms for cache hit | Pass if response time <50ms vs >1s for miss |
| AC3 | Invalid days parameter returns 422 | Pass if error is descriptive |
