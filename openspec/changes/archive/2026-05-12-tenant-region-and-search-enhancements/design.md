# Design: Tenant Region & Search Enhancements

**Change**: tenant-region-and-search-enhancements  
**Date**: 2026-05-12  
**Status**: Draft  

---

## 1. Architecture Overview

Four features are designed to work independently but share the `GET /api/v1/fields` endpoint as a common integration point:

```
┌─────────────────────────────────────────────────────────────┐
│                      Architecture Map                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  FEATURE 1 (Location)    FEATURE 2 (Search)                 │
│  ┌──────────────────┐   ┌──────────────────┐               │
│  │ Tenant Model     │   │ Fields Router    │               │
│  │ +country, region │   │ +?q= ILIKE       │               │
│  │ +migration 009   │   │ +?country,region │               │
│  └────────┬─────────┘   └────────┬─────────┘               │
│           │                      │                          │
│           ▼                      ▼                          │
│  ┌──────────────────────────────────────────────────┐       │
│  │          GET /api/v1/fields (enhanced)            │       │
│  │   Filters: tenant_id, deleted_at,                │       │
│  │   +q(ILIKE), +country(tenant join), +region      │       │
│  └──────────────────────┬───────────────────────────┘       │
│                         │                                    │
│          ┌──────────────┼──────────────┐                    │
│          ▼              ▼              ▼                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │ FEATURE 3  │ │ FEATURE 4  │ │ FEATURE 1  │              │
│  │Sensor Cards│ │Crop Icons  │ │Signup flow │              │
│  │Expand+     │ │Shared lib  │ │+country    │              │
│  │Sparklines  │ │18 unique   │ │propagation │              │
│  └────────────┘ └────────────┘ └────────────┘              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key architectural principles**:
1. **Backward compatibility**: All new params are optional — existing clients see zero behavior change.
2. **Tenant isolation preserved**: All field queries remain scoped by `tenant_id` from JWT.
3. **Single source of truth**: Crop icons extracted to shared module; sensor card state managed by React `useState` with accordion pattern.
4. **Join-based filtering**: Country/region filtering follows the tenant relationship (Field → Tenant), NOT adding denormalized columns to the fields table.

---

## 2. Data Model Changes

### 2.1 Tenant Model — New Columns

| Column | Type | Constraints | Default | Comment |
|--------|------|------------|---------|---------|
| `country` | `VARCHAR(100)` | `NOT NULL` | `'EC'` | ISO country code (uppercase) |
| `region` | `VARCHAR(100)` | `NULLABLE` | — | Geographic region within country |

### 2.2 Migration 009 — DDL

```sql
-- UPGRADE
ALTER TABLE tenants ADD COLUMN country VARCHAR(100) NOT NULL DEFAULT 'EC';
ALTER TABLE tenants ADD COLUMN region VARCHAR(100);

-- DOWNGRADE
ALTER TABLE tenants DROP COLUMN region;
ALTER TABLE tenants DROP COLUMN country;
```

### 2.3 ORM Model Change (`models_tenant.py`)

```python
# New imports
from sqlalchemy import String

# New columns on Tenant class
country: Mapped[str] = mapped_column(
    String(100),
    nullable=False,
    server_default=text("'EC'"),
    default="EC",
)
region: Mapped[str | None] = mapped_column(
    String(100),
    nullable=True,
)
```

### 2.4 Seed Script Update (`seed.py`)

```python
SEED_TENANTS: list[dict] = [
    {"name": "Default Farm", "country": "EC", "region": "Sierra"},
    # Future: additional tenants with varied regions
]
```

The seed script creates "Default Farm" with `country='EC'` and `region='Sierra'` by default. Additional seed tenants (if any) use varied regions from Ecuador: `"Coast"`, `"Amazon"`, `"Galapagos"`.

---

## 3. API Changes

### 3.1 `GET /api/v1/fields` — New Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | `string` | No | — | ILIKE search on `name` and `crop_type` (max 100 chars) |
| `country` | `string` | No | — | Filter by tenant country (exact match) |
| `region` | `string` | No | — | Filter by tenant region (exact match) |

#### Request Examples

```http
# Search + location filter
GET /api/v1/fields?q=corn&country=EC&region=Sierra&page_size=20

# Location only (all tenants in EC, any region)
GET /api/v1/fields?country=EC

