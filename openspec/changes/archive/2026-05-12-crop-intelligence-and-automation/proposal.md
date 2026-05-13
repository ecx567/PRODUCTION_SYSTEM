# Proposal: Crop Intelligence & Automation

## Intent

Replace placeholder recommendation UI with a live precision-agriculture system: 20-30 crop profiles with full agronomic params, weather-forecast-aware recommendations, yield prediction cards, and a daily scheduler for batch runs.

## Scope

### In Scope
- `crop_profiles.json` with 20-30 crops (FAO-56 Kc, fertilizer, pests, GDD)
- Forecast integration → proactive irrigation recommendations
- Recommendation lifecycle: acknowledge / dismiss / apply (API + UI)
- Yield prediction card + history on field detail page
- Daily APScheduler for batch recs + predictions (6AM)
- Train ML models (run existing `train.py` on 10+ crops)
- Bridge: high-severity recs → alert events

### Out of Scope
- ONNX/MLflow model deployment
- Real-data ML retraining (needs harvest cycle)
- Mobile app recommendation screens
- Admin CRUD UI for crop_profiles (v2)
- Multi-tenant rec segmentation

## Capabilities

### New Capabilities
- `crop-profiles`: Centralized 20-30 crop parameter management (JSON)
- `recommendations-lifecycle`: Acknowledge/dismiss/apply workflow
- `yield-predictions`: Frontend yield forecast card + history
- `scheduler`: Daily 6AM batch recommendations + predictions
- `forecast-integration`: Open-Meteo → irrigation recommendation engine

### Modified Capabilities
- `crop-types`: Expand ALLOWED_CROP_TYPES to 20-30
- `weather-data`: Add `/api/v1/weather/forecast/daily` with ET₀
- `alert-rules`: Auto-create alert event from high-severity rec

## Approach

| Track | Decision |
|-------|----------|
| Crop profiles | JSON file (`data/crop_profiles.json`) — versionable, no migration |
| Recommendations | Refactor service to read profiles dynamically. Forecast: skip irrigation if rain ≥ ETc next 3d (≥80% confidence) |
| Lifecycle | `PATCH /api/v1/recommendations/{id}/status` → status enum: active → acknowledged/applied/dismissed |
| Predictions | Train `train.py`. Add `usePrediction()` hook + card on `fields/[id]/page.tsx` |
| Scheduler | FastAPI lifespan task + APScheduler. Daily at 6AM: recs + predictions for all fields |
| Alert bridge | `severity=high|critical` → `AlertService.create_event()` |

## Architecture Changes

| Area | Change |
|------|--------|
| `backend/app/data/crop_profiles.json` | **NEW** — 20-30 crops with full params |
| `backend/app/domain/crop_profiles/` | **NEW** — loader + schemas |
| `backend/app/domain/recommendations/service.py` | **MODIFY** — dynamic profiles + forecast |
| `backend/app/domain/recommendations/router.py` | **MODIFY** — lifecycle endpoints |
| `backend/app/core/scheduler.py` | **NEW** — daily background runs |
| `backend/app/seed.py` | **MODIFY** — expand crops |
| `ml/pipelines/train.py` | **MODIFY** — 10+ crops |
| `web/src/lib/api.ts` | **MODIFY** — rec + prediction types |
| `web/src/lib/hooks.ts` | **MODIFY** — `useRecommendations()`, `usePrediction()` |
| `web/src/app/dashboard/fields/[id]/page.tsx` | **MODIFY** — live content |

## Data Model Changes

**Migration 007** (recommendations):
`status VARCHAR(20) DEFAULT 'active'` | `dismissed_at TIMESTAMPTZ` | `severity VARCHAR(20) DEFAULT 'info'` | `title VARCHAR(255) DEFAULT ''`

**Migration 008** (predictions):
`data_quality VARCHAR(20) DEFAULT 'medium'` | `features_used JSONB DEFAULT '[]'`

## Dependencies

| Package | Reason |
|---------|--------|
| `apscheduler>=3.10` | Daily scheduling (lighter than Celery) |

## Risks

| Risk | L | Mitigation |
|------|---|------------|
| Crop data research slow for 20-30 tropical crops | H | Ship v1 with 15-18; add rest iteratively |
| ML with synthetic data overfits | M | Gate at R² ≥ 0.75; retrain post-harvest |
| Scheduler fails silently | M | Health check endpoint + alert on missed runs |
| Forecast rain false positive | L | 80% confidence gate; always water if uncertain |

## Rollback Plan

1. Revert migrations 007 + 008
2. Remove `apscheduler` from pyproject.toml
3. Delete/revert `crop_profiles.json` to empty
4. Restore placeholder text on field detail page
5. Revert ALLOWED_CROP_TYPES to 10 entries

## Success Criteria

- [ ] All 20-30 crops load from `crop_profiles.json` without error
- [ ] Recommendations use forecast data (irrigation ↓ when rain ≥ ETc)
- [ ] User can acknowledge/dismiss/apply recs from dashboard
- [ ] Yield prediction card renders with confidence interval + trend
- [ ] Daily scheduler generates recs + predictions for all fields
- [ ] High-severity recs appear as alert events
- [ ] ML models train with R² ≥ 0.75 on 10+ crops
