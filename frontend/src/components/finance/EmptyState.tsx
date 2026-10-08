import React from "react";
import Link from "next/link";
import { FolderSearch, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ComponentType<any> | undefined;
  title: string;
  description: string;
  actionLabel?: string | undefined;
  actionHref?: string | undefined;
  onAction?: (() => void) | undefined;
  className?: string | undefined;
}

export function EmptyState({
  icon: Icon = FolderSearch,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 md:p-12 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/30",
        className
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-sm">
        <Icon className="w-6 h-6" />
      </div>

      <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
        {title}
      </h3>

      <p className="text-sm text-gray-500 dark:text-slate-400 max-w-sm mb-6">
        {description}
      </p>

      {actionLabel && (
        <>
          {actionHref ? (
            <Link
              href={actionHref as any}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{actionLabel}</span>
            </Link>
          ) : onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{actionLabel}</span>
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
