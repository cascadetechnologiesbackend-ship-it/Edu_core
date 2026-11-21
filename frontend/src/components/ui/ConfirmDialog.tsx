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
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-foreground border border-border/50 bg-muted/40 hover:bg-muted/70 transition disabled:opacity-50 min-h-[44px]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition disabled:opacity-50 min-h-[44px] shadow-sm ${
              confirmVariant === "danger"
                ? "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-rose-500/20"
                : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
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
          <div className="p-2.5 rounded-xl bg-rose-500/10 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-foreground">
              {title}
            </h3>
            {description ? (
              <div className="text-xs text-muted-foreground mt-1">
                {description}
              </div>
            ) : itemName ? (
              <p className="text-xs text-muted-foreground mt-1">
                This action will permanently delete{" "}
                <span className="font-semibold text-foreground">
                  {itemName}
                </span>{" "}
                and its related configurations.
              </p>
            ) : null}
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 dark:bg-rose-950/20 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Cannot Proceed
            </div>
            <div>{error}</div>
          </div>
        )}

        {consequences && consequences.length > 0 && (
          <div className="bg-amber-500/10 dark:bg-amber-950/20 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300 border border-amber-500/30 space-y-1">
            <div className="font-semibold">Consequences:</div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              {consequences.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {safetyChecks && safetyChecks.length > 0 && (
          <div className="bg-muted/40 rounded-xl p-3.5 text-xs text-muted-foreground space-y-1 border border-border/60">
            <div className="font-semibold text-foreground">
              Deletion Safety Checks:
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-muted-foreground">
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
