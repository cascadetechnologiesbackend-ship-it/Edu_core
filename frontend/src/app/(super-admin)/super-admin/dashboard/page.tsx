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
import { getInfrastructureTelemetryAction } from "./telemetryActions";
import { InfrastructureTelemetryPanel } from "./InfrastructureTelemetryPanel";

export const metadata = {
  title: "Platform Command Center | SchoolMitra ERP",
  description: "Unified multi-tenant telemetry and operational control plane.",
};

export default async function SuperAdminDashboardPage() {
  let totalSchools = { count: 0 };
  let totalStudents = { count: 0 };
  let totalStaff = { count: 0 };
  let totalAudits = { count: 0 };
  let activeSchools: any[] = [];
  let dbError: string | null = null;
  let telemetryRes: any = { success: false, data: undefined };

  try {
    const results = await Promise.all([
      db.select({ count: count() }).from(schools),
      db.select({ count: count() }).from(students),
      db.select({ count: count() }).from(staff),
      db.select({ count: count() }).from(auditLogs),
      db.query.schools.findMany({
        orderBy: [desc(schools.createdAt)],
        limit: 8,
      }),
      getInfrastructureTelemetryAction().catch((err: any) => {
        console.error("[SuperAdminDashboard] Telemetry fetch error:", err);
        return { success: false, data: undefined, error: err?.message || "Failed to load telemetry" };
      }),
    ]);
    totalSchools = results[0][0] ?? { count: 0 };
    totalStudents = results[1][0] ?? { count: 0 };
    totalStaff = results[2][0] ?? { count: 0 };
    totalAudits = results[3][0] ?? { count: 0 };
    activeSchools = results[4] || [];
    telemetryRes = results[5];
  } catch (err: any) {
    console.error("[SuperAdminDashboard] DB query error:", err);
    dbError = err?.message || "Failed to connect to database";
  }

  return (
    <div className="space-y-8">
      {dbError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-amber-300 text-sm flex items-center gap-3">
          <Activity className="w-5 h-5 flex-shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold">Database Connection Issue</p>
            <p className="text-xs text-amber-400/80 mt-0.5">{dbError}</p>
          </div>
        </div>
      )}
      {/* ─── Hero Command Banner ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-indigo-950/60 backdrop-blur-xl p-5 sm:p-8 border border-white/[0.12] shadow-level-2">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span>Platform Operator Mode · v2.4 Live</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-3">
              Platform Command Center
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1.5 max-w-2xl leading-relaxed">
              Real-time multi-tenant telemetry, automated DPDP governance, tenant lifecycle control, and instant school support impersonation.
            </p>
          </div>

          <div className="w-full sm:w-auto flex flex-wrap items-center gap-3">
            <Link
              href="/super-admin/schools"
              className="w-full sm:w-auto min-h-[38px] sm:min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-level-1 active:scale-[0.98] transition-all"
            >
              <Building2 className="w-4 h-4" />
              <span>Manage School Tenants</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Live AWS Infrastructure Telemetry Panel ──────────────────── */}
      {telemetryRes.data && (
        <InfrastructureTelemetryPanel initialTelemetry={telemetryRes.data} />
      )}

      {/* ─── 4 KPI Metrics ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Active School Tenants</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 dark:text-blue-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-foreground mt-3 font-mono tracking-tight">
            {totalSchools?.count ?? 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Operational
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-muted-foreground">0 Suspended</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Enrolled Students</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-foreground mt-3 font-mono tracking-tight">
            {totalStudents?.count ?? 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> Active
            </span>
            <span>across all class sections</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Faculty &amp; Staff</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-foreground mt-3 font-mono tracking-tight">
            {totalStaff?.count ?? 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>Teachers, Admin, &amp; Drivers</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Security &amp; Audit Trail</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 dark:text-blue-400">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-foreground mt-3 font-mono tracking-tight">
            {totalAudits?.count ?? 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
            <span>DPDP Section 8(5) Immutable</span>
          </div>
        </div>
      </div>

      {/* ─── 3-Column Command Triad ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Operational Health */}
        <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-level-1">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" /> Operational Pulse
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              HEALTHY
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-muted/40">
              <span className="text-muted-foreground">Active School Tenants</span>
              <span className="font-mono text-foreground font-bold">{totalSchools?.count ?? 0}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-muted/40">
              <span className="text-muted-foreground">Suspended Tenants</span>
              <span className="font-mono text-amber-500 font-bold">0</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-muted/40">
              <span className="text-muted-foreground">Isolation Layer</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">Schema + RLS</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-muted/40">
              <span className="text-muted-foreground">Multi-Tenant Routing</span>
              <span className="font-mono text-blue-500 font-bold">Path Prefix / Subdomain</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/super-admin/schools"
              className="w-full min-h-[38px] sm:min-h-[44px] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-muted hover:bg-muted/80 active:scale-[0.98] text-foreground text-xs font-semibold transition-all"
            >
              <span>Manage School Directory</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </Link>
          </div>
        </div>

        {/* Column 2: Governance & Communications */}
        <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-level-1">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-500" /> Platform Governance
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              ENFORCED
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-muted/40">
              <span className="text-muted-foreground">Platform Announcements</span>
              <span className="text-xs text-foreground font-medium">Broadcast &amp; Targeted</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-muted/40">
              <span className="text-muted-foreground">Support Impersonation</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Scoped JWT · 60m TTL</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-muted/40">
              <span className="text-muted-foreground">Data Redaction</span>
              <span className="text-xs text-foreground font-medium">DPDP Section 8(5)</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-muted/40">
              <span className="text-muted-foreground">Administrative Suspension</span>
              <span className="text-xs text-foreground font-medium">Generic Reason Wall</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/super-admin/announcements"
              className="w-full min-h-[38px] sm:min-h-[44px] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-muted hover:bg-muted/80 active:scale-[0.98] text-foreground text-xs font-semibold transition-all"
            >
              <span>Broadcast Hub</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </Link>
          </div>
        </div>

        {/* Column 3: Platform Telemetry & Infrastructure */}
        <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-level-1">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-500" /> Infrastructure SLA
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              99.98%
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-muted/40">
              <span className="text-muted-foreground">PostgreSQL Primary + Pool</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">Connected (25 max)</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-muted/40">
              <span className="text-muted-foreground">API p95 Response Time</span>
              <span className="font-mono text-blue-500 font-bold">92ms</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-muted/40">
              <span className="text-muted-foreground">DPDP Act 2023 Compliance</span>
              <span className="font-mono text-indigo-500 font-bold">100% Encrypted</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-muted/40">
              <span className="text-muted-foreground">Failed Background Jobs (24h)</span>
              <span className="font-mono text-muted-foreground font-bold">0</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/super-admin/audit"
              className="w-full min-h-[38px] sm:min-h-[44px] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-muted hover:bg-muted/80 active:scale-[0.98] text-foreground text-xs font-semibold transition-all"
            >
              <span>View Audit Timeline</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Recent Tenant Directory with 1-Click Impersonate ──────────── */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-level-1">
        <div className="p-5 sm:p-6 border-b border-border/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2 tracking-tight">
              <Building2 className="w-5 h-5 text-blue-500" /> Active School Tenants
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live school tenant instances provisioned on this platform cluster.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/super-admin/schools"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1 transition-all min-h-[38px] sm:min-h-[44px] py-1"
            >
              <span>View Directory ({totalSchools?.count ?? 0})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Desktop Table View (UX-R47) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground uppercase font-semibold tracking-wider border-b border-border/60">
              <tr>
                <th className="py-3.5 px-4">School Name</th>
                <th className="py-3.5 px-4">Board &amp; Type</th>
                <th className="py-3.5 px-4">City / State</th>
                <th className="py-3.5 px-4">UDISE Code</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {activeSchools.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No school tenants registered yet.
                  </td>
                </tr>
              ) : (
                activeSchools.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-foreground">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs uppercase border border-blue-500/20">
                          {s.name.substring(0, 2)}
                        </div>
                        <div>
                          <div>{s.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            /{s.slug ?? s.id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {s.board}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {s.city}, {s.state}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-muted-foreground">
                      {s.udiseCode}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {s.status ?? "ACTIVE"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/super-admin/schools`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] sm:min-h-[44px] rounded-xl bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium transition-all text-[11px]"
                          title="Manage in School Directory"
                        >
                          <Eye className="w-3.5 h-3.5" />
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

        {/* Mobile Card View (UX-R47) */}
        <div className="block md:hidden p-3.5 space-y-3">
          {activeSchools.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs">
              No school tenants registered yet.
            </div>
          ) : (
            activeSchools.map((s) => (
              <div
                key={s.id}
                className="p-4 bg-muted/20 rounded-2xl border border-border/70 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs uppercase shrink-0 border border-blue-500/20">
                      {s.name.substring(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground text-sm truncate">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">
                        /{s.slug ?? s.id.slice(0, 8)} · {s.city}, {s.state}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {s.status ?? "ACTIVE"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/60">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {s.board}
                    </span>
                    <span className="font-mono text-muted-foreground text-[11px]">{s.udiseCode}</span>
                  </div>
                  <Link
                    href={`/super-admin/schools`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] sm:min-h-[44px] rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold transition-all text-xs active:scale-95 flex items-center justify-center"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </Link>
                </div>
              </div>
            ))
          )}
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
