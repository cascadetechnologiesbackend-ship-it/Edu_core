import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface MetricTrend {
  value: string | number;
  direction: "up" | "down" | "neutral";
  label?: string;
}

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  trend?: MetricTrend;
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtext,
  trend,
  icon,
  className = "",
}: MetricCardProps) {
  const getTrendIcon = (dir: "up" | "down" | "neutral") => {
    switch (dir) {
      case "up":
        return <TrendingUp className="h-3.5 w-3.5 text-semantic-money-in" />;
      case "down":
        return <TrendingDown className="h-3.5 w-3.5 text-semantic-money-owed" />;
      default:
        return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getTrendBadgeStyle = (dir: "up" | "down" | "neutral") => {
    switch (dir) {
      case "up":
        return "bg-semantic-money-in/12 text-semantic-money-in border border-semantic-money-in/20";
      case "down":
        return "bg-semantic-money-owed/12 text-semantic-money-owed border border-semantic-money-owed/20";
      default:
        return "bg-muted/80 text-muted-foreground border border-border/40";
    }
  };

  return (
    <div
      className={`bg-card text-card-foreground rounded-2xl border border-border/40 shadow-level-1 p-5 transition-all duration-200 hover:shadow-level-2 hover:-translate-y-0.5 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
          {title}
        </span>
        {icon && (
          <div className="h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground flex-shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl tabular-nums font-mono">
          {value}
        </span>
        {trend && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${getTrendBadgeStyle(
              trend.direction
            )}`}
          >
            {getTrendIcon(trend.direction)}
            <span className="tabular-nums font-mono">{trend.value}</span>
            {trend.label && (
              <span className="opacity-80 font-normal ml-0.5">
                {trend.label}
              </span>
            )}
          </span>
        )}
      </div>

      {subtext && (
        <p className="mt-1.5 text-xs text-muted-foreground truncate">{subtext}</p>
      )}
    </div>
  );
}