# Search only
GET /api/v1/fields?q=banana
```

#### Response Schema (unchanged)

The `FieldList` response schema remains identical — no new fields are added to the response. Country/region filtering happens server-side via a join.

```json
{
  "items": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "name": "North Field",
      "crop_type": "maize",
      "planted_at": "2026-03-15T08:00:00Z",
      "area_ha": 42.5,
      "location": "POINT(-79.5 8.9)",
      "created_at": "2026-03-15T08:00:00Z",
      "deleted_at": null
    }
  ],
  "next_cursor": "2026-03-15T08:00:00+00:00",
  "total": 1
}
```

### 3.2 Router Change (`fields/router.py`)

```python
# New query params added to list_fields endpoint:
q: str | None = Query(
    default=None,
    max_length=100,
    description="Search query — ILIKE match on name and crop_type.",
),
country: str | None = Query(
    default=None,
    max_length=100,
    description="Filter by tenant country (exact).",
),
region: str | None = Query(
    default=None,
    max_length=100,
    description="Filter by tenant region (exact).",
),
```

### 3.3 Service Change (`fields/service.py`)

`list_fields()` gains two new parameters: `q`, `country`, `region`.

**Search logic** (when `q` is provided):
```python
if q:
    q_clean = q.strip()
    if q_clean:
        like_pattern = f"%{q_clean}%"
        stmt = stmt.where(
            sa.or_(
                Field.name.ilike(like_pattern),
                Field.crop_type.ilike(like_pattern),
            )
        )
```

**Location filter logic** (when `country`/`region` is provided):
```python
# Join with tenants table for country/region filtering
if country or region:
    stmt = stmt.join(Tenant, Field.tenant_id == Tenant.id)
    if country:
        stmt = stmt.where(Tenant.country == country.strip())
    if region:
        stmt = stmt.where(Tenant.region == region.strip())
```

**Important**: The count query must mirror the same filters to return accurate `total`.

### 3.4 Signup Flow — Country Propagation

**Schema change** (`auth/schemas.py — SignupRequest`):
```python
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str | None = None
    country: str | None = Field(default="EC", max_length=100)
```

**Service change** (`auth.py — /signup`):
When creating the tenant, propagate the `country` field:
```python
tenant = Tenant(name=tenant_name, country=body.country or "EC")
```

The tenant lookup logic changes slightly: instead of only looking up "Default Farm", the signup flow uses a configurable default tenant name and passes the country to new tenant creation if needed.

### 3.5 API Client Change (`web/src/lib/api.ts`)

```typescript
export async function getFields(
  cursor?: string,
  pageSize = 20,
  q?: string,
  country?: string,
  region?: string,
): Promise<FieldList> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("page_size", String(pageSize));
  if (q) params.set("q", q);
  if (country) params.set("country", country);
  if (region) params.set("region", region);
  return apiFetch<FieldList>(`/api/v1/fields?${params.toString()}`);
}
```

---

## 4. Component Changes

### 4.1 Crop Icons — Shared Module

**New file**: `web/src/lib/crop-icons.ts`

```typescript
/**
 * Unique emoji for each supported crop type.
 * Falls back to 🌱 (seedling) for unknown types.
 */
export const CROP_EMOJIS: Record<string, string> = {
  banana: "🍌",
  maize: "🌽",
  cacao: "🍫",
  rice: "🌾",
  coffee: "☕",
  sugarcane: "🎋",
  soybean: "🟢",
  sunflower: "🌻",
  palm_oil: "🌴",
  cotton: "☁️",
  cassava: "🥔",
  sweet_potato: "🍠",
  coconut: "🥥",
  pineapple: "🍍",
  mango: "🥭",
  papaya: "🧡",
  tomato: "🍅",
  beans: "🫘",
};

export function getCropEmoji(cropType: string): string {
  return CROP_EMOJIS[cropType.trim().toLowerCase()] ?? "🌱";
}
```

### 4.2 Component Tree

```
FieldsPage (page.tsx)
├── SearchInput (debounced, 300ms)
├── FieldCard inline (uses getCropEmoji)        ← F4 change
└── EmptyState

FieldDetailPage ([id]/page.tsx)
├── Summary gauges
├── Temperature chart (Recharts)
├── Humidity chart (Recharts)
├── Sensor table
└── Recommendations / Predictions

DevicesPage (page.tsx)
├── Header
├── SensorCardGrid
│   └── SensorCard (devices/sensor-card.tsx)    ← F3 change
│       ├── Header (click to expand/collapse)
│       ├── Metric grid (always visible)
│       ├── Expanded section
│       │   ├── Temp sparkline
│       │   ├── Humidity sparkline
│       │   ├── Soil moisture sparkline
│       │   └── Rain sparkline
│       └── Footer
└── EmptyState / ErrorState

