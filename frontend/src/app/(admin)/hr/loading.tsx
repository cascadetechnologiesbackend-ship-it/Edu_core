export default function HRLoading() {
  return (
    <div
      className="p-6 max-w-7xl mx-auto space-y-8 animate-pulse"
      aria-busy="true"
      aria-label="Loading Human Resources & Payroll"
    >
      {/* Header & Onboard Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="h-8 w-80 bg-muted/60 rounded-lg" />
          <div className="h-4 w-60 bg-muted/40 rounded" />
        </div>
        <div className="h-9 w-32 bg-muted/60 rounded-md" />
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 pb-3">
        {[1, 2, 3, 4, 5, 6].map((tab) => (
          <div key={tab} className="h-5 w-28 bg-muted/40 rounded" />
        ))}
      </div>

      {/* Search & Filter Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div className="h-10 bg-muted/30 rounded-lg md:col-span-2" />
        <div className="h-10 bg-muted/30 rounded-lg" />
        <div className="h-10 bg-muted/30 rounded-lg" />
      </div>

      {/* Staff Directory Table Skeleton */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="h-12 bg-muted/30 border-b border-gray-200 dark:border-slate-800 px-6 flex items-center justify-between">
          <div className="h-4 w-32 bg-muted/50 rounded" />
          <div className="h-4 w-28 bg-muted/50 rounded" />
          <div className="h-4 w-28 bg-muted/50 rounded" />
          <div className="h-4 w-20 bg-muted/50 rounded" />
          <div className="h-4 w-16 bg-muted/50 rounded" />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {[1, 2, 3, 4, 5, 6, 7].map((row) => (
            <div key={row} className="h-16 px-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-muted/50" />
                <div className="space-y-1">
                  <div className="h-4 w-36 bg-muted/60 rounded" />
                  <div className="h-3 w-24 bg-muted/30 rounded font-mono" />
                </div>
              </div>
              <div className="h-4 w-28 bg-muted/40 rounded" />
              <div className="h-4 w-28 bg-muted/40 rounded" />
              <div className="h-6 w-20 bg-muted/30 rounded-full" />
              <div className="h-8 w-16 bg-muted/20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
