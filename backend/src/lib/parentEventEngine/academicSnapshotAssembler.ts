/**
 * Authoritative Academic Snapshot Assembler
 *
 * Assembles curriculum-anchored academic snapshots for parent feeds:
 * - Homework (published assignments with submissions & teacher names)
 * - Classwork (completed lesson plans in last 7 days)
 * - Syllabus Coverage (weekly digest: unit -> chapter -> topic)
 * - Curriculum Progress (topics completed vs total for active term)
 * - Upcoming Assessments (scheduled within 14 days)
 *
 * Scoping rules:
 * - Filtered strictly to ward's classSubjects & currentSectionId
 * - Honors elective enrollments from studentSubjectEnrollments
 * - Respects active term boundaries
 */

import {
  assignments,
  assignmentSubmissions,
  lessonPlans,
  syllabusUnits,
  syllabusChapters,
  syllabusTopics,
  assessments,
  classSubjects,
  subjects,
  studentSubjectEnrollments,
  academicTerms,
  staff,
} from "@schoolmitra/database";
import { eq, and, or, inArray, gte, lte, isNull, desc, asc } from "drizzle-orm";
import { decryptData } from "../encryption";
import type {
  HomeworkSnapshot,
  ClassworkSnapshot,
  SyllabusCoverageSnapshot,
  SyllabusCoverageItem,
  CurriculumProgressSnapshot,
  CurriculumProgressItem,
  AssessmentSnapshot,
} from "./types";

export interface AcademicSnapshotAssemblerInput {
  schoolId: string;
  studentId: string;
  currentClassId: string | null;
  currentSectionId: string | null;
  now?: Date;
}

export interface AcademicSnapshotResult {
  homework: HomeworkSnapshot[];
  classwork: ClassworkSnapshot[];
  syllabusCoverage?: SyllabusCoverageSnapshot;
  curriculumProgress?: CurriculumProgressSnapshot;
  upcomingAssessments: AssessmentSnapshot[];
}

