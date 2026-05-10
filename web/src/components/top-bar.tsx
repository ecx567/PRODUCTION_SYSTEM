"use client";

import { useRouter } from "next/navigation";
import { LogOut, Bell, Wifi, WifiOff } from "lucide-react";
import { clearTokens } from "@/lib/api";

interface TopBarProps {
  alertCount: number;
  sseConnected: boolean;
}

export default function TopBar({ alertCount, sseConnected }: TopBarProps) {
  const router = useRouter();

  function handleLogout() {
    clearTokens();
    router.push("/auth/login");
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-leaf-100 bg-white px-6">
      {/* Page title area — reserved for per-page titles */}
      <div />

      {/* Right side controls */}
      <div className="flex items-center gap-4">
        {/* SSE connection indicator */}
        {sseConnected ? (
          <span className="flex items-center gap-1.5 text-xs text-leaf-500">
            <Wifi className="h-3.5 w-3.5" />
            Live
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-soil-400">
            <WifiOff className="h-3.5 w-3.5" />
            Offline
          </span>
        )}

        {/* Alert badge */}
        <button
          type="button"
          className="relative rounded-full p-1.5 text-soil-500 transition-colors hover:bg-leaf-50 hover:text-leaf-600"
          onClick={() => router.push("/dashboard/alerts")}
        >
          <Bell className="h-5 w-5" />
          {alertCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger-400 px-1 text-[10px] font-bold text-white">
              {alertCount > 99 ? "99+" : alertCount}
            </span>
          )}
        </button>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-soil-500 transition-colors hover:bg-leaf-50 hover:text-danger-500"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </header>
  );
}
