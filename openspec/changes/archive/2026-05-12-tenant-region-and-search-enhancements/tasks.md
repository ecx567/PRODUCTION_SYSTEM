# Tasks: Tenant Region & Search Enhancements

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend: data model + API changes (F1 + F2) | PR only | Phases 1–2 |
| 2 | Frontend: crop icons + search + sensor cards (F2 + F3 + F4) | PR only | Phases 3–5 |

Single PR (≤350 lines). All phases fit within the 400-line review budget.

---

## Phase 1: Backend Foundation (F1 — Data Model + Migration)

- [x] **1.1** Add `country: Mapped[str]` (VARCHAR 100, NOT NULL, default 'EC') and `region: Mapped[str | None]` (VARCHAR 100, nullable) columns to `Tenant` ORM in `backend/app/domain/auth/models_tenant.py`
- [x] **1.2** Create Alembic migration `009_add_tenant_country_region.py` — `ALTER TABLE tenants ADD COLUMN` (up) / `DROP COLUMN` (down). Country gets server_default and default='EC'
- [x] **1.3** Update `backend/app/seed.py` — add `country: "EC"`, `region: "Sierra"` to `SEED_TENANTS` and propagate country when creating the `Tenant` object

## Phase 2: Backend API Changes (F1 + F2 — Filters + Search)

- [x] **2.1** Add optional `country` field (default "EC") to `SignupRequest` in `backend/app/domain/auth/schemas.py`; propagate to tenant in `backend/app/api/v1/auth.py` signup flow
- [x] **2.2** Add `q`, `country`, `region` params to `FieldsService.list_fields()` in `backend/app/domain/fields/service.py` — ILIKE filter on `Field.name OR Field.crop_type` for `q`, JOIN + filter on `Tenant.country`/`Tenant.region` for location. Mirror filters in the count query
- [x] **2.3** Wire `q`, `country`, `region` as optional `Query()` params in the `list_fields` endpoint in `backend/app/domain/fields/router.py`

## Phase 3: Frontend — Crop Icons (F4)

- [x] **3.1** Create `web/src/lib/crop-icons.ts` — export `CROP_EMOJIS: Record<string, string>` (18 entries, all unique) + `getCropEmoji(cropType): string` helper with `🌱` fallback
- [x] **3.2** Update `web/src/components/field-card.tsx` — replace inline `CROP_EMOJIS` with `import { getCropEmoji } from "@/lib/crop-icons"`
- [x] **3.3** Update `web/src/app/dashboard/fields/page.tsx` — replace inline `CROP_EMOJIS` with `import { getCropEmoji } from "@/lib/crop-icons"` (same import as field-card)

## Phase 4: Frontend — Search + API Layer (F2)

- [x] **4.1** Update `getFields()` in `web/src/lib/api.ts` — accept optional `q`, `country`, `region` params, append to `URLSearchParams`
- [x] **4.2** Update `useFields()` in `web/src/lib/hooks.ts` — accept optional `q` param and pass it to `getFields()`; re-trigger on `q` change
- [x] **4.3** Replace client-side filter in `web/src/app/dashboard/fields/page.tsx` — add `searchQuery`/`debouncedQuery` state (300ms debounce), call `useFields(debouncedQuery)`, remove local `filtered` logic, ensure results are clickable to navigate

## Phase 5: Frontend — Sensor Cards (F3)

- [x] **5.1** Modify `web/src/components/devices/sensor-card.tsx` — accept `isExpanded`, `onToggle`, `hourlyRollup` props; render expanded section with Recharts `LineChart` sparklines for temp/humidity/soil_moisture/rain; use CSS transition for smooth animation
- [x] **5.2** Update `web/src/app/dashboard/devices/page.tsx` — add `expandedSensorId: string | null` state (accordion), fetch `getHourlyRollup(fieldId)` per field in parallel with sensor fetch, pass props to each `SensorCard`

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 12 |
| Estimated lines | ~350 |
| Files modified | 13 (2 new, 11 modified) |
| 400-line budget | ✅ OK — single PR sufficient |
| PR strategy | Single PR to main |

**Ready for**: Apply phase
