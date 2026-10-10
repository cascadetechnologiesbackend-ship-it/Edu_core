export default function StudentsDirectoryLoading() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="h-4 w-96 bg-slate-100 dark:bg-slate-800/60 rounded" />
      </div>

      {/* Filter bar skeleton */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-200 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[280px]">
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
          <div className="h-9 w-full bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>
        <div className="w-48">
          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
          <div className="h-9 w-full bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>
        <div className="w-40">
          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
          <div className="h-9 w-full bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
          <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded font-mono" />
              <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-5 w-28 bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full" />
              <div className="h-7 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
