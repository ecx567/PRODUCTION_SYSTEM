# Exploration: Crop Intelligence & Automation

## Executive Summary

The production system already has a **surprisingly mature foundation** for this change: a FAO-56 recommendation engine (irrigation, split-N fertilization, pest degree-day models), an ML yield prediction pipeline (Random Forest + XGBoost), and a 10-crop model already migrated from Enum to String. The missing pieces are: (1) expanding crop parameters from 4→20+ with real agronomic data, (2) integrating the forecast weather data (Open-Meteo already connected) into recommendations, (3) wiring the prediction API into dashboard UX, and (4) adding acknowledge/dismiss/apply workflows for recommendations. Crop profile expansion to 20-30 tropical crops is the heaviest lift — each crop needs FAO-56 Kc values, fertilizer rates, pest thresholds, and growth stage data.

---

## Current State

### What exists already (significant head start)

| Area | Status | Detail |
|------|--------|--------|
| **Crop types** | ✅ 10 crops in String(50) | Migration 006 already done. `ALLOWED_CROP_TYPES` has 10. |
| **Seed data** | ✅ All 10 crops | `seed.py` has fields, sensor ranges, and alert rules for all 10. |
| **Recommendations engine** | ✅ Full service layer | FAO-56 irrigation, split-N fertilization, pest GDD models. |
| **Recommendations API** | ✅ 4 endpoints | `GET /api/v1/fields/{id}/recommendations` + irrigation/fertilization/pest-risk. |
| **Recommendations DB** | ✅ `recommendations` table | JSONB payload + `applied_at` field. |
| **Open-Meteo weather** | ✅ Service + API | `GET /api/v1/weather/current`, `GET /api/v1/weather/forecast` with Redis cache. |
| **ML pipeline** | ✅ `train.py` exists | Random Forest + XGBoost training with synthetic data. R² ≥ 0.75 gate. |
| **Predictions API** | ✅ 2 endpoints | `GET /api/v1/fields/{id}/predictions/yield` and `/history`. |
| **Predictions DB** | ✅ `predictions` table | value, lower_bound, upper_bound, model_version. |
| **Prediction service** | ✅ Fallback + ML modes | GDD-based fallback when model not available. Data quality scoring. |
| **Alerts system** | ✅ AlertEvents + acknowledge | `acknowledged_at` column. SSE real-time streaming. |

### What's missing

| Area | Gap |
|------|-----|
| **Crop parameters** | Only 4 crops have FAO-56 Kc values, fertilizer rates, and pest thresholds. 6 other crops lack recommendations data. 10-20 more needed. |
| **Structured crop profiles** | No `crop_profiles` table or centralized data structure. Parameters hardcoded in 3 places (seed.py, recommendations/service.py, predictions.py). |
| **Weather → recommendations** | Recommendations only use sensor readings, not Open-Meteo forecast data. Forecast integration would make irrigation proactive. |
| **Recommendation lifecycle** | No acknowledge/dismiss/apply workflow in dashboard. DB has `applied_at` but no UI. |
| **ML models** | `ml/models/` directory is empty. `train.py` needs to run + migrate from synthetic to real data. |
| **Predictions frontend** | No `YieldPrediction` types in `api.ts`, no hooks, no dashboard pages for yield forecasts. |
| **Dashboard integration** | Field detail page shows "Recommendations will appear here once the ML engine is active" — a placeholder. |
| **Scheduled tasks** | No Celery/APScheduler/recurring task for daily recommendation or prediction generation. |
| **Model serving** | Only joblib pickle. No ONNX, MLflow, or standardized model registry. |

---

## Affected Areas

### Backend

```
backend/app/domain/recommendations/service.py  — 4-crop hardcoded constants → dynamic crop_profiles
backend/app/domain/recommendations/schemas.py  — Maybe add lifecycle fields (acknowledged, applied) 
backend/app/domain/recommendations/router.py   — Maybe add acknowledge/dismiss endpoints
backend/app/domain/analytics/predictions.py    — Predictions service, need 10-crop fallback yields
backend/app/domain/analytics/router_predictions.py  — Already serves predictions
backend/app/domain/weather/service.py          — Already serves forecast data
backend/app/domain/fields/schemas.py           — ALLOWED_CROP_TYPES expansion to 20-30
backend/app/domain/fields/models.py            — crop_type String(50) already
backend/app/seed.py                            — Add more crop fields + sensor ranges
backend/app/main.py                            — Maybe add scheduler
ml/pipelines/train.py                          — Expand beyond 4 synthetic crops
ml/models/                                     — Will hold trained models
```

