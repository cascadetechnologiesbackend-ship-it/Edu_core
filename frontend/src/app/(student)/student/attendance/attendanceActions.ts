"use server";

import { getCachedSession } from "@/lib/serverAuth";
import { withTenant } from "@/db";
import { studentAttendance, studentLeaveRequests } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { resolveStudentScope } from "@/lib/studentEventEngine/scopeResolver";

export type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "HALF_DAY"
  | "LEAVE"
  | "HOLIDAY";

export interface StudentAttendanceDayRecord {
  id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  remarks: string | null;
}

export interface StudentAttendanceStats {
  totalDaysMarked: number;
  presentDays: number;
  lateDays: number;
  halfDays: number;
  absentDays: number;
  leaveDays: number;
  attendancePercentage: number | null; // null if totalDaysMarked is 0 (AC-11, AC-17)
}

export interface StudentLeaveRequestItem {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED_BY_PARENT";
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface StudentAttendanceData {
  success: boolean;
  student: {
    studentId: string;
    studentName: string;
    className: string;
    sectionName: string;
    academicYearLabel: string;
  };
  stats: StudentAttendanceStats;
  records: StudentAttendanceDayRecord[];
  leaveRequests: StudentLeaveRequestItem[];
  error?: string;
}

export async function getStudentAttendanceAction(
  studentIdParam?: string
): Promise<StudentAttendanceData> {
  const session = await getCachedSession();
  const userId = session?.user?.id || "";
  const schoolId = session?.user?.schoolId || "";
  const role = session?.user?.role || "STUDENT";

  if (!userId || !schoolId) {
    return {
      success: false,
      student: {
        studentId: "",
        studentName: "",
        className: "",
        sectionName: "",
        academicYearLabel: "",
      },
      stats: {
        totalDaysMarked: 0,
        presentDays: 0,
        lateDays: 0,
        halfDays: 0,
        absentDays: 0,
        leaveDays: 0,
        attendancePercentage: null,
      },
      records: [],
      leaveRequests: [],
      error: "Authentication required",
    };
  }

  try {
    const scope = await resolveStudentScope(userId, {
      schoolId,
      studentId: studentIdParam ?? null,
      role,
    });

    if (!scope.academicYearId) {
      return {
        success: true,
        student: {
          studentId: scope.studentId,
          studentName: scope.studentName,
          className: scope.className,
          sectionName: scope.sectionName,
          academicYearLabel: scope.academicYearLabel,
        },
        stats: {
          totalDaysMarked: 0,
          presentDays: 0,
          lateDays: 0,
          halfDays: 0,
          absentDays: 0,
          leaveDays: 0,
          attendancePercentage: null,
        },
        records: [],
        leaveRequests: [],
      };
    }

    const academicYearId = scope.academicYearId;

    return await withTenant(scope.schoolId, async (tx) => {
      // 1. Fetch all attendance rows for this student in the active academic year
      const attendanceRows = await tx.query.studentAttendance.findMany({
        where: and(
          eq(studentAttendance.schoolId, scope.schoolId),
          eq(studentAttendance.studentId, scope.studentId),
          eq(studentAttendance.academicYearId, academicYearId)
        ),
        orderBy: [desc(studentAttendance.attendanceDate)],
      });

      // Daily rollup: if day attendance exists (periodId is null), prioritize it.
      // Otherwise keep single record per unique calendar date (YYYY-MM-DD).
      const recordsByDate = new Map<string, StudentAttendanceDayRecord>();

      for (const row of attendanceRows) {
        const dateStr = new Date(row.attendanceDate).toISOString().split("T")[0]!;
        const existing = recordsByDate.get(dateStr);

        // If daily attendance (periodId == null) or not yet populated, set it
        if (!existing || (!row.periodId && existing.status !== "PRESENT")) {
          recordsByDate.set(dateStr, {
            id: row.id,
            date: dateStr,
            status: row.status as AttendanceStatus,
            remarks: row.remarks || null,
          });
        }
      }

      const records = Array.from(recordsByDate.values()).sort((a, b) =>
        b.date.localeCompare(a.date)
      );

      // 2. Compute authentic term attendance statistics (Truth Invariant: zero hardcoded values!)
      let presentDays = 0;
      let lateDays = 0;
      let halfDays = 0;
      let absentDays = 0;
      let leaveDays = 0;

      for (const rec of records) {
        switch (rec.status) {
          case "PRESENT":
            presentDays++;
            break;
          case "LATE":
            lateDays++;
            break;
          case "HALF_DAY":
            halfDays++;
            break;
          case "ABSENT":
            absentDays++;
            break;
          case "LEAVE":
            leaveDays++;
            break;
          case "HOLIDAY":
            // Holidays not counted against attendance percentage denominator
            break;
        }
      }

      const totalMarkedDays =
        presentDays + lateDays + halfDays + absentDays + leaveDays;

      // Authentic calculation: present + late + (halfDay * 0.5) / total marked days
      const attendancePercentage =
        totalMarkedDays > 0
          ? Math.round(
              ((presentDays + lateDays + halfDays * 0.5) / totalMarkedDays) *
                1000
            ) / 10
          : null;

      const stats: StudentAttendanceStats = {
        totalDaysMarked: totalMarkedDays,
        presentDays,
        lateDays,
        halfDays,
        absentDays,
        leaveDays,
        attendancePercentage,
      };

      // 3. Fetch Student Leave Requests (read-only for student, BR7)
      const leaveRows = await tx.query.studentLeaveRequests.findMany({
        where: and(
          eq(studentLeaveRequests.schoolId, scope.schoolId),
          eq(studentLeaveRequests.studentId, scope.studentId)
        ),
        orderBy: [desc(studentLeaveRequests.createdAt)],
      });

      const leaveRequests: StudentLeaveRequestItem[] = leaveRows.map((lr) => ({
        id: lr.id,
        leaveType: lr.leaveType,
        startDate: new Date(lr.startDate).toISOString().split("T")[0]!,
        endDate: new Date(lr.endDate).toISOString().split("T")[0]!,
        reason: lr.reason,
        status: lr.status,
        decisionNote: lr.decisionNote || null,
        decidedAt: lr.decidedAt ? new Date(lr.decidedAt).toISOString() : null,
        createdAt: lr.createdAt ? new Date(lr.createdAt).toISOString() : new Date().toISOString(),
      }));

      return {
        success: true,
        student: {
          studentId: scope.studentId,
          studentName: scope.studentName,
          className: scope.className,
          sectionName: scope.sectionName,
          academicYearLabel: scope.academicYearLabel,
        },
        stats,
        records,
        leaveRequests,
      };
    });
  } catch (err: any) {
    return {
      success: false,
      student: {
        studentId: "",
        studentName: "",
        className: "",
        sectionName: "",
        academicYearLabel: "",
      },
      stats: {
        totalDaysMarked: 0,
        presentDays: 0,
        lateDays: 0,
        halfDays: 0,
        absentDays: 0,
        leaveDays: 0,
        attendancePercentage: null,
      },
      records: [],
      leaveRequests: [],
      error: err.message || "Failed to load student attendance records",
    };
  }
}
