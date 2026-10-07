export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeDueSlips } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceSubNav } from "@/components/layout/FinanceSubNav";
import { History, Printer, FileText, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default async function DueSlipHistoryPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const slips = await db.query.feeDueSlips.findMany({
    where: eq(feeDueSlips.schoolId, session.user.schoolId),
    with: {
      class: true,
      academicYear: true,
      generatedBy: true,
    },
    orderBy: [desc(feeDueSlips.createdAt)],
  });

  return (
    <div className="space-y-6">
      <FinanceSubNav activeSection="audit" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <History className="w-3.5 h-3.5" /> Processing & Audit
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Due Slip Batch History
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Archive of previously generated demand note batches, delivery records, and printable batch demand slips.
          </p>
        </div>

        <Link
          href="/school/generate-due-slip"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
        >
          <FileText className="w-4 h-4" /> Generate New Batch
        </Link>
      </div>

      {/* Slips History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white text-base">
            Generated Demand Batches ({slips.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 dark:bg-slate-800/50 text-gray-500 uppercase border-b border-gray-200 dark:border-slate-800 font-semibold">
              <tr>
                <th className="p-4">Batch Number</th>
                <th className="p-4">Class Target</th>
                <th className="p-4">Academic Session</th>
                <th className="p-4">Slips Count</th>
                <th className="p-4">Generated At</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-700 dark:text-slate-300">
              {slips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    No due slip batches generated yet.
                  </td>
                </tr>
              ) : (
                slips.map((batch) => (
                  <tr key={batch.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-4 font-mono font-bold text-gray-900 dark:text-white">
                      {batch.batchNumber}
                    </td>
                    <td className="p-4 font-medium">
                      {batch.class?.displayName || "Entire School (All Classes)"}
                    </td>
                    <td className="p-4">
                      {batch.academicYear?.label || "All Sessions"}
                    </td>
                    <td className="p-4 font-bold text-blue-600 dark:text-blue-400">
                      {batch.slipCount} Demand Slips
                    </td>
                    <td className="p-4">
                      {new Date(batch.createdAt).toLocaleDateString("en-IN")}{" "}
                      <span className="text-gray-400 text-[11px]">
                        {new Date(batch.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        {batch.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-slate-200 font-medium transition"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print Batch
                      </button>
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
