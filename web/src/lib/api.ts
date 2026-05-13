/**
 * API client for the Crop Production System backend.
 *
 * Public/visualization mode — no auth required.
 * All endpoints are accessible without authentication.
 */

// ── Types matching backend schemas ─────────────────────────────

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
  ingestion_ts: string | null;
  validation_status: string;
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

export interface AlertRuleResponse {
  id: string;
  tenant_id: string;
  field_id: string | null;
  name: string;
  metric_type: string;
  condition: string;
  threshold: number;
  threshold_max: number | null;
  severity: string;
  enabled: boolean;
  cooldown_minutes: number;
}

export interface HourlyRollup {
  hour: string;
  avg_temp: number | null;
  min_temp: number | null;
  max_temp: number | null;
  avg_humidity: number | null;
  avg_soil_moisture: number | null;
  total_rain: number | null;
}

export interface SensorGap {
  sensor_id: string;
  last_seen: string;
  gap_minutes: number;
}

export interface SessionUser {
  user_id: string;
  email: string;
  role: string;
  tenant_id: string;
}

// ── Fetch wrapper (no auth — public mode) ──────────────────────

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FetchOptions extends RequestInit {
  /** Skip the JSON parse and return raw Response (e.g. for 204 No Content) */
  raw?: boolean;
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { raw, ...fetchOptions } = options;
  const url = `${BASE_URL}${path}`;

  const headers = new Headers(fetchOptions.headers);

  if (!headers.has("Content-Type") && fetchOptions.body) {
    headers.set("Content-Type", "application/json");
  }

  let res = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    let detail = body;
    try {
      const parsed = JSON.parse(body);
      detail = parsed.detail ?? parsed.message ?? body;
    } catch {
      // body is plain text
    }
    throw new ApiError(res.status, detail);
  }

  if (raw || res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ── Custom error class ─────────────────────────────────────────

export class ApiError extends Error {
  status: number;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
  }
}

// ── Fields ─────────────────────────────────────────────────────

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

export async function getField(id: string): Promise<FieldResponse> {
  return apiFetch<FieldResponse>(`/api/v1/fields/${id}`);
}

// ── Sensors ────────────────────────────────────────────────────

export async function getFieldSensors(
  fieldId: string,
): Promise<SensorReadingResponse[]> {
  return apiFetch<SensorReadingResponse[]>(
    `/api/v1/fields/${fieldId}/sensors`,
  );
}

export async function getSensorHistory(
  fieldId: string,
  startTime?: string,
  endTime?: string,
  limit = 100,
): Promise<SensorReadingResponse[]> {
  const params = new URLSearchParams();
  if (startTime) params.set("start_time", startTime);
  if (endTime) params.set("end_time", endTime);
  params.set("limit", String(limit));
  return apiFetch<SensorReadingResponse[]>(
    `/api/v1/fields/${fieldId}/sensors/history?${params.toString()}`,
  );
}

// ── Analytics ──────────────────────────────────────────────────

export async function getAnalyticsSummary(
  fieldId: string,
): Promise<SensorReadingSummary> {
  return apiFetch<SensorReadingSummary>(
    `/api/v1/fields/${fieldId}/analytics/summary`,
  );
}

export async function getHourlyRollup(
  fieldId: string,
  startTime?: string,
  endTime?: string,
): Promise<HourlyRollup[]> {
  const params = new URLSearchParams();
  if (startTime) params.set("start_time", startTime);
  if (endTime) params.set("end_time", endTime);
  const data = await apiFetch<
    (HourlyRollup & { bucket?: string })[]
  >(`/api/v1/fields/${fieldId}/analytics/hourly?${params.toString()}`);
  return data.map((item) => ({
    ...item,
    hour: item.hour ?? item.bucket ?? "",
  }));
}

// ── Alert Events ───────────────────────────────────────────────

export async function getAlertEvents(
  cursor?: string,
  pageSize = 50,
  severity?: string,
  acknowledged?: boolean,
): Promise<AlertEventList> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("page_size", String(pageSize));
  if (severity) params.set("severity", severity);
  if (acknowledged !== undefined)
    params.set("acknowledged", String(acknowledged));
  return apiFetch<AlertEventList>(
    `/api/v1/alerts/events?${params.toString()}`,
  );
}

export async function acknowledgeAlert(
  eventId: string,
): Promise<AlertEventResponse> {
  return apiFetch<AlertEventResponse>(
    `/api/v1/alerts/events/${eventId}/acknowledge`,
    { method: "POST" },
  );
}

