# Apply Progress: Crop Intelligence & Automation — PR 1 + PR 3 + PR 4

## Implementation Summary

**Change**: Crop Intelligence & Automation
**Batch**: PR 1 (Foundation) + PR 3 (Scheduler) + PR 4 (Frontend Dashboard)
**Mode**: Standard
**Delivery**: stacked-to-main
**Work unit**: PR 4 — Frontend API types, hooks, components, and E2E tests

---

## Completed Tasks

| # | Task | Status | Details |
|---|------|--------|---------|
| **PR 1** | | | |
| 1.1 | `backend/app/domain/crop_profiles/__init__.py` | ✅ | Package init |
| 1.2 | `backend/app/domain/crop_profiles/schemas.py` | ✅ | `CropProfile`, `PestProfile`, `CropProfileList` Pydantic models |
| 1.3 | `backend/app/domain/crop_profiles/service.py` | ✅ | `CropProfileLoader`: JSON load, Pydantic validate, in-memory cache, fallback on malformed, reload() |
| 1.4 | `backend/app/data/crop_profiles.json` | ✅ | 18 tropical crops with FAO-56 Kc, fertilizer, pest, GDD params |
| 1.5 | `backend/app/domain/crop_profiles/router.py` | ✅ | `GET /api/v1/crop-profiles` listing with farmer+ auth |
| 1.6 | `backend/app/domain/fields/schemas.py` | ✅ | `ALLOWED_CROP_TYPES` expanded from 10 → 18 |
| 1.7 | `backend/app/domain/weather/` | ✅ | `GET /api/v1/weather/forecast/daily` with Hargreaves-Samani ET₀ + 60min cache |
| 1.8 | `ml/pipelines/train.py` + model | ✅ | `CROP_TYPES` expanded 4 → 12, re-trained (R²=0.9845), saved `yield_model_rf.joblib` |
| 1.9 | `backend/app/seed.py` | ✅ | Added 8 new seed fields, sensor configs, and alert rules for new crop types |
| 1.10 | `backend/tests/test_crop_profiles.py` | ✅ | 38 unit tests: schema validation, loader edge cases, Hargreaves ET₀, forecast endpoint |
| 1.11 | Integration test (in test_crop_profiles.py) | ✅ | `GET /api/v1/crop-profiles` returns ≥18 entries with expected fields |
| **PR 3** | | | |
| 3.1 | `backend/app/core/scheduler.py` | ✅ | `SchedulerManager` with `AsyncIOScheduler`, daily 06:00 cron, graceful shutdown, health tracking |
| 3.2 | `backend/alembic/versions/008_add_prediction_metadata.py` | ✅ | Adds `data_quality` (VARCHAR(20)) and `features_used` (JSON) to predictions table |
| 3.3 | Wire scheduler into main.py + health endpoint | ✅ | `scheduler_manager.start()`/`shutdown()` in lifespan; `GET /api/v1/system/scheduler/health` returns health dict |
| 3.4 | Daily job implementation | ✅ | `_run_daily_job()`: iterate all active fields → sensor readings (72h) → forecast → `get_summary()` → `predict_yield()` → store results; single-field failure caught, logged, batch continues |
| 3.5 | `apscheduler>=3.10` dependency | ✅ | Added to `backend/requirements.txt` |
| 3.6 | Unit/integration tests | ✅ | 31 tests: lifecycle (start/shutdown/health), is_missed threshold, batch processing, field failure isolation, health endpoint |
| **PR 4** | | | |
| 4.1 | `web/src/lib/api.ts` | ✅ | Added types: `CropProfileResponse/List`, `RecommendationStatus` enum, `RecommendationStatusUpdate/Response`, `IrrigationRecommendation`, `FertilizationRecommendation`, `PestRiskAlert`, `RecommendationSummary`, `YieldPredictionResponse`, `PredictionHistoryEntry/Response`; API functions: `getCropProfiles`, `getRecommendationSummary`, `updateRecommendationStatus`, `getYieldPrediction`, `getPredictionHistory` |
| 4.2 | `web/src/lib/hooks.ts` | ✅ | Added `useRecommendations(fieldId)` and `usePrediction(fieldId)` hooks with loading/error states and `refresh` callback, matching existing hook patterns |
| 4.3 | `web/src/components/recommendation-card.tsx` | ✅ | Created with lifecycle action buttons (Acknowledge → Applied → terminal), Dismiss with confirmation dialog, optimistic update with error reversion (4s auto-dismiss of error toasts), severity badges (info/low/medium/high/critical), type icons (Droplets/Sprout/Bug), lifecycle status badges with icons, disabled terminal state styling |
| 4.4 | `web/src/components/yield-prediction-card.tsx` | ✅ | Created with predicted yield display (auto formats t/ha vs kg/ha), 95% confidence interval, visual confidence bar, data quality badge (High/Medium/Low/Insufficient with colors), trend arrow (up/down/stable from GDD analysis), season progress sparkline (recharts LineChart), features_used toggle panel, fallback labels (R2 statistical GDD, R3 crop average), model version and timestamp footer; loading skeleton, error state with retry, null/empty state |
| 4.5 | `web/src/app/dashboard/fields/[id]/page.tsx` | ✅ | Replaced "TODO" placeholder with live Recommendations section (irrigation + fertilization + pest risk cards from `RecommendationSummary`), Yield Forecast section (`YieldPredictionCard`), loading skeletons per section, error states with retry per section (does not block sensor data), per-type lifecycle state tracking |
| 4.6 | `web/tests/recommendations.spec.ts` | ✅ | 12 Playwright E2E tests across 4 describe blocks: Page Structure (3 tests — headings, sections), Recommendation Cards Rendering (5 tests — data rendering, severity badges, empty state, error state, loading skeleton), Yield Prediction Card (3 tests — data rendering, fallback labels, non-blocking load), Recommendation Actions (3 tests — acknowledge button, dismiss dialog lifecycle, optimistic update); uses route interception for mock data |

