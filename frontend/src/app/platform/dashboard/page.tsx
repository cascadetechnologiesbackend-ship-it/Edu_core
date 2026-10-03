import { db } from "@/db";
import { schools, students, staff, feeStructures, academicYears } from "@/db/schema";
import { count, eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Building2, Users, UserCheck, Receipt, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Multi-Tenant Platform Dashboard | SchoolMitra ERP",
  description: "Enterprise SaaS monitoring console for school tenants and system health.",
};

export default async function PlatformDashboard() {
  const [schoolCount] = await db.select({ count: count() }).from(schools);
  const [studentCount] = await db.select({ count: count() }).from(students);
  const [staffCount] = await db.select({ count: count() }).from(staff);
  const [structureCount] = await db.select({ count: count() }).from(feeStructures);

  const tenantSchools = await db.query.schools.findMany({
    orderBy: [desc(schools.createdAt)],
    limit: 10,
  });

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <ShieldCheck className="w-3.5 h-3.5" /> Multi-Tenant Control Plane
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight mt-2">
              Enterprise Platform Monitor
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Real-time monitoring across all school tenant instances, database metrics, and service status.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/platform/schools"
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition flex items-center gap-2"
            >
              <Building2 className="w-4 h-4" /> Manage Tenants
            </Link>
          </div>
        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Active School Tenants</span>
            <Building2 className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {schoolCount?.count ?? 0}
          </div>
          <p className="text-xs text-emerald-600 mt-1">100% License Active</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Total Enrolled Students</span>
            <Users className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {studentCount?.count ?? 0}
          </div>
          <p className="text-xs text-gray-500 mt-1">Across all school tenants</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Total Active Staff</span>
            <UserCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {staffCount?.count ?? 0}
          </div>
          <p className="text-xs text-emerald-600 mt-1">Teaching & Non-Teaching</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Configured Fee Matrix Slots</span>
            <Receipt className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {structureCount?.count ?? 0}
          </div>
          <p className="text-xs text-purple-600 mt-1">Class fee structures</p>
        </div>
      </div>

      {/* Tenant Instances Table */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Tenant Registrations</h2>
            <p className="text-xs text-gray-500">Overview of onboarded school tenants and UDISE codes.</p>
          </div>
          <Link
            href="/platform/schools"
            className="text-xs font-semibold text-blue-600 hover:text-blue-500 flex items-center gap-1"
          >
            View All Tenants <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800/50 text-xs text-gray-500 uppercase border-b border-gray-200 dark:border-slate-800">
              <tr>
                <th className="p-3">School Name</th>
                <th className="p-3">UDISE Code</th>
                <th className="p-3">Board</th>
                <th className="p-3">City & State</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {tenantSchools.map((school) => (
                <tr key={school.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30">
                  <td className="p-3 font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    {school.name}
                  </td>
                  <td className="p-3 text-gray-600 dark:text-slate-400 font-mono text-xs">{school.udiseCode}</td>
                  <td className="p-3 text-gray-600 dark:text-slate-400">{school.board}</td>
                  <td className="p-3 text-gray-600 dark:text-slate-400">{school.city}, {school.state}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
