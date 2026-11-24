import React from "react";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const norm = status?.toUpperCase() || "UNKNOWN";

  let styles = "bg-semantic-neutral/15 text-muted-foreground border-semantic-neutral/25";
  let dotColor = "bg-muted-foreground";

  switch (norm) {
    // Money In / Success
    case "PAID":
    case "CLEARED":
    case "APPROVED":
    case "PROCESSED":
    case "SUCCESS":
    case "VALID":
      styles = "bg-semantic-money-in/12 text-semantic-money-in border-semantic-money-in/25";
      dotColor = "bg-semantic-money-in";
      break;

    // Attention / Pending
    case "PENDING":
    case "PARTIAL":
    case "SUBMITTED":
    case "IN_REVIEW":
    case "DUE_SOON":
      styles = "bg-semantic-attention/12 text-semantic-attention border-semantic-attention/25";
      dotColor = "bg-semantic-attention";
      break;

    // Money Owed / Errors
    case "OVERDUE":
    case "CANCELLED":
    case "REJECTED":
    case "FAILED":
    case "EXPIRED":
      styles = "bg-semantic-money-owed/12 text-semantic-money-owed border-semantic-money-owed/25";
      dotColor = "bg-semantic-money-owed";
      break;

    // Concessions / Waived (Provisional / Neutral)
    case "WAIVED":
    case "CONCESSION":
      styles = "bg-muted/70 text-foreground border-border/40";
      dotColor = "bg-semantic-attention";
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        styles,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
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
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-semantic-money-in/12 text-semantic-money-in border border-semantic-money-in/25",
          className
        )}
      >
        Current (Not Due)
      </span>
    );
  }

  if (daysOverdue <= 30) {
    return (
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-semantic-attention/12 text-semantic-attention border border-semantic-attention/25",
          className
        )}
      >
        {daysOverdue}d (0-30 Bucket)
      </span>
    );
  }

  if (daysOverdue <= 60) {
    return (
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-semantic-attention/15 text-semantic-attention border border-semantic-attention/30",
          className
        )}
      >
        {daysOverdue}d (31-60 Bucket)
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-semantic-money-owed/15 text-semantic-money-owed border border-semantic-money-owed/30",
        className
      )}
    >
      {daysOverdue}d (60+ Critical)
    </span>
  );
}
