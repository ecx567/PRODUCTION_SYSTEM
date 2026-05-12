# Tasks: Dashboard Enhancement & Crop Expansion

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,500–1,700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Crop) → PR 2 (Open-Meteo) → PR 3 (Alerts) → PR 4 (Devices) → PR 5 (Analytics) → PR 6 (Settings) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Branch |
|------|------|-----------|--------|
| 1 | Crop Expansion | PR 1 | main |
| 2 | Open-Meteo Weather | PR 2 | main |
| 3 | Alert Rules CRUD | PR 3 | main |
| 4 | Devices Page | PR 4 | main |
| 5 | Analytics Page | PR 5 | main |
| 6 | Settings Page | PR 6 | main |

## Phase 1: Backend Foundation

- [x] 1.1 Create `alembic/versions/006_crop_type_string.py` — `ALTER COLUMN crop_type TYPE VARCHAR(50) USING crop_type::text`
- [x] 1.2 Modify `fields/models.py` — replace `Enum(...)` with `mapped_column(String(50))`
- [x] 1.3 Modify `fields/schemas.py` — add coffee, sugarcane, soybean, sunflower, palm_oil, cotton to `ALLOWED_CROP_TYPES`
- [x] 1.4 Modify `seed.py` — add 6 new crop fields + sensor ranges + alert rules
- [x] 1.5 Create `domain/weather/` — `service.py` (httpx client + cache), `schemas.py`, `router.py`, `__init__.py`
- [x] 1.6 Modify `main.py` — import + mount weather router
- [x] 1.7 Modify `requirements.txt` — promote httpx to production section

## Phase 2: Frontend API Layer

- [x] 2.1 (part: Alerts) Modify `lib/api.ts` — add `createRule()`, `updateRule()`, `deleteRule()`, `getRules()`
- [x] 2.1 (part: Weather) Modify `lib/api.ts` — add `getCurrentWeather()`, `getWeatherForecast()`, `getSensorGaps()`

## Phase 3: Frontend Pages

- [x] 3.1 Create `components/rules/rule-form-modal.tsx` — shared create/edit form with client validation
- [x] 3.2 Create `components/rules/delete-dialog.tsx` — confirmation dialog
- [x] 3.3 Modify `dashboard/rules/page.tsx` — wire modal CRUD, auto-refresh list after each operation
- [x] 3.4 Create `components/devices/sensor-card.tsx` — metric card with value/unit/last-seen/stale badge
- [x] 3.5 Rewrite `dashboard/devices/page.tsx` — live sensor grid, aggregate across all fields, 30s polling
- [x] 3.6 Create `components/analytics/summary-cards.tsx` — 4 KPI gauge cards (temp/humidity/moisture/rain)
- [x] 3.7 Create `components/analytics/temp-chart.tsx` — Recharts LineChart for temperature over time
- [x] 3.8 Create `components/analytics/humidity-chart.tsx` — Recharts AreaChart for humidity over time
- [x] 3.9 Create `components/analytics/precip-chart.tsx` — Recharts BarChart for rainfall over time
- [x] 3.10 Rewrite `dashboard/analytics/page.tsx` — field selector + time range + chart grid + gap table
- [x] 3.11 Create `lib/settings.ts` — `loadSettings()`, `saveSettings()`, defaults for localStorage
- [x] 3.12 Create `components/settings/profile-section.tsx` — display name/email/role from JWT
- [x] 3.13 Create `components/settings/notifications-section.tsx` — toggle switches
- [x] 3.14 Create `components/settings/display-section.tsx` — theme/timezone/units selectors
- [x] 3.15 Create `components/settings/api-keys-section.tsx` — read-only mock key table
- [x] 3.16 Rewrite `dashboard/settings/page.tsx` — tabbed sections, localStorage persistence

## Phase 4: Testing

- [x] 4.1 pytest: `test_crop_schema.py` — validate `validate_crop_type` with new/old/invalid values
- [x] 4.2 pytest: `test_weather.py` — mock httpx, test parsing + cache hit/miss + Open-Meteo down
- [x] 4.3 pytest: migration test — alembic upgrade + downgrade with seed data preserved
- [x] 4.4 Playwright: alert CRUD flow — create rule → list → edit → delete
- [x] 4.5 Playwright: devices page — mock sensors → assert card grid renders correctly
- [x] 4.6 Playwright: analytics page — mock hourly data → assert Recharts renders without error
- [x] 4.7 Playwright: settings page — fill fields → reload → assert persisted values
