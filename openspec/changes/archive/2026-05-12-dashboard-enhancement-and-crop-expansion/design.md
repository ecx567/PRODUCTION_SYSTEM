# Design: Dashboard Enhancement & Crop Expansion

**6 deliverables. Implementation order: Crop Expansion → Alert Rules → Devices → Analytics → Open-Meteo → Settings.**

---

## 1. Crop Expansion (Enum → String)

### Component Tree
None — pure backend change.

### Data Flow
`Schema validation (ALLOWED_CROP_TYPES) → SQLAlchemy String(50) column → DB`

### State Management
N/A.

### API Contracts
No new endpoints. `FieldCreate.crop_type` validator expands to accept new crops. Sample valid types:

```
"coffee", "sugarcane", "soybean", "sunflower", "palm_oil", "cotton"
```

### File Map
| File | Action | What |
|------|--------|------|
| `backend/app/domain/fields/models.py` | Modify | `crop_type`: `Enum → String(50)`, remove `create_type=False` |
| `backend/app/domain/fields/schemas.py` | Modify | Add +6 to `ALLOWED_CROP_TYPES` (coffee, sugarcane, soybean, sunflower, palm_oil, cotton) |
| `backend/app/seed.py` | Modify | Add new-crop fields + sensor ranges to `SEED_FIELDS` / `SENSOR_MAP` / `FIELD_RULES_BY_CROP` |
| `backend/alembic/versions/006_crop_type_string.py` | Create | `ALTER COLUMN crop_type TYPE VARCHAR(50) USING crop_type::text` |

### Route Design
No changes.

### DB Schema Changes
```sql
ALTER TABLE fields 
  ALTER COLUMN crop_type TYPE VARCHAR(50);
DROP TYPE IF EXISTS crop_type;
```

### Error States
N/A.

### Edge Cases
- **Existing data**: `USING crop_type::text` preserves values during migration
- **Old enum type**: Drop type only after migration succeeds (in separate step)
- **Seed idempotency**: `ON CONFLICT DO NOTHING` on sensor_readings; skip-if-exists on fields/rules

---

## 2. Alert Rules CRUD (Modal UI)

### Component Tree
```
RulesPage (page.tsx)
├── RulesHeader (title + "New Rule" button)
├── RulesList
│   └── RuleCard (per rule)
│       ├── enable/disable toggle
│       ├── edit button → RuleFormModal
│       └── delete button → DeleteConfirmDialog
└── RuleFormModal (create/edit shared)
    ├── name, metric_type, condition, threshold
    ├── field_id selector, severity, cooldown
    └── enable toggle
```

**Props:**
- `RuleFormModal`: `{ rule?: AlertRule; open: boolean; onClose: () => void; onSaved: (rule: AlertRule) => void }`
- `DeleteConfirmDialog`: `{ rule: AlertRule; open: boolean; onClose: () => void; onDeleted: (id: string) => void }`

### Data Flow
```
User action → apiFetch(POST|PUT|DELETE /api/v1/alerts/rules) → response → setRules(prev => [...])
```

### State Management
| State | Location | Type |
|-------|----------|------|
| `rules: AlertRule[]` | `RulesPage` | `useState` |
| `loading: boolean` | `RulesPage` | `useState` |
| `error: string\|null` | `RulesPage` | `useState` |
| `modalOpen/modalMode` | `RulesPage` | `useState<'create'\|'edit'\|null>` |
| `editingRule` | `RulesPage` | `useState<AlertRule\|null>` |
| `deleteConfirm` | `RulesPage` | `useState<string\|null>` (rule id) |

### API Contracts
Existing endpoints — no changes needed:

```
POST   /api/v1/alerts/rules → AlertRuleResponse
PUT    /api/v1/alerts/rules/{id} → AlertRuleResponse
DELETE /api/v1/alerts/rules/{id} → 204 No Content
```

### File Map
| File | Action | What |
|------|--------|------|
| `web/src/app/dashboard/rules/page.tsx` | Modify | Add modal CRUD, wire up POST/PUT/DELETE |
| `web/src/lib/api.ts` | Modify | Add `createRule()`, `updateRule()`, `deleteRule()` |
| `web/src/components/rules/rule-form-modal.tsx` | Create | Shared create/edit form |
| `web/src/components/rules/delete-dialog.tsx` | Create | Confirm delete |

