# Weather Data Service Specification

## Purpose

Provide a backend weather service module that fetches real-time weather data from the free Open-Meteo API. New domain module under `backend/app/domain/weather/` with service, router, and schemas. Uses httpx (production dependency) for HTTP calls.

## Requirements

### R1: Weather Fetch Endpoint

The system MUST expose `GET /api/v1/weather/current` accepting `lat` and `lng` query parameters. It MUST return: temperature (°C), humidity (%), precipitation (mm), wind_speed (km/h), and weather_code (WMO).

#### Scenario: Happy path — valid lat/lng
- GIVEN the service is running and Open-Meteo is reachable
- WHEN a client calls `GET /api/v1/weather/current?lat=9.93&lng=-84.09`
- THEN the response returns 200 with `temperature`, `humidity`, `precipitation`, `wind_speed`, and `weather_code`
- AND all values are floats within valid ranges

#### Scenario: Edge case — out-of-range coordinates
- GIVEN lat > 90 or lng > 180
- WHEN the client calls with invalid coordinates
- THEN the API returns 422 with a validation error describing the valid range

#### Scenario: Error case — Open-Meteo unavailable
- GIVEN the Open-Meteo API returns 503
- WHEN the client calls the weather endpoint
- THEN the system returns 502 with message "Weather service unavailable"
- AND logs the upstream error

### R2: Caching with TTL

The system MUST cache weather responses in-memory with a configurable TTL (default: 10 minutes). Subsequent requests for the same coordinates within TTL MUST return cached data.

#### Scenario: Happy path — cache hit
- GIVEN a successful weather fetch for coordinates (9.93, -84.09) within the last 10 minutes
- WHEN the same coordinates are requested again
- THEN the response is returned from cache
- AND no outgoing HTTP call is made to Open-Meteo

#### Scenario: Edge case — TTL expiry
- GIVEN a cached response older than 10 minutes
- WHEN the coordinates are requested
- THEN the cache is invalidated
- AND a fresh request is sent to Open-Meteo

### R3: Open-Meteo API Integration

The system MUST call `https://api.open-meteo.com/v1/forecast` with parameters: `current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code` and `timezone=auto`. httpx MUST be used as the HTTP client.

#### Scenario: Happy path — correct API call
- GIVEN a request for weather data
- WHEN the service calls Open-Meteo
- THEN the URL includes all required parameters
- AND the response is parsed into the defined schema

#### Scenario: Edge case — missing fields in response
- GIVEN Open-Meteo returns a response missing `humidity`
- WHEN the service parses the response
- THEN the missing field is set to `null`
- AND no error is raised

## Acceptance Criteria

| ID | Criterion | Pass/Fail |
|----|-----------|-----------|
| AC1 | `GET /api/v1/weather/current?lat=9.93&lng=-84.09` returns 200 with valid weather data | Pass if all fields present and typed correctly |
| AC2 | Invalid lat/lng returns 422 | Pass if error response matches Pydantic validation |
| AC3 | Cached response returns within 50ms for cache hit | Pass if response time <50ms vs >500ms for cache miss |
| AC4 | Open-Meteo downtime returns 502 gracefully | Pass if no exception propagates to client |
| AC5 | httpx is a production dependency in pyproject.toml | Pass if `pip install httpx` not needed separately |

## Non-functional Requirements

- **Performance**: Cold request <1s (network-bound); cache hit <50ms
- **Resilience**: 3 retries with exponential backoff (100ms, 500ms, 2s) on network errors
- **Logging**: Every upstream call logged with lat/lng, response status, and duration
- **Config**: TTL and Open-Meteo base URL configurable via environment variables

## Validation Rules

| Field | Rule |
|-------|------|
| `lat` | Required, float, -90 to 90 |
| `lng` | Required, float, -180 to 180 |
| `temperature` | Nullable float, -50 to 60 |
| `humidity` | Nullable float, 0 to 100 |
| `precipitation` | Nullable float, >= 0 |
| `wind_speed` | Nullable float, >= 0 |
| `weather_code` | Nullable integer, 0-99 (WMO codes) |
