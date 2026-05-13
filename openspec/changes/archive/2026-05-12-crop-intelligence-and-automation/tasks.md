# Tasks: Crop Intelligence & Automation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,200–1,500 (total) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 + PR 4 (parallel) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Crop Profiles (JSON + API) + Forecast endpoint + ML training | PR 1 | base: main. Independent foundation. |
| 2 | Recommendation lifecycle + Forecast integration + Alert bridge | PR 2 | base: main. Depends on PR 1 (crop profiles + forecast endpoint). |
| 3 | Daily APScheduler + Migration 008 | PR 3 | base: main. Depends on PR 2 (lifecycle fields + prediction infra). |
| 4 | Dashboard UI: recommendation cards + yield card + field page | PR 4 | base: main. Depends on PRs 1+2 (API contracts). Can run parallel to PR 3. |

## Dependency Graph

```
PR 1 (Foundation) ──→ PR 2 (Core Recs) ──→ PR 3 (Scheduler)
                                          └── PR 4 (Frontend)  ← parallel, independent of PR 3
```

PR 1 blocks PR 2 (needs crop profiles + forecast endpoint). PR 2 blocks PR 3 (needs lifecycle columns). PR 4 needs PR 1 + PR 2 contracts but NOT PR 3.

## PR 1: Foundation — Crop Profiles + Forecast + Models

- [x] 1.1 Create `backend/app/domain/crop_profiles/__init__.py` — package init
- [x] 1.2 Create `backend/app/domain/crop_profiles/schemas.py` — `CropProfile`, `PestProfile` Pydantic models (R1 spec)
- [x] 1.3 Create `backend/app/domain/crop_profiles/service.py` — `CropProfileLoader` class: JSON load, cache, Pydantic validate, fallback on malformed (R2 spec)
- [x] 1.4 Create `backend/app/data/crop_profiles.json` — 20-30 tropical crops with FAO-56 Kc, fertilizer, pest, GDD params (R1 spec; ship v1 with 15-18, expand iteratively)
- [x] 1.5 Create `backend/app/domain/crop_profiles/router.py` — `GET /api/v1/crop-profiles` listing (R4 spec)
- [x] 1.6 Expand `ALLOWED_CROP_TYPES` to 20-30 in fields schemas (delta: crop-types R3)
- [x] 1.7 Add `GET /api/v1/weather/forecast/daily` with lat/lng/days + Hargreaves-Samani ET₀ + 60min cache (delta: weather-data R4, R5)
- [x] 1.8 Expand `ml/pipelines/train.py` `CROP_TYPES` to 10+ and re-run; commit `yield_model_rf.joblib`
- [x] 1.9 Update `backend/app/seed.py` — add field seed entries for new crop types
- [x] 1.10 Unit tests: CropProfile schema validation, loader edge cases (malformed JSON, missing field), forecast endpoint happy/error paths
- [x] 1.11 Integration test: `GET /api/v1/crop-profiles` returns ≥20 entries

## PR 2: Core — Recommendation Lifecycle + Forecast Integration

- [ ] 2.1 Create `backend/alembic/versions/007_add_recommendation_lifecycle.py` — add status, severity, title, acknowledged_at, dismissed_at to recommendations (R1 lifecycle spec)
- [ ] 2.2 Modify `backend/app/domain/recommendations/schemas.py` — add `RecommendationStatus` enum, lifecycle request/response schemas
- [ ] 2.3 Modify `backend/app/domain/recommendations/router.py` — add `PATCH /api/v1/recommendations/{id}/status` with 200/404/409 transitions (R2 lifecycle spec)
- [ ] 2.4 Modify `backend/app/domain/recommendations/service.py` — replace hardcoded Kc/fertilizer dicts with `CropProfileLoader` dynamic lookup; fallback to defaults if profile missing (delta: crop-types R5)
- [ ] 2.5 Add forecast rain gate to irrigation logic: compare 3d precipitation sum vs ETc; skip if ≥ETc at ≥80% confidence; attach forecast metadata to payload (R2, R3 forecast spec)
- [ ] 2.6 Add alert bridge: when recommendation severity is `high`|`critical`, call `AlertService.create_event()` (delta: alert-rules R4)
- [ ] 2.7 Unit tests: lifecycle transitions (valid/invalid), rain gate (skip/irrigate/low-confidence), profile fallback, alert bridge non-blocking
- [ ] 2.8 Integration test: PATCH returns 200/404/409 as specified

## PR 3: Scheduler — Daily APScheduler + Migration 008

- [x] 3.1 Create `backend/app/core/scheduler.py` — APScheduler config, daily 06:00 cron, graceful shutdown (R1, R4 scheduler spec)
- [x] 3.2 Create `backend/alembic/versions/008_add_prediction_metadata.py` — add data_quality, features_used to predictions
- [x] 3.3 Wire scheduler into `backend/app/main.py` lifespan; add health endpoint `GET /api/v1/system/scheduler/health` (R4 scheduler spec)
- [x] 3.4 Implement daily job: iterate all fields → fetch sensor readings (72h) → fetch forecast → `RecommendationService.get_summary()` → `PredictionService.predict_yield()` → store results; single-field failure must not abort batch (R2, R3 scheduler spec)
- [x] 3.5 Add `apscheduler>=3.10` to `pyproject.toml` dependencies
- [x] 3.6 Unit/integration tests: scheduler starts/stops, batch skips failing fields, health endpoint reports missed status after 25h

## PR 4: Frontend — Dashboard Integration

- [x] 4.1 Modify `web/src/lib/api.ts` — add types for: crop profiles list, recommendation lifecycle (status enum, PATCH body/response), yield prediction with data_quality + features_used
- [x] 4.2 Modify `web/src/lib/hooks.ts` — add `useRecommendations(fieldId)`, `usePrediction(fieldId)` with loading/error states
- [x] 4.3 Create `web/src/components/recommendation-card.tsx` — card with lifecycle action buttons (Acknowledge/Apply/Dismiss), optimistic update, error reversion, dismiss confirmation dialog (R3 lifecycle spec)
- [x] 4.4 Create `web/src/components/yield-prediction-card.tsx` — predicted yield, confidence interval, trend arrow, data quality badge, history sparkline, features toggle, fallback label (R1, R2, R3 yield spec)
- [x] 4.5 Modify `web/src/app/dashboard/fields/[id]/page.tsx` — replace placeholder with live recommendations list + yield prediction card; show loading skeleton, handle error states, retry button
- [x] 4.6 Playwright E2E tests in `web/tests/recommendations.spec.ts`: field detail page shows recs, acknowledge rec updates badge, prediction card renders without blocking

## Implementation Order

1. **PR 1** (Foundation) first — establishes crop profiles, forecast endpoint, and ML models that everything else depends on.
2. **PR 2** (Core Recommendations) second — adds lifecycle and forecast-aware recs. Needs crop profiles and forecast endpoint from PR 1.
3. **PR 3** (Scheduler) + **PR 4** (Frontend) — can be done in parallel. PR 3 needs lifecycle columns from PR 2. PR 4 needs API contracts from PRs 1+2 but not the scheduler.