### Route Design
No changes.

### DB Schema Changes
None.

### Error States
| State | UI |
|-------|-----|
| Loading | Spinner overlay on modal submit |
| Validation error | Inline field errors (400 from API) |
| Network error | Toast + retry button |
| Delete conflict | Error toast if rule not found (404) |

### Edge Cases
- **Concurrent edits**: PUT replaces entire rule — last-write-wins (acceptable v1)
- **Delete while editing**: Refetch after delete; close modal if editing deleted rule
- **Rapid double-click**: Disable submit button after first click; use `loading` state

---

## 3. Devices Page (Live Sensor Data)

### Component Tree
```
DevicesPage (page.tsx)
├── DevicesHeader (title + last-updated timestamp)
├── ConnectionStatus (SSE indicator)
└── SensorGrid
    └── SensorCard (× N sensors)
        ├── metric label + value
        ├── unit badge
        └── last_seen relative time
```

**Props:**
- `SensorCard`: `{ reading: SensorReadingResponse; fieldName?: string }`

### Data Flow
```
useEffect on mount → apiFetch(/api/v1/fields) → for each field → apiFetch(/fields/{id}/sensors) → aggregate by sensor_id → render SensorGrid
```

### State Management
| State | Location | Type |
|-------|----------|------|
| `fields: FieldResponse[]` | `DevicesPage` | `useState` |
| `sensors: SensorReadingResponse[]` | `DevicesPage` | `useState` (flat, all fields) |
| `loading: boolean` | `DevicesPage` | `useState` |
| `error: string\|null` | `DevicesPage` | `useState` |

### API Contracts (existing)
```
GET /api/v1/fields → FieldList (paginated)
GET /api/v1/fields/{id}/sensors?limit=50 → SensorReadingResponse[]
```

### File Map
| File | Action | What |
|------|--------|------|
| `web/src/app/dashboard/devices/page.tsx` | Rewrite | Replace placeholders with live sensor grid |
| `web/src/components/devices/sensor-card.tsx` | Create | Metric card with value/unit/last-seen |
| `web/src/lib/api.ts` | Modify | Add `getLatestReadings(fieldId)` alias if missing (uses existing `getFieldSensors`) |

### Route Design
No changes.

### DB Schema Changes
None. Queries existing `sensor_readings` via ingestion router.

### Error States
| State | UI |
|-------|-----|
| Loading | Skeleton grid (12 shimmer cards) |
| Empty | "No sensors registered" with icon |
| Error | Alert banner + retry button |
| Partial data | Render available cards, show warning for failed fields |

### Edge Cases
- **Field with 0 sensors**: Show empty card with "No readings yet" message
- **Stale data (>1h old)**: Grey out card, show "Stale" badge + last_seen timestamp
- **Large field count (>10)**: Limit to first 5 fields, add "view all fields" link
- **Polling**: 30s interval via `setInterval` (matches existing `useSensorData` pattern)

---

## 4. Analytics Page (Cross-Field Recharts)

### Component Tree
```
AnalyticsPage (page.tsx)
├── AnalyticsHeader (title + date range selector)
├── SummaryCards (4 KPI cards)
│   ├── Avg Temp, Avg Humidity, Avg Soil Moisture, Total Rain
├── FieldSelector (dropdown/tabs)
└── ChartGrid
    ├── TemperatureChart (LineChart — 72h)
    ├── HumidityChart (AreaChart — 72h)
    ├── SoilMoistureChart (BarChart — 24h)
    └── RainfallChart (BarChart — 72h)
```

**Props:** All local to page — no prop drilling.

### Data Flow
```
Select field → getAnalyticsSummary(fieldId) + getHourlyRollup(fieldId) → Recharts renders
```

