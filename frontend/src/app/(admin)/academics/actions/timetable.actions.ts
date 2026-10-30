"use server";

import { db } from "@/db";
import {
  bellSchedule,
  timetablePeriods,
  timetableSubstitutions,
  sections,
  classSubjects,
  sectionSubjectTeachers,
  academicYears,
  academicCalendarEvents,
} from "@/db/schema";
import { eq, and, ne, asc, desc, isNull, lte, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { checkAuth, getActiveAcademicYear } from "./auth-helper";
import {
  validateWorkloadFit,
  generateDeterministicSchedule,
  checkScheduleClashes,
  type SubjectWorkloadInput,
  type ScheduleSlot,
  type WorkloadFitResult,
  type TimetableClash,
} from "@/lib/timetableEngine";

// ─── 1. Bell Schedule Actions (Rule #2) ──────────────────────────────────────

export async function getBellSchedule() {
  const session = await checkAuth();
  return await db.query.bellSchedule.findMany({
    where: and(
      eq(bellSchedule.schoolId, session.user.schoolId),
      eq(bellSchedule.isActive, true),
    ),
    orderBy: [asc(bellSchedule.periodNumber)],
  });
}

export async function saveBellSchedulePeriod(data: {
  id?: string;
  periodNumber: number;
  name: string;
  startTime: string; // "HH:MM"
  endTime: string;
  periodType:
    | "REGULAR"
    | "ASSEMBLY"
    | "BREAK"
    | "LUNCH"
    | "LAB"
    | "PT"
    | "LIBRARY"
    | "FREE";
}) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);

  if (data.id) {
    await db
      .update(bellSchedule)
      .set({
        periodNumber: data.periodNumber,
        name: data.name,
        startTime: data.startTime,
        endTime: data.endTime,
        periodType: data.periodType,
      })
      .where(
        and(
          eq(bellSchedule.id, data.id),
          eq(bellSchedule.schoolId, session.user.schoolId),
        ),
      );
  } else {
    await db.insert(bellSchedule).values({
      schoolId: session.user.schoolId,
      periodNumber: data.periodNumber,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      periodType: data.periodType,
    });
  }

  try {
    revalidatePath("/academics");
  } catch {}
  return { success: true };
}

export async function deleteBellSchedulePeriod(id: string) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);

  await db
    .update(bellSchedule)
    .set({ isActive: false })
    .where(
      and(
        eq(bellSchedule.id, id),
        eq(bellSchedule.schoolId, session.user.schoolId),
      ),
    );

  try {
    revalidatePath("/academics");
  } catch {}
  return { success: true };
}

export async function getSectionTimetable(sectionId: string) {
  const session = await checkAuth();
  return await db.query.timetablePeriods.findMany({
    where: and(
      eq(timetablePeriods.schoolId, session.user.schoolId),
      eq(timetablePeriods.sectionId, sectionId),
      eq(timetablePeriods.isActive, true),
    ),
    with: {
      subject: true,
      teacher: { columns: { id: true, email: true } },
    },
  });
}

// ─── 2. Enhanced Timetable Conflict Enforcement (Rules #2, #4) ────────────────

