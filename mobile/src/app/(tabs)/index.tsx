/**
 * Dashboard overview: field count, active alerts, sync status, quick actions.
 */

import { useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  RefreshCw,
  AlertTriangle,
  MapPin,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import { useStore } from "@/lib/store";
import { performSync } from "@/lib/sync";
import SyncBanner from "@/components/SyncBanner";

export default function DashboardScreen() {
  const router = useRouter();
  const {
    fields,
    fieldsLoading,
    alerts,
    syncStatus,
    syncPendingCount,
    syncLastSyncTime,
    loadFields,
    loadAlerts,
  } = useStore();

  useEffect(() => {
    loadFields();
    loadAlerts();
  }, []);

  const handleSync = async () => {
    await performSync();
    loadFields();
    loadAlerts();
  };

  const activeAlerts = alerts.filter((a) => !a.acknowledgedAt).length;
  const criticalAlerts = alerts.filter(
    (a) => a.severity === "critical" && !a.acknowledgedAt,
  ).length;

  return (
    <View className="flex-1 bg-gray-50">
      <SyncBanner />
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={fieldsLoading}
            onRefresh={() => {
              handleSync();
            }}
            colors={["#2D6A4F"]}
            tintColor="#2D6A4F"
          />
        }
      >
        <View className="p-4">
          {/* Stats Cards */}
          <View className="flex-row flex-wrap justify-between mb-6">
            {/* Fields count */}
            <View className="bg-white rounded-xl p-4 w-[48%] mb-3 shadow-sm border border-gray-100">
              <View className="flex-row items-center mb-2">
                <MapPin size={20} color="#2D6A4F" />
                <Text className="text-gray-500 text-sm ml-2">Fields</Text>
              </View>
              <Text className="text-3xl font-bold text-gray-800">
                {fields.length}
              </Text>
              <Text className="text-gray-400 text-xs mt-1">Active fields</Text>
            </View>

            {/* Active alerts */}
            <TouchableOpacity
              className="bg-white rounded-xl p-4 w-[48%] mb-3 shadow-sm border border-gray-100"
              onPress={() => router.push("/(tabs)/alerts")}
            >
              <View className="flex-row items-center mb-2">
                <AlertTriangle
                  size={20}
                  color={criticalAlerts > 0 ? "#E76F51" : "#F4A460"}
                />
                <Text className="text-gray-500 text-sm ml-2">Alerts</Text>
              </View>
              <Text
                className={`text-3xl font-bold ${criticalAlerts > 0 ? "text-danger" : "text-gray-800"}`}
              >
                {activeAlerts}
              </Text>
              <Text className="text-gray-400 text-xs mt-1">
                {criticalAlerts > 0
                  ? `${criticalAlerts} critical`
                  : "No critical alerts"}
              </Text>
            </TouchableOpacity>

            {/* Sync status */}
            <View className="bg-white rounded-xl p-4 w-[48%] shadow-sm border border-gray-100">
              <View className="flex-row items-center mb-2">
                {syncStatus === "offline" ? (
                  <WifiOff size={20} color="#E76F51" />
                ) : (
                  <Wifi size={20} color="#2D6A4F" />
                )}
                <Text className="text-gray-500 text-sm ml-2">Sync</Text>
              </View>
              <View className="flex-row items-center">
                <View
                  className={`h-2 w-2 rounded-full mr-2 ${
                    syncStatus === "offline"
                      ? "bg-danger"
                      : syncStatus === "syncing"
                        ? "bg-sunlight"
                        : "bg-leaf"
                  }`}
                />
                <Text className="text-gray-800 font-medium">
                  {syncStatus === "offline"
                    ? "Offline"
                    : syncStatus === "syncing"
                      ? "Syncing..."
                      : "Online"}
                </Text>
              </View>
              <Text className="text-gray-400 text-xs mt-1">
                {syncPendingCount > 0
                  ? `${syncPendingCount} pending`
                  : syncLastSyncTime
                    ? "Up to date"
                    : "Never synced"}
              </Text>
            </View>

            {/* Pending */}
            <View className="bg-white rounded-xl p-4 w-[48%] shadow-sm border border-gray-100">
              <View className="flex-row items-center mb-2">
                <RefreshCw size={20} color="#40916C" />
                <Text className="text-gray-500 text-sm ml-2">Pending</Text>
              </View>
              <Text className="text-3xl font-bold text-gray-800">
                {syncPendingCount}
              </Text>
              <Text className="text-gray-400 text-xs mt-1">
                {syncPendingCount === 0
                  ? "All changes synced"
                  : "Changes to upload"}
              </Text>
            </View>
          </View>

          {/* Quick Actions */}
          <Text className="text-lg font-semibold text-gray-800 mb-3">
            Quick Actions
          </Text>
          <View className="flex-row flex-wrap justify-between mb-6">
            <TouchableOpacity
              className="bg-leaf rounded-xl py-4 px-4 w-[48%] items-center mb-3"
              onPress={handleSync}
              disabled={syncStatus === "syncing"}
            >
              {syncStatus === "syncing" ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <RefreshCw size={24} color="white" />
                  <Text className="text-white font-medium mt-2">Sync Now</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-sunlight rounded-xl py-4 px-4 w-[48%] items-center mb-3"
              onPress={() => router.push("/(tabs)/alerts")}
            >
              <AlertTriangle size={24} color="white" />
              <Text className="text-white font-medium mt-2">View Alerts</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Alerts */}
          <Text className="text-lg font-semibold text-gray-800 mb-3">
            Recent Alerts
          </Text>
          {alerts.slice(0, 3).length === 0 ? (
            <View className="bg-white rounded-xl p-6 items-center shadow-sm border border-gray-100">
              <Text className="text-gray-400">No recent alerts</Text>
            </View>
          ) : (
            alerts.slice(0, 3).map((alert) => (
              <View
                key={alert.id}
                className="bg-white rounded-xl p-4 mb-2 shadow-sm border border-gray-100"
              >
                <View className="flex-row items-center">
                  <View
                    className={`h-3 w-3 rounded-full mr-3 ${
                      alert.severity === "critical"
                        ? "bg-danger"
                        : alert.severity === "warning"
                          ? "bg-sunlight"
                          : "bg-sky"
                    }`}
                  />
                  <View className="flex-1">
                    <Text className="text-gray-800 font-medium text-sm">
                      {alert.message}
                    </Text>
                    <Text className="text-gray-400 text-xs mt-0.5">
                      {new Date(alert.triggeredAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
