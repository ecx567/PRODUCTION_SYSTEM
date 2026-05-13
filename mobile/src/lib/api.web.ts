/**
 * Web-compatible API mock for browser preview.
 *
 * Returns realistic demo data for all endpoints so the app renders
 * fully in the browser without a backend.
 */

// ── Types (mirror api.ts) ───────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

export interface FieldResponse {
  id: string;
  tenant_id: string;
  name: string;
  crop_type: string;
  planted_at: string | null;
  area_ha: number;
  location: string | null;
  created_at: string | null;
  deleted_at: string | null;
}

export interface FieldList {
  items: FieldResponse[];
  next_cursor: string | null;
  total: number;
}

export interface SensorReadingResponse {
  time: string;
  tenant_id: string;
  sensor_id: string;
  field_id: string;
  temp: number | null;
  humidity: number | null;
  soil_moisture: number | null;
  rain: number | null;
}

export interface SensorReadingSummary {
  period_start: string;
  period_end: string;
  avg_temp: number | null;
  avg_humidity: number | null;
  avg_soil_moisture: number | null;
  total_rain: number | null;
  reading_count: number;
  sensor_count: number;
}

export interface AlertEventResponse {
  id: string;
  rule_id: string;
  field_id: string;
  metric_type: string;
  actual_value: number;
  threshold: number;
  severity: string;
  message: string;
  triggered_at: string;
  acknowledged_at: string | null;
}

export interface AlertEventList {
  items: AlertEventResponse[];
  next_cursor: string | null;
  total: number;
}

export interface RecommendationSummary {
  field_id: string;
  irrigation: IrrigationRecommendation | null;
  fertilization: FertilizationRecommendation | null;
  pest_risk: PestRiskAlert | null;
  generated_at: string;
}

export interface IrrigationRecommendation {
  action: "irrigate" | "skip" | "monitor";
  eto_mm: number;
  soil_moisture_pct: number;
  depletion_pct: number;
  amount_mm: number;
  confidence: string;
}

export interface FertilizationRecommendation {
  action: "apply" | "delay" | "skip";
  stage: string;
  nitrogen_kg_ha: number;
  phosphorus_kg_ha: number;
  potassium_kg_ha: number;
  confidence: string;
}

export interface PestRiskAlert {
  pest_type: string;
  risk_level: "low" | "moderate" | "high" | "severe";
  gdd_accumulated: number;
  gdd_threshold: number;
  favorable_conditions: boolean;
  recommendation: string;
}

export interface SyncRequest {
  since_rev: number | null;
  mutations: SyncMutation[];
}

export interface SyncMutation {
  table: string;
  mutation_id: string;
  action: "create" | "update" | "delete";
  record_id: string;
  data: Record<string, unknown>;
  base_rev: number;
  client_rev: number;
}

export interface SyncResponse {
  server_rev: number;
  changes: SyncChange[];
  conflicts: SyncConflict[];
}

export interface SyncChange {
  table: string;
  action: "create" | "update" | "delete";
  record_id: string;
  data: Record<string, unknown>;
  server_rev: number;
}

export interface SyncConflict {
  table: string;
  record_id: string;
  server_data: Record<string, unknown>;
  client_data: Record<string, unknown>;
  resolution: "server_wins";
}

// ── Error types (stubs) ─────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
  }
}

export class NetworkError extends Error {
  constructor(cause: string) {
    super(`Network error: ${cause}`);
    this.name = "NetworkError";
  }
}

// ── Token management (in-memory) ───────────────────────────────

let accessToken: string | null = "demo-token";
let refreshToken: string | null = "demo-refresh";

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function isAuthenticated(): boolean {
  return accessToken !== null;
}

// ── Mock data generators ───────────────────────────────────────

const now = new Date();
const daysAgo = (n: number) =>
  new Date(now.getTime() - n * 86400000).toISOString();

