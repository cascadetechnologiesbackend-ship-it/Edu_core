"use server";

import { db } from "@/db";
import {
  classes,
  sections,
  subjects,
  classSubjects,
  assignments,
  assignmentSubmissions,
  lessonPlans,
  academicYears,
  users,
  syllabusTopics,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/auditLogger";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  verifyTeacherAccessToClassSubject,
  getActiveAcademicYear,
  checkAuth,
} from "./actions/auth-helper";

async function getAuditContext(session: any) {
  let ip = "unknown";
  let userAgent = "unknown";
  let headersObj: Record<string, string> = {};
  try {
    const reqHeaders = headers();
    ip = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    userAgent = reqHeaders.get("user-agent") ?? "unknown";
    headersObj = Object.fromEntries(reqHeaders.entries());
  } catch {}
  return {
    db,
    session,
    ip,
    userAgent,
    req: {
      headers: headersObj,
    },
  } as any;
}

// ─── 1. Classrooms & Sections Actions ──────────────────────────────────────────

export async function getClassrooms() {
  const session = await checkAuth();
  return await db.query.classes.findMany({
    where: and(
      eq(classes.schoolId, session.user.schoolId!),
      eq(classes.isActive, true),
    ),
    orderBy: [classes.sortOrder],
    with: {
      sections: {
        where: and(
          eq(sections.schoolId, session.user.schoolId!),
          eq(sections.isActive, true),
        ),
      },
    },
  });
}

export async function getTeachersList() {
  const session = await checkAuth();
  // Fetch users that are teachers in this school
  return await db.query.users.findMany({
    where: and(
      eq(users.schoolId, session.user.schoolId!),
      eq(users.isActive, true),
    ),
    orderBy: [users.email],
  });
}

export async function saveClassroom(data: {
  id?: string;
  gradeLevel: any;
  displayName: string;
  sortOrder: number;
}) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const activeYear = await getActiveAcademicYear(session.user.schoolId!);

  if (data.id) {
    await db
      .update(classes)
      .set({
        gradeLevel: data.gradeLevel,
        displayName: data.displayName,
        sortOrder: data.sortOrder,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(classes.id, data.id),
          eq(classes.schoolId, session.user.schoolId!),
        ),
      );
  } else {
    await db.insert(classes).values({
      schoolId: session.user.schoolId!,
      academicYearId: activeYear.id,
      gradeLevel: data.gradeLevel,
      displayName: data.displayName,
      sortOrder: data.sortOrder,
    });
  }
  try {
    revalidatePath("/academics");
  } catch {}
  return { success: true };
}

export async function saveSection(data: {
  id?: string;
  classId: string;
  name: string;
  capacity?: number;
  classTeacherId?: string | null;
  roomNumber?: string | null;
}) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const cls = await db.query.classes.findFirst({
    where: and(
      eq(classes.id, data.classId),
      eq(classes.schoolId, session.user.schoolId!),
    ),
  });
  if (!cls) throw new Error("Invalid class specified");

  const capacityVal = data.capacity ?? 40;
  const teacherIdVal = data.classTeacherId || null;
  const roomNumberVal = data.roomNumber || null;

  if (data.id) {
    await db
      .update(sections)
      .set({
        name: data.name,
        capacity: capacityVal,
        ...(teacherIdVal !== undefined
          ? { classTeacherId: teacherIdVal }
          : {}),
        ...(roomNumberVal !== undefined ? { roomNumber: roomNumberVal } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sections.id, data.id),
          eq(sections.schoolId, session.user.schoolId!),
        ),
      );
  } else {
    await db.insert(sections).values({
      schoolId: session.user.schoolId!,
      classId: data.classId,
      name: data.name,
      capacity: capacityVal,
      ...(teacherIdVal ? { classTeacherId: teacherIdVal } : {}),
      ...(roomNumberVal ? { roomNumber: roomNumberVal } : {}),
    });
  }
  try {
    revalidatePath("/academics");
  } catch {}
  return { success: true };
}

