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
        "group relative p-5 rounded-2xl bg-card border border-border/40 transition-all duration-200 shadow-level-1",
        href && "hover:shadow-level-2 hover:-translate-y-0.5 cursor-pointer",
        effectiveVariant === "primary" &&
          "hover:border-blue-500/40",
        effectiveVariant === "emerald" &&
          "hover:border-emerald-500/40",
        effectiveVariant === "amber" &&
          "hover:border-amber-500/40",
        effectiveVariant === "rose" &&
          "hover:border-rose-500/40",
        effectiveVariant === "slate" &&
          "hover:border-border",
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {displayLabel}
        </span>
        {Icon && (
          <div
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-xs",
              effectiveVariant === "primary" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
              effectiveVariant === "emerald" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              effectiveVariant === "amber" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
              effectiveVariant === "rose" && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
              effectiveVariant === "slate" && "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="font-mono text-2xl md:text-3xl font-bold tracking-tight text-foreground">
        {formatINR(amount)}
      </div>

      <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
        {delta && (
          <div className="flex items-center gap-1 font-medium">
            {delta.isNeutral ? (
              <span className="inline-flex items-center text-muted-foreground bg-muted px-2 py-0.5 rounded-full text-xs font-semibold">
                <Minus className="w-3.5 h-3.5 mr-0.5" />
                {delta.value}
              </span>
            ) : delta.isPositive ? (
              <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full text-xs font-semibold">
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                {delta.value}
              </span>
            ) : (
              <span className="inline-flex items-center text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full text-xs font-semibold">
                <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                {delta.value}
              </span>
            )}
            {delta.label && <span className="text-gray-400 ml-1">{delta.label}</span>}
          </div>
        )}

        {subtitle && <span className="truncate">{subtitle}</span>}
        {href && (
          <span className="inline-flex items-center text-[11px] font-semibold text-blue-600 dark:text-blue-400 group-hover:underline ml-auto">
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
