# Crop Profiles — Specification

## Purpose

Centralize agronomic parameters for 20-30 crops in a version-controlled JSON file, enabling the recommendation engine to read dynamic crop data instead of hardcoded constants.

## Requirements

### R1: Crop Profile Data File

The system MUST load crop parameters from `backend/app/domain/crop_profiles/crop_profiles.json`. The file MUST contain entries for 20-30 crops, each with: growth_stages_days, FAO-56 Kc values (initial/mid/end), root_depth_m, fertilizer rates per stage (NPK), pest thresholds (GDD, temp, humidity), base_yield_kg_ha, and days_to_maturity.

#### Scenario: All profiles load successfully
- GIVEN `crop_profiles.json` exists with 20-30 valid entries
- WHEN the system starts or the profile loader initializes
- THEN all profiles are parsed without error
- AND each profile contains all required fields

#### Scenario: Unknown crop requested
- GIVEN the profile loader is initialized
- WHEN code requests a crop not in the file
- THEN the loader returns `None` or raises `CropNotFoundError`
- AND the caller handles gracefully with fallback defaults

### R2: Profile Loader

The system MUST provide a `CropProfileLoader` class that reads and caches the JSON file in memory. The loader MUST validate each profile against a Pydantic schema on initialization.

#### Scenario: Malformed JSON
- GIVEN `crop_profiles.json` contains invalid JSON
- WHEN the loader attempts to parse it
- THEN a descriptive error is logged
- AND the system falls back to hardcoded default parameters

#### Scenario: Missing required field
- GIVEN a profile entry is missing `kc` (Kc values)
- WHEN the loader validates the entry
- THEN a validation error is logged for that specific crop
- AND the entry is skipped without causing a total load failure

### R3: Version-Controlled Schema

The crop_profiles.json file MUST be tracked in version control. Schema evolution (adding/removing fields) MUST NOT break existing profiles — new fields MUST have safe defaults.

#### Scenario: Schema evolution
- GIVEN a new field `water_logging_tolerance` is added to the schema
- WHEN existing profiles without the field are loaded
- THEN the field is assigned a default value
- AND all existing profiles continue to load without error

### R4: Expansion Endpoint

The system MAY expose `GET /api/v1/crop-profiles` returning all crop profile names and basic metadata (key, name, type) for frontend dropdowns.

#### Scenario: List crop profiles
- GIVEN the profile loader is initialized
- WHEN a client calls `GET /api/v1/crop-profiles`
- THEN the response returns a list of `{key, name, type}` objects
- AND the list matches the keys in `crop_profiles.json`

## Acceptance Criteria

| ID | Criterion | Pass/Fail |
|----|-----------|-----------|
| AC1 | All 20-30 crops load from JSON without validation error | Pass if no errors during loader init |
| AC2 | Bad JSON file triggers fallback with logged error | Pass if system stays operational |
| AC3 | Unknown crop key returns graceful fallback | Pass if error is handled not thrown |
| AC4 | `GET /api/v1/crop-profiles` returns all crop keys | Pass if response.count ≥ 20 |
