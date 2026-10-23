"use server";

import { getCachedSession } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import {
  classSubjects,
  studentSubjectEnrollments,
  syllabusUnits,
  syllabusChapters,
  syllabusTopics,
  lessonPlans,
} from "@/db/schema";
import { eq, and, asc, isNull, inArray } from "drizzle-orm";
import { resolveStudentScope } from "@/lib/studentEventEngine/scopeResolver";
import {
  deriveTopicSyllabusStatus,
  calculateSyllabusProgress,
  type SyllabusTopicStatus,
  type SyllabusProgressSummary,
} from "../../../../lib/studentEventEngine/syllabusDerivation";

export interface EnrolledSubjectOption {
  id: string; // classSubjectId
  name: string;
  code: string | null;
  isElective: boolean;
}

export interface StudentSyllabusTopic {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  estimatedPeriods: number | null;
  status: SyllabusTopicStatus;
}

export interface StudentSyllabusChapter {
  id: string;
  name: string;
  ncertReference: string | null;
  sortOrder: number;
  topics: StudentSyllabusTopic[];
}

export interface StudentSyllabusUnit {
  id: string;
  name: string;
  sortOrder: number;
  chapters: StudentSyllabusChapter[];
}

export interface GetStudentSyllabusResult {
  success: boolean;
  subjects: EnrolledSubjectOption[];
  selectedSubjectId: string | null;
  selectedSubjectName: string | null;
  units: StudentSyllabusUnit[];
  progress: SyllabusProgressSummary;
  studentName?: string;
  className?: string;
  sectionName?: string;
  error?: string;
}

