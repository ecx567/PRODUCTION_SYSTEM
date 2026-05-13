# Yield Predictions — Specification

## Purpose

Display yield forecast cards on the field detail page showing predicted yield, confidence interval, trend vs last prediction, data quality, and historical comparison.

## Requirements

### R1: Prediction Card

The frontend MUST render a yield prediction card on `web/src/app/dashboard/fields/[id]/page.tsx` consuming `GET /api/v1/fields/{id}/predictions/yield`. MUST display: predicted yield (tons/ha), confidence interval (lower_bound–upper_bound), and data quality badge.

#### Scenario: Happy path — prediction available
- GIVEN a trained ML model exists and the field has sensor data
- WHEN the field detail page loads
- THEN a yield prediction card is visible with yield, confidence interval, and quality badge
- AND the card loads independently without blocking the page

#### Scenario: Edge case — no model trained
- GIVEN no ML model exists for the field's crop type
- WHEN the prediction card renders
- THEN it shows "Prediction unavailable — model not trained"
- AND a GDD-based fallback estimate is displayed with "(fallback)" label

#### Scenario: Error case — API failure
- GIVEN the predictions API returns 500
- WHEN the card renders
- THEN the card shows "Prediction temporarily unavailable"
- AND a retry button is available

### R2: Prediction History Sparkline

The card MUST show a sparkline of predictions over time for the current season, consuming `GET /api/v1/fields/{id}/predictions/history`.

#### Scenario: History available
- GIVEN the field has multiple predictions this season
- WHEN the card renders
- THEN a sparkline shows the trend of predictions over time
- AND the latest prediction point is highlighted

#### Scenario: Empty history
- GIVEN no predictions exist yet
- WHEN the card renders
- THEN the sparkline area shows "No history yet"
- AND no chart error occurs

### R3: Trend Indicator

The card MUST show a trend arrow (↑ / ↓ / →) comparing the current prediction to the previous one, with percentage change.

#### Scenario: Yield increasing
- GIVEN latest prediction (4.5t) is higher than previous (4.2t)
- WHEN the card renders
- THEN a green ↑ arrow with "+7.1%" is displayed

#### Scenario: First prediction — no baseline
- GIVEN there is no previous prediction
- WHEN the card renders
- THEN no trend arrow is shown
- AND the card displays "Baseline prediction"

## Acceptance Criteria

| ID | Criterion | Pass/Fail |
|----|-----------|-----------|
| AC1 | Prediction card renders without blocking page load | Pass if page content shows while prediction loads |
| AC2 | Fallback GDD estimate shows when model absent | Pass if "fallback" label is visible |
| AC3 | History sparkline renders without console errors | Pass if no chart errors in dev tools |
| AC4 | Trend arrow shows correct direction and percentage | Pass if ±% matches difference between predictions |
| AC5 | Data quality badge matches `data_quality` API field | Pass if badge text === API value |
