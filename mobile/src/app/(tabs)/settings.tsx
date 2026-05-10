/**
 * Settings screen: user profile, sync status, logout.
 */

import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  User,
  RefreshCw,
  Wifi,
  WifiOff,
  LogOut,
  Info,
} from "lucide-react-native";
import { useStore } from "@/lib/store";
import { performSync, onSyncEvent } from "@/lib/sync";
import * as database from "@/lib/database";

export default function SettingsScreen() {
  const { user, isAuthenticated, logout, syncPendingCount, setSyncPendingCount } =
    useStore();
  const [lastSync, setLastSync] = useState<string>("Never");
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const loadMeta = async () => {
      const lastSyncTime = await database.getLastSyncTime();
      setLastSync(
        lastSyncTime
          ? new Date(lastSyncTime).toLocaleString()
          : "Never",
      );
      const count = await database.getPendingCount();
      setSyncPendingCount(count);
    };
    loadMeta();

    const unsub = onSyncEvent((event) => {
      setSyncPendingCount(event.pendingCount);
      setLastSync(
        event.lastSyncTime
          ? new Date(event.lastSyncTime).toLocaleString()
          : "Never",
      );
      setIsSyncing(event.status === "syncing");
    });

    return unsub;
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    await performSync();
    const count = await database.getPendingCount();
    setSyncPendingCount(count);
    const lastSyncTime = await database.getLastSyncTime();
    setLastSync(
      lastSyncTime
        ? new Date(lastSyncTime).toLocaleString()
        : "Never",
    );
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        {/* User Profile */}
        <View className="bg-white rounded-xl p-6 mb-4 shadow-sm border border-gray-100 items-center">
          <View className="h-16 w-16 rounded-full bg-leaf items-center justify-center mb-3">
            <User size={32} color="white" />
          </View>
          <Text className="text-lg font-semibold text-gray-800">
            {user?.email ?? "Not logged in"}
          </Text>
          <Text className="text-gray-400 text-sm capitalize">
            Role: {user?.role ?? "N/A"}
          </Text>
          {user?.tenantId && (
            <Text className="text-gray-400 text-xs mt-1">
              Tenant: {user.tenantId.slice(0, 8)}...
            </Text>
          )}
        </View>

        {/* Sync Status */}
        <Text className="text-lg font-semibold text-gray-800 mb-3">
          Synchronization
        </Text>
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Wifi size={20} color="#2D6A4F" />
              <Text className="text-gray-700 ml-2">Status</Text>
            </View>
            <View className="flex-row items-center">
              <View className="h-2 w-2 rounded-full bg-leaf mr-1" />
              <Text className="text-gray-600">Online</Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-gray-700">Last Sync</Text>
            <Text className="text-gray-500 text-sm">{lastSync}</Text>
          </View>

          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-gray-700">Pending Changes</Text>
            <View className="bg-leaf-light/10 rounded-full px-3 py-1">
              <Text className="text-leaf font-medium text-sm">
                {syncPendingCount}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            className="bg-leaf rounded-lg py-3 items-center flex-row justify-center disabled:opacity-50"
            onPress={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <RefreshCw size={18} color="white" />
                <Text className="text-white font-medium ml-2">Sync Now</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* About */}
        <Text className="text-lg font-semibold text-gray-800 mb-3">About</Text>
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
          <View className="flex-row items-center mb-2">
            <Info size={20} color="#2D6A4F" />
            <Text className="text-gray-700 ml-2">CropMonitor</Text>
          </View>
          <Text className="text-gray-400 text-sm">Version 1.0.0</Text>
          <Text className="text-gray-400 text-xs mt-1">
            Digital Agriculture Management Platform
          </Text>
        </View>

        {/* Logout */}
        <TouchableOpacity
          className="bg-white rounded-xl py-4 items-center border border-red-200 shadow-sm"
          onPress={handleLogout}
        >
          <View className="flex-row items-center">
            <LogOut size={20} color="#E76F51" />
            <Text className="text-danger font-medium ml-2">Logout</Text>
          </View>
        </TouchableOpacity>

        <Text className="text-center text-gray-400 text-xs mt-8">
          © 2026 CropMonitor
        </Text>
      </View>
    </ScrollView>
  );
}