### State Management
| State | Location | Type |
|-------|----------|------|
| `selectedFieldId` | `AnalyticsPage` | `useState<string\|null>` |
| `fields` | `AnalyticsPage` | `useState<FieldResponse[]>` |
| `summary` | `AnalyticsPage` | `useState<SensorReadingSummary\|null>` |
| `hourlyRollup` | `AnalyticsPage` | `useState<HourlyRollup[]>` |
| `loading` | `AnalyticsPage` | `useState` |

### API Contracts (existing)
```
GET /api/v1/fields → FieldList
GET /api/v1/fields/{id}/analytics/summary → SensorReadingSummary
GET /api/v1/fields/{id}/analytics/hourly?start_time=...&end_time=... → HourlyRollup[]
```

### File Map
| File | Action | What |
|------|--------|------|
| `web/src/app/dashboard/analytics/page.tsx` | Rewrite | Replace placeholders with Recharts dashboard |
| `web/src/components/analytics/summary-cards.tsx` | Create | 4 KPI metric cards in a grid |
| `web/src/components/analytics/temp-chart.tsx` | Create | LineChart — temperature over time |
| `web/src/components/analytics/humidity-chart.tsx` | Create | AreaChart — humidity over time |
| `web/src/components/analytics/precip-chart.tsx` | Create | BarChart — rain over time |

### Route Design
No changes.

### DB Schema Changes
None.

### Error States
| State | UI |
|-------|-----|
| No field selected | "Select a field to view analytics" prompt |
| No data for field | "No sensor data available" per chart |
| Loading | Skeleton charts (animated rectangles) |
| API error | Per-chart error boundary |

### Edge Cases
- **Field with no readings**: Summary returns nulls → show "Insufficient data" KPI cards
- **Single reading in window**: Line chart shows a single dot (still valid)
- **Time zone**: All timestamps are UTC — display as-is with "All times UTC" label
- **Rapid field switch**: Cancel in-flight requests on field change (AbortController)

---

## 5. Open-Meteo Weather Service

### Component Tree
N/A — backend-only service layer.

### Data Flow
```
Frontend → GET /api/v1/weather/current?lat=...&lng=... → Backend
  → OpenMeteoService.fetch_forecast(lat, lng)
    → httpx.get(https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&hourly=temperature_2m,relative_humidity_2m,precipitation&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&timezone=auto)
    → Parse + transform → JSON response
```

### State Management
N/A (server-side). Response optionally cached in Redis with 30-min TTL.

### API Contracts (new)
```
GET /api/v1/weather/current?lat={lat}&lng={lng}
Response: {
  "location": { "lat": float, "lng": float },
  "current": {
    "temperature_2m": float | null,
    "relative_humidity_2m": float | null,
    "precipitation": float | null,
    "weather_code": int | null,
    "time": str
  },
  "hourly": [
    { "time": str, "temperature_2m": float, "relative_humidity_2m": float, "precipitation": float }
  ],
  "units": { "temperature_2m": "°C", ... }
}

GET /api/v1/weather/forecast?lat={lat}&lng={lng}&days=7
Response: Same shape as /current but with 7-day daily aggregation
```

### File Map
| File | Action | What |
|------|--------|------|
| `backend/app/domain/weather/__init__.py` | Create | Package init |
| `backend/app/domain/weather/service.py` | Create | `OpenMeteoService` — httpx client |
| `backend/app/domain/weather/schemas.py` | Create | Pydantic request/response schemas |
| `backend/app/domain/weather/router.py` | Create | `GET /weather/current`, `GET /weather/forecast` |
| `backend/app/main.py` | Modify | Import + mount `weather_router` |
| `backend/requirements.txt` | Modify | Move `httpx` above dev section (explicit prod dep) |
| `web/src/lib/api.ts` | Modify | Add `getCurrentWeather()`, `getWeatherForecast()` |

