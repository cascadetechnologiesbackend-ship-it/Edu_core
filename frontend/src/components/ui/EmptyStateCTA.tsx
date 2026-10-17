"use client";

import React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateCTAProps {
  icon?: React.ElementType | React.ReactNode | undefined;
  title: string;
  hint: string;
  ctaLabel?: string | undefined;
  onCta?: (() => void) | undefined;
  ctaHref?: string | undefined;
  ctaIcon?: React.ReactNode | undefined;
  className?: string | undefined;
}

export function EmptyStateCTA({
  icon: Icon,
  title,
  hint,
  ctaLabel,
  onCta,
  ctaHref,
  ctaIcon,
  className,
}: EmptyStateCTAProps) {
  const renderIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) return Icon;
    const IconComponent = Icon as React.ElementType;
    return <IconComponent className="w-10 h-10 text-gray-300 dark:text-slate-600 stroke-[1.5]" />;
  };

  return (
    <div
      className={cn(
        "bg-white dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-800 rounded-2xl py-12 px-6 text-center flex flex-col items-center justify-center my-4",
        className
      )}
    >
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-slate-800/60 flex items-center justify-center mb-3.5 border border-gray-100 dark:border-slate-800">
          {renderIcon()}
        </div>
      )}
      <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white tracking-tight">
        {title}
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-1 mb-5 leading-relaxed">
        {hint}
      </p>

      {ctaLabel && (
        <>
          {ctaHref ? (
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/95 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-md shadow-primary/20 min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {ctaIcon ?? <Plus className="w-4 h-4" />}
              <span>{ctaLabel}</span>
            </Link>
          ) : onCta ? (
            <button
              type="button"
              onClick={onCta}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/95 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-md shadow-primary/20 min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              {ctaIcon ?? <Plus className="w-4 h-4" />}
              <span>{ctaLabel}</span>
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

export default EmptyStateCTA;
