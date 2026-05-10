/**
 * Root layout: auth guard and navigation container.
 *
 * - Checks auth state on mount
 * - Redirects unauthenticated users to /auth/login
 * - Initializes SQLite and sync engine on first load
 */

import { useEffect } from "react";
import { Redirect, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useStore } from "@/lib/store";
import { startSyncEngine } from "@/lib/sync";
import { getDatabase } from "@/lib/database";

export default function RootLayout() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  useEffect(() => {
    // Initialize database and sync engine on app start
    getDatabase().catch((err) =>
      console.error("Database init error:", err),
    );
    startSyncEngine();
  }, []);

  if (!isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="auth/login"
          options={{ headerShown: false, animation: "slide_from_left" }}
        />
      </Stack>
    </>
  );
}
