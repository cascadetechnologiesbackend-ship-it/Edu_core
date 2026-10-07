export const dynamic = "force-dynamic";

import { db } from "@/db";
import { paymentGatewayLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceSubNav } from "@/components/layout/FinanceSubNav";
import { DollarSign, CheckCircle2, Clock, XCircle, ArrowUpRight, RefreshCw } from "lucide-react";
import { reconcileOnlinePayment } from "./actions";

export default async function OnlinePaymentsPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const logs = await db.query.paymentGatewayLogs.findMany({
    where: eq(paymentGatewayLogs.schoolId, session.user.schoolId),
    with: {
      invoice: true,
    },
    orderBy: [desc(paymentGatewayLogs.createdAt)],
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <FinanceSubNav activeSection="operations" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <DollarSign className="w-3.5 h-3.5" /> Gateway Infrastructure
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Online Payment Gateway Logs & Reconciliation
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Real-time audit log of Razorpay, Paytm, and Stripe webhook settlements with automatic ledger posting.
          </p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white text-base">
            Gateway Transaction Logs ({logs.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 dark:bg-slate-800/50 text-gray-500 uppercase border-b border-gray-200 dark:border-slate-800 font-semibold">
              <tr>
                <th className="p-4">Gateway & Order ID</th>
                <th className="p-4">Payment ID</th>
                <th className="p-4">Invoice No</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4 text-right">Reconciliation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-700 dark:text-slate-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    No online payment transactions recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-4">
                      <span className="font-bold text-blue-600 dark:text-blue-400">{log.gateway}</span>
                      <p className="text-gray-400 font-mono text-[11px]">{log.gatewayOrderId || "N/A"}</p>
                    </td>
                    <td className="p-4 font-mono font-medium">
                      {log.gatewayPaymentId || "Pending"}
                    </td>
                    <td className="p-4 font-mono">
                      {log.invoice?.invoiceNumber || "N/A"}
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-gray-900 dark:text-white text-sm">
                        ₹{parseFloat(log.amount).toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          log.status === "PAID"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : log.status === "FAILED"
                            ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {new Date(log.createdAt).toLocaleDateString("en-IN")}{" "}
                      <span className="text-gray-400 text-[11px]">
                        {new Date(log.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {log.status === "PAID" && (
                        <form
                          action={async () => {
                            "use server";
                            await reconcileOnlinePayment(log.id);
                          }}
                        >
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 text-xs font-semibold transition"
                          >
                            <RefreshCw className="w-3 h-3" /> Settle to Ledger
                          </button>
                        </form>
                      )}
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
