"use client";

import { useState } from "react";
import { Bell, CheckCircle, Filter } from "lucide-react";
import { useAlerts } from "@/lib/hooks";

export default function AlertsPage() {
  const [severityFilter, setSeverityFilter] = useState<string | undefined>();
  const [ackFilter, setAckFilter] = useState<boolean | undefined>();

  const {
    events,
    isLoading,
    error,
    total,
    nextCursor,
    acknowledge,
    loadMore,
    refresh,
  } = useAlerts(severityFilter, ackFilter);

  function severityBadge(severity: string) {
    switch (severity) {
      case "critical":
        return "badge-critical";
      case "warning":
        return "badge-warning";
      case "info":
        return "badge-info";
      default:
        return "badge-info";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-leaf-800">Alerts</h1>
          <p className="text-sm text-soil-500">{total} total events</p>
        </div>

        <button
          type="button"
          onClick={refresh}
          className="rounded-lg bg-leaf-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-leaf-600"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-soil-400" />

        <div className="flex gap-2">
          {[undefined, "critical", "warning", "info"].map((sev) => (
            <button
              key={sev ?? "all"}
              type="button"
              onClick={() => setSeverityFilter(sev)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                severityFilter === sev
                  ? "bg-leaf-500 text-white"
                  : "bg-white text-soil-500 hover:bg-leaf-50"
              }`}
            >
              {sev ?? "All"}
            </button>
          ))}
        </div>

        <span className="text-xs text-soil-300">|</span>

        <div className="flex gap-2">
          {[
            { label: "All", value: undefined },
            { label: "Unacknowledged", value: false },
            { label: "Acknowledged", value: true },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setAckFilter(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                ackFilter === opt.value
                  ? "bg-leaf-500 text-white"
                  : "bg-white text-soil-500 hover:bg-leaf-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && events.length === 0 && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="dashboard-card h-16 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-600">
          {error}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && events.length === 0 && (
        <div className="dashboard-card flex flex-col items-center gap-3 py-12 text-center">
          <Bell className="h-10 w-10 text-leaf-200" />
          <p className="text-sm text-soil-400">No alerts match your filters</p>
        </div>
      )}

      {/* Alerts table */}
      {events.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-leaf-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-leaf-100 bg-leaf-50 text-xs font-medium text-soil-500">
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Metric</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Threshold</th>
                <th className="px-4 py-3">Field</th>
                <th className="px-4 py-3">Triggered</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-leaf-50 text-sm text-leaf-700 transition-colors hover:bg-leaf-50/50"
                >
                  <td className="px-4 py-3">
                    <span className={severityBadge(event.severity)}>
                      {event.severity}
                    </span>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <p className="truncate font-medium">{event.message}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{event.metric_type}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {event.actual_value.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {event.threshold.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {event.field_id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 text-xs text-soil-400">
                    {new Date(event.triggered_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {event.acknowledged_at ? (
                      <span className="inline-flex items-center gap-1 text-xs text-leaf-500">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Done
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => acknowledge(event.id)}
                        className="rounded-md bg-leaf-50 px-2.5 py-1 text-xs font-medium text-leaf-600 transition-colors hover:bg-leaf-100"
                      >
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Load more */}
      {nextCursor && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoading}
            className="rounded-lg border border-leaf-200 bg-white px-6 py-2 text-sm font-medium text-leaf-600 transition-colors hover:bg-leaf-50 disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
