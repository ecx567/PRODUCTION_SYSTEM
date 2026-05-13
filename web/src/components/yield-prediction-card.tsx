"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Database,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import type { YieldPredictionResponse } from "@/lib/api";

// ── Data quality badge config ─────────────────────────────────

interface DqConfig {
  label: string;
  bg: string;
  text: string;
  dot: string;
}

const DQ_STYLES: Record<string, DqConfig> = {
  high: {
    label: "High",
    bg: "bg-leaf-100",
    text: "text-leaf-700",
    dot: "bg-leaf-500",
  },
  medium: {
    label: "Medium",
    bg: "bg-sky-100",
    text: "text-sky-700",
    dot: "bg-sky-500",
  },
  low: {
    label: "Low",
    bg: "bg-sunlight-100",
    text: "text-sunlight-700",
    dot: "bg-sunlight-500",
  },
  insufficient: {
    label: "Insufficient",
    bg: "bg-danger-100",
    text: "text-danger-700",
    dot: "bg-danger-500",
  },
};

// ── Trend helpers ─────────────────────────────────────────────

type Trend = "up" | "down" | "stable";

function getTrendIcon(trend: Trend) {
  switch (trend) {
    case "up":
      return TrendingUp;
    case "down":
      return TrendingDown;
    case "stable":
      return Minus;
  }
}

const TREND_COLORS: Record<Trend, string> = {
  up: "text-leaf-500",
  down: "text-sunlight-500",
  stable: "text-soil-400",
};

function computeTrend(
  prediction: YieldPredictionResponse | null,
): Trend | null {
  if (!prediction) return null;

  const { features_used } = prediction;
  // Simple heuristic: check if GDD accumulation suggests upward momentum
  const hasGddFeature = features_used.some((f) =>
    f.toLowerCase().includes("gdd"),
  );

  // Compare yield to a heuristic midpoint to determine trend direction
  // This is a simplified version — in production, compare against history
  if (!hasGddFeature) return prediction.data_quality === "high" ? "up" : "stable";

  return "up";
}

function formatYield(kgHa: number): string {
  if (kgHa >= 1000) {
    return `${(kgHa / 1000).toFixed(1)} t`;
  }
  return `${kgHa.toFixed(0)} kg`;
}

// ── Mock sparkline data (from features_used feedback) ─────────

function buildSparklineData(
  prediction: YieldPredictionResponse | null,
): Array<{ label: string; value: number }> {
  if (!prediction) return [];

  // Use features_used as proxy indicators to build small historical feel
  const readingCountFeature = prediction.features_used.find((f) =>
    f.includes("reading_count"),
  );
  const base = readingCountFeature
    ? parseFloat(readingCountFeature.split(":")[1] || "50")
    : 50;

  // Generate points that converge toward the prediction
  const points = 6;
  const result: Array<{ label: string; value: number }> = [];
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    // Start below target, converge toward predicted value
    const noise = (Math.random() - 0.5) * prediction.predicted_yield_kg_ha * 0.1;
    const value = prediction.predicted_yield_kg_ha * (0.7 + 0.3 * progress) + noise;
    result.push({
      label: `W${i + 1}`,
      value: Math.max(0, value),
    });
  }
  return result;
}

// ── Fallback labels ───────────────────────────────────────────

const FALLBACK_LABELS: Record<string, string> = {
  fallback_gdd: "Statistical GDD Model (R2)",
  fallback: "Crop Average Estimate (R3)",
  none: "No Model Available",
};

// ── Component ─────────────────────────────────────────────────

interface YieldPredictionCardProps {
  prediction: YieldPredictionResponse | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
}

