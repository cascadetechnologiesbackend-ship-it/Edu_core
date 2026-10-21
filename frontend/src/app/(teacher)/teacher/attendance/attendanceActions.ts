"use server";

import { db, withTenant } from "@/db";
import {
  studentAttendance,
  sections,
  students,
  studentClassHistory,
  studentLeaveRequests,
  academicYears,
  domainEvents,
  classes,
} from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { decryptData } from "@/lib/encryption";
import { assertConsent } from "@/server/middleware/consent";
import { invalidateDashboardCache } from "@/lib/dashboardCache";
import {
  assertTeacherCanMarkAttendance,
  resolveTeacherScope,
} from "@/lib/teacherEventEngine/scopeResolver";
import type { AttendanceMarkedPayload } from "@schoolmitra/domain-events";

export type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "HALF_DAY"
  | "LEAVE"
  | "HOLIDAY";

export interface WorkbenchStudent {
  studentId: string;
  rollNumber: string | null;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  status: AttendanceStatus;
  remarks: string;
  isPreApprovedLeave: boolean;
  leaveReason?: string | undefined;
  attendanceRecordId?: string | null | undefined;
}

export interface WorkbenchRosterData {
  sectionId: string;
  sectionName: string;
  className: string;
  dateStr: string;
  academicYearId: string;
  isAlreadyMarked: boolean;
  students: WorkbenchStudent[];
  counts: {
    total: number;
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    leave: number;
  };
}

export interface SaveAttendanceInput {
  sectionId: string;
  dateStr: string;
  periodId?: string | null | undefined;
  records: Array<{
    studentId: string;
    status: AttendanceStatus;
    remarks?: string | undefined;
  }>;
}

export interface SaveAttendanceResult {
  success: boolean;
  sectionName: string;
  className: string;
  dateStr: string;
  totalStudents: number;
  counts: {
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    leave: number;
  };
  summaryToast: string;
}

/**
 * Fetches all assigned sections for the authenticated teacher.
 */
export async function getTeacherAssignedSections() {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx) => {
    const scope = await resolveTeacherScope(ctx.userId, { tx, schoolId: school.id });
    const allowedSectionIds = Array.from(
      new Set([
        ...scope.classTeacherSections,
        ...scope.teachingSections.map((ts) => ts.sectionId),
      ])
    );

    if (allowedSectionIds.length === 0) {
      return [];
    }

    const sectionRecords = await tx
      .select({
        id: sections.id,
        name: sections.name,
        classId: sections.classId,
        className: classes.displayName,
        classGrade: classes.sortOrder,
      })
      .from(sections)
      .innerJoin(classes, eq(sections.classId, classes.id))
      .where(
        and(
          eq(sections.schoolId, school.id),
          eq(sections.isActive, true),
          inArray(sections.id, allowedSectionIds)
        )
      )
      .orderBy(classes.sortOrder, sections.name);

    return sectionRecords.map((s) => ({
      id: s.id,
      name: s.name,
      className: s.className,
      displayName: `${s.className} - ${s.name}`,
      isClassTeacher: scope.classTeacherSections.includes(s.id),
    }));
  });
}

/**
 * Loads the section roster for attendance marking with pre-approved leaves and current marks.
 */
