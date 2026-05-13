# Daily Scheduler — Specification

## Purpose

Run APScheduler-based daily batch jobs at 6AM to generate recommendations and yield predictions for all fields, ensuring data is ready when users access the dashboard.

## Requirements

### R1: Daily Batch Schedule

The system MUST run a batch job daily at 06:00 local time using APScheduler. The scheduler MUST be initialized in the FastAPI lifespan context and shut down gracefully.

#### Scenario: Scheduler starts with app
- GIVEN the FastAPI application starts
- WHEN the lifespan context initializes
- THEN APScheduler registers a cron trigger for 06:00
- AND no duplicate jobs are created on reload (dev mode)

#### Scenario: Graceful shutdown
- GIVEN the scheduler is running
- WHEN the application shuts down
- THEN the scheduler shuts down within 5 seconds
- AND no jobs are left partially executing

### R2: Batch Recommendations

The daily job MUST iterate all fields and call the recommendation engine for each. Results MUST be stored in the `recommendations` table. Errors on individual fields MUST NOT stop the batch.

#### Scenario: All fields succeed
- GIVEN 50 fields exist in the database
- WHEN the daily batch runs
- THEN recommendations are generated for all 50 fields
- AND each field has at least one recommendation stored

#### Scenario: Single field fails
- GIVEN one field has invalid sensor data
- WHEN the batch runs
- THEN the error is logged for that field
- AND the remaining 49 fields still receive recommendations
- AND the batch summary reports 1 failure / 49 success

### R3: Batch Predictions

The daily job MUST run yield predictions for all fields with sufficient data. Results MUST be stored in the `predictions` table with `data_quality` and `features_used` populated.

#### Scenario: All predictions succeed
- GIVEN models exist for all crop types in active fields
- WHEN the daily batch runs
- THEN predictions are generated and stored for each field
- AND predictions have `features_used` listing the features employed

### R4: Scheduler Health Check

The system MUST expose `GET /api/v1/system/scheduler/health` returning `{ "last_run": "ISO8601", "status": "ok" | "missed" }`. If no run in the past 25 hours, status MUST be `missed`.

#### Scenario: Scheduler healthy
- GIVEN the batch ran at 06:00 today
- WHEN the health endpoint is called
- THEN status is "ok" and last_run is today's 06:00 timestamp

#### Scenario: Missed run detected
- GIVEN the scheduler has not run in 26 hours
- WHEN the health endpoint is called
- THEN status is "missed"
- AND a warning is logged to the system log

## Acceptance Criteria

| ID | Criterion | Pass/Fail |
|----|-----------|-----------|
| AC1 | APScheduler starts with FastAPI lifespan | Pass if scheduler is active after app start |
| AC2 | All fields get recommendations after daily run | Pass if count of new recs ≈ count of fields |
| AC3 | Single field failure does not abort batch | Pass if 49/50 fields have recs after 1 failure |
| AC4 | Health check reports "missed" after 25h no run | Pass if status transitions from ok to missed |
