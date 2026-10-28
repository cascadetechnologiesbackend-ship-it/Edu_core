"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import { studentDocumentRequests, students } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { encryptData, decryptData } from "@/lib/encryption";
import { validateDocumentUpload } from "@/lib/parentEventEngine/documentProfileEngine";
import { dispatchParentNotification } from "@/lib/parentEventEngine/notificationMatrix";

export interface SubmitDocumentInput {
  requestId: string;
  studentId: string;
  fileKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface StudentDocumentItem {
  id: string;
  studentId: string;
  documentType: string;
  title: string;
  description: string | null;
  status: "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED" | "EXPIRED";
  fileName: string | null;
  fileSizeBytes: number | null;
  dueAt: string | null;
  expiresAt: string | null;
  rejectionReason: string | null;
  verificationNote: string | null;
  uploadedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

/**
 * Parent Action: Submits a file for an open document request (Workflow OP6, AC-P24).
 * Encrypts private file key for S3/storage reference.
 */
export async function submitDocumentRequest(
  input: SubmitDocumentInput
): Promise<{ success: boolean; requestId?: string | undefined; error?: string | undefined }> {
  try {
    const ctx = await requireAuth(["PARENT", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const validation = validateDocumentUpload({
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });

    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    if (!input.fileKey?.trim()) {
      return { success: false, error: "File key is required." };
    }

    return await withTenant(school.id, async () => {
      // 1. Verify parent authorization
      if (ctx.role === "PARENT") {
        const [student] = await db
          .select({ primaryParentUserId: students.primaryParentUserId })
          .from(students)
          .where(and(eq(students.id, input.studentId), eq(students.schoolId, school.id)));

        if (!student || student.primaryParentUserId !== ctx.userId) {
          return { success: false, error: "Forbidden: Not authorized for this student." };
        }
      }

      // 2. Verify document request exists
      const [req] = await db
        .select()
        .from(studentDocumentRequests)
        .where(
          and(
            eq(studentDocumentRequests.id, input.requestId),
            eq(studentDocumentRequests.studentId, input.studentId),
            eq(studentDocumentRequests.schoolId, school.id)
          )
        );

      if (!req) {
        return { success: false, error: "Document request not found." };
      }

      if (req.status === "VERIFIED") {
        return { success: false, error: "Document has already been verified and cannot be re-uploaded." };
      }

      const submittedS3Key = encryptData(input.fileKey);

      await db
        .update(studentDocumentRequests)
        .set({
          status: "SUBMITTED",
          submittedS3Key,
          originalFileName: input.filename,
          mimeType: input.mimeType,
          fileSizeBytes: input.sizeBytes,
          verificationNote: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(studentDocumentRequests.id, input.requestId),
            eq(studentDocumentRequests.schoolId, school.id)
          )
        );

      revalidatePath("/parent");
      revalidatePath(`/parent/student/${input.studentId}`);

      return { success: true, requestId: input.requestId };
    });
  } catch (err: any) {
    console.error("submitDocumentRequest error:", err);
    return { success: false, error: err?.message || "Failed to submit document." };
  }
}

/**
 * Fetches all document requests for a student.
 */
export async function getDocumentRequests(
  studentId: string
): Promise<{ success: boolean; data?: StudentDocumentItem[] | undefined; error?: string | undefined }> {
  try {
    const ctx = await requireAuth(["PARENT", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const);
    const school = await requireSchool(ctx);

    return await withTenant(school.id, async () => {
      if (ctx.role === "PARENT") {
        const [student] = await db
          .select({ primaryParentUserId: students.primaryParentUserId })
          .from(students)
          .where(and(eq(students.id, studentId), eq(students.schoolId, school.id)));

        if (!student || student.primaryParentUserId !== ctx.userId) {
          return { success: false, error: "Forbidden: Not authorized for this student." };
        }
      }

      const rows = await db
        .select()
        .from(studentDocumentRequests)
        .where(
          and(
            eq(studentDocumentRequests.studentId, studentId),
            eq(studentDocumentRequests.schoolId, school.id)
          )
        )
        .orderBy(desc(studentDocumentRequests.createdAt));

      const items: StudentDocumentItem[] = rows.map((r) => {
        return {
          id: r.id,
          studentId: r.studentId,
          documentType: r.documentType,
          title: r.title,
          description: r.description,
          status: r.status as StudentDocumentItem["status"],
          fileName: r.originalFileName,
          fileSizeBytes: r.fileSizeBytes,
          dueAt: r.dueAt ? new Date(r.dueAt).toISOString() : null,
          expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
          rejectionReason: r.status === "REJECTED" ? r.verificationNote : null,
          verificationNote: r.verificationNote,
          uploadedAt: r.submittedS3Key ? new Date(r.updatedAt).toISOString() : null,
          verifiedAt: r.verifiedAt ? new Date(r.verifiedAt).toISOString() : null,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        };
      });

      return { success: true, data: items };
    });
  } catch (err: any) {
    console.error("getDocumentRequests error:", err);
    return { success: false, error: err?.message || "Failed to fetch document requests." };
  }
}

/**
 * Admin Action: Verifies or rejects a document submission (OP6).
 */
export async function verifyDocumentRequest(input: {
  requestId: string;
  status: "VERIFIED" | "REJECTED";
  note?: string | undefined;
  expiresAt?: string | Date | undefined;
}): Promise<{ success: boolean; error?: string | undefined }> {
  try {
    const ctx = await requireAuth(["SCHOOL_ADMIN", "SUPER_ADMIN"] as const);
    const school = await requireSchool(ctx);

    return await withTenant(school.id, async () => {
      const [req] = await db
        .select()
        .from(studentDocumentRequests)
        .where(
          and(
            eq(studentDocumentRequests.id, input.requestId),
            eq(studentDocumentRequests.schoolId, school.id)
          )
        );

      if (!req) {
        return { success: false, error: "Document request not found." };
      }

      const expiresAtDate = input.expiresAt ? new Date(input.expiresAt) : null;

      await db
        .update(studentDocumentRequests)
        .set({
          status: input.status,
          verificationNote: input.note || null,
          expiresAt: expiresAtDate,
          verifiedByUserId: ctx.userId,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(studentDocumentRequests.id, input.requestId),
            eq(studentDocumentRequests.schoolId, school.id)
          )
        );

      // Dispatch parent notification
      const [student] = await db
        .select({
          primaryParentUserId: students.primaryParentUserId,
          firstNameEncrypted: students.firstNameEncrypted,
        })
        .from(students)
        .where(and(eq(students.id, req.studentId), eq(students.schoolId, school.id)));

      if (student?.primaryParentUserId) {
        const studentFirstName = student.firstNameEncrypted
          ? decryptData(student.firstNameEncrypted) || "Child"
          : "Child";
        const isVerified = input.status === "VERIFIED";

        await dispatchParentNotification(
          school.id,
          {
            studentId: req.studentId,
            parentUserId: student.primaryParentUserId,
            tier: isVerified ? "T3_system_state" : "T2_informational",
            eventKind: isVerified ? "DOCUMENT_VERIFIED" : "DOCUMENT_REJECTED",
            todayPushCountForParent: 0,
            previouslyDispatchedDedupeKeys: new Set(),
          },
          {
            title: isVerified ? "Document Verified" : "Document Review Required",
            body: isVerified
              ? `The school has approved ${req.title} for ${studentFirstName}.`
              : `Uploaded ${req.title} for ${studentFirstName} was rejected: ${input.note || "Please re-upload."}`,
            data: { url: `/parent` },
          }
        );
      }

      revalidatePath("/parent");
      revalidatePath(`/parent/student/${req.studentId}`);

      return { success: true };
    });
  } catch (err: any) {
    console.error("verifyDocumentRequest error:", err);
    return { success: false, error: err?.message || "Failed to verify document request." };
  }
}
