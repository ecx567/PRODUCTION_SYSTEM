# Spec: Tenant Region & Search Enhancements

## Feature 1: Multi-tenant Country/Region

### Requirements

| ID | Requirement |
|----|------------|
| R1.1 | The `Tenant` model MUST add `country` (VARCHAR 100, default `'EC'`, nullable: false) and `region` (VARCHAR 100, nullable: true) columns |
| R1.2 | An Alembic migration (rev 009) MUST add both columns to the `tenants` table; existing rows receive `country='EC'`, `region=NULL` |
| R1.3 | The `SignupRequest` schema SHOULD accept an optional `country` field (default `'EC'`) that flows to the tenant record |
| R1.4 | `GET /api/v1/fields` MUST accept optional `country` (string) and `region` (string) query params; the fields service MUST filter by tenant's country/region when provided |
| R1.5 | The seed script MUST create tenants with `country='EC'` and varied `region` values |

#### Scenarios

- GIVEN a tenant with `country='EC'`, `region='Sierra'`
- WHEN `GET /api/v1/fields?country=EC&region=Sierra` is called
- THEN only fields belonging to tenants matching both filters are returned

- GIVEN a tenant with `country='EC'` and no `region` filter
- WHEN `GET /api/v1/fields?country=EC` is called
- THEN all fields for `country='EC'` tenants are returned, regardless of region

### Non-goals
- Geo-aware field sorting, map-based region filtering, tenant CRUD API

### Edge Cases

| Case | Expected Behavior |
|------|------------------|
| `?country=` empty string | Ignored (no filter applied) |
| `?region=` not provided | Only country filter applied |
| No country/region params | Current behavior (no location filter) |
| Country mismatch with tenant | Empty result set — valid, no error |

### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC1.1 | Migration 009 adds columns; `SELECT country FROM tenants` returns `'EC'` for existing rows |
| AC1.2 | `GET /api/v1/fields?country=EC&region=Coast` returns only matching tenant fields |
| AC1.3 | `GET /api/v1/fields` without params returns all fields (backward compatible) |
| AC1.4 | Migration downgrade (rev 008) removes columns without data loss |

---

## Feature 2: Crop Search

### Requirements

| ID | Requirement |
|----|------------|
| R2.1 | `GET /api/v1/fields` MUST accept an optional `q` query param (string, max 100 chars) |
| R2.2 | When `q` is provided, the backend MUST filter fields using ILIKE on `Field.name` AND `Field.crop_type`; a match on EITHER field returns the row |
| R2.3 | Search MUST be case-insensitive (ILIKE) and trim leading/trailing whitespace |
| R2.4 | The frontend fields page MUST add a debounced search input (300ms debounce) that calls the API with `?q=` |
| R2.5 | Each search result MUST be clickable and navigate to `/dashboard/fields/{field.id}` |
| R2.6 | When `?q=` is present, pagination MUST reflect the filtered total (not unfiltered total) |

#### Scenarios

- GIVEN fields named "North Field" (maize) and "South Field" (banana)
- WHEN `GET /api/v1/fields?q=north` is called
- THEN only "North Field" is returned

- GIVEN a field with `crop_type='sugarcane'`
- WHEN `GET /api/v1/fields?q=sugarcane` is called
- THEN the field is returned via crop_type match

- GIVEN the user types "ma" in the search input
- WHEN 300ms passes without further input
- THEN `GET /api/v1/fields?q=ma` is called

### Non-goals
- Full-text search, fuzzy matching, multi-field search, saved searches, search history

### Edge Cases

| Case | Expected Behavior |
|------|------------------|
| `?q=` empty string | Ignored — returns all fields |
| `?q=   ` whitespace only | Trimmed to empty — ignored |
| `?q=non_existent_crop` | Empty `items` array, `total=0` |
| `?q=` with special SQL chars (`%`, `_`) | Escaped or parameterized — no syntax error |
| Search while loading | Debounce handles gracefully; no duplicate requests |

### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC2.1 | `GET /api/v1/fields?q=corn` returns only fields with "corn" in name or crop_type |
| AC2.2 | Search for `cAsSaVa` returns fields with "cassava" crop_type (case-insensitive) |
| AC2.3 | Frontend fires API request 300ms after last keystroke |
| AC2.4 | Clicking a search result navigates to field detail page |
| AC2.5 | Empty search result shows "No fields match your search" (not error) |

---

## Feature 3: Interactive Sensor Cards

### Requirements

