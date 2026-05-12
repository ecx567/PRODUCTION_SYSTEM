"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, Plus, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface AlertRule {
  id: string;
  name: string;
  metric_type: string;
  condition: string;
  threshold: number;
  severity: string;
  enabled: boolean;
  cooldown_minutes: number;
  field_id: string | null;
}

export default function RulesPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<{ items: AlertRule[]; total: number }>(
          "/api/v1/alerts/rules",
        );
        setRules(data.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load rules");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const severityBadge = (s: string) => {
    const map: Record<string, string> = {
      critical: "badge-critical",
      warning: "badge-warning",
      info: "badge-info",
    };
    return map[s] ?? "badge-info";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-leaf-700">Alert Rules</h1>
          <p className="text-sm text-soil-500">
            Configure thresholds and conditions for automated alerts
          </p>
        </div>
        <button
          type="button"
          disabled
          className="flex items-center gap-1.5 rounded-lg bg-leaf-500 px-3 py-2 text-xs font-medium text-white opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          New Rule
        </button>
      </div>

      {/* Loading / Error / Empty */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-leaf-200 border-t-leaf-500" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-danger-50 p-4 text-sm text-danger-600">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {!loading && !error && rules.length === 0 && (
        <div className="dashboard-card flex flex-col items-center justify-center py-12 text-center">
          <SlidersHorizontal className="mb-3 h-8 w-8 text-leaf-300" />
          <h3 className="text-sm font-semibold text-leaf-700">No Rules Yet</h3>
          <p className="mt-1 text-xs text-soil-400">
            Alert rules will appear here once configured
          </p>
        </div>
      )}

      {/* Rules list */}
      {!loading && rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="dashboard-card flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-2 w-2 rounded-full ${
                    rule.enabled ? "bg-leaf-400" : "bg-soil-200"
                  }`}
                />
                <div>
                  <p className="text-sm font-medium text-leaf-700">
                    {rule.name}
                  </p>
                  <p className="text-xs text-soil-400">
                    {rule.metric_type} {rule.condition} {rule.threshold}
                    {rule.field_id ? " · field-scoped" : " · tenant-wide"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={severityBadge(rule.severity)}>
                  {rule.severity}
                </span>
                <span className="rounded-full bg-leaf-50 px-2 py-0.5 text-[10px] text-leaf-500">
                  {rule.cooldown_minutes}m cooldown
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
