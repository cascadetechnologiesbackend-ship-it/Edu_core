import React from 'react';

export interface AppleBadgeProps {
  children: React.ReactNode;
  color?: 'blue' | 'cyan' | 'teal' | 'purple' | 'green' | 'amber' | 'coral' | 'red' | 'gray';
  size?: 'sm' | 'md';
  hasDot?: boolean;
}

export const AppleBadge: React.FC<AppleBadgeProps> = ({
  children,
  color = 'blue',
  size = 'md',
  hasDot = false,
}) => {
  const colorStyles = {
    blue: 'bg-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF] border-[#0071E3]/20',
    cyan: 'bg-[#00A3BF]/10 text-[#00A3BF] dark:text-[#00D1F2] border-[#00A3BF]/20',
    teal: 'bg-[#028090]/10 text-[#028090] dark:text-[#00C49F] border-[#028090]/20',
    purple: 'bg-[#7D53DE]/10 text-[#7D53DE] dark:text-[#A084E8] border-[#7D53DE]/20',
    green: 'bg-[#28A745]/10 text-[#28A745] dark:text-[#30D158] border-[#28A745]/20',
    amber: 'bg-[#D97706]/10 text-[#D97706] dark:text-[#F59E0B] border-[#D97706]/20',
    coral: 'bg-[#FF6B6B]/10 text-[#FF6B6B] dark:text-[#FF8787] border-[#FF6B6B]/20',
    red: 'bg-[#FF3B30]/10 text-[#FF3B30] dark:text-[#FF453A] border-[#FF3B30]/20',
    gray: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
  };

  const dotColors = {
    blue: 'bg-[#0071E3]',
    cyan: 'bg-[#00A3BF]',
    teal: 'bg-[#028090]',
    purple: 'bg-[#7D53DE]',
    green: 'bg-[#28A745]',
    amber: 'bg-[#D97706]',
    coral: 'bg-[#FF6B6B]',
    red: 'bg-[#FF3B30]',
    gray: 'bg-zinc-400',
  };

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${colorStyles[color]} ${sizeClass}`}
    >
      {hasDot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[color]}`} />}
      {children}
    </span>
  );
};
