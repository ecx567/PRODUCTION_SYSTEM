"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ChartTempProps {
  data: Array<{ time: string; temp: number | null }>;
  loading?: boolean;
}

/**
 * Temperature line chart with responsive container.
 */
export default function ChartTemp({ data, loading }: ChartTempProps) {
  if (loading) {
    return (
      <div className="h-48 animate-pulse rounded-lg bg-leaf-100" />
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg bg-leaf-50 text-sm text-soil-400">
        No temperature data available
      </div>
    );
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d1edda" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "#6f5b43" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#6f5b43" }}
            unit="°C"
            width={45}
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
            name="Temperature"
            animationDuration={500}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
