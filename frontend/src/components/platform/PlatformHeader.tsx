"use client";

import Link from "next/link";
import { Search, ShieldCheck, Activity, Database, Server } from "lucide-react";
import { useState } from "react";

interface PlatformHeaderProps {
  breadcrumbs?: { label: string; href?: string }[];
}

export function PlatformHeader({
  breadcrumbs = [{ label: "Command Center", href: "/super-admin/dashboard" }],
}: PlatformHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#090d16]/80 backdrop-blur-md px-6 flex items-center justify-between gap-4 sticky top-0 z-40 text-slate-200">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500 font-medium">Platform</span>
        <span className="text-slate-600">/</span>
        {breadcrumbs.map((crumb, idx) => (
          <div key={idx} className="flex items-center gap-2">
            {crumb.href ? (
              <Link
                href={crumb.href as any}
                className="text-slate-400 hover:text-white font-medium transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-white font-semibold">{crumb.label}</span>
            )}
            {idx < breadcrumbs.length - 1 && <span className="text-slate-600">/</span>}
          </div>
        ))}
      </div>

      {/* Global Quick Action Bar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Quick search schools, UDISE... (⌘K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
          />
        </div>

        {/* Telemetry pill */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 font-mono">
          <Database className="w-3 h-3 text-cyan-400" />
          <span>Pool: 25 max</span>
          <span className="text-slate-600">|</span>
          <Server className="w-3 h-3 text-indigo-400" />
          <span>Primary: Healthy</span>
        </div>
      </div>
    </header>
  );
}
