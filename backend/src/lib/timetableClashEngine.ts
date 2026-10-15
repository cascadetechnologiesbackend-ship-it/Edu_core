import { db } from "@/db";
import { withTenant } from "./tenant";
import {
  examSchedules,
  timetablePeriods,
  timetableSubstitutions,
  userRoles,
  roles,
  users,
  staff,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface ScheduleConflictCheckParams {
  schoolId: string;
  scheduleId?: string | undefined;
  examId: string;
  classId: string;
  subjectId: string;
  examDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM or HH:MM:SS
  durationMinutes: number;
  roomNumber?: string | null | undefined;
  invigilatorId?: string | null | undefined;
}

export interface ConflictDetails {
  type: "ROOM" | "INVIGILATOR" | "CLASS";
  severity: "ERROR" | "WARNING";
  message: string;
  conflictingEntityId?: string | undefined;
  conflictingEntityName?: string | undefined;
}

export interface ScheduleConflictCheckResult {
  hasConflict: boolean;
  canOverride: boolean;
  conflicts: ConflictDetails[];
}

export interface InvigilatorAvailability {
  userId: string;
  name: string;
  email: string;
  status: "FULLY_AVAILABLE" | "AVAILABLE_WITH_LATER_PERIODS" | "CONFLICTED";
  conflictReason?: string | undefined;
  periodsToday: number;
}

export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":");
  const hours = parseInt(parts[0] || "0", 10);
  const minutes = parseInt(parts[1] || "0", 10);
  return hours * 60 + minutes;
}

export function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && startB < endA;
}

export type TimetableDayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY";

export function getDayOfWeek(dateStr: string): TimetableDayOfWeek | null {
  // Use noon UTC to avoid date shifting in any timezone
  const d = new Date(`${dateStr}T12:00:00Z`);
  const dayIndex = d.getUTCDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
  if (dayIndex === 0) return null; // Sunday has no timetable periods
  const dayNames: TimetableDayOfWeek[] = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ];
  return dayNames[dayIndex - 1] ?? null;
}

/**
 * Checks for room, invigilator, and class timetable clashes across exams and regular periods.
 * S11 Layer 5: Timetable-Aware Scheduling & Clash Detection.
 */
