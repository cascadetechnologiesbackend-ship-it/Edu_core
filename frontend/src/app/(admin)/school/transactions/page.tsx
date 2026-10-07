export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feePayments, students, feeInvoices, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { decryptData } from "@/lib/encryption";
import { FinanceSubNav } from "@/components/layout/FinanceSubNav";
import { ListOrdered, Printer, FileDown, Ban, IndianRupee, ShieldAlert, CheckCircle2 } from "lucide-react";
import { cancelTransaction } from "./actions";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { method?: string };
}) {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const payments = await db.query.feePayments.findMany({
    where: eq(feePayments.schoolId, schoolId),
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
      collectedBy: true,
    },
    orderBy: [desc(feePayments.paymentDate)],
    limit: 100,
  });

  const filtered = searchParams.method
    ? payments.filter((p) => p.paymentMethod === searchParams.method)
    : payments;

  const totalCollected = filtered.reduce((acc, p) => acc + parseFloat(p.amountPaid), 0);

  return (
    <div className="space-y-6">
      <FinanceSubNav activeSection="operations" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <ListOrdered className="w-3.5 h-3.5" /> Operations & Transactions
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Central Fee Transactions Ledger
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Complete transaction register with receipt reprinting, PDF downloads, and audited reversal management.
          </p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-xl px-4 py-2.5 text-right">
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase">Filtered Collection Total</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-300">
            ₹{totalCollected.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
          <h3 className="font-bold text-gray-900 dark:text-white text-base">
            Recent Fee Transactions ({filtered.length})
          </h3>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">Filter Mode:</span>
            {["CASH", "UPI", "CHEQUE", "DD", "ONLINE", "NEFT"].map((mode) => (
              <a
                key={mode}
                href={`/school/transactions?method=${mode}`}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  searchParams.method === mode
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200"
                }`}
              >
                {mode}
              </a>
            ))}
            {searchParams.method && (
              <a href="/school/transactions" className="text-blue-600 underline font-medium ml-1">
                Clear
              </a>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 dark:bg-slate-800/50 text-gray-500 uppercase border-b border-gray-200 dark:border-slate-800 font-semibold">
              <tr>
                <th className="p-4">Receipt No</th>
                <th className="p-4">Student</th>
                <th className="p-4">Fee Head</th>
                <th className="p-4">Method & Ref</th>
                <th className="p-4">Date</th>
                <th className="p-4">Amount Paid</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-700 dark:text-slate-300">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    No transactions recorded matching the selected filter.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const studentName = `${decryptData(tx.student?.firstNameEncrypted) || ""} ${decryptData(tx.student?.lastNameEncrypted) || ""}`.trim() || "Student";
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4">
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {tx.receiptNumber}
                        </span>
                        <p className="text-[11px] text-gray-400 font-mono">
                          Inv: {tx.invoice?.invoiceNumber}
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-gray-900 dark:text-white">{studentName}</p>
                        <p className="text-gray-400">Adm: #{tx.student?.admissionNumber}</p>
                      </td>
                      <td className="p-4 font-medium">
                        {tx.invoice?.feeStructure?.feeHead?.name || "Tuition Fee"}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                          {tx.paymentMethod}
                        </span>
                        {tx.transactionReference && (
                          <p className="text-gray-400 text-[11px] font-mono mt-0.5">
                            Ref: {tx.transactionReference}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        {new Date(tx.paymentDate).toLocaleDateString("en-IN")}{" "}
                        <span className="text-gray-400 text-[11px]">
                          {new Date(tx.paymentDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          ₹{parseFloat(tx.amountPaid).toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`/api/receipt/${tx.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-blue-50 text-gray-600 dark:text-slate-300 hover:text-blue-600 transition"
                            title="Download Official Receipt PDF"
                          >
                            <FileDown className="w-4 h-4" />
                          </a>

                          <form
                            action={async (formData) => {
                              "use server";
                              await cancelTransaction(formData);
                            }}
                          >
                            <input type="hidden" name="paymentId" value={tx.id} />
                            <input type="hidden" name="reason" value="Cancelled by administrator" />
                            <button
                              type="submit"
                              onClick={(e) => {
                                if (!confirm(`Are you sure you want to cancel and reverse Receipt #${tx.receiptNumber}? This will restore the student's dues.`)) {
                                  e.preventDefault();
                                }
                              }}
                              className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
                              title="Cancel & Reverse Receipt"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </form>
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
