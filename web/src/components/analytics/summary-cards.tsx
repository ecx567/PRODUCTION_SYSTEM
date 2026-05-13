"use client";

import { Thermometer, Droplets, Waves, CloudRain } from "lucide-react";
import type { SensorReadingSummary } from "@/lib/api";

interface SummaryCardsProps {
  summary: SensorReadingSummary | null;
  loading?: boolean;
}

/**
 * 4 KPI gauge cards showing current values vs thresholds.
 * Each card displays the metric value, unit, icon, and a visual gauge bar
 * proportional to the value relative to its maximum threshold.
 */
export default function SummaryCards({ summary, loading }: SummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="dashboard-card h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  const metrics = [
    {
      label: "Temperature",
      icon: Thermometer,
      value: summary?.avg_temp,
      unit: "°C",
      color: "text-sunlight-500",
      bg: "bg-sunlight-50",
      iconBg: "bg-sunlight-100",
      gaugeColor: "bg-sunlight-500",
      maxThreshold: 40,
    },
    {
      label: "Humidity",
      icon: Droplets,
      value: summary?.avg_humidity,
      unit: "%",
      color: "text-sky-500",
      bg: "bg-sky-50",
      iconBg: "bg-sky-100",
      gaugeColor: "bg-sky-500",
      maxThreshold: 100,
    },
    {
      label: "Soil Moisture",
      icon: Waves,
      value: summary?.avg_soil_moisture,
      unit: "%",
      color: "text-leaf-500",
      bg: "bg-leaf-50",
      iconBg: "bg-leaf-100",
      gaugeColor: "bg-leaf-500",
      maxThreshold: 100,
    },
    {
      label: "Total Rain",
      icon: CloudRain,
      value: summary?.total_rain,
      unit: "mm",
      color: "text-soil-500",
      bg: "bg-soil-50",
      iconBg: "bg-soil-100",
      gaugeColor: "bg-soil-500",
      maxThreshold: 100,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        const displayValue =
          metric.value !== null && metric.value !== undefined
            ? `${metric.value.toFixed(1)}${metric.unit}`
            : "—";
        const fillPercent =
          metric.value != null
            ? Math.min((metric.value / metric.maxThreshold) * 100, 100)
            : 0;

        return (
          <div key={metric.label} className={`dashboard-card ${metric.bg}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="stat-label">{metric.label}</p>
                <p className={`stat-value ${metric.color}`}>{displayValue}</p>
              </div>
              <div className={`rounded-lg ${metric.iconBg} p-2`}>
                <Icon className={`h-5 w-5 ${metric.color}`} />
              </div>
            </div>
            {/* Gauge bar */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
              <div
                className={`h-full rounded-full ${metric.gaugeColor} transition-all duration-500`}
                style={{ width: `${fillPercent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