// ─── 2. Subject Master Actions ────────────────────────────────────────────────

export async function getSubjects() {
  const session = await checkAuth();
  return await db.query.subjects.findMany({
    where: and(
      eq(subjects.schoolId, session.user.schoolId!),
      eq(subjects.isActive, true),
    ),
    orderBy: [subjects.name],
  });
}

export async function saveSubject(data: {
  id?: string;
  name: string;
  code: string;
  type: "THEORY" | "PRACTICAL" | "CO_SCHOLASTIC" | "LANGUAGE" | "ACTIVITY";
}) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  if (data.id) {
    await db
      .update(subjects)
      .set({
        name: data.name,
        code: data.code,
        subjectType: data.type,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(subjects.id, data.id),
          eq(subjects.schoolId, session.user.schoolId!),
        ),
      );
  } else {
    await db.insert(subjects).values({
      schoolId: session.user.schoolId!,
      name: data.name,
      code: data.code,
      subjectType: data.type,
    });
  }
  try {
    revalidatePath("/academics");
  } catch {}
  return { success: true };
}

// ─── 3. Class Subject Mapping Actions ──────────────────────────────────────────

export async function getClassSubjects(classId: string) {
  const session = await checkAuth();
  return await db.query.classSubjects.findMany({
    where: and(
      eq(classSubjects.classId, classId),
      eq(classSubjects.schoolId, session.user.schoolId!),
    ),
    with: {
      subject: true,
      teacher: true,
    },
  });
}

export async function saveClassSubject(data: {
  id?: string;
  classId: string;
  subjectId: string;
  assignedTeacherId?: string | null;
  periodsPerWeek?: number;
  isElective?: boolean;
}) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const [cls, subj] = await Promise.all([
    db.query.classes.findFirst({
      where: and(
        eq(classes.id, data.classId),
        eq(classes.schoolId, session.user.schoolId!),
      ),
    }),
    db.query.subjects.findFirst({
      where: and(
        eq(subjects.id, data.subjectId),
        eq(subjects.schoolId, session.user.schoolId!),
      ),
    }),
  ]);
  if (!cls) throw new Error("Invalid class specified");
  if (!subj) throw new Error("Invalid subject specified");

  const assignedTeacherIdVal = data.assignedTeacherId || null;
  const periodsPerWeekVal = data.periodsPerWeek ?? 5;
  const isElectiveVal = data.isElective ?? false;

  if (data.id) {
    await db
      .update(classSubjects)
      .set({
        ...(assignedTeacherIdVal !== undefined
          ? { assignedTeacherId: assignedTeacherIdVal }
          : {}),
        periodsPerWeek: periodsPerWeekVal,
        isElective: isElectiveVal,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(classSubjects.id, data.id),
          eq(classSubjects.schoolId, session.user.schoolId!),
        ),
      );
  } else {
    await db.insert(classSubjects).values({
      schoolId: session.user.schoolId!,
      classId: data.classId,
      subjectId: data.subjectId,
      ...(assignedTeacherIdVal
        ? { assignedTeacherId: assignedTeacherIdVal }
        : {}),
      periodsPerWeek: periodsPerWeekVal,
      isElective: isElectiveVal,
    });
  }
  try {
    revalidatePath("/academics");
  } catch {}
  return { success: true };
}

// ─── 4. Assignment Actions ────────────────────────────────────────────────────

export async function getAssignments(
  sectionId: string,
  classSubjectId: string,
) {
  const session = await checkAuth();
  await verifyTeacherAccessToClassSubject(session, classSubjectId, sectionId);

  return await db.query.assignments.findMany({
    where: and(
      eq(assignments.schoolId, session.user.schoolId!),
      eq(assignments.sectionId, sectionId),
      eq(assignments.classSubjectId, classSubjectId),
    ),
    orderBy: [assignments.dueDate],
  });
}