### Route Design
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/weather/current` | Current conditions + 24h hourly |
| GET | `/api/v1/weather/forecast` | 7-day daily forecast |

### DB Schema Changes
None (cache-only via Redis if available).

### Error States
| State | Behaviour |
|-------|-----------|
| Open-Meteo down | Return 503 with `{"detail": "Weather service unavailable"}` |
| Invalid coords | Return 400 — "Latitude must be -90..90" |
| Rate limited | Log warning, return cached data if available, else 429 |
| Network timeout | 5s httpx timeout; return 504 if exceeded |

### Edge Cases
- **Extreme coords** (pole): Open-Meteo handles gracefully — pass through
- **Missing variables**: All response fields nullable; client handles nulls
- **Cache stampede**: Use Redis with `NX` to allow single concurrent refresh
- **No API key**: Open-Meteo is free + no auth — zero setup

---

## 6. Settings Page (Sectioned)

### Component Tree
```
SettingsPage (page.tsx)
├── SettingsNav (tab bar: Profile | Notifications | Display | API Keys)
└── SettingsSection (renders active tab content)
    ├── ProfileSection — name, email, role display
    ├── NotificationsSection — severity toggles, SSE toggle
    ├── DisplaySection — theme toggle, timezone, metric units
    └── ApiKeysSection — read-only key display, regenerate button
```

### Data Flow
```
User edits field → onChange → update localStorage → re-render from localStorage
No backend calls (v1).
```

### State Management
| State | Location | Persistence |
|-------|----------|-------------|
| `settings` | `SettingsPage` | `localStorage('crop.settings')` |
| `activeTab` | `SettingsPage` | `useState<'profile'\|'notifications'\|'display'\|'api-keys'>` |

Settings shape:
```ts
interface UserSettings {
  profile: { displayName: string; email: string; role: string };
  notifications: { pushEnabled: boolean; sseEnabled: boolean; criticalOnly: boolean };
  display: { theme: 'light'|'dark'|'system'; timezone: string; unitSystem: 'metric'|'imperial' };
  apiKeys: { key: string; createdAt: string };
}
```

### API Contracts
None for v1. Profile data read from JWT token claims.

### File Map
| File | Action | What |
|------|--------|------|
| `web/src/app/dashboard/settings/page.tsx` | Rewrite | Replace placeholder with tabbed sections |
| `web/src/lib/settings.ts` | Create | `loadSettings()`, `saveSettings()`, defaults |
| `web/src/components/settings/profile-section.tsx` | Create | Display-only profile from JWT |
| `web/src/components/settings/notifications-section.tsx` | Create | Toggles for alert prefs |
| `web/src/components/settings/display-section.tsx` | Create | Theme/timezone/units |
| `web/src/components/settings/api-keys-section.tsx` | Create | Read-only key display |

### Route Design
Existing: `/dashboard/settings` (already in sidebar nav).

### DB Schema Changes
None.

### Error States
| State | UI |
|-------|-----|
| localStorage corrupt | Reset to defaults silently, toast notification |
| storage quota exceeded | Error toast, save fails gracefully |
| No JWT claims | Show "sign in to view profile" |

### Edge Cases
- **localStorage cleared**: All settings reset to defaults — acceptable v1
- **Multiple tabs**: Each tab has independent state (no cross-tab sync — v1)
- **Regenerate API key**: Client-side UUID generation only for display (placeholder)

---

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | Crop schema validation | Test `validate_crop_type` with new + old + invalid values |
| Unit | Weather service | Mock httpx, test response parsing, error handling |
| Integration | Alert CRUD UI | Playwright: create rule → assert list updated, delete → assert gone |
| Integration | Devices page | Playwright: mock sensors response → assert cards render |
| Integration | Analytics charts | Playwright: mock hourly data → assert Recharts renders |
| E2E | Settings persistence | Fill settings → reload → assert values persisted |
| Migration | Crop type | `alembic upgrade` + `downgrade` on test DB with seed data |

## Migration / Rollout

1. **Crop migration first** — run `alembic upgrade head` before deploying new backend
2. **Backend deploy** — weather router + httpx prod dep
3. **Frontend deploy** — all 4 page rewrites + components
4. No feature flags required (cohesive release)

## Open Questions

- [ ] Should settings have a backend persistence layer for multi-device sync? (Deferred to v2)
- [ ] Should devices page include sensor gap detection from `/analytics/gaps`? (Add in v2)
- [ ] Open-Meteo: cache duration? (30-min default — confirm with team)
