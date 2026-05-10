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

async function apiFetch<T>(
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
