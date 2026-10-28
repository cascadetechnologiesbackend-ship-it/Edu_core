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
        return <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
      case "down":
        return <TrendingDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />;
      default:
        return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getTrendColor = (dir: "up" | "down" | "neutral") => {
    switch (dir) {
      case "up":
        return "text-emerald-600 dark:text-emerald-400";
      case "down":
        return "text-rose-600 dark:text-rose-400";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div
      className={`bg-card text-card-foreground rounded-xl border border-border shadow-sm p-5 transition-all duration-200 hover:shadow-md ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
          {title}
        </span>
        {icon && (
          <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground flex-shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {value}
        </span>
        {trend && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${getTrendColor(
              trend.direction
            )}`}
          >
            {getTrendIcon(trend.direction)}
            <span>{trend.value}</span>
            {trend.label && (
              <span className="text-muted-foreground font-normal ml-0.5">
                {trend.label}
              </span>
            )}
          </span>
        )}
      </div>

      {subtext && (
        <p className="mt-1 text-xs text-muted-foreground truncate">{subtext}</p>
      )}
    </div>
  );
}
