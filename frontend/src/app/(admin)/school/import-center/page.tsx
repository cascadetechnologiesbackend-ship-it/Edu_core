export const dynamic = "force-dynamic";

import { db } from "@/db";
import { academicYears } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { UploadCloud, Sparkles } from "lucide-react";
import { ImportCenterClient } from "./ImportCenterClient";

export default async function ImportCenterPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const allYears = await db.query.academicYears.findMany({
    where: eq(academicYears.schoolId, schoolId),
    orderBy: [desc(academicYears.startDate)],
  });

  return (
    <div className="space-y-6">
      <FinanceTabs activeSection="finance" />

      {/* Header Banner - Law 1: H1 names the job */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <UploadCloud className="w-3.5 h-3.5" /> Day One Onboarding Gate
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Import students, staff, and opening fee balances
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Resilient real-world bulk onboarding: accept messy Excel/CSV files with row-level error reporting, zero duplicates, and actionable clerk correction.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Charter BR4: Row-level resilience enabled</span>
        </div>
      </div>

      <ImportCenterClient
        academicYears={allYears.map((y) => ({
          id: y.id,
          name: y.label,
          isActive: y.isActive,
        }))}
      />
    </div>
  );
}
