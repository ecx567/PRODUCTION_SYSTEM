"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  LogOut,
  Bell,
  Wifi,
  WifiOff,
  Activity,
  User,
  ChevronDown,
} from "lucide-react";
import type { SessionUser } from "@/lib/api";
import { useState } from "react";

/* ── Map route → human-readable breadcrumb ──────────────── */
const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/fields": "Fields",
  "/dashboard/devices": "Devices",
  "/dashboard/analytics": "Analytics",
  "/dashboard/alerts": "Alerts",
  "/dashboard/rules": "Rules",
  "/dashboard/users": "Users",
  "/dashboard/settings": "Settings",
};

interface TopBarProps {
  alertCount: number;
  sseConnected: boolean;
  user: SessionUser | null;
}

export default function TopBar({ alertCount, sseConnected, user }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  /* Resolve page breadcrumb */
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((_, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    return { href, label: ROUTE_LABELS[href] ?? segments[i] };
  });

  function handleLogout() {
    router.push("/");
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-leaf-100 bg-white px-5">
      {/* ── Left: Breadcrumbs ── */}
      <nav className="flex items-center gap-1.5 text-sm text-soil-400">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-leaf-200">/</span>}
            {i === breadcrumbs.length - 1 ? (
              <span className="font-medium text-leaf-700">{crumb.label}</span>
            ) : (
              <span>{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* ── Right: System Health + Alerts + User ── */}
      <div className="flex items-center gap-4">
        {/* --- SSE / Connection status --- */}
        <span
          className={`flex items-center gap-1.5 text-xs ${
            sseConnected ? "text-leaf-500" : "text-soil-400"
          }`}
        >
          {sseConnected ? (
            <>
              <Wifi className="h-3.5 w-3.5" />
              Live
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5" />
              Offline
            </>
          )}
        </span>

        {/* --- Alert bell --- */}
        <button
          type="button"
          className="relative rounded-full p-1.5 text-soil-500 transition-colors hover:bg-leaf-50 hover:text-leaf-600"
          onClick={() => router.push("/dashboard/alerts")}
        >
          <Bell className="h-4 w-4" />
          {alertCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger-400 px-1 text-[10px] font-bold text-white">
              {alertCount > 99 ? "99+" : alertCount}
            </span>
          )}
        </button>

        {/* --- User menu --- */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            onBlur={() => setTimeout(() => setUserMenuOpen(false), 150)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-soil-500 transition-colors hover:bg-leaf-50"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-leaf-200 text-leaf-700">
              <User className="h-3.5 w-3.5" />
            </div>
            <span className="hidden text-xs font-medium text-leaf-700 sm:block">
              {user?.email?.split("@")[0] ?? "User"}
            </span>
            <ChevronDown className="h-3 w-3" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-leaf-100 bg-white py-1 shadow-lg">
              <div className="border-b border-leaf-50 px-3 py-2">
                <p className="text-xs font-medium text-leaf-700">
                  {user?.email ?? "Unknown"}
                </p>
                <p className="text-[10px] text-soil-400 capitalize">
                  {user?.role ?? "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-soil-500 transition-colors hover:bg-danger-50 hover:text-danger-600"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