export async function saveTimetablePeriod(data: {
  id?: string | undefined;
  sectionId: string;
  dayOfWeek:
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY";
  periodNumber: number;
  startTime: string;
  endTime: string;
  periodType:
    | "REGULAR"
    | "ASSEMBLY"
    | "BREAK"
    | "LUNCH"
    | "LAB"
    | "PT"
    | "LIBRARY"
    | "FREE";
  subjectId?: string | null | undefined;
  teacherId?: string | null | undefined;
  roomNumber?: string | null | undefined;
  isManualOverride?: boolean | undefined;
}) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const activeYear = await getActiveAcademicYear(session.user.schoolId);

  const subjectIdVal = data.subjectId || null;
  const teacherIdVal = data.teacherId || null;
  const roomNumberVal = data.roomNumber ? data.roomNumber.trim() : null;

  // Resolve existing slot if id is not passed to ensure seamless upsert and accurate exclusion
  let effectiveId = data.id || null;
  if (!effectiveId) {
    const existingSlot = await db.query.timetablePeriods.findFirst({
      where: and(
        eq(timetablePeriods.schoolId, session.user.schoolId),
        eq(timetablePeriods.academicYearId, activeYear.id),
        eq(timetablePeriods.sectionId, data.sectionId),
        eq(timetablePeriods.dayOfWeek, data.dayOfWeek),
        eq(timetablePeriods.periodNumber, data.periodNumber),
      ),
    });
    if (existingSlot) {
      effectiveId = existingSlot.id;
    }
  }

  // ── Step 1: Teacher double-booking check ──────────────────────────────────
  if (teacherIdVal) {
    const teacherConflict = await db.query.timetablePeriods.findFirst({
      where: and(
        eq(timetablePeriods.schoolId, session.user.schoolId),
        eq(timetablePeriods.academicYearId, activeYear.id),
        eq(timetablePeriods.dayOfWeek, data.dayOfWeek),
        eq(timetablePeriods.periodNumber, data.periodNumber),
        eq(timetablePeriods.teacherId, teacherIdVal),
        eq(timetablePeriods.isActive, true),
        effectiveId ? ne(timetablePeriods.id, effectiveId) : undefined,
      ),
    });
    if (teacherConflict) {
      throw new Error(
        `Conflict: Teacher is already booked for Period ${data.periodNumber} on ${data.dayOfWeek}.`,
      );
    }
  }

  // ── Step 2: Room conflict check ──────────────────────────────────────────
  if (roomNumberVal) {
    const roomConflict = await db.query.timetablePeriods.findFirst({
      where: and(
        eq(timetablePeriods.schoolId, session.user.schoolId),
        eq(timetablePeriods.academicYearId, activeYear.id),
        eq(timetablePeriods.dayOfWeek, data.dayOfWeek),
        eq(timetablePeriods.periodNumber, data.periodNumber),
        eq(timetablePeriods.roomNumber, roomNumberVal),
        eq(timetablePeriods.isActive, true),
        effectiveId ? ne(timetablePeriods.id, effectiveId) : undefined,
      ),
    });
    if (roomConflict) {
      throw new Error(
        `Conflict: Room ${roomNumberVal} is already booked for Period ${data.periodNumber} on ${data.dayOfWeek}.`,
      );
    }
  }

  // ── Step 3: Verify subject belongs to the section's class ────────────────
  const section = await db.query.sections.findFirst({
    where: and(
      eq(sections.id, data.sectionId),
      eq(sections.schoolId, session.user.schoolId),
    ),
  });
  if (!section) {
    throw new Error("Invalid section specified");
  }

  let classSubject = null;
  if (subjectIdVal) {
    classSubject = await db.query.classSubjects.findFirst({
      where: and(
        eq(classSubjects.schoolId, session.user.schoolId),
        eq(classSubjects.classId, section.classId),
        eq(classSubjects.subjectId, subjectIdVal),
      ),
    });
    if (!classSubject) {
      throw new Error("Conflict: Selected subject is not mapped to this classroom.");
    }
  }

  // ── Step 4: Verify teacher is authorized for classSubject + section ──────
  if (teacherIdVal && subjectIdVal && classSubject) {
    const activeSectionAlloc = await db.query.sectionSubjectTeachers.findFirst({
      where: and(
        eq(sectionSubjectTeachers.schoolId, session.user.schoolId),
        eq(sectionSubjectTeachers.classSubjectId, classSubject.id),
        eq(sectionSubjectTeachers.sectionId, data.sectionId),
        eq(sectionSubjectTeachers.isActive, true),
        isNull(sectionSubjectTeachers.effectiveTo),
      ),
    });

    let isAuthorized = false;
    if (activeSectionAlloc) {
      // Section-specific teacher allocation takes absolute precedence
      isAuthorized = activeSectionAlloc.teacherId === teacherIdVal;
    } else {
      // Class-level fallback applies only when no section allocation exists
      isAuthorized = classSubject.assignedTeacherId === teacherIdVal;
    }

    if (!isAuthorized) {
      throw new Error(
        "Conflict: Teacher is not assigned or authorized to teach this subject in this section.",
      );
    }
  }

  // ── Step 5: Persist timetable entry ──────────────────────────────────────
  if (effectiveId) {
    await db
      .update(timetablePeriods)
      .set({
        startTime: data.startTime,
        endTime: data.endTime,
        periodType: data.periodType,
        subjectId: subjectIdVal,
        teacherId: teacherIdVal,
        roomNumber: roomNumberVal,
        ...(data.isManualOverride !== undefined
          ? { isManualOverride: data.isManualOverride }
          : {}),
        isActive: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(timetablePeriods.id, effectiveId),
          eq(timetablePeriods.schoolId, session.user.schoolId),
        ),
      );
  } else {
    await db.insert(timetablePeriods).values({
      schoolId: session.user.schoolId,
      academicYearId: activeYear.id,
      sectionId: data.sectionId,
      dayOfWeek: data.dayOfWeek,
      periodNumber: data.periodNumber,
      startTime: data.startTime,
      endTime: data.endTime,
      periodType: data.periodType,
      subjectId: subjectIdVal,
      teacherId: teacherIdVal,
      roomNumber: roomNumberVal,
      isManualOverride: data.isManualOverride ?? false,
    });
  }

  try {
    revalidatePath("/academics");
  } catch {}
  return { success: true };
}

// ─── 3. Timetable Substitution Actions (Rule #3) ──────────────────────────────

