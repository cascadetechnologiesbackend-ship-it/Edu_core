"use server";

import { getCachedSession } from "@/lib/serverAuth";
import { withTenant } from "@/db";
import { feeInvoices, feePayments } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { resolveStudentScope } from "@/lib/studentEventEngine/scopeResolver";

export type FeeInvoiceStatus =
  | "PAID"
  | "PARTIAL"
  | "PENDING"
  | "OVERDUE"
  | "WAIVED"
  | "CANCELLED";

export interface StudentFeeInvoiceItem {
  id: string;
  invoiceNumber: string;
  term: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  lateFeeAmount: number;
  status: FeeInvoiceStatus;
}

export interface StudentFeePaymentItem {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  paymentDate: string;
  amount: number;
  paymentMode: string;
  transactionRef: string | null;
  status: string;
}

export interface StudentFeesData {
  success: boolean;
  student: {
    studentId: string;
    studentName: string;
    className: string;
    sectionName: string;
    academicYearLabel: string;
  };
  totalBilled: number;
  totalPaid: number;
  totalOutstanding: number;
  invoices: StudentFeeInvoiceItem[];
  payments: StudentFeePaymentItem[];
  error?: string;
}

export async function getStudentFeesAction(
  studentIdParam?: string
): Promise<StudentFeesData> {
  const session = await getCachedSession();
  const userId = session?.user?.id || "";
  const schoolId = session?.user?.schoolId || "";
  const role = session?.user?.role || "STUDENT";

  if (!userId || !schoolId) {
    return {
      success: false,
      student: {
        studentId: "",
        studentName: "",
        className: "",
        sectionName: "",
        academicYearLabel: "",
      },
      totalBilled: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      invoices: [],
      payments: [],
      error: "Authentication required",
    };
  }

  try {
    const scope = await resolveStudentScope(userId, {
      schoolId,
      studentId: studentIdParam ?? null,
      role,
    });

    return await withTenant(scope.schoolId, async (tx) => {
      // 1. Fetch invoices
      const invoiceRows = await tx.query.feeInvoices.findMany({
        where: and(
          eq(feeInvoices.schoolId, scope.schoolId),
          eq(feeInvoices.studentId, scope.studentId)
        ),
        orderBy: [desc(feeInvoices.dueDate)],
      });

      // 2. Fetch active (non-cancelled) payments
      const paymentRows = await tx.query.feePayments.findMany({
        where: and(
          eq(feePayments.schoolId, scope.schoolId),
          eq(feePayments.studentId, scope.studentId),
          eq(feePayments.isCancelled, false)
        ),
        orderBy: [desc(feePayments.paymentDate)],
      });

      const toPaise = (v: string | number | null | undefined) => {
        const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
        return Number.isFinite(n) ? Math.round(n * 100) : 0;
      };

      let totalBilledPaise = 0;
      let totalPaidPaise = 0;
      let totalOutstandingPaise = 0;

      const invoices: StudentFeeInvoiceItem[] = invoiceRows.map((inv) => {
        const totalPaise = toPaise(inv.netAmount);
        const paidPaise = toPaise(inv.paidAmount);
        const balancePaise = toPaise(inv.balanceAmount);
        const latePaise = toPaise(inv.lateFeeAmount);

        if (inv.status !== "CANCELLED" && inv.status !== "WAIVED") {
          totalBilledPaise += totalPaise;
        }
        totalPaidPaise += paidPaise;
        if (
          inv.status === "PENDING" ||
          inv.status === "PARTIAL" ||
          inv.status === "OVERDUE"
        ) {
          totalOutstandingPaise += balancePaise;
        }

        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber || "INV",
          term: (inv.term as string) || "Term Fee",
          dueDate: new Date(inv.dueDate).toISOString().split("T")[0]!,
          totalAmount: totalPaise / 100,
          paidAmount: paidPaise / 100,
          balanceAmount: balancePaise / 100,
          lateFeeAmount: latePaise / 100,
          status: inv.status as FeeInvoiceStatus,
        };
      });

      const payments: StudentFeePaymentItem[] = paymentRows.map((p) => ({
        id: p.id,
        receiptNumber: p.receiptNumber || "RCPT",
        invoiceId: p.feeInvoiceId,
        paymentDate: new Date(p.paymentDate).toISOString().split("T")[0]!,
        amount: toPaise(p.amountPaid) / 100,
        paymentMode: p.paymentMethod || "ONLINE",
        transactionRef: p.transactionReference || null,
        status: "CONFIRMED",
      }));

      return {
        success: true,
        student: {
          studentId: scope.studentId,
          studentName: scope.studentName,
          className: scope.className,
          sectionName: scope.sectionName,
          academicYearLabel: scope.academicYearLabel,
        },
        totalBilled: totalBilledPaise / 100,
        totalPaid: totalPaidPaise / 100,
        totalOutstanding: totalOutstandingPaise / 100,
        invoices,
        payments,
      };
    });
  } catch (err: any) {
    return {
      success: false,
      student: {
        studentId: "",
        studentName: "",
        className: "",
        sectionName: "",
        academicYearLabel: "",
      },
      totalBilled: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      invoices: [],
      payments: [],
      error: err.message || "Failed to load fee invoices",
    };
  }
}
