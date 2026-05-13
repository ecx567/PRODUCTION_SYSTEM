/**
 * React hooks for the Crop Production System dashboard.
 *
 * Provides:
 * - useSSE(url) — EventSource wrapper for real-time alerts
 * - useAlerts() — stateful alert management
 * - useSensorData(fieldId) — polling-based sensor readings
 * - useFields() — field list fetching
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AlertEventResponse,
  type FieldResponse,
  type SensorReadingResponse,
  type RecommendationSummary,
  type StoredRecommendationItem,
  type YieldPredictionResponse,
  acknowledgeAlert,
  getAlertEvents,
  getField,
  getFieldSensors,
  getFields,
  getAnalyticsSummary,
  getRecommendationSummary,
  getStoredRecommendations,
  getYieldPrediction,
  type SensorReadingSummary,
  type HourlyRollup,
  getHourlyRollup,
} from "./api";

// ── SSE Hook ───────────────────────────────────────────────────

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SSE_URL = `${BASE_URL}/api/v1/alerts/stream`;

interface UseSSEReturn {
  /** Most recent alerts received via SSE */
  liveAlerts: AlertEventResponse[];
  /** Connection status */
  isConnected: boolean;
  /** Error message if the connection failed */
  error: string | null;
}

/**
 * Subscribe to the SSE alert stream.
 *
 * Uses native EventSource which auto-reconnects on connection loss.
 * Cleans up on unmount.
 */
