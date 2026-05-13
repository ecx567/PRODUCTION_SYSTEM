"use client";

import { useState, useCallback, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
  Droplets,
  Sprout,
  Bug,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type RecommendationStatus,
  type RecommendationSeverity,
  type IrrigationRecommendation,
  type FertilizationRecommendation,
  type PestRiskAlert,
  updateRecommendationStatus,
} from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────

type RecType = "irrigation" | "fertilization" | "pest_risk";

interface BaseRecCardProps {
  /** Backend-stored recommendation ID (for lifecycle PATCH). */
  recId?: string;
  /** Current lifecycle status of the recommendation. */
  lifecycleStatus?: RecommendationStatus;
  /** Timestamp when this recommendation was generated. */
  generatedAt?: string;
  /** Callback after a lifecycle action succeeds. */
  onStatusChange?: (
    recId: string,
    newStatus: RecommendationStatus,
  ) => void;
}

interface IrrigationCardProps extends BaseRecCardProps {
  type: "irrigation";
  data: IrrigationRecommendation;
}

interface FertilizationCardProps extends BaseRecCardProps {
  type: "fertilization";
  data: FertilizationRecommendation;
}

interface PestRiskCardProps extends BaseRecCardProps {
  type: "pest_risk";
  data: PestRiskAlert;
}

type RecommendationCardProps =
  | IrrigationCardProps
  | FertilizationCardProps
  | PestRiskCardProps;

// ── Helpers ───────────────────────────────────────────────────

const SEVERITY_STYLES: Record<
  RecommendationSeverity,
  { bg: string; text: string; dot: string }
> = {
  info: { bg: "bg-sky-100", text: "text-sky-700", dot: "bg-sky-500" },
  low: { bg: "bg-leaf-100", text: "text-leaf-700", dot: "bg-leaf-500" },
  medium: {
    bg: "bg-sunlight-100",
    text: "text-sunlight-700",
    dot: "bg-sunlight-500",
  },
  high: {
    bg: "bg-danger-100",
    text: "text-danger-700",
    dot: "bg-danger-500",
  },
  critical: {
    bg: "bg-red-100",
    text: "text-red-800",
    dot: "bg-red-600",
  },
};

const TYPE_ICONS: Record<RecType, typeof Droplets> = {
  irrigation: Droplets,
  fertilization: Sprout,
  pest_risk: Bug,
};

const TYPE_LABELS: Record<RecType, string> = {
  irrigation: "Irrigation",
  fertilization: "Fertilization",
  pest_risk: "Pest Risk",
};

function severityFromConfidence(confidence: number): RecommendationSeverity {
  if (confidence >= 0.9) return "high";
  if (confidence >= 0.7) return "medium";
  return "info";
}

function severityFromRiskLevel(
  risk: "low" | "medium" | "high",
): RecommendationSeverity {
  if (risk === "high") return "high";
  if (risk === "medium") return "medium";
  return "low";
}

function getSeverity(props: RecommendationCardProps): RecommendationSeverity {
  if (props.type === "irrigation") {
    const { recommendation, confidence } = props.data;
    if (recommendation === "water") return severityFromConfidence(confidence);
    if (recommendation === "monitor") return "medium";
    return "info";
  }
  if (props.type === "fertilization") {
    const { recommendation } = props.data;
    if (recommendation === "apply") return "medium";
    if (recommendation === "delay") return "low";
    return "info";
  }
  return severityFromRiskLevel(props.data.risk_level);
}

function getTitle(props: RecommendationCardProps): string {
  if (props.type === "irrigation") {
    const { irrigation_needed_mm, recommendation } = props.data;
    if (recommendation === "water")
      return `Irrigation needed: ${irrigation_needed_mm.toFixed(1)} mm`;
    if (recommendation === "monitor") return "Monitor soil moisture";
    return "Irrigation not needed — sufficient moisture";
  }
  if (props.type === "fertilization") {
    const { growth_stage, n_kg_ha, p_kg_ha, k_kg_ha } = props.data;
    return `${growth_stage} stage — N:${n_kg_ha.toFixed(0)} P:${p_kg_ha.toFixed(0)} K:${k_kg_ha.toFixed(0)} kg/ha`;
  }
  return `${props.data.pest_name} risk assessment`;
}

function getDescription(props: RecommendationCardProps): string {
  if (props.type === "irrigation") {
    const {
      eto_mm,
      etc_mm,
      effective_rain_mm,
      depletion_percent,
      confidence,
    } = props.data;
    return (
      `ET₀ ${eto_mm.toFixed(1)}mm · ETc ${etc_mm.toFixed(1)}mm · ` +
      `Rain ${effective_rain_mm.toFixed(1)}mm · ` +
      `Depletion ${depletion_percent.toFixed(0)}% · ` +
      `Confidence ${(confidence * 100).toFixed(0)}%`
    );
  }
  if (props.type === "fertilization") {
    return props.data.reasoning || "Fertilization recommendation based on crop growth stage and nutrient requirements.";
  }
  const { conditions_favorable, temperature_avg, humidity_avg } = props.data;
  const parts = [`GDD ${props.data.accumulated_gdd.toFixed(0)} / ${props.data.gdd_threshold.toFixed(0)}`];
  if (temperature_avg !== null) parts.push(`Temp ${temperature_avg.toFixed(1)}°C`);
  if (humidity_avg !== null) parts.push(`Humidity ${humidity_avg.toFixed(0)}%`);
  if (conditions_favorable) parts.push("Conditions favorable");
  return parts.join(" · ");
}

