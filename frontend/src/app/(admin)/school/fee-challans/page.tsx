export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeChallans, feeInvoices, students } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { decryptData } from "@/lib/encryption";
import { FinanceSubNav } from "@/components/layout/FinanceSubNav";
import { FileText, Printer, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { clearChallan } from "./actions";

export default async function FeeChallansPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const challans = await db.query.feeChallans.findMany({
    where: eq(feeChallans.schoolId, session.user.schoolId),
    with: {
      student: true,
      invoice: {
        with: {
          feeStructure: {
            with: {
              feeHead: true,
            },
          },
        },
      },
    },
    orderBy: [desc(feeChallans.createdAt)],
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <FinanceSubNav activeSection="operations" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <FileText className="w-3.5 h-3.5" /> Offline Banking Operations
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Bank Fee Challans
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Offline 3-part bank deposit challan generator (Student Copy, School Copy, Bank Copy) and settlement clearance.
          </p>
        </div>
      </div>

      {/* Challans Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white text-base">
            Bank Challans Register ({challans.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 dark:bg-slate-800/50 text-gray-500 uppercase border-b border-gray-200 dark:border-slate-800 font-semibold">
              <tr>
                <th className="p-4">Challan Number</th>
                <th className="p-4">Student</th>
                <th className="p-4">Invoice & Head</th>
                <th className="p-4">Due Date</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-700 dark:text-slate-300">
              {challans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    No bank challans generated yet.
                  </td>
                </tr>
              ) : (
                challans.map((ch) => {
                  const studentName = `${decryptData(ch.student?.firstNameEncrypted) || ""} ${decryptData(ch.student?.lastNameEncrypted) || ""}`.trim() || "Student";
                  return (
                    <tr key={ch.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4 font-mono font-bold text-gray-900 dark:text-white">
                        {ch.challanNumber}
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-gray-900 dark:text-white">{studentName}</p>
                        <p className="text-gray-400">Adm: #{ch.student?.admissionNumber}</p>
                      </td>
                      <td className="p-4">
                        <span className="font-medium">{ch.invoice?.feeStructure?.feeHead?.name || "Tuition Fee"}</span>
                        <p className="text-gray-400 font-mono text-[11px]">{ch.invoice?.invoiceNumber}</p>
                      </td>
                      <td className="p-4">
                        {new Date(ch.dueDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="p-4 font-bold text-gray-900 dark:text-white">
                        ₹{parseFloat(ch.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            ch.status === "CLEARED"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                          }`}
                        >
                          {ch.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {ch.status !== "CLEARED" ? (
                            <form
                              action={async (formData) => {
                                "use server";
                                await clearChallan(formData);
                              }}
                            >
                              <input type="hidden" name="challanId" value={ch.id} />
                              <button
                                type="submit"
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition"
                              >
                                Mark Cleared
                              </button>
                            </form>
                          ) : (
                            <span className="text-emerald-600 text-xs font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Cleared
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