export async function getSubstitutionsForDate(date: string, sectionId?: string) {
  const session = await checkAuth();

  return await db.query.timetableSubstitutions.findMany({
    where: and(
      eq(timetableSubstitutions.schoolId, session.user.schoolId),
      eq(timetableSubstitutions.date, date),
      sectionId ? eq(timetableSubstitutions.sectionId, sectionId) : undefined,
    ),
    with: {
      originalTeacher: { columns: { id: true, email: true } },
      substituteTeacher: { columns: { id: true, email: true } },
      subject: { columns: { id: true, name: true, code: true } },
      section: {
        columns: { id: true, name: true },
        with: { class: { columns: { id: true, displayName: true } } },
      },
      timetablePeriod: {
        columns: {
          id: true,
          periodNumber: true,
          startTime: true,
          endTime: true,
          dayOfWeek: true,
        },
      },
    },
    orderBy: [desc(timetableSubstitutions.createdAt)],
  });
}

export async function createSubstitution(data: {
  date: string; // "YYYY-MM-DD"
  timetablePeriodId: string;
  sectionId: string;
  originalTeacherId: string;
  substituteTeacherId?: string | null;
  subjectId?: string | null;
  reason?: string | null;
}) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"]);
  const activeYear = await getActiveAcademicYear(session.user.schoolId);

  // Validate timetable period exists and belongs to school
  const period = await db.query.timetablePeriods.findFirst({
    where: and(
      eq(timetablePeriods.id, data.timetablePeriodId),
      eq(timetablePeriods.schoolId, session.user.schoolId),
    ),
  });
  if (!period) throw new Error("Invalid timetable period");

  // Conflict Check 1: Disallow self-substitution
  if (data.substituteTeacherId && data.substituteTeacherId === data.originalTeacherId) {
    throw new Error("Conflict: Cannot assign the original teacher as their own substitute.");
  }

  // Conflict Check 2: Check academic calendar for holiday or non-working day
  const calendarConflict = await db.query.academicCalendarEvents.findFirst({
    where: and(
      eq(academicCalendarEvents.schoolId, session.user.schoolId),
      eq(academicCalendarEvents.academicYearId, activeYear.id),
      eq(academicCalendarEvents.isActive, true),
      eq(academicCalendarEvents.isWorkingDay, false),
      lte(academicCalendarEvents.startDate, data.date),
      gte(academicCalendarEvents.endDate, data.date),
    ),
  });
  if (calendarConflict) {
    throw new Error(
      `Conflict: Cannot schedule substitution on a non-working day or holiday (${calendarConflict.title}).`,
    );
  }

  // If substitute teacher provided, check double-booking
  if (data.substituteTeacherId) {
    // Conflict Check 3: Check regular timetable double-booking for the substitute teacher
    const subTimetableConflict = await db.query.timetablePeriods.findFirst({
      where: and(
        eq(timetablePeriods.schoolId, session.user.schoolId),
        eq(timetablePeriods.academicYearId, activeYear.id),
        eq(timetablePeriods.dayOfWeek, period.dayOfWeek),
        eq(timetablePeriods.periodNumber, period.periodNumber),
        eq(timetablePeriods.teacherId, data.substituteTeacherId),
        eq(timetablePeriods.isActive, true),
      ),
    });
    if (subTimetableConflict) {
      throw new Error(
        `Conflict: Substitute teacher is already booked for Period ${period.periodNumber} on ${period.dayOfWeek}.`,
      );
    }

    // Conflict Check 4: Check concurrent confirmed substitutions
    const subConcurrentConflict = await db.query.timetableSubstitutions.findFirst({
      where: and(
        eq(timetableSubstitutions.schoolId, session.user.schoolId),
        eq(timetableSubstitutions.academicYearId, activeYear.id),
        eq(timetableSubstitutions.date, data.date),
        eq(timetableSubstitutions.substituteTeacherId, data.substituteTeacherId),
        eq(timetableSubstitutions.status, "CONFIRMED"),
      ),
      with: {
        timetablePeriod: true,
      },
    });
    if (
      subConcurrentConflict &&
      subConcurrentConflict.timetablePeriod?.periodNumber === period.periodNumber
    ) {
      throw new Error(
        `Conflict: Substitute teacher is already assigned to another confirmed substitution for Period ${period.periodNumber} on ${data.date}.`,
      );
    }
  }

  await db.insert(timetableSubstitutions).values({
    schoolId: session.user.schoolId,
    academicYearId: activeYear.id,
    date: data.date,
    timetablePeriodId: data.timetablePeriodId,
    sectionId: data.sectionId,
    originalTeacherId: data.originalTeacherId,
    substituteTeacherId: data.substituteTeacherId || null,
    subjectId: data.subjectId || null,
    reason: data.reason || null,
    status: data.substituteTeacherId ? "CONFIRMED" : "PENDING",
  });

  try {
    revalidatePath("/academics");
  } catch {}
  return { success: true };
}

