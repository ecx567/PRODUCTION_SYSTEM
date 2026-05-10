/**
 * API client for the Crop Production System backend.
 *
 * - JWT in-memory auth matching web pattern
 * - Auto-refresh on 401 with single retry
 * - Typed functions for all mobile endpoints
 * - Network error resilience
 */

// ── Types matching backend schemas ─────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

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

// ── Sync types ─────────────────────────────────────────────────

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

// ── Configuration ──────────────────────────────────────────────

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

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

export function isAuthenticated(): boolean {
  return accessToken !== null;
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

export class NetworkError extends Error {
  constructor(cause: string) {
    super(`Network error: ${cause}`);
    this.name = "NetworkError";
  }
}

// ── Fetch wrapper ──────────────────────────────────────────────

interface FetchOptions extends RequestInit {
  raw?: boolean;
  skipAuth?: boolean;
}

async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { raw, skipAuth, ...fetchOptions } = options;
  const url = `${BASE_URL}${path}`;

  const headers = new Headers(fetchOptions.headers);

  if (!headers.has("Content-Type") && fetchOptions.body) {
    headers.set("Content-Type", "application/json");
  }

  // Inject auth token if available
  if (!skipAuth && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let res: Response;

  try {
    res = await fetch(url, { ...fetchOptions, headers });
  } catch (err) {
    throw new NetworkError(err instanceof Error ? err.message : String(err));
  }

  // ── Auto-refresh on 401 ─────────────────────────────────────
  if (res.status === 401 && refreshToken && !skipAuth) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      const retryHeaders = new Headers(headers);
      retryHeaders.set("Authorization", `Bearer ${accessToken}`);

      try {
        res = await fetch(url, { ...fetchOptions, headers: retryHeaders });
      } catch (err) {
        throw new NetworkError(
          err instanceof Error ? err.message : String(err),
        );
      }
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

// ── Auth ───────────────────────────────────────────────────────

export async function loginUser(
  email: string,
  password: string,
): Promise<TokenResponse> {
  const data = await apiFetch<TokenResponse>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    },
  );
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

// ── Alerts ─────────────────────────────────────────────────────

export async function getAlertEvents(
  cursor?: string,
  pageSize = 50,
  severity?: string,
): Promise<AlertEventList> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("page_size", String(pageSize));
  if (severity) params.set("severity", severity);
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

// ── Recommendations ────────────────────────────────────────────

export async function getRecommendations(
  fieldId: string,
): Promise<RecommendationSummary> {
  return apiFetch<RecommendationSummary>(
    `/api/v1/fields/${fieldId}/recommendations`,
  );
}

// ── Sync ───────────────────────────────────────────────────────

export async function syncWithServer(
  request: SyncRequest,
): Promise<SyncResponse> {
  return apiFetch<SyncResponse>("/api/v1/mobile/sync", {
    method: "POST",
    body: JSON.stringify(request),
  });
}
