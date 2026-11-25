import React from 'react';
import { GlassCard } from './GlassCard';

export interface MetricItem {
  id: string;
  label: string;
  value: string | number;
  delta?: string;
  isPositive?: boolean;
  statusColor?: 'blue' | 'green' | 'amber' | 'purple' | 'red';
}

export interface GlanceStripProps {
  greeting: string;
  subheading: string;
  metrics: MetricItem[];
}

export const GlanceStrip: React.FC<GlanceStripProps> = ({
  greeting,
  subheading,
  metrics,
}) => {
  return (
    <GlassCard variant="glass" padding="lg" className="mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {greeting}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {subheading}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <div key={m.id} className="border-l border-zinc-200/80 dark:border-zinc-800/80 pl-4">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                {m.label}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {m.value}
                </span>
                {m.delta && (
                  <span
                    className={`text-[11px] font-semibold ${
                      m.isPositive ? 'text-[#28A745]' : 'text-zinc-500'
                    }`}
                  >
                    {m.delta}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
};
