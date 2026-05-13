# Recommendation Lifecycle — Specification

## Purpose

Enable users to acknowledge, apply, or dismiss recommendations from the dashboard, tracking each recommendation's status and providing an auditable decision trail.

## Requirements

### R1: Status Enum

The system MUST add a `status` column to the `recommendations` table with values: `active`, `acknowledged`, `applied`, `dismissed`. Default MUST be `active`. (Migration 007)

#### Scenario: New recommendation created
- GIVEN the recommendation engine generates a new rec
- WHEN it is inserted into the DB
- THEN `status` defaults to `active`
- AND `acknowledged_at`, `dismissed_at` are NULL

### R2: Lifecycle Endpoint

The system MUST expose `PATCH /api/v1/recommendations/{id}/status` accepting `{ "status": "acknowledged" | "applied" | "dismissed" }`. Acknowledged sets `acknowledged_at = NOW()`. Dismissed sets `dismissed_at = NOW()`.

#### Scenario: Acknowledge recommendation
- GIVEN an active recommendation with ID `rec-123`
- WHEN the user calls `PATCH /api/v1/recommendations/rec-123/status` with `{"status": "acknowledged"}`
- THEN the response returns 200
- AND `status` changes to `acknowledged` with `acknowledged_at` set

#### Scenario: Dismiss recommendation
- GIVEN an acknowledged recommendation
- WHEN the user calls PATCH with `{"status": "dismissed"}`
- THEN `status` changes to `dismissed` with `dismissed_at` set

#### Scenario: Edge case — invalid transition
- GIVEN a recommendation with status `applied`
- WHEN the user tries to dismiss it
- THEN the API returns 409 Conflict
- AND the recommendation status remains `applied`

#### Scenario: Error case — not found
- GIVEN no recommendation with ID `rec-999`
- WHEN the PATCH is called
- THEN the API returns 404

### R3: UI Lifecycle Actions

The frontend MUST render action buttons on each recommendation card (Acknowledge, Apply, Dismiss). Clicking MUST call the PATCH endpoint and update the UI optimistically.

#### Scenario: Acknowledge from dashboard
- GIVEN a recommendation card with status `active`
- WHEN the user clicks "Acknowledge"
- THEN the card updates to show acknowledged state (checkmark, timestamp)
- AND the API call succeeds

#### Scenario: Dismiss with confirmation
- GIVEN a recommendation card
- WHEN the user clicks "Dismiss"
- THEN a confirmation dialog appears
- AND the API is called only after confirmation

#### Scenario: API error reverts UI
- GIVEN the optimistic update changed the card to acknowledged
- WHEN the PATCH API returns an error
- THEN the card reverts to its previous status
- AND an error toast is shown

## Acceptance Criteria

| ID | Criterion | Pass/Fail |
|----|-----------|-----------|
| AC1 | PATCH endpoint transitions status correctly | Pass if each allowed transition updates the row |
| AC2 | 409 returned for invalid transitions | Pass if `applied→dismissed` returns 409 |
| AC3 | UI action buttons render per status | Pass if each card shows correct actions for its state |
| AC4 | Optimistic UI update reverts on API error | Pass if error toast appears and card reverts |
| AC5 | Migration 007 adds columns without data loss | Pass if existing rows have status='active' |
