# Alert Rules CRUD — Specification

## Purpose

Provide a full modal-based create/edit/delete UI for alert rules. The backend already exposes `POST/PUT/DELETE /api/v1/alerts/rules` endpoints. The current page is read-only (list only); this spec adds interactive CRUD.

## Requirements

### R1: Create Alert Rule (Modal)

The system MUST display a modal form when the "New Rule" button is clicked. The form MUST include fields: name, metric_type (dropdown), condition (dropdown), threshold, threshold_max (visible only for "between" condition), severity (dropdown), field_id (optional dropdown), cooldown_minutes, and enabled (toggle). On submit, the system MUST call `POST /api/v1/alerts/rules`.

#### Scenario: Happy path — create rule with valid data
- GIVEN the user is on the Alert Rules page
- WHEN they click "New Rule", fill all required fields, and click Save
- THEN the modal closes, a success toast appears, and the new rule appears in the list

#### Scenario: Edge case — missing required field
- GIVEN the create modal is open
- WHEN the user submits without a name
- THEN the form shows inline validation: "Name is required"
- AND the modal does not close
- AND no API call is made

#### Scenario: Error case — backend returns 400
- GIVEN the user submits valid form data
- WHEN the backend rejects with 400 (e.g., invalid metric_type)
- THEN the modal stays open with an error banner showing the API error message

### R2: Edit Alert Rule (Modal)

The system MUST open a pre-filled modal when the user clicks "Edit" on an existing rule. The modal MUST pre-populate all fields from the existing rule data. On submit, it MUST call `PUT /api/v1/alerts/rules/{id}`.

#### Scenario: Happy path — edit with valid changes
- GIVEN the rules list is loaded
- WHEN the user clicks Edit on a rule, changes the threshold, and saves
- THEN `PUT /api/v1/alerts/rules/{id}` is called with the updated threshold
- AND the list refreshes showing the new value

#### Scenario: Edge case — backend returns 404
- GIVEN another user deleted the rule between list load and edit
- WHEN the user saves the edit
- THEN the modal shows "Rule not found. It may have been deleted."
- AND the modal closes, list refreshes

### R3: Delete Alert Rule (Confirmation)

The system MUST show a confirmation dialog when the user clicks "Delete". The dialog MUST show the rule name and warning. On confirm, the system MUST call `DELETE /api/v1/alerts/rules/{id}`.

#### Scenario: Happy path — confirm delete
- GIVEN the rules list is loaded
- WHEN the user clicks Delete, confirms in the dialog
- THEN `DELETE /api/v1/alerts/rules/{id}` is called
- AND the rule is removed from the list
- AND a success toast appears

#### Scenario: Edge case — cancel delete
- GIVEN the delete confirmation dialog is open
- WHEN the user clicks Cancel
- THEN no API call is made
- AND the dialog closes without changes

### R4: Auto-create Alert from High-Severity Recommendation

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
| AC1 | Create modal opens on "New Rule" click, closes on successful save | Pass if modal opens/closes correctly |
| AC2 | Form validation prevents submission with missing required fields | Pass if inline errors appear before any API call |
| AC3 | Edit modal pre-fills all existing rule values | Pass if every field matches the rule data |
| AC4 | Delete shows confirmation before calling API | Pass if rule is NOT deleted on first click |
| AC5 | List refreshes automatically after create/edit/delete | Pass if new data appears without manual refresh |
| AC6 | All API errors (4xx/5xx) display user-friendly messages in the UI | Pass if error banner is visible and dismissable |
| AC7 | Critical recommendation creates AlertEvent | Pass if alert count increases when critical rec stored |
| AC8 | Info recommendation does not create alert | Pass if no alert is created for severity=info |
| AC9 | Alert creation failure does not block recommendation save | Pass if recommendation persists even if alert fails |

## Non-functional Requirements

- **Performance**: Modal opens in <200ms; form submission feedback in <3s (network timeout 10s)
- **UX**: Loading spinner on submit button; disabled state while request in flight
- **Error handling**: Network errors (no internet) show generic "Connection error. Please try again."
- **Accessibility**: Modal traps focus; Escape closes; labels associated with inputs
- **State**: Unsaved changes warning if user tries to close modal with dirty form

## Validation Rules (Client-side)

| Field | Rule | Error Message |
|-------|------|---------------|
| name | Required, 1-255 chars | "Name is required" / "Name too long" |
| metric_type | Must select from dropdown | "Metric type is required" |
| condition | Must select from dropdown | "Condition is required" |
| threshold | Required, numeric | "Threshold must be a number" |
| threshold_max | Required if condition="between", must be > threshold | "Upper bound must be greater than threshold" |
| cooldown_minutes | Integer, 1-1440 | "Must be between 1 and 1440 minutes" |
