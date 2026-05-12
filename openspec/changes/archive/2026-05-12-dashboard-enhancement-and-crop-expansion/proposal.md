# Proposal: Dashboard Enhancement & Crop Expansion

## Intent

Replace 5 placeholder pages with production UIs, support unlimited crops, and add weather data — making the dashboard viable for real farm operators.

## Scope

| In Scope | Out of Scope |
|---|---|
| Alert rules full CRUD UI (modal create/edit/delete) | Dedicated devices table (use sensor_readings) |
| Crop types: Enum → String(50), expand Pydantic set | Push notifications for alerts |
| Devices page: live sensor_readings data | Weather forecast charts on dashboard |
| Analytics page: cross-field Recharts dashboard | |
| Settings page: profile/notifications/display/API keys | |
| Open-Meteo weather service (backend, httpx) | |

## Capabilities

| Type | Name | What changes |
|---|---|---|
| New | `settings-page` | Profile, prefs, display, API keys via localStorage |
| New | `weather-data` | Open-Meteo backend service |
| Modified | `alert-rules` | Read-only → full CRUD UI |
| Modified | `devices-monitoring` | Placeholder → live sensor data |
| Modified | `analytics-dashboard` | Placeholder → Recharts dashboards |
| Modified | `crop-types` | Enum/set → dynamic string model |

## Approach

| Enhancement | Approach |
|---|---|
| **Crop expansion** | SQLAlchemy Enum → `String(50)`. Alembic migration. Expand Pydantic `ALLOWED_CROP_TYPES` +6. |
| **Alert Rules CRUD** | Modal forms in `rules/page.tsx` consuming existing POST/PUT/DELETE `/api/v1/alerts/rules`. |
| **Devices page** | Aggregate `sensor_readings` by sensor_id. Cards: temp, humidity, soil_moisture, rain, signal, last_seen. |
| **Analytics page** | Cross-field Recharts (line/bar/area) from existing `/api/v1/analytics/*`. Already installed. |
| **Settings page** | New `settings/page.tsx`. 4 sections. localStorage persistence. No backend. |
| **Open-Meteo** | New `backend/app/domain/weather/` (service, router, schemas). httpx → production dep. |

## Architecture Changes

| Area | Change |
|---|---|
| `backend/app/domain/weather/` | New module (service.py, router.py, schemas.py) |
| `backend/pyproject.toml` | httpx → production dependency |
| `backend/app/domain/fields/models.py` | `CropType` Enum → `String(50)` |
| `backend/app/domain/fields/schemas.py` | Expand `ALLOWED_CROP_TYPES` |
| `web/src/app/dashboard/rules/page.tsx` | Modal CRUD UI |
| `web/src/app/dashboard/devices/page.tsx` | Live sensor cards |
| `web/src/app/dashboard/analytics/page.tsx` | Recharts dashboard |
| `web/src/app/dashboard/settings/page.tsx` | New route + sections |

## Dependencies

- **httpx**: move from dev to production (Open-Meteo service)
- **Open-Meteo**: free, no API key, rate-limit friendly

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Crop migration breaks existing data | Low | Alembic with data migration; old enum values kept |
| Open-Meteo rate limits | Low | Cache with TTL refresh |
| localStorage lost on clear | Low | Acceptable v1; export/import later |

## Rollback

1. **DB**: `alembic downgrade -1` reverts crop column type.
2. **Backend**: Remove `weather/` module, revert httpx to dev.
3. **Web**: `git revert` on changed pages; settings route removed.

## Delivery Order (Rationale)

1. **Crop expansion** — foundation for field features. No UI dependency.
2. **Alert Rules CRUD** — highest user value, backend complete.
3. **Devices page** — unblocks operator monitoring.
4. **Analytics page** — depends on existing endpoints only.
5. **Open-Meteo** — independent, ships anytime.
6. **Settings page** — lowest urgency, standalone.

## Success Criteria

- [ ] All 4 original crops functional post-migration
- [ ] Alert rules created/edited/deleted from UI
- [ ] Devices page loads live data in <1s
- [ ] Analytics renders 3+ chart types without error
- [ ] Settings persist across page reloads
- [ ] Weather endpoint returns valid data for any lat/lng

## Estimated Effort

| Enhancement | Days |
|---|---|
| Crop expansion | 0.5 |
| Alert Rules CRUD | 1.0 |
| Devices page | 1.0 |
| Analytics page | 1.5 |
| Open-Meteo | 1.0 |
| Settings page | 0.5 |
| **Total** | **5.5** |
