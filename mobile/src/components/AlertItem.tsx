/**
 * Alert row item: severity indicator, message, time, acknowledge action.
 */

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Bell, BellOff } from "lucide-react-native";

interface AlertItemProps {
  severity: string;
  message: string;
  time: string;
  acknowledged: boolean;
  onAcknowledge?: () => void;
}

const SEVERITY_STYLES: Record<
  string,
  { dot: string; bg: string; border: string; iconColor: string }
> = {
  critical: {
    dot: "bg-danger",
    bg: "bg-danger/5",
    border: "border-danger/20",
    iconColor: "#E76F51",
  },
  warning: {
    dot: "bg-sunlight",
    bg: "bg-sunlight/5",
    border: "border-sunlight/20",
    iconColor: "#E9C46A",
  },
  info: {
    dot: "bg-sky",
    bg: "bg-sky/5",
    border: "border-sky/20",
    iconColor: "#7EC8E3",
  },
  acknowledged: {
    dot: "bg-gray-300",
    bg: "bg-gray-50",
    border: "border-gray-200",
    iconColor: "#9CA3AF",
  },
};

export default function AlertItem({
  severity,
  message,
  time,
  acknowledged,
  onAcknowledge,
}: AlertItemProps) {
  const style = acknowledged
    ? SEVERITY_STYLES.acknowledged
    : SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info;

  return (
    <View
      className={`${style.bg} ${style.border} border rounded-xl p-3 mx-4 mb-2`}
    >
      <View className="flex-row items-start">
        {/* Severity dot */}
        <View className={`h-2.5 w-2.5 rounded-full mt-1.5 mr-3 ${style.dot}`} />

        {/* Content */}
        <View className="flex-1">
          <View className="flex-row items-center mb-0.5">
            <Text className="text-gray-800 text-sm font-medium capitalize">
              {acknowledged ? "Acknowledged" : severity}
            </Text>
            <Text className="text-gray-300 mx-1.5">·</Text>
            <Text className="text-gray-400 text-xs">
              {new Date(time).toLocaleString()}
            </Text>
          </View>
          <Text className="text-gray-600 text-sm leading-5">{message}</Text>
        </View>

        {/* Acknowledge button */}
        {!acknowledged && onAcknowledge && (
          <TouchableOpacity
            onPress={onAcknowledge}
            className="ml-2 p-1.5"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <BellOff size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
