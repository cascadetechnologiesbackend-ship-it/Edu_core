export default function DpdpLoading() {
  return (
    <div className="space-y-6 animate-pulse p-6 max-w-7xl mx-auto" aria-busy="true" aria-label="Loading DPDP compliance centre">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-72 bg-muted/60 rounded-lg" />
          <div className="h-4 w-96 bg-muted/40 rounded" />
        </div>
        <div className="h-10 w-36 bg-muted/60 rounded-xl" />
      </div>

      {/* KPI Cards (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-card border border-border p-5 rounded-2xl shadow-sm space-y-3">
            <div className="h-4 w-28 bg-muted/50 rounded" />
            <div className="h-7 w-20 bg-muted/80 rounded" />
          </div>
        ))}
      </div>

      {/* Main Tabs / Table Skeleton */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex gap-3 pb-3 border-b border-border/60">
          {[1, 2, 3, 4, 5].map((t) => (
            <div key={t} className="h-9 w-28 bg-muted/40 rounded-xl" />
          ))}
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div key={row} className="h-12 bg-muted/20 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
