"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, AlertCircle, Loader2 } from "lucide-react";
import { AppModal } from "./AppModal";

export interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  requiredPhrase?: string; // If set, user must type this exact phrase to confirm
  consequences?: string[];
  isLoading?: boolean;
}

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  requiredPhrase,
  consequences,
  isLoading = false,
}: ConfirmationDialogProps) {
  const [typedPhrase, setTypedPhrase] = useState("");

  useEffect(() => {
    if (open) {
      setTypedPhrase("");
    }
  }, [open]);

  const isConfirmed = requiredPhrase
    ? typedPhrase.trim() === requiredPhrase.trim()
    : true;

  const handleConfirm = () => {
    if (!isConfirmed || isLoading) return;
    onConfirm();
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-foreground bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={!isConfirmed || isLoading}
            onClick={handleConfirm}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isDestructive
                ? "bg-destructive hover:bg-destructive/90 shadow-sm"
                : "bg-primary hover:bg-primary/90 shadow-sm"
            }`}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <div className="flex items-start gap-3.5">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              isDestructive
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
            }`}
          >
            {isDestructive ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        {consequences && consequences.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <span className="font-semibold block">Important Consequences:</span>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              {consequences.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {requiredPhrase && (
          <div className="space-y-1.5 pt-2 border-t border-border/70">
            <label className="block text-xs font-medium text-muted-foreground">
              To proceed, please type{" "}
              <span className="font-mono font-bold text-foreground">
                {requiredPhrase}
              </span>{" "}
              below:
            </label>
            <input
              type="text"
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              placeholder={requiredPhrase}
              className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              autoFocus
            />
          </div>
        )}
      </div>
    </AppModal>
  );
}
