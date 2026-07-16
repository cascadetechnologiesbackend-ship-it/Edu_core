"use server";

import { db } from "@/db";
import {
  sections,
  studentClassHistory,
  students,
  studentAttendance,
  academicYears,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { decryptData } from "@/lib/encryption";
import { logAuditEvent } from "@/lib/auditLogger";
import { headers } from "next/headers";

// Helper to construct a mock context for logAuditEvent
async function getAuditContext(session: any) {
  const reqHeaders = headers();
  const ip =
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = reqHeaders.get("user-agent") ?? "unknown";
  return {
    db,
    session,
    ip,
    userAgent,
  };
}

// 1. Fetch available sections for the logged-in user
export async function getAssignedSections() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const userRole = session.user.role;

  if (["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(userRole)) {
    return await db.query.sections.findMany({
      where: eq(sections.isActive, true),
      with: {
        class: true,
      },
    });
  }

  // Filter by classTeacherId for TEACHER
  return await db.query.sections.findMany({
    where: and(
      eq(sections.isActive, true),
      eq(sections.classTeacherId, userId),
    ),
    with: {
      class: true,
    },
  });
}

// 2. Fetch students and their attendance status on a specific date
export async function getSectionStudents(sectionId: string, dateStr: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsedDate = new Date(dateStr);
  const startOfDay = new Date(parsedDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(parsedDate.setHours(23, 59, 59, 999));

  // Resolve current active academic year
  const activeYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isActive, true),
  });

  if (!activeYear) {
    throw new Error("No active academic year found.");
  }

  // Fetch all students mapped to this section in the class history for the active year
  const history = await db.query.studentClassHistory.findMany({
    where: and(
      eq(studentClassHistory.sectionId, sectionId),
      eq(studentClassHistory.academicYearId, activeYear.id),
    ),
    with: {
      student: true,
    },
  });

  // Fetch existing attendance records for these students on the selected date
  const attendanceRecords = await db.query.studentAttendance.findMany({
    where: and(
      eq(studentAttendance.sectionId, sectionId),
      eq(studentAttendance.academicYearId, activeYear.id),
      and(
        sql`${studentAttendance.attendanceDate} >= ${startOfDay}`,
        sql`${studentAttendance.attendanceDate} <= ${endOfDay}`,
      ),
    ),
  });

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
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const userRole = session.user.role;
  const schoolId = session.user.schoolId;

  if (!schoolId) {
    throw new Error("User session does not specify schoolId.");
  }

  // Strict check: Teachers can only mark attendance of their assigned sections
  if (userRole === "TEACHER") {
    const assignedSection = await db.query.sections.findFirst({
      where: and(
        eq(sections.id, sectionId),
        eq(sections.classTeacherId, userId),
      ),
    });

    if (!assignedSection) {
      throw new Error(
        "Access Denied: You can only mark attendance for your assigned section.",
      );
    }
  }

  // Resolve current active academic year
  const activeYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isActive, true),
  });

  if (!activeYear) {
    throw new Error("No active academic year found.");
  }

  const parsedDate = new Date(dateStr);
  const startOfDay = new Date(parsedDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(parsedDate.setHours(23, 59, 59, 999));

  const ctx = await getAuditContext(session);

  // Execute bulk insert/update in a transaction
  await db.transaction(async (tx) => {
    for (const record of records) {
      // Look for existing attendance record on this date
      const [existingRecord] = await tx
        .select()
        .from(studentAttendance)
        .where(
          and(
            eq(studentAttendance.studentId, record.studentId),
            eq(studentAttendance.academicYearId, activeYear.id),
            and(
              sql`${studentAttendance.attendanceDate} >= ${startOfDay}`,
              sql`${studentAttendance.attendanceDate} <= ${endOfDay}`,
            ),
          ),
        )
        .limit(1);

      let markedRecordId = "";

      if (existingRecord) {
        markedRecordId = existingRecord.id;
        await tx
          .update(studentAttendance)
          .set({
            status: record.status,
            markedById: userId,
            remarks: record.remarks || null,
            updatedAt: new Date(),
          })
          .where(eq(studentAttendance.id, existingRecord.id));
      } else {
        const [newRecord] = await tx
          .insert(studentAttendance)
          .values({
            schoolId,
            studentId: record.studentId,
            sectionId,
            academicYearId: activeYear.id,
            attendanceDate: parsedDate,
            status: record.status,
            markedById: userId,
            remarks: record.remarks || null,
          })
          .returning({ id: studentAttendance.id });
        markedRecordId = newRecord?.id || "";
      }

      // DPDP compliance: write to audit log
      await logAuditEvent(ctx as any, {
        action: existingRecord ? "WRITE" : "WRITE",
        tableName: "student_attendance",
        recordId: markedRecordId,
        purposeId: "attendance",
        schoolId,
        metadata: { studentId: record.studentId, status: record.status },
      });
    }
  });

  return { success: true };
}
