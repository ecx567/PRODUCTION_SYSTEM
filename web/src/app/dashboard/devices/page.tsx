"use client";

import { useCallback, useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw, Radio, Search } from "lucide-react";
import { useSSE } from "@/lib/hooks";
import {
  getFields,
  getFieldSensors,
  type FieldResponse,
  type SensorReadingResponse,
} from "@/lib/api";
import SensorCard from "@/components/devices/sensor-card";

// ── Types ──────────────────────────────────────────────────────

interface SensorWithField extends SensorReadingResponse {
  fieldName: string;
}

interface LoadingField {
  id: string;
  name: string;
}

// ── Constants ───────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;
const MAX_FIELDS_BEFORE_LIMIT = 10;
const FIELDS_TO_SHOW = 5;

// ── Component ──────────────────────────────────────────────────

export default function DevicesPage() {
  const { isConnected } = useSSE();

  const [sensors, setSensors] = useState<SensorWithField[]>([]);
  const [allFields, setAllFields] = useState<FieldResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isFieldLimited, setIsFieldLimited] = useState(false);

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      // 1. Fetch all fields for the tenant
      const fieldData = await getFields(undefined, 50);
      const activeFields = fieldData.items;
      setAllFields(activeFields);

      // 2. If there are many fields, limit how many we query for sensors
      const hasManyFields = activeFields.length > MAX_FIELDS_BEFORE_LIMIT;
      setIsFieldLimited(hasManyFields);
      const fieldsToQuery = hasManyFields
        ? activeFields.slice(0, FIELDS_TO_SHOW)
        : activeFields;

      // 3. For each field, fetch latest sensor readings in parallel
      const results = await Promise.allSettled(
        fieldsToQuery.map(async (field) => {
          const readings = await getFieldSensors(field.id);
          return readings.map(
            (r): SensorWithField => ({
              ...r,
              fieldName: field.name,
            }),
          );
        }),
      );

      // 4. Flatten results (only fulfilled ones)
      const allSensors: SensorWithField[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") {
          allSensors.push(...result.value);
        }
      }
      // Sensors arrive newest-first (sensors endpoint returns latest per sensor),
      // but we want consistent ordering: by field name, then by sensor_id
      allSensors.sort((a, b) => {
        const fieldCmp = a.fieldName.localeCompare(b.fieldName);
        if (fieldCmp !== 0) return fieldCmp;
        return a.sensor_id.localeCompare(b.sensor_id);
      });

      setSensors(allSensors);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Unable to load sensor data";
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    fetchData(true);

    const interval = setInterval(() => fetchData(false), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Render helpers ─────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header isConnected={isConnected} />
        <SkeletonGrid />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Header isConnected={isConnected} />
        <ErrorState message={error} onRetry={() => fetchData(true)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header isConnected={isConnected} lastUpdated={lastUpdated} isRefreshing={isRefreshing} />

      {/* Field limit notice */}
      {isFieldLimited && (
        <div className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-xs text-sky-700">
          Showing sensors from the first {FIELDS_TO_SHOW} fields only.
          Your farm has {allFields.length} fields registered.
        </div>
      )}

      {/* Empty state */}
      {sensors.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          data-testid="sensor-grid"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {sensors.map((sensor) => (
            <SensorCard
              key={`${sensor.sensor_id}-${sensor.field_id}`}
              reading={sensor}
              fieldName={sensor.fieldName}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function Header({
  isConnected,
  lastUpdated,
  isRefreshing,
}: {
  isConnected: boolean;
  lastUpdated?: Date | null;
  isRefreshing?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-leaf-700">Devices</h1>
        <p className="text-sm text-soil-500">
          Live sensor readings across all fields
        </p>
      </div>

      {/* Connection status + last updated */}
      <div className="flex items-center gap-3">
        {lastUpdated && (
          <p className="text-xs text-soil-400">
            Updated {lastUpdated.toLocaleTimeString()}
          </p>
        )}
        {isRefreshing && (
          <RefreshCw className="h-4 w-4 animate-spin text-leaf-400" />
        )}
        <div
          data-testid="sse-status"
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
            isConnected
              ? "bg-leaf-100 text-leaf-600"
              : "bg-danger-50 text-danger-600"
          }`}
        >
          {isConnected ? (
            <Wifi className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          {isConnected ? "SSE Connected" : "SSE Disconnected"}
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div
      data-testid="loading-skeleton"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="dashboard-card animate-pulse space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-4 w-28 rounded bg-leaf-100" />
              <div className="h-3 w-20 rounded bg-leaf-50" />
            </div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4].map((b) => (
                <div key={b} className="h-4 w-1.5 rounded-sm bg-leaf-100" />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((m) => (
              <div key={m} className="rounded-lg bg-leaf-50/50 p-2">
                <div className="h-3 w-14 rounded bg-leaf-100" />
                <div className="mt-1 h-5 w-16 rounded bg-leaf-200" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-leaf-100 pt-2">
            <div className="h-3 w-16 rounded bg-leaf-100" />
            <div className="h-4 w-12 rounded-full bg-leaf-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      data-testid="empty-state"
      className="dashboard-card flex flex-col items-center justify-center py-16 text-center"
    >
      <Radio className="mb-4 h-12 w-12 text-leaf-200" />
      <h3 className="text-base font-semibold text-leaf-700">
        No sensor data available
      </h3>
      <p className="mt-1 max-w-sm text-sm text-soil-400">
        Check sensor connectivity. Sensors will appear here automatically once
        they start reporting data.
      </p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      data-testid="error-state"
      className="dashboard-card flex flex-col items-center justify-center py-16 text-center"
    >
      <Search className="mb-4 h-12 w-12 text-danger-300" />
      <h3 className="text-base font-semibold text-leaf-700">
        Unable to load sensor data
      </h3>
      <p className="mt-1 max-w-sm text-sm text-soil-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-leaf-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-leaf-600"
      >
        <RefreshCw className="h-4 w-4" />
        Retry
      </button>
    </div>
  );
}