### Frontend

```
web/src/lib/api.ts        — Missing recommendation + prediction types
web/src/lib/hooks.ts       — Missing useRecommendations(), usePredictions() hooks
web/src/app/dashboard/fields/[id]/page.tsx — Has placeholder section
web/src/app/dashboard/    — Maybe new predictions page
```

### New Files Needed

```
backend/app/domain/crop_profiles/     — New module for crop parameter management
backend/app/core/scheduler.py         — Daily recommendation/prediction scheduler
ml/pipelines/train_real.py            — Training with real historical data
```

---

## Findings per Track

### Track 1: Crop Expansion Research (10 → 20-30+)

**Finding 1.1: The 10→20 expansion is easier than expected**
The `crop_type` String(50) migration is already done. Expanding `ALLOWED_CROP_TYPES` is a one-line change. The real work is populating agronomic parameters.

**Finding 1.2: Three data layers need parameters**

| Layer | What | Current Coverage |
|-------|------|-----------------|
| **Seed data** | Sensor ranges, alert rules | ✅ All 10 crops |
| **FAO-56 coefficients** | Kc values, growth stage lengths | ❌ Only 4 of 10 |
| **Fertilizer rates** | NPK per growth stage | ❌ Only 4 of 10 |
| **Pest thresholds** | GDD, temp, humidity for pests | ❌ Only 4 of 10 |
| **Base yield** | Expected yield kg/ha | ❌ Only 4 in ML fallback |

**Finding 1.3: Best data structure — database table**

Hardcoding in Python works for small sets but with 20-30+ crops it becomes unmaintainable. A `crop_profiles` table or JSON configuration file is better.

**Finding 1.4: NotebookLM can help generate structured data**
The NotebookLM notebook (3bf8ba7b-fe5a-4958-951c-37ea6002c189) could be used to research crop parameters, but it returned HTTP 500 when queried. Alternative: FAO Crop Database, USDA PLANTS, or published research.

**Finding 1.5: 20-30 crops for tropical/subtropical**
Current 10 + candidates for expansion:
- **Fruits**: pineapple, papaya, mango, avocado, citrus (orange/lemon)
- **Vegetables**: tomato, chili pepper, onion, cassava, sweet potato
- **Commodities**: peanut, sorghum, millet, sesame, cassava
- **Tree crops**: rubber, coconut, cashew, macadamia
- **Spices**: vanilla, ginger, turmeric, black pepper

**Finding 1.6: Public APIs/datasets**
- FAO FAOSTAT — crop production data, but not per-parameter
- USDA Agricultural Handbook — crop coefficients (requires manual extraction)
- Open-Meteo doesn't provide crop parameters (weather only)
- Best approach: compile a structured JSON/CSV manually from published FAO-56 tables and agronomic references

### Track 2: Recommendations Engine

**Finding 2.1: Rule-based (expert system) is the right choice**

The recommendation engine is already rule-based with domain knowledge (FAO-56, degree-day models). This is the CORRECT approach for agronomic recommendations because:
- Agronomic rules are well-established and science-based
- Farmers need EXPLAINABLE recommendations ("why should I irrigate?")
- ML would require massive labeled datasets (irrigation decisions with outcomes)
- Confidence scoring already handles uncertainty

**Finding 2.2: Forecast integration is the biggest immediate win**

The Open-Meteo weather service is already connected but the recommendation engine only uses sensor data. Integrating forecast data would:
- Make irrigation RECOMMENDATIONS PROACTIVE: "Rain forecast: 0mm next 3 days → Irrigate 25mm tonight"
- Improve confidence scoring with forecast certainty
- Enable recommendations even during sensor gaps

**Finding 2.3: Recommendation lifecycle model**

The `recommendations` table already has `applied_at` (nullable). A full lifecycle would be:
1. **Generated** — engine creates recommendation (current state)
2. **Acknowledged** — user has seen it (use existing `acknowledged_at` pattern from AlertEvents)
3. **Applied** — user marked it as done (`applied_at` already exists)
4. **Dismissed** — user rejected it (new field needed)

**Finding 2.4: Integration with alerts system**

Recommendations with high severity (e.g., critical pest risk, critical soil moisture) should auto-create alert events in the existing alerts system. This gives them visibility in the dashboard's alert banner and SSE streaming.

**Finding 2.5: No dedicated scheduler exists**

Recommendations are computed on-demand (when the endpoint is called). For a production system, a daily scheduler should generate recommendations for all fields and store them in the `recommendations` table.

