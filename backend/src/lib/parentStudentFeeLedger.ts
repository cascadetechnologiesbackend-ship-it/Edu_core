/**
 * ParentStudentFeeLedger Projection & Field-Level Data Isolation (Phase B1 AZ-07)
 * Ensures parents only receive clean, audited financial figures for their own wards,
 * with zero internal staff remarks or sensitive student PII.
 */

import {
  ParentStudentFeeLedgerSchema,
  type ParentStudentFeeLedger,
  type ParentInvoiceSummary,
  type ParentPaymentSummary,
  PROHIBITED_PARENT_LEDGER_KEYS,
} from "@schoolmitra/validators";
import { decryptData } from "./encryption";
import { getStudentAdvanceBalance } from "./advanceFeesEngine";
import { students, feeInvoices, feePayments, classes, sections } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

function toPaise(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val));
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * Validates that an object contains zero prohibited parent ledger keys.
 * Throws a SecurityViolation error immediately if any prohibited key is detected.
 */
export function assertNoProhibitedParentLedgerKeys(obj: Record<string, any>): void {
  if (!obj || typeof obj !== "object") return;

  for (const prohibitedKey of PROHIBITED_PARENT_LEDGER_KEYS) {
    if (prohibitedKey in obj) {
      throw new Error(
        `SecurityViolation: Prohibited student/internal field '${prohibitedKey}' detected in parent fee ledger projection.`
      );
    }
  }

  // Check nested arrays and objects
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object") {
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item && typeof item === "object") {
            assertNoProhibitedParentLedgerKeys(item);
          }
        }
      } else {
        assertNoProhibitedParentLedgerKeys(val);
      }
    }
  }
}

/**
 * Strictly projects a raw student ledger object to the ParentStudentFeeLedger schema.
 * Discards non-permitted properties and verifies zero prohibited keys.
 */
export function projectToParentStudentFeeLedger(
  raw: Record<string, any>
): ParentStudentFeeLedger {
  const studentName = (raw.studentName || "Student").trim();

  const invoices: ParentInvoiceSummary[] = Array.isArray(raw.invoices)
    ? raw.invoices.map((inv: any) => ({
        invoiceId: String(inv.invoiceId || inv.id || ""),
        invoiceNumber: String(inv.invoiceNumber || ""),
        term: inv.term ? String(inv.term) : undefined,
        feeHeadName: inv.feeHeadName ? String(inv.feeHeadName) : undefined,
        dueDate:
          inv.dueDate instanceof Date
            ? inv.dueDate.toISOString()
            : String(inv.dueDate || ""),
        grossAmount: Number(inv.grossAmount || 0),
        discountAmount: Number(inv.discountAmount || 0),
        lateFeeAmount: Number(inv.lateFeeAmount || 0),
        paidAmount: Number(inv.paidAmount || 0),
        balanceAmount: Number(inv.balanceAmount || 0),
        status: String(inv.status || "PENDING"),
        isAvailableForPayment:
          inv.isAvailableForPayment !== undefined
            ? Boolean(inv.isAvailableForPayment)
            : ["PENDING", "PARTIAL", "OVERDUE"].includes(inv.status) &&
              Number(inv.balanceAmount) > 0,
      }))
    : [];

  const payments: ParentPaymentSummary[] = Array.isArray(raw.payments)
    ? raw.payments.map((p: any) => {
        const paymentId = String(p.paymentId || p.id || "");
        return {
          paymentId,
          receiptNumber: String(p.receiptNumber || ""),
          amountPaid: Number(p.amountPaid || 0),
          paymentDate:
            p.paymentDate instanceof Date
              ? p.paymentDate.toISOString()
              : String(p.paymentDate || ""),
          paymentMethod: String(p.paymentMethod || "ONLINE"),
          receiptUrl: p.receiptUrl || `/api/receipt/${paymentId}`,
          receiptAvailable:
            p.receiptAvailable !== undefined ? Boolean(p.receiptAvailable) : true,
        };
      })
    : [];

  let totalOutstandingPaise = 0;
  if (raw.totalOutstanding !== undefined) {
    totalOutstandingPaise = toPaise(raw.totalOutstanding);
  } else {
    for (const inv of invoices) {
      const balPaise = toPaise(inv.balanceAmount);
      if (balPaise > 0) {
        totalOutstandingPaise += balPaise;
      }
    }
  }

  const ledgerPayload = {
    studentId: String(raw.studentId || raw.id || ""),
    studentName,
    admissionNumber: String(raw.admissionNumber || ""),
    className: raw.className ? String(raw.className) : undefined,
    sectionName: raw.sectionName !== undefined ? raw.sectionName : null,
    totalOutstanding: fromPaise(totalOutstandingPaise),
    creditBalance: fromPaise(toPaise(raw.creditBalance)),
    invoices,
    payments,
  };

  assertNoProhibitedParentLedgerKeys(ledgerPayload);

  return ParentStudentFeeLedgerSchema.parse(ledgerPayload);
}

