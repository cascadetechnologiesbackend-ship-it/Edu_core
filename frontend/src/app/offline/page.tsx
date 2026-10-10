"use client";

import { WifiOff, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mb-6 border border-red-500/30">
        <WifiOff className="w-8 h-8" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
        You are currently offline
      </h1>

      <p className="text-slate-400 max-w-md text-sm mb-8 leading-relaxed">
        SchoolMitra ERP requires an active internet connection to ensure financial
        and student record integrity. Previously cached shell pages remain accessible,
        but database operations are temporarily paused.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Connection
        </button>

        <Link
          href="/dashboard"
          prefetch={false}
          className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-700 transition-colors"
        >
          <Home className="w-4 h-4" />
          Go to Dashboard Shell
        </Link>
      </div>

      <p className="text-xs text-slate-500 mt-12 font-mono">
        SchoolMitra PWA • Offline Cache Active
      </p>
    </div>
  );
}
