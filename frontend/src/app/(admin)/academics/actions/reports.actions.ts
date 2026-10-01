"use server";

import { db } from "@/db";
import {
  classes,
  sections,
  classSubjects,
  timetablePeriods,
  assignments,
  assignmentSubmissions,
  lessonPlans,
  syllabusUnits,
  syllabusChapters,
  syllabusTopics,
  assessments,
  users,
} from "@/db/schema";
import { eq, and, asc, desc, isNull, inArray, count, countDistinct, avg } from "drizzle-orm";
import {
  checkAuth,
  getActiveAcademicYear,
  calculateSyllabusProgress,
} from "./auth-helper";

// ─── 1. Class Syllabus Progress Report ────────────────────────────────────────

export async function getClassSyllabusProgress(classId: string) {
  const session = await checkAuth();

  const cls = await db.query.classes.findFirst({
    where: and(
      eq(classes.id, classId),
      eq(classes.schoolId, session.user.schoolId),
    ),
    with: {
      classSubjects: {
        with: {
          subject: { columns: { id: true, name: true, code: true } },
          teacher: { columns: { id: true, email: true } },
        },
      },
    },
  });
  if (!cls) throw new Error("Class not found");

  const subjects = await Promise.all(
    cls.classSubjects.map(async (cs) => {
      // Find all topics under this classSubject
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

      const totalTopics = topicIds.length;
      let coveredTopics = 0;

      if (totalTopics > 0) {
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
        coveredTopics = Number(completedPlans[0]?.c ?? 0);
      } else {
        // Fallback: raw lesson plan counts if no topics defined yet
        const [totalP, doneP] = await Promise.all([
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
        const tp = Number(totalP[0]?.c ?? 0);
        const dp = Number(doneP[0]?.c ?? 0);
        return {
          classSubjectId: cs.id,
          subjectName: cs.subject.name,
          subjectCode: cs.subject.code,
          teacherEmail: cs.teacher?.email ?? null,
          totalTopics: tp,
          coveredTopics: dp,
          percentage: calculateSyllabusProgress(tp, dp),
        };
      }

      return {
        classSubjectId: cs.id,
        subjectName: cs.subject.name,
        subjectCode: cs.subject.code,
        teacherEmail: cs.teacher?.email ?? null,
        totalTopics,
        coveredTopics,
        percentage: calculateSyllabusProgress(totalTopics, coveredTopics),
      };
    }),
  );

  return {
    classId: cls.id,
    className: cls.displayName,
    gradeLevel: cls.gradeLevel,
    subjects,
  };
}

// ─── 2. Subject Syllabus Progress Report ──────────────────────────────────────

export async function getSubjectSyllabusProgress(classSubjectId: string) {
  const session = await checkAuth();

  const cs = await db.query.classSubjects.findFirst({
    where: and(
      eq(classSubjects.id, classSubjectId),
      eq(classSubjects.schoolId, session.user.schoolId),
    ),
    with: {
      subject: true,
      class: true,
      teacher: { columns: { id: true, email: true } },
    },
  });
  if (!cs) throw new Error("Class subject not found");

  const units = await db.query.syllabusUnits.findMany({
    where: and(
      eq(syllabusUnits.classSubjectId, classSubjectId),
      eq(syllabusUnits.isActive, true),
      isNull(syllabusUnits.deletedAt),
    ),
    with: {
      term: { columns: { id: true, name: true } },
      chapters: {
        where: and(
          eq(syllabusChapters.isActive, true),
          isNull(syllabusChapters.deletedAt),
        ),
        orderBy: [asc(syllabusChapters.sortOrder)],
        with: {
          topics: {
            where: and(
              eq(syllabusTopics.isActive, true),
              isNull(syllabusTopics.deletedAt),
            ),
            orderBy: [asc(syllabusTopics.sortOrder)],
          },
        },
      },
    },
    orderBy: [asc(syllabusUnits.sortOrder)],
  });

  // Fetch all completed lesson plans for this classSubject
  const completedPlans = await db.query.lessonPlans.findMany({
    where: and(
      eq(lessonPlans.classSubjectId, classSubjectId),
      eq(lessonPlans.status, "COMPLETED"),
    ),
    columns: {
      id: true,
      syllabusTopicId: true,
      completedDate: true,
      title: true,
    },
  });

  const completedTopicMap = new Map<string, { completedDate: Date | null; title: string }>();
  for (const cp of completedPlans) {
    if (cp.syllabusTopicId) {
      completedTopicMap.set(cp.syllabusTopicId, {
        completedDate: cp.completedDate,
        title: cp.title,
      });
    }
  }

  let totalTopics = 0;
  let completedTopics = 0;

  const unitHierarchy = units.map((u) => {
    let unitTotal = 0;
    let unitCompleted = 0;

    const chapters = u.chapters.map((ch) => {
      let chapterTotal = 0;
      let chapterCompleted = 0;

      const topics = ch.topics.map((tp) => {
        totalTopics++;
        unitTotal++;
        chapterTotal++;

        const completion = completedTopicMap.get(tp.id);
        const isCompleted = Boolean(completion);
        if (isCompleted) {
          completedTopics++;
          unitCompleted++;
          chapterCompleted++;
        }

        return {
          id: tp.id,
          name: tp.name,
          estimatedPeriods: tp.estimatedPeriods,
          sortOrder: tp.sortOrder,
          isCompleted,
          completedDate: completion?.completedDate?.toISOString() ?? null,
        };
      });

      return {
        id: ch.id,
        name: ch.name,
        ncertReference: ch.ncertReference,
        sortOrder: ch.sortOrder,
        totalTopics: chapterTotal,
        completedTopics: chapterCompleted,
        topics,
      };
    });

    return {
      id: u.id,
      name: u.name,
      termName: u.term?.name ?? null,
      sortOrder: u.sortOrder,
      totalTopics: unitTotal,
      completedTopics: unitCompleted,
      chapters,
    };
  });

  return {
    classSubjectId: cs.id,
    subjectName: cs.subject.name,
    subjectCode: cs.subject.code,
    className: cs.class.displayName,
    teacherEmail: cs.teacher?.email ?? null,
    totalUnits: units.length,
    totalChapters: units.reduce((acc, u) => acc + u.chapters.length, 0),
    totalTopics,
    completedTopics,
    percentage: calculateSyllabusProgress(totalTopics, completedTopics),
    units: unitHierarchy,
  };
}

// ─── 3. Teacher Workload Report ───────────────────────────────────────────────

export async function getTeacherWorkloadReport() {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const activeYear = await getActiveAcademicYear(session.user.schoolId);

  const allMappings = await db.query.classSubjects.findMany({
    where: eq(classSubjects.schoolId, session.user.schoolId),
    with: {
      teacher: { columns: { id: true, email: true } },
      class: { columns: { displayName: true } },
      subject: { columns: { name: true } },
    },
  });

  // Group by assigned teacher
  const teacherMap = new Map<
    string,
    {
      teacherId: string;
      email: string;
      totalPeriodsPerWeek: number;
      subjectCount: number;
      classSubjectIds: string[];
    }
  >();

  for (const m of allMappings) {
    if (!m.assignedTeacherId || !m.teacher) continue;
    const existing = teacherMap.get(m.assignedTeacherId);
    if (existing) {
      existing.totalPeriodsPerWeek += m.periodsPerWeek;
      existing.subjectCount += 1;
      existing.classSubjectIds.push(m.id);
    } else {
      teacherMap.set(m.assignedTeacherId, {
        teacherId: m.assignedTeacherId,
        email: m.teacher.email,
        totalPeriodsPerWeek: m.periodsPerWeek,
        subjectCount: 1,
        classSubjectIds: [m.id],
      });
    }
  }

  // Also query actual scheduled periods count per teacher from timetable_periods
  const scheduledPeriods = await db.query.timetablePeriods.findMany({
    where: and(
      eq(timetablePeriods.schoolId, session.user.schoolId),
      eq(timetablePeriods.academicYearId, activeYear.id),
      eq(timetablePeriods.isActive, true),
    ),
    columns: { teacherId: true },
  });

  const timetableCountMap = new Map<string, number>();
  for (const tp of scheduledPeriods) {
    if (tp.teacherId) {
      timetableCountMap.set(
        tp.teacherId,
        (timetableCountMap.get(tp.teacherId) ?? 0) + 1,
      );
      if (!teacherMap.has(tp.teacherId)) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, tp.teacherId),
          columns: { email: true },
        });
        if (user) {
          teacherMap.set(tp.teacherId, {
            teacherId: tp.teacherId,
            email: user.email,
            totalPeriodsPerWeek: 0,
            subjectCount: 0,
            classSubjectIds: [],
          });
        }
      }
    }
  }

  return await Promise.all(
    [...teacherMap.values()].map(async (t) => {
      const [assignmentCount, lessonPlanCount] = await Promise.all([
        db
          .select({ c: count() })
          .from(assignments)
          .where(
            and(
              eq(assignments.schoolId, session.user.schoolId),
              eq(assignments.createdByTeacherId, t.teacherId),
            ),
          ),
        db
          .select({ c: count() })
          .from(lessonPlans)
          .where(
            and(
              eq(lessonPlans.schoolId, session.user.schoolId),
              eq(lessonPlans.teacherId, t.teacherId),
            ),
          ),
      ]);

      return {
        teacherId: t.teacherId,
        email: t.email,
        totalPeriodsPerWeek: t.totalPeriodsPerWeek,
        scheduledTimetablePeriods: timetableCountMap.get(t.teacherId) ?? 0,
        subjectCount: t.subjectCount,
        assignmentCount: Number(assignmentCount[0]?.c ?? 0),
        lessonPlanCount: Number(lessonPlanCount[0]?.c ?? 0),
      };
    }),
  );
}

