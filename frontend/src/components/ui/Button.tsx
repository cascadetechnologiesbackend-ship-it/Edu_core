import React, { forwardRef } from "react";

export type ButtonTier = "filled" | "tinted" | "plain" | "gray" | "destructive";
export type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tier?: ButtonTier;
  size?: ButtonSize;
  isLoading?: boolean;
}

export const getButtonClasses = ({
  tier = "filled",
  size = "default",
  isLoading = false,
  className = "",
}: {
  tier?: ButtonTier;
  size?: ButtonSize;
  isLoading?: boolean;
  className?: string;
} = {}) => {
  const base =
    "inline-flex items-center justify-center font-medium transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-semantic-interactive/40 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] rounded-xl";

  const tierClasses: Record<ButtonTier, string> = {
    // Exactly ONE filled interactive-tint button per action row
    filled:
      "bg-semantic-interactive text-white hover:bg-semantic-interactive/90 shadow-sm",
    // Secondary action in an action row wears 12% tint
    tinted:
      "bg-semantic-interactive/12 text-semantic-interactive hover:bg-semantic-interactive/18",
    // Tertiary action is plain tinted text
    plain:
      "text-semantic-interactive hover:bg-semantic-interactive/8 bg-transparent",
    // Neutral cancel/negative-space action
    gray:
      "bg-muted/80 text-foreground hover:bg-muted border border-border/40",
    // Destructive alert action (red)
    destructive:
      "bg-semantic-money-owed/12 text-semantic-money-owed hover:bg-semantic-money-owed/20",
  };

  const sizeClasses: Record<ButtonSize, string> = {
    // Apple 44pt minimum touch target
    default: "h-11 px-4 py-2 text-sm gap-2",
    // Compact density for data tables (36pt)
    sm: "h-9 px-3 text-xs gap-1.5",
    lg: "h-12 px-6 text-base gap-2.5",
    icon: "h-10 w-10 p-0",
  };

  return `${base} ${tierClasses[tier]} ${sizeClasses[size]} ${
    isLoading ? "opacity-75 cursor-wait" : ""
  } ${className}`.trim();
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      tier = "filled",
      size = "default",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={getButtonClasses({ tier, size, isLoading, className })}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
