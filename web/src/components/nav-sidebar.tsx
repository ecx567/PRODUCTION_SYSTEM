"use client";

import { usePathname } from "next/navigation";
import { LayoutDashboard, Map, Bell, Settings } from "lucide-react";
import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/fields", label: "Fields", icon: Map },
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function NavSidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex h-full w-60 flex-col bg-leaf-800">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-leaf-700 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-leaf-500">
          <span className="text-lg font-bold text-white">CP</span>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Crop Production</h2>
          <p className="text-[10px] text-leaf-300">Control Room</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
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
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-leaf-700 px-5 py-3">
        <p className="text-[10px] text-leaf-400">v0.1.0</p>
      </div>
    </aside>
  );
}
