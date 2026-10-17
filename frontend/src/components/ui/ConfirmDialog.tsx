"use client";

import React from "react";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { AppModal } from "./AppModal";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode | undefined;
  itemName?: string | undefined;
  consequences?: string[] | undefined;
  safetyChecks?: string[] | undefined;
  error?: string | null | undefined;
  confirmText?: string | undefined;
  cancelText?: string | undefined;
  isLoading?: boolean | undefined;
  confirmVariant?: ("danger" | "primary") | undefined;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  consequences,
  safetyChecks,
  error,
  confirmText = "Delete",
  cancelText = "Cancel",
  isLoading = false,
  confirmVariant = "danger",
}: ConfirmDialogProps) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition disabled:opacity-50 min-h-[40px]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition disabled:opacity-50 min-h-[40px] shadow-sm ${
              confirmVariant === "danger"
                ? "bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-red-500/20"
                : "bg-primary hover:bg-primary/95 shadow-primary/20"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                {confirmVariant === "danger" && <Trash2 className="w-3.5 h-3.5" />}
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-4 pt-1">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {title}
            </h3>
            {description ? (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {description}
              </div>
            ) : itemName ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This action will permanently delete{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {itemName}
                </span>{" "}
                and its related configurations.
              </p>
            ) : null}
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Cannot Proceed
            </div>
            <div>{error}</div>
          </div>
        )}

        {consequences && consequences.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40 space-y-1">
            <div className="font-semibold">Consequences:</div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              {consequences.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {safetyChecks && safetyChecks.length > 0 && (
          <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3.5 text-xs text-gray-600 dark:text-gray-400 space-y-1 border border-gray-100 dark:border-slate-800">
            <div className="font-semibold text-gray-700 dark:text-gray-300">
              Deletion Safety Checks:
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-500 dark:text-gray-400">
              {safetyChecks.map((check, idx) => (
                <li key={idx}>{check}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppModal>
  );
}

export default ConfirmDialog;
