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
  variant?: "primary" | "emerald" | "amber" | "rose" | "slate" | "danger" | "warning" | "money_in" | "money_owed" | "attention" | "neutral" | undefined;
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

  // Map legacy color variant names to strict semantic intentions
  const resolveSemantic = (v?: string) => {
    switch (v) {
      case "emerald":
      case "money_in":
        return "money_in";
      case "rose":
      case "danger":
      case "money_owed":
        return "money_owed";
      case "amber":
      case "warning":
      case "attention":
        return "attention";
      case "primary":
        return "interactive";
      default:
        return "neutral";
    }
  };

  const semantic = resolveSemantic(variant);

  const content = (
    <div
      className={cn(
        "group relative p-5 rounded-2xl bg-card border border-border/40 transition-all duration-200 shadow-level-1",
        href && "hover:shadow-level-2 hover:-translate-y-0.5 cursor-pointer",
        semantic === "interactive" && "hover:border-semantic-interactive/40",
        semantic === "money_in" && "hover:border-semantic-money-in/40",
        semantic === "attention" && "hover:border-semantic-attention/40",
        semantic === "money_owed" && "hover:border-semantic-money-owed/40",
        semantic === "neutral" && "hover:border-border",
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
              semantic === "interactive" && "bg-semantic-interactive/12 text-semantic-interactive",
              semantic === "money_in" && "bg-semantic-money-in/12 text-semantic-money-in",
              semantic === "attention" && "bg-semantic-attention/12 text-semantic-attention",
              semantic === "money_owed" && "bg-semantic-money-owed/12 text-semantic-money-owed",
              semantic === "neutral" && "bg-muted/60 text-muted-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="font-mono text-2xl md:text-3xl font-bold tracking-tight text-foreground tabular-nums">
        {formatINR(amount)}
      </div>

      {delta && (
        <div className="flex items-center gap-1.5 mt-2.5">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold font-mono tabular-nums px-1.5 py-0.5 rounded-full border",
              delta.isNeutral
                ? "bg-muted text-muted-foreground border-border/40"
                : delta.isPositive
                ? "bg-semantic-money-in/12 text-semantic-money-in border-semantic-money-in/20"
                : "bg-semantic-money-owed/12 text-semantic-money-owed border-semantic-money-owed/20"
            )}
          >
            {delta.isNeutral ? (
              <Minus className="w-3 h-3" />
            ) : delta.isPositive ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {delta.value}
          </span>
          {delta.label && (
            <span className="text-xs text-muted-foreground">{delta.label}</span>
          )}
        </div>
      )}

      {subtitle && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-1">{subtitle}</p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href as any} className="block outline-none focus-visible:ring-2 focus-visible:ring-semantic-interactive/40 rounded-2xl">
        {content}
      </Link>
    );
  }

  return content;
}
