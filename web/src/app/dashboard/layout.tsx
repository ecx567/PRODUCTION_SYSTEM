"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getAccessToken } from "@/lib/api";
import NavSidebar from "@/components/nav-sidebar";
import TopBar from "@/components/top-bar";
import { useSSE } from "@/lib/hooks";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthed, setIsAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const { liveAlerts, isConnected } = useSSE();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.push("/auth/login");
    } else {
      setIsAuthed(true);
    }
    setChecking(false);
  }, [router, pathname]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-leaf-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-leaf-200 border-t-leaf-500" />
      </div>
    );
  }

  if (!isAuthed) {
    return null;
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
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
