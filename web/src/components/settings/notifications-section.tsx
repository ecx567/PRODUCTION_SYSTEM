"use client";

import { Bell, Mail, Timer } from "lucide-react";
import type { NotificationSettings } from "@/lib/settings";

interface NotificationsSectionProps {
  settings: NotificationSettings;
  onChange: (settings: NotificationSettings) => void;
}

const SEVERITY_OPTIONS = [
  { value: "critical", label: "Critical only" },
  { value: "warning", label: "Warning and above" },
  { value: "info", label: "All alerts (info, warning, critical)" },
] as const;

const DIGEST_OPTIONS = [
  { value: "immediate", label: "Immediate" },
  { value: "daily", label: "Daily summary" },
  { value: "weekly", label: "Weekly summary" },
] as const;

/**
 * Notification preferences section.
 * Lets users configure default alert severity, email toggle, and digest frequency.
 */
export default function NotificationsSection({
  settings,
  onChange,
}: NotificationsSectionProps) {
  function handleSeverityChange(value: string) {
    onChange({
      ...settings,
      defaultSeverity: value as NotificationSettings["defaultSeverity"],
    });
  }

  function handleEmailToggle() {
    onChange({
      ...settings,
      emailNotifications: !settings.emailNotifications,
    });
  }

  function handleDigestChange(value: string) {
    onChange({
      ...settings,
      digestFrequency: value as NotificationSettings["digestFrequency"],
    });
  }

  return (
    <div className="space-y-4">
      {/* Default Alert Severity */}
      <div className="dashboard-card">
        <div className="mb-3 flex items-center gap-2">
          <Bell className="h-4 w-4 text-leaf-500" />
          <h3 className="text-sm font-semibold text-leaf-800">
            Default Alert Severity
          </h3>
        </div>
        <p className="mb-3 text-xs text-soil-400">
          Minimum severity level for alert notifications.
        </p>
        <div className="space-y-2">
          {SEVERITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-leaf-100 px-4 py-2.5 transition-colors hover:border-leaf-300 has-[:checked]:border-leaf-500 has-[:checked]:bg-leaf-50"
            >
              <input
                type="radio"
                name="defaultSeverity"
                value={opt.value}
                checked={settings.defaultSeverity === opt.value}
                onChange={(e) => handleSeverityChange(e.target.value)}
                className="h-4 w-4 accent-leaf-500"
              />
              <span className="text-sm text-leaf-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Email Notifications */}
      <div className="dashboard-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-leaf-500" />
            <div>
              <h3 className="text-sm font-semibold text-leaf-800">
                Email Notifications
              </h3>
              <p className="text-xs text-soil-400">
                Receive alert summaries via email
              </p>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={handleEmailToggle}
              className="peer sr-only"
            />
            <div className="h-6 w-11 rounded-full bg-leaf-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all after:content-[''] peer-checked:bg-leaf-500 peer-checked:after:translate-x-full" />
          </label>
        </div>
      </div>

      {/* Digest Frequency */}
      {settings.emailNotifications && (
        <div className="dashboard-card">
          <div className="mb-3 flex items-center gap-2">
            <Timer className="h-4 w-4 text-leaf-500" />
            <h3 className="text-sm font-semibold text-leaf-800">
              Digest Frequency
            </h3>
          </div>
          <p className="mb-3 text-xs text-soil-400">
            How often to receive email summaries.
          </p>
          <select
            value={settings.digestFrequency}
            onChange={(e) => handleDigestChange(e.target.value)}
            className="w-full rounded-lg border border-leaf-200 bg-white px-3 py-2 text-sm text-leaf-700 outline-none transition-colors focus:border-leaf-400 focus:ring-2 focus:ring-leaf-100"
          >
            {DIGEST_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="text-xs text-soil-400">
        Notification settings are stored locally in this browser.
        Cross-device sync will be available in a future update.
      </p>
    </div>
  );
}
