"use server";

import { db, withTenant } from "@/db";
import {
  studentLeaveRequests,
  students,
  sections,
  classes,
  studentAttendance,
  academicYears,
} from "@/db/schema";
import { eq, and, desc, inArray, sql, gte, lte } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { revalidatePath } from "next/cache";
import { decryptData } from "@/lib/encryption";

export interface TeacherPendingLeaveItem {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string | null;
  className: string;
  sectionName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  attachmentS3Key: string | null;
  createdAt: string;
  hoursPending: number;
}

/**
 * Fetch pending leave requests for a teacher's assigned sections (Surface p7)
 */
export async function getTeacherPendingLeaveRequests(): Promise<TeacherPendingLeaveItem[]> {
  const ctx = await requireAuth(["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN", "PRINCIPAL"] as const);
  const school = await requireSchool(ctx);
  const userId = ctx.userId;
  const userRole = ctx.role;
  const now = new Date();

  return await withTenant(school.id, async (tx) => {
    // 1. Identify assigned section IDs for this teacher
    let assignedSectionIds: string[] = [];

    if (userRole === "TEACHER") {
      const assignedSections = await tx
        .select({ id: sections.id })
        .from(sections)
        .where(and(eq(sections.schoolId, school.id), eq(sections.classTeacherId, userId)));

      assignedSectionIds = assignedSections.map((s) => s.id);
      if (assignedSectionIds.length === 0) {
        return [];
      }
    }

    // 2. Fetch students in the assigned sections
    const studentsCondition =
      userRole === "TEACHER"
        ? and(
            eq(students.schoolId, school.id),
            inArray(students.currentSectionId, assignedSectionIds),
            eq(students.isActive, true)
          )
        : and(eq(students.schoolId, school.id), eq(students.isActive, true));

    const studentRows = await tx
      .select({
        id: students.id,
        firstNameEncrypted: students.firstNameEncrypted,
        lastNameEncrypted: students.lastNameEncrypted,
        rollNumber: students.rollNumber,
        currentClassId: students.currentClassId,
        currentSectionId: students.currentSectionId,
      })
      .from(students)
      .where(studentsCondition);

    if (studentRows.length === 0) return [];

    const studentMap = new Map(studentRows.map((s) => [s.id, s]));
    const studentIds = studentRows.map((s) => s.id);

    // 3. Fetch pending leave requests
    const pendingRequests = await tx
      .select({
        id: studentLeaveRequests.id,
        studentId: studentLeaveRequests.studentId,
        leaveType: studentLeaveRequests.leaveType,
        startDate: studentLeaveRequests.startDate,
        endDate: studentLeaveRequests.endDate,
        reason: studentLeaveRequests.reason,
        attachmentS3Key: studentLeaveRequests.attachmentS3Key,
        createdAt: studentLeaveRequests.createdAt,
      })
      .from(studentLeaveRequests)
      .where(
        and(
          eq(studentLeaveRequests.schoolId, school.id),
          eq(studentLeaveRequests.status, "PENDING"),
          inArray(studentLeaveRequests.studentId, studentIds)
        )
      )
      .orderBy(studentLeaveRequests.createdAt);

    if (pendingRequests.length === 0) return [];

    // 4. Resolve class and section names
    const classRows = await tx.select().from(classes).where(eq(classes.schoolId, school.id));
    const sectionRows = await tx.select().from(sections).where(eq(sections.schoolId, school.id));

    const classMap = new Map(classRows.map((c) => [c.id, c.displayName || c.gradeLevel]));
    const sectionMap = new Map(sectionRows.map((s) => [s.id, s.name]));

    return pendingRequests.map((req) => {
      const student = studentMap.get(req.studentId);
      const first = student ? decryptData(student.firstNameEncrypted) || "Student" : "Student";
      const last = student ? decryptData(student.lastNameEncrypted) || "" : "";
      const fullName = `${first} ${last}`.trim();
      const className = (student?.currentClassId && classMap.get(student.currentClassId)) || "Class";
      const sectionName = (student?.currentSectionId && sectionMap.get(student.currentSectionId)) || "";

      const createdTime = new Date(req.createdAt).getTime();
      const hoursPending = Math.max(0, Math.round((now.getTime() - createdTime) / 3600000));

      return {
        id: req.id,
        studentId: req.studentId,
        studentName: fullName,
        rollNumber: student?.rollNumber || null,
        className,
        sectionName,
        leaveType: req.leaveType,
        startDate: new Date(req.startDate).toISOString().slice(0, 10),
        endDate: new Date(req.endDate).toISOString().slice(0, 10),
        reason: req.reason,
        attachmentS3Key: req.attachmentS3Key || null,
        createdAt: new Date(req.createdAt).toISOString(),
        hoursPending,
      };
    });
  });
}

