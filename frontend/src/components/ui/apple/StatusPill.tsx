import React from 'react';

export interface StatusPillProps {
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'GRADUATED' | 'INACTIVE';
  label?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, label }) => {
  const configs = {
    ACTIVE: { bg: 'bg-[#28A745]/10', text: 'text-[#28A745] dark:text-[#30D158]', border: 'border-[#28A745]/20', dot: 'bg-[#28A745]', defaultLabel: 'Active' },
    PENDING: { bg: 'bg-[#D97706]/10', text: 'text-[#D97706] dark:text-[#F59E0B]', border: 'border-[#D97706]/20', dot: 'bg-[#D97706]', defaultLabel: 'Pending' },
    SUSPENDED: { bg: 'bg-[#FF3B30]/10', text: 'text-[#FF3B30] dark:text-[#FF453A]', border: 'border-[#FF3B30]/20', dot: 'bg-[#FF3B30]', defaultLabel: 'Suspended' },
    GRADUATED: { bg: 'bg-[#0071E3]/10', text: 'text-[#0071E3] dark:text-[#2997FF]', border: 'border-[#0071E3]/20', dot: 'bg-[#0071E3]', defaultLabel: 'Graduated' },
    INACTIVE: { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400', border: 'border-zinc-200 dark:border-zinc-700', dot: 'bg-zinc-400', defaultLabel: 'Inactive' },
  };

  const cfg = configs[status] || configs.INACTIVE;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {label || cfg.defaultLabel}
    </span>
  );
};
