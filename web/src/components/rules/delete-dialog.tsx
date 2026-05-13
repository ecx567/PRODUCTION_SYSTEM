"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AlertRuleResponse, deleteRule } from "@/lib/api";

interface DeleteDialogProps {
  rule: AlertRuleResponse | null;
  open: boolean;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

interface FormErrors {
  submit?: string;
}

export default function DeleteDialog({
  rule,
  open,
  onClose,
  onDeleted,
}: DeleteDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  if (!open || !rule) return null;

  async function handleDelete() {
    setIsLoading(true);
    setErrors({});

    if (!rule) return;
    try {
      await deleteRule(rule.id);
      onDeleted(rule.id);
      onClose();
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Failed to delete rule. Please try again.";
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-leaf-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-danger-100">
              <AlertTriangle className="h-4 w-4 text-danger-500" />
            </div>
            <h2
              id="delete-dialog-title"
              className="text-sm font-semibold text-leaf-800"
            >
              Delete Alert Rule
            </h2>
          </div>
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
        <div className="px-5 py-5">
          <p className="text-sm text-leaf-700">
            Are you sure you want to delete{" "}
            <span className="font-semibold">"{rule.name}"</span>?
          </p>
          <p className="mt-2 text-xs text-soil-500">
            This action cannot be undone. All alert events triggered by this
            rule will also be permanently removed.
          </p>

          {errors.submit && (
            <div className="mt-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-600">
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
            type="button"
            onClick={handleDelete}
            disabled={isLoading}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors",
              "bg-danger-500 hover:bg-danger-600 disabled:opacity-50",
            )}
          >
            {isLoading ? "Deleting..." : "Delete Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}
