"use server";

import { db } from "@/db";
import {
  students,
  sections,
  sectionSubjectTeachers,
  classSubjects,
  studentDocuments,
  auditLogs,
} from "@/db/schema";
import { desc, eq, and, inArray, or, ilike, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { decryptData, computeSearchHash, computeLegacySearchHash } from "@/lib/encryption";
import { assertRouteAccess } from "@/lib/routeGuards";
import { getClientRequestContext } from "@/lib/requestContext";
import type { StudentListItem } from "./StudentDirectoryClient";

export interface SearchStudentsParams {
  search?: string;
  classId?: string;
  status?: string;
  cursor?: string; // createdAt ISO string for cursor pagination
  limit?: number;
}

export interface SearchStudentsResult {
  students: StudentListItem[];
  nextCursor: string | null;
  totalReturned: number;
}

export async function searchStudentsAction(
  params: SearchStudentsParams = {}
): Promise<SearchStudentsResult> {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/students", { id: ctx.userId, email: ctx.email });
  if (!access.allowed) {
    throw new Error("Unauthorized access to students directory.");
  }

  const school = await requireSchool(ctx);
  const limit = Math.min(params.limit || 30, 50);

  // Determine role-based scoping
  let allowedSectionIds: string[] | null = null;

  if (ctx.role === "TEACHER") {
    const [ctSections, saSections, dtClasses] = await Promise.all([
      db.query.sections.findMany({
        where: and(
          eq(sections.schoolId, school.id),
          eq(sections.classTeacherId, ctx.userId),
          eq(sections.isActive, true),
        ),
        columns: { id: true },
      }),
      db.query.sectionSubjectTeachers.findMany({
        where: and(
          eq(sectionSubjectTeachers.schoolId, school.id),
          eq(sectionSubjectTeachers.teacherId, ctx.userId),
          eq(sectionSubjectTeachers.isActive, true),
        ),
        columns: { sectionId: true },
      }),
      db.query.classSubjects.findMany({
        where: and(
          eq(classSubjects.schoolId, school.id),
          eq(classSubjects.assignedTeacherId, ctx.userId),
        ),
        columns: { classId: true },
      }),
    ]);

    const allSections = await db.query.sections.findMany({
      where: eq(sections.schoolId, school.id),
      columns: { id: true, classId: true, isActive: true },
    });

    const defaultTeacherSections = dtClasses.length > 0
      ? allSections.filter((s) => dtClasses.some((c) => c.classId === s.classId) && s.isActive).map((s) => s.id)
      : [];

    const sectionIdSet = new Set<string>([
      ...ctSections.map((s) => s.id),
      ...saSections.map((s) => s.sectionId),
      ...defaultTeacherSections,
    ]);
    allowedSectionIds = Array.from(sectionIdSet);
  }

  // Build filter conditions
  const conditions = [eq(students.schoolId, school.id)];

  if (allowedSectionIds !== null) {
    if (allowedSectionIds.length > 0) {
      conditions.push(inArray(students.currentSectionId, allowedSectionIds));
    } else {
      conditions.push(eq(students.id, "00000000-0000-0000-0000-000000000000"));
    }
  }

  if (params.classId && params.classId !== "ALL") {
    conditions.push(eq(students.currentClassId, params.classId));
  }

  if (params.status === "ACTIVE") {
    conditions.push(eq(students.isActive, true));
  } else if (params.status === "INACTIVE") {
    conditions.push(eq(students.isActive, false));
  }

  if (params.cursor) {
    const cursorDate = new Date(params.cursor);
    if (!isNaN(cursorDate.getTime())) {
      conditions.push(lt(students.createdAt, cursorDate));
    }
  }

  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    const hash = computeSearchHash(term);
    const legacyHash = computeLegacySearchHash(term);

    conditions.push(
      or(
        ilike(students.admissionNumber, `%${term}%`),
        eq(students.firstNameSearchHash, hash),
        eq(students.lastNameSearchHash, hash),
        eq(students.firstNameSearchHash, legacyHash),
        eq(students.lastNameSearchHash, legacyHash)
      )!
    );
  }

  const [studentRows, allSections] = await Promise.all([
    db.query.students.findMany({
      where: and(...conditions),
      columns: {
        id: true,
        admissionNumber: true,
        firstNameEncrypted: true,
        lastNameEncrypted: true,
        gender: true,
        currentClassId: true,
        currentSectionId: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [desc(students.createdAt)],
      limit: limit + 1, // +1 to determine if next page exists
    }),
    db.query.sections.findMany({
      where: eq(sections.schoolId, school.id),
      with: { class: true },
    }),
  ]);

  const hasNextPage = studentRows.length > limit;
  const pagedRows = hasNextPage ? studentRows.slice(0, limit) : studentRows;
  const nextCursor = hasNextPage && pagedRows.length > 0
    ? pagedRows[pagedRows.length - 1]!.createdAt.toISOString()
    : null;

  const sectionMap = new Map(allSections.map((s) => [s.id, s]));

  const mappedStudents: StudentListItem[] = pagedRows.map((s) => {
    const sec = s.currentSectionId ? sectionMap.get(s.currentSectionId) : null;
    const firstName = decryptData(s.firstNameEncrypted) || "Unknown";
    const lastName = decryptData(s.lastNameEncrypted) || "";
    const fullName = `${firstName} ${lastName}`.trim();

    return {
      id: s.id,
      admissionNumber: s.admissionNumber,
      fullName,
      gender: s.gender,
      className: sec?.class?.displayName || "",
      sectionName: sec?.name || "",
      classId: s.currentClassId || null,
      sectionId: s.currentSectionId || null,
      isActive: s.isActive,
      createdAt: s.createdAt.toISOString(),
    };
  });

  return {
    students: mappedStudents,
    nextCursor,
    totalReturned: mappedStudents.length,
  };
}

/**
 * Verify a student document. Sets isVerified=true, verifiedById, verifiedAt,
 * and records an immutable WRITE entry in auditLogs.
 */
export async function verifyStudentDocument(documentId: string) {
  try {
    const ctx = await requireAuth([
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
    ] as const);
    const school = await requireSchool(ctx);
    const clientContext = getClientRequestContext();

    const doc = await db.query.studentDocuments.findFirst({
      where: and(
        eq(studentDocuments.id, documentId),
        eq(studentDocuments.schoolId, school.id),
      ),
    });

    if (!doc) {
      return { success: false, message: "Student document not found" };
    }

    const now = new Date();
    await db
      .update(studentDocuments)
      .set({
        isVerified: true,
        verifiedById: ctx.userId,
        verifiedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(studentDocuments.id, documentId),
          eq(studentDocuments.schoolId, school.id),
        ),
      );

    await db.insert(auditLogs).values({
      schoolId: school.id,
      userId: ctx.userId,
      userEmail: ctx.email,
      userRole: ctx.role,
      action: "WRITE",
      tableName: "student_documents",
      recordId: documentId,
      ipAddress: clientContext.ipAddress || "127.0.0.1",
      userAgent: clientContext.userAgent || "ServerAction/VerifyStudentDocument",
      metadata: {
        event: "DOCUMENT_VERIFIED",
        studentId: doc.studentId,
        documentType: doc.documentType,
        fileName: doc.originalFileName,
      },
    });

    try {
      revalidatePath(`/students/${doc.studentId}`);
    } catch {}

    return { success: true as const };
  } catch (error: any) {
    console.error("Failed to verify student document:", error);
    return { success: false, message: error?.message || "Verification failed" };
  }
}

/**
 * Reject a student document. Sets isVerified=false, clears verification metadata,
 * and records an immutable WRITE entry in auditLogs with rejection reason.
 */
export async function rejectStudentDocument(
  documentId: string,
  rejectionReason?: string,
) {
  try {
    const ctx = await requireAuth([
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
    ] as const);
    const school = await requireSchool(ctx);
    const clientContext = getClientRequestContext();

    const doc = await db.query.studentDocuments.findFirst({
      where: and(
        eq(studentDocuments.id, documentId),
        eq(studentDocuments.schoolId, school.id),
      ),
    });

    if (!doc) {
      return { success: false, message: "Student document not found" };
    }

    const now = new Date();
    await db
      .update(studentDocuments)
      .set({
        isVerified: false,
        verifiedById: null,
        verifiedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(studentDocuments.id, documentId),
          eq(studentDocuments.schoolId, school.id),
        ),
      );

    await db.insert(auditLogs).values({
      schoolId: school.id,
      userId: ctx.userId,
      userEmail: ctx.email,
      userRole: ctx.role,
      action: "WRITE",
      tableName: "student_documents",
      recordId: documentId,
      ipAddress: clientContext.ipAddress || "127.0.0.1",
      userAgent: clientContext.userAgent || "ServerAction/RejectStudentDocument",
      metadata: {
        event: "DOCUMENT_REJECTED",
        reason: rejectionReason || "Rejected by administrator",
        studentId: doc.studentId,
        documentType: doc.documentType,
        fileName: doc.originalFileName,
      },
    });

    try {
      revalidatePath(`/students/${doc.studentId}`);
    } catch {}

    return { success: true as const };
  } catch (error: any) {
    console.error("Failed to reject student document:", error);
    return { success: false, message: error?.message || "Rejection failed" };
  }
}

// ─── Parent Linkage Repair Queue Server Actions ──────────────────────────────

export async function getUnlinkedStudentsAction() {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/students", { id: ctx.userId, email: ctx.email });
  if (!access.allowed || !["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role)) {
    throw new Error("Unauthorized to access parent linkage repair queue.");
  }

  const school = await requireSchool(ctx);
  const { getUnlinkedStudents } = await import("@schoolmitra/backend/lib/parentLinkage");
  const unlinked = await getUnlinkedStudents(school.id);
  return { success: true as const, students: unlinked };
}

export async function findParentCandidatesAction(studentId: string) {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/students", { id: ctx.userId, email: ctx.email });
  if (!access.allowed || !["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role)) {
    throw new Error("Unauthorized to search parent candidates.");
  }

  const school = await requireSchool(ctx);
  const { findParentCandidates } = await import("@schoolmitra/backend/lib/parentLinkage");
  const candidates = await findParentCandidates(school.id, studentId);
  return { success: true as const, candidates };
}

export async function linkStudentToParentAction(studentId: string, parentUserId: string) {
  try {
    const ctx = await requireAuth();
    const access = assertRouteAccess(ctx.role, "/students", { id: ctx.userId, email: ctx.email });
    if (!access.allowed || !["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role)) {
      return { success: false, message: "Unauthorized to link parent account." };
    }

    const school = await requireSchool(ctx);
    const clientContext = getClientRequestContext();
    const { linkStudentToParentUser } = await import("@schoolmitra/backend/lib/parentLinkage");

    await linkStudentToParentUser({
      schoolId: school.id,
      studentId,
      parentUserId,
      performedByUserId: ctx.userId,
      clientIp: clientContext.ipAddress || "0.0.0.0",
    });

    try {
      revalidatePath("/students");
      revalidatePath("/students/linkage");
      revalidatePath(`/students/${studentId}`);
    } catch {}

    return { success: true as const };
  } catch (err: any) {
    console.error("Failed to link student to parent:", err);
    return { success: false, message: err?.message || "Linkage failed" };
  }
}

export async function inviteAndLinkParentAction(studentId: string) {
  try {
    const ctx = await requireAuth();
    const access = assertRouteAccess(ctx.role, "/students", { id: ctx.userId, email: ctx.email });
    if (!access.allowed || !["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role)) {
      return { success: false, message: "Unauthorized to invite parent." };
    }

    const school = await requireSchool(ctx);
    const clientContext = getClientRequestContext();

    // 1. Fetch student and family members
    const student = await db.query.students.findFirst({
      where: and(
        eq(students.id, studentId),
        eq(students.schoolId, school.id),
      ),
      with: {
        familyMembers: true,
      },
    });

    if (!student) {
      return { success: false, message: "Student record not found." };
    }

    const primaryGuardian =
      student.familyMembers.find((f) => f.isPrimaryContact) ||
      student.familyMembers.find((f) => f.emailEncrypted) ||
      student.familyMembers[0];

    let guardianName = "Parent Guardian";
    let primaryMobile: string | null = null;
    let primaryEmail: string | null = null;

    if (primaryGuardian) {
      guardianName = decryptData(primaryGuardian.nameEncrypted) || "Parent Guardian";
      primaryMobile = primaryGuardian.mobileEncrypted
        ? decryptData(primaryGuardian.mobileEncrypted)
        : null;
      primaryEmail = primaryGuardian.emailEncrypted
        ? decryptData(primaryGuardian.emailEncrypted)
        : null;
    }

    if (!primaryEmail || !primaryEmail.trim()) {
      return {
        success: false,
        message: "No guardian email found on student profile. Please add an email before inviting.",
      };
    }

    const { provisionOrLinkParent } = await import("@schoolmitra/backend/lib/parentLinkage");
    const result = await provisionOrLinkParent({
      schoolId: school.id,
      studentId,
      primaryEmail: primaryEmail.trim(),
      primaryMobile: primaryMobile?.trim() ?? null,
      guardianName: guardianName.trim(),
      performedByUserId: ctx.userId,
    });

    // Write audit log
    await db.insert(auditLogs).values({
      schoolId: school.id,
      userId: ctx.userId,
      userEmail: ctx.email,
      userRole: ctx.role,
      action: "WRITE",
      tableName: "students",
      recordId: studentId,
      ipAddress: clientContext.ipAddress || "0.0.0.0",
      userAgent: clientContext.userAgent || "ServerAction/InviteParent",
      metadata: {
        event: "PARENT_INVITED_AND_LINKED",
        studentId,
        parentUserId: result.parentUserId,
        isNewlyProvisioned: result.isNewlyProvisioned,
      },
    });

    try {
      revalidatePath("/students");
      revalidatePath("/students/linkage");
      revalidatePath(`/students/${studentId}`);
    } catch {}

    return {
      success: true as const,
      isNewlyProvisioned: result.isNewlyProvisioned,
      credentials: result.parentCredentials,
    };
  } catch (err: any) {
    console.error("Failed to invite and link parent:", err);
    return { success: false, message: err?.message || "Invitation failed" };
  }
}

