export default function DriverLoading() {
  return (
    <div className="space-y-6 animate-pulse p-6 max-w-7xl mx-auto" aria-busy="true" aria-label="Loading transit dashboard">
      <div className="h-32 rounded-2xl bg-muted/40 border border-border/50 p-6 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted/60 rounded" />
          <div className="h-8 w-64 bg-muted/80 rounded-lg" />
        </div>
      </div>
      <div className="h-72 rounded-2xl bg-card border border-border p-6 space-y-4">
        <div className="h-6 w-36 bg-muted/60 rounded" />
        <div className="h-44 rounded-xl bg-muted/20" />
      </div>
    </div>
  );
}