function getActionLabel(
  status: RecommendationStatus | undefined,
): "Acknowledge" | "Applied" | "Dismiss" | null {
  if (!status || status === "active") return "Acknowledge";
  if (status === "acknowledged") return "Applied";
  return null;
}

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

// ── Dismiss Confirmation Dialog ──────────────────────────────

function DismissConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-full bg-danger-100 p-2">
            <AlertTriangle className="h-5 w-5 text-danger-500" />
          </div>
          <h3 className="text-base font-semibold text-leaf-800">
            Dismiss recommendation?
          </h3>
        </div>
        <p className="mb-6 text-sm text-soil-500">
          This will mark the recommendation as dismissed. You can re-open it
          later if needed.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-leaf-200 px-4 py-2 text-sm font-medium text-leaf-700 transition-colors hover:bg-leaf-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-danger-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger-600"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────

export default function RecommendationCard(props: RecommendationCardProps) {
  const mounted = useMounted();
  const { recId, lifecycleStatus, onStatusChange } = props;
  const [optimisticStatus, setOptimisticStatus] = useState<
    RecommendationStatus | undefined
  >(lifecycleStatus);
  const [isUpdating, setIsUpdating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showDismiss, setShowDismiss] = useState(false);

  // Merge lifecycle status: prefer local optimistic, fall back to prop
  const currentStatus = optimisticStatus || lifecycleStatus;
  const severity = getSeverity(props);
  const style = SEVERITY_STYLES[severity];
  const Icon = TYPE_ICONS[props.type];
  const actionLabel = getActionLabel(currentStatus);
  const isDone = currentStatus === "applied" || currentStatus === "dismissed";

  const handleLifecycleAction = useCallback(
    async (targetStatus: RecommendationStatus) => {
      if (!recId) {
        // If no recId, do a client-side optimistic toggle
        setOptimisticStatus(targetStatus);
        return;
      }
      setIsUpdating(true);
      setApiError(null);
      const previousStatus = currentStatus;
      // Optimistic update
      setOptimisticStatus(targetStatus);

      try {
        await updateRecommendationStatus(recId, { status: targetStatus });
        onStatusChange?.(recId, targetStatus);
      } catch (err: unknown) {
        // Revert on error
        setOptimisticStatus(previousStatus);
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to update recommendation status";
        setApiError(msg);
        // Auto-dismiss error after 4s
        setTimeout(() => setApiError(null), 4000);
      } finally {
        setIsUpdating(false);
        setShowDismiss(false);
      }
    },
    [recId, currentStatus, onStatusChange],
  );

  const handlePrimaryAction = useCallback(() => {
    if (!currentStatus || currentStatus === "active") {
      handleLifecycleAction("acknowledged");
    } else if (currentStatus === "acknowledged") {
      handleLifecycleAction("applied");
    }
  }, [currentStatus, handleLifecycleAction]);

  const handleDismiss = useCallback(() => {
    handleLifecycleAction("dismissed");
  }, [handleLifecycleAction]);

  return (
    <div
      className={cn(
        "dashboard-card relative transition-all",
        isDone && "opacity-60",
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-2", style.bg)}>
            <Icon className={cn("h-5 w-5", style.text)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-leaf-800">
                {TYPE_LABELS[props.type]}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  style.bg,
                  style.text,
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                {severity}
              </span>
              {currentStatus && currentStatus !== "active" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-leaf-100 px-2 py-0.5 text-xs font-medium text-leaf-600">
                  {currentStatus === "acknowledged" && <Eye className="h-3 w-3" />}
                  {currentStatus === "applied" && (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  {currentStatus === "dismissed" && (
                    <XCircle className="h-3 w-3" />
                  )}
                  {currentStatus}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm font-medium text-leaf-700">
              {getTitle(props)}
            </p>
          </div>
        </div>
        {mounted && props.generatedAt && (
          <span className="whitespace-nowrap text-xs text-soil-400">
            {new Date(props.generatedAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Body */}
      <p className="mt-3 text-sm text-soil-500">{getDescription(props)}</p>

      {/* Action buttons */}
      {!isDone && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-leaf-50 pt-3">
          {actionLabel && (
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={isUpdating}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                "bg-leaf-500 text-white hover:bg-leaf-600",
                isUpdating && "cursor-not-allowed opacity-50",
              )}
            >
              {isUpdating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : actionLabel === "Applied" ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              {actionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowDismiss(true)}
            disabled={isUpdating}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-leaf-200 px-3 py-1.5 text-xs font-medium text-soil-500 transition-colors hover:bg-leaf-50",
              isUpdating && "cursor-not-allowed opacity-50",
            )}
          >
            <XCircle className="h-3.5 w-3.5" />
            Dismiss
          </button>
        </div>
      )}

      {/* API error toast */}
      {apiError && (
        <div className="mt-2 rounded-md bg-danger-50 px-3 py-2 text-xs text-danger-600">
          {apiError}
        </div>
      )}

      {/* Dismiss confirmation dialog */}
      <DismissConfirmDialog
        open={showDismiss}
        onConfirm={handleDismiss}
        onCancel={() => setShowDismiss(false)}
      />
    </div>
  );
}
