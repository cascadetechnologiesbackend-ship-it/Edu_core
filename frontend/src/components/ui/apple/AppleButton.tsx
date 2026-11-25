import React from 'react';
import { Loader2 } from 'lucide-react';

export interface AppleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  moduleColor?: 'blue' | 'cyan' | 'teal' | 'purple' | 'indigo' | 'green' | 'amber';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const AppleButton: React.FC<AppleButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  moduleColor = 'blue',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const sizeStyles = {
    sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
    md: 'h-10 px-4 text-sm rounded-xl gap-2 font-medium',
    lg: 'h-12 px-6 text-base rounded-2xl gap-2.5 font-medium',
  };

  const moduleBgClasses = {
    blue: 'bg-[#0071E3] hover:bg-[#005BB5] text-white',
    cyan: 'bg-[#00A3BF] hover:opacity-95 text-white',
    teal: 'bg-[#028090] hover:opacity-95 text-white',
    purple: 'bg-[#7D53DE] hover:opacity-95 text-white',
    indigo: 'bg-[#5E5CE6] hover:opacity-95 text-white',
    green: 'bg-[#28A745] hover:opacity-95 text-white',
    amber: 'bg-[#D97706] hover:opacity-95 text-white',
  };

  let variantClass = '';
  switch (variant) {
    case 'primary':
      variantClass = moduleBgClasses[moduleColor];
      break;
    case 'secondary':
      variantClass = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700';
      break;
    case 'tertiary':
      variantClass = 'bg-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50';
      break;
    case 'destructive':
      variantClass = 'bg-[#FF3B30] text-white hover:bg-red-600';
      break;
    case 'glass':
      variantClass = 'bg-white/70 dark:bg-zinc-800/70 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-700/50 text-zinc-900 dark:text-zinc-100 hover:bg-white/90 dark:hover:bg-zinc-800/90 shadow-sm';
      break;
  }

  return (
    <button
      className={`inline-flex items-center justify-center transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none ${sizeStyles[size]} ${variantClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : leftIcon}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
