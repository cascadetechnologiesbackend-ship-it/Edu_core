import React from 'react';

export interface AppleAvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  statusColor?: 'green' | 'amber' | 'red' | 'gray';
}

export const AppleAvatar: React.FC<AppleAvatarProps> = ({
  name,
  src,
  size = 'md',
  statusColor,
}) => {
  const sizeStyles = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl font-bold',
  };

  const statusStyles = {
    green: 'bg-[#28A745]',
    amber: 'bg-[#D97706]',
    red: 'bg-[#FF3B30]',
    gray: 'bg-zinc-400',
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative inline-block select-none">
      {src ? (
        <img
          src={src}
          alt={name}
          className={`rounded-full object-cover border border-zinc-200/80 dark:border-zinc-800/80 ${sizeStyles[size]}`}
        />
      ) : (
        <div
          className={`rounded-full flex items-center justify-center font-medium bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60 shadow-sm ${sizeStyles[size]}`}
        >
          {initials}
        </div>
      )}
      {statusColor && (
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 ${statusStyles[statusColor]}`}
        />
      )}
    </div>
  );
};
