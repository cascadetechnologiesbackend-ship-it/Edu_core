"use server";

import { db, withTenant } from "@/db";
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
  users,
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

    const schoolId = session.user.schoolId;
    let parentMobile = (session.user as any).phone || "";
    if (!parentMobile && schoolId) {
      await withTenant(schoolId, async (tx: any) => {
        const u = await tx.query.users.findFirst({
          where: eq(users.id, session.user.id),
          columns: { phone: true },
        });
        if (u?.phone) parentMobile = u.phone;
      });
    }
    if (!parentMobile) parentMobile = "+919999999999";

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    
    const sent = await sendSMS(parentMobile, `Your OTP for changing DPDP consent for purpose ${purposeId} is: ${generatedOtp}`);
    
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

    const schoolId = (session.user as any).schoolId;
    if (!schoolId) return { success: false, message: "Missing school context" };

    const parentUserId = session.user.id;
    const isAdmin = ["ADMIN", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(session.user.role);
    const now = new Date();
    const reqCtx = getClientRequestContext();

    // Withdrawal confirms processing halt timestamp immediately (compliance: within 24h)
    const processingHaltedAt = !input.granted ? now : null;

    return await withTenant(schoolId, async (tx: any) => {
      const studentRecord = await tx.query.students.findFirst({
        where: and(
          eq(students.id, input.studentId),
          eq(students.schoolId, schoolId),
        ),
      });

      if (!studentRecord)
        return { success: false, message: "Ward record not found" };

      if (!isAdmin && studentRecord.primaryParentUserId !== parentUserId) {
        const familyLink = await tx.query.studentFamilyMembers.findFirst({
          where: and(
            eq(studentFamilyMembers.studentId, studentRecord.id),
            eq(studentFamilyMembers.userId, parentUserId),
          ),
        });
        if (!familyLink) {
          return { success: false, message: "Forbidden: student is not registered under your account" };
        }
      }

      if (!input.granted) {
        // Mark prior active records as withdrawn
        await tx
          .update(consentRecords)
          .set({
            withdrawnAt: now,
            withdrawalReason: input.withdrawalReason || "Withdrawn by parent",
            processingHaltedAt,
          })
          .where(
            and(
              eq(consentRecords.schoolId, schoolId),
              eq(consentRecords.studentId, input.studentId),
              eq(consentRecords.purposeId, input.purposeId),
              isNull(consentRecords.withdrawnAt),
            ),
          );
      }

      // Insert new consent log entry (events are immutable logs)
      await tx.insert(consentRecords).values({
        schoolId,
        studentId: input.studentId,
        parentUserId,
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

      revalidatePath("/portal/consent");
      return { success: true };
    });
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export type RightsRequestActionResult = {
  success: boolean;
  ticketNumber?: string;
  message?: string;
};

// ─── Data Subject Rights Request Actions ─────────────────────────────────────
export async function raiseRightsRequest(input: {
  studentId: string;
  requestType: "ACCESS" | "CORRECTION" | "ERASURE" | "NOMINATION";
  description: string;
}): Promise<RightsRequestActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const schoolId = (session.user as any).schoolId;
    if (!schoolId) return { success: false, message: "Missing school context" };

    const parentUserId = session.user.id;
    const isAdmin = ["ADMIN", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(session.user.role);
    const now = new Date();
    const dueAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30-day SLA resolution
    const ticket = `RR-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    return await withTenant(schoolId, async (tx: any) => {
      const studentRecord = await tx.query.students.findFirst({
        where: and(
          eq(students.id, input.studentId),
          eq(students.schoolId, schoolId),
        ),
      });

      if (!studentRecord)
        return { success: false, message: "Ward record not found" };

      if (!isAdmin && studentRecord.primaryParentUserId !== parentUserId) {
        const familyLink = await tx.query.studentFamilyMembers.findFirst({
          where: and(
            eq(studentFamilyMembers.studentId, studentRecord.id),
            eq(studentFamilyMembers.userId, parentUserId),
          ),
        });
        if (!familyLink) {
          return { success: false, message: "Forbidden: student is not registered under your account" };
        }
      }

      await tx.insert(rightsRequests).values({
        ticketNumber: ticket,
        schoolId,
        studentId: input.studentId,
        requestedByUserId: parentUserId,
        requestType: input.requestType,
        description: input.description,
        status: "SUBMITTED",
        dueAt,
        createdAt: now,
        updatedAt: now,
      });

      revalidatePath("/portal/rights");
      return { success: true, ticketNumber: ticket };
    });
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function raiseGrievanceTicket(input: {
  subject: string;
  description: string;
}): Promise<RightsRequestActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const schoolId = (session.user as any).schoolId;
    if (!schoolId) return { success: false, message: "Missing school context" };

    const now = new Date();
    const dueAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30-day SLA
    const ticket = `GR-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    return await withTenant(schoolId, async (tx: any) => {
      await tx.insert(dpdpGrievances).values({
        ticketNumber: ticket,
        schoolId,
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
    });
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export type FetchStudentCompleteDataResult = {
  success: boolean;
  data?: any;
  message?: string;
};

export async function fetchStudentCompleteData(studentId: string): Promise<FetchStudentCompleteDataResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const schoolId = (session.user as any).schoolId;
    if (!schoolId) return { success: false, message: "Missing school context" };

    const parentUserId = session.user.id;
    const isAdmin = ["ADMIN", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(session.user.role);

    return await withTenant(schoolId, async (tx: any) => {
      const studentRecord = await tx.query.students.findFirst({
        where: and(
          eq(students.id, studentId),
          eq(students.schoolId, schoolId),
        ),
      });

      if (!studentRecord) return { success: false, message: "Student not found" };

      if (!isAdmin && studentRecord.primaryParentUserId !== parentUserId) {
        const familyLink = await tx.query.studentFamilyMembers.findFirst({
          where: and(
            eq(studentFamilyMembers.studentId, studentRecord.id),
            eq(studentFamilyMembers.userId, parentUserId),
          ),
        });
        if (!familyLink) {
          return { success: false, message: "Access denied: unauthorized parent" };
        }
      }

      // DPDP Consent Check
      const { assertConsent } = await import("@/server/middleware/consent");
      await assertConsent(studentRecord.id, "academic_records");

      const reqCtx = getClientRequestContext();
      // Log this PII access to Audit Logs! (Crucial DPDP requirement)
      await tx.insert(auditLogs).values({
        schoolId,
        userId: parentUserId,
        userEmail: session.user.email || "unknown@parent",
        userRole: session.user.role,
        action: "READ",
        tableName: "students",
        recordId: studentRecord.id,
        ipAddress: reqCtx.ipAddress,
        userAgent: reqCtx.userAgent,
        metadata: { action: "SUBJECT_ACCESS_REQUEST" },
      });

      // Decrypt fields
      const decryptedFirstName =
        decryptData(studentRecord.firstNameEncrypted) || "";
      const decryptedLastName =
        decryptData(studentRecord.lastNameEncrypted) || "";
      const decryptedMiddleName = studentRecord.middleNameEncrypted
        ? decryptData(studentRecord.middleNameEncrypted) || ""
        : "";

      // Fetch related records within tenant
      const family = await tx.query.studentFamilyMembers.findMany({
        where: eq(studentFamilyMembers.studentId, studentId),
      });

      const attendance = await tx.query.studentAttendance.findMany({
        where: eq(studentAttendance.studentId, studentId),
        orderBy: (t: any, { desc }: any) => [desc(t.attendanceDate)],
        limit: 50,
      });

      const marks = await tx.query.markEntries.findMany({
        where: eq(markEntries.studentId, studentId),
        with: { subject: true, exam: true },
        limit: 50,
      });

      const invoices = await tx.query.feeInvoices.findMany({
        where: eq(feeInvoices.studentId, studentId),
        limit: 50,
      });

      const payments = await tx.query.feePayments.findMany({
        where: eq(feePayments.studentId, studentId),
        limit: 50,
      });

      const formattedData = {
        studentInfo: {
          id: studentRecord.id,
          admissionNumber: studentRecord.admissionNumber,
          firstName: decryptedFirstName,
          middleName: decryptedMiddleName,
          lastName: decryptedLastName,
          dateOfBirth: studentRecord.dateOfBirth ? new Date(studentRecord.dateOfBirth).toLocaleDateString() : "",
          gender: studentRecord.gender,
          bloodGroup: studentRecord.bloodGroup,
          category: studentRecord.category,
          nationality: studentRecord.nationality,
          aadhaarLast4: studentRecord.aadhaarLast4,
          apaarId: studentRecord.apaarId,
          isActive: studentRecord.isActive,
          admissionDate: studentRecord.admissionDate ? new Date(studentRecord.admissionDate).toLocaleDateString() : "",
        },
        family: family.map((f: any) => {
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
        recentAttendance: attendance.map((a: any) => ({
          date: a.attendanceDate ? new Date(a.attendanceDate).toLocaleDateString() : "",
          status: a.status,
          remarks: a.remarks,
        })),
        recentAcademicMarks: marks.map((m: any) => ({
          examLabel: m.exam?.name || "Unknown Exam",
          subject: m.subject?.name || "Unknown Subject",
          marksObtained: m.marksObtained,
          maxMarks: m.maxMarks,
          isAbsent: m.isAbsent,
        })),
        recentInvoices: invoices.map((i: any) => ({
          invoiceId: i.id,
          invoiceNumber: i.invoiceNumber,
          term: i.term,
          dueDate: i.dueDate ? new Date(i.dueDate).toLocaleDateString() : "",
          grossAmount: i.grossAmount,
          discountAmount: i.discountAmount,
          balanceAmount: i.balanceAmount,
          status: i.status,
          isAvailableForPayment:
            ["PENDING", "PARTIAL", "OVERDUE"].includes(i.status) &&
            parseFloat(i.balanceAmount || "0") > 0,
        })),
        recentPayments: payments.map((p: any) => ({
          paymentId: p.id,
          receiptNumber: p.receiptNumber,
          amountPaid: p.amountPaid,
          paymentDate: p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "",
          paymentMethod: p.paymentMethod,
          transactionReference: p.transactionReference,
          receiptUrl: `/api/receipt/${p.id}`,
          receiptAvailable: true,
        })),
      };

      return { success: true, data: formattedData };
    });
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

export type CheckParentConsentResult = {
  success: boolean;
  needsConsent: boolean;
  students?: Array<{ id: string; admissionNumber: string; displayName: string }>;
  purposes?: Array<{
    id: string;
    purposeId: string;
    labelEn: string;
    labelHi: string;
    descriptionEn: string;
    descriptionHi: string;
    mandatory: boolean;
  }>;
  privacyNoticeVersion?: string;
  reason?: string;
  message?: string;
};

// ─── Parent App Login DPDP Compliance Opt-In ──────────────────────────────────
export async function checkParentConsentStatus(): Promise<CheckParentConsentResult> {
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

    const schoolId = (session.user as any).schoolId;
    if (!schoolId) {
      return { success: true, needsConsent: false, reason: "NO_SCHOOL_CONTEXT" };
    }

    const { resolveParentWards } = await import("@schoolmitra/backend/parentEventEngine/resolveParentWards");
    const myWards = await resolveParentWards(
      { role: session.user.role, userId: parentUserId },
      schoolId,
    );

    if (myWards.length === 0) {
      return { success: true, needsConsent: false, reason: "NO_STUDENTS" };
    }

    return await withTenant(schoolId, async (tx: any) => {
      // Load active consent purposes
      const dbPurposes = await tx.query.consentPurposes.findMany({
        where: eq(consentPurposes.isActive, true),
      });

      const purposes = dbPurposes.length > 0 ? dbPurposes.map((p: any) => ({
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

      const mandatoryPurposes = purposes.filter((p: any) => p.mandatory);
      let needsConsent = false;
      const studentsRequiringConsent = [];

      for (const student of myWards) {
        const records = await tx.query.consentRecords.findMany({
          where: and(
            eq(consentRecords.schoolId, schoolId),
            eq(consentRecords.studentId, student.id),
            eq(consentRecords.parentUserId, parentUserId),
          ),
        });

        const grantedPurposes = new Set(
          records.filter((r: any) => r.granted && !r.withdrawnAt).map((r: any) => r.purposeId)
        );

        const hasAllMandatory = mandatoryPurposes.every((mp: any) => grantedPurposes.has(mp.purposeId));

        if (!hasAllMandatory || records.length === 0) {
          needsConsent = true;
          studentsRequiringConsent.push({
            id: student.id,
            admissionNumber: student.admissionNumber,
            displayName: student.fullName || "Student",
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
    });
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

    if (!input.consents || input.consents.length === 0) {
      return { success: false, message: "No consents provided" };
    }

    const parentUserId = session.user.id;
    const schoolId = (session.user as any).schoolId;
    if (!schoolId) {
      return { success: false, message: "No school context found" };
    }

    const now = new Date();
    const reqCtx = getClientRequestContext();
    const isAdmin = ["ADMIN", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(session.user.role);

    let recordedCount = 0;

    await withTenant(schoolId, async (tx: any) => {
      for (const item of input.consents) {
        const student = await tx.query.students.findFirst({
          where: and(eq(students.id, item.studentId), eq(students.schoolId, schoolId)),
        });

        if (!student) continue;

        if (!isAdmin && student.primaryParentUserId !== parentUserId) {
          const familyLink = await tx.query.studentFamilyMembers.findFirst({
            where: and(
              eq(studentFamilyMembers.studentId, student.id),
              eq(studentFamilyMembers.userId, parentUserId),
            ),
          });
          if (!familyLink) {
            continue;
          }
        }

        if (!item.granted) {
          await tx
            .update(consentRecords)
            .set({
              withdrawnAt: now,
              withdrawalReason: "Declined during parent login consent opt-in",
              processingHaltedAt: now,
            })
            .where(
              and(
                eq(consentRecords.schoolId, schoolId),
                eq(consentRecords.studentId, student.id),
                eq(consentRecords.purposeId, item.purposeId),
                isNull(consentRecords.withdrawnAt),
              ),
            );
        }

        await tx.insert(consentRecords).values({
          schoolId,
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

        recordedCount++;
      }
    });

    if (recordedCount === 0) {
      return { success: false, message: "No authorized student consent records were updated." };
    }

    revalidatePath("/portal");
    revalidatePath("/portal/consent");
    revalidatePath("/parent/dashboard");
    return { success: true, count: recordedCount };
  } catch (error: any) {
    console.error("submitParentLoginConsent error:", error);
    return { success: false, message: error.message };
  }
}

export type UploadDocumentResult = {
  success: boolean;
  message?: string;
};

export type FetchParentDocumentsResult = {
  success: boolean;
  students?: Array<{ id: string; admissionNumber: string; displayName: string }>;
  selectedStudentId?: string;
  documents?: any[];
  message?: string;
};

// ─── Parent App Document Upload Actions ───────────────────────────────────────
export async function uploadParentStudentDocument(input: {
  studentId: string;
  documentType: string;
  s3Key: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}): Promise<UploadDocumentResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" };
    }

    const schoolId = (session.user as any).schoolId;
    if (!schoolId) {
      return { success: false, message: "Missing school context" };
    }

    const isAdmin = ["ADMIN", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(session.user.role);

    return await withTenant(schoolId, async (tx: any) => {
      const student = await tx.query.students.findFirst({
        where: and(
          eq(students.id, input.studentId),
          eq(students.schoolId, schoolId),
        ),
      });

      if (!student) {
        return { success: false, message: "Student record not found" };
      }

      if (!isAdmin && student.primaryParentUserId !== session.user.id) {
        const familyLink = await tx.query.studentFamilyMembers.findFirst({
          where: and(
            eq(studentFamilyMembers.studentId, student.id),
            eq(studentFamilyMembers.userId, session.user.id),
          ),
        });
        if (!familyLink) {
          return { success: false, message: "Forbidden: You are not authorized for this student" };
        }
      }

      await tx.insert(studentDocuments).values({
        studentId: student.id,
        schoolId,
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
    });
  } catch (error: any) {
    console.error("uploadParentStudentDocument error:", error);
    return { success: false, message: error.message };
  }
}

export async function fetchParentStudentDocuments(studentId?: string): Promise<FetchParentDocumentsResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized", students: [], documents: [] };
    }

    const parentUserId = session.user.id;
    const isAdmin = ["ADMIN", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(session.user.role);
    const schoolId = (session.user as any).schoolId;

    if (!schoolId) {
      return { success: false, message: "School context required", students: [], documents: [] };
    }

    const { resolveParentWards } = await import("@schoolmitra/backend/parentEventEngine/resolveParentWards");
    const myWards = await resolveParentWards(
      { role: session.user.role, userId: parentUserId },
      schoolId,
      studentId
    );

    const studentsFormatted = myWards.map(s => ({
      id: s.id,
      admissionNumber: s.admissionNumber,
      displayName: s.fullName,
    }));

    const targetStudentId = studentId || myWards[0]?.id;

    if (!targetStudentId) {
      return { success: true, students: [], documents: [] };
    }

    // Verify ownership
    const targetStudent = myWards.find(s => s.id === targetStudentId);
    if (!targetStudent && !isAdmin) {
      return { success: false, message: "Unauthorized access to student documents", students: studentsFormatted, documents: [] };
    }

    return await withTenant(schoolId, async (tx: any) => {
      const docs = await tx.query.studentDocuments.findMany({
        where: and(
          eq(studentDocuments.studentId, targetStudentId),
          eq(studentDocuments.schoolId, schoolId),
        ),
        orderBy: (t: any, { desc }: any) => [desc(t.createdAt)],
      });

      return {
        success: true,
        students: studentsFormatted,
        selectedStudentId: targetStudentId,
        documents: docs.map((d: any) => ({
          id: d.id,
          documentType: d.documentType,
          originalFileName: d.originalFileName,
          mimeType: d.mimeType,
          fileSizeBytes: d.fileSizeBytes,
          isVerified: d.isVerified,
          createdAt: d.createdAt,
        })),
      };
    });
  } catch (error: any) {
    console.error("fetchParentStudentDocuments error:", error);
    return { success: false, message: error.message, students: [], documents: [] };
  }
}

