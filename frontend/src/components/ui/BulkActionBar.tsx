"use client";

import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection?: (() => void) | undefined;
  children: React.ReactNode;
  className?: string | undefined;
  label?: string | undefined;
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  children,
  className,
  label,
}: BulkActionBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div
      className={cn(
        "sticky bottom-4 z-40 mx-auto w-full max-w-2xl px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-slate-900/95 text-white backdrop-blur-md border border-slate-700/80 shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200",
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex items-center justify-center px-2.5 py-0.5 rounded-full bg-primary text-white text-xs font-bold">
          {selectedCount}
        </span>
        <span className="text-xs font-semibold text-gray-200">
          {label ?? `${selectedCount} ${selectedCount === 1 ? "item" : "items"} selected`}
        </span>
        {onClearSelection && (
          <button
            type="button"
            onClick={onClearSelection}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition min-h-[32px] min-w-[32px] flex items-center justify-center text-xs"
            title="Clear selection"
            aria-label="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {children}
      </div>
    </div>
  );
}

export default BulkActionBar;
