/**
 * StudentFeeCard Projection & Field-Level Data Isolation (GT-06)
 * Strict projector ensuring zero PII leakages (parent contact, DOB, Aadhaar, marks, etc.)
 * into finance views, ledger drawers, or cashier terminals.
 */

import {
  StudentFeeCardSchema,
  type StudentFeeCard,
  type FeeCardInvoiceSummary,
  type FeeCardPaymentSummary,
  type FeeCardConcessionSummary,
  type FeeCardReminderSummary,
  PROHIBITED_STUDENT_FEE_CARD_KEYS,
} from "@schoolmitra/validators";
import { decryptData } from "./encryption";
import {
  students,
  classes,
  sections,
  feeInvoices,
  feePayments,
  feeConcessions,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Validates that an object contains zero prohibited student PII keys.
 * Throws a SecurityViolation error immediately if any prohibited key is detected.
 */
export function assertNoProhibitedStudentKeys(obj: Record<string, any>): void {
  if (!obj || typeof obj !== "object") return;

  for (const prohibitedKey of PROHIBITED_STUDENT_FEE_CARD_KEYS) {
    if (prohibitedKey in obj) {
      throw new Error(
        `SecurityViolation: Prohibited student field '${prohibitedKey}' detected in finance projection payload.`
      );
    }
  }

  // Also check nested arrays/objects if present
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object") {
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item && typeof item === "object") {
            assertNoProhibitedStudentKeys(item);
          }
        }
      } else {
        assertNoProhibitedStudentKeys(val);
      }
    }
  }
}

/**
 * Projects an arbitrary raw student record to a strictly validated StudentFeeCard.
 * Discards any non-permitted fields and validates against the authoritative schema.
 */
export function projectToStudentFeeCard(
  raw: Partial<StudentFeeCard> & Record<string, any>
): StudentFeeCard {
  const name = (raw.fullName || raw.name || "Student").trim();

  const cardPayload = {
    id: String(raw.id || ""),
    admissionNumber: String(raw.admissionNumber || ""),
    fullName: name,
    name: name,
    className: String(raw.className || "Class"),
    sectionName: raw.sectionName !== undefined ? raw.sectionName : null,
    academicYearId: raw.academicYearId ? String(raw.academicYearId) : undefined,
    enrollmentStatus: raw.enrollmentStatus ? String(raw.enrollmentStatus) : undefined,
    creditBalance: Number(raw.creditBalance || 0),
    advanceBalance: Number(raw.advanceBalance || 0),
    totalDue: raw.totalDue !== undefined ? Number(raw.totalDue) : undefined,
    pendingInvoiceCount:
      raw.pendingInvoiceCount !== undefined ? Number(raw.pendingInvoiceCount) : undefined,
    invoices: Array.isArray(raw.invoices) ? raw.invoices : [],
    payments: Array.isArray(raw.payments) ? raw.payments : [],
    concessions: Array.isArray(raw.concessions) ? raw.concessions : [],
    reminders: Array.isArray(raw.reminders) ? raw.reminders : [],
  };

  // Run security assertion against prohibited keys
  assertNoProhibitedStudentKeys(cardPayload);

  // Parse and return schema-validated result
  return StudentFeeCardSchema.parse(cardPayload);
}

/**
 * Server-side helper to fetch and construct a complete StudentFeeCard for a student.
 * Scoped strictly to schoolId. Decrypts names server-side only.
 */
export async function fetchStudentFeeCard(
  dbInstance: any,
  schoolId: string,
  studentId: string
): Promise<StudentFeeCard | null> {
  const student = await dbInstance.query.students.findFirst({
    where: and(eq(students.id, studentId), eq(students.schoolId, schoolId)),
    with: {
      class: true,
      section: true,
    },
  });

  if (!student) return null;

  const firstName = decryptData(student.firstNameEncrypted) || "";
  const lastName = decryptData(student.lastNameEncrypted) || "";
  const fullName = `${firstName} ${lastName}`.trim() || "Student";

  // Fetch invoices with fee head details
  const invoices = await dbInstance.query.feeInvoices.findMany({
    where: and(eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.studentId, studentId)),
    with: {
      feeStructure: {
        with: {
          feeHead: true,
        },
      },
    },
    orderBy: [desc(feeInvoices.dueDate)],
  });

  // Fetch payments
  const payments = await dbInstance.query.feePayments.findMany({
    where: and(eq(feePayments.schoolId, schoolId), eq(feePayments.studentId, studentId)),
    orderBy: [desc(feePayments.paymentDate)],
  });

  // Fetch concessions
  const concessions = await dbInstance.query.feeConcessions.findMany({
    where: and(eq(feeConcessions.schoolId, schoolId), eq(feeConcessions.studentId, studentId)),
  });

  const invoiceSummaries: FeeCardInvoiceSummary[] = invoices.map((inv: any) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    feeHeadName: inv.feeStructure?.feeHead?.name || "Fee Invoice",
    term: inv.term,
    grossAmount: parseFloat(inv.grossAmount),
    discountAmount: parseFloat(inv.discountAmount || "0"),
    lateFeeAmount: parseFloat(inv.lateFeeAmount || "0"),
    taxAmount: parseFloat(inv.taxAmount || "0"),
    netAmount: parseFloat(inv.netAmount),
    paidAmount: parseFloat(inv.paidAmount || "0"),
    balanceAmount: parseFloat(inv.balanceAmount),
    dueDate: inv.dueDate instanceof Date ? inv.dueDate.toISOString() : String(inv.dueDate),
    status: inv.status,
  }));

  const paymentSummaries: FeeCardPaymentSummary[] = payments.map((p: any) => ({
    receiptNumber: p.receiptNumber,
    receiptGroupId: p.receiptGroupId || null,
    amountPaid: parseFloat(p.amountPaid),
    paymentMode: p.paymentMethod,
    paymentDate: p.paymentDate instanceof Date ? p.paymentDate.toISOString() : String(p.paymentDate),
  }));

  const concessionSummaries: FeeCardConcessionSummary[] = concessions.map((c: any) => ({
    policy: c.concessionName,
    status: c.isActive ? "ACTIVE" : "INACTIVE",
    approvedBy: c.approvedById || null,
  }));

  const reminderSummaries: FeeCardReminderSummary[] = invoices.map((inv: any) => ({
    d7SentAt: inv.reminderSentD7 ? "SENT" : null,
    d15SentAt: inv.reminderSentD15 ? "SENT" : null,
    d30SentAt: inv.reminderSentD30 ? "SENT" : null,
  }));

  const totalDue = invoiceSummaries.reduce(
    (sum, inv) => (["PENDING", "PARTIAL", "OVERDUE"].includes(inv.status) ? sum + inv.balanceAmount : sum),
    0
  );

  const pendingCount = invoiceSummaries.filter((inv) =>
    ["PENDING", "PARTIAL", "OVERDUE"].includes(inv.status)
  ).length;

  return projectToStudentFeeCard({
    id: student.id,
    admissionNumber: student.admissionNumber || "",
    fullName,
    className: student.class?.displayName || student.class?.name || "Class",
    sectionName: student.section?.name || null,
    academicYearId: student.academicYearId || undefined,
    enrollmentStatus: student.isActive ? "ACTIVE" : "INACTIVE",
    creditBalance: 0,
    advanceBalance: 0,
    totalDue,
    pendingInvoiceCount: pendingCount,
    invoices: invoiceSummaries,
    payments: paymentSummaries,
    concessions: concessionSummaries,
    reminders: reminderSummaries,
  });
}
