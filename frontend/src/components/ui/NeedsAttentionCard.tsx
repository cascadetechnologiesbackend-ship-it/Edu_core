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
        "rounded-2xl border p-4 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between transition-all hover:shadow-md",
        isRose && "border-l-4 border-l-rose-500 border-gray-200 dark:border-slate-800",
        isAmber && "border-l-4 border-l-amber-500 border-gray-200 dark:border-slate-800",
        !isRose && !isAmber && "border-l-4 border-l-blue-500 border-gray-200 dark:border-slate-800",
        className
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5">
            {isRose && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
            {isAmber && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
            {!isRose && !isAmber && <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />}
            <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
              {title}
            </span>
          </div>
          {badge && (
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0",
                isRose && "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
                isAmber && "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
                !isRose && !isAmber && "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
              )}
            >
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
          {description}
        </p>
      </div>

      <div className="pt-3 mt-2 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-end">
        {actionHref ? (
          <Link
            href={actionHref}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition min-h-[32px]",
              isRose
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-xs shadow-rose-500/20"
                : isAmber
                ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs shadow-amber-500/20"
                : "bg-primary hover:bg-primary/95 text-white shadow-xs shadow-primary/20"
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
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition min-h-[32px]",
              isRose
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-xs shadow-rose-500/20"
                : isAmber
                ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs shadow-amber-500/20"
                : "bg-primary hover:bg-primary/95 text-white shadow-xs shadow-primary/20"
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
