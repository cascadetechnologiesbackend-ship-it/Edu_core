import React from "react";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const norm = status?.toUpperCase() || "UNKNOWN";

  let styles = "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300 border-gray-200 dark:border-slate-700";
  let dotColor = "bg-gray-400";

  switch (norm) {
    case "PAID":
    case "CLEARED":
    case "APPROVED":
    case "PROCESSED":
    case "SUCCESS":
    case "VALID":
      styles = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50";
      dotColor = "bg-emerald-500";
      break;

    case "PENDING":
    case "PARTIAL":
    case "SUBMITTED":
    case "IN_REVIEW":
      styles = "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/50";
      dotColor = "bg-amber-500";
      break;

    case "OVERDUE":
    case "CANCELLED":
    case "REJECTED":
    case "FAILED":
    case "EXPIRED":
      styles = "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800/50";
      dotColor = "bg-rose-500";
      break;

    case "WAIVED":
    case "CONCESSION":
      styles = "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800/50";
      dotColor = "bg-purple-500";
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
        styles,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
      <span>{norm}</span>
    </span>
  );
}

export interface AgingBadgeProps {
  daysOverdue: number;
  bracket?: string | undefined;
  className?: string | undefined;
}

export function AgingBadge({ daysOverdue, bracket, className }: AgingBadgeProps) {
  if (daysOverdue <= 0) {
    return (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400", className)}>
        Current (Not Due)
      </span>
    );
  }

  if (daysOverdue <= 30) {
    return (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400", className)}>
        {daysOverdue}d (0-30 Bucket)
      </span>
    );
  }

  if (daysOverdue <= 60) {
    return (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400", className)}>
        {daysOverdue}d (31-60 Bucket)
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 animate-pulse", className)}>
      {daysOverdue}d (60+ Critical)
    </span>
  );
}
