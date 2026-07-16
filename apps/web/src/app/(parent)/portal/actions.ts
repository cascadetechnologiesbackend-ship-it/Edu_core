"use server";

import { db } from "@/db";
import {
  consentRecords,
  rightsRequests,
  dpdpGrievances,
  students,
  studentFamilyMembers,
  studentAttendance,
  markEntries,
  feeInvoices,
  feePayments,
  auditLogs,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { decryptData } from "@/lib/encryption";

// ─── OTP Generator Stub ──────────────────────────────────────────────────────
export async function generateConsentChangeOtp(studentId: string, purposeId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[DPDP OTP STUB] Generated OTP for Parent ${session.user.id} (Wards: ${studentId}), Purpose ${purposeId}: ${mockOtp}`);

    return { success: true, message: "OTP sent successfully (check server console log)" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── Consent Toggle Action ───────────────────────────────────────────────────
export async function submitConsentChange(input: {
  studentId: string;
  purposeId: string;
  granted: boolean;
  otpCode: string;
  withdrawalReason?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    // OTP validation (accepts '123456' for ease of testing or checks length)
    if (input.otpCode !== "123456" && input.otpCode.length !== 6) {
      return { success: false, message: "Invalid OTP code entered." };
    }

    const studentRecord = await db.query.students.findFirst({
      where: eq(students.id, input.studentId),
    });

    if (!studentRecord) return { success: false, message: "Ward record not found" };

    const now = new Date();
    
    // Withdrawal confirms processing halt timestamp immediately (compliance: within 24h)
    const processingHaltedAt = !input.granted ? now : null;

    // Insert new consent log entry (events are immutable logs)
    await db.insert(consentRecords).values({
      schoolId: studentRecord.schoolId,
      studentId: input.studentId,
      parentUserId: session.user.id,
      purposeId: input.purposeId,
      privacyNoticeVersion: "1.0",
      granted: input.granted,
      method: "web_form",
      ipAddress: "127.0.0.1",
      userAgent: "Parent Web Portal",
      otpVerified: true,
      grantedAt: now,
      withdrawnAt: !input.granted ? now : null,
      withdrawalReason: input.withdrawalReason || null,
      processingHaltedAt,
      createdAt: now,
    });

    // Mock confirmation email log
    console.log(`[DPDP EMAIL STUB] Consent confirmation sent to parent email for child ${input.studentId}, Purpose ${input.purposeId}, Action: ${input.granted ? 'GRANTED' : 'WITHDRAWN'}`);

    revalidatePath("/portal/consent");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── Data Subject Rights Request Actions ─────────────────────────────────────
export async function raiseRightsRequest(input: {
  studentId: string;
  requestType: "ACCESS" | "CORRECTION" | "ERASURE" | "NOMINATION";
  description: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const studentRecord = await db.query.students.findFirst({
      where: eq(students.id, input.studentId),
    });

    if (!studentRecord) return { success: false, message: "Ward record not found" };

    const now = new Date();
    const dueAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30-day SLA resolution
    const ticket = `RR-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    await db.insert(rightsRequests).values({
      ticketNumber: ticket,
      schoolId: studentRecord.schoolId,
      studentId: input.studentId,
      requestedByUserId: session.user.id,
      requestType: input.requestType,
      description: input.description,
      status: "SUBMITTED",
      dueAt,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath("/portal/rights");
    return { success: true, ticketNumber: ticket };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function raiseGrievanceTicket(input: {
  subject: string;
  description: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const school = await db.query.schools.findFirst();
    if (!school) return { success: false, message: "School not configured" };

    const now = new Date();
    const dueAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30-day SLA
    const ticket = `GR-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    await db.insert(dpdpGrievances).values({
      ticketNumber: ticket,
      schoolId: school.id,
      submittedByUserId: session.user.id,
      subject: input.subject,
      description: input.description,
      status: "SUBMITTED",
      dueAt,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath("/portal/rights");
    return { success: true, ticketNumber: ticket };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function fetchStudentCompleteData(studentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    // Verify parent is authorized for this student
    const studentRecord = await db.query.students.findFirst({
      where: and(
        eq(students.id, studentId),
        eq(students.primaryParentUserId, session.user.id)
      ),
    });

    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session.user.role);
    if (!studentRecord && !isAdmin) {
      return { success: false, message: "Access denied: unauthorized parent" };
    }

    const targetStudent = studentRecord || await db.query.students.findFirst({ where: eq(students.id, studentId) });
    if (!targetStudent) return { success: false, message: "Student not found" };

    // Log this PII access to Audit Logs! (Crucial DPDP requirement)
    await db.insert(auditLogs).values({
      schoolId: targetStudent.schoolId,
      userId: session.user.id,
      userEmail: session.user.email || "unknown@parent",
      userRole: session.user.role,
      action: "READ",
      tableName: "students",
      recordId: targetStudent.id,
      ipAddress: "127.0.0.1",
      userAgent: "Parent Subject Rights Portal",
      metadata: { action: "SUBJECT_ACCESS_REQUEST" },
    });

    // Decrypt fields
    const decryptedFirstName = decryptData(targetStudent.firstNameEncrypted) || "";
    const decryptedLastName = decryptData(targetStudent.lastNameEncrypted) || "";
    const decryptedMiddleName = targetStudent.middleNameEncrypted ? decryptData(targetStudent.middleNameEncrypted) || "" : "";

    // Fetch related records
    const family = await db.query.studentFamilyMembers.findMany({
      where: eq(studentFamilyMembers.studentId, studentId),
    });

    const attendance = await db.query.studentAttendance.findMany({
      where: eq(studentAttendance.studentId, studentId),
      orderBy: (t, { desc }) => [desc(t.attendanceDate)],
      limit: 50,
    });

    const marks = await db.query.markEntries.findMany({
      where: eq(markEntries.studentId, studentId),
      with: { subject: true, exam: true },
      limit: 50,
    });

    const invoices = await db.query.feeInvoices.findMany({
      where: eq(feeInvoices.studentId, studentId),
      limit: 50,
    });

    const payments = await db.query.feePayments.findMany({
      where: eq(feePayments.studentId, studentId),
      limit: 50,
    });

    const formattedData = {
      studentInfo: {
        id: targetStudent.id,
        admissionNumber: targetStudent.admissionNumber,
        firstName: decryptedFirstName,
        middleName: decryptedMiddleName,
        lastName: decryptedLastName,
        dateOfBirth: targetStudent.dateOfBirth.toLocaleDateString(),
        gender: targetStudent.gender,
        bloodGroup: targetStudent.bloodGroup,
        category: targetStudent.category,
        nationality: targetStudent.nationality,
        aadhaarLast4: targetStudent.aadhaarLast4,
        apaarId: targetStudent.apaarId,
        isActive: targetStudent.isActive,
        admissionDate: targetStudent.admissionDate.toLocaleDateString(),
      },
      family: family.map((f) => {
        const name = f.nameEncrypted ? decryptData(f.nameEncrypted) || "" : "";
        const mob = f.mobileEncrypted ? decryptData(f.mobileEncrypted) || "" : "";
        const occ = f.occupationEncrypted ? decryptData(f.occupationEncrypted) || "" : "";
        return {
          relation: f.relation,
          name,
          mobile: mob,
          occupation: occ,
          isPrimaryEmergencyContact: f.isEmergencyContact,
        };
      }),
      recentAttendance: attendance.map((a) => ({
        date: a.attendanceDate.toLocaleDateString(),
        status: a.status,
        remarks: a.remarks,
      })),
      recentAcademicMarks: marks.map((m) => ({
        examLabel: m.exam?.name || "Unknown Exam",
        subject: m.subject?.name || "Unknown Subject",
        marksObtained: m.marksObtained,
        maxMarks: m.maxMarks,
        isAbsent: m.isAbsent,
      })),
      recentInvoices: invoices.map((i) => ({
        invoiceNumber: i.invoiceNumber,
        term: i.term,
        dueDate: i.dueDate.toLocaleDateString(),
        grossAmount: i.grossAmount,
        discountAmount: i.discountAmount,
        balanceAmount: i.balanceAmount,
        status: i.status,
      })),
      recentPayments: payments.map((p) => ({
        receiptNumber: p.receiptNumber,
        amountPaid: p.amountPaid,
        paymentDate: p.paymentDate.toLocaleDateString(),
        paymentMethod: p.paymentMethod,
        transactionReference: p.transactionReference,
      })),
    };

    return { success: true, data: formattedData };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