export async function updateSubstitutionStatus(
  id: string,
  status: "PENDING" | "CONFIRMED" | "CANCELLED",
  substituteTeacherId?: string,
) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"]);
  const activeYear = await getActiveAcademicYear(session.user.schoolId);

  const sub = await db.query.timetableSubstitutions.findFirst({
    where: and(
      eq(timetableSubstitutions.id, id),
      eq(timetableSubstitutions.schoolId, session.user.schoolId),
    ),
    with: {
      timetablePeriod: true,
    },
  });
  if (!sub) {
    throw new Error("Substitution record not found");
  }

  const effectiveSubTeacherId =
    substituteTeacherId !== undefined ? substituteTeacherId : sub.substituteTeacherId;

  if (status === "CONFIRMED") {
    if (!effectiveSubTeacherId) {
      throw new Error("Cannot confirm substitution without assigning a substitute teacher.");
    }
    if (effectiveSubTeacherId === sub.originalTeacherId) {
      throw new Error("Conflict: Cannot assign the original teacher as their own substitute.");
    }

    // Check calendar holiday / non-working day
    const calendarConflict = await db.query.academicCalendarEvents.findFirst({
      where: and(
        eq(academicCalendarEvents.schoolId, session.user.schoolId),
        eq(academicCalendarEvents.academicYearId, activeYear.id),
        eq(academicCalendarEvents.isActive, true),
        eq(academicCalendarEvents.isWorkingDay, false),
        lte(academicCalendarEvents.startDate, sub.date),
        gte(academicCalendarEvents.endDate, sub.date),
      ),
    });
    if (calendarConflict) {
      throw new Error(
        `Conflict: Cannot schedule substitution on a non-working day or holiday (${calendarConflict.title}).`,
      );
    }

    if (sub.timetablePeriod) {
      // Conflict Check: Substitute teacher double-booking in regular timetable
      const subTimetableConflict = await db.query.timetablePeriods.findFirst({
        where: and(
          eq(timetablePeriods.schoolId, session.user.schoolId),
          eq(timetablePeriods.academicYearId, activeYear.id),
          eq(timetablePeriods.dayOfWeek, sub.timetablePeriod.dayOfWeek),
          eq(timetablePeriods.periodNumber, sub.timetablePeriod.periodNumber),
          eq(timetablePeriods.teacherId, effectiveSubTeacherId),
          eq(timetablePeriods.isActive, true),
        ),
      });
      if (subTimetableConflict) {
        throw new Error(
          `Conflict: Substitute teacher is already booked for Period ${sub.timetablePeriod.periodNumber} on ${sub.timetablePeriod.dayOfWeek}.`,
        );
      }

      // Conflict Check: Concurrent confirmed substitutions
      const concurrentSub = await db.query.timetableSubstitutions.findFirst({
        where: and(
          eq(timetableSubstitutions.schoolId, session.user.schoolId),
          eq(timetableSubstitutions.academicYearId, activeYear.id),
          eq(timetableSubstitutions.date, sub.date),
          eq(timetableSubstitutions.substituteTeacherId, effectiveSubTeacherId),
          eq(timetableSubstitutions.status, "CONFIRMED"),
          ne(timetableSubstitutions.id, id),
        ),
        with: {
          timetablePeriod: true,
        },
      });
      if (
        concurrentSub &&
        concurrentSub.timetablePeriod?.periodNumber === sub.timetablePeriod.periodNumber
      ) {
        throw new Error(
          `Conflict: Substitute teacher is already assigned to another confirmed substitution for Period ${sub.timetablePeriod.periodNumber} on ${sub.date}.`,
        );
      }
    }
  }

  await db
    .update(timetableSubstitutions)
    .set({
      status,
      ...(effectiveSubTeacherId !== undefined ? { substituteTeacherId: effectiveSubTeacherId || null } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(timetableSubstitutions.id, id),
        eq(timetableSubstitutions.schoolId, session.user.schoolId),
      ),
    );

  try {
    revalidatePath("/academics");
  } catch {}
  return { success: true };
}

export async function getPendingSubstitutions() {
  const session = await checkAuth();
  const today = new Date().toISOString().split("T")[0]!;

  return await db.query.timetableSubstitutions.findMany({
    where: and(
      eq(timetableSubstitutions.schoolId, session.user.schoolId),
      eq(timetableSubstitutions.status, "PENDING"),
      eq(timetableSubstitutions.date, today),
    ),
    with: {
      originalTeacher: { columns: { id: true, email: true } },
      subject: { columns: { id: true, name: true } },
      section: {
        columns: { id: true, name: true },
        with: { class: { columns: { displayName: true } } },
      },
    },
  });
}

export async function getPendingSubstitutionsCount(): Promise<number> {
  const session = await checkAuth();
  const today = new Date().toISOString().split("T")[0]!;

  const pending = await db.query.timetableSubstitutions.findMany({
    where: and(
      eq(timetableSubstitutions.schoolId, session.user.schoolId),
      eq(timetableSubstitutions.status, "PENDING"),
      eq(timetableSubstitutions.date, today),
    ),
    columns: { id: true },
  });

  return pending.length;
}

export async function deleteTimetablePeriod(id: string) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);

  await db
    .update(timetablePeriods)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(timetablePeriods.id, id),
        eq(timetablePeriods.schoolId, session.user.schoolId),
      ),
    );

  try {
    revalidatePath("/academics");
  } catch {}
  return { success: true };
}

