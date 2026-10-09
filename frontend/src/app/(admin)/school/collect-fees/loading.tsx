export default function CollectFeesLoading() {
  return (
    <div className="space-y-6 animate-pulse p-6 max-w-7xl mx-auto" aria-busy="true" aria-label="Loading POS fee collection">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-muted/60 rounded-lg" />
          <div className="h-4 w-80 bg-muted/40 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-card border border-border p-6 rounded-2xl space-y-4">
          <div className="h-10 bg-muted/40 rounded-xl" />
          <div className="space-y-2 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-muted/20 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 bg-card border border-border p-6 rounded-2xl space-y-4">
          <div className="h-6 w-48 bg-muted/50 rounded" />
          <div className="space-y-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-20 bg-muted/20 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
