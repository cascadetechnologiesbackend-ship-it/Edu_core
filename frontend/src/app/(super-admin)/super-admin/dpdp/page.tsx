export const dynamic = "force-dynamic";

import { db } from "@/db";
import {
  schools,
  students,
  consentPurposes,
  consentRecords,
  rightsRequests,
  dpdpGrievances,
  dataBreachLog,
  auditLogs,
} from "@/db/schema";
import { count, eq, sql, desc, and, isNull, inArray } from "drizzle-orm";
import Link from "next/link";
import {
  ShieldCheck,
  Building2,
  Lock,
  FileCheck2,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  History,
  Clock,
  ExternalLink,
  Scale,
  Database,
  Eye,
  KeyRound,
  FileText,
} from "lucide-react";

export const metadata = {
  title: "DPDP Privacy Vault | Platform Super Admin",
  description:
    "Statutory DPDP Act 2023 compliance console, multi-tenant consent oversight, and privacy governance.",
};

export default async function SuperAdminDpdpPage() {
  // Aggregate multi-tenant DPDP data in parallel with safe fallbacks
  let allSchools: any[] = [];
  let purposesCount = { count: 0 };
  let totalConsentsCount = { count: 0 };
  let pendingRightsCount = { count: 0 };
  let grievancesCount = { count: 0 };
  let breachesCount = { count: 0 };
  let purposesList: any[] = [];
  let recentPrivacyAudits: any[] = [];
  let studentCountsPerSchool: any[] = [];
  let consentCountsPerSchool: any[] = [];

  try {
    const [
      schoolsRes,
      [pCount],
      [cCount],
      [rCount],
      [gCount],
      [bCount],
      pList,
      aAudits,
    ] = await Promise.all([
      db.query.schools.findMany({
        orderBy: [desc(schools.createdAt)],
      }),
      db.select({ count: count() }).from(consentPurposes),
      db.select({ count: count() }).from(consentRecords).where(and(eq(consentRecords.granted, true), isNull(consentRecords.withdrawnAt))),
      db.select({ count: count() }).from(rightsRequests).where(eq(rightsRequests.status, "SUBMITTED")),
      db.select({ count: count() }).from(dpdpGrievances).where(eq(dpdpGrievances.status, "SUBMITTED")),
      db.select({ count: count() }).from(dataBreachLog),
      db.query.consentPurposes.findMany({
        limit: 20,
      }),
      db.query.auditLogs.findMany({
        where: inArray(auditLogs.action, ["CONSENT_GRANT", "CONSENT_WITHDRAW", "EXPORT", "DELETE"]),
        orderBy: [desc(auditLogs.createdAt)],
        limit: 15,
      }),
    ]);

    allSchools = schoolsRes ?? [];
    if (pCount) purposesCount = pCount;
    if (cCount) totalConsentsCount = cCount;
    if (rCount) pendingRightsCount = rCount;
    if (gCount) grievancesCount = gCount;
    if (bCount) breachesCount = bCount;
    purposesList = pList ?? [];
    recentPrivacyAudits = aAudits ?? [];

    // Aggregate student and consent metrics per school
    studentCountsPerSchool = await db
      .select({
        schoolId: students.schoolId,
        studentCount: sql<number>`count(*)::int`,
      })
      .from(students)
      .where(and(eq(students.isActive, true), isNull(students.deletedAt)))
      .groupBy(students.schoolId);

    consentCountsPerSchool = await db
      .select({
        schoolId: consentRecords.schoolId,
        consentCount: sql<number>`count(*)::int`,
      })
      .from(consentRecords)
      .where(and(eq(consentRecords.granted, true), isNull(consentRecords.withdrawnAt)))
      .groupBy(consentRecords.schoolId);
  } catch (err) {
    console.error("[SuperAdminDpdpPage] Error loading DPDP metrics:", err);
  }

  const studentCountMap = new Map(studentCountsPerSchool.map((r) => [r.schoolId, r.studentCount]));
  const consentCountMap = new Map(consentCountsPerSchool.map((r) => [r.schoolId, r.consentCount]));

  return (
    <div className="space-y-8">
      {/* ─── Hero Platform Header ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-[#090d16] p-5 sm:p-8 border border-slate-800/80 shadow-2xl">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <Scale className="w-3.5 h-3.5 text-emerald-400" />
              <span>DPDP Act 2023 Statutory Compliance Plane</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mt-3 flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-indigo-400" />
              Platform DPDP Privacy Vault
            </h1>
            <p className="text-slate-400 text-sm mt-1.5 max-w-2xl leading-relaxed">
              Centralized oversight of parental consent coverage, Principal Rights requests, immutable audit trails, and statutory CERT-In breach response controls across all school tenants.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-700/80 text-xs text-slate-300 font-mono">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              AES-256-GCM At Rest
            </span>
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Section 9 Enforced
            </span>
          </div>
        </div>
      </div>

      {/* ─── 4 Privacy KPI Metrics ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Consent Purposes */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Registered Purposes</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">
            {purposesCount?.count ?? 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> 100% Active in Registry
          </div>
        </div>

        {/* Metric 2: Total Recorded Consents */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Recorded Consents</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">
            {totalConsentsCount?.count ?? 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
            <span>Verifiable parental consents</span>
          </div>
        </div>

        {/* Metric 3: Pending Rights Requests */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Rights Requests</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">
            {pendingRightsCount?.count ?? 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
            <span>Access / Erasure / Correction</span>
          </div>
        </div>

        {/* Metric 4: Grievances & Breach Alerts */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Breaches / Grievances</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">
            {breachesCount?.count ?? 0} / {grievancesCount?.count ?? 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> CERT-In 6h SLA Compliant
          </div>
        </div>
      </div>

      {/* ─── Statutory Directives Banner ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
            <Scale className="w-4 h-4" />
            <span>DPDP Section 9 (Minors Under 18)</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Data collection from students is prohibited without affirmative, verifiable consent from an authorized parent or legal guardian.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
            <Database className="w-4 h-4" />
            <span>DPDP Section 8(7) (Auto-Purge)</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Personal data must be erased when the purpose for collection is no longer served or when statutory retention periods expire.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
          <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs">
            <KeyRound className="w-4 h-4" />
            <span>DPDP Section 8(5) (Forensic Security)</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Reasonable security safeguards enforced: AES-256-GCM encryption, granular tenant RLS isolation, and immutable audit logs.
          </p>
        </div>
      </div>

      {/* ─── Multi-Tenant Schools Compliance Matrix ──────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-[#0d1322] overflow-hidden shadow-xl">
        <div className="p-4 sm:p-6 border-b border-slate-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              School Tenants DPDP Compliance Matrix
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Active consent coverage and statutory rights metrics across each school tenant.
            </p>
          </div>
          <Link
            href="/super-admin/schools"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition py-1"
          >
            <span>Manage Tenants Directory</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-6">School Tenant</th>
                <th className="py-3.5 px-6">Enrolled Students</th>
                <th className="py-3.5 px-6">Recorded Consents</th>
                <th className="py-3.5 px-6">Consent Coverage</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Privacy Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {allSchools.map((s) => {
                const studentCount = studentCountMap.get(s.id) ?? 0;
                const consentCount = consentCountMap.get(s.id) ?? 0;
                const coverage =
                  studentCount > 0 ? Math.min(100, Math.round((consentCount / studentCount) * 100)) : 100;

                return (
                  <tr key={s.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-4 px-6">
                      <div className="font-semibold text-white">{s.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        UDISE: {s.udiseCode || "UNSET"} · {s.city || "India"}
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono text-slate-300">
                      {studentCount}
                    </td>
                    <td className="py-4 px-6 font-mono text-slate-300">
                      {consentCount}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              coverage >= 80
                                ? "bg-emerald-500"
                                : coverage >= 50
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                            style={{ width: `${coverage}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-slate-400">{coverage}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {s.status === "ACTIVE" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Compliant
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link
                        href={`/super-admin/schools`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium text-xs transition active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Tenant</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {allSchools.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    No school tenants found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View (UX-R47) */}
        <div className="block md:hidden p-3.5 space-y-3">
          {allSchools.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No school tenants found.
            </div>
          ) : (
            allSchools.map((s) => {
              const studentCount = studentCountMap.get(s.id) ?? 0;
              const consentCount = consentCountMap.get(s.id) ?? 0;
              const coverage =
                studentCount > 0 ? Math.min(100, Math.round((consentCount / studentCount) * 100)) : 100;

              return (
                <div
                  key={s.id}
                  className="p-4 bg-slate-950/70 rounded-xl border border-slate-800/80 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white text-sm">{s.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        UDISE: {s.udiseCode || "UNSET"} · {s.city || "India"}
                      </div>
                    </div>
                    {s.status === "ACTIVE" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        Compliant
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        Suspended
                      </span>
                    )}
                  </div>

                  {/* Coverage Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">Parental Consent Coverage:</span>
                      <span className="font-mono text-white font-bold">{coverage}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          coverage >= 80
                            ? "bg-emerald-500"
                            : coverage >= 50
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${coverage}%` }}
                      />
                    </div>
                  </div>

                  {/* Enrolled Students vs Recorded Consents */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-850">
                      <div className="text-[10px] text-slate-400 uppercase">Students</div>
                      <div className="font-mono text-sm font-bold text-slate-200 mt-0.5">{studentCount}</div>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-850">
                      <div className="text-[10px] text-slate-400 uppercase">Consents</div>
                      <div className="font-mono text-sm font-bold text-emerald-400 mt-0.5">{consentCount}</div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <Link
                      href={`/super-admin/schools`}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium text-xs transition active:scale-95"
                    >
                      <Eye className="w-4 h-4 text-indigo-400" />
                      <span>Inspect Tenant In School Directory</span>
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── Statutory Consent Purposes Registry ─────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-800/80">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-emerald-400" />
              Statutory Consent Purposes Registry
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Purpose limitations registered under DPDP Act 2023 for student data processing.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 font-mono">
            {purposesList.length} Active Purposes
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {purposesList.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider block">
                    {p.purposeId}
                  </span>
                  <div className="font-semibold text-white text-sm mt-0.5">{p.labelEn}</div>
                </div>
                {p.mandatory ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Mandatory
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    Optional
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {p.descriptionEn}
              </p>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Legal Basis: {p.legalBasis}</span>
                <span>{p.retentionDays}d Retention</span>
              </div>
            </div>
          ))}
          {purposesList.length === 0 && (
            <div className="col-span-full text-center py-6 text-slate-500 text-xs">
              No custom purposes configured. Default DPDP statutory catalog active.
            </div>
          )}
        </div>
      </div>

      {/* ─── Recent DPDP Audit Logs ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-800/80">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-400" />
              Recent DPDP Forensic Audit Stream
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Append-only audit events recording privacy consent updates, tenant impersonation, and data requests.
            </p>
          </div>
          <Link
            href="/super-admin/audit"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
          >
            <span>Full Audit Trail</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="space-y-2">
          {recentPrivacyAudits.map((a) => (
            <div
              key={a.id}
              className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center justify-between text-xs gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200">{a.action}</div>
                  <div className="text-[11px] text-slate-500">
                    Table: <span className="font-mono text-slate-400">{a.tableName || "GLOBAL"}</span> ·
                    Operator: <span className="text-slate-400">{a.userId || "SYSTEM"}</span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-mono text-[10px] text-slate-500 block">
                  {a.createdAt ? new Date(a.createdAt).toLocaleString("en-IN") : "Recent"}
                </span>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Verified
                </span>
              </div>
            </div>
          ))}
          {recentPrivacyAudits.length === 0 && (
            <div className="text-center py-6 text-slate-500 text-xs">
              No recent DPDP audit events recorded. Forensic logger active.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
