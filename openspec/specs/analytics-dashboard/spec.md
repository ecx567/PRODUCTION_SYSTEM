# Analytics Dashboard — Specification

## Purpose

Replace the placeholder Analytics page with a live Recharts dashboard consuming existing `/api/v1/analytics/*` endpoints. Display hourly trend charts (line, bar, area), summary gauges, and gap detection. Recharts is already installed in the project.

## Requirements

### R1: Field Selector

The system MUST provide a dropdown to select a field. The analytics dashboard MUST filter all charts to the selected field. On field change, all charts MUST reload with the new field's data.

#### Scenario: Happy path — field selection
- GIVEN the user is on the Analytics page
- WHEN they select "North Field" from the dropdown
- THEN all charts reload showing data for North Field
- AND the URL updates with `?field_id=<id>` (optional v1)

#### Scenario: Edge case — no fields available
- GIVEN the tenant has no fields
- WHEN the Analytics page loads
- THEN a message displays: "Create a field to view analytics"
- AND no chart errors occur

### R2: Hourly Trend Chart (Line Chart)

The system MUST render a Recharts `<LineChart>` showing hourly sensor averages for the selected field. It MUST consume `GET /api/v1/fields/{id}/analytics/hourly`. The chart MUST display: temperature (line), humidity (line), and a time X-axis.

#### Scenario: Happy path — hourly data available
- GIVEN the selected field has hourly sensor data for the last 72 hours
- WHEN the hourly trend chart renders
- THEN temperature and humidity lines are displayed with time on X-axis
- AND tooltips show exact values on hover

#### Scenario: Edge case — no data in time range
- GIVEN the selected field has no sensor readings
- WHEN the hourly chart renders
- THEN the chart area shows "No data available for this period"
- AND no JavaScript error occurs

### R3: Summary Gauges

The system MUST display a row of gauge-style cards showing: average temperature, average humidity, average soil moisture, and total rain. Data sourced from `GET /api/v1/fields/{id}/analytics/summary`.

#### Scenario: Happy path — summary data available
- GIVEN the analytics summary endpoint returns data
- WHEN the page renders
- THEN 4 gauge cards display with values and labels
- AND each gauge shows a visual fill proportional to the value

#### Scenario: Edge case — null values in summary
- GIVEN the summary returns null for some metrics
- WHEN the gauge cards render
- THEN null values display as "—"
- AND the gauge fill defaults to 0 or minimal

### R4: Gap Detection Table

The system MUST display a table of sensors with missing data, sourced from `GET /api/v1/fields/{id}/analytics/gaps`. Each row shows: sensor_id, last_seen, gap_minutes. Empty state when no gaps.

#### Scenario: Happy path — gaps detected
- GIVEN some sensors have stopped reporting
- WHEN the gap table renders
- THEN each gap row shows sensor_id, last_seen, and gap duration
- AND rows are sorted by gap duration descending

#### Scenario: Empty state — all sensors healthy
- GIVEN all sensors have reported within threshold
- WHEN the gap table renders
- THEN a green indicator shows "All sensors reporting normally"

### R5: Time Range Selector

The system MUST provide a time range selector (24h, 7d, 30d, custom) that controls the `start_time` and `end_time` query parameters for all charts.

#### Scenario: Happy path — time range change
- GIVEN the analytics dashboard is loaded with 24h data
- WHEN the user selects "7d"
- THEN all charts reload with the 7-day window
- AND X-axis labels adjust to show daily ticks

## Acceptance Criteria

| ID | Criterion | Pass/Fail |
|----|-----------|-----------|
| AC1 | All 3 chart types render without console errors | Pass if Recharts renders line, bar, and area without errors |
| AC2 | Field selector filters all charts | Pass if changing field reloads each chart |
| AC3 | Gap detection table shows/hides based on data | Pass if empty state shows when no gaps |
| AC4 | Time range selector adjusts chart windows | Pass if X-axis range changes accordingly |
| AC5 | Loading state shows skeleton/spinner while fetching | Pass if visual feedback appears on load |
| AC6 | API errors show error banners, not blank page | Pass if error boundary catches failures |

## Non-functional Requirements

- **Performance**: Charts render in <2s including API calls (3 endpoints)
- **UX**: Loading skeletons for each chart; error state per chart (not page-level)
- **Error handling**: Each chart has independent error handling; one failing API doesn't break others
- **Responsiveness**: Charts scale to container width; gauge cards wrap in a responsive grid
- **Accessibility**: Charts have `role="img"` with text descriptions via `aria-label`

## Validation Rules

| Parameter | Rule |
|-----------|------|
| field_id | Required, must be valid UUID |
| start_time | Optional ISO 8601; defaults to 24h ago |
| end_time | Optional ISO 8601; defaults to now |
| threshold_minutes | Integer 1-1440; defaults to 30 |
