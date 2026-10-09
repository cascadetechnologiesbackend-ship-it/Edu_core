export default function LibraryLoading() {
  return (
    <div
      className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse"
      aria-busy="true"
      aria-label="Loading Library Management"
    >
      {/* Header */}
      <div className="space-y-1.5">
        <div className="h-9 w-64 bg-muted/60 rounded-lg" />
        <div className="h-4 w-96 bg-muted/40 rounded" />
      </div>

      {/* Tabs Selector Strip */}
      <div className="flex border-b border-border gap-6 pb-3">
        {[1, 2, 3, 4].map((tab) => (
          <div key={tab} className="h-5 w-24 bg-muted/40 rounded" />
        ))}
      </div>

      {/* Overview Stat Cards (3 cards matching real grid) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((card) => (
          <div
            key={card}
            className="bg-card border border-border p-6 rounded-xl flex items-center gap-4 shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-muted/50 flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-3.5 w-28 bg-muted/50 rounded" />
              <div className="h-7 w-16 bg-muted/70 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Checkout & Return Panels (2-column grid matching real layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
          <div className="h-5 w-44 bg-muted/60 rounded" />
          <div className="space-y-3">
            <div className="h-10 bg-muted/30 rounded-lg" />
            <div className="h-10 bg-muted/30 rounded-lg" />
            <div className="h-10 bg-muted/50 rounded-lg w-32" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
          <div className="h-5 w-40 bg-muted/60 rounded" />
          <div className="space-y-3">
            <div className="h-10 bg-muted/30 rounded-lg" />
            <div className="h-10 bg-muted/30 rounded-lg" />
            <div className="h-10 bg-muted/50 rounded-lg w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}
