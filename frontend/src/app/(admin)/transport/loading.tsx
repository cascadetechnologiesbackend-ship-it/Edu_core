export default function TransportLoading() {
  return (
    <div
      className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse"
      aria-busy="true"
      aria-label="Loading Transport Management"
    >
      {/* Header */}
      <div className="space-y-1.5">
        <div className="h-9 w-64 bg-muted/60 rounded-lg" />
        <div className="h-4 w-96 bg-muted/40 rounded" />
      </div>

      {/* Transport Tab Selectors Strip */}
      <div className="border-b border-gray-200 dark:border-slate-800">
        <div className="flex gap-4 pb-3">
          {[1, 2, 3, 4, 5].map((tab) => (
            <div key={tab} className="h-8 w-28 bg-muted/40 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Action / Search Bar */}
      <div className="flex items-center justify-between">
        <div className="h-10 w-72 bg-muted/30 rounded-xl" />
        <div className="h-10 w-32 bg-muted/60 rounded-xl" />
      </div>

      {/* Fleet / Vehicle Grid Cards or Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="h-12 bg-muted/30 border-b border-gray-200 dark:border-slate-800 px-6 flex items-center justify-between">
          <div className="h-4 w-24 bg-muted/50 rounded" />
          <div className="h-4 w-32 bg-muted/50 rounded" />
          <div className="h-4 w-28 bg-muted/50 rounded" />
          <div className="h-4 w-20 bg-muted/50 rounded" />
          <div className="h-4 w-16 bg-muted/50 rounded" />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 px-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-muted/50" />
                <div className="space-y-1">
                  <div className="h-4 w-28 bg-muted/60 rounded font-bold" />
                  <div className="h-3 w-36 bg-muted/30 rounded font-mono" />
                </div>
              </div>
              <div className="h-4 w-28 bg-muted/40 rounded" />
              <div className="h-4 w-24 bg-muted/40 rounded" />
              <div className="h-6 w-20 bg-muted/30 rounded-full" />
              <div className="h-8 w-20 bg-muted/20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