export async function checkScheduleConflicts(
  params: ScheduleConflictCheckParams,
): Promise<ScheduleConflictCheckResult> {
  const {
    schoolId,
    scheduleId,
    examDate,
    startTime,
    durationMinutes,
    roomNumber,
    invigilatorId,
    classId,
  } = params;

  return await withTenant(schoolId, async (scopedDb) => {
    const conflicts: ConflictDetails[] = [];
    const examStartMin = timeStringToMinutes(startTime);
    const examEndMin = examStartMin + durationMinutes;
    const dayOfWeek = getDayOfWeek(examDate);

    // 1. Room Conflict Check
    if (roomNumber && roomNumber.trim()) {
      const trimmedRoom = roomNumber.trim();

      // 1a. Other exam papers in the same room on the same date
      const sameRoomExamSchedules = await scopedDb.query.examSchedules.findMany({
        where: and(
          eq(examSchedules.schoolId, schoolId),
          eq(examSchedules.examDate, examDate),
          eq(examSchedules.roomNumber, trimmedRoom),
        ),
        with: {
          subject: true,
          class: true,
        },
      });

      for (const other of sameRoomExamSchedules) {
        if (other.id === scheduleId) continue;
        const otherStart = timeStringToMinutes(other.startTime);
        const otherEnd = otherStart + other.durationMinutes;

        if (intervalsOverlap(examStartMin, examEndMin, otherStart, otherEnd)) {
          conflicts.push({
            type: "ROOM",
            severity: "ERROR",
            message: `Room "${trimmedRoom}" is already booked for ${other.subject?.name || "another examination"} (${other.class?.displayName || "Class"}) from ${other.startTime} (${other.durationMinutes}m).`,
            conflictingEntityId: other.id,
            conflictingEntityName: trimmedRoom,
          });
        }
      }

      // 1b. Regular timetable periods using this room on this day of week
      if (dayOfWeek !== null) {
        const sameRoomPeriods = await scopedDb.query.timetablePeriods.findMany({
          where: and(
            eq(timetablePeriods.schoolId, schoolId),
            eq(timetablePeriods.dayOfWeek, dayOfWeek),
            eq(timetablePeriods.roomNumber, trimmedRoom),
            eq(timetablePeriods.isActive, true),
          ),
          with: {
            subject: true,
          },
        });

        for (const period of sameRoomPeriods) {
          const periodStart = timeStringToMinutes(period.startTime);
          const periodEnd = timeStringToMinutes(period.endTime);

          if (intervalsOverlap(examStartMin, examEndMin, periodStart, periodEnd)) {
            conflicts.push({
              type: "ROOM",
              severity: "ERROR",
              message: `Room "${trimmedRoom}" is occupied by regular class timetable (Period ${period.periodNumber}, ${period.subject?.name || "Subject"}) from ${period.startTime} to ${period.endTime}.`,
              conflictingEntityId: period.id,
              conflictingEntityName: trimmedRoom,
            });
          }
        }
      }
    }

    // 2. Invigilator Conflict Check
    if (invigilatorId) {
      // 2a. Invigilating another exam paper on this date
      const invigilatorSchedules = await scopedDb.query.examSchedules.findMany({
        where: and(
          eq(examSchedules.schoolId, schoolId),
          eq(examSchedules.examDate, examDate),
          eq(examSchedules.invigilatorId, invigilatorId),
        ),
        with: {
          subject: true,
        },
      });

      for (const other of invigilatorSchedules) {
        if (other.id === scheduleId) continue;
        const otherStart = timeStringToMinutes(other.startTime);
        const otherEnd = otherStart + other.durationMinutes;

        if (intervalsOverlap(examStartMin, examEndMin, otherStart, otherEnd)) {
          conflicts.push({
            type: "INVIGILATOR",
            severity: "ERROR",
            message: `Selected invigilator is already assigned to invigilate ${other.subject?.name || "another paper"} from ${other.startTime} (${other.durationMinutes}m).`,
            conflictingEntityId: other.id,
          });
        }
      }

      // 2b. Teaching regular timetable periods on this day
      if (dayOfWeek !== null) {
        const teacherPeriods = await scopedDb.query.timetablePeriods.findMany({
          where: and(
            eq(timetablePeriods.schoolId, schoolId),
            eq(timetablePeriods.dayOfWeek, dayOfWeek),
            eq(timetablePeriods.teacherId, invigilatorId),
            eq(timetablePeriods.isActive, true),
          ),
        });

        // Check if any of these periods were substituted away on this date
        const periodIds = teacherPeriods.map((p) => p.id);
        const substitutedAwayIds = new Set<string>();
        if (periodIds.length > 0) {
          const awaySubstitutions = await scopedDb.query.timetableSubstitutions.findMany({
            where: and(
              eq(timetableSubstitutions.schoolId, schoolId),
              eq(timetableSubstitutions.date, examDate),
              eq(timetableSubstitutions.originalTeacherId, invigilatorId),
              eq(timetableSubstitutions.status, "CONFIRMED"),
              inArray(timetableSubstitutions.timetablePeriodId, periodIds),
            ),
            columns: { timetablePeriodId: true },
          });
          for (const s of awaySubstitutions) {
            substitutedAwayIds.add(s.timetablePeriodId);
          }
        }

        for (const period of teacherPeriods) {
          if (substitutedAwayIds.has(period.id)) continue; // Substituted away

          const periodStart = timeStringToMinutes(period.startTime);
          const periodEnd = timeStringToMinutes(period.endTime);

          if (intervalsOverlap(examStartMin, examEndMin, periodStart, periodEnd)) {
            conflicts.push({
              type: "INVIGILATOR",
              severity: "ERROR",
              message: `Invigilator is scheduled to teach Period ${period.periodNumber} from ${period.startTime} to ${period.endTime}.`,
              conflictingEntityId: period.id,
            });
          }
        }
      }

      // Also check if teacher was assigned as substitute for another class today
      const assignedSubstitutions = await scopedDb.query.timetableSubstitutions.findMany({
        where: and(
          eq(timetableSubstitutions.schoolId, schoolId),
          eq(timetableSubstitutions.date, examDate),
          eq(timetableSubstitutions.substituteTeacherId, invigilatorId),
          eq(timetableSubstitutions.status, "CONFIRMED"),
        ),
        with: {
          timetablePeriod: true,
        },
      });

      for (const sub of assignedSubstitutions) {
        if (!sub.timetablePeriod) continue;
        const subStart = timeStringToMinutes(sub.timetablePeriod.startTime);
        const subEnd = timeStringToMinutes(sub.timetablePeriod.endTime);

        if (intervalsOverlap(examStartMin, examEndMin, subStart, subEnd)) {
          conflicts.push({
            type: "INVIGILATOR",
            severity: "ERROR",
            message: `Invigilator has a substitute teaching duty for Period ${sub.timetablePeriod.periodNumber} from ${sub.timetablePeriod.startTime} to ${sub.timetablePeriod.endTime}.`,
            conflictingEntityId: sub.id,
          });
        }
      }
    }

    // 3. Class Conflict Check (Same class with overlapping paper on the same date)
    const classSchedules = await scopedDb.query.examSchedules.findMany({
      where: and(
        eq(examSchedules.schoolId, schoolId),
        eq(examSchedules.examDate, examDate),
        eq(examSchedules.classId, classId),
      ),
      with: {
        subject: true,
      },
    });

    for (const other of classSchedules) {
      if (other.id === scheduleId) continue;
      const otherStart = timeStringToMinutes(other.startTime);
      const otherEnd = otherStart + other.durationMinutes;

      if (intervalsOverlap(examStartMin, examEndMin, otherStart, otherEnd)) {
        conflicts.push({
          type: "CLASS",
          severity: "ERROR",
          message: `This class already has another examination paper (${other.subject?.name || "Exam"}) scheduled from ${other.startTime} (${other.durationMinutes}m).`,
          conflictingEntityId: other.id,
        });
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      canOverride: true, // evaluated by caller with actor permissions
      conflicts,
    };
  });
}

/**
 * Returns available invigilators ranked by availability status:
 * 1. FULLY_AVAILABLE
 * 2. AVAILABLE_WITH_LATER_PERIODS
 * 3. CONFLICTED
 */
export async function getAvailableInvigilators(
  schoolId: string,
  examDate: string,
  startTime: string,
  durationMinutes: number,
): Promise<InvigilatorAvailability[]> {
  return await withTenant(schoolId, async (scopedDb) => {
    const examStartMin = timeStringToMinutes(startTime);
    const examEndMin = examStartMin + durationMinutes;
    const dayOfWeek = getDayOfWeek(examDate);

    // 1. Fetch all teachers in this school
    const teacherRoles = await scopedDb.query.roles.findMany({
      where: and(eq(roles.schoolId, schoolId), eq(roles.name, "TEACHER")),
      columns: { id: true },
    });
    const teacherRoleIds = teacherRoles.map((r) => r.id);

    if (teacherRoleIds.length === 0) {
      return [];
    }

    const teacherUserRoles = await scopedDb.query.userRoles.findMany({
      where: and(
        eq(userRoles.schoolId, schoolId),
        inArray(userRoles.roleId, teacherRoleIds),
      ),
      columns: { userId: true },
    });

    const teacherUserIds = Array.from(new Set(teacherUserRoles.map((ur) => ur.userId)));
    if (teacherUserIds.length === 0) {
      return [];
    }

    const teacherUsers = await scopedDb.query.users.findMany({
      where: and(
        eq(users.schoolId, schoolId),
        eq(users.isActive, true),
        inArray(users.id, teacherUserIds),
      ),
      columns: { id: true, email: true },
    });

    const staffList = await scopedDb.query.staff.findMany({
      where: and(
        eq(staff.schoolId, schoolId),
        inArray(staff.userId, teacherUserIds),
      ),
      columns: { userId: true, employeeCode: true },
    });
    const staffByUserId = new Map(staffList.map((s) => [s.userId, s]));

    const results: InvigilatorAvailability[] = [];

    for (const tUser of teacherUsers) {
      const userId = tUser.id;
      const staffMember = staffByUserId.get(userId);
      const teacherName = staffMember?.employeeCode
        ? `Teacher (${staffMember.employeeCode})`
        : tUser.email.split("@")[0] || "Teacher";

      // Check exam conflicts
      const overlappingExam = await scopedDb.query.examSchedules.findFirst({
        where: and(
          eq(examSchedules.schoolId, schoolId),
          eq(examSchedules.examDate, examDate),
          eq(examSchedules.invigilatorId, userId),
        ),
        with: { subject: true },
      });

      if (overlappingExam) {
        const oStart = timeStringToMinutes(overlappingExam.startTime);
        const oEnd = oStart + overlappingExam.durationMinutes;
        if (intervalsOverlap(examStartMin, examEndMin, oStart, oEnd)) {
          results.push({
            userId,
            name: teacherName,
            email: tUser.email,
            status: "CONFLICTED",
            conflictReason: `Invigilating ${overlappingExam.subject?.name || "Exam"} (${overlappingExam.startTime})`,
            periodsToday: 0,
          });
          continue;
        }
      }

      // Check timetable periods on this day
      const dayPeriods =
        dayOfWeek !== null
          ? await scopedDb.query.timetablePeriods.findMany({
              where: and(
                eq(timetablePeriods.schoolId, schoolId),
                eq(timetablePeriods.dayOfWeek, dayOfWeek),
                eq(timetablePeriods.teacherId, userId),
                eq(timetablePeriods.isActive, true),
              ),
            })
          : [];

      let hasOverlap = false;
      let hasLater = false;
      let overlapReason = "";

      for (const p of dayPeriods) {
        const pStart = timeStringToMinutes(p.startTime);
        const pEnd = timeStringToMinutes(p.endTime);

        if (intervalsOverlap(examStartMin, examEndMin, pStart, pEnd)) {
          hasOverlap = true;
          overlapReason = `Teaching Period ${p.periodNumber} (${p.startTime} - ${p.endTime})`;
          break;
        }
        if (pStart >= examEndMin) {
          hasLater = true;
        }
      }

      if (hasOverlap) {
        results.push({
          userId,
          name: teacherName,
          email: tUser.email,
          status: "CONFLICTED",
          conflictReason: overlapReason,
          periodsToday: dayPeriods.length,
        });
      } else if (hasLater) {
        results.push({
          userId,
          name: teacherName,
          email: tUser.email,
          status: "AVAILABLE_WITH_LATER_PERIODS",
          periodsToday: dayPeriods.length,
        });
      } else {
        results.push({
          userId,
          name: teacherName,
          email: tUser.email,
          status: "FULLY_AVAILABLE",
          periodsToday: dayPeriods.length,
        });
      }
    }

    // Rank: FULLY_AVAILABLE (0) < AVAILABLE_WITH_LATER_PERIODS (1) < CONFLICTED (2)
    const rank = {
      FULLY_AVAILABLE: 0,
      AVAILABLE_WITH_LATER_PERIODS: 1,
      CONFLICTED: 2,
    };

    return results.sort((a, b) => rank[a.status] - rank[b.status]);
  });
}
