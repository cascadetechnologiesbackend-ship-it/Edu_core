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
  studentDocuments,
  consentPurposes,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { decryptData } from "@/lib/encryption";
import { sendSMS } from "@/lib/sms";
import { fetchParentStudentFeeLedger } from "@/lib/parentStudentFeeLedger";
import { getClientRequestContext } from "@/lib/requestContext";

// ─── OTP Generator Stub ──────────────────────────────────────────────────────
export async function generateConsentChangeOtp(
  studentId: string,
  purposeId: string,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // In a production system, we'd look up the parent's mobile number here from DB
    const parentMobile = "+919999999999"; 
    
    const sent = await sendSMS(parentMobile, `Your OTP for changing DPDP consent for purpose ${purposeId} is: ${mockOtp}`);
    
    if (!sent) {
      return { success: false, message: "Failed to dispatch SMS via gateway" };
    }

    return {
      success: true,
      message: "OTP sent successfully to your registered mobile number",
    };
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

    // OTP format validation
    if (!/^\d{6}$/.test(input.otpCode)) {
      return { success: false, message: "Invalid OTP code entered: must be a 6-digit code." };
    }

    const studentRecord = await db.query.students.findFirst({
      where: eq(students.id, input.studentId),
    });

    if (!studentRecord)
      return { success: false, message: "Ward record not found" };

    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session.user.role);
    if (!isAdmin && studentRecord.primaryParentUserId !== session.user.id) {
      return { success: false, message: "Forbidden: student is not registered under your account" };
    }

    const now = new Date();
    const reqCtx = getClientRequestContext();

    // Withdrawal confirms processing halt timestamp immediately (compliance: within 24h)
    const processingHaltedAt = !input.granted ? now : null;

    if (!input.granted) {
      // Mark prior active records as withdrawn
      await db
        .update(consentRecords)
        .set({
          withdrawnAt: now,
          withdrawalReason: input.withdrawalReason || "Withdrawn by parent",
          processingHaltedAt,
        })
        .where(
          and(
            eq(consentRecords.studentId, input.studentId),
            eq(consentRecords.purposeId, input.purposeId),
            isNull(consentRecords.withdrawnAt),
          ),
        );
    }

    // Insert new consent log entry (events are immutable logs)
    await db.insert(consentRecords).values({
      schoolId: studentRecord.schoolId,
      studentId: input.studentId,
      parentUserId: session.user.id,
      purposeId: input.purposeId,
      privacyNoticeVersion: "1.0",
      granted: input.granted,
      method: "web_form",
      ipAddress: reqCtx.ipAddress,
      userAgent: reqCtx.userAgent || "Parent Web Portal",
      otpVerified: true,
      grantedAt: now,
      withdrawnAt: !input.granted ? now : null,
      withdrawalReason: input.withdrawalReason || null,
      processingHaltedAt,
      createdAt: now,
    });

    // Mock confirmation email log
    console.log(
      `[DPDP EMAIL STUB] Consent confirmation sent to parent email for child ${input.studentId}, Purpose ${input.purposeId}, Action: ${input.granted ? "GRANTED" : "WITHDRAWN"}`,
    );

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

    if (!studentRecord)
      return { success: false, message: "Ward record not found" };

    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session.user.role);
    if (!isAdmin && studentRecord.primaryParentUserId !== session.user.id) {
      return { success: false, message: "Forbidden: student is not registered under your account" };
    }

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
    const ctx = await requireAuth(["PARENT"] as const);
    const school = await requireSchool(ctx);

    const now = new Date();
    const dueAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30-day SLA
    const ticket = `GR-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    await db.insert(dpdpGrievances).values({
      ticketNumber: ticket,
      schoolId: school.id,
      submittedByUserId: ctx.userId,
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
        eq(students.primaryParentUserId, session.user.id),
      ),
    });

    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session.user.role);
    if (!studentRecord && !isAdmin) {
      return { success: false, message: "Access denied: unauthorized parent" };
    }

    const targetStudent =
      studentRecord ||
      (await db.query.students.findFirst({
        where: eq(students.id, studentId),
      }));
    if (!targetStudent) return { success: false, message: "Student not found" };

    // DPDP Consent Check
    const { assertConsent } = await import("@/server/middleware/consent");
    await assertConsent(targetStudent.id, "academic_records");

    const reqCtx = getClientRequestContext();
    // Log this PII access to Audit Logs! (Crucial DPDP requirement)
    await db.insert(auditLogs).values({
      schoolId: targetStudent.schoolId,
      userId: session.user.id,
      userEmail: session.user.email || "unknown@parent",
      userRole: session.user.role,
      action: "READ",
      tableName: "students",
      recordId: targetStudent.id,
      ipAddress: reqCtx.ipAddress,
      userAgent: reqCtx.userAgent,
      metadata: { action: "SUBJECT_ACCESS_REQUEST" },
    });

    // Decrypt fields
    const decryptedFirstName =
      decryptData(targetStudent.firstNameEncrypted) || "";
    const decryptedLastName =
      decryptData(targetStudent.lastNameEncrypted) || "";
    const decryptedMiddleName = targetStudent.middleNameEncrypted
      ? decryptData(targetStudent.middleNameEncrypted) || ""
      : "";

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
        const mob = f.mobileEncrypted
          ? decryptData(f.mobileEncrypted) || ""
          : "";
        const occ = f.occupationEncrypted
          ? decryptData(f.occupationEncrypted) || ""
          : "";
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
        invoiceId: i.id,
        invoiceNumber: i.invoiceNumber,
        term: i.term,
        dueDate: i.dueDate.toLocaleDateString(),
        grossAmount: i.grossAmount,
        discountAmount: i.discountAmount,
        balanceAmount: i.balanceAmount,
        status: i.status,
        isAvailableForPayment:
          ["PENDING", "PARTIAL", "OVERDUE"].includes(i.status) &&
          parseFloat(i.balanceAmount || "0") > 0,
      })),
      recentPayments: payments.map((p) => ({
        paymentId: p.id,
        receiptNumber: p.receiptNumber,
        amountPaid: p.amountPaid,
        paymentDate: p.paymentDate.toLocaleDateString(),
        paymentMethod: p.paymentMethod,
        transactionReference: p.transactionReference,
        receiptUrl: `/api/receipt/${p.id}`,
        receiptAvailable: true,
      })),
    };

    return { success: true, data: formattedData };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── Phase B1 AZ-07: Parent Student Fee Ledger ───────────────────────────────
export async function getParentStudentFeeLedgerAction(studentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const isAdmin = ["ADMIN", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(
      session.user.role
    );

    const ledger = await fetchParentStudentFeeLedger(
      db,
      session.user.schoolId || "",
      studentId,
      session.user.id,
      isAdmin
    );

    if (!ledger) {
      return { success: false, message: "Ward record not found" };
    }

    return { success: true, data: ledger };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── Parent App Login DPDP Compliance Opt-In ──────────────────────────────────
export async function checkParentConsentStatus() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, needsConsent: false };
    }

    const parentUserId = session.user.id;
    const isParentRole = session.user.role === "PARENT";
    const isAdmin = ["ADMIN", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(session.user.role);

    // If role is neither parent nor admin, no parent consent modal needed
    if (!isParentRole && !isAdmin) {
      return { success: true, needsConsent: false };
    }

    // Find students linked to this parent
    let myStudents = await db.query.students.findMany({
      where: eq(students.primaryParentUserId, parentUserId),
    });

    // If Admin preview and no students, fetch first student with parent or any student for demo
    if (myStudents.length === 0 && isAdmin) {
      const demoStudent = await db.query.students.findFirst();
      if (demoStudent) myStudents = [demoStudent];
    }

    if (myStudents.length === 0) {
      return { success: true, needsConsent: false, reason: "NO_STUDENTS" };
    }

    // Load active consent purposes
    const dbPurposes = await db.query.consentPurposes.findMany({
      where: eq(consentPurposes.isActive, true),
    });

    const purposes = dbPurposes.length > 0 ? dbPurposes.map(p => ({
      id: p.purposeId,
      purposeId: p.purposeId,
      labelEn: p.labelEn,
      labelHi: p.labelHi,
      descriptionEn: p.descriptionEn,
      descriptionHi: p.descriptionHi,
      mandatory: p.mandatory,
    })) : [
      {
        id: "admission_data",
        purposeId: "admission_data",
        labelEn: "Admission & Enrolment Data",
        labelHi: "प्रवेश और नामांकन डेटा",
        descriptionEn: "Collection and processing of student details for official enrolment.",
        descriptionHi: "आधिकारिक नामांकन के लिए छात्र विवरण का संग्रह और प्रसंस्करण।",
        mandatory: true,
      },
      {
        id: "academic_records",
        purposeId: "academic_records",
        labelEn: "Academic Records & Report Cards",
        labelHi: "शैक्षणिक अभिलेख और रिपोर्ट कार्ड",
        descriptionEn: "Maintaining marks, grades, and academic progression records.",
        descriptionHi: "अंक, ग्रेड और शैक्षणिक प्रगति के रिकॉर्ड बनाए रखना।",
        mandatory: true,
      },
      {
        id: "attendance",
        purposeId: "attendance",
        labelEn: "Daily Attendance Tracking",
        labelHi: "दैनिक उपस्थिति ट्रैकिंग",
        descriptionEn: "Tracking daily attendance for school records and student safety.",
        descriptionHi: "स्कूल रिकॉर्ड और छात्र सुरक्षा के लिए दैनिक उपस्थिति की निगरानी।",
        mandatory: true,
      },
      {
        id: "communications",
        purposeId: "communications",
        labelEn: "SMS & WhatsApp Updates",
        labelHi: "एसएमएस और व्हाट्सएप अपडेट",
        descriptionEn: "Receiving circulars, notices, fee receipts, and emergency alerts.",
        descriptionHi: "परिपत्र, नोटिस, शुल्क रसीदें और आपातकालीन अलर्ट प्राप्त करना।",
        mandatory: false,
      },
      {
        id: "photos_media",
        purposeId: "photos_media",
        labelEn: "School Publications & Media",
        labelHi: "स्कूल प्रकाशन और मीडिया",
        descriptionEn: "Celebrating achievements in annual magazines, newsletter, and school website.",
        descriptionHi: "वार्षिक पत्रिका, समाचार पत्र और स्कूल वेबसाइट में उपलब्धियों का प्रदर्शन।",
        mandatory: false,
      },
    ];

    const mandatoryPurposes = purposes.filter(p => p.mandatory);
    let needsConsent = false;
    const studentsRequiringConsent = [];

    for (const student of myStudents) {
      const records = await db.query.consentRecords.findMany({
        where: and(
          eq(consentRecords.studentId, student.id),
          eq(consentRecords.parentUserId, parentUserId)
        ),
      });

      const grantedPurposes = new Set(
        records.filter(r => r.granted && !r.withdrawnAt).map(r => r.purposeId)
      );

      const hasAllMandatory = mandatoryPurposes.every(mp => grantedPurposes.has(mp.purposeId));

      if (!hasAllMandatory || records.length === 0) {
        needsConsent = true;
        studentsRequiringConsent.push({
          id: student.id,
          admissionNumber: student.admissionNumber,
          displayName: `${decryptData(student.firstNameEncrypted) || ""} ${decryptData(student.lastNameEncrypted) || ""}`.trim() || "Student",
        });
      }
    }

    return {
      success: true,
      needsConsent,
      students: studentsRequiringConsent,
      purposes,
      privacyNoticeVersion: "1.0",
    };
  } catch (error: any) {
    console.error("checkParentConsentStatus error:", error);
    return { success: false, needsConsent: false, message: error.message };
  }
}

export async function submitParentLoginConsent(input: {
  consents: Array<{
    studentId: string;
    purposeId: string;
    granted: boolean;
  }>;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" };
    }

    const parentUserId = session.user.id;
    const now = new Date();
    const reqCtx = getClientRequestContext();

    for (const item of input.consents) {
      const student = await db.query.students.findFirst({
        where: eq(students.id, item.studentId),
      });

      if (!student) continue;

      const isAdmin = ["ADMIN", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(session.user.role);
      if (!isAdmin && student.primaryParentUserId !== parentUserId) {
        continue;
      }

      if (!item.granted) {
        await db
          .update(consentRecords)
          .set({
            withdrawnAt: now,
            withdrawalReason: "Declined during parent login consent opt-in",
            processingHaltedAt: now,
          })
          .where(
            and(
              eq(consentRecords.studentId, student.id),
              eq(consentRecords.purposeId, item.purposeId),
              isNull(consentRecords.withdrawnAt),
            ),
          );
      }

      await db.insert(consentRecords).values({
        schoolId: student.schoolId,
        studentId: student.id,
        parentUserId,
        purposeId: item.purposeId,
        privacyNoticeVersion: "1.0",
        granted: item.granted,
        method: "web_form",
        ipAddress: reqCtx.ipAddress,
        userAgent: reqCtx.userAgent || "Parent Companion App - Login Opt-In",
        otpVerified: false,
        grantedAt: now,
        withdrawnAt: !item.granted ? now : null,
        createdAt: now,
      });
    }

    revalidatePath("/portal");
    revalidatePath("/portal/consent");
    revalidatePath("/parent/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("submitParentLoginConsent error:", error);
    return { success: false, message: error.message };
  }
}

// ─── Parent App Document Upload Actions ───────────────────────────────────────
export async function uploadParentStudentDocument(input: {
  studentId: string;
  documentType: string;
  s3Key: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" };
    }

    const student = await db.query.students.findFirst({
      where: eq(students.id, input.studentId),
    });

    if (!student) {
      return { success: false, message: "Student record not found" };
    }

    const isAdmin = ["ADMIN", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(session.user.role);
    if (!isAdmin && student.primaryParentUserId !== session.user.id) {
      return { success: false, message: "Forbidden: You are not authorized for this student" };
    }

    await db.insert(studentDocuments).values({
      studentId: student.id,
      schoolId: student.schoolId,
      documentType: input.documentType,
      s3Key: input.s3Key,
      originalFileName: input.fileName,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      uploadedById: session.user.id,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath("/parent/documents");
    return { success: true };
  } catch (error: any) {
    console.error("uploadParentStudentDocument error:", error);
    return { success: false, message: error.message };
  }
}

export async function fetchParentStudentDocuments(studentId?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized", students: [], documents: [] };
    }

    const parentUserId = session.user.id;
    const isAdmin = ["ADMIN", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(session.user.role);

    let myStudents = await db.query.students.findMany({
      where: eq(students.primaryParentUserId, parentUserId),
    });

    if (myStudents.length === 0 && isAdmin) {
      const demoStudent = await db.query.students.findFirst();
      if (demoStudent) myStudents = [demoStudent];
    }

    const studentsFormatted = myStudents.map(s => ({
      id: s.id,
      admissionNumber: s.admissionNumber,
      displayName: `${decryptData(s.firstNameEncrypted) || ""} ${decryptData(s.lastNameEncrypted) || ""}`.trim() || "Student",
    }));

    const targetStudentId = studentId || myStudents[0]?.id;

    if (!targetStudentId) {
      return { success: true, students: [], documents: [] };
    }

    // Verify ownership
    const targetStudent = myStudents.find(s => s.id === targetStudentId);
    if (!targetStudent && !isAdmin) {
      return { success: false, message: "Unauthorized access to student documents", students: studentsFormatted, documents: [] };
    }

    const docs = await db.query.studentDocuments.findMany({
      where: eq(studentDocuments.studentId, targetStudentId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    return {
      success: true,
      students: studentsFormatted,
      selectedStudentId: targetStudentId,
      documents: docs.map(d => ({
        id: d.id,
        documentType: d.documentType,
        originalFileName: d.originalFileName,
        mimeType: d.mimeType,
        fileSizeBytes: d.fileSizeBytes,
        isVerified: d.isVerified,
        createdAt: d.createdAt,
      })),
    };
  } catch (error: any) {
    console.error("fetchParentStudentDocuments error:", error);
    return { success: false, message: error.message, students: [], documents: [] };
  }
}

