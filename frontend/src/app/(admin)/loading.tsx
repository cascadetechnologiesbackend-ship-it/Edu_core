export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse p-2">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted/60 rounded-lg" />
          <div className="h-4 w-72 bg-muted/40 rounded" />
        </div>
        <div className="flex gap-3">
          <div className="h-9 w-28 bg-muted/60 rounded-lg" />
          <div className="h-9 w-28 bg-muted/60 rounded-lg" />
        </div>
      </div>

      {/* Metric Cards Skeleton Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 bg-card border border-border/50 rounded-xl p-5 flex justify-between"
          >
            <div className="space-y-3 flex-1">
              <div className="h-3 w-24 bg-muted/60 rounded" />
              <div className="h-7 w-16 bg-muted/80 rounded" />
              <div className="h-3 w-32 bg-muted/40 rounded" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-muted/60" />
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-72 bg-card border border-border/50 rounded-xl p-6 space-y-4">
          <div className="h-5 w-40 bg-muted/60 rounded" />
          <div className="h-48 bg-muted/30 rounded-lg" />
        </div>
        <div className="h-72 bg-card border border-border/50 rounded-xl p-6 space-y-4">
          <div className="h-5 w-32 bg-muted/60 rounded" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-10 bg-muted/40 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
