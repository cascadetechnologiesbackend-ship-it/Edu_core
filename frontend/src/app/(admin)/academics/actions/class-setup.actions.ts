"use server";

import { db, withTenant } from "@/db";
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
}): Promise<{ success: boolean; classId?: string; error?: string }> {
  try {
    const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
    const activeYear = await getActiveAcademicYear(session.user.schoolId);

    return await withTenant(session.user.schoolId, async (tx) => {
      // Pre-check for duplicate gradeLevel in the same school and academic year
      const existingClass = await tx.query.classes.findFirst({
        where: and(
          eq(classes.schoolId, session.user.schoolId),
          eq(classes.academicYearId, activeYear.id),
          eq(classes.gradeLevel, data.gradeLevel as any),
        ),
      });

      if (existingClass) {
        throw new Error(
          `A class for grade "${data.displayName || data.gradeLevel}" already exists in this academic year.`,
        );
      }

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
      if (data.sections && data.sections.length > 0) {
        await tx.insert(sections).values(
          data.sections.map((s) => ({
            schoolId: session.user.schoolId,
            classId: newClass.id,
            name: s.name.trim(),
            capacity: s.capacity ?? 40,
            classTeacherId: s.classTeacherId ? s.classTeacherId : null,
            roomNumber: s.roomNumber ? s.roomNumber.trim() : null,
          })),
        );
      }

      // 3. Attach subjects to class
      if (data.subjectIds && data.subjectIds.length > 0) {
        const validSubjectIds = data.subjectIds.filter(
          (id) => typeof id === "string" && !id.startsWith("temp-") && id.trim().length > 0,
        );
        if (validSubjectIds.length > 0) {
          await tx.insert(classSubjects).values(
            validSubjectIds.map((subjectId) => ({
              schoolId: session.user.schoolId,
              classId: newClass.id,
              subjectId,
            })),
          );
        }
      }

      try {
        revalidatePath("/academics");
      } catch {}
      return { success: true, classId: newClass.id };
    });
  } catch (err: any) {
    console.error("[createClassSetup] Error:", err);
    return { success: false, error: err?.message || "Failed to create class setup" };
  }
}

// ─── 2. Class Hub Queries ─────────────────────────────────────────────────────

