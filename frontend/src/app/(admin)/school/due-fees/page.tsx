export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeInvoices, students, classes } from "@/db/schema";
import { eq, and, inArray, desc, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { decryptData } from "@/lib/encryption";
import { FinanceSubNav } from "@/components/layout/FinanceSubNav";
import { Clock, AlertTriangle, Send, CreditCard, Filter, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { sendDueReminder } from "./actions";

export default async function DueFeesPage({
  searchParams,
}: {
  searchParams: { classId?: string; bracket?: string };
}) {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const [allClasses, pendingInvoices] = await Promise.all([
    db.query.classes.findMany({
      where: eq(classes.schoolId, schoolId),
      orderBy: [asc(classes.sortOrder)],
    }),
    db.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.schoolId, schoolId),
        inArray(feeInvoices.status, ["PENDING", "PARTIAL", "OVERDUE"]),
      ),
      with: {
        student: true,
        feeStructure: {
          with: {
            feeHead: true,
          },
        },
      },
      orderBy: [asc(feeInvoices.dueDate)],
    }),
  ]);

  const classMap = new Map(allClasses.map((c) => [c.id, c.displayName]));
  const now = new Date().getTime();

  // Calculate overdue brackets
  let totalDue = 0;
  let bracket0to30 = 0;
  let bracket31to60 = 0;
  let bracket60plus = 0;

  const items = pendingInvoices.map((inv) => {
    const dueTime = new Date(inv.dueDate).getTime();
    const daysOverdue = Math.max(0, Math.floor((now - dueTime) / (1000 * 60 * 60 * 24)));
    const balance = parseFloat(inv.balanceAmount);
    totalDue += balance;

    let ageBracket = "0-30";
    if (daysOverdue > 60) {
      ageBracket = "60+";
      bracket60plus += balance;
    } else if (daysOverdue > 30) {
      ageBracket = "31-60";
      bracket31to60 += balance;
    } else {
      bracket0to30 += balance;
    }

    const className = inv.student?.currentClassId
      ? classMap.get(inv.student.currentClassId) || "Class"
      : "Unassigned";
    const classId = inv.student?.currentClassId || "";

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      studentId: inv.studentId,
      studentName: `${decryptData(inv.student?.firstNameEncrypted) || ""} ${decryptData(inv.student?.lastNameEncrypted) || ""}`.trim() || "Student",
      admissionNumber: inv.student?.admissionNumber || "N/A",
      className,
      classId,
      feeHeadName: inv.feeStructure?.feeHead?.name || "Fee Invoice",
      dueDate: inv.dueDate,
      balanceAmount: inv.balanceAmount,
      daysOverdue,
      ageBracket,
      reminderSent: inv.reminderSentD7,
    };
  });

  // Apply filters
  const filteredItems = items.filter((item) => {
    if (searchParams.classId && item.classId !== searchParams.classId) return false;
    if (searchParams.bracket && item.ageBracket !== searchParams.bracket) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <FinanceSubNav activeSection="operations" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Operations & Defaulters
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Search Due Fees & Aging Ledger
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Track outstanding fee balances by aging brackets (0-30 days, 31-60 days, 60+ critical days) and dispatch instant reminders.
          </p>
        </div>
      </div>

      {/* Overdue Age Tracking Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Total Outstanding</p>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">
            ₹{totalDue.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-gray-400 mt-1">{items.length} Pending Invoices</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-blue-600 uppercase">Current Dues (0-30 Days)</p>
          <p className="text-2xl font-extrabold text-blue-600 mt-1">
            ₹{bracket0to30.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-gray-400 mt-1">Recent term billings</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-amber-600 uppercase">Overdue (31-60 Days)</p>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">
            ₹{bracket31to60.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-amber-600/80 mt-1">First reminder window</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-red-600 uppercase">Critical (60+ Days Overdue)</p>
          <p className="text-2xl font-extrabold text-red-600 mt-1">
            ₹{bracket60plus.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-red-500 mt-1">Requires follow-up action</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-semibold text-gray-600 dark:text-slate-300">Filters:</span>

        <Link
          href="/school/due-fees"
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
            !searchParams.classId && !searchParams.bracket
              ? "bg-blue-600 text-white"
              : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300"
          }`}
        >
          All Classes ({items.length})
        </Link>

        {allClasses.map((c) => (
          <Link
            key={c.id}
            href={`/school/due-fees?classId=${c.id}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              searchParams.classId === c.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300"
            }`}
          >
            {c.displayName}
          </Link>
        ))}
      </div>

      {/* Due Ledger Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white text-base">
            Outstanding Due Records ({filteredItems.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 dark:bg-slate-800/50 text-gray-500 uppercase border-b border-gray-200 dark:border-slate-800 font-semibold">
              <tr>
                <th className="p-4">Student</th>
                <th className="p-4">Class</th>
                <th className="p-4">Fee Head</th>
                <th className="p-4">Due Date</th>
                <th className="p-4">Overdue Age</th>
                <th className="p-4">Balance Amount</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-700 dark:text-slate-300">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    No outstanding fee dues found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-4">
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{row.studentName}</p>
                      <p className="text-gray-400">Adm: #{row.admissionNumber}</p>
                    </td>
                    <td className="p-4 font-medium">{row.className}</td>
                    <td className="p-4">
                      <span className="font-medium">{row.feeHeadName}</span>
                      <p className="text-gray-400 font-mono text-[11px]">{row.invoiceNumber}</p>
                    </td>
                    <td className="p-4">{new Date(row.dueDate).toLocaleDateString("en-IN")}</td>
                    <td className="p-4">
                      {row.daysOverdue === 0 ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                          Due Soon
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            row.daysOverdue > 60
                              ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                              : row.daysOverdue > 30
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                              : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                          }`}
                        >
                          {row.daysOverdue} Days Overdue
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-red-600 dark:text-red-400 text-sm">
                        ₹{parseFloat(row.balanceAmount).toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <form
                          action={async () => {
                            "use server";
                            await sendDueReminder(row.id);
                          }}
                        >
                          <button
                            type="submit"
                            title="Dispatch payment reminder"
                            className={`p-2 rounded-lg text-xs font-medium transition ${
                              row.reminderSent
                                ? "bg-gray-100 text-gray-400 dark:bg-slate-800"
                                : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400"
                            }`}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </form>

                        <Link
                          href={`/school/collect-fees`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition"
                        >
                          <CreditCard className="w-3 h-3" /> Collect
                        </Link>
                      </div>
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
