export default function AttendanceLoading() {
  return (
    <div
      className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse"
      aria-busy="true"
      aria-label="Loading Student Attendance"
    >
      {/* Header */}
      <div className="space-y-1.5">
        <div className="h-9 w-64 bg-muted/60 rounded-lg" />
        <div className="h-4 w-96 bg-muted/40 rounded" />
      </div>

      {/* Filter Controls Bar (Section, Date, Action) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1.5">
          <div className="h-3.5 w-28 bg-muted/50 rounded" />
          <div className="h-10 bg-muted/30 rounded-md" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3.5 w-24 bg-muted/50 rounded" />
          <div className="h-10 bg-muted/30 rounded-md" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3.5 w-20 bg-muted/50 rounded" />
          <div className="h-10 bg-muted/30 rounded-md" />
        </div>
      </div>

      {/* Roster Controls Strip */}
      <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="h-4 w-32 bg-muted/50 rounded" />
          <div className="h-7 w-24 bg-muted/40 rounded-lg" />
          <div className="h-7 w-24 bg-muted/40 rounded-lg" />
        </div>
        <div className="h-9 w-32 bg-muted/60 rounded-lg" />
      </div>

      {/* Attendance Students Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="h-12 bg-muted/30 border-b border-gray-200 dark:border-slate-800 px-6 flex items-center justify-between">
          <div className="h-4 w-16 bg-muted/50 rounded" />
          <div className="h-4 w-40 bg-muted/50 rounded" />
          <div className="h-4 w-48 bg-muted/50 rounded" />
          <div className="h-4 w-32 bg-muted/50 rounded" />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-16 px-6 flex items-center justify-between">
              <div className="h-4 w-12 bg-muted/40 rounded font-mono" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted/50" />
                <div className="space-y-1">
                  <div className="h-4 w-32 bg-muted/60 rounded" />
                  <div className="h-3 w-20 bg-muted/30 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-16 bg-muted/30 rounded-md" />
                <div className="h-8 w-16 bg-muted/30 rounded-md" />
                <div className="h-8 w-16 bg-muted/30 rounded-md" />
              </div>
              <div className="h-8 w-28 bg-muted/20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