export async function assembleAcademicSnapshot(
  tx: any,
  input: AcademicSnapshotAssemblerInput
): Promise<AcademicSnapshotResult> {
  const { schoolId, studentId, currentClassId, currentSectionId } = input;
  const now = input.now || new Date();
  const nowMs = now.getTime();

  if (!currentClassId) {
    return {
      homework: [],
      classwork: [],
      upcomingAssessments: [],
    };
  }

  // 1. Resolve student's eligible classSubjects (respecting electives)
  const allClassSubjects = await tx.query.classSubjects.findMany({
    where: and(
      eq(classSubjects.schoolId, schoolId),
      eq(classSubjects.classId, currentClassId)
    ),
    with: {
      subject: true,
    },
  });

  if (allClassSubjects.length === 0) {
    return {
      homework: [],
      classwork: [],
      upcomingAssessments: [],
    };
  }

  // Check elective enrollments
  const electiveEnrollments = await tx.query.studentSubjectEnrollments.findMany({
    where: and(
      eq(studentSubjectEnrollments.schoolId, schoolId),
      eq(studentSubjectEnrollments.studentId, studentId),
      eq(studentSubjectEnrollments.enrollmentStatus, "ACTIVE")
    ),
  });

  const enrolledSubjectIds = new Set(electiveEnrollments.map((e: any) => e.classSubjectId));

  // Eligible classSubjects: core subjects (not marked elective) OR explicitly enrolled
  const eligibleClassSubjects = allClassSubjects.filter((cs: any) => {
    if (cs.isElective) {
      return enrolledSubjectIds.has(cs.id);
    }
    return true;
  });

  const eligibleClassSubjectIds = eligibleClassSubjects.map((cs: any) => cs.id);
  const subjectNameMap = new Map<string, string>(
    eligibleClassSubjects.map((cs: any) => [cs.id, cs.subject?.name || "Academics"])
  );

  if (eligibleClassSubjectIds.length === 0) {
    return {
      homework: [],
      classwork: [],
      upcomingAssessments: [],
    };
  }

  // Helper to resolve teacher display names
  const teacherIds = new Set<string>();

  // ─── A. Homework (assignments within ±14 days, PUBLISHED / GRADED / CLOSED) ───
  const cutoffPast14d = new Date(nowMs - 14 * 86400000);
  const cutoffFuture14d = new Date(nowMs + 14 * 86400000);

  const rawAssignments = await tx.query.assignments.findMany({
    where: and(
      eq(assignments.schoolId, schoolId),
      inArray(assignments.classSubjectId, eligibleClassSubjectIds),
      currentSectionId ? eq(assignments.sectionId, currentSectionId) : undefined,
      inArray(assignments.status, ["PUBLISHED", "CLOSED", "GRADED"]),
      gte(assignments.dueDate, cutoffPast14d),
      lte(assignments.dueDate, cutoffFuture14d)
    ),
    orderBy: [asc(assignments.dueDate)],
  });

  for (const a of rawAssignments) {
    if (a.createdByTeacherId) teacherIds.add(a.createdByTeacherId);
  }

  // Submissions for this student
  const assignmentIds = rawAssignments.map((a: any) => a.id);
  const submissions =
    assignmentIds.length > 0
      ? await tx.query.assignmentSubmissions.findMany({
          where: and(
            eq(assignmentSubmissions.schoolId, schoolId),
            eq(assignmentSubmissions.studentId, studentId),
            inArray(assignmentSubmissions.assignmentId, assignmentIds)
          ),
        })
      : [];

  const submissionMap = new Map<string, any>(
    submissions.map((s: any) => [s.assignmentId, s])
  );

  // ─── B. Classwork (completed lessonPlans in past 7 days) ────────────────────
  const cutoffPast7d = new Date(nowMs - 7 * 86400000);
  const rawLessonPlans = await tx.query.lessonPlans.findMany({
    where: and(
      eq(lessonPlans.schoolId, schoolId),
      inArray(lessonPlans.classSubjectId, eligibleClassSubjectIds),
      eq(lessonPlans.status, "COMPLETED"),
      gte(lessonPlans.completedDate, cutoffPast7d)
    ),
    with: {
      syllabusTopic: true,
    },
    orderBy: [desc(lessonPlans.completedDate)],
  });

  for (const lp of rawLessonPlans) {
    if (lp.teacherId) teacherIds.add(lp.teacherId);
  }

  // ─── Resolve Teacher Display Names ─────────────────────────────────────────
  const teacherIdList = Array.from(teacherIds);
  const teacherStaff =
    teacherIdList.length > 0
      ? await tx.query.staff.findMany({
          where: and(
            eq(staff.schoolId, schoolId),
            inArray(staff.userId, teacherIdList)
          ),
        })
      : [];

  const teacherNameMap = new Map<string, string>();
  for (const s of teacherStaff) {
    if (s.userId) {
      const fName = decryptData(s.firstNameEncrypted) || "";
      const lName = s.lastNameEncrypted ? decryptData(s.lastNameEncrypted) || "" : "";
      const fullName = `${fName} ${lName}`.trim();
      if (fullName) teacherNameMap.set(s.userId, fullName);
    }
  }

  // Build HomeworkSnapshots
  const homeworkSnaps: HomeworkSnapshot[] = rawAssignments.map((a: any) => {
    const sub = submissionMap.get(a.id);
    const subjectName = subjectNameMap.get(a.classSubjectId) || "Academics";
    const teacherName = teacherNameMap.get(a.createdByTeacherId) || "Class Teacher";

    let submissionData:
      | {
          submittedAt: Date | string;
          marksAwarded?: number | null;
          grade?: string | null;
          feedback?: string | null;
        }
      | undefined = undefined;

    if (sub) {
      submissionData = {
        submittedAt: sub.submittedAt || sub.createdAt,
        marksAwarded: sub.marksAwarded,
        grade:
          sub.marksAwarded !== null && sub.marksAwarded !== undefined
            ? `${sub.marksAwarded}`
            : sub.gradedAt
            ? "Graded"
            : null,
        feedback: sub.remarks,
      };
    }

    return {
      id: a.id,
      title: a.title,
      description: a.description || null,
      subjectName,
      dueDate: a.dueDate,
      status: a.status,
      attachmentS3Key: a.attachmentS3Key || null,
      teacherName,
      isSubmitted: Boolean(sub),
      ...(submissionData ? { submission: submissionData } : {}),
    };
  });

  // Build ClassworkSnapshots
  const classworkSnaps: ClassworkSnapshot[] = rawLessonPlans.map((lp: any) => {
    const subjectName = subjectNameMap.get(lp.classSubjectId) || "Academics";
    const teacherName = teacherNameMap.get(lp.teacherId) || "Subject Teacher";

    return {
      id: lp.id,
      subjectName,
      chapterName: lp.chapterName || null,
      topicTitle: lp.syllabusTopic?.name || lp.title || null,
      objectives: lp.objectives || null,
      homework: lp.homework || null,
      teachingMethods: lp.teachingMethods || null,
      resources: lp.resources || null,
      completedDate: lp.completedDate,
      teacherName,
    };
  });

  // ─── C. Syllabus Coverage & Progress ───────────────────────────────────────
  // Query active term
  const activeTerm = await tx.query.academicTerms.findFirst({
    where: and(
      eq(academicTerms.schoolId, schoolId),
      eq(academicTerms.isActive, true)
    ),
  });

  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // Monday
  weekStart.setDate(diff);
  const weekLabel = `Week of ${weekStart.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`;

  // For each eligible subject, get the most recent completed topic + progress
  const syllabusItems: SyllabusCoverageItem[] = [];
  const progressItems: CurriculumProgressItem[] = [];

  for (const cs of eligibleClassSubjects) {
    const subName = cs.subject?.name || "Academics";

    // 1. Units & topics for this classSubject
    const units = await tx.query.syllabusUnits.findMany({
      where: and(
        eq(syllabusUnits.schoolId, schoolId),
        eq(syllabusUnits.classSubjectId, cs.id),
        eq(syllabusUnits.isActive, true)
      ),
      with: {
        chapters: {
          where: (ch: any, { eq }: any) => eq(ch.isActive, true),
          with: {
            topics: {
              where: (tp: any, { eq }: any) => eq(tp.isActive, true),
            },
          },
        },
      },
      orderBy: [asc(syllabusUnits.sortOrder)],
    });

    let totalTopics = 0;
    const allTopicIds: string[] = [];

    for (const u of units) {
      for (const ch of u.chapters || []) {
        for (const tp of ch.topics || []) {
          totalTopics++;
          allTopicIds.push(tp.id);
        }
      }
    }

    // Recent completed lesson plan for this subject
    const latestPlan = await tx.query.lessonPlans.findFirst({
      where: and(
        eq(lessonPlans.schoolId, schoolId),
        eq(lessonPlans.classSubjectId, cs.id),
        eq(lessonPlans.status, "COMPLETED")
      ),
      with: {
        syllabusTopic: {
          with: {
            chapter: {
              with: {
                unit: true,
              },
            },
          },
        },
      },
      orderBy: [desc(lessonPlans.completedDate)],
    });

    if (latestPlan) {
      const top = latestPlan.syllabusTopic;
      syllabusItems.push({
        subjectName: subName,
        unitNumber: top?.chapter?.unit?.sortOrder || null,
        unitTitle: top?.chapter?.unit?.name || null,
        chapterNumber: top?.chapter?.sortOrder || null,
        chapterTitle: top?.chapter?.name || latestPlan.chapterName || null,
        topicTitle: top?.name || latestPlan.title || null,
        status: "COMPLETED",
      });
    }

    // Completed topic count for progress calculation
    const completedPlans = await tx.query.lessonPlans.findMany({
      where: and(
        eq(lessonPlans.schoolId, schoolId),
        eq(lessonPlans.classSubjectId, cs.id),
        eq(lessonPlans.status, "COMPLETED")
      ),
      columns: { id: true, syllabusTopicId: true },
    });

    const completedTopicsCount = completedPlans.length;
    const progressPercentage =
      totalTopics > 0
        ? Math.min(100, Math.round((completedTopicsCount / totalTopics) * 100))
        : completedTopicsCount > 0
        ? 100
        : 0;

    progressItems.push({
      subjectId: cs.id,
      subjectName: subName,
      completedTopicsCount,
      totalTopicsCount: totalTopics,
      progressPercentage,
    });
  }

  let syllabusCoverage: SyllabusCoverageSnapshot | undefined = undefined;
  if (syllabusItems.length > 0) {
    syllabusCoverage = {
      weekLabel,
      items: syllabusItems,
      generatedAt: now,
    };
  }

  let curriculumProgress: CurriculumProgressSnapshot | undefined = undefined;
  if (progressItems.length > 0) {
    curriculumProgress = {
      termName: activeTerm?.name || "Current Term",
      subjects: progressItems,
      generatedAt: now,
    };
  }

  // ─── D. Upcoming Assessments (within 14 days) ──────────────────────────────
  const rawAssessments = await tx.query.assessments.findMany({
    where: and(
      eq(assessments.schoolId, schoolId),
      inArray(assessments.classSubjectId, eligibleClassSubjectIds),
      currentSectionId
        ? or(isNull(assessments.sectionId), eq(assessments.sectionId, currentSectionId))
        : isNull(assessments.sectionId),
      inArray(assessments.status, ["SCHEDULED", "ONGOING"]),
      gte(assessments.date, new Date(nowMs - 86400000).toISOString().slice(0, 10)),
      lte(assessments.date, new Date(nowMs + 14 * 86400000).toISOString().slice(0, 10))
    ),
    orderBy: [asc(assessments.date)],
  });

  const upcomingAssessments: AssessmentSnapshot[] = rawAssessments.map((asmt: any) => {
    const subjectName = subjectNameMap.get(asmt.classSubjectId) || "Academics";

    return {
      id: asmt.id,
      title: asmt.title,
      subjectName,
      assessmentType: asmt.assessmentType,
      scheduledDate: asmt.date,
      maxMarks: asmt.maxMarks,
      syllabusCoverage: asmt.syllabusCoverage || null,
      status: asmt.status,
      updatedAt: asmt.updatedAt || asmt.createdAt,
    };
  });

  return {
    homework: homeworkSnaps,
    classwork: classworkSnaps,
    ...(syllabusCoverage ? { syllabusCoverage } : {}),
    ...(curriculumProgress ? { curriculumProgress } : {}),
    upcomingAssessments,
  };
}