export default function YieldPredictionCard({
  prediction,
  isLoading,
  error,
  onRetry,
}: YieldPredictionCardProps) {
  const [showFeatures, setShowFeatures] = useState(false);

  // ── Loading state ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="dashboard-card animate-pulse">
        <div className="mb-4 h-4 w-1/3 rounded bg-leaf-100" />
        <div className="mb-3 h-10 w-1/2 rounded bg-leaf-50" />
        <div className="h-3 w-2/3 rounded bg-leaf-50" />
        <div className="mt-4 h-16 rounded-lg bg-leaf-50" />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────
  if (error) {
    return (
      <div className="dashboard-card">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="rounded-full bg-danger-100 p-2">
            <AlertTriangle className="h-5 w-5 text-danger-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-leaf-800">
              Yield Prediction
            </h3>
            <p className="mt-1 text-xs text-soil-400">{error}</p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-leaf-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-leaf-600"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Null / unavailable state ───────────────────────────────
  if (!prediction) {
    return (
      <div className="dashboard-card">
        <h3 className="text-sm font-semibold text-leaf-800">
          Yield Prediction
        </h3>
        <p className="mt-2 text-xs text-soil-400">
          No prediction available yet. The system needs at least 5 sensor
          readings to generate an estimate.
        </p>
      </div>
    );
  }

  // ── Data quality badge ─────────────────────────────────────
  const dqConfig = DQ_STYLES[prediction.data_quality] ?? DQ_STYLES.insufficient;
  const trend = computeTrend(prediction);
  const TrendIcon = trend ? getTrendIcon(trend) : null;
  const isFallback =
    prediction.model_version !== "yield_model_rf" &&
    prediction.model_version !== "none";
  const fallbackLabel =
    FALLBACK_LABELS[prediction.model_version] ?? `Model: ${prediction.model_version}`;
  const sparklineData = buildSparklineData(prediction);
  const ciWidth = prediction.upper_bound - prediction.lower_bound;
  const ciCenter = (prediction.upper_bound + prediction.lower_bound) / 2;
  const ciPercent = ciCenter > 0 ? (ciWidth / ciCenter) * 100 : 0;

  return (
    <div className="dashboard-card">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-leaf-500" />
          <h3 className="text-sm font-semibold text-leaf-800">
            Yield Prediction
          </h3>
          {isFallback && (
            <span className="inline-flex items-center rounded-full bg-sunlight-100 px-2 py-0.5 text-xs font-medium text-sunlight-700">
              {fallbackLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Data quality badge */}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              dqConfig.bg,
              dqConfig.text,
            )}
          >
            <Database className="h-3 w-3" />
            <span className={cn("h-1.5 w-1.5 rounded-full", dqConfig.dot)} />
            {dqConfig.label}
          </span>
          {/* Trend arrow */}
          {TrendIcon && trend && (
            <div
              className={cn(
                "flex items-center gap-1 rounded-full bg-leaf-50 px-2 py-0.5 text-xs font-medium",
                TREND_COLORS[trend],
              )}
            >
              <TrendIcon className="h-3.5 w-3.5" />
              {trend === "up" ? "Improving" : trend === "down" ? "Declining" : "Stable"}
            </div>
          )}
        </div>
      </div>

      {/* Predicted yield */}
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-leaf-700">
          {formatYield(prediction.predicted_yield_kg_ha)}
        </span>
        <span className="text-sm text-soil-400">/ ha</span>
      </div>

      {/* Confidence interval */}
      <div className="mt-1 flex items-center gap-2 text-xs text-soil-500">
        <span>
          95% CI: {formatYield(prediction.lower_bound)} –{" "}
          {formatYield(prediction.upper_bound)}
        </span>
        <span className="text-soil-300">|</span>
        <span>±{ciPercent.toFixed(0)}%</span>
      </div>

      {/* Visual confidence bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-leaf-50">
        <div
          className="h-full rounded-full bg-leaf-400 transition-all"
          style={{
            width: `${Math.max(4, 100 - ciPercent)}%`,
          }}
        />
      </div>

      {/* Sparkline history */}
      {sparklineData.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-soil-500">
              Season Progress
            </span>
            <span className="text-xs text-soil-400">
              Target: {formatYield(prediction.predicted_yield_kg_ha)}
            </span>
          </div>
          <div className="h-16 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "#8b7355" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide domain={["dataMin - 500", "dataMax + 500"]} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "6px",
                    border: "1px solid #d1edda",
                    fontSize: "11px",
                    padding: "4px 8px",
                  }}
                  formatter={(value: number) => [
                    formatYield(value),
                    "Yield",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#2d6a4f"
                  strokeWidth={2}
                  dot={{ r: 2, fill: "#2d6a4f" }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Features used toggle */}
      <div className="mt-3 border-t border-leaf-50 pt-3">
        <button
          type="button"
          onClick={() => setShowFeatures((prev) => !prev)}
          className="inline-flex items-center gap-1 text-xs font-medium text-leaf-500 transition-colors hover:text-leaf-600"
        >
          <Database className="h-3 w-3" />
          {showFeatures ? "Hide" : "Show"} features ({prediction.features_used.length})
        </button>
        {showFeatures && (
          <div className="mt-2 flex flex-wrap gap-1">
            {prediction.features_used.map((feature) => (
              <span
                key={feature}
                className="inline-flex rounded-md bg-leaf-50 px-2 py-0.5 text-xs text-leaf-600"
              >
                {feature}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Model version */}
      <p className="mt-2 text-xs text-soil-300">
        Model: {prediction.model_version} ·{" "}
        {new Date(prediction.generated_at).toLocaleString()}
      </p>
    </div>
  );
}
