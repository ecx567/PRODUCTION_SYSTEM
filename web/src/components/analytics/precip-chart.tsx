"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from "recharts";

interface PrecipChartProps {
  data: Array<{ time: string; rain: number | null }>;
  loading?: boolean;
}

/**
 * Precipitation BarChart showing rainfall amounts over time.
 * Uses Bar (not Line) per the design spec for rainfall visualisation.
 */
export default function PrecipChart({ data, loading }: PrecipChartProps) {
  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg bg-leaf-100" />;
  }

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg bg-leaf-50 text-sm text-soil-400">
        No precipitation data available
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d1edda" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: "#6f5b43" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6f5b43" }}
            unit="mm"
            width={50}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #d1edda",
              fontSize: "12px",
            }}
          />
          <Bar
            dataKey="rain"
            fill="#a8d5e2"
            radius={[2, 2, 0, 0]}
            name="Rainfall"
            animationDuration={500}
          />
          <Brush
            dataKey="time"
            height={30}
            stroke="#2d6a4f"
            fill="#edf7f0"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
