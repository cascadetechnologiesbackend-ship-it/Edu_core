"use server";

import { db } from "@/db";
import {
  classes,
  sections,
  classSubjects,
  sectionSubjectTeachers,
  lessonPlans,
  assignments,
  assignmentSubmissions,
  syllabusUnits,
  syllabusChapters,
  syllabusTopics,
  timetablePeriods,
  timetableSubstitutions,
  assessments,
  students,
  studentClassHistory,
  studentAttendance,
  feeStructures,
  examSchedules,
  reportCardJobs,
} from "@/db/schema";
import { eq, and, desc, isNull, inArray, count, countDistinct } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  checkAuth,
  getActiveAcademicYear,
  calculateSyllabusProgress,
} from "./auth-helper";

// ─── 1. Class Setup Transaction (Rule #7) ─────────────────────────────────────
// Separate from saveClassroom(). Atomically creates class + sections + attaches subjects.

export async function createClassSetup(data: {
  gradeLevel: string;
  displayName: string;
  sortOrder: number;
  sections: {
    name: string;
    capacity: number;
    classTeacherId?: string | null;
    roomNumber?: string | null;
  }[];
  subjectIds: string[];
}): Promise<{ success: true; classId: string }> {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const activeYear = await getActiveAcademicYear(session.user.schoolId);

  return await db.transaction(async (tx) => {
    // 1. Create class
    const [newClass] = await tx
      .insert(classes)
      .values({
        schoolId: session.user.schoolId,
        academicYearId: activeYear.id,
        gradeLevel: data.gradeLevel as any,
        displayName: data.displayName,
        sortOrder: data.sortOrder,
      })
      .returning({ id: classes.id });

    if (!newClass) throw new Error("Failed to create classroom");

    // 2. Create sections
    if (data.sections.length > 0) {
      await tx.insert(sections).values(
        data.sections.map((s) => ({
          schoolId: session.user.schoolId,
          classId: newClass.id,
          name: s.name,
          capacity: s.capacity ?? 40,
          classTeacherId: s.classTeacherId || null,
          roomNumber: s.roomNumber || null,
        })),
      );
    }

    // 3. Attach subjects to class
    if (data.subjectIds.length > 0) {
      await tx.insert(classSubjects).values(
        data.subjectIds.map((subjectId) => ({
          schoolId: session.user.schoolId,
          classId: newClass.id,
          subjectId,
        })),
      );
    }

    revalidatePath("/academics");
    return { success: true as const, classId: newClass.id };
  });
}

// ─── 2. Class Hub Queries ─────────────────────────────────────────────────────

export async function getClassWithDetails(classId: string) {
  const session = await checkAuth();

  return await db.query.classes.findFirst({
    where: and(
      eq(classes.id, classId),
      eq(classes.schoolId, session.user.schoolId),
      eq(classes.isActive, true),
    ),
    with: {
      sections: {
        where: eq(sections.isActive, true),
        with: {
          classTeacher: {
            columns: { id: true, email: true },
          },
        },
      },
      classSubjects: {
        with: {
          subject: true,
          teacher: {
            columns: { id: true, email: true },
          },
        },
      },
    },
  });
}

