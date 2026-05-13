"use client";

import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import {
  Thermometer,
  Droplets,
  Waves,
  CloudRain,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
} from "lucide-react";
import { useSensorData, useRecommendations, usePrediction } from "@/lib/hooks";
import RecommendationCard from "@/components/recommendation-card";
import YieldPredictionCard from "@/components/yield-prediction-card";
import type { RecommendationStatus } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from "recharts";

export default function FieldDetailPage() {
  const params = useParams();
  const fieldId = params.id as string;
  const { sensors, summary, hourlyRollup, field, isLoading, error } =
    useSensorData(fieldId);
  const {
    summary: recSummary,
    storedItems: recStoredItems,
    isLoading: recLoading,
    error: recError,
    refresh: recRefresh,
  } = useRecommendations(fieldId);
  const {
    prediction,
    isLoading: predLoading,
    error: predError,
    refresh: predRefresh,
  } = usePrediction(fieldId);

  // Track lifecycle status per recommendation type (client-side optimistic)
  const [lifecycleStatuses, setLifecycleStatuses] = useState<
    Record<string, RecommendationStatus>
  >({});

  const handleRecStatusChange = useCallback(
    (type: string, newStatus: RecommendationStatus) => {
      setLifecycleStatuses((prev) => ({ ...prev, [type]: newStatus }));
    },
    [],
  );

  function trendIcon(
    current: number | null,
    previous: number | null,
  ) {
    if (current === null || previous === null) return null;
    if (current > previous)
      return <ArrowUp className="h-3.5 w-3.5 text-danger-500" />;
    if (current < previous)
      return <ArrowDown className="h-3.5 w-3.5 text-leaf-500" />;
    return <Minus className="h-3.5 w-3.5 text-soil-400" />;
  }

  // Format hourly data for charts
  const tempChartData = hourlyRollup.map((h) => ({
    time: new Date(h.hour).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    temp: h.avg_temp,
    minTemp: h.min_temp,
    maxTemp: h.max_temp,
  }));

  const humidityChartData = hourlyRollup.map((h) => ({
    time: new Date(h.hour).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    humidity: h.avg_humidity,
  }));

  return (
    <div className="space-y-6">
      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          <div className="h-6 w-48 animate-pulse rounded bg-leaf-100" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="dashboard-card h-24 animate-pulse" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-leaf-100" />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-600">
          {error}
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && field && (
        <>
          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-leaf-800">{field.name}</h1>
            <p className="text-sm capitalize text-soil-500">
              {field.crop_type} · {field.area_ha} ha
              {field.planted_at &&
                ` · Planted ${new Date(field.planted_at).toLocaleDateString()}`}
            </p>
          </div>

          {/* Sensor gauges */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              {
                label: "Temperature",
                icon: Thermometer,
                value: summary?.avg_temp,
                unit: "°C",
                color: "text-sunlight-500",
                bg: "bg-sunlight-50",
                iconBg: "bg-sunlight-100",
              },
              {
                label: "Humidity",
                icon: Droplets,
                value: summary?.avg_humidity,
                unit: "%",
                color: "text-sky-500",
                bg: "bg-sky-50",
                iconBg: "bg-sky-100",
              },
              {
                label: "Soil Moisture",
                icon: Waves,
                value: summary?.avg_soil_moisture,
                unit: "%",
                color: "text-leaf-500",
                bg: "bg-leaf-50",
                iconBg: "bg-leaf-100",
              },
              {
                label: "Rain",
                icon: CloudRain,
                value: summary?.total_rain,
                unit: "mm",
                color: "text-soil-500",
                bg: "bg-soil-50",
                iconBg: "bg-soil-100",
              },
            ].map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className={`dashboard-card ${metric.bg}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="stat-label">{metric.label}</p>
                      <p className={`stat-value ${metric.color}`}>
                        {metric.value !== null && metric.value !== undefined
                          ? `${metric.value.toFixed(1)}${metric.unit}`
                          : "—"}
                      </p>
                    </div>
                    <div className={`rounded-lg ${metric.iconBg} p-2`}>
                      <Icon className={`h-5 w-5 ${metric.color}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Temperature chart */}
          <div className="dashboard-card">
            <h3 className="mb-4 text-sm font-semibold text-leaf-800">
              Temperature Trend (Last 72h)
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tempChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1edda" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: "#6f5b43" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#6f5b43" }}
                    unit="°C"
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #d1edda",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="temp"
                    stroke="#2d6a4f"
                    strokeWidth={2}
                    dot={false}
                    name="Avg Temp"
                  />
                  <Line
                    type="monotone"
                    dataKey="minTemp"
                    stroke="#7ec8e3"
                    strokeWidth={1}
                    dot={false}
                    name="Min Temp"
                  />
                  <Line
                    type="monotone"
                    dataKey="maxTemp"
                    stroke="#e76f51"
                    strokeWidth={1}
                    dot={false}
                    name="Max Temp"
                  />
                  <Brush
                    dataKey="time"
                    height={30}
                    stroke="#2d6a4f"
                    fill="#edf7f0"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Humidity chart */}
          <div className="dashboard-card">
            <h3 className="mb-4 text-sm font-semibold text-leaf-800">
              Humidity Trend (Last 72h)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={humidityChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1edda" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: "#6f5b43" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#6f5b43" }}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #d1edda",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="humidity"
                    stroke="#7ec8e3"
                    strokeWidth={2}
                    dot={false}
                    name="Humidity"
                  />
                  <Brush
                    dataKey="time"
                    height={30}
                    stroke="#2d6a4f"
                    fill="#edf7f0"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sensor readings table */}
          <div className="dashboard-card">
            <h3 className="mb-4 text-sm font-semibold text-leaf-800">
              Latest Sensor Readings
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-leaf-100 text-xs font-medium text-soil-500">
                    <th className="pb-2 pr-4">Sensor</th>
                    <th className="pb-2 pr-4">Temp (°C)</th>
                    <th className="pb-2 pr-4">Humidity (%)</th>
                    <th className="pb-2 pr-4">Soil Moisture (%)</th>
                    <th className="pb-2 pr-4">Rain (mm)</th>
                    <th className="pb-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {sensors.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-soil-400">
                        No sensor data available
                      </td>
                    </tr>
                  ) : (
                    sensors.map((s) => (
                      <tr
                        key={s.sensor_id}
                        className="border-b border-leaf-50 text-sm text-leaf-700"
                      >
                        <td className="py-2 pr-4 font-mono text-xs">
                          {s.sensor_id.slice(0, 8)}…
                        </td>
                        <td className="py-2 pr-4">
                          {s.temp !== null ? s.temp.toFixed(1) : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {s.humidity !== null ? s.humidity.toFixed(1) : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {s.soil_moisture !== null
                            ? s.soil_moisture.toFixed(1)
                            : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {s.rain !== null ? s.rain.toFixed(1) : "—"}
                        </td>
                        <td className="py-2 text-xs text-soil-400">
                          {new Date(s.time).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Recommendations Section ─────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-leaf-800">
                Recommendations
              </h2>
              {recError && (
                <button
                  type="button"
                  onClick={recRefresh}
                  className="inline-flex items-center gap-1 text-xs font-medium text-leaf-500 transition-colors hover:text-leaf-600"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              )}
            </div>

            {/* Loading skeleton for recommendations */}
            {recLoading && (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="dashboard-card h-28 animate-pulse"
                  />
                ))}
              </div>
            )}

            {/* Error state for recommendations */}
            {recError && !recLoading && (
              <div className="dashboard-card py-6 text-center">
                <p className="text-sm text-danger-500">{recError}</p>
                <p className="mt-1 text-xs text-soil-400">
                  Could not load recommendations for this field.
                </p>
              </div>
            )}

            {/* Recommendation cards — stored items (with real recId for PATCH) */}
            {!recLoading && !recError && recStoredItems && recStoredItems.length > 0 && (
              <div className="space-y-3">
                {recStoredItems.map((item) => (
                  <RecommendationCard
                    key={item.id}
                    recId={item.id}
                    type={item.type as "irrigation" | "fertilization" | "pest_risk"}
                    data={item.payload as never}
                    lifecycleStatus={
                      lifecycleStatuses[item.id] ?? (item.status as RecommendationStatus)
                    }
                    generatedAt={item.generated_at}
                    onStatusChange={(id, s) =>
                      handleRecStatusChange(id, s)
                    }
                  />
                ))}
              </div>
            )}

            {/* Recommendation cards — real-time (fallback when no stored items) */}
            {!recLoading && !recError && !recStoredItems && recSummary && (
              <div className="space-y-3">
                {/* Irrigation card */}
                {recSummary.irrigation && (
                  <RecommendationCard
                    type="irrigation"
                    data={recSummary.irrigation}
                    lifecycleStatus={
                      lifecycleStatuses.irrigation ?? undefined
                    }
                    generatedAt={recSummary.generated_at}
                    onStatusChange={(_, s) =>
                      handleRecStatusChange("irrigation", s)
                    }
                  />
                )}

                {/* Fertilization card */}
                {recSummary.fertilization && (
                  <RecommendationCard
                    type="fertilization"
                    data={recSummary.fertilization}
                    lifecycleStatus={
                      lifecycleStatuses.fertilization ?? undefined
                    }
                    generatedAt={recSummary.generated_at}
                    onStatusChange={(_, s) =>
                      handleRecStatusChange("fertilization", s)
                    }
                  />
                )}

                {/* Pest risk cards (one per pest) */}
                {recSummary.pest_risk.map((pest) => (
                  <RecommendationCard
                    key={`${pest.pest_name}-${pest.risk_level}`}
                    type="pest_risk"
                    data={pest}
                    lifecycleStatus={
                      lifecycleStatuses[`pest_${pest.pest_name}`] ?? undefined
                    }
                    generatedAt={recSummary.generated_at}
                    onStatusChange={(_, s) =>
                      handleRecStatusChange(`pest_${pest.pest_name}`, s)
                    }
                  />
                ))}

                {/* Empty state */}
                {!recSummary.irrigation &&
                  !recSummary.fertilization &&
                  recSummary.pest_risk.length === 0 && (
                    <div className="dashboard-card py-8 text-center">
                      <p className="text-sm text-soil-400">
                        No active recommendations. The system will generate
                        suggestions once sufficient sensor data is available.
                      </p>
                    </div>
                  )}
              </div>
            )}

            {/* No stored and no real-time */}
            {!recLoading && !recError && !recStoredItems && !recSummary && (
              <div className="dashboard-card py-8 text-center">
                <p className="text-sm text-soil-400">
                  No active recommendations. The system will generate
                  suggestions once sufficient sensor data is available.
                </p>
              </div>
            )}
          </div>

          {/* ── Yield Prediction Section ────────────────────── */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-leaf-800">
              Yield Forecast
            </h2>
            <YieldPredictionCard
              prediction={prediction}
              isLoading={predLoading}
              error={predError}
              onRetry={predRefresh}
            />
          </div>
        </>
      )}

      {/* Field not found */}
      {!isLoading && !error && !field && (
        <div className="dashboard-card py-12 text-center">
          <p className="text-sm text-soil-400">Field not found</p>
        </div>
      )}
    </div>
  );
}