// ─── 4. Assignment Completion Report ──────────────────────────────────────────

export async function getAssignmentCompletionReport(sectionId: string) {
  const session = await checkAuth();

  const sec = await db.query.sections.findFirst({
    where: and(
      eq(sections.id, sectionId),
      eq(sections.schoolId, session.user.schoolId),
    ),
    with: {
      class: { columns: { displayName: true } },
    },
  });
  if (!sec) throw new Error("Section not found");

  const sectionAssignments = await db.query.assignments.findMany({
    where: and(
      eq(assignments.schoolId, session.user.schoolId),
      eq(assignments.sectionId, sectionId),
    ),
    with: {
      classSubject: {
        with: {
          subject: { columns: { name: true, code: true } },
        },
      },
    },
    orderBy: [desc(assignments.dueDate)],
  });

  const assignmentDetails = await Promise.all(
    sectionAssignments.map(async (a) => {
      const submissions = await db.query.assignmentSubmissions.findMany({
        where: eq(assignmentSubmissions.assignmentId, a.id),
        columns: {
          id: true,
          marksAwarded: true,
        },
      });

      const totalSubmissions = submissions.length;
      const graded = submissions.filter((s) => s.marksAwarded !== null);
      const gradedCount = graded.length;

      let avgMarks = null;
      if (gradedCount > 0) {
        const sumMarks = graded.reduce(
          (sum, s) => sum + (s.marksAwarded ?? 0),
          0,
        );
        avgMarks = Math.round((sumMarks / gradedCount) * 10) / 10;
      }

      return {
        id: a.id,
        title: a.title,
        subjectName: a.classSubject.subject.name,
        subjectCode: a.classSubject.subject.code,
        maxMarks: a.maxMarks,
        dueDate: a.dueDate.toISOString().split("T")[0]!,
        status: a.status,
        totalSubmissions,
        gradedSubmissions: gradedCount,
        pendingGrading: totalSubmissions - gradedCount,
        averageMarks: avgMarks,
      };
    }),
  );

  return {
    sectionId: sec.id,
    sectionName: sec.name,
    className: sec.class.displayName,
    totalAssignments: sectionAssignments.length,
    assignments: assignmentDetails,
  };
}

