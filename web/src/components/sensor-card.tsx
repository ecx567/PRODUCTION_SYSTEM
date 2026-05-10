"use client";

import type { ReactNode } from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface SensorCardProps {
  /** Icon to display */
  icon: ReactNode;
  /** Metric label (e.g. "Temperature") */
  label: string;
  /** Current value */
  value: number | null | undefined;
  /** Unit suffix (e.g. "°C") */
  unit: string;
  /** Previous value for trend arrow */
  previousValue?: number | null;
  /** Color tone for the card */
  color?: "leaf" | "sky" | "sunlight" | "soil" | "danger";
  /** Mini sparkline data (optional) */
  sparklineData?: number[];
}

const colorClasses: Record<string, { text: string; bg: string; iconBg: string }> = {
  leaf: { text: "text-leaf-500", bg: "bg-leaf-50", iconBg: "bg-leaf-100" },
  sky: { text: "text-sky-500", bg: "bg-sky-50", iconBg: "bg-sky-100" },
  sunlight: {
    text: "text-sunlight-500",
    bg: "bg-sunlight-50",
    iconBg: "bg-sunlight-100",
  },
  soil: { text: "text-soil-500", bg: "bg-soil-50", iconBg: "bg-soil-100" },
  danger: {
    text: "text-danger-500",
    bg: "bg-danger-50",
    iconBg: "bg-danger-100",
  },
};

export default function SensorCard({
  icon,
  label,
  value,
  unit,
  previousValue,
  color = "leaf",
}: SensorCardProps) {
  const colors = colorClasses[color];

  function trendIndicator() {
    if (value === null || value === undefined || previousValue === null || previousValue === undefined) {
      return null;
    }
    if (value > previousValue) {
      return <ArrowUp className="h-3.5 w-3.5 text-danger-500" />;
    }
    if (value < previousValue) {
      return <ArrowDown className="h-3.5 w-3.5 text-leaf-500" />;
    }
    return <Minus className="h-3.5 w-3.5 text-soil-400" />;
  }

  return (
    <div className={`dashboard-card ${colors.bg}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="stat-label">{label}</p>
          <div className="flex items-center gap-1.5">
            <p className={`stat-value ${colors.text}`}>
              {value !== null && value !== undefined
                ? `${typeof value === "number" ? value.toFixed(1) : value}${unit}`
                : "—"}
            </p>
            {trendIndicator()}
          </div>
        </div>
        <div className={`rounded-lg ${colors.iconBg} p-2`}>{icon}</div>
      </div>
    </div>
  );
}
