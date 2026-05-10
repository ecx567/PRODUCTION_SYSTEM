"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/**
 * Error boundary / fallback UI for dashboard sections.
 * Shows a friendly error message with optional retry button.
 */
export default function ErrorFallback({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  onRetry,
}: ErrorFallbackProps) {
  return (
    <div className="dashboard-card flex flex-col items-center gap-4 py-12 text-center">
      <div className="rounded-full bg-danger-100 p-3">
        <AlertTriangle className="h-6 w-6 text-danger-500" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-leaf-800">{title}</h3>
        <p className="mt-1 text-sm text-soil-400">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-leaf-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-leaf-600"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      )}
    </div>
  );
}
