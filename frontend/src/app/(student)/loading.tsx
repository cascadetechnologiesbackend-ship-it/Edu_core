export default function StudentLoading() {
  return (
    <div className="space-y-6 animate-pulse p-6 max-w-7xl mx-auto" aria-busy="true" aria-label="Loading student portal">
      <div className="h-36 rounded-2xl bg-muted/40 border border-border/50 p-6 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted/60 rounded" />
          <div className="h-8 w-64 bg-muted/80 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
