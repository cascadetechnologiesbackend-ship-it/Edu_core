import React from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
  PauseCircle,
  Info,
  Circle,
  type LucideIcon,
} from "lucide-react";

export type StatusVariant =
  | "active"
  | "completed"
  | "pending"
  | "draft"
  | "suspended"
  | "error"
  | "warning"
  | "info"
  | "neutral";

export interface StatusBadgeProps {
  status: StatusVariant | string;
  label?: string;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<
  StatusVariant,
  { label: string; bg: string; text: string; border: string; icon: LucideIcon }
> = {
  active: {
    label: "Active",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/25",
    icon: CheckCircle2,
  },
  completed: {
    label: "Completed",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/25",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pending",
    bg: "bg-amber-500/10 dark:bg-amber-500/15",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/25",
    icon: Clock,
  },
  draft: {
    label: "Draft",
    bg: "bg-slate-500/10 dark:bg-slate-500/15",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-500/25",
    icon: FileText,
  },
  suspended: {
    label: "Suspended",
    bg: "bg-orange-500/10 dark:bg-orange-500/15",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-500/25",
    icon: PauseCircle,
  },
  error: {
    label: "Error",
    bg: "bg-rose-500/10 dark:bg-rose-500/15",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-500/25",
    icon: XCircle,
  },
  warning: {
    label: "Warning",
    bg: "bg-amber-500/10 dark:bg-amber-500/15",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/25",
    icon: AlertTriangle,
  },
  info: {
    label: "Info",
    bg: "bg-blue-500/10 dark:bg-blue-500/15",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/25",
    icon: Info,
  },
  neutral: {
    label: "Neutral",
    bg: "bg-muted/60",
    text: "text-muted-foreground",
    border: "border-border/60",
    icon: Circle,
  },
};

export function StatusBadge({
  status,
  label,
  size = "md",
  showIcon = true,
  className = "",
}: StatusBadgeProps) {
  const normalized = (status || "neutral").toLowerCase() as StatusVariant;
  const config = STATUS_CONFIG[normalized] || STATUS_CONFIG.neutral;
  const displayLabel = label || config.label;
  const IconComponent = config.icon;

  const sizeClasses =
    size === "sm" ? "px-2 py-0.5 text-[11px] gap-1" : "px-2.5 py-0.5 text-xs gap-1.5";

  const iconSizes = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
      role="status"
    >
      {showIcon ? (
        <IconComponent className={`${iconSizes} flex-shrink-0`} aria-hidden="true" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}
