"use client";

import NavSidebar from "@/components/nav-sidebar";
import TopBar from "@/components/top-bar";
import { useSSE } from "@/lib/hooks";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { liveAlerts, isConnected } = useSSE();

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
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