### Track 3: Yield Prediction & ML Integration

**Finding 3.1: Current ML capabilities**

`ml/pipelines/train.py` trains:
- **Random Forest Regressor** — GridSearchCV (100-200 trees, max_depth 10-20)
- **XGBoost Regressor** — GridSearchCV (optional)
- R² ≥ 0.75 gate for production deployment
- Currently uses SYNTHETIC data only — 16 engineered features

**Finding 3.2: Features used**

```
temp_mean, temp_max, temp_min, humidity_mean, soil_moisture_mean,
rain_total, days_since_planting, area_ha, daily_gdd, gdd_accumulated,
heat_stress_days, cold_stress_days, diurnal_range, moisture_deficit,
water_stress_index, rain_moisture_interaction
+ one-hot encoded crop_type (banana, maize, cacao, rice)
```

**Finding 3.3: Prediction serving — hybrid approach**

Both batch and real-time make sense:
- **Batch (daily)**: Run predictions overnight for all fields → store in DB → dashboard reads from DB
- **Real-time (on-demand)**: When user views a field detail page, compute fresh prediction with latest sensor data

Current implementation is real-time only (computed on API call). The DB stores historical predictions for trend comparison.

**Finding 3.4: Model format — joblib is fine for now**

The project uses `joblib.dump()` / `joblib.load()`. For a single-project deployment this is adequate. ONNX or MLflow would add deployment complexity without clear benefit at this stage.

**Finding 3.5: Prediction visualization on dashboard**

A yield prediction card on the field detail page should show:
- Predicted yield (kg/ha or tons/ha) with trend arrow vs last prediction
- Confidence interval (as a range bar: ████████░░░░ 2.8-5.2 tons)
- Data quality badge (high/medium/low/insufficient)
- Forecast comparison: predicted vs historical average for this crop
- History sparkline: predictions over time as season progresses

**Finding 3.6: Model needs retraining with real data**

The current synthetic data approach creates unrealistic relationships. Once real sensor data + harvest data accumulates, the model should be retrained on the `sensor_readings` table.

---

## Recommended Approach

### Track 1: Crop Profiles (20-30 crops)

| # | Approach | Effort | Why |
|---|----------|--------|-----|
| 1 | **Create `crop_profiles` JSON file** | Medium | Centralized, version-controlled, no migration needed. Ideal for parameters that rarely change. |
| 2 | Database table | Medium-High | Needed if crop profiles need REST API CRUD (admin editing parameters via UI). |

**Recommendation**: Start with a **`crop_profiles.json`** file. It's faster, avoids migrations, and crop parameters don't change frequently. Add a DB-backed API later if needed.

### Track 2: Recommendations Engine

| # | Action | When |
|---|--------|------|
| 1 | Add 6+ missing crops to FAO-56 Kc, fertilizer, pest data | Phase 1 |
| 2 | Integrate Open-Meteo forecast into irrigation recommendation | Phase 1 |
| 3 | Add acknowledge/dismiss/applied lifecycle to recommendations | Phase 2 |
| 4 | Connect high-severity recommendations to alert events | Phase 2 |
| 5 | Add daily scheduler for batch recommendation generation | Phase 2 |

**Recommendation**: Rule-based expert system is correct. Focus on forecast integration first — it's the highest-value feature with lowest effort.

### Track 3: Yield Prediction & ML

| # | Action | When |
|---|--------|------|
| 1 | Train the existing model (`python ml/pipelines/train.py`) | Immediately (models missing) |
| 2 | Add yield prediction types + hooks to frontend | Phase 1 |
| 3 | Add yield prediction card to field detail page | Phase 1 |
| 4 | Add daily batch prediction scheduler | Phase 2 |
| 5 | Retrain with real historical data after harvest | Phase 3 |

**Recommendation**: Keep joblib format. Add real-time + batch hybrid approach. The `/api/v1/fields/{id}/predictions/yield` endpoint is ready — wire the frontend.

---

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Crop parameter research is time-consuming | High | Medium | Prioritize top 10 additional crops; add others incrementally |
| NotebookLM unreliable (HTTP 500) | Medium | Low | Use FAO published tables + manual compilation |
| ML model not trained (empty models dir) | High | Low | Run `train.py` — takes ~2 minutes |
| Synthetic data ≠ real data quality | High | High | Plan for retraining after first harvest cycle |
| No task scheduler in project | High | Medium | Use simple APScheduler or FastAPI background tasks; avoid Celery overhead |
| 4-crop ML model doesn't generalize to 20+ | Medium | Medium | Re-train with all crop types in training set; consider per-crop models |

