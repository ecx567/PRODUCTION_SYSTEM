import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-leaf-800">Settings</h1>
        <p className="text-sm text-soil-500">Account and system preferences</p>
      </div>

      <div className="dashboard-card flex flex-col items-center gap-4 py-12 text-center">
        <Settings className="h-10 w-10 text-leaf-200" />
        <div>
          <p className="text-sm font-medium text-leaf-700">
            Settings Coming Soon
          </p>
          <p className="text-xs text-soil-400">
            Profile management, notification preferences, and API token
            configuration will be available in a future release.
          </p>
        </div>
      </div>
    </div>
  );
}
