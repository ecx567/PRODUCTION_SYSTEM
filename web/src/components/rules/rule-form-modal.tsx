"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertRuleResponse,
  AlertRuleCreate,
  AlertRuleUpdate,
  createRule,
  updateRule,
  FieldResponse,
  getFields,
} from "@/lib/api";

interface RuleFormModalProps {
  rule?: AlertRuleResponse;
  open: boolean;
  onClose: () => void;
  onSaved: (rule: AlertRuleResponse) => void;
}

interface FormData {
  name: string;
  metric_type: string;
  condition: string;
  threshold: string;
  threshold_max: string;
  severity: string;
  field_id: string;
  enabled: boolean;
  cooldown_minutes: string;
}

interface FormErrors {
  name?: string;
  metric_type?: string;
  condition?: string;
  threshold?: string;
  threshold_max?: string;
  cooldown_minutes?: string;
  submit?: string;
}

const METRIC_TYPES = [
  { value: "temp", label: "Temperature" },
  { value: "humidity", label: "Humidity" },
  { value: "soil_moisture", label: "Soil Moisture" },
  { value: "rain", label: "Rainfall" },
];

const CONDITIONS = [
  { value: "gt", label: "Greater Than (>" },
  { value: "lt", label: "Less Than (<)" },
  { value: "eq", label: "Equal To (=)" },
  { value: "between", label: "Between (range)" },
];

const SEVERITIES = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

const defaultFormData: FormData = {
  name: "",
  metric_type: "",
  condition: "",
  threshold: "",
  threshold_max: "",
  severity: "warning",
  field_id: "",
  enabled: true,
  cooldown_minutes: "15",
};

function validateForm(data: FormData): FormErrors {
  const errors: FormErrors = {};

  // Name: Required, 1-255 chars
  if (!data.name.trim()) {
    errors.name = "Name is required";
  } else if (data.name.length > 255) {
    errors.name = "Name too long (max 255 characters)";
  }

  // Metric type: required
  if (!data.metric_type) {
    errors.metric_type = "Metric type is required";
  }

  // Condition: required
  if (!data.condition) {
    errors.condition = "Condition is required";
  }

  // Threshold: required, numeric
  if (!data.threshold.trim()) {
    errors.threshold = "Threshold is required";
  } else if (Number.isNaN(Number(data.threshold))) {
    errors.threshold = "Threshold must be a number";
  }

  // Threshold max: required if condition is "between", must be > threshold
  if (data.condition === "between") {
    if (!data.threshold_max.trim()) {
      errors.threshold_max = "Upper bound is required for 'between' condition";
    } else if (Number.isNaN(Number(data.threshold_max))) {
      errors.threshold_max = "Upper bound must be a number";
    } else if (Number(data.threshold_max) <= Number(data.threshold)) {
      errors.threshold_max = "Upper bound must be greater than threshold";
    }
  }

  // Cooldown: integer, 1-1440
  const cooldown = Number(data.cooldown_minutes);
  if (!data.cooldown_minutes.trim()) {
    errors.cooldown_minutes = "Cooldown is required";
  } else if (!Number.isInteger(cooldown)) {
    errors.cooldown_minutes = "Cooldown must be an integer";
  } else if (cooldown < 1 || cooldown > 1440) {
    errors.cooldown_minutes = "Must be between 1 and 1440 minutes";
  }

  return errors;
}