| ID | Requirement |
|----|------------|
| R3.1 | The sensor card (`devices/sensor-card.tsx`) MUST support expand/collapse via click on the card header |
| R3.2 | When expanded, the card MUST render a mini sparkline chart (via Recharts `LineChart`) for each metric (temp, humidity, soil_moisture, rain) |
| R3.3 | Sparkline data MUST come from the existing `hourlyRollup` state array, filtered by sensor_id |
| R3.4 | Expand/collapse MUST use a smooth CSS transition (max-height + opacity, ~300ms) |
| R3.5 | Clicking the expanded card header again MUST collapse it back to default height |
| R3.6 | Only ONE card MAY be expanded at a time (accordion behavior); expanding a new card collapses the previously expanded one |

#### Scenarios

- GIVEN a sensor card with hourlyRollup data
- WHEN the user clicks the card header
- THEN the card expands with a smooth animation
- AND a mini sparkline chart renders using recharts `LineChart`

- GIVEN card A is expanded
- WHEN the user clicks card B
- THEN card A collapses smoothly
- AND card B expands

### Non-goals
- Drag-to-reorder cards, persistent expanded state across page reloads, resizable charts

### Edge Cases

| Case | Expected Behavior |
|------|------------------|
| No hourlyRollup data | Expanded area shows "No data" message — no chart error |
| Single metric has data, rest null | Only the metric with data renders a sparkline |
| Rapid clicking multiple cards | Last clicked card wins; animation queue resolves cleanly |

### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC3.1 | Clicking sensor card header expands/collapses the card |
| AC3.2 | Expanded section shows Recharts sparkline for available metrics |
| AC3.3 | Expand/collapse has visible smooth animation (~300ms) |
| AC3.4 | Only one card is expanded at a time |
| AC3.5 | No hourlyRollup shows empty state, not error |

---

## Feature 4: Unique Crop Icons

### Requirements

| ID | Requirement |
|----|------------|
| R4.1 | The system MUST create `web/src/lib/crop-icons.ts` exporting a `CROP_EMOJIS: Record<string, string>` map |
| R4.2 | The map MUST cover all 18 crop types from `ALLOWED_CROP_TYPES` with **unique emojis** (no two crops share the same emoji) |
| R4.3 | `fields/page.tsx` MUST replace its inline `CROP_EMOJIS` with an import from `@/lib/crop-icons` |
| R4.4 | `field-card.tsx` MUST replace its inline `CROP_EMOJIS` with an import from `@/lib/crop-icons` |
| R4.5 | Any unknown crop type MUST fall back to `"🌱"` (seedling emoji) |

#### Scenarios

- GIVEN the crop-icons.ts file is created
- WHEN a field with `crop_type='banana'` renders
- THEN the display shows `🍌` (unique banana emoji)

- GIVEN a field with an unrecognized crop_type
- WHEN the card renders
- THEN the fallback `🌱` emoji is shown

- GIVEN both `fields/page.tsx` and `field-card.tsx`
- WHEN they render fields with the same crop_type
- THEN both show the SAME emoji (shared map)

### Crop Emoji Map

| Crop | Emoji |
|------|-------|
| banana | 🍌 |
| maize | 🌽 |
| cacao | 🍫 |
| rice | 🌾 |
| coffee | ☕ |
| sugarcane | 🎋 |
| soybean | 🟢 |
| sunflower | 🌻 |
| palm_oil | 🌴 |
| cotton | ☁️ |
| cassava | 🥔 |
| sweet_potato | 🍠 |
| coconut | 🥥 |
| pineapple | 🍍 |
| mango | 🥭 |
| papaya | 🧡 |
| tomato | 🍅 |
| beans | 🫘 |

### Non-goals
- Emoji customization UI, SVG icons, crop icon selector component

### Edge Cases

| Case | Expected Behavior |
|------|------------------|
| crop_type with whitespace (" banana") | Normalized before lookup; fallback to 🌱 if no match |
| crop_type added in future but not in map | Falls back to 🌱 — no crash |
| Import path broken | TypeScript compile error caught at build time |

### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC4.1 | `CROP_EMOJIS` object contains exactly 18 entries, all unique |
| AC4.2 | Import works in both `fields/page.tsx` and `field-card.tsx` |
| AC4.3 | Unknown crop_type renders 🌱, not undefined or crash |
| AC4.4 | Both components display identical emoji for the same crop_type |

---

## Non-functional Requirements

| Area | Requirement |
|------|------------|
| Search performance | ILIKE query on fields table (<10k rows expected); add index on `(name, crop_type)` if needed |
| Backward compat | `GET /api/v1/fields` without any new params MUST behave identically to current |
| Migration safety | Migration 009 MUST have a tested downgrade path (rev 008) |
| Bundle size | Recharts sparkline import should be tree-shaken; `crop-icons.ts` is ~500 bytes |
