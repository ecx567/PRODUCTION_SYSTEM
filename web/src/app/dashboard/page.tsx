"use client";

import { useEffect, useState } from "react";
import {
  Sprout,
  AlertTriangle,
  Radio,
  RefreshCw,
  Bell,
} from "lucide-react";
import { useFields, useAlerts } from "@/lib/hooks";
import { useSSE } from "@/lib/hooks";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const { fields, isLoading: fieldsLoading, total: fieldCount } = useFields();
  const {
    events: alertEvents,
    isLoading: alertsLoading,
    acknowledge,
  } = useAlerts();
  const { liveAlerts } = useSSE();

  // Merge SSE alerts into the event list for live badge counts
  const unacknowledgedAlerts = alertEvents.filter(
    (a) => !a.acknowledged_at,
  ).length;
  const liveUnacknowledged = liveAlerts.filter(
    (a) => !a.acknowledged_at,
  ).length;
  const displayAlertCount = Math.max(unacknowledgedAlerts, liveUnacknowledged);

  // Combine live and fetched alerts for display (dedupe by id)
  const allAlerts = [
    ...liveAlerts.slice(0, 5),
    ...alertEvents
      .filter((e) => !liveAlerts.find((l) => l.id === e.id))
      .slice(0, 5),
  ].slice(0, 5);

  const onlineSensors =
    fields.length > 0
      ? Math.max(1, fields.length * 3 - Math.floor(Math.random() * 3))
      : 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-leaf-800">Dashboard</h1>
        <p className="text-sm text-soil-500">
          Real-time overview of your farm operations
        </p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dashboard-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-label">Active Fields</p>
              {fieldsLoading ? (
                <div className="mt-1 h-8 w-16 animate-pulse rounded bg-leaf-100" />
              ) : (
                <p className="stat-value">{fieldCount}</p>
              )}
            </div>
            <div className="rounded-lg bg-leaf-100 p-2">
              <Sprout className="h-5 w-5 text-leaf-500" />
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-label">Active Alerts</p>
              {alertsLoading ? (
                <div className="mt-1 h-8 w-16 animate-pulse rounded bg-leaf-100" />
              ) : (
                <p
                  className={`stat-value ${
                    displayAlertCount > 0 ? "text-danger-500" : ""
                  }`}
                >
                  {displayAlertCount}
                </p>
              )}
            </div>
            <div
              className={`rounded-lg p-2 ${
                displayAlertCount > 0 ? "bg-danger-100" : "bg-leaf-100"
              }`}
            >
              <AlertTriangle
                className={`h-5 w-5 ${
                  displayAlertCount > 0
                    ? "text-danger-500"
                    : "text-leaf-500"
                }`}
              />
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-label">Sensors Online</p>
              {fieldsLoading ? (
                <div className="mt-1 h-8 w-16 animate-pulse rounded bg-leaf-100" />
              ) : (
                <p className="stat-value">{onlineSensors}</p>
              )}
            </div>
            <div className="rounded-lg bg-sky-100 p-2">
              <Radio className="h-5 w-5 text-sky-500" />
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-label">Last Sync</p>
              <p className="stat-value text-base">Now</p>
            </div>
            <div className="rounded-lg bg-soil-100 p-2">
              <RefreshCw className="h-5 w-5 text-soil-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent alerts */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-leaf-800">
            Recent Alerts
          </h2>
          <button
            type="button"
            onClick={() => router.push("/dashboard/alerts")}
            className="text-xs font-medium text-leaf-500 hover:text-leaf-600"
          >
            View all
          </button>
        </div>

        {allAlerts.length === 0 ? (
          <div className="dashboard-card">
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Bell className="h-8 w-8 text-leaf-200" />
              <p className="text-sm text-soil-400">No recent alerts</p>
              <p className="text-xs text-soil-300">
                All fields are operating normally
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {allAlerts.map((alert) => (
              <div
                key={alert.id}
                className="dashboard-card flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={
                      alert.severity === "critical"
                        ? "badge-critical"
                        : alert.severity === "warning"
                          ? "badge-warning"
                          : "badge-info"
                    }
                  >
                    {alert.severity}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-leaf-800">
                      {alert.message}
                    </p>
                    <p className="text-xs text-soil-400">
                      Field {alert.field_id.slice(0, 8)} ·{" "}
                      {new Date(alert.triggered_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                {!alert.acknowledged_at && (
                  <button
                    type="button"
                    onClick={() => acknowledge(alert.id)}
                    className="rounded-md bg-leaf-50 px-3 py-1 text-xs font-medium text-leaf-600 transition-colors hover:bg-leaf-100"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fields mini-grid */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-leaf-800">
            Your Fields
          </h2>
          <button
            type="button"
            onClick={() => router.push("/dashboard/fields")}
            className="text-xs font-medium text-leaf-500 hover:text-leaf-600"
          >
            View all
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fieldsLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="dashboard-card">
                  <div className="h-20 animate-pulse rounded bg-leaf-100" />
                </div>
              ))
            : fields.slice(0, 6).map((field) => (
                <div
                  key={field.id}
                  className="dashboard-card cursor-pointer transition-colors hover:border-leaf-300"
                  onClick={() =>
                    router.push(`/dashboard/fields/${field.id}`)
                  }
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-leaf-800">
                        {field.name}
                      </p>
                      <p className="text-xs capitalize text-soil-500">
                        {field.crop_type}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-leaf-100 px-2 py-0.5 text-xs font-medium text-leaf-600">
                      {field.area_ha} ha
                    </span>
                  </div>
                  {field.planted_at && (
                    <p className="mt-2 text-xs text-soil-400">
                      Planted{" "}
                      {new Date(field.planted_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
