/**
 * Root layout: no auth guard — public access like the web version.
 *
 * Initializes the database and sync engine on start, then renders
 * the tab navigator directly.
 *
 * NOTE: On web, native modules are polyfilled via .web.ts versions.
 * The database is in-memory and ephemeral.
 */

import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { startSyncEngine } from "@/lib/sync";
import { getDatabase } from "@/lib/database";

export default function RootLayout() {
  useEffect(() => {
    // Initialize database and sync engine on app start
    getDatabase().catch((err) =>
      console.error("Database init error:", err),
    );
    startSyncEngine();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
