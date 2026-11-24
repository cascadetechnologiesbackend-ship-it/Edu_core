import React from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

export interface InsetGroupedListItemProps {
  id?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  showChevron?: boolean;
  className?: string;
  destructive?: boolean;
}

export interface InsetGroupedListSectionProps {
  title?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function InsetGroupedListSection({
  title,
  footer,
  children,
  className = "",
}: InsetGroupedListSectionProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {title && (
        <h3 className="px-4 text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
      )}
      <div className="bg-card rounded-2xl border border-border/40 shadow-level-1 overflow-hidden divide-y divide-border/30">
        {children}
      </div>
      {footer && (
        <p className="px-4 text-xs text-muted-foreground leading-relaxed">
          {footer}
        </p>
      )}
    </div>
  );
}

export function InsetGroupedListItem({
  title,
  subtitle,
  icon,
  trailing,
  href,
  onClick,
  showChevron = Boolean(href || onClick),
  className = "",
  destructive = false,
}: InsetGroupedListItemProps) {
  const content = (
    <div
      className={`flex items-center justify-between px-4 py-3.5 transition-colors group ${
        onClick || href ? "hover:bg-muted/30 cursor-pointer active:bg-muted/50" : ""
      } ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon && (
          <div className="h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground flex-shrink-0 group-hover:text-foreground transition-colors">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div
            className={`text-sm font-medium truncate ${
              destructive
                ? "text-semantic-money-owed"
                : "text-foreground group-hover:text-foreground"
            }`}
          >
            {title}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        {trailing && <div className="text-xs text-muted-foreground">{trailing}</div>}
        {showChevron && (
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block outline-none focus-visible:bg-muted/40">
        {content}
      </Link>
    );
  }

  return content;
}