export async function getClassHubOverview(classId: string) {
  const session = await checkAuth();

  const cls = await db.query.classes.findFirst({
    where: and(
      eq(classes.id, classId),
      eq(classes.schoolId, session.user.schoolId),
    ),
    with: {
      sections: {
        where: eq(sections.isActive, true),
        with: {
          classTeacher: { columns: { id: true, email: true } },
        },
      },
      classSubjects: {
        with: {
          subject: true,
          teacher: { columns: { id: true, email: true } },
        },
      },
    },
  });

  if (!cls) return null;

  const csIds = cls.classSubjects.map((cs: any) => cs.id);
  let pendingLessonPlansCount = 0;
  let pendingAssignmentsCount = 0;

  if (csIds.length > 0) {
    const [lp, asg] = await Promise.all([
      db
        .select({ c: count() })
        .from(lessonPlans)
        .where(
          and(
            eq(lessonPlans.schoolId, session.user.schoolId),
            inArray(lessonPlans.classSubjectId, csIds),
            eq(lessonPlans.status, "PLANNED"),
          ),
        ),
      db
        .select({ c: count() })
        .from(assignments)
        .where(
          and(
            eq(assignments.schoolId, session.user.schoolId),
            inArray(assignments.classSubjectId, csIds),
            eq(assignments.status, "PUBLISHED"),
          ),
        ),
    ]);
    pendingLessonPlansCount = Number(lp[0]?.c ?? 0);
    pendingAssignmentsCount = Number(asg[0]?.c ?? 0);
  }

  // Calculate syllabus progress for each subject in this class
  const subjectProgress = await Promise.all(
    cls.classSubjects.map(async (cs: any) => {
      // Find all syllabus topic IDs for this classSubject
      const units = await db.query.syllabusUnits.findMany({
        where: and(
          eq(syllabusUnits.classSubjectId, cs.id),
          eq(syllabusUnits.isActive, true),
          isNull(syllabusUnits.deletedAt),
        ),
        with: {
          chapters: {
            where: and(
              eq(syllabusChapters.isActive, true),
              isNull(syllabusChapters.deletedAt),
            ),
            with: {
              topics: {
                where: and(
                  eq(syllabusTopics.isActive, true),
                  isNull(syllabusTopics.deletedAt),
                ),
                columns: { id: true },
              },
            },
          },
        },
      });

      const topicIds = units.flatMap((u) =>
        u.chapters.flatMap((c) => c.topics.map((t) => t.id)),
      );

      const total = topicIds.length;
      let completed = 0;

      if (total > 0) {
        const completedPlans = await db
          .select({ c: countDistinct(lessonPlans.syllabusTopicId) })
          .from(lessonPlans)
          .where(
            and(
              eq(lessonPlans.classSubjectId, cs.id),
              eq(lessonPlans.status, "COMPLETED"),
              inArray(lessonPlans.syllabusTopicId, topicIds),
            ),
          );
        completed = Number(completedPlans[0]?.c ?? 0);
      } else {
        // Fallback to general lesson plan count if no syllabus topics defined
        const [allPlans, donePlans] = await Promise.all([
          db
            .select({ c: count() })
            .from(lessonPlans)
            .where(eq(lessonPlans.classSubjectId, cs.id)),
          db
            .select({ c: count() })
            .from(lessonPlans)
            .where(
              and(
                eq(lessonPlans.classSubjectId, cs.id),
                eq(lessonPlans.status, "COMPLETED"),
              ),
            ),
        ]);
        const fallbackTotal = Number(allPlans[0]?.c ?? 0);
        const fallbackDone = Number(donePlans[0]?.c ?? 0);
        return {
          classSubjectId: cs.id,
          subjectName: cs.subject.name,
          total: fallbackTotal,
          completed: fallbackDone,
          percentage: calculateSyllabusProgress(fallbackTotal, fallbackDone),
        };
      }

      return {
        classSubjectId: cs.id,
        subjectName: cs.subject.name,
        total,
        completed,
        percentage: calculateSyllabusProgress(total, completed),
      };
    }),
  );

  const totalTopicsAll = subjectProgress.reduce((sum, s) => sum + s.total, 0);
  const totalCompletedAll = subjectProgress.reduce((sum, s) => sum + s.completed, 0);
  const overallProgress = calculateSyllabusProgress(totalTopicsAll, totalCompletedAll);

  return {
    class: cls,
    sectionCount: cls.sections.length,
    subjectCount: cls.classSubjects.length,
    pendingLessonPlansCount,
    pendingAssignmentsCount,
    overallProgress,
    subjectProgress,
  };
}

// ─── 3. Section Teacher Allocation (Rules #10, #14) ───────────────────────────
// Preserves historical records with effectiveFrom/effectiveTo.
// Transactionally closes active allocation before inserting new allocation.

export async function getSectionSubjectTeachers(classSubjectId: string) {
  const session = await checkAuth();

  return await db.query.sectionSubjectTeachers.findMany({
    where: and(
      eq(sectionSubjectTeachers.classSubjectId, classSubjectId),
      eq(sectionSubjectTeachers.schoolId, session.user.schoolId),
    ),
    with: {
      teacher: { columns: { id: true, email: true } },
      section: { columns: { id: true, name: true } },
    },
    orderBy: [desc(sectionSubjectTeachers.effectiveFrom)],
  });
}

