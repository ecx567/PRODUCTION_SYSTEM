/**
 * API client for the Crop Production System backend.
 *
 * - Base URL from NEXT_PUBLIC_API_URL env var
 * - JWT auth header injection
 * - Auto-refresh on 401 with retry
 * - Typed functions for all dashboard endpoints
 */

// ── Types matching backend schemas ─────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
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
  total_rain: number | null;
}

export interface SensorGap {
  sensor_id: string;
  last_seen: string;
  gap_minutes: number;
}

// ── Token management (in-memory) ───────────────────────────────

let accessToken: string | null = null;
let refreshToken: string | null = null;

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

// ── Fetch wrapper ──────────────────────────────────────────────

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

  // Inject auth token if available
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let res = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: "include",
  });

  // ── Auto-refresh on 401 ─────────────────────────────────────
  if (res.status === 401 && refreshToken) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      // Retry original request with new token
      const retryHeaders = new Headers(headers);
      retryHeaders.set("Authorization", `Bearer ${accessToken}`);

      res = await fetch(url, {
        ...fetchOptions,
        headers: retryHeaders,
        credentials: "include",
      });
    }
  }

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

async function attemptTokenRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      credentials: "include",
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const data: TokenResponse = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    clearTokens();
    return false;
  }
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

// ── Auth ───────────────────────────────────────────────────────

export async function loginUser(
  email: string,
  password: string,
): Promise<TokenResponse> {
  const data = await apiFetch<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

/** Cookie-based session check — calls GET /api/v1/auth/session.
 *  Returns user info or null (no session). */
export interface SessionUser {
  user_id: string;
  email: string;
  role: string;
  tenant_id: string;
}

export async function checkSession(): Promise<SessionUser | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/session`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as SessionUser;
  } catch {
    return null;
  }
}

/** Cookie-based logout — calls POST /api/v1/auth/logout, then clears in-memory tokens. */
export async function serverLogout(): Promise<void> {
  try {
    await fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Swallow — best-effort server-side logout
  }
  clearTokens();
}

/** Signup — creates user, backend sets cookies, returns tokens for legacy compat. */
export async function signupUser(
  email: string,
  password: string,
  name?: string,
): Promise<TokenResponse> {
  const body: Record<string, string> = { email, password };
  if (name) body.name = name;

  const data = await apiFetch<TokenResponse>("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
  });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

// ── Fields ─────────────────────────────────────────────────────

export async function getFields(
  cursor?: string,
  pageSize = 20,
): Promise<FieldList> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("page_size", String(pageSize));
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
  return apiFetch<HourlyRollup[]>(
    `/api/v1/fields/${fieldId}/analytics/hourly?${params.toString()}`,
  );
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