export async function saveAssignment(data: {
  id?: string;
  classSubjectId: string;
  sectionId: string;
  title: string;
  description: string;
  maxMarks?: number;
  dueDate: string;
  attachmentS3Key?: string | null;
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "GRADED";
}) {
  const session = await checkAuth([
    "TEACHER",
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
  ]);

  await verifyTeacherAccessToClassSubject(session, data.classSubjectId, data.sectionId);

  const maxMarksVal = data.maxMarks ?? 100;
  const attachmentS3KeyVal = data.attachmentS3Key || null;

  if (data.id) {
    await db
      .update(assignments)
      .set({
        title: data.title,
        description: data.description,
        maxMarks: maxMarksVal,
        dueDate: new Date(data.dueDate),
        ...(attachmentS3KeyVal !== undefined
          ? { attachmentS3Key: attachmentS3KeyVal }
          : {}),
        status: data.status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(assignments.id, data.id),
          eq(assignments.schoolId, session.user.schoolId!),
        ),
      );
  } else {
    await db.insert(assignments).values({
      schoolId: session.user.schoolId!,
      classSubjectId: data.classSubjectId,
      sectionId: data.sectionId,
      title: data.title,
      description: data.description,
      maxMarks: maxMarksVal,
      dueDate: new Date(data.dueDate),
      ...(attachmentS3KeyVal ? { attachmentS3Key: attachmentS3KeyVal } : {}),
      status: data.status,
      createdByTeacherId: session.user.id,
    });
  }
  try {
    revalidatePath("/academics");
  } catch {}
  return { success: true };
}

export async function getAssignmentSubmissions(assignmentId: string) {
  const session = await checkAuth();
  const assignment = await db.query.assignments.findFirst({
    where: and(
      eq(assignments.id, assignmentId),
      eq(assignments.schoolId, session.user.schoolId!),
    ),
  });
  if (!assignment) throw new Error("Assignment not found");
  await verifyTeacherAccessToClassSubject(session, assignment.classSubjectId, assignment.sectionId);

  return await db.query.assignmentSubmissions.findMany({
    where: and(
      eq(assignmentSubmissions.assignmentId, assignmentId),
      eq(assignmentSubmissions.schoolId, session.user.schoolId!),
    ),
    with: {
      student: {
        columns: {
          id: true,
          admissionNumber: true,
        },
      },
    },
  });
}

export async function gradeSubmission(data: {
  submissionId: string;
  marksAwarded?: number;
  marksObtained?: number;
  remarks?: string | null;
  feedback?: string | null;
}) {
  const session = await checkAuth([
    "TEACHER",
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
  ]);
  const marks = data.marksAwarded ?? data.marksObtained ?? 0;
  const remarksVal = data.remarks ?? data.feedback ?? null;

  const prev = await db.query.assignmentSubmissions.findFirst({
    where: and(
      eq(assignmentSubmissions.id, data.submissionId),
      eq(assignmentSubmissions.schoolId, session.user.schoolId!),
    ),
    with: {
      assignment: true,
    },
  });

  if (!prev) {
    throw new Error("Submission not found");
  }

  await verifyTeacherAccessToClassSubject(session, prev.assignment.classSubjectId, prev.assignment.sectionId);

  await db
    .update(assignmentSubmissions)
    .set({
      marksAwarded: marks,
      ...(remarksVal !== undefined ? { remarks: remarksVal } : {}),
      gradedAt: new Date(),
      gradedByTeacherId: session.user.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(assignmentSubmissions.id, data.submissionId),
        eq(assignmentSubmissions.schoolId, session.user.schoolId!),
      ),
    );

  // DPDP Audit Log for modifying student grading
  const auditCtx = await getAuditContext(session);
  await logAuditEvent(auditCtx, {
    action: "WRITE",
    tableName: "assignment_submissions",
    recordId: data.submissionId,
    purposeId: "academic_grading",
    schoolId: session.user.schoolId!,
    metadata: {
      marksAwarded: marks,
      previousMarks: prev?.marksAwarded,
    },
  });

  try {
    revalidatePath("/academics");
  } catch {}
  return { success: true };
}

