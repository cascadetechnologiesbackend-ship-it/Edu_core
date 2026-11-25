"use client";

import React from "react";
import {
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Ban,
  TimerOff,
  Download,
  type LucideIcon,
} from "lucide-react";

export type ImportExportJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export interface JobStatusBadgeProps {
  status: ImportExportJobStatus;
  downloadUrl?: string | null;
  onDownload?: () => void;
  className?: string;
}

const STATUS_CONFIG: Record<
  ImportExportJobStatus,
  {
    label: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    Icon: LucideIcon;
    spin?: boolean;
  }
> = {
  QUEUED: {
    label: "Queued",
    bgClass: "bg-slate-100 dark:bg-slate-800/70",
    textClass: "text-slate-700 dark:text-slate-300",
    borderClass: "border-slate-200 dark:border-slate-700",
    Icon: Clock,
  },
  PROCESSING: {
    label: "Processing",
    bgClass: "bg-blue-50 dark:bg-blue-950/50",
    textClass: "text-blue-700 dark:text-blue-300",
    borderClass: "border-blue-200 dark:border-blue-800",
    Icon: Loader2,
    spin: true,
  },
  COMPLETED: {
    label: "Completed",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/50",
    textClass: "text-emerald-700 dark:text-emerald-300",
    borderClass: "border-emerald-200 dark:border-emerald-800",
    Icon: CheckCircle2,
  },
  COMPLETED_WITH_ERRORS: {
    label: "Completed with Errors",
    bgClass: "bg-amber-50 dark:bg-amber-950/50",
    textClass: "text-amber-700 dark:text-amber-300",
    borderClass: "border-amber-200 dark:border-amber-800",
    Icon: AlertTriangle,
  },
  FAILED: {
    label: "Failed",
    bgClass: "bg-red-50 dark:bg-red-950/50",
    textClass: "text-red-700 dark:text-red-300",
    borderClass: "border-red-200 dark:border-red-800",
    Icon: XCircle,
  },
  CANCELLED: {
    label: "Cancelled",
    bgClass: "bg-zinc-100 dark:bg-zinc-800/70",
    textClass: "text-zinc-600 dark:text-zinc-400",
    borderClass: "border-zinc-200 dark:border-zinc-700",
    Icon: Ban,
  },
  EXPIRED: {
    label: "Expired",
    bgClass: "bg-stone-100 dark:bg-stone-800/70",
    textClass: "text-stone-600 dark:text-stone-400",
    borderClass: "border-stone-200 dark:border-stone-700",
    Icon: TimerOff,
  },
};

export function JobStatusBadge({
  status,
  downloadUrl,
  onDownload,
  className = "",
}: JobStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.QUEUED;
  const { Icon, label, bgClass, textClass, borderClass, spin } = config;
  const canDownload =
    (status === "COMPLETED" || status === "COMPLETED_WITH_ERRORS") &&
    Boolean(downloadUrl || onDownload);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span
        role="status"
        aria-label={`Job status: ${label}`}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${bgClass} ${textClass} ${borderClass}`}
      >
        <Icon className={`h-3.5 w-3.5 ${spin ? "animate-spin" : ""}`} aria-hidden="true" />
        <span>{label}</span>
      </span>

      {canDownload && (
        downloadUrl ? (
          <a
            href={downloadUrl}
            download
            onClick={onDownload}
            aria-label="Download job output"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download className="h-3 w-3" aria-hidden="true" />
            <span>Download</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={onDownload}
            aria-label="Download job output"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download className="h-3 w-3" aria-hidden="true" />
            <span>Download</span>
          </button>
        )
      )}
    </div>
  );
}
