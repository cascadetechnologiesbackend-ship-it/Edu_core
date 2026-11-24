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
        "flex flex-col items-center justify-center text-center p-8 md:p-12 rounded-2xl border border-dashed border-border/60 bg-card/40",
        className
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mb-4 shadow-xs">
        <Icon className="w-6 h-6" />
      </div>

      <h3 className="text-base font-bold text-foreground mb-1">
        {title}
      </h3>

      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {description}
      </p>

      {actionLabel && (
        <>
          {actionHref ? (
            <Link
              href={actionHref as any}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-semantic-interactive hover:bg-semantic-interactive/90 text-white shadow-xs transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{actionLabel}</span>
            </Link>
          ) : onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-semantic-interactive hover:bg-semantic-interactive/90 text-white shadow-xs transition-all active:scale-95"
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
