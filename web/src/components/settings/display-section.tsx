"use client";

import { Monitor, Thermometer, Globe } from "lucide-react";
import type { DisplaySettings } from "@/lib/settings";

interface DisplaySectionProps {
  settings: DisplaySettings;
  onChange: (settings: DisplaySettings) => void;
}

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

const TEMP_UNIT_OPTIONS = [
  { value: "celsius", label: "°C — Celsius" },
  { value: "fahrenheit", label: "°F — Fahrenheit" },
] as const;

/**
 * Common timezone list using Intl API (filtered to major zones).
 */
function getCommonTimezones(): string[] {
  const preferred = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Sao_Paulo",
    "America/Argentina/Buenos_Aires",
    "America/Mexico_City",
    "America/Toronto",
    "America/Vancouver",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Madrid",
    "Europe/Rome",
    "Europe/Amsterdam",
    "Europe/Stockholm",
    "Europe/Moscow",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Asia/Seoul",
    "Asia/Singapore",
    "Asia/Hong_Kong",
    "Australia/Sydney",
    "Australia/Melbourne",
    "Pacific/Auckland",
    "Pacific/Honolulu",
    "Africa/Cairo",
    "Africa/Lagos",
    "Africa/Johannesburg",
  ];

  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Move detected zone to the top if it's in the list
    if (preferred.includes(detected)) {
      return [
        detected,
        ...preferred.filter((z) => z !== detected),
      ];
    }
    return [detected, ...preferred];
  } catch {
    return preferred;
  }
}

/**
 * Display preferences section.
 * Theme selector, temperature unit, and timezone picker.
 */
export default function DisplaySection({
  settings,
  onChange,
}: DisplaySectionProps) {
  const commonTimezones = getCommonTimezones();

  function handleThemeChange(value: string) {
    onChange({
      ...settings,
      theme: value as DisplaySettings["theme"],
    });
  }

  function handleTempUnitChange(value: string) {
    onChange({
      ...settings,
      tempUnit: value as DisplaySettings["tempUnit"],
    });
  }

  function handleTimezoneChange(value: string) {
    onChange({
      ...settings,
      timezone: value,
    });
  }

  return (
    <div className="space-y-4">
      {/* Theme */}
      <div className="dashboard-card">
        <div className="mb-3 flex items-center gap-2">
          <Monitor className="h-4 w-4 text-leaf-500" />
          <h3 className="text-sm font-semibold text-leaf-800">Theme</h3>
        </div>
        <p className="mb-3 text-xs text-soil-400">
          Choose your preferred appearance.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleThemeChange(opt.value)}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                settings.theme === opt.value
                  ? "border-leaf-500 bg-leaf-50 text-leaf-700"
                  : "border-leaf-100 bg-white text-soil-500 hover:border-leaf-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Temperature Unit */}
      <div className="dashboard-card">
        <div className="mb-3 flex items-center gap-2">
          <Thermometer className="h-4 w-4 text-leaf-500" />
          <h3 className="text-sm font-semibold text-leaf-800">
            Temperature Unit
          </h3>
        </div>
        <p className="mb-3 text-xs text-soil-400">
          Preferred unit for temperature readings across the dashboard.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {TEMP_UNIT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleTempUnitChange(opt.value)}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                settings.tempUnit === opt.value
                  ? "border-leaf-500 bg-leaf-50 text-leaf-700"
                  : "border-leaf-100 bg-white text-soil-500 hover:border-leaf-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timezone */}
      <div className="dashboard-card">
        <div className="mb-3 flex items-center gap-2">
          <Globe className="h-4 w-4 text-leaf-500" />
          <h3 className="text-sm font-semibold text-leaf-800">
            Timezone
          </h3>
        </div>
        <p className="mb-3 text-xs text-soil-400">
          All dates and times will be displayed in this timezone.
        </p>
        <select
          value={settings.timezone}
          onChange={(e) => handleTimezoneChange(e.target.value)}
          className="w-full rounded-lg border border-leaf-200 bg-white px-3 py-2 text-sm text-leaf-700 outline-none transition-colors focus:border-leaf-400 focus:ring-2 focus:ring-leaf-100"
        >
          {commonTimezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