export async function saveTimetableSubstitution(
  ...args: Parameters<typeof createSubstitution>
) {
  return createSubstitution(...args);
}

// ─── 4. QuickTimetable Copy & Clear Tools (Surface 5 Spec) ───────────────────

export async function copyMondayToAllDays(sectionId: string) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const activeYear = await getActiveAcademicYear(session.user.schoolId);

  const mondayPeriods = await db.query.timetablePeriods.findMany({
    where: and(
      eq(timetablePeriods.schoolId, session.user.schoolId),
      eq(timetablePeriods.academicYearId, activeYear.id),
      eq(timetablePeriods.sectionId, sectionId),
      eq(timetablePeriods.dayOfWeek, "MONDAY"),
      eq(timetablePeriods.isActive, true),
    ),
  });

  if (mondayPeriods.length === 0) {
    throw new Error("No Monday periods configured to copy.");
  }

  const targetDays: Array<"TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY"> = [
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ];

  let copiedCount = 0;
  let conflictCount = 0;

  for (const day of targetDays) {
    for (const p of mondayPeriods) {
      // Check for teacher clash on this target day & period
      let hasConflict = false;
      if (p.teacherId) {
        const conflict = await db.query.timetablePeriods.findFirst({
          where: and(
            eq(timetablePeriods.schoolId, session.user.schoolId),
            eq(timetablePeriods.academicYearId, activeYear.id),
            eq(timetablePeriods.dayOfWeek, day),
            eq(timetablePeriods.periodNumber, p.periodNumber),
            eq(timetablePeriods.teacherId, p.teacherId),
            eq(timetablePeriods.isActive, true),
            ne(timetablePeriods.sectionId, sectionId),
          ),
        });
        if (conflict) {
          hasConflict = true;
          conflictCount++;
          continue;
        }
      }

      if (!hasConflict) {
        // Upsert into target day
        const existing = await db.query.timetablePeriods.findFirst({
          where: and(
            eq(timetablePeriods.schoolId, session.user.schoolId),
            eq(timetablePeriods.academicYearId, activeYear.id),
            eq(timetablePeriods.sectionId, sectionId),
            eq(timetablePeriods.dayOfWeek, day),
            eq(timetablePeriods.periodNumber, p.periodNumber),
            eq(timetablePeriods.isActive, true),
          ),
        });

        if (existing) {
          await db
            .update(timetablePeriods)
            .set({
              startTime: p.startTime,
              endTime: p.endTime,
              periodType: p.periodType,
              subjectId: p.subjectId,
              teacherId: p.teacherId,
              roomNumber: p.roomNumber,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(timetablePeriods.id, existing.id),
                eq(timetablePeriods.schoolId, session.user.schoolId)
              )
            );
        } else {
          await db.insert(timetablePeriods).values({
            schoolId: session.user.schoolId,
            academicYearId: activeYear.id,
            sectionId,
            dayOfWeek: day,
            periodNumber: p.periodNumber,
            startTime: p.startTime,
            endTime: p.endTime,
            periodType: p.periodType,
            subjectId: p.subjectId,
            teacherId: p.teacherId,
            roomNumber: p.roomNumber,
          });
        }
        copiedCount++;
      }
    }
  }

  try {
    revalidatePath("/academics");
  } catch {}

  return { success: true, copiedCount, conflictCount };
}

export async function copyTimetableToSection(sourceSectionId: string, targetSectionId: string) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const activeYear = await getActiveAcademicYear(session.user.schoolId);

  if (sourceSectionId === targetSectionId) {
    throw new Error("Source and target sections cannot be the same.");
  }

  const sourcePeriods = await db.query.timetablePeriods.findMany({
    where: and(
      eq(timetablePeriods.schoolId, session.user.schoolId),
      eq(timetablePeriods.academicYearId, activeYear.id),
      eq(timetablePeriods.sectionId, sourceSectionId),
      eq(timetablePeriods.isActive, true),
    ),
  });

  if (sourcePeriods.length === 0) {
    throw new Error("Source section has no timetable periods to copy.");
  }

  let copiedCount = 0;
  let conflictCount = 0;

  for (const p of sourcePeriods) {
    let hasConflict = false;
    if (p.teacherId) {
      const conflict = await db.query.timetablePeriods.findFirst({
        where: and(
          eq(timetablePeriods.schoolId, session.user.schoolId),
          eq(timetablePeriods.academicYearId, activeYear.id),
          eq(timetablePeriods.dayOfWeek, p.dayOfWeek),
          eq(timetablePeriods.periodNumber, p.periodNumber),
          eq(timetablePeriods.teacherId, p.teacherId),
          eq(timetablePeriods.isActive, true),
          ne(timetablePeriods.sectionId, targetSectionId),
        ),
      });
      if (conflict) {
        hasConflict = true;
        conflictCount++;
        continue;
      }
    }

    if (!hasConflict) {
      const existing = await db.query.timetablePeriods.findFirst({
        where: and(
          eq(timetablePeriods.schoolId, session.user.schoolId),
          eq(timetablePeriods.academicYearId, activeYear.id),
          eq(timetablePeriods.sectionId, targetSectionId),
          eq(timetablePeriods.dayOfWeek, p.dayOfWeek),
          eq(timetablePeriods.periodNumber, p.periodNumber),
          eq(timetablePeriods.isActive, true),
        ),
      });

      if (existing) {
        await db
          .update(timetablePeriods)
          .set({
            startTime: p.startTime,
            endTime: p.endTime,
            periodType: p.periodType,
            subjectId: p.subjectId,
            teacherId: p.teacherId,
            roomNumber: p.roomNumber,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(timetablePeriods.id, existing.id),
              eq(timetablePeriods.schoolId, session.user.schoolId)
            )
          );
      } else {
        await db.insert(timetablePeriods).values({
          schoolId: session.user.schoolId,
          academicYearId: activeYear.id,
          sectionId: targetSectionId,
          dayOfWeek: p.dayOfWeek,
          periodNumber: p.periodNumber,
          startTime: p.startTime,
          endTime: p.endTime,
          periodType: p.periodType,
          subjectId: p.subjectId,
          teacherId: p.teacherId,
          roomNumber: p.roomNumber,
        });
      }
      copiedCount++;
    }
  }

  try {
    revalidatePath("/academics");
  } catch {}

  return { success: true, copiedCount, conflictCount };
}

