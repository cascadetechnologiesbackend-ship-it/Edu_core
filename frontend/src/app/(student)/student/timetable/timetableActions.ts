"use server";

import { getCachedSession } from "@/lib/serverAuth";
import { withTenant } from "@/db";
import {
  timetablePeriods,
  timetableSubstitutions,
  subjects,
  staff,
} from "@/db/schema";
import { and, eq, inArray, asc } from "drizzle-orm";
import { resolveStudentScope } from "@/lib/studentEventEngine/scopeResolver";
import { decryptData } from "@/lib/encryption";

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY";

export interface StudentTimetablePeriod {
  id: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  startTime: string;
  endTime: string;
  periodType: string;
  subjectId: string | null;
  subjectName: string;
  subjectCode: string | null;
  teacherId: string | null;
  teacherName: string | null;
  roomNumber: string | null;
  isSubstituted: boolean;
  substituteTeacherName?: string | null;
  originalTeacherName?: string | null;
}

export interface StudentTimetableData {
  success: boolean;
  student: {
    studentId: string;
    studentName: string;
    className: string;
    sectionName: string;
    academicYearLabel: string;
  };
  periods: StudentTimetablePeriod[];
  todayDayOfWeek: DayOfWeek | "SUNDAY";
  todayDateFormatted: string;
  error?: string;
}

const DAY_NAMES: Array<DayOfWeek | "SUNDAY"> = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

