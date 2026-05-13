/**
 * Field detail screen: sensor readings, charts, recommendations, alerts.
 */

import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { ArrowLeft, RefreshCw, Thermometer, Droplets } from "lucide-react-native";
import { LineChart } from "react-native-chart-kit";
import * as api from "@/lib/api";
import * as database from "@/lib/database";
import SensorGauge from "@/components/SensorGauge";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { getCropEmoji } from "@/data/crops";

const screenWidth = Dimensions.get("window").width;
const CHART_W = screenWidth - 32;

interface FieldDetail {
  id: string;
  name: string;
  cropType: string;
  areaHa: number;
  plantedAt: string | null;
  location: string | null;
}

interface SensorDisplay {
  time: string;
  temp: number | null;
  humidity: number | null;
  soilMoisture: number | null;
  rain: number | null;
}

interface SensorHistory {
  labels: string[];
  temp: number[];
  humidity: number[];
  moisture: number[];
}

interface RecItem {
  type: string;
  action: string;
  detail: string;
  confidence: string;
}

export default function FieldDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [field, setField] = useState<FieldDetail | null>(null);
  const [sensors, setSensors] = useState<SensorDisplay | null>(null);
  const [history, setHistory] = useState<SensorHistory | null>(null);
  const [recommendations, setRecommendations] = useState<RecItem[]>([]);
  const [alerts, setAlerts] = useState<
    { id: string; severity: string; message: string; triggeredAt: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDetail = async () => {
    try {
      // Offline-first: load from local DB
      const localField = await database.getLocalField(id);
      if (localField) {
        setField({
          id: localField.id,
          name: localField.name,
          cropType: localField.crop_type,
          areaHa: localField.area_ha,
          plantedAt: localField.planted_at,
          location: localField.location,
        });
      }

      const localReadings = await database.getLatestReadings(id);
      if (localReadings.length > 0) {
        const latest = localReadings[0];
        setSensors({
          time: latest.time,
          temp: latest.temp,
          humidity: latest.humidity,
          soilMoisture: latest.soil_moisture,
          rain: latest.rain,
        });

        // Build history data from local readings
        const reversed = [...localReadings].reverse();
        const labels = reversed.map((r) => {
          const d = new Date(r.time);
          return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
        });
        setHistory({
          labels: labels.slice(0, 12),
          temp: reversed.map((r) => r.temp ?? 0).slice(0, 12),
          humidity: reversed.map((r) => r.humidity ?? 0).slice(0, 12),
          moisture: reversed.map((r) => r.soil_moisture ?? 0).slice(0, 12),
        });
      }

      const localAlerts = await database.getLocalAlerts();
      const fieldAlerts = localAlerts
        .filter((a) => a.field_id === id)
        .slice(0, 5);
      setAlerts(
        fieldAlerts.map((a) => ({
          id: a.id,
          severity: a.severity,
          message: a.message,
          triggeredAt: a.triggered_at,
        })),
      );
    } catch (err) {
      console.error("Error loading local field detail:", err);
    }

    // Try remote data
    try {
      if (api.isAuthenticated()) {
        const [fieldData, sensorData, recData, alertData] = await Promise.all([
          api.getField(id),
          api.getFieldSensors(id),
          api.getRecommendations(id).catch(() => null),
          api.getAlertEvents().catch(() => null),
        ]);

        setField({
          id: fieldData.id,
          name: fieldData.name,
          cropType: fieldData.crop_type,
          areaHa: fieldData.area_ha,
          plantedAt: fieldData.planted_at,
          location: fieldData.location,
        });

        if (sensorData.length > 0) {
          const latest = sensorData[0];
          setSensors({
            time: latest.time,
            temp: latest.temp,
            humidity: latest.humidity,
            soilMoisture: latest.soil_moisture,
            rain: latest.rain,
          });

          // Build history from remote data
          const reversed = [...sensorData].reverse();
          const labels = reversed.map((r) => {
            const d = new Date(r.time);
            return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
          });
          setHistory({
            labels: labels.slice(0, 12),
            temp: reversed.map((r) => r.temp ?? 0).slice(0, 12),
            humidity: reversed.map((r) => r.humidity ?? 0).slice(0, 12),
            moisture: reversed.map((r) => r.soil_moisture ?? 0).slice(0, 12),
          });
        }

        if (recData) {
          const items: RecItem[] = [];
          if (recData.irrigation) {
            items.push({
              type: "Riego",
              action: recData.irrigation.action,
              detail: `ETo: ${recData.irrigation.eto_mm}mm | Humedad: ${recData.irrigation.soil_moisture_pct}%`,
              confidence: recData.irrigation.confidence,
            });
          }
          if (recData.fertilization) {
            items.push({
              type: "Fertilización",
              action: recData.fertilization.action,
              detail: `N: ${recData.fertilization.nitrogen_kg_ha} kg/ha | Etapa: ${recData.fertilization.stage}`,
              confidence: recData.fertilization.confidence,
            });
          }
          if (recData.pest_risk) {
            items.push({
              type: "Riesgo de Plagas",
              action: recData.pest_risk.risk_level,
              detail: `${recData.pest_risk.pest_type} | GDD: ${recData.pest_risk.gdd_accumulated}/${recData.pest_risk.gdd_threshold}`,
              confidence: recData.pest_risk.risk_level,
            });
          }
          setRecommendations(items);
        }

        if (alertData) {
          const fieldAlerts = alertData.items
            .filter((a) => a.field_id === id)
            .slice(0, 5);
          setAlerts(
            fieldAlerts.map((a) => ({
              id: a.id,
              severity: a.severity,
              message: a.message,
              triggeredAt: a.triggered_at,
            })),
          );
        }
      }
    } catch (err) {
      console.error("Error loading remote field detail:", err);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadDetail().finally(() => setLoading(false));
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDetail();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50">
        <LoadingSkeleton />
      </View>
    );
  }

  if (!field) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Campo no encontrado</Text>
      </View>
    );
  }

  const severityColor = (sev: string) => {
    switch (sev) {
      case "critical": return "bg-danger";
      case "warning": return "bg-sunlight";
      default: return "bg-sky";
    }
  };

  const actionColor = (action: string) => {
    switch (action) {
      case "irrigate":
      case "apply": return "bg-leaf";
      case "high":
      case "severe": return "bg-danger";
      case "monitor":
      case "delay": return "bg-sunlight";
      default: return "bg-gray-400";
    }
  };

  const chartConfig = {
    backgroundColor: "white",
    backgroundGradientFrom: "white",
    backgroundGradientTo: "white",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(45, 106, 79, ${opacity})`,
    labelColor: () => "#6B7280",
    propsForBackgroundLines: { strokeDasharray: "", stroke: "#E5E7EB" },
    propsForDots: { r: "3" },
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          headerShown: true,
          title: field.name,
          headerStyle: { backgroundColor: "#2D6A4F" },
          headerTintColor: "white",
          headerLeft: () => (
            <TouchableOpacity onPress={() => {}} className="mr-2">
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={onRefresh} className="ml-2">
              <RefreshCw size={20} color="white" />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#2D6A4F"]}
            tintColor="#2D6A4F"
          />
        }
      >
        <View className="p-4">
          {/* Field Info Card */}
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row items-center mb-3">
              <Text className="text-3xl mr-3">{getCropEmoji(field.cropType)}</Text>
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-lg font-semibold text-gray-800 capitalize">
                    {field.cropType}
                  </Text>
                  <View className="bg-leaf/10 rounded-full px-3 py-1">
                    <Text className="text-leaf text-sm font-medium">
                      {field.areaHa} ha
                    </Text>
                  </View>
                </View>
                {field.plantedAt && (
                  <Text className="text-gray-500 text-sm mt-0.5">
                    Plantado: {new Date(field.plantedAt).toLocaleDateString()}
                  </Text>
                )}
                {field.location && (
                  <Text className="text-gray-400 text-xs mt-0.5">
                    {field.location}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Sensor Gauges */}
          <Text className="text-base font-semibold text-gray-800 mb-3">
            Lecturas Actuales
          </Text>
          {sensors ? (
            <View className="flex-row flex-wrap justify-between mb-4">
              <SensorGauge label="Temperatura" value={sensors.temp} unit="°C" min={-10} max={50} threshold={{ warn: 35, danger: 42 }} colorScale={["#7EC8E3", "#F4A460", "#E76F51"]} />
              <SensorGauge label="Humedad" value={sensors.humidity} unit="%" min={0} max={100} threshold={{ warn: 80, danger: 90 }} colorScale={["#7EC8E3", "#40916C", "#2D6A4F"]} />
              <SensorGauge label="Suelo" value={sensors.soilMoisture} unit="%" min={0} max={100} threshold={{ warn: 20, danger: 10 }} colorScale={["#E76F51", "#F4A460", "#7EC8E3"]} />
              <SensorGauge label="Lluvia" value={sensors.rain} unit="mm" min={0} max={200} threshold={{ warn: 80, danger: 120 }} colorScale={["#7EC8E3", "#40916C", "#1B4332"]} />
            </View>
          ) : (
            <View className="bg-white rounded-xl p-6 items-center mb-4 shadow-sm border border-gray-100">
              <Text className="text-gray-400">Sin datos de sensores</Text>
            </View>
          )}

          {/* Historical Chart */}
          {history && history.temp.length > 1 && (
            <>
              <Text className="text-base font-semibold text-gray-800 mb-3">
                Historial de Sensores
              </Text>

              {/* Temperature chart */}
              <View className="bg-white rounded-xl p-3 mb-3 shadow-sm border border-gray-100">
                <View className="flex-row items-center mb-2">
                  <Thermometer size={14} color="#E76F51" />
                  <Text className="text-xs font-semibold text-gray-600 ml-1.5">
                    Temperatura (°C)
                  </Text>
                </View>
                <LineChart
                  data={{
                    labels: history.labels,
                    datasets: [
                      {
                        data: history.temp,
                        color: () => "#E76F51",
                        strokeWidth: 2,
                      },
                    ],
                  }}
                  width={CHART_W - 16}
                  height={150}
                  chartConfig={{
                    ...chartConfig,
                    color: (opacity = 1) => `rgba(231, 111, 81, ${opacity})`,
                  }}
                  bezier
                  withInnerLines={false}
                  withOuterLines={true}
                  style={{ borderRadius: 8 }}
                />
              </View>

              {/* Humidity chart */}
              <View className="bg-white rounded-xl p-3 mb-4 shadow-sm border border-gray-100">
                <View className="flex-row items-center mb-2">
                  <Droplets size={14} color="#7EC8E3" />
                  <Text className="text-xs font-semibold text-gray-600 ml-1.5">
                    Humedad (%)
                  </Text>
                </View>
                <LineChart
                  data={{
                    labels: history.labels,
                    datasets: [
                      {
                        data: history.humidity,
                        color: () => "#7EC8E3",
                        strokeWidth: 2,
                      },
                    ],
                  }}
                  width={CHART_W - 16}
                  height={150}
                  chartConfig={{
                    ...chartConfig,
                    color: (opacity = 1) => `rgba(126, 200, 227, ${opacity})`,
                  }}
                  bezier
                  withInnerLines={false}
                  withOuterLines={true}
                  style={{ borderRadius: 8 }}
                />
              </View>
            </>
          )}

          {/* Recommendations */}
          <Text className="text-base font-semibold text-gray-800 mb-3">
            Recomendaciones
          </Text>
          {recommendations.length > 0 ? (
            recommendations.map((rec, idx) => (
              <TouchableOpacity
                key={idx}
                className="bg-white rounded-xl p-4 mb-2 shadow-sm border border-gray-100"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="font-semibold text-gray-800">{rec.type}</Text>
                  <View className={`${actionColor(rec.action)} rounded-full px-3 py-0.5`}>
                    <Text className="text-white text-xs font-medium capitalize">
                      {rec.action}
                    </Text>
                  </View>
                </View>
                <Text className="text-gray-500 text-sm">{rec.detail}</Text>
                {rec.confidence && (
                  <Text className="text-gray-400 text-xs mt-1">
                    Confianza: {rec.confidence}
                  </Text>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <View className="bg-white rounded-xl p-6 items-center mb-4 shadow-sm border border-gray-100">
              <Text className="text-gray-400">Sin recomendaciones aún</Text>
            </View>
          )}

          {/* Recent Alerts */}
          <Text className="text-base font-semibold text-gray-800 mb-3">
            Alertas Recientes
          </Text>
          {alerts.length > 0 ? (
            alerts.map((alert) => (
              <View
                key={alert.id}
                className="bg-white rounded-xl p-4 mb-2 shadow-sm border border-gray-100"
              >
                <View className="flex-row items-center">
                  <View className={`h-3 w-3 rounded-full mr-3 ${severityColor(alert.severity)}`} />
                  <View className="flex-1">
                    <Text className="text-gray-800 text-sm">{alert.message}</Text>
                    <Text className="text-gray-400 text-xs mt-0.5">
                      {new Date(alert.triggeredAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View className="bg-white rounded-xl p-6 items-center mb-4 shadow-sm border border-gray-100">
              <Text className="text-gray-400">Sin alertas para este campo</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
