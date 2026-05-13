/**
 * Crop profiles list screen: searchable grid of all 18 crops.
 */

import { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Search, Leaf } from "lucide-react-native";
import { CROP_PROFILES } from "@/data/crops";
import { CROP_PROFILES as PROFILES } from "@/data/crops";

const CROP_TYPES = ["Todos", "Anual", "Perenne"] as const;

export default function CropsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("Todos");

  const filtered = useMemo(() => {
    let list = PROFILES;
    if (filter !== "Todos") {
      list = list.filter((c) => c.type === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.scientific.toLowerCase().includes(q),
      );
    }
    return list;
  }, [search, filter]);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Search bar */}
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center bg-white rounded-xl px-4 py-2 border border-gray-200">
          <Search size={18} color="#9CA3AF" />
          <TextInput
            className="flex-1 ml-2 text-base text-gray-800"
            placeholder="Buscar cultivo..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Filter chips */}
      <View className="flex-row px-4 pb-3 gap-2">
        {CROP_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setFilter(t)}
            className={`rounded-full px-4 py-1.5 ${
              filter === t ? "bg-leaf" : "bg-white border border-gray-200"
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                filter === t ? "text-white" : "text-gray-600"
              }`}
            >
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Crop grid */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperClassName="px-2"
        contentContainerClassName="px-2 pb-6"
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-1 m-1.5"
            onPress={() => router.push(`/(tabs)/crops/${item.id}`)}
          >
            <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 items-center">
              <Text className="text-3xl mb-2">{item.emoji}</Text>
              <Text className="text-sm font-semibold text-gray-800 text-center">
                {item.name}
              </Text>
              <Text className="text-[10px] text-gray-400 mt-0.5 italic">
                {item.scientific}
              </Text>
              <View className="flex-row items-center mt-2 gap-1">
                <View
                  className={`rounded-full px-2 py-0.5 ${
                    item.type === "Perenne"
                      ? "bg-green-100"
                      : "bg-amber-100"
                  }`}
                >
                  <Text
                    className={`text-[10px] font-medium ${
                      item.type === "Perenne"
                        ? "text-green-700"
                        : "text-amber-700"
                    }`}
                  >
                    {item.type}
                  </Text>
                </View>
                <View className="bg-leaf/10 rounded-full px-2 py-0.5">
                  <Text className="text-[10px] font-medium text-leaf">
                    {item.gddTotal} GDD
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Leaf size={48} color="#9CA3AF" />
            <Text className="text-gray-400 mt-3 text-base">
              No se encontraron cultivos
            </Text>
          </View>
        }
      />
    </View>
  );
}
