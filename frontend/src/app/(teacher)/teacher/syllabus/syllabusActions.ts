"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { withTenant } from "@/db";
import {
  classSubjects,
  sectionSubjectTeachers,
  syllabusUnits,
  syllabusChapters,
  syllabusTopics,
  lessonPlans,
  classes,
  subjects,
  domainEvents,
} from "@/db/schema";
import { eq, and, asc, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface SyllabusTopicItem {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  estimatedPeriods: number | null;
  isTaught: boolean;
  taughtDate: string | null;
}

export interface SyllabusChapterItem {
  id: string;
  name: string;
  ncertReference: string | null;
  sortOrder: number;
  topics: SyllabusTopicItem[];
  totalTopics: number;
  taughtTopics: number;
  progressPercent: number;
}

export interface SyllabusUnitItem {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  chapters: SyllabusChapterItem[];
  totalTopics: number;
  taughtTopics: number;
  progressPercent: number;
}

export interface TeacherSyllabusSubjectOption {
  classSubjectId: string;
  className: string;
  subjectName: string;
  totalTopics: number;
  taughtTopics: number;
  progressPercent: number;
}

export interface SyllabusPaceInsight {
  status: "AHEAD" | "ON_TRACK" | "BEHIND";
  progressPercent: number;
  expectedPercent: number;
  message: string;
  messageHi: string;
}

export interface TeacherSyllabusData {
  subjects: TeacherSyllabusSubjectOption[];
  selectedSubject: TeacherSyllabusSubjectOption | null;
  units: SyllabusUnitItem[];
  overallProgress: {
    totalUnits: number;
    totalChapters: number;
    totalTopics: number;
    taughtTopics: number;
    progressPercent: number;
  };
  paceInsight: SyllabusPaceInsight;
}

export async function getTeacherSyllabusData(
  selectedClassSubjectId?: string
): Promise<TeacherSyllabusData> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    // 1. Resolve teacher's assigned subjects
    const sstRows = await tx.query.sectionSubjectTeachers.findMany({
      where: and(
        eq(sectionSubjectTeachers.schoolId, school.id),
        ctx.role === "TEACHER"
          ? eq(sectionSubjectTeachers.teacherId, ctx.userId)
          : undefined
      ),
      with: {
        classSubject: { with: { subject: true, class: true } },
      },
    });

    const csRows = await tx.query.classSubjects.findMany({
      where: and(
        eq(classSubjects.schoolId, school.id),
        ctx.role === "TEACHER"
          ? eq(classSubjects.assignedTeacherId, ctx.userId)
          : undefined
      ),
      with: {
        subject: true,
        class: true,
      },
    });

    // Map unique classSubjectIds
    const subjectMap = new Map<string, { classSubjectId: string; className: string; subjectName: string }>();

    for (const sst of sstRows) {
      if (!sst.classSubject) continue;
      const cs = sst.classSubject;
      subjectMap.set(cs.id, {
        classSubjectId: cs.id,
        className: cs.class?.displayName || cs.class?.name || "Class",
        subjectName: cs.subject?.name || "Subject",
      });
    }

    for (const cs of csRows) {
      if (!subjectMap.has(cs.id)) {
        subjectMap.set(cs.id, {
          classSubjectId: cs.id,
          className: cs.class?.displayName || cs.class?.name || "Class",
          subjectName: cs.subject?.name || "Subject",
        });
      }
    }

    // Fallback: If no direct assignments (or admin preview), fetch school classSubjects
    if (subjectMap.size === 0) {
      const allCS = await tx.query.classSubjects.findMany({
        where: eq(classSubjects.schoolId, school.id),
        with: { subject: true, class: true },
        limit: 10,
      });
      for (const cs of allCS) {
        subjectMap.set(cs.id, {
          classSubjectId: cs.id,
          className: cs.class?.displayName || cs.class?.name || "Class",
          subjectName: cs.subject?.name || "Subject",
        });
      }
    }

    const availableSubjectsList = Array.from(subjectMap.values());
    const activeClassSubjectId =
      selectedClassSubjectId && subjectMap.has(selectedClassSubjectId)
        ? selectedClassSubjectId
        : availableSubjectsList[0]?.classSubjectId;

    if (!activeClassSubjectId) {
      return {
        subjects: [],
        selectedSubject: null,
        units: [],
        overallProgress: {
          totalUnits: 0,
          totalChapters: 0,
          totalTopics: 0,
          taughtTopics: 0,
          progressPercent: 0,
        },
        paceInsight: {
          status: "ON_TRACK",
          progressPercent: 0,
          expectedPercent: 50,
          message: "No syllabus curriculum configured yet.",
          messageHi: "अभी कोई पाठ्यक्रम कॉन्फ़िगर नहीं किया गया है।",
        },
      };
    }

    // 2. Fetch completed lesson plans for active subject
    const completedPlans = await tx.query.lessonPlans.findMany({
      where: and(
        eq(lessonPlans.schoolId, school.id),
        eq(lessonPlans.classSubjectId, activeClassSubjectId),
        eq(lessonPlans.status, "COMPLETED"),
        isNull(lessonPlans.deletedAt)
      ),
    });

    const taughtTopicIds = new Map<string, string>(); // topicId -> completedDate ISO string
    for (const plan of completedPlans) {
      if (plan.syllabusTopicId) {
        taughtTopicIds.set(
          plan.syllabusTopicId,
          plan.completedDate ? plan.completedDate.toISOString() : new Date().toISOString()
        );
      }
    }

    // 3. Fetch syllabus hierarchy: Units -> Chapters -> Topics
    const unitRows = await tx.query.syllabusUnits.findMany({
      where: and(
        eq(syllabusUnits.schoolId, school.id),
        eq(syllabusUnits.classSubjectId, activeClassSubjectId),
        eq(syllabusUnits.isActive, true),
        isNull(syllabusUnits.deletedAt)
      ),
      orderBy: [asc(syllabusUnits.sortOrder)],
      with: {
        chapters: {
          where: and(eq(syllabusChapters.isActive, true), isNull(syllabusChapters.deletedAt)),
          orderBy: [asc(syllabusChapters.sortOrder)],
          with: {
            topics: {
              where: and(eq(syllabusTopics.isActive, true), isNull(syllabusTopics.deletedAt)),
              orderBy: [asc(syllabusTopics.sortOrder)],
            },
          },
        },
      },
    });

    let overallTopicsCount = 0;
    let overallTaughtCount = 0;
    let overallChaptersCount = 0;

    const units: SyllabusUnitItem[] = unitRows.map((u: any) => {
      let unitTotalTopics = 0;
      let unitTaughtTopics = 0;

      const chapters: SyllabusChapterItem[] = (u.chapters || []).map((ch: any) => {
        overallChaptersCount++;
        const topics: SyllabusTopicItem[] = (ch.topics || []).map((t: any) => {
          overallTopicsCount++;
          unitTotalTopics++;
          const isTaught = taughtTopicIds.has(t.id);
          if (isTaught) {
            overallTaughtCount++;
            unitTaughtTopics++;
          }
          return {
            id: t.id,
            name: t.name || t.title || "Topic",
            description: t.description || null,
            sortOrder: t.sortOrder || 1,
            estimatedPeriods: t.estimatedPeriods || 1,
            isTaught,
            taughtDate: taughtTopicIds.get(t.id) || null,
          };
        });

        const chTaught = topics.filter((t) => t.isTaught).length;
        const chTotal = topics.length;

        return {
          id: ch.id,
          name: ch.name || ch.title || "Chapter",
          ncertReference: ch.ncertReference || null,
          sortOrder: ch.sortOrder || 1,
          topics,
          totalTopics: chTotal,
          taughtTopics: chTaught,
          progressPercent: chTotal > 0 ? Math.round((chTaught / chTotal) * 100) : 0,
        };
      });

      return {
        id: u.id,
        name: u.name || u.title || "Unit",
        description: u.description || null,
        sortOrder: u.sortOrder || 1,
        chapters,
        totalTopics: unitTotalTopics,
        taughtTopics: unitTaughtTopics,
        progressPercent:
          unitTotalTopics > 0 ? Math.round((unitTaughtTopics / unitTotalTopics) * 100) : 0,
      };
    });

    const overallProgressPercent =
      overallTopicsCount > 0
        ? Math.round((overallTaughtCount / overallTopicsCount) * 100)
        : 0;

    // 4. Calculate Pace Insight
    // Target pace calculation (estimated benchmark: ~60% mid-year)
    const now = new Date();
    // Assuming academic session April-March: month 3 (April) = 0%, month 2 (March) = 100%
    const month = now.getMonth(); // 0 = Jan, 11 = Dec
    let elapsedMonths = (month + 9) % 12; // April=0, May=1, ..., Dec=8, Jan=9, Feb=10, Mar=11
    if (elapsedMonths < 0) elapsedMonths = 0;
    const expectedPercent = Math.min(100, Math.max(10, Math.round((elapsedMonths / 10) * 100)));

    let status: "AHEAD" | "ON_TRACK" | "BEHIND" = "ON_TRACK";
    let message = "";
    let messageHi = "";

    if (overallProgressPercent >= expectedPercent + 10) {
      status = "AHEAD";
      message = `Curriculum pace is ahead of schedule (${overallProgressPercent}% covered vs ${expectedPercent}% expected).`;
      messageHi = `पाठ्यक्रम गति निर्धारित लक्ष्य से आगे है (${overallProgressPercent}% पूर्ण बनाम ${expectedPercent}% अपेक्षित)।`;
    } else if (overallProgressPercent < expectedPercent - 15) {
      status = "BEHIND";
      message = `Curriculum coverage is slightly behind schedule (${overallProgressPercent}% covered vs ${expectedPercent}% expected). Additional periods recommended.`;
      messageHi = `पाठ्यक्रम कवरेज अपेक्षित गति से धीमा है (${overallProgressPercent}% पूर्ण बनाम ${expectedPercent}% अपेक्षित)।`;
    } else {
      status = "ON_TRACK";
      message = `Curriculum pace is on track (${overallProgressPercent}% covered vs ${expectedPercent}% expected for this term).`;
      messageHi = `पाठ्यक्रम गति समय पर है (${overallProgressPercent}% पूर्ण बनाम ${expectedPercent}% अपेक्षित)।`;
    }

    const paceInsight: SyllabusPaceInsight = {
      status,
      progressPercent: overallProgressPercent,
      expectedPercent,
      message,
      messageHi,
    };

    const subjectsSummary: TeacherSyllabusSubjectOption[] = availableSubjectsList.map((s) => ({
      classSubjectId: s.classSubjectId,
      className: s.className,
      subjectName: s.subjectName,
      totalTopics: s.classSubjectId === activeClassSubjectId ? overallTopicsCount : 0,
      taughtTopics: s.classSubjectId === activeClassSubjectId ? overallTaughtCount : 0,
      progressPercent: s.classSubjectId === activeClassSubjectId ? overallProgressPercent : 0,
    }));

    const selectedSubject =
      subjectsSummary.find((s) => s.classSubjectId === activeClassSubjectId) || null;

    return {
      subjects: subjectsSummary,
      selectedSubject,
      units,
      overallProgress: {
        totalUnits: units.length,
        totalChapters: overallChaptersCount,
        totalTopics: overallTopicsCount,
        taughtTopics: overallTaughtCount,
        progressPercent: overallProgressPercent,
      },
      paceInsight,
    };
  });
}