export async function getStudentSyllabusAction(
  selectedSubjectIdParam?: string,
  studentIdParam?: string
): Promise<GetStudentSyllabusResult> {
  try {
    const session = await getCachedSession();
    if (!session?.user?.id) {
      return {
        success: false,
        subjects: [],
        selectedSubjectId: null,
        selectedSubjectName: null,
        units: [],
        progress: { totalTopics: 0, taughtTopics: 0, nextTopics: 0, upcomingTopics: 0, coveragePercentage: 0 },
        error: "Unauthorized",
      };
    }

    const userId = session.user.id;
    const schoolId = session.user.schoolId || "";
    const role = session.user.role || "STUDENT";

    const scope = await resolveStudentScope(userId, {
      schoolId,
      studentId: studentIdParam ?? null,
      role,
    });

    if (scope.isAccountDisabled) {
      return {
        success: false,
        subjects: [],
        selectedSubjectId: null,
        selectedSubjectName: null,
        units: [],
        progress: { totalTopics: 0, taughtTopics: 0, nextTopics: 0, upcomingTopics: 0, coveragePercentage: 0 },
        error: "Your student portal account has been disabled by the school office.",
      };
    }

    if (!scope.classId) {
      return {
        success: true,
        subjects: [],
        selectedSubjectId: null,
        selectedSubjectName: null,
        units: [],
        progress: { totalTopics: 0, taughtTopics: 0, nextTopics: 0, upcomingTopics: 0, coveragePercentage: 0 },
        studentName: scope.studentName,
        className: scope.className,
        sectionName: scope.sectionName,
        error: "No active class enrollment found.",
      };
    }

    return await withTenant(scope.schoolId, async () => {
      // 1. Resolve eligible classSubjects for student's class (respecting electives)
      const allClassesSubjects = await db.query.classSubjects.findMany({
        where: and(
          eq(classSubjects.schoolId, scope.schoolId),
          eq(classSubjects.classId, scope.classId!)
        ),
        with: {
          subject: true,
        },
      });

      // Check elective enrollments
      const electiveEnrollments = await db.query.studentSubjectEnrollments.findMany({
        where: and(
          eq(studentSubjectEnrollments.schoolId, scope.schoolId),
          eq(studentSubjectEnrollments.studentId, scope.studentId),
          eq(studentSubjectEnrollments.enrollmentStatus, "ACTIVE")
        ),
      });

      const enrolledElectiveIds = new Set(
        electiveEnrollments.map((e) => e.classSubjectId)
      );

      const eligibleClassSubjects = allClassesSubjects.filter((cs) => {
        if (cs.isElective) {
          return enrolledElectiveIds.has(cs.id);
        }
        return true;
      });

      const subjectOptions: EnrolledSubjectOption[] = eligibleClassSubjects.map((cs) => ({
        id: cs.id,
        name: cs.subject?.name || "Subject",
        code: cs.subject?.code || null,
        isElective: Boolean(cs.isElective),
      }));

      if (subjectOptions.length === 0) {
        return {
          success: true,
          subjects: [],
          selectedSubjectId: null,
          selectedSubjectName: null,
          units: [],
          progress: { totalTopics: 0, taughtTopics: 0, nextTopics: 0, upcomingTopics: 0, coveragePercentage: 0 },
          studentName: scope.studentName,
          className: scope.className,
          sectionName: scope.sectionName,
        };
      }

      // Determine active selected subject (defaults to first subject)
      const activeSubject =
        (selectedSubjectIdParam && subjectOptions.find((s) => s.id === selectedSubjectIdParam)) ||
        subjectOptions[0];

      if (!activeSubject) {
        return {
          success: true,
          subjects: subjectOptions,
          selectedSubjectId: null,
          selectedSubjectName: null,
          units: [],
          progress: { totalTopics: 0, taughtTopics: 0, nextTopics: 0, upcomingTopics: 0, coveragePercentage: 0 },
          studentName: scope.studentName,
          className: scope.className,
          sectionName: scope.sectionName,
        };
      }

      const activeClassSubjectId = activeSubject.id;

      // 2. Fetch syllabus tree: Units -> Chapters -> Topics
      const rawUnits = await db.query.syllabusUnits.findMany({
        where: and(
          eq(syllabusUnits.schoolId, scope.schoolId),
          eq(syllabusUnits.classSubjectId, activeClassSubjectId),
          eq(syllabusUnits.isActive, true),
          isNull(syllabusUnits.deletedAt)
        ),
        with: {
          chapters: {
            where: (ch, { and, eq, isNull }) =>
              and(eq(ch.isActive, true), isNull(ch.deletedAt)),
            orderBy: (ch, { asc }) => [asc(ch.sortOrder)],
            with: {
              topics: {
                where: (tp, { and, eq, isNull }) =>
                  and(eq(tp.isActive, true), isNull(tp.deletedAt)),
                orderBy: (tp, { asc }) => [asc(tp.sortOrder)],
              },
            },
          },
        },
        orderBy: [asc(syllabusUnits.sortOrder)],
      });

      // 3. Query lesson plans for this subject to derive TAUGHT / NEXT states
      const rawLessonPlans = await db.query.lessonPlans.findMany({
        where: and(
          eq(lessonPlans.schoolId, scope.schoolId),
          eq(lessonPlans.classSubjectId, activeClassSubjectId),
          isNull(lessonPlans.deletedAt)
        ),
      });

      const completedTopicIds = new Set<string>();
      const plannedTopicIds = new Set<string>();

      for (const lp of rawLessonPlans) {
        if (!lp.syllabusTopicId) continue;
        if (lp.status === "COMPLETED") {
          completedTopicIds.add(lp.syllabusTopicId);
        } else if (lp.status === "PLANNED" || lp.status === "IN_PROGRESS") {
          plannedTopicIds.add(lp.syllabusTopicId);
        }
      }

      // Build structured unit/chapter/topic tree with derived statuses
      const allDerivedTopics: Array<{ status: SyllabusTopicStatus }> = [];

      const units: StudentSyllabusUnit[] = rawUnits.map((u) => {
        const chapters: StudentSyllabusChapter[] = (u.chapters || []).map((ch) => {
          const topics: StudentSyllabusTopic[] = (ch.topics || []).map((tp) => {
            const status = deriveTopicSyllabusStatus({
              topicId: tp.id,
              completedTopicIds,
              plannedTopicIds,
            });
            allDerivedTopics.push({ status });

            return {
              id: tp.id,
              name: tp.name,
              description: tp.description || null,
              sortOrder: tp.sortOrder,
              estimatedPeriods: tp.estimatedPeriods || null,
              status,
            };
          });

          return {
            id: ch.id,
            name: ch.name,
            ncertReference: ch.ncertReference || null,
            sortOrder: ch.sortOrder,
            topics,
          };
        });

        return {
          id: u.id,
          name: u.name,
          sortOrder: u.sortOrder,
          chapters,
        };
      });

      const progress = calculateSyllabusProgress(allDerivedTopics);

      return {
        success: true,
        subjects: subjectOptions,
        selectedSubjectId: activeClassSubjectId,
        selectedSubjectName: activeSubject.name,
        units,
        progress,
        studentName: scope.studentName,
        className: scope.className,
        sectionName: scope.sectionName,
      };
    });
  } catch (error: any) {
    console.error("[getStudentSyllabusAction] Error:", error);
    return {
      success: false,
      subjects: [],
      selectedSubjectId: null,
      selectedSubjectName: null,
      units: [],
      progress: { totalTopics: 0, taughtTopics: 0, nextTopics: 0, upcomingTopics: 0, coveragePercentage: 0 },
      error: error?.message || "Failed to load syllabus.",
    };
  }
}
