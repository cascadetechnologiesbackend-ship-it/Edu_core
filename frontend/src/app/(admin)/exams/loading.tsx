export default function ExamsLoading() {
  return (
    <div
      className="p-6 max-w-7xl mx-auto space-y-8 animate-pulse"
      aria-busy="true"
      aria-label="Loading Examinations"
    >
      {/* Header & New Exam Action */}
      <div className="flex justify-between items-center">
        <div className="space-y-1.5">
          <div className="h-8 w-48 bg-muted/60 rounded-lg" />
          <div className="h-4 w-80 bg-muted/40 rounded" />
        </div>
        <div className="h-9 w-28 bg-muted/60 rounded-md" />
      </div>

      {/* Exam Type Quick Stats (4 cards matching real grid) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-2"
          >
            <div className="h-3.5 w-24 bg-muted/50 rounded" />
            <div className="h-8 w-12 bg-muted/70 rounded" />
            <div className="h-3 w-16 bg-muted/30 rounded" />
          </div>
        ))}
      </div>

      {/* Exams List Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="h-5 w-44 bg-muted/60 rounded" />
          <div className="h-4 w-28 bg-muted/40 rounded" />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {[1, 2, 3, 4, 5].map((k) => (
            <div key={k} className="p-5 flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-48 bg-muted/70 rounded" />
                  <div className="h-5 w-20 bg-muted/40 rounded-full" />
                </div>
                <div className="h-3.5 w-64 bg-muted/30 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-24 bg-muted/30 rounded-lg" />
                <div className="h-8 w-20 bg-muted/30 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
