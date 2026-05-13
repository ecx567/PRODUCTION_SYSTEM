# Proposal: Tenant Region & Search Enhancements

## Intent

Add multi-tenant country/region filtering, crop search, interactive sensor cards, and unique crop icons to improve multi-tenant management and field navigation.

## Scope

### In Scope
- Country/region columns on Tenant model + Alembic migration 009
- `GET /api/v1/fields?q=` — ILIKE search on `name` and `crop_type`
- Frontend debounced crop search → field results → detail navigation
- Expand/collapse on sensor cards with mini sparklines
- Shared `CROP_EMOJIS` map (18 crop types, unique emojis)

### Out of Scope
- Geo-aware field sorting or map-based region filtering
- Advanced search (full-text, fuzzy, multi-field)
- Sensor card drag-to-reorder or persistent layout
- Crop emoji customization UI

## Capabilities

### New Capabilities
- `tenant-management`: Country/region fields, tenant-level filtering by location

### Modified Capabilities
- `crop-types`: Add unique visual identifiers (emojis) per crop type
- `devices-monitoring`: Add interactive expand/collapse + mini sparklines on sensor cards
- `fields`: Add search query param to existing fields API

## Approach

**1. Backend — Tenant country/region**: Add `country VARCHAR(100) DEFAULT 'EC'`, `region VARCHAR(100)` to Tenant model. Alembic migration 009. No API changes — JWT already provides tenant_id scope.

**2. Backend — Field search**: Add optional `q` query param to `GET /api/v1/fields`. Filter by ILIKE on `name` and `crop_type`. Changes to `fields_router.py` only.

**3. Frontend — Crop search**: Debounced input on fields list page. Results display matching fields + crop type. Click navigates to field detail (existing route).

**4. Frontend — Sensor cards**: Add onClick toggle for expand/collapse. Expanded view shows mini sparkline per metric. Data sourced from existing `hourlyRollup` state.

**5. Frontend — Crop icons**: Extract shared `CROP_EMOJIS` to `web/src/lib/crop-icons.ts`. Import in all 3 render locations.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/app/domain/auth/models_tenant.py` | Modified | Add country, region columns |
| `backend/app/migrations/versions/009_*.py` | New | Add country/region to tenants |
| `backend/app/domain/fields/router.py` | Modified | Add `?q=` ILIKE search |
| `web/src/lib/crop-icons.ts` | New | Shared CROP_EMOJIS map (18 types) |
| `web/src/components/fields/*.tsx` | Modified | Search input, debounce, results |
| `web/src/components/devices/sensor-card.tsx` | Modified | Expand/collapse + sparklines |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migration conflict with prod tenants | Low | Default EC safe, test migration on snapshot |
| Search perf on large field sets | Low | ILIKE on small table, add index if needed |
| Crop emoji rendering on old browsers | Low | Emojis are Unicode — works everywhere |

## Rollback Plan

- **Backend**: Revert migration 009, remove `q` param from router
- **Frontend**: Revert sensor-card.tsx, remove crop-icons.ts
- **Coordinated**: Full revert in single PR

## Dependencies

- Alembic migration environment (existing)
- Frontend build tooling (existing Vite)

## Success Criteria

- [ ] 18 crop types each display a unique emoji
- [ ] Tenant edit page allows country/region selection
- [ ] Search by crop name returns matching fields
- [ ] Sensor cards expand with sparklines on click
- [ ] All existing tests pass
