"use client";

import React, { useState, useMemo } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Filter,
  Eye,
  Calendar,
  Layers,
  Search,
} from "lucide-react";
import { EmptyStateCTA } from "@/components/ui/EmptyStateCTA";
import { cn } from "@/lib/utils";

export interface PiiIncidentRow {
  id: string;
  sourceTable: string;
  sourceId?: string | null;
  surface: string;
  detectedTypes: string[];
  riskLevel: string; // CRITICAL | HIGH | MEDIUM | LOW
  matchCount: number;
  decision: string; // BLOCKED | MASKED | CONFIRMED_SEND | LOGGED_ONLY
  redactionMode?: string | null;
  actorUserId: string;
  actorEmail?: string | null;
  contentHash: string;
  createdAt: string | Date;
}

interface PiiIncidentsViewProps {
  incidents: PiiIncidentRow[];
}

export function PiiIncidentsView({ incidents }: PiiIncidentsViewProps) {
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [decisionFilter, setDecisionFilter] = useState<string>("ALL");
  const [tableFilter, setTableFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Weekly counts calculation
  const stats = useMemo(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const weekIncidents = incidents.filter(
      (inc) => new Date(inc.createdAt) >= oneWeekAgo
    );
    const blockedCount = incidents.filter((i) => i.decision === "BLOCKED").length;
    const maskedCount = incidents.filter((i) => i.decision === "MASKED").length;
    const totalCount = incidents.length;

    return {
      thisWeek: weekIncidents.length,
      blocked: blockedCount,
      masked: maskedCount,
      total: totalCount,
    };
  }, [incidents]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return incidents.filter((row) => {
      if (riskFilter !== "ALL" && row.riskLevel !== riskFilter) return false;
      if (decisionFilter !== "ALL" && row.decision !== decisionFilter) return false;
      if (tableFilter !== "ALL" && row.sourceTable !== tableFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSurface = row.surface.toLowerCase().includes(q);
        const matchesTypes = row.detectedTypes.some((t) => t.toLowerCase().includes(q));
        const matchesActor = (row.actorEmail || row.actorUserId).toLowerCase().includes(q);
        if (!matchesSurface && !matchesTypes && !matchesActor) return false;
      }
      return true;
    });
  }, [incidents, riskFilter, decisionFilter, tableFilter, searchQuery]);

  const getRiskBadge = (level: string) => {
    switch (level) {
      case "CRITICAL":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            CRITICAL
          </span>
        );
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            HIGH
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            LOW
          </span>
        );
    }
  };

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case "BLOCKED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
            <Lock className="w-3 h-3" />
            BLOCKED
          </span>
        );
      case "MASKED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
            <Eye className="w-3 h-3" />
            MASKED
          </span>
        );
      case "CONFIRMED_SEND":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
            <AlertTriangle className="w-3 h-3" />
            CONFIRMED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
            <CheckCircle2 className="w-3 h-3" />
            LOGGED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Counts Strip ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Scanned Incidents
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Content writes scanned
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Blocked (Critical/High)
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {stats.blocked}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Strict saves prevented
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Masked On Send
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {stats.masked}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Partial redaction applied
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Incidents This Week
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.thisWeek}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Last 7 calendar days
          </div>
        </div>
      </div>

      {/* ─── Filter Bar ────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Filter PII Audit Log
            </span>
          </div>

          <div className="relative min-w-[200px] sm:min-w-[280px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by surface or PII type…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <span className="text-[11px] font-semibold text-slate-400 mr-1">Risk:</span>
          {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setRiskFilter(level)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer",
                riskFilter === level
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              {level}
            </button>
          ))}

          <span className="text-[11px] font-semibold text-slate-400 ml-3 mr-1">Decision:</span>
          {["ALL", "BLOCKED", "MASKED", "CONFIRMED_SEND", "LOGGED_ONLY"].map((dec) => (
            <button
              key={dec}
              type="button"
              onClick={() => setDecisionFilter(dec)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer",
                decisionFilter === dec
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              {dec}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Incidents List ────────────────────────────────────────────────────── */}
      {filteredRows.length === 0 ? (
        <EmptyStateCTA
          icon={ShieldAlert}
          title="No PII incidents found"
          hint="Content scanning is active across notices, messages, remarks, and leave requests. Any detected PII will be logged here."
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Surface / Table</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Detected PII Types</th>
                  <th className="py-3 px-4">Enforcement Decision</th>
                  <th className="py-3 px-4">Content Hash (SHA-256)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString("en-IN", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {row.surface}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {row.sourceTable}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getRiskBadge(row.riskLevel)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 flex-wrap">
                        {row.detectedTypes.map((type, idx) => (
                          <span
                            key={idx}
                            className="inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getDecisionBadge(row.decision)}
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-400 truncate max-w-[140px]">
                      {row.contentHash.substring(0, 16)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default PiiIncidentsView;
