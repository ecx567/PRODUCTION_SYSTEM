/**
 * Fields list screen: FlatList with field cards and pull-to-refresh.
 */

import { useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useStore } from "@/lib/store";
import { performSync } from "@/lib/sync";
import FieldCard from "@/components/FieldCard";
import EmptyState from "@/components/EmptyState";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import SyncBanner from "@/components/SyncBanner";

export default function FieldsScreen() {
  const router = useRouter();
  const { fields, fieldsLoading, fieldsError, loadFields } = useStore();

  useEffect(() => {
    loadFields();
  }, []);

  const onRefresh = useCallback(async () => {
    await performSync();
    await loadFields();
  }, [loadFields]);

  if (fieldsLoading && fields.length === 0) {
    return (
      <View className="flex-1 bg-gray-50">
        <SyncBanner />
        <LoadingSkeleton />
      </View>
    );
  }

  if (fieldsError && fields.length === 0) {
    return (
      <View className="flex-1 bg-gray-50">
        <SyncBanner />
        <EmptyState
          icon="MapPin"
          message="Unable to load fields"
          actionLabel="Retry"
          onAction={loadFields}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <SyncBanner />
      <FlatList
        data={fields}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/(tabs)/fields/${item.id}`)}
          >
            <FieldCard
              name={item.name}
              cropType={item.cropType}
              areaHa={item.areaHa}
            />
          </TouchableOpacity>
        )}
        contentContainerStyle={{
          padding: 16,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={fieldsLoading}
            onRefresh={onRefresh}
            colors={["#2D6A4F"]}
            tintColor="#2D6A4F"
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="MapPin"
            message="No fields yet"
            actionLabel="Sync to load fields"
            onAction={onRefresh}
          />
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
      />
    </View>
  );
}
