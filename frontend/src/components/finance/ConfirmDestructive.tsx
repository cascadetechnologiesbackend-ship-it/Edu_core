"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

export interface ConfirmDestructiveProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  requireReason?: boolean;
  reasonPlaceholder?: string;
  isPending?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
}

export function ConfirmDestructive({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel = "Confirm Action",
  requireReason = true,
  reasonPlaceholder = "Please state the reason for this action (required for audit trail)...",
  isPending = false,
  onConfirm,
}: ConfirmDestructiveProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) {
      setError("A cancellation or reversal reason is required for financial audit compliance.");
      return;
    }
    setError("");
    await onConfirm(reason.trim());
    setReason("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="fixed inset-0 -z-10"
        onClick={!isPending ? onClose : undefined}
      />

      <div className="w-full max-w-md bg-card border border-border/40 rounded-2xl shadow-2xl overflow-hidden p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {description}
            </p>
          </div>
        </div>

        {requireReason && (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
              Reason for Action *
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError("");
              }}
              placeholder={reasonPlaceholder}
              rows={3}
              disabled={isPending}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border/40 bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 disabled:opacity-50 resize-none"
            />
            {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm font-semibold rounded-xl text-foreground hover:bg-muted/60 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition active:scale-95 disabled:opacity-50"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
