"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type SeverityLevel = "rose" | "amber" | "blue";

export interface NeedsAttentionCardProps {
  severity: SeverityLevel; // rose = act now, amber = act this week, blue = informational
  title: string;
  description: string;
  actionLabel: string;
  actionHref?: string | undefined;
  onAction?: (() => void) | undefined;
  badge?: string | undefined;
  className?: string | undefined;
}

export function NeedsAttentionCard({
  severity,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  badge,
  className,
}: NeedsAttentionCardProps) {
  const isRose = severity === "rose";
  const isAmber = severity === "amber";

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 bg-card border-border/80 shadow-level-1 flex flex-col justify-between transition-all hover:shadow-level-2",
        isRose && "border-l-4 border-l-rose-500",
        isAmber && "border-l-4 border-l-amber-500",
        !isRose && !isAmber && "border-l-4 border-l-blue-500",
        className
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5">
            {isRose && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
            {isAmber && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
            {!isRose && !isAmber && <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />}
            <span className="text-xs font-bold text-foreground truncate">
              {title}
            </span>
          </div>
          {badge && (
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0",
                isRose && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25",
                isAmber && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25",
                !isRose && !isAmber && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25"
              )}
            >
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
          {description}
        </p>
      </div>

      <div className="pt-3 mt-2 border-t border-border/70 flex items-center justify-end">
        {actionHref ? (
          <Link
            href={actionHref}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition min-h-[38px] sm:min-h-[44px] active:scale-[0.98]",
              isRose
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-level-1"
                : isAmber
                ? "bg-amber-600 hover:bg-amber-500 text-white shadow-level-1"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-level-1"
            )}
          >
            <span>{actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAction}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition min-h-[38px] sm:min-h-[44px] active:scale-[0.98]",
              isRose
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-level-1"
                : isAmber
                ? "bg-amber-600 hover:bg-amber-500 text-white shadow-level-1"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-level-1"
            )}
          >
            <span>{actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default NeedsAttentionCard;
