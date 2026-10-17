"use client";

import React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn, getAvatarColor, getInitials } from "@/lib/utils";

export interface IdentityHeaderProps {
  name: string;
  avatarUrl?: string | null | undefined;
  identifier?: string | null | undefined; // e.g. "ADM-2024-001" or "Grade 8"
  subtitle?: string | React.ReactNode | undefined; // e.g. "Class 8-B • 34 students • 2 fee defaulters"
  badges?: Array<{
    label: string;
    variant?: ("success" | "warning" | "danger" | "neutral" | "primary") | undefined;
  }> | undefined;
  actions?: React.ReactNode | undefined;
  breadcrumbs?: React.ReactNode | undefined;
  className?: string | undefined;
}

const BADGE_VARIANTS = {
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  danger: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  neutral: "bg-gray-50 text-gray-700 dark:bg-slate-800 dark:text-gray-300 border-gray-200 dark:border-slate-700",
  primary: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
};

export function IdentityHeader({
  name,
  avatarUrl,
  identifier,
  subtitle,
  badges = [],
  actions,
  breadcrumbs,
  className,
}: IdentityHeaderProps) {
  const avatarBg = getAvatarColor(name);
  const initials = getInitials(name);

  return (
    <div
      className={cn(
        "sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 py-3.5 px-4 sm:px-6 -mx-4 sm:-mx-6 mb-5 transition-all",
        className
      )}
    >
      {breadcrumbs && (
        <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">
          {breadcrumbs}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Identity row: Avatar + Name + Subtitle/Badges */}
        <div className="flex items-center gap-3.5 min-w-0">
          <AvatarPrimitive.Root className="relative flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 overflow-hidden rounded-2xl shadow-sm border border-gray-200/60 dark:border-slate-700">
            {avatarUrl && (
              <AvatarPrimitive.Image
                src={avatarUrl}
                alt={name}
                className="aspect-square h-full w-full object-cover"
              />
            )}
            <AvatarPrimitive.Fallback
              className={cn(
                "flex h-full w-full items-center justify-center text-sm font-bold",
                avatarBg
              )}
            >
              {initials}
            </AvatarPrimitive.Fallback>
          </AvatarPrimitive.Root>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight truncate leading-tight">
                {name}
              </h1>

              {identifier && (
                <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500">
                  {identifier}
                </span>
              )}

              {badges.map((b, idx) => (
                <span
                  key={idx}
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0",
                    b.variant ? BADGE_VARIANTS[b.variant] : BADGE_VARIANTS.neutral
                  )}
                >
                  {b.label}
                </span>
              ))}
            </div>

            {subtitle && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Action button(s) */}
        {actions && (
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default IdentityHeader;
