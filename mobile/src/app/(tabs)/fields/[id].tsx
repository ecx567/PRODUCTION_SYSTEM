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
import { ArrowLeft, RefreshCw } from "lucide-react-native";
import * as api from "@/lib/api";
import * as database from "@/lib/database";
import SensorGauge from "@/components/SensorGauge";
import LoadingSkeleton from "@/components/LoadingSkeleton";

const screenWidth = Dimensions.get("window").width;

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
  const [recommendations, setRecommendations] = useState<RecItem[]>([]);
  const [alerts, setAlerts] = useState<
    { id: string; severity: string; message: string; triggeredAt: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDetail = async () => {
    try {
      // Load from local DB first (offline-first)
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
          const latestSensor = sensorData[0];
          setSensors({
            time: latestSensor.time,
            temp: latestSensor.temp,
            humidity: latestSensor.humidity,
            soilMoisture: latestSensor.soil_moisture,
            rain: latestSensor.rain,
          });
        }

        if (recData) {
          const items: RecItem[] = [];
          if (recData.irrigation) {
            items.push({
              type: "Irrigation",
              action: recData.irrigation.action,
              detail: `ETo: ${recData.irrigation.eto_mm}mm | Moisture: ${recData.irrigation.soil_moisture_pct}%`,
              confidence: recData.irrigation.confidence,
            });
          }
          if (recData.fertilization) {
            items.push({
              type: "Fertilization",
              action: recData.fertilization.action,
              detail: `N: ${recData.fertilization.nitrogen_kg_ha} kg/ha | Stage: ${recData.fertilization.stage}`,
              confidence: recData.fertilization.confidence,
            });
          }
          if (recData.pest_risk) {
            items.push({
              type: "Pest Risk",
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
        <Text className="text-gray-500">Field not found</Text>
      </View>
    );
  }

  const severityColor = (sev: string) => {
    switch (sev) {
      case "critical":
        return "bg-danger";
      case "warning":
        return "bg-sunlight";
      default:
        return "bg-sky";
    }
  };

  const actionColor = (action: string) => {
    switch (action) {
      case "irrigate":
      case "apply":
        return "bg-leaf";
      case "high":
      case "severe":
        return "bg-danger";
      case "monitor":
      case "delay":
        return "bg-sunlight";
      default:
        return "bg-gray-400";
    }
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
            <TouchableOpacity
              onPress={() => {
                // Router handles going back
              }}
              className="mr-2"
            >
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
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-lg font-semibold text-gray-800 capitalize">
                {field.cropType}
              </Text>
              <View className="bg-leaf-light/10 rounded-full px-3 py-1">
                <Text className="text-leaf text-sm font-medium">
                  {field.areaHa} ha
                </Text>
              </View>
            </View>
            {field.plantedAt && (
              <Text className="text-gray-500 text-sm">
                Planted: {new Date(field.plantedAt).toLocaleDateString()}
              </Text>
            )}
            {field.location && (
              <Text className="text-gray-400 text-xs mt-1">
                {field.location}
              </Text>
            )}
          </View>

          {/* Sensor Gauges */}
          <Text className="text-lg font-semibold text-gray-800 mb-3">
            Latest Readings
          </Text>
          {sensors ? (
            <View className="flex-row flex-wrap justify-between mb-4">
              <SensorGauge
                label="Temperature"
                value={sensors.temp}
                unit="°C"
                min={-10}
                max={50}
                threshold={{ warn: 35, danger: 42 }}
                colorScale={["#7EC8E3", "#F4A460", "#E76F51"]}
              />
              <SensorGauge
                label="Humidity"
                value={sensors.humidity}
                unit="%"
                min={0}
                max={100}
                threshold={{ warn: 80, danger: 90 }}
                colorScale={["#7EC8E3", "#40916C", "#2D6A4F"]}
              />
              <SensorGauge
                label="Soil Moisture"
                value={sensors.soilMoisture}
                unit="%"
                min={0}
                max={100}
                threshold={{ warn: 20, danger: 10 }}
                colorScale={["#E76F51", "#F4A460", "#7EC8E3"]}
              />
              <SensorGauge
                label="Rain"
                value={sensors.rain}
                unit="mm"
                min={0}
                max={200}
                threshold={{ warn: 80, danger: 120 }}
                colorScale={["#7EC8E3", "#40916C", "#1B4332"]}
              />
            </View>
          ) : (
            <View className="bg-white rounded-xl p-6 items-center mb-4 shadow-sm border border-gray-100">
              <Text className="text-gray-400">No sensor data available</Text>
            </View>
          )}

          {/* Recommendations */}
          <Text className="text-lg font-semibold text-gray-800 mb-3">
            Recommendations
          </Text>
          {recommendations.length > 0 ? (
            recommendations.map((rec, idx) => (
              <TouchableOpacity
                key={idx}
                className="bg-white rounded-xl p-4 mb-2 shadow-sm border border-gray-100"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="font-semibold text-gray-800">{rec.type}</Text>
                  <View
                    className={`${actionColor(rec.action)} rounded-full px-3 py-0.5`}
                  >
                    <Text className="text-white text-xs font-medium capitalize">
                      {rec.action}
                    </Text>
                  </View>
                </View>
                <Text className="text-gray-500 text-sm">{rec.detail}</Text>
                {rec.confidence && (
                  <Text className="text-gray-400 text-xs mt-1">
                    Confidence: {rec.confidence}
                  </Text>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <View className="bg-white rounded-xl p-6 items-center mb-4 shadow-sm border border-gray-100">
              <Text className="text-gray-400">No recommendations yet</Text>
            </View>
          )}

          {/* Recent Alerts */}
          <Text className="text-lg font-semibold text-gray-800 mb-3">
            Recent Alerts
          </Text>
          {alerts.length > 0 ? (
            alerts.map((alert) => (
              <View
                key={alert.id}
                className="bg-white rounded-xl p-4 mb-2 shadow-sm border border-gray-100"
              >
                <View className="flex-row items-center">
                  <View
                    className={`h-3 w-3 rounded-full mr-3 ${severityColor(alert.severity)}`}
                  />
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
              <Text className="text-gray-400">No alerts for this field</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