// ── Alert Rules CRUD ────────────────────────────────────────────────────

export interface AlertRuleList {
  items: AlertRuleResponse[];
  total: number;
}

export interface AlertRuleCreate {
  name: string;
  field_id?: string | null;
  metric_type: string;
  condition: string;
  threshold: number;
  threshold_max?: number | null;
  severity: string;
  enabled: boolean;
  cooldown_minutes: number;
}

export interface AlertRuleUpdate {
  name?: string;
  field_id?: string | null;
  metric_type?: string;
  condition?: string;
  threshold?: number;
  threshold_max?: number | null;
  severity?: string;
  enabled?: boolean;
  cooldown_minutes?: number;
}

export async function getRules(): Promise<AlertRuleList> {
  return apiFetch<AlertRuleList>("/api/v1/alerts/rules");
}

export async function createRule(
  data: AlertRuleCreate,
): Promise<AlertRuleResponse> {
  return apiFetch<AlertRuleResponse>("/api/v1/alerts/rules", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateRule(
  ruleId: string,
  data: AlertRuleUpdate,
): Promise<AlertRuleResponse> {
  return apiFetch<AlertRuleResponse>(`/api/v1/alerts/rules/${ruleId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteRule(ruleId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/alerts/rules/${ruleId}`, {
    method: "DELETE",
  });
}

// ── Weather ─────────────────────────────────────────────────────

export interface CurrentWeatherResponse {
  latitude: number;
  longitude: number;
  temperature_2m: number;
  relative_humidity_2m: number;
  precipitation: number;
  soil_moisture_0_to_7cm: number;
  et0_fao_evapotranspiration: number;
  vapour_pressure_deficit: number;
  time: string;
  units: Record<string, string>;
}

export interface ForecastDay {
  date: string;
  temperature_2m_max: number | null;
  temperature_2m_min: number | null;
  precipitation_sum: number | null;
  et0_fao_evapotranspiration: number | null;
}

export interface ForecastResponse {
  latitude: number;
  longitude: number;
  days: number;
  units: Record<string, string>;
  daily: ForecastDay[];
}

export async function getCurrentWeather(
  lat: number,
  lon: number,
): Promise<CurrentWeatherResponse> {
  const params = new URLSearchParams();
  params.set("lat", String(lat));
  params.set("lon", String(lon));
  return apiFetch<CurrentWeatherResponse>(
    `/api/v1/weather/current?${params.toString()}`,
  );
}

export async function getWeatherForecast(
  lat: number,
  lon: number,
  days = 7,
): Promise<ForecastResponse> {
  const params = new URLSearchParams();
  params.set("lat", String(lat));
  params.set("lon", String(lon));
  params.set("days", String(days));
  return apiFetch<ForecastResponse>(
    `/api/v1/weather/forecast?${params.toString()}`,
  );
}

// ── Sensor Gaps ────────────────────────────────────────────────

export async function getSensorGaps(
  fieldId: string,
  thresholdMinutes = 30,
): Promise<SensorGap[]> {
  const params = new URLSearchParams();
  params.set("threshold_minutes", String(thresholdMinutes));
  return apiFetch<SensorGap[]>(
    `/api/v1/fields/${fieldId}/analytics/gaps?${params.toString()}`,
  );
}

// ── Crop Profiles ─────────────────────────────────────────────

export interface CropProfileResponse {
  name: string;
  kc_initial: number;
  kc_mid: number;
  kc_end: number;
  stage_lengths: number[];
  taw_default: number;
  gdd_base_temp: number;
  fertilizer_rates: Record<string, Record<string, number>>;
  pests: Array<{
    name: string;
    gdd_threshold: number;
    description: string;
  }>;
}

export interface CropProfileList {
  items: CropProfileResponse[];
  total: number;
}

export async function getCropProfiles(): Promise<CropProfileList> {
  return apiFetch<CropProfileList>("/api/v1/crop-profiles");
}

// ── Recommendation Lifecycle ───────────────────────────────────

export type RecommendationStatus =
  | "active"
  | "acknowledged"
  | "dismissed"
  | "applied";

export type RecommendationSeverity =
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical";

export interface RecommendationStatusUpdate {
  status: RecommendationStatus;
  comment?: string;
}

export interface RecommendationStatusResponse {
  id: string;
  field_id: string;
  type: string;
  status: RecommendationStatus;
  severity: RecommendationSeverity;
  title: string | null;
  acknowledged_at: string | null;
  dismissed_at: string | null;
  updated_at: string | null;
}

/** Update the lifecycle status of a stored recommendation. */
export async function updateRecommendationStatus(
  recommendationId: string,
  body: RecommendationStatusUpdate,
): Promise<RecommendationStatusResponse> {
  return apiFetch<RecommendationStatusResponse>(
    `/api/v1/recommendations/${recommendationId}/status`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

// ── Stored Recommendation List (from scheduler) ─────────────

export interface StoredRecommendationItem {
  id: string;
  field_id: string;
  type: string;
  payload: Record<string, unknown>;
  generated_at: string;
  status: RecommendationStatus;
  severity: RecommendationSeverity;
  title: string | null;
  acknowledged_at: string | null;
  dismissed_at: string | null;
  applied_at: string | null;
}

export interface StoredRecommendationList {
  items: StoredRecommendationItem[];
  total: number;
}

/** List stored recommendations for a field (generated by scheduler). */
export async function getStoredRecommendations(
  fieldId: string,
  status?: RecommendationStatus,
  limit = 20,
): Promise<StoredRecommendationList> {
  const params = new URLSearchParams({ field_id: fieldId, limit: String(limit) });
  if (status) params.set("status", status);
  return apiFetch<StoredRecommendationList>(
    `/api/v1/recommendations?${params}`,
  );
}

// ── Recommendation Summary (real-time from engine) ────────────

export interface IrrigationRecommendation {
  field_id: string;
  timestamp: string;
  eto_mm: number;
  etc_mm: number;
  effective_rain_mm: number;
  irrigation_needed_mm: number;
  soil_moisture_current: number | null;
  soil_moisture_target: number | null;
  depletion_percent: number;
  recommendation: "water" | "monitor" | "skip";
  confidence: number;
}

export interface FertilizationRecommendation {
  field_id: string;
  crop_type: string;
  growth_stage: "planting" | "vegetative" | "reproductive";
  n_kg_ha: number;
  p_kg_ha: number;
  k_kg_ha: number;
  recommendation: "apply" | "delay" | "skip";
  reasoning: string;
}

export interface PestRiskAlert {
  field_id: string;
  crop_type: string;
  pest_name: string;
  risk_level: "low" | "medium" | "high";
  conditions_favorable: boolean;
  accumulated_gdd: number;
  gdd_threshold: number;
  temperature_avg: number | null;
  humidity_avg: number | null;
  leaf_wetness_hours: number | null;
  recommendation: string;
}

export interface RecommendationSummary {
  field_id: string;
  irrigation: IrrigationRecommendation | null;
  fertilization: FertilizationRecommendation | null;
  pest_risk: PestRiskAlert[];
  generated_at: string;
}

/** Fetch the real-time recommendation summary for a field. */
export async function getRecommendationSummary(
  fieldId: string,
): Promise<RecommendationSummary> {
  return apiFetch<RecommendationSummary>(
    `/api/v1/fields/${fieldId}/recommendations`,
  );
}

// ── Yield Prediction ──────────────────────────────────────────

export interface YieldPredictionResponse {
  field_id: string;
  predicted_yield_kg_ha: number;
  lower_bound: number;
  upper_bound: number;
  model_version: string;
  data_quality: "high" | "medium" | "low" | "insufficient";
  features_used: string[];
  generated_at: string;
}

export interface PredictionHistoryEntry {
  prediction_id: string;
  predicted_yield_kg_ha: number;
  actual_yield_kg_ha: number | null;
  error_pct: number | null;
  generated_at: string;
  model_version: string;
}

export interface PredictionHistoryResponse {
  field_id: string;
  predictions: PredictionHistoryEntry[];
  total: number;
}

/** Fetch the current yield prediction for a field. */
export async function getYieldPrediction(
  fieldId: string,
): Promise<YieldPredictionResponse> {
  return apiFetch<YieldPredictionResponse>(
    `/api/v1/fields/${fieldId}/predictions/yield`,
  );
}

/** Fetch historical yield predictions for a field. */
export async function getPredictionHistory(
  fieldId: string,
  limit = 20,
): Promise<PredictionHistoryResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  return apiFetch<PredictionHistoryResponse>(
    `/api/v1/fields/${fieldId}/predictions/history?${params.toString()}`,
  );
}
