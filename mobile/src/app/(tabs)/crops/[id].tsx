/**
 * Crop detail screen: full profile with requirements, diseases, and GDD chart.
 */

import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { ArrowLeft, Thermometer, Droplets, Sun, Sprout } from "lucide-react-native";
import { LineChart } from "react-native-chart-kit";
import { getCropById } from "@/data/crops";

const screenWidth = Dimensions.get("window").width;

function GddBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <View className="h-5 bg-gray-100 rounded-full overflow-hidden">
      <View
        className="h-full rounded-full bg-leaf"
        style={{ width: `${pct}%` }}
      />
    </View>
  );
}

export default function CropDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const crop = useMemo(() => getCropById(id ?? ""), [id]);

  if (!crop) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500 text-lg">Cultivo no encontrado</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 bg-leaf px-6 py-2 rounded-lg"
        >
          <Text className="text-white font-medium">Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const gddChartData = {
    labels: ["Base", "Mitad", "Umbral Enf.", "Total Ciclo"],
    datasets: [
      {
        data: [
          crop.gddTotal * 0.1,
          crop.gddTotal * 0.5,
          (crop.diseases[0]?.gdd ?? crop.gddTotal * 0.5),
          crop.gddTotal,
        ],
        color: () => "#2D6A4F",
        strokeWidth: 2,
      },
    ],
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          headerShown: true,
          title: crop.name,
          headerStyle: { backgroundColor: "#2D6A4F" },
          headerTintColor: "white",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="mr-2">
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Hero */}
          <View className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-gray-100 items-center">
            <Text className="text-5xl mb-3">{crop.emoji}</Text>
            <Text className="text-lg font-bold text-gray-800">{crop.name}</Text>
            <Text className="text-xs text-gray-400 italic mt-1">
              {crop.scientific}
            </Text>
            <View className="flex-row gap-2 mt-3">
              <View className="bg-leaf/10 rounded-full px-3 py-1">
                <Text className="text-xs font-medium text-leaf">
                  {crop.family}
                </Text>
              </View>
              <View
                className={`rounded-full px-3 py-1 ${
                  crop.type === "Perenne" ? "bg-green-100" : "bg-amber-100"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    crop.type === "Perenne" ? "text-green-700" : "text-amber-700"
                  }`}
                >
                  {crop.type}
                </Text>
              </View>
            </View>
            <Text className="text-xs text-gray-500 mt-3 text-center leading-relaxed">
              {crop.desc}
            </Text>
          </View>

          {/* Requirements */}
          <Text className="text-base font-semibold text-gray-800 mb-3">
            Requerimientos Ambientales
          </Text>
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row flex-wrap">
              <ReqItem
                icon={<Thermometer size={16} color="#E76F51" />}
                label="Temperatura"
                value={`${crop.tempMin}°C - ${crop.tempMax}°C`}
              />
              <ReqItem
                icon={<Droplets size={16} color="#7EC8E3" />}
                label="Humedad"
                value={`${crop.humidityMin}% - ${crop.humidityMax}%`}
              />
              <ReqItem
                icon={<Sun size={16} color="#F4A460" />}
                label="Precipitación"
                value={`${crop.rainMin} - ${crop.rainMax} mm/mes`}
              />
              <ReqItem
                icon={<Sprout size={16} color="#2D6A4F" />}
                label="pH Suelo"
                value={`${crop.phMin} - ${crop.phMax}`}
              />
              <ReqItem
                icon={<Sprout size={16} color="#40916C" />}
                label="Ciclo"
                value={crop.cycle}
              />
              {crop.extra?.map((e) => (
                <ReqItem
                  key={e.param}
                  icon={<Sprout size={16} color="#8B7355" />}
                  label={e.param}
                  value={e.value}
                />
              ))}
            </View>

            {/* GDD total */}
            <View className="mt-4 pt-3 border-t border-gray-100">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-xs font-medium text-gray-500">
                  GDD Total del Ciclo
                </Text>
                <Text className="text-sm font-bold text-leaf">
                  {crop.gddTotal} GDD
                </Text>
              </View>
              <GddBar value={crop.gddTotal} max={2500} />
            </View>
          </View>

          {/* GDD Chart */}
          <Text className="text-base font-semibold text-gray-800 mb-3">
            Progresión de GDD
          </Text>
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <LineChart
              data={gddChartData}
              width={screenWidth - 56}
              height={180}
              chartConfig={{
                backgroundColor: "white",
                backgroundGradientFrom: "white",
                backgroundGradientTo: "white",
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(45, 106, 79, ${opacity})`,
                labelColor: () => "#6B7280",
                propsForDots: {
                  r: "5",
                  strokeWidth: "2",
                  stroke: "#2D6A4F",
                },
                propsForBackgroundLines: {
                  strokeDasharray: "",
                  stroke: "#E5E7EB",
                },
              }}
              bezier
              style={{ borderRadius: 8 }}
            />
            <Text className="text-[10px] text-gray-400 text-center mt-2">
              Progresión estimada de GDD durante el ciclo del cultivo
            </Text>
          </View>

          {/* Diseases */}
          <Text className="text-base font-semibold text-gray-800 mb-3">
            Enfermedades y Plagas
          </Text>
          <View className="bg-white rounded-xl overflow-hidden mb-4 shadow-sm border border-gray-100">
            {crop.diseases.map((d, i) => (
              <View
                key={d.name}
                className={`p-4 ${i < crop.diseases.length - 1 ? "border-b border-gray-100" : ""}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-medium text-gray-800">
                    {d.name}
                  </Text>
                  {d.gdd && (
                    <View className="bg-danger/10 rounded-full px-2 py-0.5">
                      <Text className="text-[10px] font-medium text-danger">
                        &gt; {d.gdd} GDD
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-xs text-gray-500 mt-1">{d.condition}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function ReqItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View className="w-1/2 mb-3">
      <View className="flex-row items-center mb-0.5">
        {icon}
        <Text className="text-[10px] font-medium text-gray-400 ml-1.5 uppercase">
          {label}
        </Text>
      </View>
      <Text className="text-sm font-semibold text-gray-700 ml-7">{value}</Text>
    </View>
  );
}