export async function clearSectionTimetable(sectionId: string) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const activeYear = await getActiveAcademicYear(session.user.schoolId);

  await db
    .update(timetablePeriods)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(timetablePeriods.schoolId, session.user.schoolId),
        eq(timetablePeriods.academicYearId, activeYear.id),
        eq(timetablePeriods.sectionId, sectionId),
        eq(timetablePeriods.isActive, true),
      ),
    );

  try {
    revalidatePath("/academics");
  } catch {}

  return { success: true };
}

// ─── 5. Timetable Generator Actions (Sprint S21, F11 & F12) ───────────────────

export interface TimetablePreviewResult {
  fits: boolean;
  fitReport: WorkloadFitResult;
  slots: ScheduleSlot[];
  clashes: TimetableClash[];
  needsAssignmentReport: Array<{
    subjectId: string;
    subjectName: string;
    unassignedCount: number;
    reason?: string;
  }>;
  unassignedPeriodsCount: number;
}

export interface CommitTimetableResult {
  success: boolean;
  upsertedCount: number;
  deactivatedCount: number;
  preservedOverridesCount: number;
}

const DAY_NUMBER_TO_NAME = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

const DAY_NAME_TO_NUMBER: Record<string, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

/**
 * Generates a deterministic preview of the weekly timetable for a given section.
 * Validates workload fit, generates anti-fatigue schedule slots, auto-assigns teachers
 * where unique allocations exist, checks concurrency clashes, and returns a comprehensive report.
 */