// All 18 crop types with realistic field data
const CROP_TYPES = [
  "corn", "soybean", "wheat", "rice", "cotton",
  "sugarcane", "coffee", "sunflower", "sorghum", "barley",
  "potato", "tomato", "grape", "orange", "apple",
  "banana", "cassava", "peanut",
] as const;

const FIELD_NAMES = [
  "North Field", "South Field", "East Pasture", "West Valley",
  "River Bend", "Hill Top", "Sunny Meadow", "Creek Side",
  "Prairie View", "Lake View", "Mountain Side", "Delta Plot",
] as const;

const MOCK_FIELDS: FieldResponse[] = FIELD_NAMES.map((name, i) => ({
  id: `field-${i + 1}`,
  tenant_id: "demo-tenant",
  name,
  crop_type: CROP_TYPES[i % CROP_TYPES.length],
  planted_at: daysAgo(60 + Math.floor(Math.random() * 90)),
  area_ha: Math.round((5 + Math.random() * 45) * 100) / 100,
  location: `${-30 + Math.random() * 10},${-60 + Math.random() * 10}`,
  created_at: daysAgo(200),
  deleted_at: null,
}));

const SEVERITIES = ["critical", "warning", "info"] as const;
const METRICS = ["temperature", "humidity", "soil_moisture", "rain"] as const;

const MOCK_ALERTS: AlertEventResponse[] = Array.from(
  { length: 15 },
  (_, i) => {
    const sev = SEVERITIES[i % SEVERITIES.length];
    const metric = METRICS[i % METRICS.length];
    const field = MOCK_FIELDS[i % MOCK_FIELDS.length];
    return {
      id: `alert-${i + 1}`,
      rule_id: `rule-${(i % 5) + 1}`,
      field_id: field.id,
      metric_type: metric,
      actual_value: Math.round(Math.random() * 50 * 10) / 10,
      threshold: 30,
      severity: sev,
      message: `${field.name}: ${metric} ${sev === "critical" ? "critically high" : sev === "warning" ? "above threshold" : "returned to normal"}`,
      triggered_at: daysAgo(i * 2),
      acknowledged_at: i % 3 === 0 ? daysAgo(i * 2 - 1) : null,
    };
  },
);

function generateSensorHistory(fieldId: string): SensorReadingResponse[] {
  const readings: SensorReadingResponse[] = [];
  for (let h = 0; h < 72; h++) {
    readings.push({
      time: new Date(now.getTime() - h * 3600000).toISOString(),
      tenant_id: "demo-tenant",
      sensor_id: `sensor-${fieldId}-${(h % 3) + 1}`,
      field_id: fieldId,
      temp: Math.round((20 + Math.sin(h * 0.2) * 8 + (Math.random() - 0.5) * 4) * 10) / 10,
      humidity: Math.round((60 + Math.sin(h * 0.15) * 15 + (Math.random() - 0.5) * 8) * 10) / 10,
      soil_moisture: Math.round((35 + Math.sin(h * 0.1) * 10 + (Math.random() - 0.5) * 5) * 10) / 10,
      rain: Math.random() > 0.85 ? Math.round(Math.random() * 12 * 10) / 10 : 0,
    });
  }
  return readings;
}

// ── Auth ───────────────────────────────────────────────────────

export async function loginUser(
  _email: string,
  _password: string,
): Promise<TokenResponse> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 800));
  accessToken = "demo-token";
  refreshToken = "demo-refresh";
  return { access_token: "demo-token", refresh_token: "demo-refresh" };
}

// ── Fields ─────────────────────────────────────────────────────

export async function getFields(
  _cursor?: string,
  _pageSize = 20,
): Promise<FieldList> {
  return {
    items: MOCK_FIELDS,
    next_cursor: null,
    total: MOCK_FIELDS.length,
  };
}

export async function getField(
  id: string,
): Promise<FieldResponse> {
  const field = MOCK_FIELDS.find((f) => f.id === id);
  if (!field) throw new ApiError(404, "Field not found");
  return field;
}

// ── Sensors ────────────────────────────────────────────────────

