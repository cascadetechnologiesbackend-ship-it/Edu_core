"use server";

import { db } from "@/db";
import {
  sections,
  studentClassHistory,
  students,
  studentAttendance,
  academicYears,
  classSubjects,
  sectionSubjectTeachers,
} from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { logAuditEvent } from "@/lib/auditLogger";
import { decryptData } from "@/lib/encryption";
import { assertConsent } from "@/server/middleware/consent";
import { invalidateDashboardCache } from "@/lib/dashboardCache";
import { headers } from "next/headers";
import type { Session } from "next-auth";

// Helper to construct a mock context for logAuditEvent
async function getAuditContext(session: Session) {
  const reqHeaders = headers();
  const ip =
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = reqHeaders.get("user-agent") ?? "unknown";
  return {
    db,
    session,
    req: null as any,
    ip,
    userAgent,
  };
}

// 1. Fetch available sections for the logged-in user
export async function getAssignedSections() {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] as const);
  const school = await requireSchool(ctx);

  const userId = ctx.userId;
  const userRole = ctx.role;

  if (["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(userRole)) {
    return await db.query.sections.findMany({
      where: and(
        eq(sections.isActive, true),
        eq(sections.schoolId, school.id)
      ),
      with: {
        class: true,
      },
      orderBy: [sections.name],
    });
  }

  // For TEACHER:
  // 1. Sections where teacher is the Class Teacher
  const classTeacherSections = await db.query.sections.findMany({
    where: and(
      eq(sections.isActive, true),
      eq(sections.schoolId, school.id),
      eq(sections.classTeacherId, userId),
    ),
    with: {
      class: true,
    },
  });

  // 2. Sections where teacher teaches specific subjects (sectionSubjectTeachers)
  const sectionSubjectAllocations = await db.query.sectionSubjectTeachers.findMany({
    where: and(
      eq(sectionSubjectTeachers.schoolId, school.id),
      eq(sectionSubjectTeachers.teacherId, userId),
      eq(sectionSubjectTeachers.isActive, true),
    ),
  });

  // 3. Classes where teacher teaches class-level subjects (classSubjects)
  const classSubjectAllocations = await db.query.classSubjects.findMany({
    where: and(
      eq(classSubjects.schoolId, school.id),
      eq(classSubjects.assignedTeacherId, userId),
    ),
  });

  const extraClassIds = classSubjectAllocations.map((c) => c.classId).filter(Boolean);
  const extraSectionIds = sectionSubjectAllocations.map((s) => s.sectionId).filter(Boolean);

  let extraSections: any[] = [];
  if (extraClassIds.length > 0 || extraSectionIds.length > 0) {
    extraSections = await db.query.sections.findMany({
      where: and(
        eq(sections.isActive, true),
        eq(sections.schoolId, school.id),
        extraClassIds.length > 0 && extraSectionIds.length > 0
          ? sql`(${sections.id} IN ${extraSectionIds} OR ${sections.classId} IN ${extraClassIds})`
          : extraClassIds.length > 0
          ? inArray(sections.classId, extraClassIds)
          : inArray(sections.id, extraSectionIds)
      ),
      with: {
        class: true,
      },
    });
  }

  // Merge uniquely
  const mergedMap = new Map<string, any>();
  classTeacherSections.forEach((s) => mergedMap.set(s.id, s));
  extraSections.forEach((s) => mergedMap.set(s.id, s));

  return Array.from(mergedMap.values());
}

// 2. Fetch students and their attendance status on a specific date
export async function getSectionStudents(sectionId: string, dateStr: string) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] as const);
  const school = await requireSchool(ctx);

  const parsedDate = new Date(dateStr);
  const startOfDay = new Date(new Date(dateStr).setHours(0, 0, 0, 0));
  const endOfDay = new Date(new Date(dateStr).setHours(23, 59, 59, 999));

  // Resolve current active academic year
  const activeYear = await db.query.academicYears.findFirst({
    where: and(
      eq(academicYears.isActive, true),
      eq(academicYears.schoolId, school.id)
    ),
  });

  if (!activeYear) {
    throw new Error("No active academic year found.");
  }

  // Fetch history and attendance records in parallel
  const [history, attendanceRecords] = await Promise.all([
    db.query.studentClassHistory.findMany({
      where: and(
        eq(studentClassHistory.sectionId, sectionId),
        eq(studentClassHistory.academicYearId, activeYear.id),
      ),
      with: {
        student: true,
      },
    }),
    db.query.studentAttendance.findMany({
      where: and(
        eq(studentAttendance.sectionId, sectionId),
        eq(studentAttendance.academicYearId, activeYear.id),
        and(
          sql`${studentAttendance.attendanceDate} >= ${startOfDay}`,
          sql`${studentAttendance.attendanceDate} <= ${endOfDay}`,
        ),
      ),
    }),
  ]);

  const attendanceMap = new Map(
    attendanceRecords.map((r) => [
      r.studentId,
      { status: r.status, remarks: r.remarks, id: r.id },
    ]),
  );

  // Map history back to a decrypted student list with existing attendance status
  return history
    .map((h) => {
      const student = h.student;
      const record = attendanceMap.get(student.id);

      return {
        studentId: student.id,
        rollNumber: h.rollNumber,
        firstName: decryptData(student.firstNameEncrypted) || "Unknown",
        lastName: decryptData(student.lastNameEncrypted) || "",
        admissionNumber: student.admissionNumber,
        attendanceStatus: record?.status || null,
        remarks: record?.remarks || "",
        attendanceRecordId: record?.id || null,
      };
    })
    .sort((a, b) => {
      const rollA = parseInt(a.rollNumber || "0", 10);
      const rollB = parseInt(b.rollNumber || "0", 10);
      return rollA - rollB;
    });
}