// ─── 5. Academic Activity Report ──────────────────────────────────────────────

export async function getAcademicActivityReport(classId: string) {
  const session = await checkAuth();

  const cls = await db.query.classes.findFirst({
    where: and(
      eq(classes.id, classId),
      eq(classes.schoolId, session.user.schoolId),
    ),
    with: {
      sections: { where: eq(sections.isActive, true) },
      classSubjects: {
        with: { subject: { columns: { name: true } } },
      },
    },
  });
  if (!cls) throw new Error("Class not found");

  const csIds = cls.classSubjects.map((cs) => cs.id);
  const secIds = cls.sections.map((s) => s.id);

  let lessonPlansCount = 0;
  let assignmentsCount = 0;
  let assessmentsCount = 0;

  if (csIds.length > 0) {
    const [lp, asg, asm] = await Promise.all([
      db
        .select({ c: count() })
        .from(lessonPlans)
        .where(
          and(
            eq(lessonPlans.schoolId, session.user.schoolId),
            inArray(lessonPlans.classSubjectId, csIds),
          ),
        ),
      db
        .select({ c: count() })
        .from(assignments)
        .where(
          and(
            eq(assignments.schoolId, session.user.schoolId),
            inArray(assignments.classSubjectId, csIds),
          ),
        ),
      db
        .select({ c: count() })
        .from(assessments)
        .where(
          and(
            eq(assessments.schoolId, session.user.schoolId),
            inArray(assessments.classSubjectId, csIds),
            isNull(assessments.deletedAt),
          ),
        ),
    ]);

    lessonPlansCount = Number(lp[0]?.c ?? 0);
    assignmentsCount = Number(asg[0]?.c ?? 0);
    assessmentsCount = Number(asm[0]?.c ?? 0);
  }

  // Recent 10 activities (latest lesson plans and assignments)
  const recentPlans = csIds.length > 0
    ? await db.query.lessonPlans.findMany({
        where: inArray(lessonPlans.classSubjectId, csIds),
        orderBy: [desc(lessonPlans.createdAt)],
        limit: 5,
        with: {
          teacher: { columns: { email: true } },
          classSubject: { with: { subject: { columns: { name: true } } } },
        },
      })
    : [];

  const recentAssignments = csIds.length > 0
    ? await db.query.assignments.findMany({
        where: inArray(assignments.classSubjectId, csIds),
        orderBy: [desc(assignments.createdAt)],
        limit: 5,
        with: {
          classSubject: { with: { subject: { columns: { name: true } } } },
          section: { columns: { name: true } },
        },
      })
    : [];

  const activities = [
    ...recentPlans.map((p) => ({
      type: "LESSON_PLAN" as const,
      id: p.id,
      title: p.title,
      subjectName: p.classSubject.subject.name,
      teacher: p.teacher.email,
      status: p.status,
      date: p.createdAt.toISOString(),
    })),
    ...recentAssignments.map((a) => ({
      type: "ASSIGNMENT" as const,
      id: a.id,
      title: a.title,
      subjectName: a.classSubject.subject.name,
      sectionName: a.section.name,
      status: a.status,
      date: a.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    classId: cls.id,
    className: cls.displayName,
    gradeLevel: cls.gradeLevel,
    stats: {
      totalSections: cls.sections.length,
      totalSubjects: cls.classSubjects.length,
      lessonPlansCount,
      assignmentsCount,
      assessmentsCount,
    },
    activities,
  };
}

// ─── 6. Multi-Class Summary Report (Backward Compatibility) ───────────────────

export async function getClassSyllabusProgressReport() {
  const session = await checkAuth();
  const activeYear = await getActiveAcademicYear(session.user.schoolId);

  const allClasses = await db.query.classes.findMany({
    where: and(
      eq(classes.schoolId, session.user.schoolId),
      eq(classes.academicYearId, activeYear.id),
      eq(classes.isActive, true),
    ),
    orderBy: [asc(classes.sortOrder)],
  });

  return await Promise.all(
    allClasses.map(async (cls) => {
      const progress = await getClassSyllabusProgress(cls.id);
      return {
        classId: cls.id,
        className: cls.displayName,
        subjectProgress: progress.subjects.map((s) => ({
          classSubjectId: s.classSubjectId,
          subjectName: s.subjectName,
          total: s.totalTopics,
          completed: s.coveredTopics,
          percentage: s.percentage,
        })),
      };
    }),
  );
}
