import React from "react";

export interface SectionShellProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export function SectionShell({
  title,
  description,
  action,
  children,
  className = "",
  headerClassName = "",
}: SectionShellProps) {
  return (
    <section
      className={`bg-card text-card-foreground rounded-xl border border-border shadow-sm overflow-hidden ${className}`}
    >
      <div
        className={`px-5 py-4 border-b border-border/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/20 ${headerClassName}`}
      >
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}