export async function generateSectionTimetablePreview(
  sectionId: string,
): Promise<TimetablePreviewResult> {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const activeYear = await getActiveAcademicYear(session.user.schoolId);

  // 1. Verify section belongs to current tenant institution
  const section = await db.query.sections.findFirst({
    where: and(
      eq(sections.id, sectionId),
      eq(sections.schoolId, session.user.schoolId),
      eq(sections.isActive, true),
    ),
    with: {
      class: true,
    },
  });

  if (!section) {
    throw new Error(
      "Invalid section specified: Section does not belong to your institution or is inactive.",
    );
  }

  // 2. Query active bell schedule
  const bellPeriods = await db.query.bellSchedule.findMany({
    where: and(
      eq(bellSchedule.schoolId, session.user.schoolId),
      eq(bellSchedule.isActive, true),
    ),
    orderBy: [asc(bellSchedule.periodNumber)],
  });

  if (bellPeriods.length === 0) {
    throw new Error(
      "No active bell schedule configured for this school. Please configure or top up bell schedule periods first.",
    );
  }

  // Regular instructional periods represent available teaching slots per day
  const regularBellPeriods = bellPeriods.filter(
    (p) => p.periodType === "REGULAR" || p.periodType === "LAB",
  );
  const instructionPeriodsPerDay =
    regularBellPeriods.length > 0 ? regularBellPeriods.length : bellPeriods.length;

  const workingDays = [1, 2, 3, 4, 5, 6]; // Monday through Saturday
  const workingDaysCount = workingDays.length;

  // 3. Query class subjects and workloads
  const classSubjs = await db.query.classSubjects.findMany({
    where: and(
      eq(classSubjects.schoolId, session.user.schoolId),
      eq(classSubjects.classId, section.classId),
    ),
    with: {
      subject: true,
    },
  });

  const subjectsInput: SubjectWorkloadInput[] = classSubjs.map((cs) => ({
    id: cs.id, // Using classSubjectId so teacher allocations map directly
    name: cs.subject?.name || "Subject",
    code: cs.subject?.code,
    weeklyPeriods: cs.periodsPerWeek ?? 5,
    isLabOrPractical:
      cs.subject?.subjectType === "PRACTICAL" ||
      /lab|practical|physics|chemistry|biology|computer/i.test(cs.subject?.name || ""),
  }));

  // 4. Query existing timetable periods for section to identify manual overrides
  const existingPeriods = await db.query.timetablePeriods.findMany({
    where: and(
      eq(timetablePeriods.schoolId, session.user.schoolId),
      eq(timetablePeriods.academicYearId, activeYear.id),
      eq(timetablePeriods.sectionId, sectionId),
      eq(timetablePeriods.isActive, true),
    ),
    with: {
      subject: true,
    },
  });

  const existingSlots: ScheduleSlot[] = existingPeriods
    .filter((p) => (p as any).isManualOverride === true)
    .map((p) => {
      const matchingCs = classSubjs.find(
        (cs) => cs.subjectId === p.subjectId || cs.id === p.subjectId,
      );
      return {
        dayOfWeek: DAY_NAME_TO_NUMBER[p.dayOfWeek] || 1,
        periodNumber: p.periodNumber,
        subjectId: matchingCs ? matchingCs.id : (p.subjectId || ""),
        subjectName: p.subject?.name || matchingCs?.subject?.name || "Subject",
        teacherId: p.teacherId || undefined,
        roomId: p.roomNumber || undefined,
        isManualOverride: true,
      };
    });

  // 5. Run mathematical workload feasibility fit
  const fitReport = validateWorkloadFit({
    workingDaysCount,
    instructionPeriodsPerDay,
    subjects: subjectsInput,
  });

  // 6. Generate deterministic provisional schedule
  const scheduleResult = generateDeterministicSchedule({
    workingDays,
    instructionPeriodsPerDay,
    subjects: subjectsInput,
    existingSlots,
  });

  // 7. Auto-assign teachers from sectionSubjectTeachers
  const allocations = await db.query.sectionSubjectTeachers.findMany({
    where: and(
      eq(sectionSubjectTeachers.schoolId, session.user.schoolId),
      eq(sectionSubjectTeachers.sectionId, sectionId),
      eq(sectionSubjectTeachers.isActive, true),
      isNull(sectionSubjectTeachers.effectiveTo),
    ),
  });

  const allocMap = new Map<string, typeof allocations>();
  for (const alloc of allocations) {
    const list = allocMap.get(alloc.classSubjectId) || [];
    list.push(alloc);
    allocMap.set(alloc.classSubjectId, list);
  }

  for (const slot of scheduleResult.slots) {
    if (slot.isManualOverride && slot.teacherId) {
      continue;
    }

    const activeAllocations = allocMap.get(slot.subjectId) || [];
    if (activeAllocations.length === 1) {
      slot.teacherId = activeAllocations[0]!.teacherId;
    } else {
      slot.teacherId = undefined; // Unassigned if 0 or ambiguous multiple allocations
    }
  }

  // 8. Generate needsAssignmentReport
  const needsAssignmentMap = new Map<
    string,
    { subjectId: string; subjectName: string; unassignedCount: number; reason?: string }
  >();

  for (const slot of scheduleResult.slots) {
    if (!slot.teacherId) {
      const activeAllocations = allocMap.get(slot.subjectId) || [];
      const reason =
        activeAllocations.length === 0
          ? "NO_ALLOCATION"
          : "AMBIGUOUS_MULTIPLE_ALLOCATIONS";

      const entry = needsAssignmentMap.get(slot.subjectId) || {
        subjectId: slot.subjectId,
        subjectName: slot.subjectName,
        unassignedCount: 0,
        reason,
      };
      entry.unassignedCount++;
      needsAssignmentMap.set(slot.subjectId, entry);
    }
  }

  const needsAssignmentReport = Array.from(needsAssignmentMap.values());

  // 9. Concurrency clash detection against other sections
  const otherPeriods = await db.query.timetablePeriods.findMany({
    where: and(
      eq(timetablePeriods.schoolId, session.user.schoolId),
      eq(timetablePeriods.academicYearId, activeYear.id),
      ne(timetablePeriods.sectionId, sectionId),
      eq(timetablePeriods.isActive, true),
    ),
  });

  const clashCandidates = [
    ...scheduleResult.slots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      periodNumber: s.periodNumber,
      classId: sectionId,
      teacherId: s.teacherId || null,
      roomId: s.roomId || null,
    })),
    ...otherPeriods.map((p) => ({
      dayOfWeek: DAY_NAME_TO_NUMBER[p.dayOfWeek] || 1,
      periodNumber: p.periodNumber,
      classId: p.sectionId,
      teacherId: p.teacherId || null,
      roomId: p.roomNumber || null,
    })),
  ];

  const allClashes = checkScheduleClashes(clashCandidates);
  const clashes = allClashes.filter((c) =>
    scheduleResult.slots.some(
      (s) => s.dayOfWeek === c.dayOfWeek && s.periodNumber === c.periodNumber,
    ),
  );

  return {
    fits: fitReport.fits,
    fitReport,
    slots: scheduleResult.slots,
    clashes,
    needsAssignmentReport,
    unassignedPeriodsCount: scheduleResult.unassignedPeriodsCount,
  };
}

