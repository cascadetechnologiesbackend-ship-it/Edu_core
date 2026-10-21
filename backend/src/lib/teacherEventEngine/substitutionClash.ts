import {
  timetableSubstitutions,
  timetablePeriods,
  sections,
  subjects,
} from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";

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
  endB: number
): boolean {
  return startA < endB && startB < endA;
}

export function getDayOfWeekEnum(
  d: Date
): "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" {
  const day = d.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  switch (day) {
    case 1:
      return "MONDAY";
    case 2:
      return "TUESDAY";
    case 3:
      return "WEDNESDAY";
    case 4:
      return "THURSDAY";
    case 5:
      return "FRIDAY";
    case 6:
      return "SATURDAY";
    default:
      return "MONDAY";
  }
}

/**
 * Checks schedule clash for a substitute teacher on a target substitution (AC-T8).
 */
export async function checkSubstitutionClash(
  substitutionId: string,
  substituteTeacherId: string,
  tx: any,
  schoolId: string
): Promise<{ hasConflict: boolean; conflictReason?: string }> {
  const sub = await tx.query.timetableSubstitutions.findFirst({
    where: and(
      eq(timetableSubstitutions.schoolId, schoolId),
      eq(timetableSubstitutions.id, substitutionId)
    ),
    with: {
      timetablePeriod: {
        with: {
          subject: true,
          section: { with: { class: true } },
        },
      },
    },
  });

  if (!sub || !sub.timetablePeriod) {
    return { hasConflict: false };
  }

  const subPeriod = sub.timetablePeriod;
  const subDate = new Date(`${sub.date}T12:00:00Z`);
  const dayOfWeek = getDayOfWeekEnum(subDate);

  const subStart = timeStringToMinutes(subPeriod.startTime);
  const subEnd = timeStringToMinutes(subPeriod.endTime);

  // 1. Check if the substitute teacher has their own scheduled period on that day & time
  const teacherPeriods = await tx.query.timetablePeriods.findMany({
    where: and(
      eq(timetablePeriods.schoolId, schoolId),
      eq(timetablePeriods.teacherId, substituteTeacherId),
      eq(timetablePeriods.dayOfWeek, dayOfWeek),
      eq(timetablePeriods.isActive, true)
    ),
    with: {
      subject: true,
      section: { with: { class: true } },
    },
  });

  for (const p of teacherPeriods) {
    // Check if this period was covered away
    const coveredAway = await tx.query.timetableSubstitutions.findFirst({
      where: and(
        eq(timetableSubstitutions.schoolId, schoolId),
        eq(timetableSubstitutions.date, sub.date),
        eq(timetableSubstitutions.timetablePeriodId, p.id),
        eq(timetableSubstitutions.status, "CONFIRMED")
      ),
    });

    if (!coveredAway) {
      const pStart = timeStringToMinutes(p.startTime);
      const pEnd = timeStringToMinutes(p.endTime);
      if (
        p.periodNumber === subPeriod.periodNumber ||
        intervalsOverlap(subStart, subEnd, pStart, pEnd)
      ) {
        const clsName =
          p.section?.class?.displayName || p.section?.class?.name || "Class";
        const secName = p.section?.name || "";
        const subjName = p.subject?.name || "Subject";
        return {
          hasConflict: true,
          conflictReason: `Clashes with your scheduled ${clsName}-${secName} ${subjName} (Period ${p.periodNumber})`,
        };
      }
    }
  }

  // 2. Check if the substitute teacher already has another confirmed cover at this time
  const otherConfirmed = await tx.query.timetableSubstitutions.findMany({
    where: and(
      eq(timetableSubstitutions.schoolId, schoolId),
      eq(timetableSubstitutions.date, sub.date),
      eq(timetableSubstitutions.substituteTeacherId, substituteTeacherId),
      eq(timetableSubstitutions.status, "CONFIRMED"),
      ne(timetableSubstitutions.id, substitutionId)
    ),
    with: {
      timetablePeriod: {
        with: {
          subject: true,
          section: { with: { class: true } },
        },
      },
    },
  });

  for (const oc of otherConfirmed) {
    const ocPeriod = oc.timetablePeriod;
    if (ocPeriod) {
      const ocStart = timeStringToMinutes(ocPeriod.startTime);
      const ocEnd = timeStringToMinutes(ocPeriod.endTime);
      if (
        ocPeriod.periodNumber === subPeriod.periodNumber ||
        intervalsOverlap(subStart, subEnd, ocStart, ocEnd)
      ) {
        const clsName =
          ocPeriod.section?.class?.displayName ||
          ocPeriod.section?.class?.name ||
          "Class";
        return {
          hasConflict: true,
          conflictReason: `Clashes with another confirmed cover for ${clsName} (Period ${ocPeriod.periodNumber})`,
        };
      }
    }
  }

  return { hasConflict: false };
}