export async function getFieldSensors(
  fieldId: string,
): Promise<SensorReadingResponse[]> {
  return generateSensorHistory(fieldId).slice(0, 5);
}

export async function getSensorHistory(
  fieldId: string,
  _startTime?: string,
  _endTime?: string,
  _limit = 100,
): Promise<SensorReadingResponse[]> {
  return generateSensorHistory(fieldId);
}

// ── Analytics ──────────────────────────────────────────────────

export async function getAnalyticsSummary(
  fieldId: string,
): Promise<SensorReadingSummary> {
  const history = generateSensorHistory(fieldId);
  const temps = history.filter((r) => r.temp !== null).map((r) => r.temp!);
  const hums = history.filter((r) => r.humidity !== null).map((r) => r.humidity!);
  const moist = history.filter((r) => r.soil_moisture !== null).map((r) => r.soil_moisture!);
  const rains = history.filter((r) => r.rain !== null && r.rain > 0).map((r) => r.rain!);

  return {
    period_start: daysAgo(3),
    period_end: new Date().toISOString(),
    avg_temp: temps.length > 0 ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : null,
    avg_humidity: hums.length > 0 ? Math.round((hums.reduce((a, b) => a + b, 0) / hums.length) * 10) / 10 : null,
    avg_soil_moisture: moist.length > 0 ? Math.round((moist.reduce((a, b) => a + b, 0) / moist.length) * 10) / 10 : null,
    total_rain: rains.length > 0 ? Math.round(rains.reduce((a, b) => a + b, 0) * 10) / 10 : null,
    reading_count: history.length,
    sensor_count: 3,
  };
}

// ── Alerts ─────────────────────────────────────────────────────

export async function getAlertEvents(
  _cursor?: string,
  _pageSize = 50,
  severity?: string,
): Promise<AlertEventList> {
  const items = severity
    ? MOCK_ALERTS.filter((a) => a.severity === severity)
    : MOCK_ALERTS;
  return { items, next_cursor: null, total: items.length };
}

export async function acknowledgeAlert(
  eventId: string,
): Promise<AlertEventResponse> {
  const alert = MOCK_ALERTS.find((a) => a.id === eventId);
  if (!alert) throw new ApiError(404, "Alert not found");
  alert.acknowledged_at = new Date().toISOString();
  return alert;
}

// ── Recommendations ────────────────────────────────────────────

export async function getRecommendations(
  fieldId: string,
): Promise<RecommendationSummary> {
  return {
    field_id: fieldId,
    irrigation: {
      action: Math.random() > 0.5 ? "irrigate" : "monitor",
      eto_mm: Math.round(Math.random() * 8 * 10) / 10,
      soil_moisture_pct: Math.round((25 + Math.random() * 30) * 10) / 10,
      depletion_pct: Math.round((40 + Math.random() * 30) * 10) / 10,
      amount_mm: Math.round((10 + Math.random() * 20) * 10) / 10,
      confidence: "medium",
    },
    fertilization: {
      action: Math.random() > 0.6 ? "apply" : "delay",
      stage: "vegetative",
      nitrogen_kg_ha: Math.round(60 + Math.random() * 40),
      phosphorus_kg_ha: Math.round(20 + Math.random() * 20),
      potassium_kg_ha: Math.round(30 + Math.random() * 30),
      confidence: "medium",
    },
    pest_risk: {
      pest_type: "Armyworm",
      risk_level: Math.random() > 0.6 ? "high" : "moderate",
      gdd_accumulated: Math.round(350 + Math.random() * 200),
      gdd_threshold: 450,
      favorable_conditions: Math.random() > 0.4,
      recommendation: "Monitor field edges for larva activity. Consider treatment if threshold exceeded.",
    },
    generated_at: new Date().toISOString(),
  };
}

// ── Sync ───────────────────────────────────────────────────────

export async function syncWithServer(
  _request: SyncRequest,
): Promise<SyncResponse> {
  return {
    server_rev: Date.now(),
    changes: [],
    conflicts: [],
  };
}
