"use client";

import { useEffect, useState } from "react";
import NavSidebar from "@/components/nav-sidebar";
import TopBar from "@/components/top-bar";
import { useSSE } from "@/lib/hooks";
import { loginUser } from "@/lib/api";
import type { SessionUser } from "@/lib/api";

/** Seed credentials para auto-login */
const SEED_EMAIL = "admin@crop.local";
const SEED_PASSWORD = "admin1234";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { liveAlerts, isConnected } = useSSE();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await loginUser(SEED_EMAIL, SEED_PASSWORD);
        const payload = JSON.parse(atob(data.access_token.split(".")[1]));
        setUser({
          user_id: payload.sub ?? "",
          email: payload.email ?? SEED_EMAIL,
          role: payload.role ?? "admin",
          tenant_id: payload.tenant_id ?? "",
        });
      } catch {
        // Backend no disponible — seguimos con user null
      }
      setChecking(false);
    })();
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-leaf-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-leaf-200 border-t-leaf-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <NavSidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <TopBar
          alertCount={liveAlerts.filter((a) => !a.acknowledged_at).length}
          sseConnected={isConnected}
          user={user}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
