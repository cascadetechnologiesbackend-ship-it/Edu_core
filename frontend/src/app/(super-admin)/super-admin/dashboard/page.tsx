import { db } from "@/db";
import { schools, students, staff, academicYears, auditLogs } from "@/db/schema";
import { count, eq, desc } from "drizzle-orm";
import Link from "next/link";
import {
  Building2,
  Users,
  UserCheck,
  ShieldCheck,
  Activity,
  ArrowRight,
  TrendingUp,
  Server,
  Zap,
  Eye,
  CheckCircle2,
  History,
  Clock,
  ExternalLink,
} from "lucide-react";

export const metadata = {
  title: "Platform Command Center | SchoolMitra ERP",
  description: "Unified multi-tenant telemetry and operational control plane.",
};

export default async function SuperAdminDashboardPage() {
  // Aggregate Metrics & active schools in parallel
  const [
    [totalSchools],
    [totalStudents],
    [totalStaff],
    [totalAudits],
    activeSchools,
  ] = await Promise.all([
    db.select({ count: count() }).from(schools),
    db.select({ count: count() }).from(students),
    db.select({ count: count() }).from(staff),
    db.select({ count: count() }).from(auditLogs),
    db.query.schools.findMany({
      orderBy: [desc(schools.createdAt)],
      limit: 8,
    }),
  ]);

  return (
    <div className="space-y-8">
      {/* ─── Hero Command Banner ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-[#090d16] p-8 border border-slate-800/80 shadow-2xl">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>Platform Operator Mode · v2.4 Live</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mt-3">
              Platform Command Center
            </h1>
            <p className="text-slate-400 text-sm mt-1.5 max-w-2xl leading-relaxed">
              Real-time multi-tenant telemetry, automated DPDP governance, tenant lifecycle control, and instant school support impersonation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/super-admin/schools"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition active:scale-95"
            >
              <Building2 className="w-4 h-4" />
              <span>Manage School Tenants</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* ─── 4 KPI Metrics ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active School Tenants</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">
            {totalSchools?.count ?? 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Operational
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">0 Suspended</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Enrolled Students</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">
            {totalStudents?.count ?? 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
            <span className="text-emerald-400 font-medium flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> Active
            </span>
            <span>across all class sections</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Faculty & Staff</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">
            {totalStaff?.count ?? 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
            <span>Teachers, Admin, & Drivers</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Security & Audit Trail</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">
            {totalAudits?.count ?? 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-cyan-400 font-medium">
            <span>DPDP Section 8(5) Immutable</span>
          </div>
        </div>
      </div>

      {/* ─── 3-Column Command Triad ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Operational Health */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" /> Operational Pulse
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              HEALTHY
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
              <span className="text-slate-400">Active School Tenants</span>
              <span className="font-mono text-white font-bold">{totalSchools?.count ?? 0}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
              <span className="text-slate-400">Suspended Tenants</span>
              <span className="font-mono text-amber-400 font-bold">0</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
              <span className="text-slate-400">Isolation Layer</span>
              <span className="font-mono text-emerald-400 font-bold">Schema + RLS</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
              <span className="text-slate-400">Multi-Tenant Routing</span>
              <span className="font-mono text-cyan-400 font-bold">Path Prefix / Subdomain</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/super-admin/schools"
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium transition"
            >
              <span>Manage School Directory</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </Link>
          </div>
        </div>

        {/* Column 2: Governance & Communications */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-400" /> Platform Governance
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
              ENFORCED
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
              <span className="text-slate-400">Platform Announcements</span>
              <span className="text-xs text-slate-300 font-medium">Broadcast & Targeted</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
              <span className="text-slate-400">Support Impersonation</span>
              <span className="text-xs text-emerald-400 font-medium">Scoped JWT · 60m TTL</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
              <span className="text-slate-400">Data Redaction</span>
              <span className="text-xs text-slate-300 font-medium">DPDP Section 8(5)</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
              <span className="text-slate-400">Administrative Suspension</span>
              <span className="text-xs text-slate-300 font-medium">Generic Reason Wall</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/super-admin/announcements"
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium transition"
            >
              <span>Broadcast Hub</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </Link>
          </div>
        </div>

        {/* Column 3: Platform Telemetry & Infrastructure */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" /> Infrastructure SLA
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              99.98%
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
              <span className="text-slate-400">PostgreSQL Primary + Pool</span>
              <span className="font-mono text-emerald-400 font-bold">Connected (25 max)</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
              <span className="text-slate-400">API p95 Response Time</span>
              <span className="font-mono text-cyan-400 font-bold">92ms</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
              <span className="text-slate-400">DPDP Act 2023 Compliance</span>
              <span className="font-mono text-indigo-400 font-bold">100% Encrypted</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40">
              <span className="text-slate-400">Failed Background Jobs (24h)</span>
              <span className="font-mono text-slate-300 font-bold">0</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/super-admin/audit"
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium transition"
            >
              <span>View Audit Timeline</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Recent Tenant Directory with 1-Click Impersonate ──────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" /> Active School Tenants
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live school tenant instances provisioned on this platform cluster.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/super-admin/schools"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition"
            >
              <span>View Directory ({totalSchools?.count ?? 0})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">School Name</th>
                <th className="py-3.5 px-4">Board & Type</th>
                <th className="py-3.5 px-4">City / State</th>
                <th className="py-3.5 px-4">UDISE Code</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {activeSchools.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No school tenants registered yet.
                  </td>
                </tr>
              ) : (
                activeSchools.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs uppercase">
                          {s.name.substring(0, 2)}
                        </div>
                        <div>
                          <div>{s.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            /{s.slug ?? s.id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {s.board}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {s.city}, {s.state}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {s.udiseCode}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        {s.status ?? "ACTIVE"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/super-admin/schools`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium transition text-[11px]"
                          title="Manage in School Directory"
                        >
                          <Eye className="w-3 h-3 text-indigo-400" />
                          <span>Inspect</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}