export async function getClassWithDetails(classId: string) {
  const session = await checkAuth();

  return await withTenant(session.user.schoolId, async (tx) => {
    return await tx.query.classes.findFirst({
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
  });
}

export async function getClassHubOverview(classId: string) {
  const session = await checkAuth();

  return await withTenant(session.user.schoolId, async (tx) => {
    const cls = await tx.query.classes.findFirst({
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
        tx
          .select({ c: count() })
          .from(lessonPlans)
          .where(
            and(
              eq(lessonPlans.schoolId, session.user.schoolId),
              inArray(lessonPlans.classSubjectId, csIds),
              eq(lessonPlans.status, "PLANNED"),
            ),
          ),
        tx
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
        const units = await tx.query.syllabusUnits.findMany({
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
          const completedPlans = await tx
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
            tx
              .select({ c: count() })
              .from(lessonPlans)
              .where(eq(lessonPlans.classSubjectId, cs.id)),
            tx
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
  });
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
  await withTenant(session.user.schoolId, async (tx) => {
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
        .where(
          and(
            eq(sectionSubjectTeachers.id, currentActive.id),
            eq(sectionSubjectTeachers.schoolId, session.user.schoolId),
          ),
        );
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

  return await withTenant(session.user.schoolId, async (tx) => {
    // 1. Fetch class with sections and class subjects
    const cls = await tx.query.classes.findFirst({
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
    const [enrolledInClass] = await tx
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
      const [enrolledInSections] = await tx
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
    const [linkedFees] = await tx
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
    const [linkedExams] = await tx
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
      const [attendanceCount] = await tx
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
    // Delete in-progress or historical report card jobs if any
    // Delete in-progress or historical report card jobs if any
    await tx
      .delete(reportCardJobs)
      .where(
        and(
          eq(reportCardJobs.classId, classId),
          eq(reportCardJobs.schoolId, session.user.schoolId),
        ),
      );

    // Delete student class history entries for this class or its sections
    if (sectionIds.length > 0) {
      await tx
        .delete(studentClassHistory)
        .where(
          and(
            inArray(studentClassHistory.sectionId, sectionIds),
            eq(studentClassHistory.schoolId, session.user.schoolId),
          ),
        );
    }
    await tx
      .delete(studentClassHistory)
      .where(
        and(
          eq(studentClassHistory.classId, classId),
          eq(studentClassHistory.schoolId, session.user.schoolId),
        ),
      );

    // A. Section-level dependencies
    if (sectionIds.length > 0) {
      await tx
        .delete(timetableSubstitutions)
        .where(
          and(
            inArray(timetableSubstitutions.sectionId, sectionIds),
            eq(timetableSubstitutions.schoolId, session.user.schoolId),
          ),
        );

      await tx
        .delete(timetablePeriods)
        .where(
          and(
            inArray(timetablePeriods.sectionId, sectionIds),
            eq(timetablePeriods.schoolId, session.user.schoolId),
          ),
        );

      await tx
        .delete(sectionSubjectTeachers)
        .where(
          and(
            inArray(sectionSubjectTeachers.sectionId, sectionIds),
            eq(sectionSubjectTeachers.schoolId, session.user.schoolId),
          ),
        );
    }

    // B. ClassSubject-level dependencies
    if (classSubjectIds.length > 0) {
      await tx
        .delete(sectionSubjectTeachers)
        .where(
          and(
            inArray(sectionSubjectTeachers.classSubjectId, classSubjectIds),
            eq(sectionSubjectTeachers.schoolId, session.user.schoolId),
          ),
        );

      await tx
        .delete(assessments)
        .where(
          and(
            inArray(assessments.classSubjectId, classSubjectIds),
            eq(assessments.schoolId, session.user.schoolId),
          ),
        );

      const classAssignments = await tx.query.assignments.findMany({
        where: and(
          inArray(assignments.classSubjectId, classSubjectIds),
          eq(assignments.schoolId, session.user.schoolId),
        ),
        columns: { id: true },
      });
      const assignmentIds = classAssignments.map((a) => a.id);
      if (assignmentIds.length > 0) {
        await tx
          .delete(assignmentSubmissions)
          .where(
            and(
              inArray(assignmentSubmissions.assignmentId, assignmentIds),
              eq(assignmentSubmissions.schoolId, session.user.schoolId),
            ),
          );

        await tx
          .delete(assignments)
          .where(
            and(
              inArray(assignments.id, assignmentIds),
              eq(assignments.schoolId, session.user.schoolId),
            ),
          );
      }

      await tx
        .delete(lessonPlans)
        .where(
          and(
            inArray(lessonPlans.classSubjectId, classSubjectIds),
            eq(lessonPlans.schoolId, session.user.schoolId),
          ),
        );

      const units = await tx.query.syllabusUnits.findMany({
        where: and(
          inArray(syllabusUnits.classSubjectId, classSubjectIds),
          eq(syllabusUnits.schoolId, session.user.schoolId),
        ),
        columns: { id: true },
      });
      const unitIds = units.map((u) => u.id);
      if (unitIds.length > 0) {
        const chapters = await tx.query.syllabusChapters.findMany({
          where: and(
            inArray(syllabusChapters.unitId, unitIds),
            eq(syllabusChapters.schoolId, session.user.schoolId),
          ),
          columns: { id: true },
        });
        const chapterIds = chapters.map((c) => c.id);
        if (chapterIds.length > 0) {
          await tx
            .delete(syllabusTopics)
            .where(
              and(
                inArray(syllabusTopics.chapterId, chapterIds),
                eq(syllabusTopics.schoolId, session.user.schoolId),
              ),
            );

          await tx
            .delete(syllabusChapters)
            .where(
              and(
                inArray(syllabusChapters.id, chapterIds),
                eq(syllabusChapters.schoolId, session.user.schoolId),
              ),
            );
        }
        await tx
          .delete(syllabusUnits)
          .where(
            and(
              inArray(syllabusUnits.id, unitIds),
              eq(syllabusUnits.schoolId, session.user.schoolId),
            ),
          );
      }

      await tx
        .delete(classSubjects)
        .where(
          and(
            inArray(classSubjects.id, classSubjectIds),
            eq(classSubjects.schoolId, session.user.schoolId),
          ),
        );
    }

    // C. Delete sections
    if (sectionIds.length > 0) {
      await tx
        .delete(sections)
        .where(
          and(
            inArray(sections.id, sectionIds),
            eq(sections.schoolId, session.user.schoolId),
          ),
        );
    }

    // D. Delete the class itself
    await tx
      .delete(classes)
      .where(and(eq(classes.id, classId), eq(classes.schoolId, session.user.schoolId)));

    try {
      revalidatePath("/academics");
    } catch {}
    return { success: true as const, message: `Class "${cls.displayName}" was deleted successfully.` };
  });
}