/**
 * 2. Mark syllabus topic taught or untaught (scoped to teacher's S16 allocations)
 */
export async function markTopicTaughtAction(input: {
  topicId: string;
  isTaught: boolean;
  taughtDate?: string | Date;
}) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    // 1. Fetch topic, chapter, unit to find classSubjectId
    const topic = await tx.query.syllabusTopics.findFirst({
      where: and(
        eq(syllabusTopics.schoolId, school.id),
        eq(syllabusTopics.id, input.topicId)
      ),
      with: {
        chapter: {
          with: {
            unit: true,
          },
        },
      },
    });

    if (!topic || !topic.chapter?.unit?.classSubjectId) {
      throw new Error("Syllabus topic not found.");
    }

    const classSubjectId = topic.chapter.unit.classSubjectId;

    // 2. Teacher allocation guard (S16)
    if (ctx.role === "TEACHER") {
      const isAllocated = await tx.query.sectionSubjectTeachers.findFirst({
        where: and(
          eq(sectionSubjectTeachers.schoolId, school.id),
          eq(sectionSubjectTeachers.teacherId, ctx.userId),
          eq(sectionSubjectTeachers.classSubjectId, classSubjectId)
        ),
      });

      const isClassSubjectAssigned = isAllocated
        ? true
        : await tx.query.classSubjects.findFirst({
            where: and(
              eq(classSubjects.schoolId, school.id),
              eq(classSubjects.id, classSubjectId),
              eq(classSubjects.assignedTeacherId, ctx.userId)
            ),
          });

      if (!isAllocated && !isClassSubjectAssigned) {
        throw new Error("Unauthorized: Teacher is not allocated to teach this subject.");
      }
    }

    const effectiveDate = input.isTaught
      ? (input.taughtDate ? new Date(input.taughtDate) : new Date())
      : null;

    if (input.isTaught) {
      // Find or create lesson plan marked COMPLETED
      const existingPlan = await tx.query.lessonPlans.findFirst({
        where: and(
          eq(lessonPlans.schoolId, school.id),
          eq(lessonPlans.classSubjectId, classSubjectId),
          eq(lessonPlans.syllabusTopicId, topic.id),
          isNull(lessonPlans.deletedAt)
        ),
      });

      if (existingPlan) {
        await tx
          .update(lessonPlans)
          .set({
            status: "COMPLETED",
            completedDate: effectiveDate,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(lessonPlans.schoolId, school.id),
              eq(lessonPlans.id, existingPlan.id)
            )
          );
      } else {
        await tx.insert(lessonPlans).values({
          schoolId: school.id,
          classSubjectId,
          teacherId: ctx.userId,
          syllabusTopicId: topic.id,
          title: topic.name,
          chapterName: topic.chapter.name,
          status: "COMPLETED",
          completedDate: effectiveDate,
        });
      }

      // Emit domain event for multi-surface tracking
      await tx.insert(domainEvents).values({
        schoolId: school.id,
        aggregateId: topic.id,
        eventType: "SyllabusTopicCoveredEvent",
        payload: {
          topicId: topic.id,
          topicTitle: topic.name,
          classSubjectId,
          schoolId: school.id,
          teacherUserId: ctx.userId,
          coveredAt: effectiveDate?.toISOString(),
        },
        status: "PENDING",
      });
    } else {
      // Mark existing lesson plans PLANNED / not completed
      await tx
        .update(lessonPlans)
        .set({
          status: "PLANNED",
          completedDate: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(lessonPlans.schoolId, school.id),
            eq(lessonPlans.classSubjectId, classSubjectId),
            eq(lessonPlans.syllabusTopicId, topic.id),
            isNull(lessonPlans.deletedAt)
          )
        );
    }

    revalidatePath("/teacher/syllabus");
    return {
      success: true,
      isTaught: input.isTaught,
      taughtDate: effectiveDate ? effectiveDate.toISOString() : null,
      message: input.isTaught ? "Topic marked as covered." : "Topic marked as pending.",
    };
  });
}
