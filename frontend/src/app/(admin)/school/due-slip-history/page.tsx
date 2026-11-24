export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeDueSlips } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { QuickActionBar } from "@/components/finance/QuickActionBar";
import { History, FileText, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import PrintSlipButton from "./PrintSlipButton";

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
      <FinanceTabs activeSection="finance" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-3xl border border-border/40 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <History className="w-3.5 h-3.5" /> Operations & Due Slips
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-2">
            Due Slip Batch History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Archive of previously generated demand note batches, delivery records, and printable batch demand slips.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/school/generate-due-slip"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#248A3D] hover:bg-[#1f7232] dark:bg-[#30D158] dark:hover:bg-[#28b84d] text-white dark:text-black text-xs font-semibold shadow-sm transition"
          >
            <FileText className="w-4 h-4" /> Generate Batch &rarr;
          </Link>
          <QuickActionBar userRole={session.user.role} />
        </div>
      </div>

      {/* Slips History Table */}
      <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border/40 flex justify-between items-center">
          <h3 className="font-bold text-foreground text-base">
            Generated Demand Batches ({slips.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 dark:bg-muted/30 text-gray-500 uppercase border-b border-border/40 font-semibold">
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
            <tbody className="divide-y divide-border/40 text-foreground">
              {slips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    No due slip batches generated yet.
                  </td>
                </tr>
              ) : (
                slips.map((batch) => (
                  <tr key={batch.id} className="hover:bg-muted/40 transition">
                    <td className="p-4 font-mono font-bold text-foreground">
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
                      <PrintSlipButton />
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
