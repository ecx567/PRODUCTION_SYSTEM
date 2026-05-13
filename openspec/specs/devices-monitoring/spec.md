# Devices Monitoring — Specification

## Purpose

Replace the current placeholder Devices page with live sensor data from the `sensor_readings` table. Display per-sensor cards showing temperature, humidity, soil moisture, rain, signal quality, and last seen timestamp. Aggregate data by `sensor_id`.

## Requirements

### R1: Fetch Sensor Data

The system MUST fetch sensor readings aggregated by `sensor_id` from the existing `sensor_readings` table. Each sensor card MUST show the latest reading for: `temp`, `humidity`, `soil_moisture`, `rain`, `signal_quality`, and a `last_seen` timestamp.

#### Scenario: Happy path — sensors with data
- GIVEN the sensor_readings table has recent data for 5 sensors
- WHEN the Devices page loads
- THEN 5 sensor cards render
- AND each card displays all 5 metric fields + last_seen
- AND all values match the latest reading per sensor

#### Scenario: Empty state — no sensor data
- GIVEN the sensor_readings table is empty
- WHEN the Devices page loads
- THEN a message displays: "No sensor data available. Check sensor connectivity."
- AND no cards are rendered

#### Scenario: Partial data — sensor missing some metrics
- GIVEN a sensor has readings where some fields are NULL
- WHEN the card renders
- THEN NULL fields display as "—" or "N/A"
- AND the card renders without error

### R2: Sensor Cards Layout

The system MUST display sensor data in cards arranged in a responsive grid (1 col mobile, 2 col tablet, 3 col desktop). Each card MUST show: a header with sensor_id prefix, metric rows with labels and values, and a status indicator based on last_seen freshness.

#### Scenario: Happy path — responsive grid
- GIVEN 6 sensors with data
- WHEN the page renders on desktop (≥1024px)
- THEN 3 cards per row are displayed
- AND each card has consistent height

#### Scenario: Edge case — stale sensor (>30 min)
- GIVEN a sensor's last_seen is >30 minutes ago
- WHEN the card renders
- THEN the card shows a warning icon and "Stale" badge
- AND the card border is highlighted in warning color

### R3: Signal Quality Indicator

The system MUST display `signal_quality` as a visual indicator (bars/dots) with thresholds: excellent (≥80), good (≥60), fair (≥40), poor (<40).

#### Scenario: Happy path — signal quality visual
- GIVEN a sensor has signal_quality=85
- WHEN the card renders
- THEN the signal indicator shows 4 filled bars (excellent)

#### Scenario: Edge case — signal_quality is NULL
- GIVEN a sensor reading has NULL signal_quality
- WHEN the card renders
- THEN the indicator shows "—" or "Unknown"
- AND no chart rendering error occurs

### R4: Expandable Sensor Cards with Sparklines

The system MUST support expand/collapse on sensor cards via click on the card header. When expanded, the card MUST render mini sparkline charts (via Recharts `LineChart`) for each metric (temp, humidity, soil_moisture, rain). Sparkline data MUST come from the existing `hourlyRollup` state array, filtered by sensor_id. Expand/collapse MUST use a smooth CSS transition (~300ms). Only ONE card MAY be expanded at a time (accordion behavior).

#### Scenario: Happy path — expand with sparklines
- GIVEN a sensor card with hourlyRollup data
- WHEN the user clicks the card header
- THEN the card expands with a smooth animation
- AND a mini sparkline chart renders for each metric

#### Scenario: Accordion behavior
- GIVEN card A is expanded
- WHEN the user clicks card B
- THEN card A collapses smoothly
- AND card B expands

#### Scenario: Edge case — no hourlyRollup data
- GIVEN a sensor card with no hourlyRollup data
- WHEN the user expands the card
- THEN the expanded area shows "No data" message — no chart error

### Acceptance Criteria (added by tenant-region-and-search-enhancements)

| ID | Criterion | Pass/Fail |
|----|-----------|-----------|
| AC6 | Clicking sensor card header expands/collapses the card | Pass |
| AC7 | Expanded section shows Recharts sparkline for available metrics | Pass |
| AC8 | Expand/collapse has visible smooth animation (~300ms) | Pass |
| AC9 | Only one card is expanded at a time (accordion) | Pass |
| AC10 | No hourlyRollup shows empty state, not error | Pass |

## Acceptance Criteria

| ID | Criterion | Pass/Fail |
|----|-----------|-----------|
| AC1 | Page loads sensor data in <1s with 10+ sensors | Pass if load time is under 1s measured from navigation start |
| AC2 | Empty sensor_readings table shows empty state, not error | Pass if no crash with empty DB |
| AC3 | Cards display correct latest reading per sensor | Pass if card data matches raw SQL query |
| AC4 | Responsive grid: 1/2/3 columns at breakpoints | Pass if layout adapts correctly |
| AC5 | Stale detection: >30min shows warning badge | Pass if indicator changes at 30min threshold |

## Non-functional Requirements

- **Performance**: Initial load <1s for up to 50 sensors. Polling/refresh every 30s (optional v1)
- **UX**: Skeleton loading state while fetching; error state with retry button
- **Error handling**: API failure shows "Unable to load sensor data" with Retry button
- **Accessibility**: Metric values have `aria-label` descriptions; card headers are focusable

## Validation Rules

| Metric | Range | Display |
|--------|-------|---------|
| temp | -50 to 100 °C | Rounded to 1 decimal |
| humidity | 0 to 100% | Rounded to 1 decimal |
| soil_moisture | 0 to 100% | Rounded to 1 decimal |
| rain | ≥0 mm | Rounded to 1 decimal |
| signal_quality | 0 to 100 | Visual indicator (bars/dots) |
| last_seen | ISO 8601 | Relative time ("2 min ago", "1h ago") |
