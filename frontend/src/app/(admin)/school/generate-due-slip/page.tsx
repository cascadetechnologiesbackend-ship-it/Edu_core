export const dynamic = "force-dynamic";

import { db } from "@/db";
import { classes, academicYears } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { QuickActionBar } from "@/components/finance/QuickActionBar";
import { FileText, Printer, CheckCircle2, History } from "lucide-react";
import Link from "next/link";
import { createDueSlipBatch } from "./actions";

export default async function GenerateDueSlipPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const [activeYear, allClasses] = await Promise.all([
    db.query.academicYears.findFirst({
      where: and(eq(academicYears.schoolId, schoolId), eq(academicYears.isActive, true)),
    }),
    db.query.classes.findMany({
      where: eq(classes.schoolId, schoolId),
      orderBy: [asc(classes.sortOrder)],
    }),
  ]);

  if (!activeYear) return <div>No active academic session found.</div>;

  return (
    <div className="space-y-6">
      <FinanceTabs activeSection="finance" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <FileText className="w-3.5 h-3.5" /> Operations & Due Slips
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Generate Fee Due Slips (Demand Notes)
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Batch-generate official printable student fee demand notes with fee breakdowns and payment instructions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/school/due-slip-history"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-800 dark:text-slate-200 text-xs font-semibold transition"
          >
            <History className="w-4 h-4" /> Batch History &rarr;
          </Link>
          <QuickActionBar userRole={session.user.role} />
        </div>
      </div>

      <div className="max-w-2xl bg-white dark:bg-slate-900 p-8 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" /> New Demand Slip Generation Batch
        </h2>

        <form
          action={async (formData) => {
            "use server";
            await createDueSlipBatch(formData);
          }}
          className="space-y-4"
        >
          <input type="hidden" name="academicYearId" value={activeYear.id} />

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
              Select Class / Section
            </label>
            <select
              name="classId"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
            >
              <option value="ALL">Entire School (All Classes)</option>
              {allClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <p className="font-semibold">Batch Generation Details:</p>
            <p>
              Demand notes include student admission details, class, fee head breakdowns, overdue fines, and the bank payment QR code. 3 slips are formatted per A4 page.
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition shadow-lg flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" /> Generate Batch Slips
          </button>
        </form>
      </div>
    </div>
  );
}
