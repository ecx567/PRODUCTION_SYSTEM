/**
 * Alerts list screen: SectionList grouped by severity with swipe-to-acknowledge.
 */

import { useEffect, useCallback } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useStore } from "@/lib/store";
import { performSync } from "@/lib/sync";
import SyncBanner from "@/components/SyncBanner";
import AlertItem from "@/components/AlertItem";
import EmptyState from "@/components/EmptyState";
import LoadingSkeleton from "@/components/LoadingSkeleton";

interface AlertSection {
  title: string;
  severity: string;
  data: Array<{
    id: string;
    fieldId: string;
    severity: string;
    message: string;
    triggeredAt: string;
    acknowledgedAt: string | null;
  }>;
}

export default function AlertsScreen() {
  const { alerts, alertsLoading, loadAlerts, acknowledgeAlert } = useStore();

  useEffect(() => {
    loadAlerts();
  }, []);

  const onRefresh = useCallback(async () => {
    await performSync();
    await loadAlerts();
  }, [loadAlerts]);

  const handleAcknowledge = (id: string) => {
    Alert.alert("Acknowledge Alert", "Mark this alert as acknowledged?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Acknowledge",
        onPress: () => acknowledgeAlert(id),
      },
    ]);
  };

  // Group alerts by severity
  const sections: AlertSection[] = [];
  const severities = ["critical", "warning", "info"];

  for (const sev of severities) {
    const items = alerts.filter(
      (a) => a.severity === sev && !a.acknowledgedAt,
    );
    if (items.length > 0) {
      sections.push({
        title:
          sev === "critical"
            ? `Critical (${items.length})`
            : sev === "warning"
              ? `Warning (${items.length})`
              : `Info (${items.length})`,
        severity: sev,
        data: items,
      });
    }
  }

  // Add acknowledged items at the bottom
  const ackedItems = alerts.filter((a) => a.acknowledgedAt);
  if (ackedItems.length > 0) {
    sections.push({
      title: `Acknowledged (${ackedItems.length})`,
      severity: "acknowledged",
      data: ackedItems,
    });
  }

  if (alertsLoading && alerts.length === 0) {
    return (
      <View className="flex-1 bg-gray-50">
        <SyncBanner />
        <LoadingSkeleton />
      </View>
    );
  }

  const severityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-danger";
      case "warning":
        return "bg-sunlight";
      case "info":
        return "bg-sky";
      default:
        return "bg-gray-300";
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <SyncBanner />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AlertItem
            severity={item.severity}
            message={item.message}
            time={item.triggeredAt}
            acknowledged={!!item.acknowledgedAt}
            onAcknowledge={() => handleAcknowledge(item.id)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View className="flex-row items-center px-4 py-2">
            <View
              className={`h-2.5 w-2.5 rounded-full mr-2 ${severityColor(section.severity)}`}
            />
            <Text className="text-sm font-semibold text-gray-600 uppercase">
              {section.title}
            </Text>
          </View>
        )}
        contentContainerStyle={{
          paddingBottom: 16,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={alertsLoading}
            onRefresh={onRefresh}
            colors={["#2D6A4F"]}
            tintColor="#2D6A4F"
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="Bell"
            message="No alerts to show"
            actionLabel="Refresh"
            onAction={onRefresh}
          />
        }
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}
