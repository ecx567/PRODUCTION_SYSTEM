"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  Radio,
  TrendingUp,
  Bell,
  SlidersHorizontal,
  Users,
  Settings,
  BookOpen,
} from "lucide-react";
import Link from "next/link";

/* ── Navigation groups ────────────────────────────────────
 * Grouped by IoT system layers:
 *   MONITOR    → real-time observability
 *   INTELLIGENCE → analytics & ML
 *   NOTIFICATIONS → alert rules & events
 *   SYSTEM     → admin & config
 */
const navGroups: Array<{
  label: string;
  items: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
}> = [
  {
    label: "MONITOR",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/fields", label: "Fields", icon: Map },
      { href: "/dashboard/devices", label: "Devices", icon: Radio },
    ],
  },
  {
    label: "INTELLIGENCE",
    items: [
      { href: "/dashboard/analytics", label: "Analytics", icon: TrendingUp },
    ],
  },
  {
    label: "NOTIFICATIONS",
    items: [
      { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
      { href: "/dashboard/rules", label: "Rules", icon: SlidersHorizontal },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { href: "/dashboard/users", label: "Users", icon: Users },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    label: "DOCUMENTATION",
    items: [
      { href: "/dashboard/documentation", label: "Documentación", icon: BookOpen },
    ],
  },
];

export default function NavSidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex h-full w-60 flex-col bg-leaf-800">
      {/* ── Logo / Brand ── */}
      <div className="flex items-center gap-3 border-b border-leaf-700 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-leaf-500">
          <span className="text-lg font-bold text-white">CP</span>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Crop Production</h2>
          <p className="text-[10px] text-leaf-300">IoT Platform</p>
        </div>
      </div>

      {/* ── Grouped navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-leaf-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      active ? "sidebar-link-active" : "sidebar-link"
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-leaf-700 px-5 py-3">
        <p className="text-[10px] text-leaf-400">v0.1.0 · IoT Platform</p>
      </div>
    </aside>
  );
}