/**
 * Commits a generated timetable to the database.
 * Routes every slot through saveTimetablePeriod to enforce double-booking and room overlap checks.
 * Preserves manual override slots, upserts generated slots, and deactivates orphaned non-manual periods.
 */
export async function commitSectionTimetable(
  sectionId: string,
  slots: ScheduleSlot[],
): Promise<CommitTimetableResult> {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const activeYear = await getActiveAcademicYear(session.user.schoolId);

  // 1. Verify section belongs to current tenant
  const section = await db.query.sections.findFirst({
    where: and(
      eq(sections.id, sectionId),
      eq(sections.schoolId, session.user.schoolId),
      eq(sections.isActive, true),
    ),
  });

  if (!section) {
    throw new Error(
      "Invalid section specified: Section does not belong to your institution.",
    );
  }

  // 2. Query bell schedule to resolve slot start/end timings
  const bellPeriods = await db.query.bellSchedule.findMany({
    where: and(
      eq(bellSchedule.schoolId, session.user.schoolId),
      eq(bellSchedule.isActive, true),
    ),
    orderBy: [asc(bellSchedule.periodNumber)],
  });

  const bellMap = new Map<number, (typeof bellPeriods)[0]>();
  for (const bp of bellPeriods) {
    bellMap.set(bp.periodNumber, bp);
  }

  // 3. Query classSubjects to resolve classSubjectId -> subjectId foreign key
  const classSubjs = await db.query.classSubjects.findMany({
    where: and(
      eq(classSubjects.schoolId, session.user.schoolId),
      eq(classSubjects.classId, section.classId),
    ),
  });

  const classSubjMap = new Map<string, string>();
  for (const cs of classSubjs) {
    classSubjMap.set(cs.id, cs.subjectId);
    classSubjMap.set(cs.subjectId, cs.subjectId);
  }

  // 4. Query existing periods for this section (including inactive to prevent unique constraint crashes)
  const existingPeriods = await db.query.timetablePeriods.findMany({
    where: and(
      eq(timetablePeriods.schoolId, session.user.schoolId),
      eq(timetablePeriods.academicYearId, activeYear.id),
      eq(timetablePeriods.sectionId, sectionId),
    ),
  });

  const existingMap = new Map<string, (typeof existingPeriods)[0]>();
  for (const ep of existingPeriods) {
    const key = `${ep.dayOfWeek}-${ep.periodNumber}`;
    existingMap.set(key, ep);
  }

  let upsertedCount = 0;
  let preservedOverridesCount = 0;
  const processedKeys = new Set<string>();

  // 5. Persist slots exclusively through saveTimetablePeriod
  for (const slot of slots) {
    const dayOfWeek = DAY_NUMBER_TO_NAME[slot.dayOfWeek - 1];
    if (!dayOfWeek) continue;

    const key = `${dayOfWeek}-${slot.periodNumber}`;
    processedKeys.add(key);

    const existingSlot = existingMap.get(key);

    // Invariant: If existing slot is manual override and incoming is non-manual, preserve manual override!
    if (
      existingSlot &&
      existingSlot.isActive &&
      (existingSlot as any).isManualOverride === true &&
      !slot.isManualOverride
    ) {
      preservedOverridesCount++;
      continue;
    }

    const bell = bellMap.get(slot.periodNumber);
    const startTime = bell?.startTime || "08:30";
    const endTime = bell?.endTime || "09:15";
    const periodType = (bell?.periodType || "REGULAR") as any;

    const resolvedSubjectId = slot.subjectId
      ? classSubjMap.get(slot.subjectId) || slot.subjectId
      : null;

    await saveTimetablePeriod({
      ...(existingSlot ? { id: existingSlot.id } : {}),
      sectionId,
      dayOfWeek,
      periodNumber: slot.periodNumber,
      startTime,
      endTime,
      periodType,
      subjectId: resolvedSubjectId,
      teacherId: slot.teacherId || null,
      roomNumber: slot.roomId || null,
      isManualOverride: slot.isManualOverride ?? false,
    });

    upsertedCount++;
  }

  // 6. Deactivate orphaned non-manual periods not present in new slots
  let deactivatedCount = 0;
  for (const ep of existingPeriods) {
    if (!ep.isActive) continue; // Already inactive

    const key = `${ep.dayOfWeek}-${ep.periodNumber}`;
    if (!processedKeys.has(key)) {
      if ((ep as any).isManualOverride === true) {
        preservedOverridesCount++;
        continue; // Never deactivate manual overrides
      }

      await db
        .update(timetablePeriods)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(timetablePeriods.id, ep.id),
            eq(timetablePeriods.schoolId, session.user.schoolId),
          ),
        );

      deactivatedCount++;
    }
  }

  try {
    revalidatePath("/academics");
  } catch {}

  return {
    success: true,
    upsertedCount,
    deactivatedCount,
    preservedOverridesCount,
  };
}