export default function RuleFormModal({
  rule,
  open,
  onClose,
  onSaved,
}: RuleFormModalProps) {
  const isEdit = !!rule;

  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [fields, setFields] = useState<FieldResponse[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);

  // Initialize form when rule changes or modal opens
  useEffect(() => {
    if (open && rule) {
      setFormData({
        name: rule.name,
        metric_type: rule.metric_type,
        condition: rule.condition,
        threshold: String(rule.threshold),
        threshold_max: rule.threshold_max != null ? String(rule.threshold_max) : "",
        severity: rule.severity,
        field_id: rule.field_id || "",
        enabled: rule.enabled,
        cooldown_minutes: String(rule.cooldown_minutes),
      });
    } else if (open) {
      setFormData(defaultFormData);
    }
    setErrors({});
  }, [open, rule]);

  // Load fields for dropdown
  const loadFields = useCallback(async () => {
    if (!open) return;
    setFieldsLoading(true);
    try {
      const result = await getFields(undefined, 100);
      setFields(result.items);
    } catch {
      // Ignore - field selector will show "All Fields" only
      setFields([]);
    } finally {
      setFieldsLoading(false);
    }
  }, [open]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  function handleChange<K extends keyof FormData>(
    key: K,
    value: FormData[K],
  ) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    const errKey = key as keyof FormErrors;
    if (errors[errKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errKey];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);

    try {
      const baseData = {
        name: formData.name.trim(),
        metric_type: formData.metric_type,
        condition: formData.condition,
        threshold: Number(formData.threshold),
        threshold_max:
          formData.condition === "between" && formData.threshold_max
            ? Number(formData.threshold_max)
            : null,
        severity: formData.severity,
        field_id: formData.field_id || null,
        enabled: formData.enabled,
        cooldown_minutes: Number(formData.cooldown_minutes),
      };

      let savedRule: AlertRuleResponse;

      if (isEdit && rule) {
        const updateData: AlertRuleUpdate = { ...baseData };
        savedRule = await updateRule(rule.id, updateData);
      } else {
        const createData: AlertRuleCreate = baseData as AlertRuleCreate;
        savedRule = await createRule(createData);
      }

      onSaved(savedRule);
      onClose();
    } catch (e: unknown) {
      let msg = "Failed to save rule. Please try again.";
      if (e instanceof Error) {
        if (e.message.includes("404") || e.message.includes("not found")) {
          msg = "Rule not found. It may have been deleted.";
          // Close after showing 404 error
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          msg = e.message;
        }
      }
      setErrors({ submit: msg });
    } finally {
      setIsLoading(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  }

  if (!open) return null;

  const showThresholdMax = formData.condition === "between";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-dialog-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-leaf-100 px-5 py-4">
            <h2
              id="form-dialog-title"
              className="text-sm font-semibold text-leaf-800"
            >
              {isEdit ? "Edit Alert Rule" : "New Alert Rule"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-md p-1 text-soil-400 transition-colors hover:bg-leaf-50 hover:text-soil-600 disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-4 px-5 py-5">
            {/* Name */}
            <div>
              <label
                htmlFor="rule-name"
                className="block text-xs font-medium text-soil-600"
              >
                Rule Name <span className="text-danger-500">*</span>
              </label>
              <input
                id="rule-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="e.g., High Temperature Alert"
                className={cn(
                  "mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-leaf-900 placeholder-soil-300 focus:outline-none focus:ring-2",
                  errors.name
                    ? "border-danger-300 focus:border-danger-400 focus:ring-danger-200"
                    : "border-leaf-200 focus:border-leaf-400 focus:ring-leaf-200",
                )}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-danger-500">{errors.name}</p>
              )}
            </div>

            {/* Metric Type + Condition (row) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="rule-metric"
                  className="block text-xs font-medium text-soil-600"
                >
                  Metric <span className="text-danger-500">*</span>
                </label>
                <select
                  id="rule-metric"
                  value={formData.metric_type}
                  onChange={(e) => handleChange("metric_type", e.target.value)}
                  className={cn(
                    "mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-leaf-900 focus:outline-none focus:ring-2",
                    errors.metric_type
                      ? "border-danger-300 focus:border-danger-400 focus:ring-danger-200"
                      : "border-leaf-200 focus:border-leaf-400 focus:ring-leaf-200",
                  )}
                >
                  <option value="">Select metric...</option>
                  {METRIC_TYPES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {errors.metric_type && (
                  <p className="mt-1 text-xs text-danger-500">
                    {errors.metric_type}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="rule-condition"
                  className="block text-xs font-medium text-soil-600"
                >
                  Condition <span className="text-danger-500">*</span>
                </label>
                <select
                  id="rule-condition"
                  value={formData.condition}
                  onChange={(e) => handleChange("condition", e.target.value)}
                  className={cn(
                    "mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-leaf-900 focus:outline-none focus:ring-2",
                    errors.condition
                      ? "border-danger-300 focus:border-danger-400 focus:ring-danger-200"
                      : "border-leaf-200 focus:border-leaf-400 focus:ring-leaf-200",
                  )}
                >
                  <option value="">Select condition...</option>
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {errors.condition && (
                  <p className="mt-1 text-xs text-danger-500">
                    {errors.condition}
                  </p>
                )}
              </div>
            </div>

            {/* Threshold(s) */}
            <div className={showThresholdMax ? "grid grid-cols-2 gap-4" : ""}>
              <div>
                <label
                  htmlFor="rule-threshold"
                  className="block text-xs font-medium text-soil-600"
                >
                  Threshold <span className="text-danger-500">*</span>
                  {showThresholdMax && (
                    <span className="text-soil-400"> (lower)</span>
                  )}
                </label>
                <input
                  id="rule-threshold"
                  type="number"
                  step="any"
                  value={formData.threshold}
                  onChange={(e) => handleChange("threshold", e.target.value)}
                  placeholder="e.g., 35"
                  className={cn(
                    "mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-leaf-900 placeholder-soil-300 focus:outline-none focus:ring-2",
                    errors.threshold
                      ? "border-danger-300 focus:border-danger-400 focus:ring-danger-200"
                      : "border-leaf-200 focus:border-leaf-400 focus:ring-leaf-200",
                  )}
                />
                {errors.threshold && (
                  <p className="mt-1 text-xs text-danger-500">
                    {errors.threshold}
                  </p>
                )}
              </div>

              {showThresholdMax && (
                <div>
                  <label
                    htmlFor="rule-threshold-max"
                    className="block text-xs font-medium text-soil-600"
                  >
                    Upper Bound <span className="text-danger-500">*</span>
                  </label>
                  <input
                    id="rule-threshold-max"
                    type="number"
                    step="any"
                    value={formData.threshold_max}
                    onChange={(e) =>
                      handleChange("threshold_max", e.target.value)
                    }
                    placeholder="e.g., 40"
                    className={cn(
                      "mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-leaf-900 placeholder-soil-300 focus:outline-none focus:ring-2",
                      errors.threshold_max
                        ? "border-danger-300 focus:border-danger-400 focus:ring-danger-200"
                        : "border-leaf-200 focus:border-leaf-400 focus:ring-leaf-200",
                    )}
                  />
                  {errors.threshold_max && (
                    <p className="mt-1 text-xs text-danger-500">
                      {errors.threshold_max}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Severity + Cooldown + Field (row) */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="rule-severity"
                  className="block text-xs font-medium text-soil-600"
                >
                  Severity
                </label>
                <select
                  id="rule-severity"
                  value={formData.severity}
                  onChange={(e) => handleChange("severity", e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-leaf-200 bg-white px-3 py-2 text-sm text-leaf-900 focus:border-leaf-400 focus:outline-none focus:ring-2 focus:ring-leaf-200"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="rule-cooldown"
                  className="block text-xs font-medium text-soil-600"
                >
                  Cooldown (min)
                </label>
                <input
                  id="rule-cooldown"
                  type="number"
                  min="1"
                  max="1440"
                  value={formData.cooldown_minutes}
                  onChange={(e) =>
                    handleChange("cooldown_minutes", e.target.value)
                  }
                  className={cn(
                    "mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-leaf-900 placeholder-soil-300 focus:outline-none focus:ring-2",
                    errors.cooldown_minutes
                      ? "border-danger-300 focus:border-danger-400 focus:ring-danger-200"
                      : "border-leaf-200 focus:border-leaf-400 focus:ring-leaf-200",
                  )}
                />
                {errors.cooldown_minutes && (
                  <p className="mt-1 text-xs text-danger-500">
                    {errors.cooldown_minutes}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="rule-field"
                  className="block text-xs font-medium text-soil-600"
                >
                  Field Scope
                </label>
                <select
                  id="rule-field"
                  value={formData.field_id}
                  onChange={(e) => handleChange("field_id", e.target.value)}
                  disabled={fieldsLoading}
                  className="mt-1 block w-full rounded-lg border border-leaf-200 bg-white px-3 py-2 text-sm text-leaf-900 focus:border-leaf-400 focus:outline-none focus:ring-2 focus:ring-leaf-200 disabled:opacity-50"
                >
                  <option value="">All Fields</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                role="switch"
                aria-checked={formData.enabled}
                onClick={() => handleChange("enabled", !formData.enabled)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2",
                  formData.enabled ? "bg-leaf-500" : "bg-soil-200",
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    formData.enabled ? "translate-x-4" : "translate-x-0",
                  )}
                />
              </button>
              <label className="text-xs font-medium text-soil-600">
                Rule enabled
              </label>
            </div>

            {/* Submit error */}
            {errors.submit && (
              <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">
                {errors.submit}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-leaf-100 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-lg border border-leaf-200 bg-white px-4 py-2 text-sm font-medium text-leaf-700 transition-colors hover:bg-leaf-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50",
                "bg-leaf-500 hover:bg-leaf-600",
              )}
            >
              <Save className="h-3.5 w-3.5" />
              {isLoading
                ? "Saving..."
                : isEdit
                  ? "Update Rule"
                  : "Create Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