export async function getTeacherAttendanceRoster(
  sectionId: string,
  dateStr: string
): Promise<WorkbenchRosterData> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx) => {
    // 1. Verify Scope
    await assertTeacherCanMarkAttendance(ctx.userId, sectionId, { tx });

    // 2. Resolve Active Academic Year
    const activeYear = await tx.query.academicYears.findFirst({
      where: and(
        eq(academicYears.schoolId, school.id),
        eq(academicYears.isActive, true)
      ),
    });

    if (!activeYear) {
      throw new Error("No active academic year found.");
    }

    // 3. Resolve Section and Class Metadata
    const targetSection = await tx
      .select({
        sectionId: sections.id,
        sectionName: sections.name,
        className: classes.displayName,
      })
      .from(sections)
      .innerJoin(classes, eq(sections.classId, classes.id))
      .where(and(eq(sections.id, sectionId), eq(sections.schoolId, school.id)))
      .limit(1);

    if (!targetSection[0]) {
      throw new Error("Section not found.");
    }

    const sectionMeta = targetSection[0];

    // 4. Parse Date bounds
    const parsedDate = new Date(dateStr);
    const startOfDay = new Date(new Date(dateStr).setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date(dateStr).setHours(23, 59, 59, 999));

    // 5. Query Roster, Existing Attendance, and Approved Leaves in parallel
    const [rosterEntries, attendanceRecords, approvedLeaves] = await Promise.all([
      tx.query.studentClassHistory.findMany({
        where: and(
          eq(studentClassHistory.sectionId, sectionId),
          eq(studentClassHistory.academicYearId, activeYear.id)
        ),
        with: {
          student: true,
        },
      }),
      tx.query.studentAttendance.findMany({
        where: and(
          eq(studentAttendance.sectionId, sectionId),
          eq(studentAttendance.academicYearId, activeYear.id),
          sql`${studentAttendance.attendanceDate} >= ${startOfDay}`,
          sql`${studentAttendance.attendanceDate} <= ${endOfDay}`
        ),
      }),
      tx.query.studentLeaveRequests.findMany({
        where: and(
          eq(studentLeaveRequests.schoolId, school.id),
          eq(studentLeaveRequests.status, "APPROVED"),
          sql`${studentLeaveRequests.startDate} <= ${endOfDay}`,
          sql`${studentLeaveRequests.endDate} >= ${startOfDay}`
        ),
      }),
    ]);

    const attendanceMap = new Map(
      attendanceRecords.map((r) => [
        r.studentId,
        { status: r.status as AttendanceStatus, remarks: r.remarks, id: r.id },
      ])
    );

    const approvedLeaveMap = new Map(
      approvedLeaves.map((l) => [l.studentId, l.reason])
    );

    let isAlreadyMarked = false;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let leaveCount = 0;

    const mappedStudents: WorkbenchStudent[] = rosterEntries
      .map((entry) => {
        const student = entry.student;
        const existingRecord = attendanceMap.get(student.id);
        const approvedReason = approvedLeaveMap.get(student.id);

        if (existingRecord) {
          isAlreadyMarked = true;
        }

        // Default: If marked, use existing mark. If approved leave exists, pre-chip LEAVE. Else default to PRESENT!
        const resolvedStatus: AttendanceStatus = existingRecord
          ? existingRecord.status
          : approvedReason
          ? "LEAVE"
          : "PRESENT";

        const resolvedRemarks = existingRecord?.remarks || (approvedReason ? `Approved Leave: ${approvedReason}` : "");

        if (resolvedStatus === "PRESENT") presentCount++;
        else if (resolvedStatus === "ABSENT") absentCount++;
        else if (resolvedStatus === "LATE") lateCount++;
        else if (resolvedStatus === "HALF_DAY") halfDayCount++;
        else if (resolvedStatus === "LEAVE") leaveCount++;

        return {
          studentId: student.id,
          rollNumber: entry.rollNumber,
          firstName: decryptData(student.firstNameEncrypted) || "Student",
          lastName: decryptData(student.lastNameEncrypted) || "",
          admissionNumber: student.admissionNumber,
          status: resolvedStatus,
          remarks: resolvedRemarks,
          isPreApprovedLeave: !!approvedReason,
          leaveReason: approvedReason || undefined,
          attendanceRecordId: existingRecord?.id || null,
        };
      })
      .sort((a, b) => {
        const rA = parseInt(a.rollNumber || "0", 10);
        const rB = parseInt(b.rollNumber || "0", 10);
        return rA - rB;
      });

    return {
      sectionId,
      sectionName: sectionMeta.sectionName,
      className: sectionMeta.className,
      dateStr,
      academicYearId: activeYear.id,
      isAlreadyMarked,
      students: mappedStudents,
      counts: {
        total: mappedStudents.length,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        halfDay: halfDayCount,
        leave: leaveCount,
      },
    };
  });
}

/**
 * Saves full-section attendance idempotently, emits outbox domain event, and outputs summary toast.
 */