FieldCard (field-card.tsx)
└── Uses getCropEmoji                           ← F4 change
```

### 4.3 F3: Sensor Card — Expand/Collapse + Sparklines

**File modified**: `web/src/components/devices/sensor-card.tsx`

**State management**:
- Parent component (`DevicesPage`) manages `expandedSensorId: string | null`
- Only ONE card expanded at a time (accordion pattern)
- Card header is the click target

**Props change**:
```typescript
interface SensorCardProps {
  reading: SensorReadingResponse;
  fieldName?: string;
  /** Whether this card is currently expanded */
  isExpanded: boolean;
  /** Called when the card header is clicked */
  onToggle: () => void;
  /** Hourly rollup data for sparklines — passed per sensor */
  hourlyRollup?: HourlyRollup[];
}
```

**Expanded section** (renders below metric grid, above footer):
```tsx
{isExpanded && (
  <div className="overflow-hidden transition-all duration-300 ease-in-out">
    <div className="border-t border-leaf-100 pt-3">
      <h4 className="mb-2 text-xs font-semibold text-soil-500">
        24h Trend
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {sparklineMetrics.map((metric) => {
          const data = hourlyRollup?.map(h => ({
            time: new Date(h.hour).toLocaleTimeString([], { hour: '2-digit' }),
            value: h[metric.key],
          })) ?? [];
          if (data.every(d => d.value === null)) {
            return (
              <div key={metric.key} className="rounded-lg bg-leaf-50/50 p-2 text-center text-xs text-soil-400">
                No data
              </div>
            );
          }
          return (
            <div key={metric.key} className="rounded-lg bg-leaf-50/50 p-2">
              <p className="mb-1 text-[10px] font-medium text-soil-400">{metric.label}</p>
              <ResponsiveContainer width="100%" height={40}>
                <LineChart data={data}>
                  <Line type="monotone" dataKey="value" stroke={metric.color} strokeWidth={1.5} dot={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  </div>
)}
```

**Animation**: CSS transition on the expanded div:
```css
/* via Tailwind: overflow-hidden transition-all duration-300 ease-in-out */
```

**Data sourcing**: Sparkline data comes from `hourlyRollup` state in `DevicesPage`, filtered by sensor_id. Currently, the devices page does NOT fetch hourly rollup data — it only fetches `getFieldSensors()`. The design adds an API call to `getHourlyRollup(fieldId)` for the relevant fields (parallel to sensor fetch), then passes the filtered data per sensor.

### 4.4 F2: Search Input — Debounced

**File modified**: `web/src/app/dashboard/fields/page.tsx`

The current client-side search is replaced with debounced server-side search:

```typescript
import { useCallback, useEffect, useRef, useState } from "react";

// In FieldsPage component:
const [searchQuery, setSearchQuery] = useState("");
const [debouncedQuery, setDebouncedQuery] = useState("");

// 300ms debounce
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedQuery(searchQuery.trim());
  }, 300);
  return () => clearTimeout(timer);
}, [searchQuery]);

// useFields hook updated to accept q param
const { fields, isLoading, error, total } = useFields(
  undefined,  // cursor
  20,         // pageSize
  debouncedQuery || undefined,
);
```

The loading state shows skeletons; empty search results show "No fields match your search" (already exists in current code).

---

## 5. Data Flow

### 5.1 Feature 1: Tenant Country/Region Filtering

```
Request: GET /api/v1/fields?country=EC&region=Sierra
         ↓
    [Auth Middleware] → tenant_id from JWT
         ↓
    [Fields Router] → extracts country, region from Query
         ↓
    [Fields Service.list_fields()]
         ↓
    Build query:
      SELECT f.* FROM fields f
      JOIN tenants t ON f.tenant_id = t.id
      WHERE f.tenant_id = :tenant_id
        AND f.deleted_at IS NULL
        AND t.country = 'EC'
        AND t.region = 'Sierra'
      ORDER BY f.created_at DESC
      LIMIT :page_size + 1
         ↓
    [DB] → filtered results
         ↓
    Response: FieldList (items filtered, total reflects filters)
```

### 5.2 Feature 2: Crop Search (ILIKE)

```
Request: GET /api/v1/fields?q=north
         ↓
    [Fields Service.list_fields()]
         ↓
    Build query with ILIKE:
      SELECT f.* FROM fields f
      WHERE f.tenant_id = :tenant_id
        AND f.deleted_at IS NULL
        AND (f.name ILIKE '%north%' OR f.crop_type ILIKE '%north%')
      ORDER BY f.created_at DESC
      LIMIT :page_size + 1
         ↓
    [DB] → filtered results
         ↓
    Response: FieldList

    Frontend flow:
    User types "nor" → 300ms debounce → 
    GET /api/v1/fields?q=nor → 
    Response renders → 
    User clicks field → router.push(/dashboard/fields/{id})
```

### 5.3 Feature 3: Sensor Card Expand/Sparklines

```
[DevicesPage] mounts
    ↓
useEffect → fetchData()
    ↓
Promise.all([
  getFields(),                          ← all fields
  ...fields.map(f => getFieldSensors(f.id)),  ← sensors per field
  ...fields.map(f => getHourlyRollup(f.id)),  ← NEW: hourly data
])
    ↓
State:
  sensors: SensorWithField[]
  hourlyData: Map<sensor_id, HourlyRollup[]>
  expandedSensorId: string | null
    ↓
Render:
  {sensors.map(sensor => 
    <SensorCard 
      reading={sensor}
      hourlyRollup={hourlyData.get(sensor.sensor_id) ?? []}
      isExpanded={expandedSensorId === sensor.sensor_id}
      onToggle={() => setExpandedSensorId(
        expandedSensorId === sensor.sensor_id ? null : sensor.sensor_id
      )}
    />
  )}
    ↓
User clicks card header → onToggle → state update →
CSS transition triggers → expand/collapse animation →
Sparklines render from hourlyRollup data
```

**Performance consideration**: Fetching hourly rollup for up to 5 fields × 18 sensors = up to 90 parallel requests. Mitigation: The devices page already limits to 5 fields (`FIELDS_TO_SHOW = 5`). We batch the hourly rollup per field (not per sensor), so it's at most 5 additional API calls.

### 5.4 Feature 4: Crop Icons

```
[crop-icons.ts] ← single source of truth
    ↓
[fields/page.tsx]  ── imports getCropEmoji → renders in field cards
[field-card.tsx]   ── imports getCropEmoji → renders in FieldCard component
    ↓
Field data from API has crop_type string
    ↓
getCropEmoji(field.crop_type) → returns 🍌 or 🌱 (fallback)
    ↓
Rendered in <span> element at 2xl size
```

---

## 6. Key Decisions

### 6.1 Why ILIKE, not Full-Text Search (FTS)

| Factor | ILIKE | PostgreSQL FTS |
|--------|-------|----------------|
| Complexity | Zero — simple SQL operator | Requires `tsvector` column + GIN index |
| Query syntax | `name ILIKE '%corn%'` | `to_tsvector('spanish', name) @@ to_tsquery('spanish', 'corn')` |
| Case-insensitive | Built-in (ILIKE) | Requires `simple` configuration |
| Partial match | Yes (wildcards on both sides) | No — FTS is stem/lexeme based |
| Performance on <10k rows | <5ms with index | Similar |
| Maintenance | None | Must maintain tsvector column |
| Migration risk | None | Schema change, index build time |

**Decision**: ILIKE. The fields table is expected to stay under 10,000 rows per tenant. ILIKE with a composite index on `(name, crop_type)` gives sub-millisecond performance. FTS would be overengineering for a simple name/crop search.

### 6.2 Why Expand (Accordion), not Modal

| Factor | Expand/Collapse | Modal |
|--------|----------------|-------|
| Context preservation | User sees card grid behind expanded data | Modal covers everything |
| Interaction cost | 1 click to expand, 1 to collapse | 1 click to open, must dismiss |
| Mobile UX | Scrolling works naturally | Modal can feel trapped |
| Implementation | Pure CSS transition | Portal + overlay + focus trap |
| Multiple data sets | Accordion: only 1 open at a time | Requires managing dismissal |

**Decision**: Expand/collapse (accordion). The sparkline is supplemental context — users want to glance at trends without leaving the sensor overview page. A modal would break the browsing flow and add accessibility complexity.

### 6.3 Why Join to Tenants (not Denormalized)

Could add `country`/`region` directly to the `fields` table to avoid the JOIN. Rejected because:
- Country/region are TENANT attributes — denormalizing would require syncing on tenant update
- A tenant may move regions; with denormalization we'd need to UPDATE all their fields
- The JOIN is on a foreign key with an index — negligible cost
- Follows the principle of "one source of truth"

### 6.4 Why 300ms Debounce, not on every keystroke

300ms is the standard for search-as-you-type:
- Short enough to feel instant (< 100ms is imperceptible improvement)
- Long enough to batch rapid typing (average typing speed: ~200ms per character)
- Prevents API thundering for fast typists

### 6.5 Why Two Separate SensorCard Components Exist

The codebase has TWO sensor-card components:
- `components/devices/sensor-card.tsx` — device listing card with multiple metrics, used on `/devices` page
- `components/sensor-card.tsx` — single-metric card with trend arrow + sparklineData prop

**Decision**: Modify `components/devices/sensor-card.tsx` for F3 (expand/sparkline). Do NOT merge the two — they serve different purposes (multi-metric device overview vs single-metric gauge).

### 6.6 Why Recharts Sparklines (not a custom SVG)

- Recharts is already a dependency (used in field detail page for temp/humidity charts)
- Tree-shaking ensures only `LineChart`, `Line`, `XAxis`, `YAxis`, `ResponsiveContainer` are bundled
- Estimated bundle impact: < 2KB gzipped (shared from existing Recharts import)
- No need for a custom SVG sparkline library

---

## 7. Migration Plan

### Phase 1: Backend — Data Model + API (no frontend changes)

| Step | File(s) | Description |
|------|---------|-------------|
| 1.1 | `models_tenant.py` | Add `country`, `region` columns to Tenant ORM |
| 1.2 | `alembic/versions/009_add_tenant_country_region.py` | Create migration, add+remove test |
| 1.3 | `fields/schemas.py` | Update `FieldResponse` if needed (no change — country/region not exposed in field response) |
| 1.4 | `auth/schemas.py` | Add `country` field to `SignupRequest` |
| 1.5 | `auth.py` | Propagate `country` from signup to tenant creation |
| 1.6 | `fields/service.py` | Add `q`, `country`, `region` params to `list_fields()` |
| 1.7 | `fields/router.py` | Wire new query params to service |
| 1.8 | `seed.py` | Update tenant seed data with country/region |

**Verification**: Run migration up+down. Call `GET /api/v1/fields?q=test` and verify response. Call with `?country=EC` and verify filtering.

### Phase 2: Frontend — Crop Icons (no backend dependency)

| Step | File(s) | Description |
|------|---------|-------------|
| 2.1 | `web/src/lib/crop-icons.ts` | Create with all 18 crop emojis + `getCropEmoji()` |
| 2.2 | `web/src/app/dashboard/fields/page.tsx` | Replace inline CROP_EMOJIS with import |
| 2.3 | `web/src/components/field-card.tsx` | Replace inline CROP_EMOJIS with import |

### Phase 3: Frontend — Search + Sensor Cards

| Step | File(s) | Description |
|------|---------|-------------|
| 3.1 | `web/src/lib/api.ts` | Update `getFields()` to accept `q`, `country`, `region` params |
| 3.2 | `web/src/lib/hooks.ts` | Update `useFields()` to pass `q` param |
| 3.3 | `web/src/app/dashboard/fields/page.tsx` | Replace client-side filter with debounced API call |
| 3.4 | `web/src/components/devices/sensor-card.tsx` | Add expand/collapse + sparklines |
| 3.5 | `web/src/app/dashboard/devices/page.tsx` | Add `expandedSensorId` state, fetch hourly rollup, wire props |

### Rollback Plan

- **Migration 009**: `alembic downgrade 008` removes columns — all data preserved in transaction log if downgrade is immediate
- **API changes**: Remove `q`, `country`, `region` params from router — clients that send them get ignored
- **Frontend**: Revert to previous sensor-card.tsx; remove crop-icons.ts import; components fall back to inline emojis

### Zero-downtime Order

```
migration 009 (add columns, non-blocking ALTER)
  ↓
deploy backend (new router + service)
  ↓
deploy frontend (crop-icons, search, sensor cards)
  ↓
seed script update (adds country/region to existing tenant)
```

The `ALTER TABLE ... ADD COLUMN` with a non-null default is a fast metadata-only operation in PostgreSQL (no table rewrite when default is a constant).

---

## Appendix: Files Changed Summary

| File | Change Type | Feature |
|------|------------|---------|
| `backend/app/domain/auth/models_tenant.py` | Modified | F1 |
| `backend/alembic/versions/009_add_tenant_country_region.py` | New | F1 |
| `backend/app/domain/auth/schemas.py` | Modified | F1 |
| `backend/app/api/v1/auth.py` | Modified | F1 |
| `backend/app/domain/fields/service.py` | Modified | F1 + F2 |
| `backend/app/domain/fields/router.py` | Modified | F1 + F2 |
| `backend/app/seed.py` | Modified | F1 |
| `web/src/lib/crop-icons.ts` | New | F4 |
| `web/src/components/field-card.tsx` | Modified | F4 |
| `web/src/app/dashboard/fields/page.tsx` | Modified | F2 + F4 |
| `web/src/lib/api.ts` | Modified | F2 |
| `web/src/lib/hooks.ts` | Modified | F2 |
| `web/src/components/devices/sensor-card.tsx` | Modified | F3 |
| `web/src/app/dashboard/devices/page.tsx` | Modified | F3 |
