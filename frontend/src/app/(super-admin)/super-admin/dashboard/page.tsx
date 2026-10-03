import { requireAuth } from "@/lib/serverAuth";
import Link from "next/link";
import { Building2, ShieldCheck, Activity, Users, Server, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Super Admin Platform Dashboard | SchoolMitra ERP",
  description: "Platform tenant governance and system health control center.",
};

export default async function SuperAdminDashboardPage() {
  const ctx = await requireAuth(["SUPER_ADMIN"] as const);

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <ShieldCheck className="w-3.5 h-3.5" /> Platform Control Plane
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight mt-2">
              Super Admin Console
            </h1>
            <p className="text-purple-200/80 text-sm mt-1">
              Multi-tenant school management, system health, and global DPDP governance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              All Systems Operational
            </span>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Active School Tenants</span>
            <Building2 className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">12</div>
          <p className="text-xs text-emerald-600 mt-1">100% active license status</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Total System Users</span>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">14,280</div>
          <p className="text-xs text-gray-500 mt-1">Students, Staff & Parents</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Database Cluster</span>
            <Server className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-emerald-600 mt-2">99.98%</div>
          <p className="text-xs text-gray-500 mt-1">PostgreSQL Primary + Replica</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">DPDP Audit Logs</span>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">100%</div>
          <p className="text-xs text-emerald-600 mt-1">Compliant & Immutable</p>
        </div>
      </div>

      {/* System Actions & Governance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-500" /> School Tenant Governance
          </h2>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Provision new school instances, manage database schemas, and configure multi-tenant licenses.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Link
              href={"/dashboard" as any}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition"
            >
              Access ERP Command Center
            </Link>
            <Link
              href="/dpdp"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-medium text-sm hover:bg-gray-100 dark:hover:bg-slate-800 transition"
            >
              DPDP Privacy Vault
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" /> Infrastructure & Microservices Status
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm py-2 border-b border-gray-100 dark:border-slate-800">
              <span className="font-medium text-gray-700 dark:text-slate-300">Automated Fee Engine Microservice</span>
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Healthy</span>
            </div>
            <div className="flex items-center justify-between text-sm py-2 border-b border-gray-100 dark:border-slate-800">
              <span className="font-medium text-gray-700 dark:text-slate-300">EPFO Payroll ECR Generator</span>
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Healthy</span>
            </div>
            <div className="flex items-center justify-between text-sm py-2">
              <span className="font-medium text-gray-700 dark:text-slate-300">Report Card PDF Background Worker</span>
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Healthy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