export async function assignSectionTeacher(data: {
  classSubjectId: string;
  sectionId: string;
  teacherId: string;
  effectiveFrom: string; // "YYYY-MM-DD"
}) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);

  // Verify classSubject belongs to this school
  const cs = await db.query.classSubjects.findFirst({
    where: and(
      eq(classSubjects.id, data.classSubjectId),
      eq(classSubjects.schoolId, session.user.schoolId),
    ),
  });
  if (!cs) throw new Error("Invalid class subject specified");

  // Verify section belongs to this school
  const sec = await db.query.sections.findFirst({
    where: and(
      eq(sections.id, data.sectionId),
      eq(sections.schoolId, session.user.schoolId),
    ),
  });
  if (!sec) throw new Error("Invalid section specified");

  // Transactionally close active allocation and insert new allocation
  await db.transaction(async (tx) => {
    // Check current active allocation for temporal integrity
    const currentActive = await tx.query.sectionSubjectTeachers.findFirst({
      where: and(
        eq(sectionSubjectTeachers.classSubjectId, data.classSubjectId),
        eq(sectionSubjectTeachers.sectionId, data.sectionId),
        isNull(sectionSubjectTeachers.effectiveTo),
      ),
    });

    if (currentActive && data.effectiveFrom <= currentActive.effectiveFrom) {
      throw new Error(
        `Invalid assignment date: new effective date (${data.effectiveFrom}) must be strictly after the current active assignment start date (${currentActive.effectiveFrom}).`,
      );
    }

    // 1. Close current active allocation (setting effectiveTo and isActive = false)
    if (currentActive) {
      await tx
        .update(sectionSubjectTeachers)
        .set({
          effectiveTo: data.effectiveFrom,
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(sectionSubjectTeachers.id, currentActive.id));
    }

    // 2. Insert new active allocation (effectiveTo = null, isActive = true)
    await tx.insert(sectionSubjectTeachers).values({
      schoolId: session.user.schoolId,
      classSubjectId: data.classSubjectId,
      sectionId: data.sectionId,
      teacherId: data.teacherId,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: null,
      isActive: true,
    });
  });

  try {
    revalidatePath("/academics");
  } catch {}
  return { success: true };
}

// ─── 4. Delete Class Action ──────────────────────────────────────────────────

