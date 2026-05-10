/**
 * Empty state placeholder: icon, message, optional action button.
 */

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MapPin, Bell, RefreshCw } from "lucide-react-native";

interface EmptyStateProps {
  icon?: "MapPin" | "Bell" | "RefreshCw";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const ICON_MAP = {
  MapPin,
  Bell,
  RefreshCw,
};

export default function EmptyState({
  icon = "RefreshCw",
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const Icon = ICON_MAP[icon] ?? RefreshCw;

  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      <View className="h-16 w-16 rounded-full bg-gray-100 items-center justify-center mb-4">
        <Icon size={28} color="#9CA3AF" />
      </View>
      <Text className="text-gray-400 text-base text-center mb-4">
        {message}
      </Text>
      {actionLabel && onAction && (
        <TouchableOpacity
          className="bg-leaf rounded-lg px-6 py-2.5"
          onPress={onAction}
        >
          <Text className="text-white font-medium">{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
