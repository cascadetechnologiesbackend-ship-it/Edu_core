import React from 'react';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'surface' | 'glass' | 'elevated' | 'sunken';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  hoverEffect?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  variant = 'glass',
  padding = 'lg',
  hoverEffect = false,
  className = '',
  ...props
}) => {
  const variantStyles = {
    surface: 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800/80 shadow-sm',
    glass: 'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-zinc-200/60 dark:border-zinc-800/60 shadow-md',
    elevated: 'bg-white dark:bg-zinc-900 border-zinc-200/90 dark:border-zinc-800/90 shadow-xl',
    sunken: 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200/40 dark:border-zinc-800/40',
  };

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  };

  const hoverClass = hoverEffect
    ? 'transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0'
    : '';

  return (
    <div
      className={`rounded-2xl border transition-colors ${variantStyles[variant]} ${paddingStyles[padding]} ${hoverClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
