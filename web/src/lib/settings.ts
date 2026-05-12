/**
 * Typed settings persistence for the Crop Production dashboard.
 *
 * All settings are stored in localStorage under the key "crop.settings".
 * Settings are scoped to the current browser — no cross-device sync (v1).
 *
 * Usage:
 *   const settings = loadSettings();
 *   settings.display.theme = "dark";
 *   saveSettings(settings);
 */

// ── Types ──────────────────────────────────────────────────────

export interface NotificationSettings {
  defaultSeverity: "critical" | "warning" | "info";
  emailNotifications: boolean;
  digestFrequency: "immediate" | "daily" | "weekly";
}

export interface DisplaySettings {
  theme: "light" | "dark" | "system";
  tempUnit: "celsius" | "fahrenheit";
  timezone: string;
}

export interface UserSettings {
  notifications: NotificationSettings;
  display: DisplaySettings;
}

// ── Defaults ────────────────────────────────────────────────────

const STORAGE_KEY = "crop.settings";

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export const DEFAULT_SETTINGS: UserSettings = {
  notifications: {
    defaultSeverity: "warning",
    emailNotifications: false,
    digestFrequency: "daily",
  },
  display: {
    theme: "system",
    tempUnit: "celsius",
    timezone: detectTimezone(),
  },
};

// ── Helpers ────────────────────────────────────────────────────

/**
 * Load settings from localStorage.
 * Returns defaults if no saved settings exist or if they are corrupt.
 */
export function loadSettings(): UserSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw) as Partial<UserSettings>;

    // Deep-merge with defaults to fill any missing keys
    return {
      notifications: { ...DEFAULT_SETTINGS.notifications, ...parsed.notifications },
      display: { ...DEFAULT_SETTINGS.display, ...parsed.display },
    };
  } catch {
    // Corrupt localStorage — reset to defaults
    saveSettings(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persist settings to localStorage.
 * Silently fails if storage quota is exceeded.
 */
export function saveSettings(settings: UserSettings): boolean {
  if (typeof window === "undefined") return false;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    // Storage quota exceeded or private browsing restrictions
    return false;
  }
}

/**
 * Clear all saved settings and reset to defaults.
 */
export function resetSettings(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Listen for storage changes from other tabs.
 * Fires cross-tab sync.
 */
export function onStorageChange(
  callback: (settings: UserSettings) => void,
): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      callback(loadSettings());
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handler);
  }

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handler);
    }
  };
}
