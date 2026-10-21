"use server";

import { db, withTenant } from "@/db";
import { studentLeaveRequests, students, users, staff } from "@/db/schema";
import { eq, and, or, desc, gte, lte, inArray, sql } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { revalidatePath } from "next/cache";
import { decryptData } from "@/lib/encryption";

export interface ApplyLeaveInput {
  leaveType: "CASUAL" | "SICK" | "EMERGENCY" | "OTHER";
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string;   // ISO date string YYYY-MM-DD
  reason: string;
  attachmentS3Key?: string;
}

/**
 * Apply for student leave (Parent workflow OP3)
 */
export async function applyStudentLeave(studentId: string, input: ApplyLeaveInput) {
  const ctx = await requireAuth(["PARENT", "SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
  const school = await requireSchool(ctx);
  const userId = ctx.userId;

  if (!input.startDate || !input.endDate || !input.reason?.trim()) {
    return { success: false, error: "Please provide start date, end date, and reason for leave." };
  }

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  // Set start to beginning of day, end to end of day in local time
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { success: false, error: "Invalid date format." };
  }

  if (start > end) {
    return { success: false, error: "End date must be on or after start date." };
  }

  return await withTenant(school.id, async (tx) => {
    // 1. Verify student belongs to this parent (if parent role)
    if (ctx.role === "PARENT") {
      const [studentRecord] = await tx
        .select({ id: students.id, primaryParentUserId: students.primaryParentUserId })
        .from(students)
        .where(and(eq(students.id, studentId), eq(students.schoolId, school.id)))
        .limit(1);

      if (!studentRecord || studentRecord.primaryParentUserId !== userId) {
        return { success: false, error: "You are not authorized to submit leave for this student." };
      }
    }

    // 2. Overlap rule: Max 2 overlapping active/pending leave requests allowed per student
    const overlapping = await tx
      .select({ id: studentLeaveRequests.id })
      .from(studentLeaveRequests)
      .where(
        and(
          eq(studentLeaveRequests.studentId, studentId),
          eq(studentLeaveRequests.schoolId, school.id),
          inArray(studentLeaveRequests.status, ["PENDING", "APPROVED"]),
          sql`${studentLeaveRequests.startDate} <= ${end}`,
          sql`${studentLeaveRequests.endDate} >= ${start}`
        )
      );

    if (overlapping.length >= 2) {
      return {
        success: false,
        error: "Maximum of 2 active or overlapping leave requests already exist for these dates.",
      };
    }

    // 3. Create leave request
    const [inserted] = await tx
      .insert(studentLeaveRequests)
      .values({
        schoolId: school.id,
        studentId,
        requestedByParentUserId: userId,
        leaveType: input.leaveType,
        startDate: start,
        endDate: end,
        reason: input.reason.trim(),
        attachmentS3Key: input.attachmentS3Key || null,
        status: "PENDING",
      })
      .returning({ id: studentLeaveRequests.id });

    revalidatePath("/parent/dashboard");
    revalidatePath("/parent/profile");
    revalidatePath("/parent/more/leave");

    return {
      success: true,
      leaveRequestId: inserted?.id,
      message: "Leave application submitted successfully.",
    };
  });
}

/**
 * Cancel a pending student leave request before start date (Parent workflow OP3)
 */
export async function cancelStudentLeave(leaveRequestId: string) {
  const ctx = await requireAuth(["PARENT", "SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
  const school = await requireSchool(ctx);
  const userId = ctx.userId;
  const now = new Date();

  return await withTenant(school.id, async (tx) => {
    const [req] = await tx
      .select()
      .from(studentLeaveRequests)
      .where(
        and(
          eq(studentLeaveRequests.id, leaveRequestId),
          eq(studentLeaveRequests.schoolId, school.id)
        )
      )
      .limit(1);

    if (!req) {
      return { success: false, error: "Leave request not found." };
    }

    if (ctx.role === "PARENT" && req.requestedByParentUserId !== userId) {
      return { success: false, error: "Unauthorized to cancel this leave request." };
    }

    if (req.status !== "PENDING") {
      return { success: false, error: `Cannot cancel a leave request that is already ${req.status}.` };
    }

    // Allowed until start of the school day on start_date
    if (now > new Date(req.startDate)) {
      return { success: false, error: "Leave has already commenced and cannot be cancelled." };
    }

    await tx
      .update(studentLeaveRequests)
      .set({
        status: "CANCELLED_BY_PARENT",
        updatedAt: now,
      })
      .where(
        and(
          eq(studentLeaveRequests.id, leaveRequestId),
          eq(studentLeaveRequests.schoolId, school.id)
        )
      );

    revalidatePath("/parent/dashboard");
    revalidatePath("/parent/profile");
    revalidatePath("/parent/more/leave");

    return { success: true, message: "Leave request cancelled." };
  });
}

/**
 * Fetch leave requests history for a student
 */
export async function getStudentLeaveRequests(studentId: string) {
  const ctx = await requireAuth(["PARENT", "TEACHER", "SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx) => {
    const rows = await tx
      .select({
        id: studentLeaveRequests.id,
        leaveType: studentLeaveRequests.leaveType,
        startDate: studentLeaveRequests.startDate,
        endDate: studentLeaveRequests.endDate,
        reason: studentLeaveRequests.reason,
        status: studentLeaveRequests.status,
        decidedAt: studentLeaveRequests.decidedAt,
        decisionNote: studentLeaveRequests.decisionNote,
        createdAt: studentLeaveRequests.createdAt,
        decidedByUserId: studentLeaveRequests.decidedByUserId,
      })
      .from(studentLeaveRequests)
      .where(
        and(
          eq(studentLeaveRequests.studentId, studentId),
          eq(studentLeaveRequests.schoolId, school.id)
        )
      )
      .orderBy(desc(studentLeaveRequests.createdAt));

    // Resolve teacher names if decided
    const teacherIds = rows.map((r) => r.decidedByUserId).filter(Boolean) as string[];
    const staffRows = teacherIds.length > 0
      ? await tx
          .select({
            userId: staff.userId,
            firstNameEncrypted: staff.firstNameEncrypted,
            lastNameEncrypted: staff.lastNameEncrypted,
          })
          .from(staff)
          .where(and(eq(staff.schoolId, school.id), inArray(staff.userId, teacherIds)))
      : [];

    const teacherNameMap = new Map<string, string>();
    for (const s of staffRows) {
      if (s.userId) {
        const first = decryptData(s.firstNameEncrypted) || "Teacher";
        const last = s.lastNameEncrypted ? decryptData(s.lastNameEncrypted) || "" : "";
        teacherNameMap.set(s.userId, `${first} ${last}`.trim() || "Class Teacher");
      }
    }

    return rows.map((r) => ({
      ...r,
      teacherName: r.decidedByUserId ? teacherNameMap.get(r.decidedByUserId) || "Class Teacher" : null,
    }));
  });
}
