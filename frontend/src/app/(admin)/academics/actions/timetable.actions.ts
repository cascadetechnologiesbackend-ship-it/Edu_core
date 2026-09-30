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
  id?: string;
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
  subjectId?: string | null;
  teacherId?: string | null;
  roomNumber?: string | null;
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
        eq(timetablePeriods.isActive, true),
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