export async function submitAssignment(data: {
  assignmentId: string;
  studentId: string;
  attachmentS3Key?: string | null;
  remarks?: string | null;
}) {
  const session = await checkAuth();
  const assignment = await db.query.assignments.findFirst({
    where: and(
      eq(assignments.id, data.assignmentId),
      eq(assignments.schoolId, session.user.schoolId!),
    ),
  });
  if (!assignment) throw new Error("Assignment not found");

  await db.insert(assignmentSubmissions).values({
    schoolId: session.user.schoolId!,
    assignmentId: data.assignmentId,
    studentId: data.studentId,
    attachmentS3Key: data.attachmentS3Key || null,
    remarks: data.remarks || null,
  });
  try {
    revalidatePath("/academics");
  } catch {}
  return { success: true };
}

// ─── 5. Lesson Plan Actions (Rule #6 & #11) ───────────────────────────────────

export async function getLessonPlans(classSubjectId: string) {
  const session = await checkAuth();
  await verifyTeacherAccessToClassSubject(session, classSubjectId);
  return await db.query.lessonPlans.findMany({
    where: and(
      eq(lessonPlans.schoolId, session.user.schoolId!),
      eq(lessonPlans.classSubjectId, classSubjectId),
    ),
    orderBy: [lessonPlans.plannedDate],
  });
}

