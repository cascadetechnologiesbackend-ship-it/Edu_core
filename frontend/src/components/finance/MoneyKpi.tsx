import React from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MoneyKpiProps {
  label?: string;
  title?: string;
  amount: number | string;
  href?: string | undefined;
  icon?: React.ComponentType<any> | undefined;
  delta?: {
    value: string | number;
    label?: string | undefined;
    isPositive?: boolean | undefined;
    isNeutral?: boolean | undefined;
  } | undefined;
  subtitle?: string | undefined;
  variant?: "primary" | "emerald" | "amber" | "rose" | "slate" | "danger" | "warning" | undefined;
  className?: string | undefined;
}

export function formatINR(val: number | string): string {
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "₹ 0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(num);
}

export function MoneyKpi({
  label,
  title,
  amount,
  href,
  icon: Icon,
  delta,
  subtitle,
  variant = "primary",
  className,
}: MoneyKpiProps) {
  const displayLabel = title || label || "KPI";
  const effectiveVariant =
    variant === "danger" ? "rose" : variant === "warning" ? "amber" : variant;

  const content = (
    <div
      className={cn(
        "group relative p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 shadow-sm",
        href && "hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
        effectiveVariant === "primary" &&
          "border-indigo-100 dark:border-indigo-950 hover:border-indigo-300 dark:hover:border-indigo-700",
        effectiveVariant === "emerald" &&
          "border-emerald-100 dark:border-emerald-950 hover:border-emerald-300 dark:hover:border-emerald-700",
        effectiveVariant === "amber" &&
          "border-amber-100 dark:border-amber-950 hover:border-amber-300 dark:hover:border-amber-700",
        effectiveVariant === "rose" &&
          "border-rose-100 dark:border-rose-950 hover:border-rose-300 dark:hover:border-rose-700",
        effectiveVariant === "slate" &&
          "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700",
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
          {displayLabel}
        </span>
        {Icon && (
          <div
            className={cn(
              "p-2 rounded-xl transition-colors",
              effectiveVariant === "primary" && "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400",
              effectiveVariant === "emerald" && "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
              effectiveVariant === "amber" && "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
              effectiveVariant === "rose" && "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
              effectiveVariant === "slate" && "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="font-mono text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        {formatINR(amount)}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
        {delta && (
          <div className="flex items-center gap-1 font-medium">
            {delta.isNeutral ? (
              <span className="inline-flex items-center text-gray-500">
                <Minus className="w-3.5 h-3.5 mr-0.5" />
                {delta.value}
              </span>
            ) : delta.isPositive ? (
              <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                {delta.value}
              </span>
            ) : (
              <span className="inline-flex items-center text-rose-600 dark:text-rose-400">
                <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                {delta.value}
              </span>
            )}
            {delta.label && <span className="text-gray-400 ml-1">{delta.label}</span>}
          </div>
        )}

        {subtitle && <span className="truncate">{subtitle}</span>}

        {href && (
          <span className="inline-flex items-center text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 group-hover:underline ml-auto">
            View List →
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href as any} className="block">{content}</Link>;
  }

  return content;
}
