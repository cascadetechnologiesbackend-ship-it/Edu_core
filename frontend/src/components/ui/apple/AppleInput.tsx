import React from 'react';

export interface AppleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const AppleInput: React.FC<AppleInputProps> = ({
  label,
  error,
  hint,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          {label}
        </label>
      )}
      <input
        className={`w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all duration-200 ${
          error
            ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
            : 'border-zinc-200 dark:border-zinc-800'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
};
