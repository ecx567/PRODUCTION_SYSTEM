"use client";

import type { HourlyRollup, SensorReadingResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Thermometer,
  Droplets,
  Sprout,
  CloudRain,
  Clock,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";

interface SensorCardProps {
  /** Sensor reading data */
  reading: SensorReadingResponse;
  /** Human-readable field name this sensor belongs to */
  fieldName?: string;
  /** Whether this card is currently expanded */
  isExpanded?: boolean;
  /** Called when the card header is clicked */
  onToggle?: () => void;
  /** Hourly rollup data for sparklines */
  hourlyRollup?: HourlyRollup[];
}

/** Stale threshold in minutes — readings older than this get a warning badge */
const STALE_THRESHOLD_MIN = 30;

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function isStale(isoString: string, thresholdMinutes = STALE_THRESHOLD_MIN): boolean {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  return now - then > thresholdMinutes * 60 * 1000;
}

interface SignalQuality {
  value: number;
  label: string;
  bars: number;
}

/**
 * Compute a signal quality proxy from data freshness.
 *
 * The backend does not expose signal_quality directly, so we infer it from
 * how recently the sensor reported data. This is a reasonable heuristic:
 * fresh data = good connectivity.
 */
function computeSignalQuality(reading: SensorReadingResponse): SignalQuality {
  const now = Date.now();
  const lastSeen = new Date(reading.time).getTime();
  const diffMinutes = (now - lastSeen) / 60_000;

  let value: number;
  if (diffMinutes < 5) value = 90;
  else if (diffMinutes < 15) value = 75;
  else if (diffMinutes < 30) value = 55;
  else value = 25;

  const label =
    value >= 80 ? "Excellent" : value >= 60 ? "Good" : value >= 40 ? "Fair" : "Poor";
  const bars = value >= 80 ? 4 : value >= 60 ? 3 : value >= 40 ? 2 : 1;

  return { value, label, bars };
}

const metricConfig = [
  { key: "temp" as const, icon: Thermometer, label: "Temperature", unit: "°C", color: "text-danger-500" },
  { key: "humidity" as const, icon: Droplets, label: "Humidity", unit: "%", color: "text-sky-500" },
  { key: "soil_moisture" as const, icon: Sprout, label: "Soil Moisture", unit: "%", color: "text-leaf-500" },
  { key: "rain" as const, icon: CloudRain, label: "Rainfall", unit: "mm", color: "text-sky-500" },
];

const sparklineMetrics = [
  { key: "avg_temp" as const, label: "Temp", color: "#e76f51" },
  { key: "avg_humidity" as const, label: "Humidity", color: "#7ec8e3" },
  { key: "avg_soil_moisture" as const, label: "Soil", color: "#2d6a4f" },
  { key: "total_rain" as const, label: "Rain", color: "#6f5b43" },
];

const signalBarColors: Record<string, string> = {
  excellent: "bg-leaf-500",
  good: "bg-sky-500",
  fair: "bg-sunlight-500",
  poor: "bg-danger-500",
};

export default function SensorCard({
  reading,
  fieldName,
  isExpanded = false,
  onToggle,
  hourlyRollup = [],
}: SensorCardProps) {
  const sensorIdShort = reading.sensor_id.slice(0, 8);
  const stale = isStale(reading.time);
  const signal = computeSignalQuality(reading);
  const lastSeen = formatRelativeTime(reading.time);

  return (
    <div
      data-testid="sensor-card"
      className={cn(
        "dashboard-card flex flex-col gap-3",
        stale && "border-sunlight-300 bg-sunlight-50/40",
      )}
    >
      {/* ── Header: sensor ID + field name + stale badge (clickable) ── */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-leaf-700">
              Sensor {sensorIdShort}
            </h3>
            {stale && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sunlight-100 px-2 py-0.5 text-[10px] font-medium text-sunlight-700">
                <AlertTriangle className="h-3 w-3" />
                Stale
              </span>
            )}
          </div>
          {fieldName && (
            <p className="truncate text-xs text-soil-500">{fieldName}</p>
          )}
        </div>

        {/* Signal quality bars */}
        <div
          className="flex items-end gap-0.5"
          aria-label={`Signal quality: ${signal.label} (${signal.value})`}
          role="img"
        >
          {[1, 2, 3, 4].map((bar) => (
            <div
              key={bar}
              className={cn(
                "h-4 w-1.5 rounded-sm transition-colors",
                bar <= signal.bars
                  ? signalBarColors[signal.label.toLowerCase()] ?? "bg-leaf-500"
                  : "bg-leaf-100",
              )}
            />
          ))}
        </div>
      </button>

      {/* ── Metric grid (2×2) ── */}
      <div className="grid grid-cols-2 gap-2">
        {metricConfig.map((metric) => {
          const value = reading[metric.key];
          const Icon = metric.icon;
          return (
            <div
              key={metric.key}
              className="flex items-center gap-2 rounded-lg bg-leaf-50/50 p-2"
              aria-label={`${metric.label}: ${value !== null && value !== undefined ? Number(value).toFixed(1) : "N/A"} ${metric.unit}`}
            >
              <Icon className={cn("h-4 w-4 shrink-0", metric.color)} />
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-soil-400">
                  {metric.label}
                </p>
                <p className={cn("truncate text-sm font-semibold", metric.color)}>
                  {value !== null && value !== undefined
                    ? `${Number(value).toFixed(1)}${metric.unit}`
                    : "—"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Expanded section: sparkline charts ── */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        {isExpanded && (
          <div className="border-t border-leaf-100 pt-3">
            <div className="mb-2 flex items-center gap-1">
              <ChevronDown className="h-3 w-3 text-soil-400" />
              <h4 className="text-xs font-semibold text-soil-500">
                24h Trend
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {sparklineMetrics.map((metric) => {
                const data = hourlyRollup.map((h) => ({
                  time: new Date(h.hour).toLocaleTimeString([], {
                    hour: "2-digit",
                  }),
                  value: h[metric.key],
                }));
                const allNull = data.every((d) => d.value === null);
                if (allNull) {
                  return (
                    <div
                      key={metric.key}
                      className="rounded-lg bg-leaf-50/50 p-2 text-center text-xs text-soil-400"
                    >
                      No data
                    </div>
                  );
                }
                return (
                  <div
                    key={metric.key}
                    className="rounded-lg bg-leaf-50/50 p-2"
                  >
                    <p className="mb-1 text-[10px] font-medium text-soil-400">
                      {metric.label}
                    </p>
                    <ResponsiveContainer width="100%" height={40}>
                      <LineChart data={data}>
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={metric.color}
                          strokeWidth={1.5}
                          dot={false}
                        />
                        <XAxis dataKey="time" hide />
                        <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer: last seen + validation status ── */}
      <div className="flex items-center justify-between border-t border-leaf-100 pt-2">
        <div className="flex items-center gap-1.5 text-xs text-soil-400">
          <Clock className="h-3 w-3" />
          <span>{lastSeen}</span>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            reading.validation_status === "valid"
              ? "bg-leaf-100 text-leaf-600"
              : "bg-danger-50 text-danger-600",
          )}
        >
          {reading.validation_status}
        </span>
      </div>
    </div>
  );
}
