export default function ParentLoading() {
  return (
    <div className="space-y-6 animate-pulse p-6 max-w-7xl mx-auto" aria-busy="true" aria-label="Loading parent portal">
      <div className="h-14 rounded-2xl bg-muted/30 border border-border/40 p-3 flex items-center gap-3">
        {[1, 2].map((w) => (
          <div key={w} className="h-8 w-32 bg-muted/50 rounded-xl" />
        ))}
      </div>
      <div className="h-36 rounded-2xl bg-muted/40 border border-border/50 p-6 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted/60 rounded" />
          <div className="h-8 w-64 bg-muted/80 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-card border border-border p-4 space-y-2">
            <div className="h-4 w-24 bg-muted/50 rounded" />
            <div className="h-7 w-20 bg-muted/70 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