export async function getStudentTimetableAction(
  studentIdParam?: string
): Promise<StudentTimetableData> {
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
      periods: [],
      todayDayOfWeek: "SUNDAY",
      todayDateFormatted: new Date().toISOString().split("T")[0]!,
      error: "Authentication required",
    };
  }

  try {
    const scope = await resolveStudentScope(userId, {
      schoolId,
      studentId: studentIdParam ?? null,
      role,
    });

    const now = new Date();
    const todayDayOfWeek = DAY_NAMES[now.getDay()]!;
    const todayStr = now.toISOString().split("T")[0]!;

    if (!scope.sectionId || !scope.academicYearId) {
      return {
        success: true,
        student: {
          studentId: scope.studentId,
          studentName: scope.studentName,
          className: scope.className,
          sectionName: scope.sectionName,
          academicYearLabel: scope.academicYearLabel,
        },
        periods: [],
        todayDayOfWeek,
        todayDateFormatted: todayStr,
      };
    }

    const sectionId = scope.sectionId;
    const academicYearId = scope.academicYearId;

    return await withTenant(scope.schoolId, async (tx) => {
      // 1. Fetch active timetable periods for student's section & academic year
      const periodRows = await tx.query.timetablePeriods.findMany({
        where: and(
          eq(timetablePeriods.schoolId, scope.schoolId),
          eq(timetablePeriods.sectionId, sectionId),
          eq(timetablePeriods.academicYearId, academicYearId),
          eq(timetablePeriods.isActive, true)
        ),
        orderBy: [asc(timetablePeriods.periodNumber)],
      });

      if (periodRows.length === 0) {
        return {
          success: true,
          student: {
            studentId: scope.studentId,
            studentName: scope.studentName,
            className: scope.className,
            sectionName: scope.sectionName,
            academicYearLabel: scope.academicYearLabel,
          },
          periods: [],
          todayDayOfWeek,
          todayDateFormatted: todayStr,
        };
      }

      // 2. Fetch subject names
      const subjectIds = Array.from(
        new Set(periodRows.map((p) => p.subjectId).filter(Boolean))
      ) as string[];

      const subjectMap = new Map<string, { name: string; code: string | null }>();
      if (subjectIds.length > 0) {
        const subjectRows = await tx.query.subjects.findMany({
          where: and(
            eq(subjects.schoolId, scope.schoolId),
            inArray(subjects.id, subjectIds)
          ),
          columns: { id: true, name: true, code: true },
        });
        for (const sub of subjectRows) {
          subjectMap.set(sub.id, { name: sub.name, code: sub.code });
        }
      }

      // 3. Fetch teachers from staff
      const teacherUserIds = Array.from(
        new Set(periodRows.map((p) => p.teacherId).filter(Boolean))
      ) as string[];

      // 4. Fetch today's approved/confirmed substitutions for this section
      const subRows = await tx.query.timetableSubstitutions.findMany({
        where: and(
          eq(timetableSubstitutions.schoolId, scope.schoolId),
          eq(timetableSubstitutions.sectionId, sectionId),
          eq(timetableSubstitutions.date, todayStr),
          eq(timetableSubstitutions.status, "CONFIRMED")
        ),
      });

      const substituteUserIds = Array.from(
        new Set(subRows.map((s) => s.substituteTeacherId).filter(Boolean))
      ) as string[];

      const allStaffUserIds = Array.from(
        new Set([...teacherUserIds, ...substituteUserIds])
      );

      const staffMap = new Map<string, string>();
      if (allStaffUserIds.length > 0) {
        const staffRows = await tx.query.staff.findMany({
          where: and(
            eq(staff.schoolId, scope.schoolId),
            inArray(staff.userId, allStaffUserIds)
          ),
          columns: {
            userId: true,
            firstNameEncrypted: true,
            lastNameEncrypted: true,
          },
        });

        for (const st of staffRows) {
          if (st.userId) {
            const fName = decryptData(st.firstNameEncrypted) || "";
            const lName = st.lastNameEncrypted
              ? decryptData(st.lastNameEncrypted) || ""
              : "";
            const fullName = `${fName} ${lName}`.trim() || "Teacher";
            staffMap.set(st.userId, fullName);
          }
        }
      }

      // Map substitutions by timetablePeriodId
      const substitutionByPeriod = new Map<
        string,
        typeof timetableSubstitutions.$inferSelect
      >();
      for (const s of subRows) {
        substitutionByPeriod.set(s.timetablePeriodId, s);
      }

      // Assemble final periods
      const mappedPeriods: StudentTimetablePeriod[] = periodRows.map((p) => {
        const sub = p.subjectId ? subjectMap.get(p.subjectId) : null;
        const subjectName = sub?.name || (p.periodType !== "REGULAR" ? p.periodType : "Subject");
        const originalTeacher = p.teacherId ? staffMap.get(p.teacherId) || null : null;

        const approvedSub = substitutionByPeriod.get(p.id);
        const isSubstituted = Boolean(
          approvedSub && p.dayOfWeek === todayDayOfWeek
        );
        const substituteTeacherName =
          approvedSub && approvedSub.substituteTeacherId
            ? staffMap.get(approvedSub.substituteTeacherId) || "Substitute Teacher"
            : null;

        const effectiveTeacherName = isSubstituted
          ? substituteTeacherName
          : originalTeacher;

        return {
          id: p.id,
          dayOfWeek: p.dayOfWeek as DayOfWeek,
          periodNumber: p.periodNumber,
          startTime: p.startTime,
          endTime: p.endTime,
          periodType: p.periodType,
          subjectId: p.subjectId,
          subjectName,
          subjectCode: sub?.code || null,
          teacherId: isSubstituted && approvedSub?.substituteTeacherId ? approvedSub.substituteTeacherId : p.teacherId,
          teacherName: effectiveTeacherName,
          roomNumber: p.roomNumber,
          isSubstituted,
          ...(isSubstituted
            ? {
                substituteTeacherName,
                originalTeacherName: originalTeacher,
              }
            : {}),
        };
      });

      return {
        success: true,
        student: {
          studentId: scope.studentId,
          studentName: scope.studentName,
          className: scope.className,
          sectionName: scope.sectionName,
          academicYearLabel: scope.academicYearLabel,
        },
        periods: mappedPeriods,
        todayDayOfWeek,
        todayDateFormatted: todayStr,
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
      periods: [],
      todayDayOfWeek: "SUNDAY",
      todayDateFormatted: new Date().toISOString().split("T")[0]!,
      error: err.message || "Failed to load timetable",
    };
  }
}
