import { db } from "@/db";
import {
  exams,
  reportCardSetups,
  classes,
  students,
  examSchedules,
  auditLogs,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { ExamAuthContext } from "./examPermissions";
import { withPlatformContext } from "./tenant";

export type TenantDenialError = "TENANT_ACCESS_DENIED" | "RESOURCE_NOT_FOUND";

export interface TenantVerificationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: TenantDenialError;
  message?: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeUuid(val?: string | null): string {
  return typeof val === "string" && UUID_REGEX.test(val)
    ? val
    : "00000000-0000-0000-0000-000000000000";
}

/**
 * Logs a security isolation or authorization violation to the immutable audit_logs table.
 * Adheres strictly to zero-PII requirements (record IDs, timestamps, metadata only).
 */
export async function logExamIsolationViolation(params: {
  schoolId: string;
  userId?: string | null | undefined;
  userEmail?: string | null | undefined;
  userRole?: string | null | undefined;
  action?: ("READ" | "WRITE" | "DELETE" | "EXPORT") | undefined;
  tableName: string;
  recordId?: string | null | undefined;
  purposeId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}): Promise<void> {
  try {
    const userId = safeUuid(params.userId);
    const schoolId = safeUuid(params.schoolId);

    await db.insert(auditLogs).values({
      userId,
      userEmail: params.userEmail || "anonymous@security.internal",
      userRole: params.userRole || "UNKNOWN",
      schoolId,
      action: params.action || "WRITE",
      tableName: params.tableName,
      recordId: params.recordId ?? null,
      purposeId: params.purposeId || "cross_tenant_violation",
      ipAddress: "127.0.0.1",
      userAgent: "ExamIsolationGuard",
      metadata: {
        timestamp: new Date().toISOString(),
        ...(params.metadata || {}),
      },
    });
  } catch (err) {
    console.error("[logExamIsolationViolation] Failed to insert audit log row:", err);
  }
}

/**
 * Verifies that an exam belongs to the authenticated school tenant.
 * If the exam exists in another school, records an audit log row and returns TENANT_ACCESS_DENIED.
 */
export async function verifyExamOwnership(
  schoolId: string,
  examId: string,
  ctx?: ExamAuthContext | null,
  actionName = "mutateExam",
): Promise<TenantVerificationResult<typeof exams.$inferSelect>> {
  const ownExam = await db.query.exams.findFirst({
    where: and(
      eq(exams.id, examId),
      eq(exams.schoolId, schoolId),
      isNull(exams.deletedAt),
    ),
  });

  if (ownExam) {
    return { success: true, data: ownExam };
  }

  // Cross-tenant check
  const anyExam = await db.query.exams.findFirst({
    where: and(eq(exams.id, examId), isNull(exams.deletedAt)),
  });

  if (anyExam && anyExam.schoolId !== schoolId) {
    await logExamIsolationViolation({
      schoolId,
      userId: ctx?.userId,
      userEmail: ctx?.email,
      userRole: ctx?.role,
      action: "WRITE",
      tableName: "exams",
      recordId: examId,
      purposeId: "cross_tenant_violation",
      metadata: {
        action: actionName,
        attemptedSchoolId: anyExam.schoolId,
        actorSchoolId: schoolId,
        reason: "Exam belongs to a different school tenant",
      },
    });

    return {
      success: false,
      error: "TENANT_ACCESS_DENIED",
      message: "Forbidden: Cross-tenant exam access denied.",
    };
  }

  return {
    success: false,
    error: "RESOURCE_NOT_FOUND",
    message: "Exam not found.",
  };
}

/**
 * Verifies that a report card setup belongs to the authenticated school tenant.
 */
export async function verifySetupOwnership(
  schoolId: string,
  setupId: string,
  ctx?: ExamAuthContext | null,
  actionName = "mutateSetup",
): Promise<TenantVerificationResult<typeof reportCardSetups.$inferSelect>> {
  const ownSetup = await db.query.reportCardSetups.findFirst({
    where: and(
      eq(reportCardSetups.id, setupId),
      eq(reportCardSetups.schoolId, schoolId),
    ),
  });

  if (ownSetup) {
    return { success: true, data: ownSetup };
  }

  const anySetup = await db.query.reportCardSetups.findFirst({
    where: eq(reportCardSetups.id, setupId),
  });

  if (anySetup && anySetup.schoolId !== schoolId) {
    await logExamIsolationViolation({
      schoolId,
      userId: ctx?.userId,
      userEmail: ctx?.email,
      userRole: ctx?.role,
      action: "WRITE",
      tableName: "report_card_setups",
      recordId: setupId,
      purposeId: "cross_tenant_violation",
      metadata: {
        action: actionName,
        attemptedSchoolId: anySetup.schoolId,
        actorSchoolId: schoolId,
        reason: "Report card setup belongs to a different school tenant",
      },
    });

    return {
      success: false,
      error: "TENANT_ACCESS_DENIED",
      message: "Forbidden: Cross-tenant report card setup access denied.",
    };
  }

  return {
    success: false,
    error: "RESOURCE_NOT_FOUND",
    message: "Report card setup not found.",
  };
}

/**
 * Verifies that a class belongs to the authenticated school tenant.
 */
export async function verifyClassOwnership(
  schoolId: string,
  classId: string,
  ctx?: ExamAuthContext | null,
  actionName = "mutateClassScope",
): Promise<TenantVerificationResult<typeof classes.$inferSelect>> {
  const ownClass = await db.query.classes.findFirst({
    where: and(eq(classes.id, classId), eq(classes.schoolId, schoolId)),
  });

  if (ownClass) {
    return { success: true, data: ownClass };
  }

  const anyClass = await withPlatformContext(async (tx) => {
    return await tx.query.classes.findFirst({
      where: eq(classes.id, classId),
    });
  });

  if (anyClass && anyClass.schoolId !== schoolId) {
    await logExamIsolationViolation({
      schoolId,
      userId: ctx?.userId,
      userEmail: ctx?.email,
      userRole: ctx?.role,
      action: "WRITE",
      tableName: "classes",
      recordId: classId,
      purposeId: "cross_tenant_violation",
      metadata: {
        action: actionName,
        attemptedSchoolId: anyClass.schoolId,
        actorSchoolId: schoolId,
        reason: "Class belongs to a different school tenant",
      },
    });

    return {
      success: false,
      error: "TENANT_ACCESS_DENIED",
      message: "Forbidden: Cross-tenant class access denied.",
    };
  }

  return {
    success: false,
    error: "RESOURCE_NOT_FOUND",
    message: "Class not found.",
  };
}

/**
 * Verifies that a student belongs to the authenticated school tenant.
 */
export async function verifyStudentOwnership(
  schoolId: string,
  studentId: string,
  ctx?: ExamAuthContext | null,
  actionName = "mutateStudentExam",
): Promise<TenantVerificationResult<typeof students.$inferSelect>> {
  const ownStudent = await db.query.students.findFirst({
    where: and(eq(students.id, studentId), eq(students.schoolId, schoolId)),
  });

  if (ownStudent) {
    return { success: true, data: ownStudent };
  }

  const anyStudent = await withPlatformContext(async (tx) => {
    return await tx.query.students.findFirst({
      where: eq(students.id, studentId),
    });
  });

  if (anyStudent && anyStudent.schoolId !== schoolId) {
    await logExamIsolationViolation({
      schoolId,
      userId: ctx?.userId,
      userEmail: ctx?.email,
      userRole: ctx?.role,
      action: "WRITE",
      tableName: "students",
      recordId: studentId,
      purposeId: "cross_tenant_violation",
      metadata: {
        action: actionName,
        attemptedSchoolId: anyStudent.schoolId,
        actorSchoolId: schoolId,
        reason: "Student belongs to a different school tenant",
      },
    });

    return {
      success: false,
      error: "TENANT_ACCESS_DENIED",
      message: "Forbidden: Cross-tenant student access denied.",
    };
  }

  return {
    success: false,
    error: "RESOURCE_NOT_FOUND",
    message: "Student not found.",
  };
}

/**
 * Verifies that an exam schedule belongs to the authenticated school tenant.
 */
export async function verifyScheduleOwnership(
  schoolId: string,
  scheduleId: string,
  ctx?: ExamAuthContext | null,
  actionName = "mutateSchedule",
): Promise<TenantVerificationResult<typeof examSchedules.$inferSelect>> {
  const ownSchedule = await db.query.examSchedules.findFirst({
    where: and(
      eq(examSchedules.id, scheduleId),
      eq(examSchedules.schoolId, schoolId),
    ),
  });

  if (ownSchedule) {
    return { success: true, data: ownSchedule };
  }

  const anySchedule = await db.query.examSchedules.findFirst({
    where: eq(examSchedules.id, scheduleId),
  });

  if (anySchedule && anySchedule.schoolId !== schoolId) {
    await logExamIsolationViolation({
      schoolId,
      userId: ctx?.userId,
      userEmail: ctx?.email,
      userRole: ctx?.role,
      action: "WRITE",
      tableName: "exam_schedules",
      recordId: scheduleId,
      purposeId: "cross_tenant_violation",
      metadata: {
        action: actionName,
        attemptedSchoolId: anySchedule.schoolId,
        actorSchoolId: schoolId,
        reason: "Schedule belongs to a different school tenant",
      },
    });

    return {
      success: false,
      error: "TENANT_ACCESS_DENIED",
      message: "Forbidden: Cross-tenant exam schedule access denied.",
    };
  }

  return {
    success: false,
    error: "RESOURCE_NOT_FOUND",
    message: "Exam schedule not found.",
  };
}
