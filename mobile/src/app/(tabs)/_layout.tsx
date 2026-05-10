/**
 * Tab navigator layout: Dashboard, Fields, Alerts, Settings.
 */

import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { Home, MapPin, Bell, Settings } from "lucide-react-native";

function TabIcon({ icon: Icon, color, size }: { icon: typeof Home; color: string; size: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <Icon color={color} size={size} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2D6A4F",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          backgroundColor: "white",
          borderTopColor: "#E5E7EB",
          paddingBottom: 4,
          height: 56,
        },
        headerStyle: {
          backgroundColor: "#2D6A4F",
        },
        headerTintColor: "white",
        headerTitleStyle: {
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <TabIcon icon={Home} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="fields"
        options={{
          title: "Fields",
          tabBarIcon: ({ color, size }) => (
            <TabIcon icon={MapPin} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color, size }) => (
            <TabIcon icon={Bell} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <TabIcon icon={Settings} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
