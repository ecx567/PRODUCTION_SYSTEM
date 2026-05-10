/**
 * Sync status banner: shows sync state at the top of list screens.
 */

import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useStore } from "@/lib/store";

const STATUS_CONFIG = {
  idle: { bg: "bg-gray-100", text: "text-gray-500", label: "Up to date" },
  syncing: { bg: "bg-sky/10", text: "text-sky", label: "Syncing..." },
  success: { bg: "bg-leaf-light/10", text: "text-leaf", label: "Sync complete" },
  error: { bg: "bg-danger/10", text: "text-danger", label: "Sync failed" },
  offline: { bg: "bg-sunlight/10", text: "text-sunlight", label: "Offline" },
};

export default function SyncBanner() {
  const syncStatus = useStore((s) => s.syncStatus);
  const syncPendingCount = useStore((s) => s.syncPendingCount);
  const syncLastSyncTime = useStore((s) => s.syncLastSyncTime);

  const config = STATUS_CONFIG[syncStatus] ?? STATUS_CONFIG.idle;

  return (
    <View className={`${config.bg} px-4 py-1.5 flex-row items-center justify-between`}>
      <View className="flex-row items-center">
        {syncStatus === "syncing" && (
          <ActivityIndicator size="small" color="#40916C" className="mr-2" />
        )}
        <Text className={`${config.text} text-xs font-medium`}>
          {config.label}
        </Text>
      </View>
      <View className="flex-row items-center">
        {syncPendingCount > 0 && (
          <Text className="text-gray-400 text-xs mr-2">
            {syncPendingCount} pending
          </Text>
        )}
        {syncLastSyncTime && (
          <Text className="text-gray-400 text-xs">
            {new Date(syncLastSyncTime).toLocaleTimeString()}
          </Text>
        )}
      </View>
    </View>
  );
}
