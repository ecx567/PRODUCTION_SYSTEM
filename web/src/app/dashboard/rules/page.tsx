"use client";

import { useEffect, useState, useCallback } from "react";
import { SlidersHorizontal, Plus, AlertTriangle, Edit2, Trash2, RefreshCw } from "lucide-react";
import {
  AlertRuleResponse,
  getRules,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import RuleFormModal from "@/components/rules/rule-form-modal";
import DeleteDialog from "@/components/rules/delete-dialog";

export default function RulesPage() {
  const [rules, setRules] = useState<AlertRuleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRuleResponse | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<AlertRuleResponse | null>(null);

  // Toast notification
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadRules = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await getRules();
      setRules(data.items);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to load rules";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  function showNotification(type: "success" | "error", message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }

  // ── Handlers ──────────────────────────────────────────────────────

  function handleNewClick() {
    setEditingRule(null);
    setFormModalOpen(true);
  }

  function handleEditClick(rule: AlertRuleResponse) {
    setEditingRule(rule);
    setFormModalOpen(true);
  }

  function handleDeleteClick(rule: AlertRuleResponse) {
    setDeletingRule(rule);
    setDeleteDialogOpen(true);
  }

  function handleRuleSaved(savedRule: AlertRuleResponse) {
    // Update list: replace if exists, add if new
    setRules((prev) => {
      const exists = prev.some((r) => r.id === savedRule.id);
      if (exists) {
        return prev.map((r) => (r.id === savedRule.id ? savedRule : r));
      }
      // Insert at top (newest first)
      return [savedRule, ...prev];
    });

    showNotification(
      "success",
      editingRule
        ? "Rule updated successfully"
        : "Rule created successfully",
    );
  }

  function handleRuleDeleted(ruleId: string) {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    // If we were editing this rule, close the form
    if (editingRule?.id === ruleId) {
      setFormModalOpen(false);
    }
    showNotification("success", "Rule deleted successfully");
  }

  const severityBadge = (s: string) => {
    const map: Record<string, string> = {
      critical: "badge-critical",
      warning: "badge-warning",
      info: "badge-info",
    };
    return map[s] ?? "badge-info";
  };

  const conditionLabel = (c: string) => {
    const map: Record<string, string> = {
      gt: ">",
      lt: "<",
      eq: "=",
      between: "between",
    };
    return map[c] ?? c;
  };

  return (
    <div className="space-y-6">
      {/* Notification toast */}
      {notification && (
        <div
          className={cn(
            "fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg",
            notification.type === "success"
              ? "bg-leaf-500 text-white"
              : "bg-danger-500 text-white",
          )}
          role="status"
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-leaf-700">Alert Rules</h1>
          <p className="text-sm text-soil-500">
            Configure thresholds and conditions for automated alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadRules(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-leaf-200 bg-white px-3 py-2 text-xs font-medium text-leaf-700 transition-colors hover:bg-leaf-50 disabled:opacity-50"
            aria-label="Refresh"
            data-testid="refresh-button"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
            />
          </button>
          <button
            type="button"
            onClick={handleNewClick}
            className="flex items-center gap-1.5 rounded-lg bg-leaf-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-leaf-600"
            data-testid="new-rule-button"
          >
            <Plus className="h-3.5 w-3.5" />
            New Rule
          </button>
        </div>
      </div>

      {/* Loading / Error / Empty */}
      {loading && !refreshing && (
        <div className="flex items-center justify-center py-12" data-testid="loading-spinner">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-leaf-200 border-t-leaf-500" />
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-lg bg-danger-50 p-4 text-sm text-danger-600" data-testid="error-banner">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
          <button
            type="button"
            onClick={() => loadRules()}
            className="rounded-md bg-white px-3 py-1 text-xs font-medium text-danger-600 shadow-sm hover:bg-danger-100"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && rules.length === 0 && (
        <div className="dashboard-card flex flex-col items-center justify-center py-12 text-center" data-testid="empty-state">
          <SlidersHorizontal className="mb-3 h-8 w-8 text-leaf-300" />
          <h3 className="text-sm font-semibold text-leaf-700">
            No Rules Yet
          </h3>
          <p className="mt-1 text-xs text-soil-400">
            Click "New Rule" to create your first alert
          </p>
          <button
            type="button"
            onClick={handleNewClick}
            className="mt-4 rounded-lg bg-leaf-500 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-leaf-600"
          >
            <Plus className="h-3.5 w-3.5 inline mr-1.5" />
            New Rule
          </button>
        </div>
      )}

      {/* Rules list with edit/delete actions */}
      {!loading && rules.length > 0 && (
        <div className="space-y-2" data-testid="rules-list">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="dashboard-card flex items-center justify-between"
              data-testid={`rule-card-${rule.id}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    rule.enabled ? "bg-leaf-400" : "bg-soil-200",
                  )}
                />
                <div>
                  <p className="text-sm font-medium text-leaf-700">
                    {rule.name}
                  </p>
                  <p className="text-xs text-soil-400">
                    {rule.metric_type} {conditionLabel(rule.condition)}{" "}
                    {rule.condition === "between"
                      ? `${rule.threshold} - ${rule.threshold_max}`
                      : rule.threshold}
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
                <div className="flex items-center gap-1 ml-2 border-l border-leaf-100 pl-2">
                  <button
                    type="button"
                    onClick={() => handleEditClick(rule)}
                    className="rounded-md p-1.5 text-soil-400 transition-colors hover:bg-leaf-50 hover:text-leaf-600"
                    aria-label={`Edit ${rule.name}`}
                    data-testid={`edit-rule-${rule.id}`}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(rule)}
                    className="rounded-md p-1.5 text-soil-400 transition-colors hover:bg-danger-50 hover:text-danger-500"
                    aria-label={`Delete ${rule.name}`}
                    data-testid={`delete-rule-${rule.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <RuleFormModal
        rule={editingRule ?? undefined}
        open={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingRule(null);
        }}
        onSaved={handleRuleSaved}
      />

      <DeleteDialog
        rule={deletingRule}
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeletingRule(null);
        }}
        onDeleted={handleRuleDeleted}
      />
    </div>
  );
}
