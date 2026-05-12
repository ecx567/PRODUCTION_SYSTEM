"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from "recharts";

interface HumidityChartProps {
  data: Array<{ time: string; humidity: number | null }>;
  loading?: boolean;
}

/**
 * Humidity AreaChart with gradient fill.
 * Uses Area (not Line) per the design spec for humidity visualisation.
 */
export default function HumidityChart({ data, loading }: HumidityChartProps) {
  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg bg-leaf-100" />;
  }

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg bg-leaf-50 text-sm text-soil-400">
        No humidity data available
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d1edda" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: "#6f5b43" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6f5b43" }}
            unit="%"
            width={50}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #d1edda",
              fontSize: "12px",
            }}
          />
          <Area
            type="monotone"
            dataKey="humidity"
            stroke="#7ec8e3"
            fill="#d4edfa"
            strokeWidth={2}
            name="Humidity"
            animationDuration={500}
          />
          <Brush
            dataKey="time"
            height={30}
            stroke="#2d6a4f"
            fill="#edf7f0"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
