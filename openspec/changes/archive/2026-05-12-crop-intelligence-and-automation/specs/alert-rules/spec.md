# Delta for Alert Rules

## ADDED Requirements

### Requirement: R4 — Auto-create Alert from High-Severity Recommendation

The system MUST create an alert event when a recommendation with severity `high` or `critical` is generated. MUST call `AlertService.create_event()` with: `type="recommendation"`, `severity` matching the recommendation, and `message` containing the recommendation title.

#### Scenario: High-severity rec triggers alert
- GIVEN the recommendation engine generates a critical pest risk with severity="critical"
- WHEN the recommendation is stored
- THEN an `AlertEvent` is created via `AlertService.create_event()`
- AND the alert appears in the dashboard alert stream
- AND the alert references the recommendation ID

#### Scenario: Low-severity rec does NOT trigger alert
- GIVEN a recommendation with severity="info"
- WHEN the recommendation is stored
- THEN no alert event is created
- AND the recommendation is only visible in the recommendations section

#### Scenario: Alert creation failure is non-blocking
- GIVEN `AlertService.create_event()` raises an exception
- WHEN the engine tries to create an alert for a high-severity rec
- THEN the error is logged
- AND the recommendation is still saved successfully
- AND no exception propagates to the caller

## Acceptance Criteria

| ID | Criterion | Pass/Fail |
|----|-----------|-----------|
| AC1 | Critical recommendation creates AlertEvent | Pass if alert count increases when critical rec stored |
| AC2 | Info recommendation does not create alert | Pass if no alert is created for severity=info |
| AC3 | Alert creation failure does not block recommendation save | Pass if recommendation persists even if alert fails |