/**
 * 1-Tap Approve or Reject a student leave request with optional note (Surface p7 & AC-P16)
 */
export async function decideLeaveRequest(
  leaveRequestId: string,
  decision: "APPROVED" | "REJECTED",
  note?: string
) {
  const ctx = await requireAuth(["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN", "PRINCIPAL"] as const);
  const school = await requireSchool(ctx);
  const userId = ctx.userId;
  const now = new Date();

  return await withTenant(school.id, async (tx) => {
    // 1. Fetch leave request
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

    if (req.status !== "PENDING") {
      return { success: false, error: `Leave request has already been ${req.status.toLowerCase()}.` };
    }

    // 2. Update status
    await tx
      .update(studentLeaveRequests)
      .set({
        status: decision,
        decidedByUserId: userId,
        decidedAt: now,
        decisionNote: note?.trim() || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(studentLeaveRequests.id, leaveRequestId),
          eq(studentLeaveRequests.schoolId, school.id)
        )
      );

    // 3. AC-P16 Attendance Suppression & Auto-LEAVE row writing upon approval
    if (decision === "APPROVED") {
      // Find active academic year
      const [activeYear] = await tx
        .select()
        .from(academicYears)
        .where(
          and(
            eq(academicYears.schoolId, school.id),
            eq(academicYears.isActive, true)
          )
        )
        .limit(1);

      // Find student's current section
      const [studentRow] = await tx
        .select({ currentSectionId: students.currentSectionId })
        .from(students)
        .where(and(eq(students.id, req.studentId), eq(students.schoolId, school.id)))
        .limit(1);

      if (activeYear && studentRow?.currentSectionId) {
        // Iterate through each calendar day in the leave interval
        const current = new Date(req.startDate);
        const end = new Date(req.endDate);
        // Normalize
        current.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        while (current <= end) {
          const dayStart = new Date(current);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(current);
          dayEnd.setHours(23, 59, 59, 999);

          // Check if attendance already marked for this day
          const [existingAtt] = await tx
            .select()
            .from(studentAttendance)
            .where(
              and(
                eq(studentAttendance.schoolId, school.id),
                eq(studentAttendance.studentId, req.studentId),
                sql`${studentAttendance.attendanceDate} >= ${dayStart}`,
                sql`${studentAttendance.attendanceDate} <= ${dayEnd}`,
                sql`${studentAttendance.periodId} IS NULL`
              )
            )
            .limit(1);

          if (existingAtt) {
            await tx
              .update(studentAttendance)
              .set({
                status: "LEAVE",
                remarks: `Approved leave: ${req.reason}`,
                updatedAt: now,
              })
              .where(
                and(
                  eq(studentAttendance.id, existingAtt.id),
                  eq(studentAttendance.schoolId, school.id)
                )
              );
          } else {
            await tx.insert(studentAttendance).values({
              schoolId: school.id,
              studentId: req.studentId,
              sectionId: studentRow.currentSectionId,
              academicYearId: activeYear.id,
              attendanceDate: dayStart,
              status: "LEAVE",
              markedById: userId,
              remarks: `Approved leave: ${req.reason}`,
            });
          }

          // Advance one day
          current.setDate(current.getDate() + 1);
        }
      }
    }

    revalidatePath("/teacher/attendance");
    revalidatePath("/parent/dashboard");
    revalidatePath("/parent/profile");
    revalidatePath("/parent/more/leave");

    return {
      success: true,
      decision,
      message: `Leave request ${decision.toLowerCase()} successfully.`,
    };
  });
}
