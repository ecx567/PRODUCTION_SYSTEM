"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getFields,
  getAnalyticsSummary,
  getHourlyRollup,
  getSensorGaps,
  type FieldResponse,
  type SensorReadingSummary,
  type HourlyRollup,
  type SensorGap,
} from "@/lib/api";
import SummaryCards from "@/components/analytics/summary-cards";
import TempChart from "@/components/analytics/temp-chart";
import HumidityChart from "@/components/analytics/humidity-chart";
import PrecipChart from "@/components/analytics/precip-chart";
import { AlertTriangle, CheckCircle } from "lucide-react";

type TimeRange = 24 | 72;

export default function AnalyticsPage() {
  const [fields, setFields] = useState<FieldResponse[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(72);
  const [summary, setSummary] = useState<SensorReadingSummary | null>(null);
  const [hourlyData, setHourlyData] = useState<HourlyRollup[]>([]);
  const [gaps, setGaps] = useState<SensorGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldsLoading, setFieldsLoading] = useState(true);

  // ── Load fields on mount ────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getFields();
        if (!cancelled) {
          setFields(data.items);
          if (data.items.length > 0) {
            setSelectedFieldId(data.items[0].id);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load fields",
          );
        }
      } finally {
        if (!cancelled) setFieldsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Load analytics data when field changes ──────────────────

  const loadAnalytics = useCallback(async () => {
    if (!selectedFieldId) return;
    setLoading(true);
    setError(null);

    try {
      const [summaryData, hourlyRaw, gapsData] = await Promise.all([
        getAnalyticsSummary(selectedFieldId),
        getHourlyRollup(selectedFieldId),
        getSensorGaps(selectedFieldId),
      ]);
      setSummary(summaryData);
      setHourlyData(hourlyRaw);
      setGaps(gapsData);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load analytics",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedFieldId]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // ── Format hourly data for charts ────────────────────────────

  const chartData = hourlyData.map((h) => ({
    time: new Date(h.hour).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    temp: h.avg_temp,
    minTemp: h.min_temp,
    maxTemp: h.max_temp,
    humidity: h.avg_humidity,
    rain: h.total_rain,
  }));

  const filteredData =
    timeRange === 24 ? chartData.slice(-24) : chartData;

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-leaf-800">Analytics</h1>
          <p className="text-sm text-soil-500">
            Cross-field sensor trends and insights
          </p>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Field selector */}
        <div className="min-w-[200px]">
          <label htmlFor="field-select" className="sr-only">
            Select field
          </label>
          <select
            id="field-select"
            data-testid="field-select"
            value={selectedFieldId ?? ""}
            onChange={(e) => setSelectedFieldId(e.target.value || null)}
            className="w-full rounded-lg border border-leaf-200 bg-white px-3 py-2 text-sm text-leaf-700 outline-none focus:border-leaf-500 focus:ring-1 focus:ring-leaf-500"
          >
            {fieldsLoading ? (
              <option value="">Loading fields…</option>
            ) : fields.length === 0 ? (
              <option value="">No fields available</option>
            ) : (
              fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.crop_type})
                </option>
              ))
            )}
          </select>
        </div>

        {/* Time range selector */}
        <div className="flex gap-1 rounded-lg border border-leaf-200 p-1">
          {([24, 72] as TimeRange[]).map((range) => (
            <button
              key={range}
              data-testid={`time-range-${range}`}
              onClick={() => setTimeRange(range)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                timeRange === range
                  ? "bg-leaf-500 text-white"
                  : "text-soil-500 hover:bg-leaf-50"
              }`}
            >
              {range}h
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          data-testid="error-state"
          className="flex items-center gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-600"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* No fields state */}
      {!fieldsLoading && fields.length === 0 && (
        <div
          data-testid="empty-state"
          className="dashboard-card py-12 text-center"
        >
          <p className="text-sm text-soil-400">
            Create a field to view analytics
          </p>
        </div>
      )}

      {/* No field selected */}
      {selectedFieldId === null && fields.length > 0 && (
        <div className="dashboard-card py-12 text-center">
          <p className="text-sm text-soil-400">
            Select a field to view analytics
          </p>
        </div>
      )}

      {/* Analytics content */}
      {selectedFieldId && (
        <>
          {/* Summary KPI cards */}
          <SummaryCards summary={summary} loading={loading} />

          {/* Chart grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="dashboard-card">
              <h3 className="mb-4 text-sm font-semibold text-leaf-800">
                Temperature Trend ({timeRange}h)
              </h3>
              <TempChart data={filteredData} loading={loading} />
            </div>

            <div className="dashboard-card">
              <h3 className="mb-4 text-sm font-semibold text-leaf-800">
                Humidity Trend ({timeRange}h)
              </h3>
              <HumidityChart
                data={filteredData.map((d) => ({
                  time: d.time,
                  humidity: d.humidity,
                }))}
                loading={loading}
              />
            </div>

            <div className="dashboard-card lg:col-span-2">
              <h3 className="mb-4 text-sm font-semibold text-leaf-800">
                Rainfall ({timeRange}h)
              </h3>
              <PrecipChart
                data={filteredData.map((d) => ({
                  time: d.time,
                  rain: d.rain,
                }))}
                loading={loading}
              />
            </div>
          </div>

          {/* Gap detection table */}
          <div className="dashboard-card">
            <h3 className="mb-4 text-sm font-semibold text-leaf-800">
              Sensor Gaps
            </h3>
            {loading ? (
              <div className="h-24 animate-pulse rounded bg-leaf-100" />
            ) : gaps.length === 0 ? (
              <div
                data-testid="all-healthy"
                className="flex items-center gap-2 text-sm text-leaf-600"
              >
                <CheckCircle className="h-4 w-4" />
                All sensors reporting normally
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table
                  data-testid="gaps-table"
                  className="w-full text-left text-sm"
                >
                  <thead>
                    <tr className="border-b border-leaf-100 text-xs font-medium text-soil-500">
                      <th className="pb-2 pr-4">Sensor ID</th>
                      <th className="pb-2 pr-4">Last Seen</th>
                      <th className="pb-2">Gap (minutes)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gaps.map((g) => (
                      <tr
                        key={g.sensor_id}
                        className="border-b border-leaf-50 text-sm text-leaf-700"
                      >
                        <td className="py-2 pr-4 font-mono text-xs">
                          {g.sensor_id.slice(0, 8)}…
                        </td>
                        <td className="py-2 pr-4 text-xs text-soil-400">
                          {new Date(g.last_seen).toLocaleString()}
                        </td>
                        <td className="py-2">
                          <span className="inline-flex items-center rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-600">
                            {g.gap_minutes}m
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
