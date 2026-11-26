"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { withTenant } from "@/db";
import { auditLogs, leaveRequests, studentLeaveRequests } from "@/db/schema";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { getClientRequestContext } from "@/lib/requestContext";
import { isOversightRole, OVERSIGHT_READ_ROLES } from "@/lib/teacherAuthGuards";
import { assertQueryBudget } from "@schoolmitra/database";
import {
  getPrincipalConsoleMetrics,
  type PrincipalConsoleMetrics,
} from "@/lib/roleConsoleEngine";
import {
  approveMarks,
  returnMarksForRevision,
} from "@/app/(admin)/exams/actions/marksActions";

export async function getPrincipalDashboardMetricsAction(): Promise<{
  success: boolean;
  metrics: PrincipalConsoleMetrics | null;
  error?: string;
}> {
  try {
    const ctx = await requireAuth([...OVERSIGHT_READ_ROLES]);
    const school = await requireSchool(ctx);

    const metrics = await assertQueryBudget(
      async () => getPrincipalConsoleMetrics(school.id),
      { maxQueries: 20, label: "Principal Dashboard Metrics" }
    );

    return {
      success: true,
      metrics,
    };
  } catch (err: any) {
    console.error("[getPrincipalDashboardMetricsAction] Error:", err);
    return {
      success: false,
      metrics: null,
      error: err?.message || "Failed to load principal metrics",
    };
  }
}

export async function approvePendingMarksAction(input: {
  examId: string;
  classId: string;
  subjectId: string;
  reason?: string;
}) {
  const ctx = await requireAuth([...OVERSIGHT_READ_ROLES]);
  if (!isOversightRole(ctx.role)) {
    return { success: false, error: "Principal or administrative oversight role required." };
  }

  const res = await approveMarks({
    examId: input.examId,
    classId: input.classId,
    subjectId: input.subjectId,
    reason: input.reason?.trim() || "Approved and locked via Principal Dashboard queue",
  });

  if (res.success) {
    revalidatePath("/principal/dashboard");
    revalidatePath("/exams");
  }
  return res;
}

export async function returnPendingMarksAction(input: {
  examId: string;
  classId: string;
  subjectId: string;
  reason: string;
}) {
  const ctx = await requireAuth([...OVERSIGHT_READ_ROLES]);
  if (!isOversightRole(ctx.role)) {
    return { success: false, error: "Principal or administrative oversight role required." };
  }
  const trimmed = input.reason?.trim();
  if (!trimmed) {
    return { success: false, error: "A return reason is required." };
  }

  const res = await returnMarksForRevision({
    examId: input.examId,
    classId: input.classId,
    subjectId: input.subjectId,
    reason: trimmed,
  });

  if (res.success) {
    revalidatePath("/principal/dashboard");
    revalidatePath("/exams");
  }
  return res;
}

export async function decideStaffLeaveAction(input: {
  leaveRequestId: string;
  decision: "APPROVE" | "REJECT";
  reason?: string;
}) {
  try {
    const ctx = await requireAuth([...OVERSIGHT_READ_ROLES]);
    if (!isOversightRole(ctx.role)) {
      return { success: false, error: "Oversight role required to decide leave requests." };
    }
    const school = await requireSchool(ctx);
    const trimmedReason = input.reason?.trim() || null;

    if (input.decision === "REJECT" && !trimmedReason) {
      return { success: false, error: "A rejection reason is required." };
    }

    const reqCtx = await getClientRequestContext();
    const now = new Date();
    const targetStatus = input.decision === "APPROVE" ? "HR_APPROVED" : "REJECTED";

    const updated = await withTenant(school.id, async (tx) => {
      const existing = await tx.query.leaveRequests.findFirst({
        where: and(
          eq(leaveRequests.id, input.leaveRequestId),
          eq(leaveRequests.schoolId, school.id),
          inArray(leaveRequests.status, ["PENDING", "HOD_APPROVED"])
        ),
      });
      if (!existing) return null;

      await tx
        .update(leaveRequests)
        .set({
          status: targetStatus,
          hrApprovedById: ctx.userId,
          hrApprovedAt: now,
          rejectionReason: input.decision === "REJECT" ? trimmedReason : existing.rejectionReason,
        })
        .where(and(eq(leaveRequests.id, existing.id), eq(leaveRequests.schoolId, school.id)));

      await tx.insert(auditLogs).values({
        userId: ctx.userId,
        userEmail: ctx.email || "principal@schoolmitra.com",
        userRole: ctx.role,
        schoolId: school.id,
        action: "WRITE",
        tableName: "leave_requests",
        recordId: existing.id,
        purposeId: "principal_leave_decision",
        ipAddress: reqCtx.ipAddress,
        userAgent: reqCtx.userAgent,
        metadata: {
          decision: input.decision,
          previousStatus: existing.status,
          newStatus: targetStatus,
          reason: trimmedReason,
        },
      });

      return existing;
    });

    if (!updated) {
      return { success: false, error: "Leave request not found or already decided." };
    }

    revalidatePath("/principal/dashboard");
    revalidatePath("/hr");
    return { success: true };
  } catch (err: any) {
    console.error("[decideStaffLeaveAction] Error:", err);
    return { success: false, error: err?.message || "Failed to update staff leave." };
  }
}

export async function decideStudentLeaveAction(input: {
  leaveRequestId: string;
  decision: "APPROVE" | "REJECT";
  note?: string;
}) {
  try {
    const ctx = await requireAuth([...OVERSIGHT_READ_ROLES]);
    if (!isOversightRole(ctx.role)) {
      return { success: false, error: "Oversight role required to decide student leaves." };
    }
    const school = await requireSchool(ctx);
    const trimmedNote = input.note?.trim() || null;

    if (input.decision === "REJECT" && !trimmedNote) {
      return { success: false, error: "A rejection note is required." };
    }

    const reqCtx = await getClientRequestContext();
    const now = new Date();
    const targetStatus = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";

    const updated = await withTenant(school.id, async (tx) => {
      const existing = await tx.query.studentLeaveRequests.findFirst({
        where: and(
          eq(studentLeaveRequests.id, input.leaveRequestId),
          eq(studentLeaveRequests.schoolId, school.id),
          eq(studentLeaveRequests.status, "PENDING")
        ),
      });
      if (!existing) return null;

      await tx
        .update(studentLeaveRequests)
        .set({
          status: targetStatus,
          decidedByUserId: ctx.userId,
          decisionNote: trimmedNote,
          decidedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(studentLeaveRequests.id, existing.id),
            eq(studentLeaveRequests.schoolId, school.id)
          )
        );

      await tx.insert(auditLogs).values({
        userId: ctx.userId,
        userEmail: ctx.email || "principal@schoolmitra.com",
        userRole: ctx.role,
        schoolId: school.id,
        action: "WRITE",
        tableName: "student_leave_requests",
        recordId: existing.id,
        purposeId: "principal_student_leave_decision",
        ipAddress: reqCtx.ipAddress,
        userAgent: reqCtx.userAgent,
        metadata: {
          decision: input.decision,
          previousStatus: existing.status,
          newStatus: targetStatus,
          note: trimmedNote,
        },
      });

      return existing;
    });

    if (!updated) {
      return { success: false, error: "Student leave request not found or already decided." };
    }

    revalidatePath("/principal/dashboard");
    revalidatePath("/attendance");
    return { success: true };
  } catch (err: any) {
    console.error("[decideStudentLeaveAction] Error:", err);
    return { success: false, error: err?.message || "Failed to update student leave." };
  }
}
