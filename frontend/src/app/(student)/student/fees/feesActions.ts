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

      // 2. Fetch payments
      const paymentRows = await tx.query.feePayments.findMany({
        where: and(
          eq(feePayments.schoolId, scope.schoolId),
          eq(feePayments.studentId, scope.studentId)
        ),
        orderBy: [desc(feePayments.paymentDate)],
      });

      let totalBilled = 0;
      let totalPaid = 0;
      let totalOutstanding = 0;

      const invoices: StudentFeeInvoiceItem[] = invoiceRows.map((inv) => {
        const total = Number(inv.netAmount || 0);
        const paid = Number(inv.paidAmount || 0);
        const balance = Number(inv.balanceAmount || 0);
        const late = Number(inv.lateFeeAmount || 0);

        totalBilled += total;
        totalPaid += paid;
        if (
          inv.status === "PENDING" ||
          inv.status === "PARTIAL" ||
          inv.status === "OVERDUE"
        ) {
          totalOutstanding += balance;
        }

        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber || "INV",
          term: (inv.term as string) || "Term Fee",
          dueDate: new Date(inv.dueDate).toISOString().split("T")[0]!,
          totalAmount: total,
          paidAmount: paid,
          balanceAmount: balance,
          lateFeeAmount: late,
          status: inv.status as FeeInvoiceStatus,
        };
      });

      const payments: StudentFeePaymentItem[] = paymentRows.map((p) => ({
        id: p.id,
        receiptNumber: p.receiptNumber || "RCPT",
        invoiceId: p.feeInvoiceId,
        paymentDate: new Date(p.paymentDate).toISOString().split("T")[0]!,
        amount: Number(p.amountPaid || 0),
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
        totalBilled,
        totalPaid,
        totalOutstanding,
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
