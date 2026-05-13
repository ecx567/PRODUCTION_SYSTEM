/**
 * Circular gauge for sensor reading display.
 *
 * Shows a semi-circular visualization with color-coded value range.
 */

import React from "react";
import { View, Text } from "react-native";

interface SensorGaugeProps {
  label: string;
  value: number | null;
  unit: string;
  min: number;
  max: number;
  threshold: { warn: number; danger: number };
  colorScale: [string, string, string];
}

function getValueColor(
  value: number,
  threshold: { warn: number; danger: number },
  colorScale: [string, string, string],
): string {
  if (value >= threshold.danger) return colorScale[2];
  if (value >= threshold.warn) return colorScale[1];
  return colorScale[0];
}

export default function SensorGauge({
  label,
  value,
  unit,
  min,
  max,
  threshold,
  colorScale,
}: SensorGaugeProps) {
  const displayValue = value?.toFixed(1) ?? "—";
  const percentage = value != null ? ((value - min) / (max - min)) * 100 : 0;
  const clampedPct = Math.min(Math.max(percentage, 0), 100);
  const color = value != null ? getValueColor(value, threshold, colorScale) : "#9CA3AF";

  return (
    <View className="bg-white rounded-xl p-3 w-[48%] mb-3 shadow-sm border border-gray-100 items-center">
      <Text className="text-gray-500 text-xs mb-2">{label}</Text>

      {/* Gauge visualization */}
      <View className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
        <View
          className="h-full rounded-full"
          style={{
            width: `${clampedPct}%`,
            backgroundColor: color,
          }}
        />
      </View>

      {/* Value */}
      <View className="flex-row items-baseline">
        <Text className="text-xl font-bold" style={{ color }}>
          {displayValue}
        </Text>
        <Text className="text-gray-400 text-xs ml-1">{unit}</Text>
      </View>

      {/* Mini range indicator */}
      <View className="flex-row justify-between w-full mt-1">
        <Text className="text-gray-300 text-[10px]">{min}</Text>
        <Text className="text-gray-300 text-[10px]">{max}</Text>
      </View>
    </View>
  );
}
