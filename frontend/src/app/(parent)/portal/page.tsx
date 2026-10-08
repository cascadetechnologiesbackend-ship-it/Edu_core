import { db } from "@/db";
import { feeInvoices, students, feePayments, auditLogs } from "@/db/schema";
import { eq, desc, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { decryptData } from "@/lib/encryption";
import { getStudentAdvanceBalance } from "@/lib/advanceFeesEngine";
import { CheckoutButton } from "./CheckoutButton";
import Link from "next/link";
import {
  CreditCard,
  Receipt,
  FileText,
  Calendar,
  AlertCircle,
  Download,
  ChevronRight,
  ShieldCheck,
  Award,
  Wallet,
} from "lucide-react";

export default async function ParentFeesPage({
  searchParams,
}: {
  searchParams?: { tab?: string; invoiceId?: string };
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-center text-xs text-slate-400">
        Please log in to view fees.
      </div>
    );
  }

  const parentUserId = session.user.id;
  const isAdmin = ["ADMIN", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(
    session.user.role
  );

  // Find students linked to this parent (primary_parent_user_id)
  let myStudents = await db.query.students.findMany({
    where: eq(students.primaryParentUserId, parentUserId),
  });

  // If Admin and no students, fetch a demo student for preview
  if (myStudents.length === 0 && isAdmin) {
    const demoStudent = await db.query.students.findFirst({
      where: isNotNull(students.primaryParentUserId),
    });
    if (demoStudent) myStudents = [demoStudent];
  }

  if (myStudents.length === 0) {
    return (
      <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-6 text-center space-y-2">
        <h2 className="text-base font-bold text-rose-400">Access Restricted</h2>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          No students are currently linked to your parent profile. Please contact the school administration office to verify your account linkage.
        </p>
      </div>
    );
  }

  // Fetch dues and history
  const allInvoices: any[] = [];
  const allPayments: any[] = [];

  for (const student of myStudents) {
    // DPDP AUDIT LOGGING
    await db.insert(auditLogs).values({
      schoolId: student.schoolId,
      userId: parentUserId,
      userEmail: session.user.email || "unknown@parent",
      userRole: "PARENT",
      action: "READ",
      tableName: "fee_invoices",
      recordId: student.id,
      ipAddress: "127.0.0.1",
      userAgent: "ParentPortal",
      metadata: { note: "Parent viewed student fee ledger" },
    });

    const studentInvoices = await db.query.feeInvoices.findMany({
      where: eq(feeInvoices.studentId, student.id),
      with: { feeStructure: { with: { feeHead: true } } },
      orderBy: [desc(feeInvoices.dueDate)],
    });

    allInvoices.push(...studentInvoices.map((i) => ({ ...i, student })));

    const studentPayments = await db.query.feePayments.findMany({
      where: eq(feePayments.studentId, student.id),
      orderBy: [desc(feePayments.paymentDate)],
    });

    allPayments.push(...studentPayments.map((p) => ({ ...p, student })));
  }

  let totalAdvanceBalance = 0;
  for (const student of myStudents) {
    try {
      const adv = await getStudentAdvanceBalance(student.schoolId, student.id, db);
      totalAdvanceBalance += adv.creditBalance;
    } catch {
      // ignore
    }
  }

  const pendingInvoices = allInvoices.filter((i) =>
    ["PENDING", "PARTIAL", "OVERDUE"].includes(i.status)
  );

  return (
    <div className="space-y-6">
      {/* ─── 1. Header & Section Title ──────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Fee Management
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            View current tuition dues, term invoices, and payment receipts.
          </p>
        </div>

        {/* ─── Dedicated Horizontal Pill Tabs (No Squashing!) ───────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="px-3.5 py-2 rounded-xl font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/30 whitespace-nowrap">
            Fees &amp; Dues
          </span>
          <Link
            href="/portal/report-cards"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Report Cards
          </Link>
          <Link
            href="/portal/consent"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Consent Center
          </Link>
          <Link
            href="/portal/rights"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Subject Rights
          </Link>
        </div>
      </div>

      {/* ─── Wallet / Advance Credit Card ──────────────────────────────────── */}
      {totalAdvanceBalance > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
              <Wallet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Unallocated Fee Advance / Wallet</div>
              <div className="text-[11px] text-slate-400">
                Available credit automatically applied to upcoming term fees
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-base sm:text-lg font-black text-emerald-400">
              ₹{totalAdvanceBalance.toFixed(2)}
            </div>
            <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">
              Credit Active
            </span>
          </div>
        </div>
      )}

      {/* ─── 2. Outstanding Invoices & Dues ─────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-sm p-4 sm:p-5 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Current Outstanding Invoices ({pendingInvoices.length})
            </h2>
          </div>
        </div>

        {pendingInvoices.length === 0 ? (
          <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-6 text-center text-xs text-emerald-300">
            All fees are fully cleared. No outstanding dues found!
          </div>
        ) : (
          <div className="space-y-3">
            {pendingInvoices.map((inv) => {
              const fName = decryptData(inv.student.firstNameEncrypted) || "Student";
              const feeHeadName = (inv.feeStructure?.feeHead as any)?.name || "Academic Fee";
              const balanceAmt = parseFloat(inv.balanceAmount || "0");
              const isTargeted = Boolean(searchParams?.invoiceId && searchParams.invoiceId === inv.id);

              return (
                <div
                  key={inv.id}
                  className={`rounded-2xl border ${
                    isTargeted
                      ? "border-indigo-500 ring-2 ring-indigo-500/50 bg-indigo-950/20"
                      : "border-slate-800/90 bg-slate-950/60"
                  } p-4 space-y-3 transition hover:border-slate-700`}
                >
                  {/* Top Row: Ward name, Fee Head, and Amount */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                        <span>{fName} — {feeHeadName}</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                          {inv.term}
                        </span>
                        {isTargeted && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                            Deep-Link Target
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span>Invoice: <strong className="text-slate-300">{inv.invoiceNumber}</strong></span>
                        <span>•</span>
                        <span>Due: <strong className="text-slate-300">{new Date(inv.dueDate).toLocaleDateString()}</strong></span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-base sm:text-lg font-black text-rose-400">
                        ₹{balanceAmt.toFixed(2)}
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400">
                        Balance Due
                      </span>
                    </div>
                  </div>

                  {/* Middle Row: Breakdown Chips */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                    <div className="bg-slate-900/80 border border-slate-800/60 rounded-xl p-2 text-center">
                      <span className="text-slate-400 block text-[10px]">Gross</span>
                      <span className="font-semibold text-white">₹{inv.grossAmount}</span>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800/60 rounded-xl p-2 text-center">
                      <span className="text-slate-400 block text-[10px]">Discount</span>
                      <span className="font-semibold text-emerald-400">₹{inv.discountAmount}</span>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800/60 rounded-xl p-2 text-center">
                      <span className="text-slate-400 block text-[10px]">Late Fee</span>
                      <span className="font-semibold text-amber-400">₹{inv.lateFeeAmount}</span>
                    </div>
                  </div>

                  {/* Bottom Action: Pay Online Button */}
                  <div className="pt-1">
                    <CheckoutButton
                      invoiceId={inv.id}
                      amount={balanceAmt}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold text-xs transition shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── 3. Payment History ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-sm p-4 sm:p-5 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Payment History ({allPayments.length})
            </h2>
          </div>
        </div>

        {allPayments.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            No payment transaction records found.
          </p>
        ) : (
          <>
            {/* Mobile View: Clean Receipt Cards (<640px) */}
            <div className="space-y-2.5 sm:hidden">
              {allPayments.map((p) => {
                const fName = decryptData(p.student.firstNameEncrypted) || "Student";
                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-white">{fName}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Receipt #{p.receiptNumber}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-400 text-sm">
                          ₹{p.amountPaid}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(p.paymentDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300">
                        {p.paymentMethod}
                      </span>
                      <a
                        href={`/api/receipt/${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> Download PDF
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop / Tablet View: Well-Spaced Table (>=640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">Date</th>
                    <th className="pb-3 font-semibold">Student</th>
                    <th className="pb-3 font-semibold">Receipt No</th>
                    <th className="pb-3 font-semibold">Method</th>
                    <th className="pb-3 font-semibold text-right">Amount Paid</th>
                    <th className="pb-3 font-semibold text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {allPayments.map((p) => {
                    const fName = decryptData(p.student.firstNameEncrypted) || "Student";
                    return (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 text-slate-300">
                          {new Date(p.paymentDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 font-medium text-white">{fName}</td>
                        <td className="py-3 font-mono text-slate-400">{p.receiptNumber}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300">
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 text-right font-bold text-emerald-400">
                          ₹{p.amountPaid}
                        </td>
                        <td className="py-3 text-right">
                          <a
                            href={`/api/receipt/${p.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" /> PDF
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