// 3. Mark or Update attendance for students
export async function markSectionAttendance(
  sectionId: string,
  dateStr: string,
  records: Array<{
    studentId: string;
    status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE" | "HOLIDAY";
    remarks?: string;
  }>,
) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] as const);
  const school = await requireSchool(ctx);

  const userId = ctx.userId;
  const userRole = ctx.role;
  const schoolId = school.id;

  // Strict check: Teachers can only mark attendance of their assigned sections
  if (userRole === "TEACHER") {
    const isClassTeacher = await db.query.sections.findFirst({
      where: and(
        eq(sections.id, sectionId),
        eq(sections.classTeacherId, userId),
      ),
    });

    if (!isClassTeacher) {
      // Check if assigned via sectionSubjectTeachers
      const isSectionSubjectTeacher = await db.query.sectionSubjectTeachers.findFirst({
        where: and(
          eq(sectionSubjectTeachers.sectionId, sectionId),
          eq(sectionSubjectTeachers.teacherId, userId),
          eq(sectionSubjectTeachers.isActive, true),
        ),
      });

      if (!isSectionSubjectTeacher) {
        // Check if assigned via class-level classSubjects
        const targetSection = await db.query.sections.findFirst({
          where: eq(sections.id, sectionId),
        });
        const isClassSubjectTeacher = targetSection ? await db.query.classSubjects.findFirst({
          where: and(
            eq(classSubjects.classId, targetSection.classId),
            eq(classSubjects.assignedTeacherId, userId),
          ),
        }) : null;

        if (!isClassSubjectTeacher) {
          throw new Error(
            "Access Denied: You can only mark attendance for your assigned sections.",
          );
        }
      }
    }
  }

  // Resolve current active academic year
  const activeYear = await db.query.academicYears.findFirst({
    where: and(
      eq(academicYears.isActive, true),
      eq(academicYears.schoolId, school.id)
    ),
  });

  if (!activeYear) {
    throw new Error("No active academic year found.");
  }

  const parsedDate = new Date(dateStr);
  const startOfDay = new Date(parsedDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(parsedDate.setHours(23, 59, 59, 999));

  const ctxAudit = await getAuditContext({ user: { id: ctx.userId, role: ctx.role, schoolId: school.id } } as any);

  const studentIds = records.map((r) => r.studentId);
  if (studentIds.length === 0) return { success: true };

  // DPDP Consent Check in parallel across all students
  await Promise.all(
    records.map((record) => assertConsent(record.studentId, "attendance")),
  );

  // Fetch all existing attendance records for these students on this date in a single batch query
  const existingRecords = await db
    .select()
    .from(studentAttendance)
    .where(
      and(
        inArray(studentAttendance.studentId, studentIds),
        eq(studentAttendance.academicYearId, activeYear.id),
        sql`${studentAttendance.attendanceDate} >= ${startOfDay}`,
        sql`${studentAttendance.attendanceDate} <= ${endOfDay}`,
      ),
    );

  const existingMap = new Map(
    existingRecords.map((r) => [r.studentId, r]),
  );

  // Execute bulk operations in a high-speed transaction
  await db.transaction(async (tx) => {
    const toInsert: Array<typeof studentAttendance.$inferInsert> = [];

    for (const record of records) {
      const existing = existingMap.get(record.studentId);
      if (existing) {
        await tx
          .update(studentAttendance)
          .set({
            status: record.status,
            markedById: userId,
            remarks: record.remarks || null,
            updatedAt: new Date(),
          })
          .where(eq(studentAttendance.id, existing.id));
      } else {
        toInsert.push({
          schoolId,
          studentId: record.studentId,
          sectionId,
          academicYearId: activeYear.id,
          attendanceDate: parsedDate,
          status: record.status,
          markedById: userId,
          remarks: record.remarks || null,
        });
      }
    }

    if (toInsert.length > 0) {
      await tx.insert(studentAttendance).values(toInsert);
    }

    // DPDP compliance: write section-level batch audit log
    await logAuditEvent(ctxAudit, {
      action: "WRITE",
      tableName: "student_attendance",
      recordId: sectionId,
      purposeId: "attendance",
      schoolId,
      metadata: {
        sectionId,
        date: dateStr,
        totalCount: records.length,
        newRecordsCount: toInsert.length,
        updatedRecordsCount: records.length - toInsert.length,
      },
    });
  });

  // Tag-invalidate dashboard counters on attendance writes (PF-R41 / PF-R80)
  await invalidateDashboardCache(schoolId);

  return { success: true };
}