export async function saveLessonPlan(data: {
  id?: string;
  classSubjectId: string;
  syllabusTopicId?: string | null; // Rule #6: scoped to classSubject + teacher, NOT sectionId
  title: string;
  chapterName: string;
  ncertReference?: string | null;
  objectives?: string | null;
  plannedDate?: string | null;
  completedDate?: string | null;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
}) {
  const session = await checkAuth([
    "TEACHER",
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
  ]);

  // Server-side authorization check (Rule #11)
  await verifyTeacherAccessToClassSubject(session, data.classSubjectId);

  // Validate topic if provided
  if (data.syllabusTopicId) {
    const topic = await db.query.syllabusTopics.findFirst({
      where: and(
        eq(syllabusTopics.id, data.syllabusTopicId),
        eq(syllabusTopics.schoolId, session.user.schoolId!),
        eq(syllabusTopics.isActive, true),
      ),
      with: {
        chapter: {
          with: {
            unit: true,
          },
        },
      },
    });
    if (!topic || topic.chapter.unit.classSubjectId !== data.classSubjectId) {
      throw new Error("Invalid syllabus topic for this class subject.");
    }
  }

  const ncertReferenceVal = data.ncertReference || null;
  const objectivesVal = data.objectives || null;
  const plannedDateVal = data.plannedDate ? new Date(data.plannedDate) : null;
  const completedDateVal = data.completedDate
    ? new Date(data.completedDate)
    : null;
  const syllabusTopicIdVal = data.syllabusTopicId || null;

  if (data.id) {
    await db
      .update(lessonPlans)
      .set({
        title: data.title,
        chapterName: data.chapterName,
        syllabusTopicId: syllabusTopicIdVal,
        ...(ncertReferenceVal !== undefined
          ? { ncertReference: ncertReferenceVal }
          : {}),
        ...(objectivesVal !== undefined ? { objectives: objectivesVal } : {}),
        ...(plannedDateVal !== undefined
          ? { plannedDate: plannedDateVal }
          : {}),
        ...(completedDateVal !== undefined
          ? { completedDate: completedDateVal }
          : {}),
        status: data.status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(lessonPlans.id, data.id),
          eq(lessonPlans.schoolId, session.user.schoolId!),
        ),
      );
  } else {
    await db.insert(lessonPlans).values({
      schoolId: session.user.schoolId!,
      classSubjectId: data.classSubjectId,
      syllabusTopicId: syllabusTopicIdVal,
      teacherId: session.user.id,
      title: data.title,
      chapterName: data.chapterName,
      ...(ncertReferenceVal ? { ncertReference: ncertReferenceVal } : {}),
      ...(objectivesVal ? { objectives: objectivesVal } : {}),
      ...(plannedDateVal ? { plannedDate: plannedDateVal } : {}),
      ...(completedDateVal ? { completedDate: completedDateVal } : {}),
      status: data.status,
    });
  }
  try {
    revalidatePath("/academics");
  } catch {}
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── COMPATIBILITY WRAPPERS — AMS v2 Domain Actions ───────────────────────────
// Explicit async wrapper functions complying with Next.js "use server" rules
// ═══════════════════════════════════════════════════════════════════════════════

import {
  getAcademicYears as getAcademicYearsDomain,
  saveAcademicYear as saveAcademicYearDomain,
  activateAcademicYear as activateAcademicYearDomain,
  getAcademicTerms as getAcademicTermsDomain,
  saveAcademicTerm as saveAcademicTermDomain,
  deleteAcademicTerm as deleteAcademicTermDomain,
  getCalendarEvents as getCalendarEventsDomain,
  saveCalendarEvent as saveCalendarEventDomain,
  archiveCalendarEvent as archiveCalendarEventDomain,
} from "./actions/calendar.actions";

import {
  getBellSchedule as getBellScheduleDomain,
  saveBellSchedulePeriod as saveBellSchedulePeriodDomain,
  deleteBellSchedulePeriod as deleteBellSchedulePeriodDomain,
  getSectionTimetable as getSectionTimetableDomain,
  saveTimetablePeriod as saveTimetablePeriodDomain,
  deleteTimetablePeriod as deleteTimetablePeriodDomain,
  createSubstitution as createSubstitutionDomain,
  updateSubstitutionStatus as updateSubstitutionStatusDomain,
  saveTimetableSubstitution as saveTimetableSubstitutionDomain,
  getSubstitutionsForDate as getSubstitutionsForDateDomain,
  getPendingSubstitutions as getPendingSubstitutionsDomain,
  getPendingSubstitutionsCount as getPendingSubstitutionsCountDomain,
} from "./actions/timetable.actions";

import {
  getSyllabusUnits as getSyllabusUnitsDomain,
  saveSyllabusUnit as saveSyllabusUnitDomain,
  archiveSyllabusUnit as archiveSyllabusUnitDomain,
  restoreSyllabusUnit as restoreSyllabusUnitDomain,
  getSyllabusChapters as getSyllabusChaptersDomain,
  saveSyllabusChapter as saveSyllabusChapterDomain,
  archiveSyllabusChapter as archiveSyllabusChapterDomain,
  restoreSyllabusChapter as restoreSyllabusChapterDomain,
  getSyllabusTopics as getSyllabusTopicsDomain,
  saveSyllabusTopic as saveSyllabusTopicDomain,
  archiveSyllabusTopic as archiveSyllabusTopicDomain,
  restoreSyllabusTopic as restoreSyllabusTopicDomain,
} from "./actions/syllabus.actions";

import {
  getAssessments as getAssessmentsDomain,
  saveAssessment as saveAssessmentDomain,
  archiveAssessment as archiveAssessmentDomain,
} from "./actions/assessment.actions";

import {
  createClassSetup as createClassSetupDomain,
  getClassWithDetails as getClassWithDetailsDomain,
  getClassHubOverview as getClassHubOverviewDomain,
  getSectionSubjectTeachers as getSectionSubjectTeachersDomain,
  assignSectionTeacher as assignSectionTeacherDomain,
  deleteClass as deleteClassDomain,
} from "./actions/class-setup.actions";

import {
  getClassSyllabusProgress as getClassSyllabusProgressDomain,
  getSubjectSyllabusProgress as getSubjectSyllabusProgressDomain,
  getTeacherWorkloadReport as getTeacherWorkloadReportDomain,
  getAssignmentCompletionReport as getAssignmentCompletionReportDomain,
  getAcademicActivityReport as getAcademicActivityReportDomain,
  getClassSyllabusProgressReport as getClassSyllabusProgressReportDomain,
} from "./actions/reports.actions";

// Calendar
export async function getAcademicYears(...args: Parameters<typeof getAcademicYearsDomain>) {
  return getAcademicYearsDomain(...args);
}
export async function saveAcademicYear(...args: Parameters<typeof saveAcademicYearDomain>) {
  return saveAcademicYearDomain(...args);
}
export async function activateAcademicYear(...args: Parameters<typeof activateAcademicYearDomain>) {
  return activateAcademicYearDomain(...args);
}
export async function getAcademicTerms(...args: Parameters<typeof getAcademicTermsDomain>) {
  return getAcademicTermsDomain(...args);
}
export async function saveAcademicTerm(...args: Parameters<typeof saveAcademicTermDomain>) {
  return saveAcademicTermDomain(...args);
}
export async function deleteAcademicTerm(...args: Parameters<typeof deleteAcademicTermDomain>) {
  return deleteAcademicTermDomain(...args);
}
export async function getCalendarEvents(...args: Parameters<typeof getCalendarEventsDomain>) {
  return getCalendarEventsDomain(...args);
}
export async function saveCalendarEvent(...args: Parameters<typeof saveCalendarEventDomain>) {
  return saveCalendarEventDomain(...args);
}
export async function archiveCalendarEvent(...args: Parameters<typeof archiveCalendarEventDomain>) {
  return archiveCalendarEventDomain(...args);
}

// Timetable
export async function getBellSchedule(...args: Parameters<typeof getBellScheduleDomain>) {
  return getBellScheduleDomain(...args);
}
export async function saveBellSchedulePeriod(...args: Parameters<typeof saveBellSchedulePeriodDomain>) {
  return saveBellSchedulePeriodDomain(...args);
}
export async function deleteBellSchedulePeriod(...args: Parameters<typeof deleteBellSchedulePeriodDomain>) {
  return deleteBellSchedulePeriodDomain(...args);
}
export async function getSectionTimetable(...args: Parameters<typeof getSectionTimetableDomain>) {
  return getSectionTimetableDomain(...args);
}
export async function saveTimetablePeriod(...args: Parameters<typeof saveTimetablePeriodDomain>) {
  return saveTimetablePeriodDomain(...args);
}
export async function deleteTimetablePeriod(...args: Parameters<typeof deleteTimetablePeriodDomain>) {
  return deleteTimetablePeriodDomain(...args);
}
export async function createSubstitution(...args: Parameters<typeof createSubstitutionDomain>) {
  return createSubstitutionDomain(...args);
}
export async function updateSubstitutionStatus(...args: Parameters<typeof updateSubstitutionStatusDomain>) {
  return updateSubstitutionStatusDomain(...args);
}
export async function saveTimetableSubstitution(...args: Parameters<typeof saveTimetableSubstitutionDomain>) {
  return saveTimetableSubstitutionDomain(...args);
}
export async function getSubstitutionsForDate(...args: Parameters<typeof getSubstitutionsForDateDomain>) {
  return getSubstitutionsForDateDomain(...args);
}
export async function getPendingSubstitutions(...args: Parameters<typeof getPendingSubstitutionsDomain>) {
  return getPendingSubstitutionsDomain(...args);
}
export async function getPendingSubstitutionsCount(...args: Parameters<typeof getPendingSubstitutionsCountDomain>) {
  return getPendingSubstitutionsCountDomain(...args);
}

// Syllabus
export async function getSyllabusUnits(...args: Parameters<typeof getSyllabusUnitsDomain>) {
  return getSyllabusUnitsDomain(...args);
}
export async function saveSyllabusUnit(...args: Parameters<typeof saveSyllabusUnitDomain>) {
  return saveSyllabusUnitDomain(...args);
}
export async function archiveSyllabusUnit(...args: Parameters<typeof archiveSyllabusUnitDomain>) {
  return archiveSyllabusUnitDomain(...args);
}
export async function restoreSyllabusUnit(...args: Parameters<typeof restoreSyllabusUnitDomain>) {
  return restoreSyllabusUnitDomain(...args);
}
export async function getSyllabusChapters(...args: Parameters<typeof getSyllabusChaptersDomain>) {
  return getSyllabusChaptersDomain(...args);
}
export async function saveSyllabusChapter(...args: Parameters<typeof saveSyllabusChapterDomain>) {
  return saveSyllabusChapterDomain(...args);
}
export async function archiveSyllabusChapter(...args: Parameters<typeof archiveSyllabusChapterDomain>) {
  return archiveSyllabusChapterDomain(...args);
}
export async function restoreSyllabusChapter(...args: Parameters<typeof restoreSyllabusChapterDomain>) {
  return restoreSyllabusChapterDomain(...args);
}
export async function getSyllabusTopics(...args: Parameters<typeof getSyllabusTopicsDomain>) {
  return getSyllabusTopicsDomain(...args);
}
export async function saveSyllabusTopic(...args: Parameters<typeof saveSyllabusTopicDomain>) {
  return saveSyllabusTopicDomain(...args);
}
export async function archiveSyllabusTopic(...args: Parameters<typeof archiveSyllabusTopicDomain>) {
  return archiveSyllabusTopicDomain(...args);
}
export async function restoreSyllabusTopic(...args: Parameters<typeof restoreSyllabusTopicDomain>) {
  return restoreSyllabusTopicDomain(...args);
}

// Assessments
export async function getAssessments(...args: Parameters<typeof getAssessmentsDomain>) {
  return getAssessmentsDomain(...args);
}
export async function saveAssessment(...args: Parameters<typeof saveAssessmentDomain>) {
  return saveAssessmentDomain(...args);
}
export async function archiveAssessment(...args: Parameters<typeof archiveAssessmentDomain>) {
  return archiveAssessmentDomain(...args);
}

// Class Setup
export async function createClassSetup(...args: Parameters<typeof createClassSetupDomain>) {
  return createClassSetupDomain(...args);
}
export async function getClassWithDetails(...args: Parameters<typeof getClassWithDetailsDomain>) {
  return getClassWithDetailsDomain(...args);
}
export async function getClassHubOverview(...args: Parameters<typeof getClassHubOverviewDomain>) {
  return getClassHubOverviewDomain(...args);
}
export async function getSectionSubjectTeachers(...args: Parameters<typeof getSectionSubjectTeachersDomain>) {
  return getSectionSubjectTeachersDomain(...args);
}
export async function assignSectionTeacher(...args: Parameters<typeof assignSectionTeacherDomain>) {
  return assignSectionTeacherDomain(...args);
}
export async function deleteClass(...args: Parameters<typeof deleteClassDomain>) {
  return deleteClassDomain(...args);
}

// Reports
export async function getClassSyllabusProgress(...args: Parameters<typeof getClassSyllabusProgressDomain>) {
  return getClassSyllabusProgressDomain(...args);
}
export async function getSubjectSyllabusProgress(...args: Parameters<typeof getSubjectSyllabusProgressDomain>) {
  return getSubjectSyllabusProgressDomain(...args);
}
export async function getTeacherWorkloadReport(...args: Parameters<typeof getTeacherWorkloadReportDomain>) {
  return getTeacherWorkloadReportDomain(...args);
}
export async function getAssignmentCompletionReport(...args: Parameters<typeof getAssignmentCompletionReportDomain>) {
  return getAssignmentCompletionReportDomain(...args);
}
export async function getAcademicActivityReport(...args: Parameters<typeof getAcademicActivityReportDomain>) {
  return getAcademicActivityReportDomain(...args);
}
export async function getClassSyllabusProgressReport(...args: Parameters<typeof getClassSyllabusProgressReportDomain>) {
  return getClassSyllabusProgressReportDomain(...args);
}
