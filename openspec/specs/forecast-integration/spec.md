# Forecast Integration — Specification

## Purpose

Integrate Open-Meteo daily forecast data into the irrigation recommendation engine, enabling proactive recommendations that account for expected rainfall.

## Requirements

### R1: Forecast Daily Endpoint

The system MUST expose `GET /api/v1/weather/forecast/daily` accepting `lat`, `lng`, and optional `days` (default 7, max 16). MUST return daily precipitation, temperature_max, temperature_min, and computed ET₀ (Hargreaves-Samani formula).

#### Scenario: Happy path — valid coordinates
- GIVEN the Open-Meteo forecast API is reachable
- WHEN a client calls `GET /api/v1/weather/forecast/daily?lat=9.93&lng=-84.09&days=3`
- THEN the response returns 200 with daily entries for 3 days
- AND each entry includes `precipitation_mm`, `temp_max`, `temp_min`, `et0_mm`
- AND ET₀ is computed from temperature via Hargreaves-Samani

#### Scenario: Edge case — partial forecast
- GIVEN Open-Meteo returns forecast with missing days
- WHEN the endpoint is called
- THEN available days are returned and missing days omitted

#### Scenario: Edge case — invalid days parameter
- GIVEN the client requests `days=20`
- WHEN the endpoint is called
- THEN the API returns 422: `days must be between 1 and 16`

### R2: Rain Gate for Irrigation

The recommendation engine MUST check the 3-day forecast before generating irrigation recs. If forecast precipitation sum ≥ crop ETc for 3 days (at ≥80% confidence), the engine MUST skip irrigation.

#### Scenario: Rain covers ETc — skip irrigation
- GIVEN maize field has ETc=15mm over 3 days
- AND the 3-day forecast shows 18mm total rain at 85% confidence
- WHEN the engine generates recommendations
- THEN no irrigation recommendation is created
- AND a log entry states the skip reason

#### Scenario: Rain insufficient — recommend irrigation
- GIVEN forecast shows 5mm rain vs 15mm ETc
- WHEN the engine generates recommendations
- THEN an irrigation recommendation is created for the deficit (10mm)
- AND the recommendation includes forecast metadata

#### Scenario: Low confidence — always irrigate
- GIVEN forecast confidence is below 80%
- WHEN the engine evaluates the rain gate
- THEN the gate is bypassed
- AND irrigation is recommended regardless
- AND the recommendation notes "Forecast confidence below 80%"

### R3: Forecast Metadata in Payload

Each irrigation recommendation MUST include: `forecast_precipitation_mm`, `forecast_et0_mm`, `forecast_days`, `forecast_confidence`.

#### Scenario: Forecast metadata attached
- GIVEN an irrigation recommendation is generated
- WHEN the JSONB payload is inspected
- THEN it contains all 4 forecast fields
- AND values match the forecast API response at generation time

## Acceptance Criteria

| ID | Criterion | Pass/Fail |
|----|-----------|-----------|
| AC1 | Forecast endpoint returns valid ET₀ (2-8 mm/day) | Pass if ET₀ is within valid tropical range |
| AC2 | Irrigation skipped when rain ≥ ETc at ≥80% confidence | Pass if no irrigation rec for covered period |
| AC3 | Low-confidence forecast always recommends irrigation | Pass if rain gate does not suppress below 80% |
| AC4 | Forecast metadata present in recommendation payload | Pass if all 4 fields exist in JSONB |
