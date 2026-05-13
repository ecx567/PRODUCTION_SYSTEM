# Design: Crop Intelligence & Automation

## Technical Approach

Five independent-but-integrated capabilities layered on existing architecture: crop profiles as versioned JSON (no migration), recommendation lifecycle via DB migration + PATCH endpoint, forecast integration through Open-Meteo's existing ET₀/precipitation, yield predictions extending current ML pipeline, and APScheduler for daily batch runs. Follows existing domain structure (router/schemas/service per domain).

## Architecture Decisions

### Crop Profiles — JSON vs DB table
**Choice**: JSON file (`data/crop_profiles.json`) with Pydantic validation
**Alternatives**: DB table, hardcoded dicts
**Rationale**: Zero-migration, version-controllable, trivially hot-reloadable. Current hardcoded dicts in service.py are the same pattern — we just externalize them. 20-30 crops won't exceed practical JSON size.

### Recommendation Lifecycle — new columns vs separate table
**Choice**: Add columns to existing `recommendations` table (migration 007)
**Alternatives**: New `rec_status` table, enum field
**Rationale**: Simpler queries, no joins, matches existing pattern (alert_events has `acknowledged_at` same way). Status enum: `active`, `acknowledged`, `dismissed`, `applied`.

### Forecast Integration — server-side vs client-side
**Choice**: Server-side in RecommendationService
**Alternatives**: Frontend filters forecast and sends flag
**Rationale**: Single source of truth. The service already knows field location. WeatherService.get_forecast already exists — just inject it.

### APScheduler vs Celery vs cron
**Choice**: APScheduler in FastAPI lifespan
**Alternatives**: Celery (heavy), system cron (ops burden), asyncio loop
**Rationale**: Lightweight, in-process, async-native. Single-process dev/prod. Health check trivially reports last run timestamp.

## Data Flow

### Forecast → Irrigation
```
WeatherService.get_forecast(lat, lon, 3d)
  → precipitation_sum[], et0[]
  → compare rain_sum vs ETc
  → if rain >= ETc AND confidence >= 0.8: skip irrigation
  → else: proceed with FAO-56 as-is
```

### Daily Scheduler
```
APScheduler (6:00 UTC daily)
  → for each tenant's fields:
      → fetch sensor readings (last 72h)
      → fetch forecast (lat/lon from field)
      → RecommendationService.get_summary()
      → PredictionService.predict_yield()
      → INSERT into recommendations + predictions tables
      → if severity in (high, critical): NotificationService.create_event()
```

### Recommendation Lifecycle
```
Dashboard PATCH /api/v1/recommendations/{id}/status
  { status: "acknowledged" | "dismissed" | "applied" }
  → UPDATE status + status_changed_at
  → return updated row
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/app/data/crop_profiles.json` | Create | 20-30 crops with Kc, fertilizer, pest, GDD params |
| `backend/app/domain/crop_profiles/__init__.py` | Create | Package init |
| `backend/app/domain/crop_profiles/schemas.py` | Create | Pydantic models for crop profile |
| `backend/app/domain/crop_profiles/service.py` | Create | Loader + validator + lookup helpers |
| `backend/app/domain/crop_profiles/router.py` | Create | `GET /api/v1/crop-profiles` listing, `POST /api/v1/crop-profiles/expand` |
| `backend/app/domain/recommendations/service.py` | Modify | Replace hardcoded dicts with crop_profiles.json loader; inject forecast check |
| `backend/app/domain/recommendations/schemas.py` | Modify | Add RecommendationStatus, RecommendationLifecycle schemas |
| `backend/app/domain/recommendations/router.py` | Modify | Add PATCH /recommendations/{id}/status |
| `backend/app/core/scheduler.py` | Create | APScheduler config, daily job, health check |
| `backend/app/main.py` | Modify | Import scheduler into lifespan |
| `backend/app/seed.py` | Modify | Expand SEED_FIELDS if needed, keep 10 as-is |
| `backend/alembic/versions/007_add_recommendation_lifecycle.py` | Create | Add status, severity, title, dismissed_at to recommendations |
| `backend/alembic/versions/008_add_prediction_metadata.py` | Create | Add data_quality, features_used to predictions |
| `ml/pipelines/train.py` | Modify | Expand CROP_TYPES to 10+, update BASE_YIELDS, re-run |
| `ml/models/yield_model_rf.joblib` | Run | Output of train.py after expansion |
| `web/src/lib/api.ts` | Modify | Add recommendation lifecycle + crop profile + prediction types |
| `web/src/lib/hooks.ts` | Modify | Add useRecommendations(), usePrediction() hooks |
| `web/src/components/recommendation-card.tsx` | Create | Single recommendation card with lifecycle buttons |
| `web/src/app/dashboard/fields/[id]/page.tsx` | Modify | Replace placeholder with live recommendations + yield card |

## Interfaces / Contracts

### CropProfile schema
```python
class CropProfile(BaseModel):
    name: str
    kc_initial: float; kc_mid: float; kc_end: float
    stage_lengths: list[int]  # [ini, dev, mid, late]
    fertilizer_rates: dict[str, dict[str, float]]  # stage -> {n,p,k}
    pests: list[PestProfile]
    taw_default: float  # mm/m
    gdd_base_temp: float
```

### API Changes
| Method | Path | Change |
|--------|------|--------|
| GET | `/api/v1/crop-profiles` | New — list all profiles |
| POST | `/api/v1/crop-profiles/expand` | New — add crop type to ALLOWED_CROP_TYPES |
| PATCH | `/api/v1/recommendations/{id}/status` | New — lifecycle transition |
| GET | `/api/v1/fields/{id}/predictions/yield` | Modify — add data_quality + features_used |
| GET | `/health` | Modify — add scheduler status |

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | CropProfile schema validation | Pydantic model_validate tests |
| Unit | Forecast skip-irrigation logic | Mock WeatherService, assert recommendation="skip" when rain ≥ ETc |
| Unit | Recommendation lifecycle transitions | PATCH handler, assert 200/404/409 |
| Integration | Scheduler daily run | Trigger job manually, assert recs+predictions inserted |
| E2E | Field detail page shows recs | Playwright — wait for rec card to render |
| E2E | Acknowledge rec from UI | Click acknowledge, assert status badge changes |

## Migration / Rollout

- **Migration 007**: Add columns with defaults (no backward compat issues)
- **Migration 008**: Same pattern
- **crop_profiles.json**: Atomic file write — version-controllable
- **APScheduler**: Starts automatically with lifespan — if health check fails, no recs generated (fail-safe: field detail still shows past recs)
- **ML model**: Train offline, ship as joblib. If R² < 0.75 gate, API falls back to GDD model

## Open Questions

- [ ] Should crop profile GET endpoint be public or require auth? Follow field pattern: farmer+
- [ ] APScheduler single-process: what if we horizontally scale to >1 API instance? Use Redis lock or disable scheduler on workers.
- [ ] ML model retraining schedule: manual trigger vs scheduled (e.g., monthly)?