---

## Files Changed (PR 4 only)

| File | Action | What Was Done |
|------|--------|---------------|
| `web/src/lib/api.ts` | **Modified** | Added 15+ type definitions and 5 API functions for crop profiles, recommendation lifecycle, and yield predictions |
| `web/src/lib/hooks.ts` | **Modified** | Added `useRecommendations()` and `usePrediction()` hooks with loading/error/refresh pattern matching existing hooks |
| `web/src/components/recommendation-card.tsx` | **Created** | Full recommendation card with lifecycle actions, optimistic updates, severity badges, dismiss confirmation dialog |
| `web/src/components/yield-prediction-card.tsx` | **Created** | Full yield prediction card with CI, sparkline, data quality badge, fallback labels, features toggle |
| `web/src/app/dashboard/fields/[id]/page.tsx` | **Modified** | Replaced recommendations placeholder with live data, added yield forecast section, per-section loading/error states |
| `web/tests/recommendations.spec.ts` | **Created** | 12 Playwright E2E tests covering recommendations and yield prediction UI |
| `openspec/changes/crop-intelligence-and-automation/tasks.md` | **Modified** | Marked all 6 PR 4 tasks as complete |

---

## Deviations from Design

1. **APScheduler dependency**: Design mentions `pyproject.toml` but the project uses `requirements.txt`. Added `apscheduler>=3.10,<4.0` to `backend/requirements.txt`.
2. **Health endpoint location**: Design mentions modifying `GET /health`, but implementation uses a separate dedicated endpoint `GET /api/v1/system/scheduler/health`.
3. **data_quality assessment**: Uses `VARCHAR(20)` rather than an enum column type.
4. **Recommendations endpoint path**: Tasks doc references `GET /api/v1/recommendations/summary?field_id=X` but actual backend endpoint is `GET /api/v1/fields/{field_id}/recommendations` returning `RecommendationSummary`. Frontend calls the actual endpoint.
5. **Webhook/recId integration**: The PATCH lifecycle endpoint requires stored recommendation IDs from the DB. The recommendation summary generates fresh recommendations (no stored IDs). The recommendation-card accepts optional `recId` — when absent, lifecycle is client-side optimistic only. Full lifecycle-backend integration requires a list-stored-recommendations endpoint in a future change.

---

## Issues Found

- **No list endpoint for stored recommendations**: The PATCH `/api/v1/recommendations/{id}/status` endpoint requires an ID from a stored `Recommendation` record. There is no `GET /api/v1/recommendations` or `GET /api/v1/fields/{id}/recommendations/list` endpoint to fetch stored recommendations. The only summary endpoint generates fresh real-time recommendations. Lifecycle actions on the frontend work optimistically (client-side state) until a list endpoint is available.

---

## Workload / PR Boundary

- **Mode**: stacked-to-main slice (PR 4)
- **Boundary**: PR 4 only — Frontend Dashboard types, hooks, components, field detail page, E2E tests
- **Review budget impact**: ~770 lines (components: ~400, api.ts: ~130, hooks.ts: ~70, page.tsx: ~40 diff, tests: ~200)
- **Ready for**: Verify phase

---

## Status

**23/23 tasks complete** (11 from PR 1, 6 from PR 3, 6 from PR 4). Ready for verify phase.
