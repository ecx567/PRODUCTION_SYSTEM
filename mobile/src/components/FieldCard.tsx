/**
 * Field summary card: crop icon (emoji for 18 crops), name, area, quick status.
 */

import React from "react";
import { View, Text } from "react-native";
import { MapPin } from "lucide-react-native";
import { getCropEmoji } from "@/data/crops";

interface FieldCardProps {
  name: string;
  cropType: string;
  areaHa: number;
}

export default function FieldCard({ name, cropType, areaHa }: FieldCardProps) {
  const emoji = getCropEmoji(cropType);

  return (
    <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <View className="flex-row items-center">
        {/* Crop icon */}
        <View className="h-12 w-12 rounded-full bg-leaf-light/10 items-center justify-center mr-4">
          <Text className="text-2xl">{emoji}</Text>
        </View>

        {/* Field info */}
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-800">{name}</Text>
          <View className="flex-row items-center mt-1">
            <Text className="text-gray-500 text-sm capitalize">{cropType}</Text>
            <Text className="text-gray-300 mx-2">•</Text>
            <MapPin size={12} color="#9CA3AF" />
            <Text className="text-gray-400 text-sm ml-1">{areaHa} ha</Text>
          </View>
        </View>

        {/* Arrow indicator */}
        <View className="ml-2">
          <Text className="text-gray-300 text-lg">{">"}</Text>
        </View>
      </View>
    </View>
  );
}
