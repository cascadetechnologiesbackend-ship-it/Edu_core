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
  | "paid"
  | "verified"
  | "present"
  | "pending"
  | "due_soon"
  | "warning"
  | "suspended"
  | "error"
  | "failed"
  | "overdue"
  | "absent"
  | "draft"
  | "provisional"
  | "info"
  | "neutral";

export interface StatusBadgeProps {
  status: StatusVariant | string;
  label?: string;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}

const DEFAULT_CONFIG: {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: LucideIcon;
} = {
  label: "Neutral",
  bg: "bg-semantic-neutral/15",
  text: "text-muted-foreground",
  border: "border-semantic-neutral/25",
  icon: Circle,
};

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: LucideIcon }
> = {
  // Money in / Healthy / Done (apple.green semantics)
  active: {
    label: "Active",
    bg: "bg-semantic-money-in/12",
    text: "text-semantic-money-in",
    border: "border-semantic-money-in/25",
    icon: CheckCircle2,
  },
  completed: {
    label: "Completed",
    bg: "bg-semantic-money-in/12",
    text: "text-semantic-money-in",
    border: "border-semantic-money-in/25",
    icon: CheckCircle2,
  },
  paid: {
    label: "Paid",
    bg: "bg-semantic-money-in/12",
    text: "text-semantic-money-in",
    border: "border-semantic-money-in/25",
    icon: CheckCircle2,
  },
  verified: {
    label: "Verified",
    bg: "bg-semantic-money-in/12",
    text: "text-semantic-money-in",
    border: "border-semantic-money-in/25",
    icon: CheckCircle2,
  },
  present: {
    label: "Present",
    bg: "bg-semantic-money-in/12",
    text: "text-semantic-money-in",
    border: "border-semantic-money-in/25",
    icon: CheckCircle2,
  },

  // Attention / Pending / Due Soon (apple.orange semantics)
  pending: {
    label: "Pending",
    bg: "bg-semantic-attention/12",
    text: "text-semantic-attention",
    border: "border-semantic-attention/25",
    icon: Clock,
  },
  due_soon: {
    label: "Due Soon",
    bg: "bg-semantic-attention/12",
    text: "text-semantic-attention",
    border: "border-semantic-attention/25",
    icon: Clock,
  },
  warning: {
    label: "Warning",
    bg: "bg-semantic-attention/12",
    text: "text-semantic-attention",
    border: "border-semantic-attention/25",
    icon: AlertTriangle,
  },
  suspended: {
    label: "Suspended",
    bg: "bg-semantic-attention/12",
    text: "text-semantic-attention",
    border: "border-semantic-attention/25",
    icon: PauseCircle,
  },

  // Money Owed / Errors / Absent (apple.red semantics)
  error: {
    label: "Error",
    bg: "bg-semantic-money-owed/12",
    text: "text-semantic-money-owed",
    border: "border-semantic-money-owed/25",
    icon: XCircle,
  },
  failed: {
    label: "Failed",
    bg: "bg-semantic-money-owed/12",
    text: "text-semantic-money-owed",
    border: "border-semantic-money-owed/25",
    icon: XCircle,
  },
  overdue: {
    label: "Overdue",
    bg: "bg-semantic-money-owed/12",
    text: "text-semantic-money-owed",
    border: "border-semantic-money-owed/25",
    icon: XCircle,
  },
  absent: {
    label: "Absent",
    bg: "bg-semantic-money-owed/12",
    text: "text-semantic-money-owed",
    border: "border-semantic-money-owed/25",
    icon: XCircle,
  },

  // Provisional / Draft (apple.yellow tint)
  draft: {
    label: "Draft",
    bg: "bg-semantic-provisional/15",
    text: "text-foreground",
    border: "border-semantic-provisional/35",
    icon: FileText,
  },
  provisional: {
    label: "Provisional",
    bg: "bg-semantic-provisional/15",
    text: "text-foreground",
    border: "border-semantic-provisional/35",
    icon: FileText,
  },

  // Neutral / Informational
  info: {
    label: "Info",
    bg: "bg-semantic-neutral/15",
    text: "text-muted-foreground",
    border: "border-semantic-neutral/25",
    icon: Info,
  },
  neutral: DEFAULT_CONFIG,
};

export function StatusBadge({
  status,
  label,
  size = "md",
  showIcon = true,
  className = "",
}: StatusBadgeProps) {
  const normalized = (status || "neutral").toLowerCase().replace(/[\s-]/g, "_");
  const config = STATUS_CONFIG[normalized] ?? DEFAULT_CONFIG;
  const displayLabel = label || config.label;
  const IconComponent = config.icon;

  const sizeClasses =
    size === "sm" ? "px-2 py-0.5 text-[11px] gap-1" : "px-2.5 py-0.5 text-xs gap-1.5";

  const iconSizes = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      {showIcon && <IconComponent className={`${iconSizes} flex-shrink-0`} aria-hidden="true" />}
      <span className="truncate">{displayLabel}</span>
    </span>
  );
}
