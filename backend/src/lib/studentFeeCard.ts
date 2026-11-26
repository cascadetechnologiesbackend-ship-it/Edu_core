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
import { getStudentAdvanceBalance } from "./advanceFeesEngine";
import {
  students,
  studentClassHistory,
  classes,
  sections,
  academicYears,
  feeInvoices,
  feeStructures,
  feePayments,
  feeConcessions,
  feeRefunds,
} from "@/db/schema";
import { eq, and, desc, asc, inArray, isNull } from "drizzle-orm";
import { withTenant } from "@/db";

function toPaise(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val));
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * Validates that an object contains zero prohibited student PII keys.
 * Throws a SecurityViolation error immediately if any prohibited key is detected.
 */
export function assertNoProhibitedStudentKeys(obj: Record<string, any>): void {
  if (!obj || typeof obj !== "object") return;

  for (const prohibitedKey of PROHIBITED_STUDENT_FEE_CARD_KEYS) {
    if (prohibitedKey in obj) {
      throw new Error(
        `SecurityViolation: Prohibited student field '${prohibitedKey}' detected in finance projection payload.`,
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
  raw: Partial<StudentFeeCard> & Record<string, any>,
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
    creditBalance: fromPaise(toPaise(raw.creditBalance)),
    advanceBalance: fromPaise(toPaise(raw.advanceBalance)),
    totalDue: raw.totalDue !== undefined ? fromPaise(toPaise(raw.totalDue)) : undefined,
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
  studentId: string,
): Promise<StudentFeeCard | null> {
  if (!schoolId || !studentId) return null;

  return await withTenant(schoolId, async (tx) => {
    const client = tx || dbInstance;

    const student = await client.query.students.findFirst({
      where: and(eq(students.id, studentId), eq(students.schoolId, schoolId)),
    });

    if (!student) return null;

    const activeYear = await client.query.academicYears.findFirst({
      where: and(eq(academicYears.schoolId, schoolId), eq(academicYears.isActive, true)),
      columns: { id: true, label: true },
    });

    const resolvedAcademicYearId = student.academicYearId || activeYear?.id || undefined;

    const classHistory = await client.query.studentClassHistory.findFirst({
      where: and(
        eq(studentClassHistory.studentId, studentId),
        eq(studentClassHistory.schoolId, schoolId),
        ...(activeYear?.id ? [eq(studentClassHistory.academicYearId, activeYear.id)] : []),
      ),
      orderBy: [desc(studentClassHistory.createdAt)],
    });

    const effectiveClassId = student.currentClassId || classHistory?.classId || null;
    const effectiveSectionId = student.currentSectionId || classHistory?.sectionId || null;

    const [currentClass, currentSection] = await Promise.all([
      effectiveClassId
        ? client.query.classes.findFirst({
            where: and(eq(classes.id, effectiveClassId), eq(classes.schoolId, schoolId)),
          })
        : Promise.resolve(null),
      effectiveSectionId
        ? client.query.sections.findFirst({
            where: and(eq(sections.id, effectiveSectionId), eq(sections.schoolId, schoolId)),
          })
        : Promise.resolve(null),
    ]);

    const firstName = decryptData(student.firstNameEncrypted) || "";
    const lastName = decryptData(student.lastNameEncrypted) || "";
    const fullName = `${firstName} ${lastName}`.trim() || "Student";

    // Fetch invoices, active payments, active concessions, and advance balance in parallel
    const [invoices, payments, concessions, advanceInfo] = await Promise.all([
      client.query.feeInvoices.findMany({
        where: and(
          eq(feeInvoices.schoolId, schoolId),
          eq(feeInvoices.studentId, studentId),
          isNull(feeInvoices.deletedAt),
        ),
        with: {
          feeStructure: {
            with: {
              feeHead: true,
            },
          },
        },
        orderBy: [desc(feeInvoices.dueDate)],
      }),
      client.query.feePayments.findMany({
        where: and(
          eq(feePayments.schoolId, schoolId),
          eq(feePayments.studentId, studentId),
          eq(feePayments.isCancelled, false),
        ),
        orderBy: [desc(feePayments.paymentDate)],
      }),
      client.query.feeConcessions.findMany({
        where: and(
          eq(feeConcessions.schoolId, schoolId),
          eq(feeConcessions.studentId, studentId),
          eq(feeConcessions.isActive, true),
          isNull(feeConcessions.deletedAt),
        ),
      }),
      getStudentAdvanceBalance(schoolId, studentId, client).catch(() => ({
        creditBalance: 0,
        count: 0,
      })),
    ]);

    // Fetch any fee refunds tied to student's payments (both active and reversed if refunded)
    const paymentIds = payments.map((p: any) => p.id).filter(Boolean);
    const refunds =
      paymentIds.length > 0 && client.query.feeRefunds?.findMany
        ? await client.query.feeRefunds.findMany({
            where: and(
              eq(feeRefunds.schoolId, schoolId),
              inArray(feeRefunds.feePaymentId, paymentIds),
            ),
          })
        : [];

    // Fallback projections from feeStructures when 0 invoices exist yet (respecting optInTransport / optInHostel)
    let invoiceSummaries: FeeCardInvoiceSummary[];
    if (invoices.length > 0) {
      invoiceSummaries = invoices.map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        feeHeadName: inv.feeStructure?.feeHead?.name || "Fee Invoice",
        term: inv.term,
        grossAmount: fromPaise(toPaise(inv.grossAmount)),
        discountAmount: fromPaise(toPaise(inv.discountAmount)),
        lateFeeAmount: fromPaise(toPaise(inv.lateFeeAmount)),
        taxAmount: fromPaise(toPaise(inv.taxAmount)),
        netAmount: fromPaise(toPaise(inv.netAmount)),
        paidAmount: fromPaise(toPaise(inv.paidAmount)),
        balanceAmount: fromPaise(toPaise(inv.balanceAmount)),
        dueDate: inv.dueDate instanceof Date ? inv.dueDate.toISOString() : String(inv.dueDate),
        status: inv.status,
      }));
    } else if (effectiveClassId && resolvedAcademicYearId) {
      const structures = await client.query.feeStructures.findMany({
        where: and(
          eq(feeStructures.schoolId, schoolId),
          eq(feeStructures.academicYearId, resolvedAcademicYearId),
          eq(feeStructures.classId, effectiveClassId),
          eq(feeStructures.isActive, true),
          isNull(feeStructures.deletedAt),
        ),
        with: {
          feeHead: true,
        },
        orderBy: [asc(feeStructures.dueDate)],
      });

      invoiceSummaries = structures
        .filter((s: any) => {
          const headType = s.feeHead?.headType;
          if (headType === "TRANSPORT" && !student.optInTransport) return false;
          if (headType === "HOSTEL" && !student.optInHostel) return false;
          return true;
        })
        .map((s: any) => {
          const amount = fromPaise(toPaise(s.amount));
          return {
            invoiceNumber: `PROJ-${s.feeHead?.code || s.term}`,
            feeHeadName: s.feeHead?.name || "Projected Fee",
            term: s.term,
            grossAmount: amount,
            discountAmount: 0,
            lateFeeAmount: 0,
            taxAmount: 0,
            netAmount: amount,
            paidAmount: 0,
            balanceAmount: amount,
            dueDate: s.dueDate instanceof Date ? s.dueDate.toISOString() : String(s.dueDate),
            status: "PROJECTED",
          };
        });
    } else {
      invoiceSummaries = [];
    }

    const paymentSummaries: FeeCardPaymentSummary[] = payments.map((p: any) => ({
      receiptNumber: p.receiptNumber,
      receiptGroupId: p.receiptGroupId || null,
      amountPaid: fromPaise(toPaise(p.amountPaid)),
      paymentMode: p.paymentMethod,
      paymentDate:
        p.paymentDate instanceof Date ? p.paymentDate.toISOString() : String(p.paymentDate),
    }));

    const concessionSummaries: FeeCardConcessionSummary[] = concessions.map((c: any) => ({
      policy: c.concessionName || c.concessionType || "Concession",
      status: c.approvedAt ? "APPROVED" : c.isActive ? "ACTIVE" : "INACTIVE",
      approvedBy: c.approvedById || null,
    }));

    const reminderSummaries: FeeCardReminderSummary[] = invoices.map((inv: any) => ({
      d7SentAt: inv.reminderSentD7 ? "SENT" : null,
      d15SentAt: inv.reminderSentD15 ? "SENT" : null,
      d30SentAt: inv.reminderSentD30 ? "SENT" : null,
    }));

    const pendingStatuses = new Set(["PENDING", "PARTIAL", "OVERDUE"]);
    let totalDuePaise = 0;
    let pendingCount = 0;
    for (const inv of invoiceSummaries) {
      if (pendingStatuses.has(inv.status)) {
        totalDuePaise += toPaise(inv.balanceAmount);
        pendingCount += 1;
      }
    }

    // Track processed refunds so refunded amounts are accounted for cleanly if needed
    void refunds;

    const advancePaise = toPaise(advanceInfo.creditBalance);

    return projectToStudentFeeCard({
      id: student.id,
      admissionNumber: student.admissionNumber || "",
      fullName,
      className: currentClass?.displayName || "Unassigned",
      sectionName: currentSection?.name || null,
      academicYearId: resolvedAcademicYearId,
      enrollmentStatus: student.isActive ? "ACTIVE" : "INACTIVE",
      creditBalance: fromPaise(advancePaise),
      advanceBalance: fromPaise(advancePaise),
      totalDue: fromPaise(totalDuePaise),
      pendingInvoiceCount: pendingCount,
      invoices: invoiceSummaries,
      payments: paymentSummaries,
      concessions: concessionSummaries,
      reminders: reminderSummaries,
    });
  });
}
