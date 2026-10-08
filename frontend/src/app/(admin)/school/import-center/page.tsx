export const dynamic = "force-dynamic";

import { db } from "@/db";
import { academicYears } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { UploadCloud, FileSpreadsheet, Sparkles } from "lucide-react";
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

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <UploadCloud className="w-3.5 h-3.5" /> Data Migration Center
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Import Center (Legacy Fee Balances & Records)
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Batch-upload historical student fee balances, migration invoices, and external accounting records via standardized CSV files.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-800">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Automatic audit trail generated per row</span>
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
