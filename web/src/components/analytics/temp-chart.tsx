"use client";

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

interface TempChartProps {
  data: Array<{
    time: string;
    temp: number | null;
    minTemp: number | null;
    maxTemp: number | null;
  }>;
  loading?: boolean;
}

/**
 * Temperature LineChart with min/max envelope.
 * Matches the proven pattern from fields/[id]/page.tsx.
 */
export default function TempChart({ data, loading }: TempChartProps) {
  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg bg-leaf-100" />;
  }

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg bg-leaf-50 text-sm text-soil-400">
        No temperature data available
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d1edda" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: "#6f5b43" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6f5b43" }}
            unit="°C"
            width={50}
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
            animationDuration={500}
          />
          <Line
            type="monotone"
            dataKey="minTemp"
            stroke="#7ec8e3"
            strokeWidth={1}
            dot={false}
            name="Min Temp"
            animationDuration={500}
          />
          <Line
            type="monotone"
            dataKey="maxTemp"
            stroke="#e76f51"
            strokeWidth={1}
            dot={false}
            name="Max Temp"
            animationDuration={500}
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
  );
}
