"use client";

import { AlertTriangle, Info, XCircle, X } from "lucide-react";

interface AlertBannerProps {
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp?: string;
  onAcknowledge?: () => void;
  onDismiss?: () => void;
}

const severityConfig = {
  critical: {
    icon: XCircle,
    bg: "bg-danger-50 border-danger-200",
    text: "text-danger-700",
    iconColor: "text-danger-500",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-sunlight-50 border-sunlight-200",
    text: "text-sunlight-700",
    iconColor: "text-sunlight-500",
  },
  info: {
    icon: Info,
    bg: "bg-sky-50 border-sky-200",
    text: "text-sky-700",
    iconColor: "text-sky-500",
  },
};

export default function AlertBanner({
  severity,
  message,
  timestamp,
  onAcknowledge,
  onDismiss,
}: AlertBannerProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${config.bg}`}
    >
      <Icon className={`h-5 w-5 flex-shrink-0 ${config.iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${config.text}`}>{message}</p>
        {timestamp && (
          <p className="text-xs text-soil-400">
            {new Date(timestamp).toLocaleString()}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onAcknowledge && (
          <button
            type="button"
            onClick={onAcknowledge}
            className="rounded-md bg-white px-3 py-1 text-xs font-medium text-soil-600 shadow-sm transition-colors hover:bg-soil-50"
          >
            Acknowledge
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md p-1 text-soil-400 transition-colors hover:bg-white hover:text-soil-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
