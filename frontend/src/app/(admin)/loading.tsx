export default function AdminLoading() {
  return (
    <div className="space-y-8 animate-pulse p-1" aria-busy="true" aria-label="Loading dashboard">
      {/* Page Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-8 w-64 bg-muted/60 rounded-lg" />
          <div className="h-4 w-72 bg-muted/40 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-28 bg-muted/60 rounded-lg" />
          <div className="h-9 w-28 bg-muted/60 rounded-lg" />
        </div>
      </div>

      {/* Metric Cards Skeleton Grid: 4 cards matching real h-32 / p-6 rounded-xl */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 bg-card border border-border p-6 rounded-xl shadow-sm flex items-start justify-between"
          >
            <div className="space-y-2 flex-1 min-w-0">
              <div className="h-4 w-28 bg-muted/60 rounded" />
              <div className="h-8 w-24 bg-muted/80 rounded" />
              <div className="h-3 w-36 bg-muted/40 rounded" />
            </div>
            <div className="w-12 h-12 rounded-xl bg-muted/50 flex-shrink-0 ml-4" />
          </div>
        ))}
      </div>

      {/* Main Grid: 2:1 ratio matching real dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (col-span-2): Quick Actions & Pending Tasks */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="h-6 w-36 bg-muted/60 rounded" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((k) => (
                <div key={k} className="h-20 bg-muted/30 rounded-xl" />
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-3">
            <div className="h-6 w-32 bg-muted/60 rounded" />
            <div className="space-y-2">
              {[1, 2, 3].map((m) => (
                <div key={m} className="h-12 bg-muted/30 rounded-lg" />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (col-span-1): School Details & Status */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="h-6 w-36 bg-muted/60 rounded" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-10 bg-muted/20 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
