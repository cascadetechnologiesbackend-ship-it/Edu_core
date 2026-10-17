export const dynamic = "force-dynamic";

import React from "react";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import {
  students,
  feeInvoices,
  feePayments,
} from "@/db/schema";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import Link from "next/link";
import {
  Receipt,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowLeft,
  CreditCard,
} from "lucide-react";
import { CheckoutButton } from "@/app/(parent)/portal/CheckoutButton";

export const metadata = {
  title: "Fee History & Receipts | SchoolMitra ERP",
  description: "Archival record of school invoices, itemized fee breakdown, and payment receipts.",
};

export default async function ParentFeesPage({
  searchParams,
}: {
  searchParams?: { studentId?: string; invoiceId?: string };
}) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "PARENT",
  ] as const);
  const school = await requireSchool(ctx);

  // 1. Fetch parent's active students
  const studentRows = await withTenant(school.id, async (tx) => {
    if (ctx.role === "PARENT") {
      return await tx.query.students.findMany({
        where: and(
          eq(students.schoolId, school.id),
          eq(students.primaryParentUserId, ctx.userId),
          eq(students.isActive, true)
        ),
        orderBy: [asc(students.admissionNumber)],
      });
    }

    return await tx.query.students.findMany({
      where: and(eq(students.schoolId, school.id), eq(students.isActive, true)),
      limit: 5,
    });
  });

  if (studentRows.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        No active student found for fee records.
      </div>
    );
  }

  const selectedStudentId = searchParams?.studentId || studentRows[0]!.id;
  const currentStudent =
    studentRows.find((s) => s.id === selectedStudentId) || studentRows[0]!;

  let studentDisplayName = `Student ${currentStudent.admissionNumber}`;
  try {
    if (currentStudent.firstNameEncrypted) {
      const first = decryptData(currentStudent.firstNameEncrypted);
      const last = currentStudent.lastNameEncrypted
        ? decryptData(currentStudent.lastNameEncrypted)
        : "";
      studentDisplayName = `${first} ${last}`.trim();
    }
  } catch {}

  // 2. Fetch Invoices, Items, and Payments for this student
  const { invoices, payments } = await withTenant(school.id, async (tx) => {
    const invList = await tx.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.studentId, currentStudent.id),
        eq(feeInvoices.schoolId, school.id)
      ),
      orderBy: [desc(feeInvoices.dueDate)],
    });

    const payList = await tx.query.feePayments.findMany({
      where: and(
        eq(feePayments.studentId, currentStudent.id),
        eq(feePayments.schoolId, school.id)
      ),
      orderBy: [desc(feePayments.paymentDate)],
    });

    return { invoices: invList, payments: payList };
  });

  const selectedInvoice = searchParams?.invoiceId
    ? invoices.find((inv) => inv.id === searchParams.invoiceId)
    : null;

  return (
    <div className="space-y-6 py-2">
      {/* Back to feed navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/parent/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home Feed
        </Link>

        {studentRows.length > 1 && (
          <div className="flex items-center gap-1.5">
            {studentRows.map((s) => (
              <Link
                key={s.id}
                href={`/parent/fees?studentId=${s.id}`}
                className={`text-[11px] px-2.5 py-1 rounded-xl font-medium border transition-colors ${
                  s.id === currentStudent.id
                    ? "bg-indigo-600/30 text-indigo-200 border-indigo-500/40"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                }`}
              >
                {s.admissionNumber}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">
          Fee History & Receipts
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Archival records, term invoices, and official payment receipts for {studentDisplayName}.
        </p>
      </div>

      {/* Focused Invoice Breakdown banner if coming from feed "View breakdown" */}
      {selectedInvoice && Number(selectedInvoice.balanceAmount || 0) > 0 && (
        <div className="rounded-2xl bg-indigo-950/40 border border-indigo-900/60 p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-indigo-400">
                Active Invoice Details
              </div>
              <h2 className="text-base font-bold text-slate-100 mt-0.5">
                {selectedInvoice.invoiceNumber || "School Fee Invoice"}
              </h2>
              <div className="text-xs text-slate-400 mt-0.5">
                Due on{" "}
                {new Date(selectedInvoice.dueDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-400">Balance Due</div>
              <div className="text-lg font-bold text-indigo-300">
                ₹{Number(selectedInvoice.balanceAmount).toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-indigo-900/40 flex justify-end">
            <CheckoutButton
              invoiceId={selectedInvoice.id}
              amount={Number(selectedInvoice.balanceAmount)}
              studentName={studentDisplayName}
              label={`Pay ₹${Number(selectedInvoice.balanceAmount).toLocaleString("en-IN")} Now`}
            />
          </div>
        </div>
      )}

      {/* Section 1: Invoices Summary */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
          Term Invoices ({invoices.length})
        </h2>

        {invoices.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-center text-xs text-slate-400">
            No invoices generated yet for this student.
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 divide-y divide-slate-800/80 overflow-hidden shadow-sm">
            {invoices.map((inv) => {
              const balance = Number(inv.balanceAmount || 0);
              const isPaid = inv.status === "PAID" || balance <= 0;
              const isOverdue = inv.status === "OVERDUE";

              return (
                <div
                  key={inv.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">
                        {inv.invoiceNumber || "Fee Invoice"}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isPaid
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : isOverdue
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                      <span>
                        Net: ₹{Number(inv.netAmount || 0).toLocaleString("en-IN")}
                      </span>
                      <span>•</span>
                      <span>
                        Paid: ₹{Number(inv.paidAmount || 0).toLocaleString("en-IN")}
                      </span>
                      <span>•</span>
                      <span>
                        Due:{" "}
                        {new Date(inv.dueDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {balance > 0 ? (
                      <CheckoutButton
                        invoiceId={inv.id}
                        amount={balance}
                        studentName={studentDisplayName}
                        label={`Pay ₹${balance.toLocaleString("en-IN")}`}
                      />
                    ) : (
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Settled
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Payment Receipts */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
          Official Payment Receipts ({payments.length})
        </h2>

        {payments.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-center text-xs text-slate-400">
            No payments recorded yet. Receipts appear here immediately after payment.
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 divide-y divide-slate-800/80 overflow-hidden shadow-sm">
            {payments.map((p) => (
              <div
                key={p.id}
                className="p-4 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      <span>Receipt #{p.receiptNumber}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({p.paymentMethod})
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                      <span className="font-semibold text-emerald-400">
                        ₹{Number(p.amountPaid).toLocaleString("en-IN")}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(p.paymentDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <a
                  href={`/api/receipt/${p.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shrink-0 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