export async function saveTeacherAttendanceRoster(
  input: SaveAttendanceInput
): Promise<SaveAttendanceResult> {
  const { sectionId, dateStr, periodId, records } = input;

  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  if (records.length === 0) {
    throw new Error("Cannot save empty attendance roster.");
  }

  return await withTenant(school.id, async (tx) => {
    // 1. Verify Scope
    await assertTeacherCanMarkAttendance(ctx.userId, sectionId, { tx });

    // 2. Resolve Active Academic Year
    const activeYear = await tx.query.academicYears.findFirst({
      where: and(
        eq(academicYears.schoolId, school.id),
        eq(academicYears.isActive, true)
      ),
    });

    if (!activeYear) {
      throw new Error("No active academic year found.");
    }

    // 3. Resolve Section and Class Metadata
    const targetSection = await tx
      .select({
        sectionName: sections.name,
        className: classes.displayName,
      })
      .from(sections)
      .innerJoin(classes, eq(sections.classId, classes.id))
      .where(and(eq(sections.id, sectionId), eq(sections.schoolId, school.id)))
      .limit(1);

    const sectionName = targetSection[0]?.sectionName || "Section";
    const className = targetSection[0]?.className || "Class";

    const parsedDate = new Date(dateStr);
    const startOfDay = new Date(new Date(dateStr).setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date(dateStr).setHours(23, 59, 59, 999));

    const studentIds = records.map((r) => r.studentId);

    // 4. Assert DPDP consent in parallel
    await Promise.all(
      records.map((r) => assertConsent(r.studentId, "attendance"))
    );

    // 5. Fetch existing records and approved leaves for date
    const [existingRecords, approvedLeaves] = await Promise.all([
      tx
        .select()
        .from(studentAttendance)
        .where(
          and(
            eq(studentAttendance.schoolId, school.id),
            eq(studentAttendance.sectionId, sectionId),
            inArray(studentAttendance.studentId, studentIds),
            sql`${studentAttendance.attendanceDate} >= ${startOfDay}`,
            sql`${studentAttendance.attendanceDate} <= ${endOfDay}`,
            periodId
              ? eq(studentAttendance.periodId, periodId)
              : sql`${studentAttendance.periodId} IS NULL`
          )
        ),
      tx
        .select({
          studentId: studentLeaveRequests.studentId,
          reason: studentLeaveRequests.reason,
        })
        .from(studentLeaveRequests)
        .where(
          and(
            eq(studentLeaveRequests.schoolId, school.id),
            inArray(studentLeaveRequests.studentId, studentIds),
            eq(studentLeaveRequests.status, "APPROVED"),
            sql`${studentLeaveRequests.startDate} <= ${endOfDay}`,
            sql`${studentLeaveRequests.endDate} >= ${startOfDay}`
          )
        ),
    ]);

    const existingMap = new Map(existingRecords.map((r) => [r.studentId, r]));
    const approvedLeaveMap = new Map(
      approvedLeaves.map((l) => [l.studentId, l.reason])
    );

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;
    let totalHalfDay = 0;
    let totalLeave = 0;

    const toInsert: Array<typeof studentAttendance.$inferInsert> = [];

    for (const record of records) {
      const existing = existingMap.get(record.studentId);
      const approvedReason = approvedLeaveMap.get(record.studentId);

      // Rule: Approved leave suppresses ABSENT into LEAVE
      let finalStatus = record.status;
      if (approvedReason && finalStatus === "ABSENT") {
        finalStatus = "LEAVE";
      }

      if (finalStatus === "PRESENT") totalPresent++;
      else if (finalStatus === "ABSENT") totalAbsent++;
      else if (finalStatus === "LATE") totalLate++;
      else if (finalStatus === "HALF_DAY") totalHalfDay++;
      else if (finalStatus === "LEAVE") totalLeave++;

      const finalRemarks =
        approvedReason && finalStatus === "LEAVE"
          ? `Approved leave: ${approvedReason}`
          : record.remarks || null;

      if (existing) {
        // Update existing row
        await tx
          .update(studentAttendance)
          .set({
            status: finalStatus,
            markedById: ctx.userId,
            remarks: finalRemarks,
            updatedAt: new Date(),
          })
          .where(eq(studentAttendance.id, existing.id));
      } else {
        // Insert new row
        toInsert.push({
          schoolId: school.id,
          studentId: record.studentId,
          sectionId,
          academicYearId: activeYear.id,
          attendanceDate: parsedDate,
          periodId: periodId || null,
          status: finalStatus,
          source: "ROUTINE",
          markedById: ctx.userId,
          remarks: finalRemarks,
        });
      }
    }

    if (toInsert.length > 0) {
      await tx.insert(studentAttendance).values(toInsert);
    }

    // 6. Durable Outbox: Insert AttendanceMarkedEvent for cross-role consumption
    const domainEventPayload: AttendanceMarkedPayload = {
      sectionId,
      date: dateStr,
      totalPresent,
      totalAbsent,
      markedByUserId: ctx.userId,
    };

    await tx.insert(domainEvents).values({
      schoolId: school.id,
      aggregateId: sectionId,
      eventType: "AttendanceMarkedEvent",
      payload: {
        ...domainEventPayload,
        totalLate,
        totalHalfDay,
        totalLeave,
        totalStudents: records.length,
        periodId: periodId || null,
        studentStatuses: records.map((r) => ({
          studentId: r.studentId,
          status: r.status,
        })),
      },
      status: "PENDING",
    });

    // 7. Invalidate dashboard counters
    await invalidateDashboardCache(school.id);

    // 8. Generate exact summary toast (e.g. "Class 8-B: 37 present, 2 absent, 1 leave")
    const parts: string[] = [];
    if (totalPresent > 0) parts.push(`${totalPresent} present`);
    if (totalAbsent > 0) parts.push(`${totalAbsent} absent`);
    if (totalLate > 0) parts.push(`${totalLate} late`);
    if (totalHalfDay > 0) parts.push(`${totalHalfDay} half-day`);
    if (totalLeave > 0) parts.push(`${totalLeave} leave`);

    const summaryToast = `${className} ${sectionName}: ${parts.join(", ")}`;

    return {
      success: true,
      sectionName,
      className,
      dateStr,
      totalStudents: records.length,
      counts: {
        present: totalPresent,
        absent: totalAbsent,
        late: totalLate,
        halfDay: totalHalfDay,
        leave: totalLeave,
      },
      summaryToast,
    };
  });
}