/**
 * Server-side helper to fetch and construct a complete ParentStudentFeeLedger for a ward.
 * Enforces parent ownership boundary (student.primaryParentUserId == requestingParentUserId).
 */
export async function fetchParentStudentFeeLedger(
  dbInstance: any,
  schoolId: string,
  studentId: string,
  requestingParentUserId?: string,
  isAdmin = false
): Promise<ParentStudentFeeLedger | null> {
  const student = await dbInstance.query.students.findFirst({
    where: and(
      eq(students.id, studentId),
      schoolId ? eq(students.schoolId, schoolId) : undefined
    ),
  });

  if (!student) return null;

  // Authorization check: If not admin, the student must be linked to the parent
  if (
    !isAdmin &&
    requestingParentUserId &&
    student.primaryParentUserId !== requestingParentUserId
  ) {
    throw new Error(
      `Forbidden: Student '${studentId}' is not linked to parent '${requestingParentUserId}'.`
    );
  }

  // Resolve class & section without nonexistent Drizzle relations on students
  const [classRow, sectionRow] = await Promise.all([
    student.currentClassId && dbInstance.query.classes?.findFirst
      ? dbInstance.query.classes.findFirst({
          where: and(
            eq(classes.id, student.currentClassId),
            eq(classes.schoolId, student.schoolId)
          ),
        })
      : Promise.resolve((student as any).class || null),
    student.currentSectionId && dbInstance.query.sections?.findFirst
      ? dbInstance.query.sections.findFirst({
          where: and(
            eq(sections.id, student.currentSectionId),
            eq(sections.schoolId, student.schoolId)
          ),
        })
      : Promise.resolve((student as any).section || null),
  ]);

  const firstName = decryptData(student.firstNameEncrypted) || "";
  const lastName = decryptData(student.lastNameEncrypted) || "";
  const studentName = `${firstName} ${lastName}`.trim() || "Student";

  // Fetch invoices with feeStructure
  const rawInvoices = await dbInstance.query.feeInvoices.findMany({
    where: and(
      eq(feeInvoices.studentId, studentId),
      eq(feeInvoices.schoolId, student.schoolId)
    ),
    with: {
      feeStructure: {
        with: {
          feeHead: true,
        },
      },
    },
    orderBy: [desc(feeInvoices.dueDate)],
  });

  // Fetch active (non-cancelled) payments
  const rawPayments = await dbInstance.query.feePayments.findMany({
    where: and(
      eq(feePayments.studentId, studentId),
      eq(feePayments.schoolId, student.schoolId),
      eq(feePayments.isCancelled, false)
    ),
    orderBy: [desc(feePayments.paymentDate)],
  });

  // Fetch unallocated advance credit balance
  let creditBalance = 0;
  try {
    const advRes = await getStudentAdvanceBalance(
      student.schoolId,
      studentId,
      dbInstance
    );
    creditBalance = advRes.creditBalance;
  } catch (err) {
    console.warn("[ParentStudentFeeLedger] Could not fetch advance balance:", err);
  }

  const invoices: ParentInvoiceSummary[] = rawInvoices.map((inv: any) => {
    const bal = fromPaise(toPaise(inv.balanceAmount));
    const isPayable =
      ["PENDING", "PARTIAL", "OVERDUE"].includes(inv.status) && bal > 0;
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      term: inv.term || undefined,
      feeHeadName: inv.feeStructure?.feeHead?.name || "Tuition Fee",
      dueDate:
        inv.dueDate instanceof Date
          ? inv.dueDate.toISOString()
          : String(inv.dueDate),
      grossAmount: fromPaise(toPaise(inv.grossAmount)),
      discountAmount: fromPaise(toPaise(inv.discountAmount)),
      lateFeeAmount: fromPaise(toPaise(inv.lateFeeAmount)),
      paidAmount: fromPaise(toPaise(inv.paidAmount)),
      balanceAmount: bal,
      status: inv.status,
      isAvailableForPayment: isPayable,
    };
  });

  const payments: ParentPaymentSummary[] = rawPayments.map((p: any) => ({
    paymentId: p.id,
    receiptNumber: p.receiptNumber,
    amountPaid: fromPaise(toPaise(p.amountPaid)),
    paymentDate:
      p.paymentDate instanceof Date
        ? p.paymentDate.toISOString()
        : String(p.paymentDate),
    paymentMethod: p.paymentMethod || "ONLINE",
    receiptUrl: `/api/receipt/${p.id}`,
    receiptAvailable: true,
  }));

  let totalOutstandingPaise = 0;
  for (const inv of invoices) {
    const balPaise = toPaise(inv.balanceAmount);
    if (balPaise > 0) {
      totalOutstandingPaise += balPaise;
    }
  }

  return projectToParentStudentFeeLedger({
    studentId: student.id,
    studentName,
    admissionNumber: student.admissionNumber || "",
    className: classRow?.displayName || classRow?.name || undefined,
    sectionName: sectionRow?.name || null,
    totalOutstanding: fromPaise(totalOutstandingPaise),
    creditBalance,
    invoices,
    payments,
  });
}
