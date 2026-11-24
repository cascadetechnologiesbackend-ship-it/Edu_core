"use client";

import React from "react";

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "default";
  className?: string;
  ariaLabel?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = "default",
  className = "",
  ariaLabel = "Segmented control",
}: SegmentedControlProps<T>) {
  const containerSize = size === "sm" ? "p-0.5 rounded-lg text-xs" : "p-1 rounded-xl text-sm";
  const itemPadding = size === "sm" ? "py-1 px-2.5" : "py-1.5 px-3";

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center bg-muted/60 border border-border/40 select-none ${containerSize} ${className}`}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={isSelected}
            onClick={() => onChange(option.value)}
            className={`relative flex items-center justify-center gap-1.5 font-medium transition-all duration-150 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-semantic-interactive/40 ${itemPadding} ${
              isSelected
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground active:scale-[0.98]"
            }`}
          >
            {option.icon && (
              <span className={`flex-shrink-0 ${isSelected ? "text-semantic-interactive" : "opacity-70"}`}>
                {option.icon}
              </span>
            )}
            <span>{option.label}</span>
            {option.badge && <span className="ml-1">{option.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