export function useSSE(): UseSSEReturn {
  const [liveAlerts, setLiveAlerts] = useState<AlertEventResponse[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(SSE_URL, {
      withCredentials: true,
    });

    es.addEventListener("alert", (event: MessageEvent) => {
      try {
        const alertData: AlertEventResponse = JSON.parse(event.data);
        setLiveAlerts((prev) => [alertData, ...prev].slice(0, 50)); // keep latest 50
      } catch {
        // Ignore malformed data
      }
    });

    es.addEventListener("heartbeat", () => {
      // Connection is alive — no action needed
    });

    es.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    es.onerror = () => {
      setIsConnected(false);
      // EventSource auto-reconnects natively — just update status
    };

    eventSourceRef.current = es;

    return () => {
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, []);

  return { liveAlerts, isConnected, error };
}

// ── Alerts Hook ────────────────────────────────────────────────

interface UseAlertsReturn {
  /** Paginated list of alert events from REST API */
  events: AlertEventResponse[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Pagination cursor for "load more" */
  nextCursor: string | null;
  /** Total events matching filter */
  total: number;
  /** Acknowledge an alert event */
  acknowledge: (eventId: string) => Promise<void>;
  /** Fetch next page */
  loadMore: () => Promise<void>;
  /** Refetch from the beginning */
  refresh: () => Promise<void>;
}

/**
 * Stateful alert management with pagination and acknowledge.
 */
export function useAlerts(
  severity?: string,
  acknowledged?: boolean,
): UseAlertsReturn {
  const [events, setEvents] = useState<AlertEventResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const cursorRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAlertEvents(undefined, 50, severity, acknowledged);
      setEvents(data.items);
      setNextCursor(data.next_cursor);
      setTotal(data.total);
      cursorRef.current = data.next_cursor;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load alerts";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [severity, acknowledged]);

  const loadMore = useCallback(async () => {
    if (!cursorRef.current) return;
    setIsLoading(true);
    try {
      const data = await getAlertEvents(
        cursorRef.current,
        50,
        severity,
        acknowledged,
      );
      setEvents((prev) => [...prev, ...data.items]);
      setNextCursor(data.next_cursor);
      cursorRef.current = data.next_cursor;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load more alerts";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [severity, acknowledged]);

  const acknowledge = useCallback(async (eventId: string) => {
    try {
      const updated = await acknowledgeAlert(eventId);
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, ...updated } : e)),
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to acknowledge alert";
      setError(msg);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    events,
    isLoading,
    error,
    nextCursor,
    total,
    acknowledge,
    loadMore,
    refresh,
  };
}

// ── Sensor Data Hook ───────────────────────────────────────────

interface UseSensorDataReturn {
  /** Latest sensor readings for the field */
  sensors: SensorReadingResponse[];
  /** Summary analytics */
  summary: SensorReadingSummary | null;
  /** Hourly rollup for charts */
  hourlyRollup: HourlyRollup[];
  /** Field details */
  field: FieldResponse | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetch sensor data, analytics summary, and field details for a given field.
 * Refetches every 30 seconds for near-real-time updates.
 */
export function useSensorData(fieldId: string): UseSensorDataReturn {
  const [sensors, setSensors] = useState<SensorReadingResponse[]>([]);
  const [summary, setSummary] = useState<SensorReadingSummary | null>(null);
  const [hourlyRollup, setHourlyRollup] = useState<HourlyRollup[]>([]);
  const [field, setField] = useState<FieldResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!fieldId) return;
    try {
      const [sensorsData, summaryData, hourlyData, fieldData] =
        await Promise.all([
          getFieldSensors(fieldId),
          getAnalyticsSummary(fieldId),
          getHourlyRollup(fieldId),
          getField(fieldId),
        ]);
      setSensors(sensorsData);
      setSummary(summaryData);
      setHourlyRollup(hourlyData);
      setField(fieldData);
      setError(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load sensor data";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [fieldId]);

  useEffect(() => {
    setIsLoading(true);
    fetchData();

    // Poll every 30 seconds
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { sensors, summary, hourlyRollup, field, isLoading, error };
}

// ── Fields Hook ────────────────────────────────────────────────

interface UseFieldsReturn {
  fields: FieldResponse[];
  isLoading: boolean;
  error: string | null;
  total: number;
}

/**
 * Fetch the list of fields for the current tenant.
 * Accepts an optional search query ``q`` to filter by name/crop_type.
 */
export function useFields(q?: string): UseFieldsReturn {
  const [fields, setFields] = useState<FieldResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    async function load() {
      try {
        const data = await getFields(undefined, 20, q);
        if (!cancelled) {
          setFields(data.items);
          setTotal(data.total);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : "Failed to load fields";
          setError(msg);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [q]);

  return { fields, isLoading, error, total };
}

// ── Recommendations Hook ─────────────────────────────────────

interface UseRecommendationsReturn {
  summary: RecommendationSummary | null;
  storedItems: StoredRecommendationItem[] | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetch the current recommendation summary for a field.
 * Includes irrigation, fertilization, and pest risk recommendations.
 */
export function useRecommendations(
  fieldId: string,
): UseRecommendationsReturn {
  const [summary, setSummary] = useState<RecommendationSummary | null>(null);
  const [storedItems, setStoredItems] = useState<StoredRecommendationItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!fieldId) return;
    setIsLoading(true);
    setError(null);
    try {
      // Try stored recommendations first (have real IDs for lifecycle PATCH)
      const stored = await getStoredRecommendations(fieldId);
      if (stored.items.length > 0) {
        setStoredItems(stored.items);
        setSummary(null);
      } else {
        // Fallback to real-time engine summary
        const data = await getRecommendationSummary(fieldId);
        setSummary(data);
        setStoredItems(null);
      }
    } catch (err: unknown) {
      // Fallback to real-time on error
      try {
        const data = await getRecommendationSummary(fieldId);
        setSummary(data);
        setStoredItems(null);
      } catch {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to load recommendations";
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fieldId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, storedItems, isLoading, error, refresh: fetchSummary };
}

// ── Yield Prediction Hook ────────────────────────────────────

interface UsePredictionReturn {
  prediction: YieldPredictionResponse | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetch the current yield prediction for a field.
 * Includes confidence interval, data quality, and model version.
 */
export function usePrediction(fieldId: string): UsePredictionReturn {
  const [prediction, setPrediction] =
    useState<YieldPredictionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = useCallback(async () => {
    if (!fieldId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getYieldPrediction(fieldId);
      setPrediction(data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load yield prediction";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [fieldId]);

  useEffect(() => {
    fetchPrediction();
  }, [fetchPrediction]);

  return { prediction, isLoading, error, refresh: fetchPrediction };
}
