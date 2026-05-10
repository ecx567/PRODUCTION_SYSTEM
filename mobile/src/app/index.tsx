/**
 * Root index: redirect to auth or dashboard based on auth state.
 */

import { Redirect } from "expo-router";
import { useStore } from "@/lib/store";

export default function Index() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/auth/login" />;
}