---

## Data Model Proposals

### 1. `crop_profiles.json` (new file, `backend/app/domain/crop_profiles/`)

```json
{
  "coffee": {
    "name": "Coffee (Arabica)",
    "type": "perennial",
    "climate_zone": "tropical_highland",
    "optimal_temp": { "min": 15, "max": 28, "ideal": [18, 24] },
    "optimal_humidity": { "min": 60, "max": 85, "ideal": [65, 80] },
    "soil_moisture": { "min": 25, "max": 55, "field_capacity": 50 },
    "growth_stages_days": [60, 120, 120, 60],
    "kc": { "initial": 0.9, "mid": 1.05, "end": 0.95 },
    "root_depth_m": 0.5,
    "fertilizer": {
      "planting": { "n": 20, "p": 30, "k": 40 },
      "vegetative": { "n": 80, "p": 20, "k": 80 },
      "reproductive": { "n": 50, "p": 30, "k": 100 }
    },
    "pests": [
      {
        "name": "Coffee Leaf Rust (Hemileia vastatrix)",
        "gdd_threshold": 500, "t_base": 10,
        "optimal_temp": { "min": 20, "max": 28 },
        "min_humidity": 85,
        "recommendation": "Apply fungicide (triazole/strobilurin). Prune infected leaves."
      }
    ],
    "base_yield_kg_ha": 1200,
    "days_to_maturity": 240,
    "irrigation_mm_per_day": 4.5
  }
}
```

### 2. Recommendation Lifecycle (additions to existing `recommendations` table)

Add columns (Alembic migration 007):
```sql
ALTER TABLE recommendations
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN acknowledged_at TIMESTAMPTZ,
  ADD COLUMN dismissed_at TIMESTAMPTZ,
  ADD COLUMN severity VARCHAR(20) NOT NULL DEFAULT 'info',
  ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT '';
```

Status values: `active | acknowledged | applied | dismissed`

### 3. Prediction Enhancement (additions to existing `predictions` table)

Add columns (Alembic migration 008):
```sql
ALTER TABLE predictions
  ADD COLUMN data_quality VARCHAR(20) DEFAULT 'medium',
  ADD COLUMN features_used JSONB DEFAULT '[]';
```

(Already implicitly tracked via `model_version`.)

---

## Next Steps (Recommended Implementation Order)

| Phase | Task | Depends On | Effort |
|-------|------|-----------|--------|
| **Phase 0** | Train ML models: `python ml/pipelines/train.py` | Nothing | < 1h |
| **Phase 1a** | Create `crop_profiles.json` with 10 current + 10 new crop parameters | Research | 2-3 days |
| **Phase 1b** | Add FAO-56 Kc, fertilizer, pest data for all 10 current crops | Phase 1a | 1 day |
| **Phase 1c** | Web: Add recommendation/prediction types + hooks to `api.ts`/`hooks.ts` | Phase 0 | 1 day |
| **Phase 1d** | Web: Add yield prediction card to field detail page | Phase 1c | 1 day |
| **Phase 2a** | Integrate Open-Meteo forecast into irrigation recommendation | Phase 1a | 2 days |
| **Phase 2b** | Replace field detail placeholder with real recommendation section | Phase 1c | 1 day |
| **Phase 2c** | Add acknowledge/dismiss API for recommendations | Phase 2b | 1 day |
| **Phase 2d** | Add daily scheduler for background recommendation + prediction generation | Nothing | 2 days |
| **Phase 3a** | Connect high-severity recommendations to alert events | Phase 2c | 1 day |
| **Phase 3b** | Re-train ML models with real historical data | After harvest | 2 days |
| **Phase 3c** | Expand crop coverage to 20-30 total | Phase 1a | 2 days |

---

## Ready for Proposal

**Yes**. The codebase has a strong foundation. The key decision points are:
1. **Crop profiles**: JSON file vs database table → **Recommend JSON file for v1**
2. **Recommendations**: Rule-based vs ML → **Rule-based is correct (already implemented)**
3. **Prediction serving**: Batch vs real-time → **Hybrid: daily batch + on-demand real-time**
4. **ML model format**: joblib vs ONNX vs MLflow → **Keep joblib for now**
5. **Scheduler**: APScheduler vs Celery vs cron → **FastAPI lifespan background task or simple APScheduler**

The orchestrator should present these 5 decisions to the user before proceeding to proposal.