export async function deleteClass(classId: string): Promise<{ success: true; message: string }> {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);

  // 1. Fetch class with sections and class subjects
  const cls = await db.query.classes.findFirst({
    where: and(
      eq(classes.id, classId),
      eq(classes.schoolId, session.user.schoolId),
    ),
    with: {
      sections: true,
      classSubjects: true,
    },
  });

  if (!cls) {
    throw new Error("Class not found or does not belong to your school.");
  }

  const sectionIds = cls.sections.map((s) => s.id);

  // 2. Safeguard check: enrolled students in class or its sections
  const [enrolledInClass] = await db
    .select({ count: count() })
    .from(students)
    .where(
      and(
        eq(students.schoolId, session.user.schoolId),
        eq(students.currentClassId, classId),
      ),
    );

  if (enrolledInClass && Number(enrolledInClass.count) > 0) {
    throw new Error(
      `Cannot delete "${cls.displayName}": ${enrolledInClass.count} active student(s) are currently enrolled in this class. Please reassign or graduate students first.`,
    );
  }

  if (sectionIds.length > 0) {
    const [enrolledInSections] = await db
      .select({ count: count() })
      .from(students)
      .where(
        and(
          eq(students.schoolId, session.user.schoolId),
          inArray(students.currentSectionId, sectionIds),
        ),
      );

    if (enrolledInSections && Number(enrolledInSections.count) > 0) {
      throw new Error(
        `Cannot delete "${cls.displayName}": ${enrolledInSections.count} active student(s) are currently enrolled in sections of this class. Please reassign students first.`,
      );
    }
  }

  // 4. Safeguard check: fee structures
  const [linkedFees] = await db
    .select({ count: count() })
    .from(feeStructures)
    .where(
      and(
        eq(feeStructures.schoolId, session.user.schoolId),
        eq(feeStructures.classId, classId),
        eq(feeStructures.isActive, true),
      ),
    );

  if (linkedFees && Number(linkedFees.count) > 0) {
    throw new Error(
      `Cannot delete "${cls.displayName}": Active fee structures are associated with this class. Please remove or update fee structures first.`,
    );
  }

  // 5. Safeguard check: exam schedules
  const [linkedExams] = await db
    .select({ count: count() })
    .from(examSchedules)
    .where(
      and(
        eq(examSchedules.schoolId, session.user.schoolId),
        eq(examSchedules.classId, classId),
      ),
    );

  if (linkedExams && Number(linkedExams.count) > 0) {
    throw new Error(
      `Cannot delete "${cls.displayName}": Examination schedules are linked to this class. Please delete or reassign exam schedules first.`,
    );
  }

  // 6. Safeguard check: student attendance
  if (sectionIds.length > 0) {
    const [attendanceCount] = await db
      .select({ count: count() })
      .from(studentAttendance)
      .where(
        and(
          eq(studentAttendance.schoolId, session.user.schoolId),
          inArray(studentAttendance.sectionId, sectionIds),
        ),
      );

    if (attendanceCount && Number(attendanceCount.count) > 0) {
      throw new Error(
        `Cannot delete "${cls.displayName}": Attendance records exist for sections in this class.`,
      );
    }
  }

  const classSubjectIds = cls.classSubjects.map((cs) => cs.id);

  // 7. Atomic cascade cleanup
  await db.transaction(async (tx) => {
    // Delete in-progress or historical report card jobs if any
    await tx.delete(reportCardJobs).where(eq(reportCardJobs.classId, classId));

    // Delete student class history entries for this class or its sections
    if (sectionIds.length > 0) {
      await tx
        .delete(studentClassHistory)
        .where(inArray(studentClassHistory.sectionId, sectionIds));
    }
    await tx
      .delete(studentClassHistory)
      .where(eq(studentClassHistory.classId, classId));

    // A. Section-level dependencies
    if (sectionIds.length > 0) {
      await tx
        .delete(timetableSubstitutions)
        .where(inArray(timetableSubstitutions.sectionId, sectionIds));

      await tx
        .delete(timetablePeriods)
        .where(inArray(timetablePeriods.sectionId, sectionIds));

      await tx
        .delete(sectionSubjectTeachers)
        .where(inArray(sectionSubjectTeachers.sectionId, sectionIds));
    }

    // B. ClassSubject-level dependencies
    if (classSubjectIds.length > 0) {
      await tx
        .delete(sectionSubjectTeachers)
        .where(inArray(sectionSubjectTeachers.classSubjectId, classSubjectIds));

      await tx
        .delete(assessments)
        .where(inArray(assessments.classSubjectId, classSubjectIds));

      const classAssignments = await tx.query.assignments.findMany({
        where: inArray(assignments.classSubjectId, classSubjectIds),
        columns: { id: true },
      });
      const assignmentIds = classAssignments.map((a) => a.id);
      if (assignmentIds.length > 0) {
        await tx
          .delete(assignmentSubmissions)
          .where(inArray(assignmentSubmissions.assignmentId, assignmentIds));

        await tx
          .delete(assignments)
          .where(inArray(assignments.id, assignmentIds));
      }

      await tx
        .delete(lessonPlans)
        .where(inArray(lessonPlans.classSubjectId, classSubjectIds));

      const units = await tx.query.syllabusUnits.findMany({
        where: inArray(syllabusUnits.classSubjectId, classSubjectIds),
        columns: { id: true },
      });
      const unitIds = units.map((u) => u.id);
      if (unitIds.length > 0) {
        const chapters = await tx.query.syllabusChapters.findMany({
          where: inArray(syllabusChapters.unitId, unitIds),
          columns: { id: true },
        });
        const chapterIds = chapters.map((c) => c.id);
        if (chapterIds.length > 0) {
          await tx
            .delete(syllabusTopics)
            .where(inArray(syllabusTopics.chapterId, chapterIds));

          await tx
            .delete(syllabusChapters)
            .where(inArray(syllabusChapters.id, chapterIds));
        }
        await tx
          .delete(syllabusUnits)
          .where(inArray(syllabusUnits.id, unitIds));
      }

      await tx
        .delete(classSubjects)
        .where(inArray(classSubjects.id, classSubjectIds));
    }

    // C. Delete sections
    if (sectionIds.length > 0) {
      await tx
        .delete(sections)
        .where(inArray(sections.id, sectionIds));
    }

    // D. Delete the class itself
    await tx
      .delete(classes)
      .where(and(eq(classes.id, classId), eq(classes.schoolId, session.user.schoolId)));
  });

  revalidatePath("/academics");
  return { success: true as const, message: `Class "${cls.displayName}" was deleted successfully.` };
}
