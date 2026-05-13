/**
 * Dashboard overview: stats cards, crop distribution chart, alert pie, recent alerts.
 */

import { useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import {
  RefreshCw,
  AlertTriangle,
  MapPin,
  Wifi,
  WifiOff,
  Leaf,
  Sprout,
} from "lucide-react-native";
import { PieChart, BarChart } from "react-native-chart-kit";
import { useStore } from "@/lib/store";
import { performSync } from "@/lib/sync";
import SyncBanner from "@/components/SyncBanner";
import { getCropEmoji } from "@/data/crops";

const screenWidth = Dimensions.get("window").width;
const CHART_WIDTH = screenWidth - 32;

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

  // Alert distribution for PieChart
  const alertPieData = useMemo(() => {
    const critical = alerts.filter(
      (a) => a.severity === "critical" && !a.acknowledgedAt,
    ).length;
    const warning = alerts.filter(
      (a) => a.severity === "warning" && !a.acknowledgedAt,
    ).length;
    const info = alerts.filter(
      (a) => a.severity === "info" && !a.acknowledgedAt,
    ).length;
    const total = critical + warning + info;

    // Don't show chart if no active alerts
    if (total === 0) {
      return [
        { name: "Sin alertas", count: 1, color: "#E5E7EB", legendFontColor: "#9CA3AF" },
      ];
    }

    return [
      {
        name: "Crítica",
        count: critical,
        color: "#E76F51",
        legendFontColor: "#6B7280",
      },
      {
        name: "Advertencia",
        count: warning,
        color: "#F4A460",
        legendFontColor: "#6B7280",
      },
      {
        name: "Info",
        count: info,
        color: "#7EC8E3",
        legendFontColor: "#6B7280",
      },
    ].filter((d) => d.count > 0);
  }, [alerts]);

  // Crop distribution data
  const cropDistData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of fields) {
      const crop = f.cropType || "unknown";
      counts[crop] = (counts[crop] || 0) + 1;
    }
    const labels = Object.keys(counts).map((k) => k.charAt(0).toUpperCase() + k.slice(1));
    const data = Object.values(counts);
    return { labels, data };
  }, [fields]);

  const hasCropData = cropDistData.data.length > 0;
  const hasAlertData = alertPieData.length > 0 && alertPieData[0].name !== "Sin alertas";

  const chartConfig = {
    backgroundColor: "white",
    backgroundGradientFrom: "white",
    backgroundGradientTo: "white",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(45, 106, 79, ${opacity})`,
    labelColor: () => "#6B7280",
    propsForBackgroundLines: { strokeDasharray: "", stroke: "#E5E7EB" },
    barPercentage: 0.6,
  };

  return (
    <View className="flex-1 bg-gray-50">
      <SyncBanner />
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={fieldsLoading}
            onRefresh={handleSync}
            colors={["#2D6A4F"]}
            tintColor="#2D6A4F"
          />
        }
      >
        <View className="p-4">
          {/* Stats Cards */}
          <View className="flex-row flex-wrap justify-between mb-4">
            <View className="bg-white rounded-xl p-4 w-[48%] mb-3 shadow-sm border border-gray-100">
              <View className="flex-row items-center mb-2">
                <MapPin size={20} color="#2D6A4F" />
                <Text className="text-gray-500 text-sm ml-2">Campos</Text>
              </View>
              <Text className="text-3xl font-bold text-gray-800">
                {fields.length}
              </Text>
              <Text className="text-gray-400 text-xs mt-1">Activos</Text>
            </View>

            <TouchableOpacity
              className="bg-white rounded-xl p-4 w-[48%] mb-3 shadow-sm border border-gray-100"
              onPress={() => router.push("/(tabs)/alerts")}
            >
              <View className="flex-row items-center mb-2">
                <AlertTriangle
                  size={20}
                  color={criticalAlerts > 0 ? "#E76F51" : "#F4A460"}
                />
                <Text className="text-gray-500 text-sm ml-2">Alertas</Text>
              </View>
              <Text
                className={`text-3xl font-bold ${criticalAlerts > 0 ? "text-danger" : "text-gray-800"}`}
              >
                {activeAlerts}
              </Text>
              <Text className="text-gray-400 text-xs mt-1">
                {criticalAlerts > 0
                  ? `${criticalAlerts} críticas`
                  : "Sin críticas"}
              </Text>
            </TouchableOpacity>

            <View className="bg-white rounded-xl p-4 w-[48%] mb-3 shadow-sm border border-gray-100">
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
                      ? "Sincronizando..."
                      : "En línea"}
                </Text>
              </View>
              <Text className="text-gray-400 text-xs mt-1">
                {syncPendingCount > 0
                  ? `${syncPendingCount} pendientes`
                  : syncLastSyncTime
                    ? "Actualizado"
                    : "Sin sincronizar"}
              </Text>
            </View>

            <View className="bg-white rounded-xl p-4 w-[48%] mb-3 shadow-sm border border-gray-100">
              <View className="flex-row items-center mb-2">
                <RefreshCw size={20} color="#40916C" />
                <Text className="text-gray-500 text-sm ml-2">Pendientes</Text>
              </View>
              <Text className="text-3xl font-bold text-gray-800">
                {syncPendingCount}
              </Text>
              <Text className="text-gray-400 text-xs mt-1">
                {syncPendingCount === 0
                  ? "Todo sincronizado"
                  : "Cambios por subir"}
              </Text>
            </View>
          </View>

          {/* Charts row */}
          <View className="flex-row flex-wrap justify-between mb-4">
            {/* Crop distribution chart */}
            <View className="bg-white rounded-xl p-4 w-[48%] shadow-sm border border-gray-100">
              <View className="flex-row items-center mb-2">
                <Leaf size={16} color="#2D6A4F" />
                <Text className="text-gray-600 text-xs font-semibold ml-1.5">
                  Cultivos
                </Text>
              </View>
              {hasCropData ? (
                <>
                  <View className="h-[130px] justify-center">
                    <BarChart
                      data={{
                        labels: cropDistData.labels.map((l) => l.slice(0, 4)),
                        datasets: [{ data: cropDistData.data }],
                      }}
                      width={CHART_WIDTH / 2 - 12}
                      height={130}
                      chartConfig={{
                        ...chartConfig,
                        color: (opacity = 1) =>
                          `rgba(45, 106, 79, ${opacity})`,
                      }}
                      yAxisLabel=""
                      yAxisSuffix=""
                      withHorizontalLabels={false}
                      withVerticalLabels={true}
                      showBarTops={false}
                      fromZero
                      style={{ marginLeft: -20 }}
                    />
                  </View>
                  <Text className="text-[10px] text-gray-400 text-center mt-1">
                    {fields.length} campos en {cropDistData.labels.length} cultivos
                  </Text>
                </>
              ) : (
                <View className="h-[130px] items-center justify-center">
                  <Sprout size={28} color="#D1D5DB" />
                  <Text className="text-gray-300 text-xs mt-2">
                    Sin datos
                  </Text>
                </View>
              )}
            </View>

            {/* Alert distribution pie */}
            <View className="bg-white rounded-xl p-4 w-[48%] shadow-sm border border-gray-100">
              <View className="flex-row items-center mb-2">
                <AlertTriangle size={16} color="#E76F51" />
                <Text className="text-gray-600 text-xs font-semibold ml-1.5">
                  Alertas
                </Text>
              </View>
              <View className="h-[130px] justify-center">
                <PieChart
                  data={alertPieData}
                  width={CHART_WIDTH / 2}
                  height={130}
                  chartConfig={chartConfig}
                  accessor="count"
                  backgroundColor="transparent"
                  paddingLeft="0"
                  absolute
                />
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <Text className="text-lg font-semibold text-gray-800 mb-3">
            Acciones Rápidas
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
                  <Text className="text-white font-medium mt-2">Sincronizar</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-sunlight rounded-xl py-4 px-4 w-[48%] items-center mb-3"
              onPress={() => router.push("/(tabs)/alerts")}
            >
              <AlertTriangle size={24} color="white" />
              <Text className="text-white font-medium mt-2">Ver Alertas</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-sky rounded-xl py-4 px-4 w-[48%] items-center mb-3"
              onPress={() => router.push("/(tabs)/crops")}
            >
              <Leaf size={24} color="white" />
              <Text className="text-white font-medium mt-2">Cultivos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-leaf-light rounded-xl py-4 px-4 w-[48%] items-center mb-3"
              onPress={() => router.push("/(tabs)/fields")}
            >
              <MapPin size={24} color="white" />
              <Text className="text-white font-medium mt-2">Campos</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Alerts */}
          <Text className="text-lg font-semibold text-gray-800 mb-3">
            Alertas Recientes
          </Text>
          {alerts.slice(0, 3).length === 0 ? (
            <View className="bg-white rounded-xl p-6 items-center shadow-sm border border-gray-100">
              <Text className="text-gray-400">Sin alertas recientes</Text>
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
