"use client";

import { useState, useCallback } from "react";
import { User, Bell, Monitor, Key, Settings } from "lucide-react";
import { loadSettings, saveSettings, resetSettings } from "@/lib/settings";
import type { UserSettings } from "@/lib/settings";
import ProfileSection from "@/components/settings/profile-section";
import NotificationsSection from "@/components/settings/notifications-section";
import DisplaySection from "@/components/settings/display-section";
import ApiKeysSection from "@/components/settings/api-keys-section";

// ── Tab definitions ─────────────────────────────────────────────

type TabId = "profile" | "notifications" | "display" | "api-keys";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "display", label: "Display", icon: Monitor },
  { id: "api-keys", label: "API Keys", icon: Key },
];

// ── Page component ──────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [userSettings, setUserSettings] = useState<UserSettings>(() =>
    loadSettings(),
  );
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );

  // Persist to localStorage whenever settings change (save on change)
  const handleSettingsChange = useCallback(
    (updated: UserSettings) => {
      setUserSettings(updated);
      setSaveStatus("saving");
      const ok = saveSettings(updated);
      setSaveStatus(ok ? "saved" : "error");
    },
    [],
  );

  // Section-specific change handlers
  const handleNotificationsChange = useCallback(
    (notifications: UserSettings["notifications"]) => {
      handleSettingsChange({
        ...userSettings,
        notifications,
      });
    },
    [userSettings, handleSettingsChange],
  );

  const handleDisplayChange = useCallback(
    (display: UserSettings["display"]) => {
      handleSettingsChange({
        ...userSettings,
        display,
      });
    },
    [userSettings, handleSettingsChange],
  );

  // Reset to defaults
  const handleReset = useCallback(() => {
    resetSettings();
    const defaults = loadSettings();
    setUserSettings(defaults);
    handleSettingsChange(defaults);
  }, [handleSettingsChange]);

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-leaf-800">Settings</h1>
          <p className="text-sm text-soil-500">
            Account and system preferences
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Save indicator */}
          <span
            className={`flex items-center gap-1.5 text-xs ${
              saveStatus === "saved"
                ? "text-leaf-500"
                : saveStatus === "saving"
                  ? "text-sunlight-500"
                  : "text-danger-500"
            }`}
          >
            {saveStatus === "saved" && "✓ Saved"}
            {saveStatus === "saving" && "Saving..."}
            {saveStatus === "error" && "Save failed"}
          </span>

          {/* Reset button */}
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-leaf-200 px-3 py-1.5 text-xs font-medium text-soil-500 transition-colors hover:border-leaf-300 hover:text-leaf-600"
          >
            Reset to defaults
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 border-b border-leaf-100">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-leaf-500 text-leaf-700"
                  : "border-transparent text-soil-400 hover:border-leaf-200 hover:text-leaf-600"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Active tab content ── */}
      <div data-testid={`section-${activeTab}`}>
        {activeTab === "profile" && <ProfileSection user={null} />}
        {activeTab === "notifications" && (
          <NotificationsSection
            settings={userSettings.notifications}
            onChange={handleNotificationsChange}
          />
        )}
        {activeTab === "display" && (
          <DisplaySection
            settings={userSettings.display}
            onChange={handleDisplayChange}
          />
        )}
        {activeTab === "api-keys" && <ApiKeysSection />}
      </div>
    </div>
  );
}
