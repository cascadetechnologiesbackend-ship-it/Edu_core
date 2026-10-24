"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import {
  assignments,
  assignmentSubmissions,
  students,
  classes,
  sections,
  subjects,
  classSubjects,
  sectionSubjectTeachers,
  exams,
  examMarksLocks,
  markEntries,
  domainEvents,
  userPushSubscriptions,
  pushNotificationLogs,
} from "@/db/schema";
import { eq, and, sql, isNull, inArray, desc } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import {
  assertTeacherCanGradeAssignment,
  resolveTeacherScope,
} from "@/lib/teacherEventEngine/scopeResolver";
import {
  assertSubjectTeacherPermission,
  assertStudentRosterMembership,
  TeacherScopeError,
} from "@/lib/teacherAuthGuards";
import { revalidatePath } from "next/cache";

export interface TeacherAssignmentItem {
  id: string;
  title: string;
  description: string;
  className: string;
  sectionName: string;
  subjectName: string;
  maxMarks: number;
  dueDate: string;
  status: string;
  plagiarismCheckEnabled: boolean;
  totalSubmissions: number;
  gradedCount: number;
  ungradedCount: number;
  lateCount: number;
  plagiarismCount: number;
}

export interface StudentSubmissionItem {
  submissionId: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  rollNumber: string | null;
  marksAwarded: number | null;
  remarks: string | null;
  isLate: boolean;
  plagiarismFlagged: boolean;
  submittedAt: string;
  maxMarks: number;
}

export interface ExamAllocationItem {
  classId: string;
  className: string;
  sectionId?: string;
  sectionName?: string;
  subjectId: string;
  subjectName: string;
  maxMarks: number;
}

export interface ExamOptionItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
}

export interface StudentExamMarkItem {
  studentId: string;
  name: string;
  admissionNumber: string;
  rollNumber: string | null;
  marksObtained: number | null;
  isAbsent: boolean;
  remarks?: string | null;
}

/**
 * 1. Fetch teacher assignments for grading queue
 */
export async function getTeacherGradingAssignments(): Promise<TeacherAssignmentItem[]> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    const scope = await resolveTeacherScope(ctx.userId, { tx, schoolId: school.id });

    // Find assignments authored by teacher or in teacher's assigned sections
    const rows = await tx.query.assignments.findMany({
      where: and(
        eq(assignments.schoolId, school.id),
        isNull(assignments.deletedAt),
        sql`(${assignments.createdByTeacherId} = ${ctx.userId} OR ${assignments.sectionId} IN (${
          scope.allSectionIds.length > 0
            ? sql.join(scope.allSectionIds.map((id) => sql`${id}`), sql`, `)
            : sql`'00000000-0000-0000-0000-000000000000'`
        }))`
      ),
      orderBy: [desc(assignments.dueDate)],
      with: {
        section: {
          with: {
            class: true,
          },
        },
        classSubject: {
          with: {
            subject: true,
          },
        },
        submissions: true,
      },
    });

    return rows.map((a: any) => {
      const submissions = a.submissions || [];
      const totalSubmissions = submissions.length;
      let gradedCount = 0;
      let lateCount = 0;
      let plagiarismCount = 0;

      for (const s of submissions) {
        if (s.marksAwarded !== null && s.marksAwarded !== undefined) {
          gradedCount++;
        }
        if (s.isLate) lateCount++;
        if (s.plagiarismFlagged) plagiarismCount++;
      }

      return {
        id: a.id,
        title: a.title,
        description: a.description || "",
        className: a.section?.class?.displayName || a.section?.class?.name || "Class",
        sectionName: a.section?.name || "Section",
        subjectName: a.classSubject?.subject?.name || "Subject",
        maxMarks: a.maxMarks || 100,
        dueDate: a.dueDate.toISOString(),
        status: a.status,
        plagiarismCheckEnabled: a.plagiarismCheckEnabled,
        totalSubmissions,
        gradedCount,
        ungradedCount: Math.max(0, totalSubmissions - gradedCount),
        lateCount,
        plagiarismCount,
      };
    });
  });
}

/**
 * 2. Fetch submissions for an assignment for the keyboard-first grading queue
 */
export async function getAssignmentSubmissionsForGrading(
  assignmentId: string
): Promise<{
  assignment: TeacherAssignmentItem;
  submissions: StudentSubmissionItem[];
}> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    // RLS Scope Assert Guard (AC-T2)
    const { assignment } = await assertTeacherCanGradeAssignment(ctx.userId, assignmentId, {
      tx,
      schoolId: school.id,
    });

    // Query section & subject metadata
    const sectionRow = await tx.query.sections.findFirst({
      where: eq(sections.id, assignment.sectionId),
      with: { class: true },
    });
    const classSubjectRow = await tx.query.classSubjects.findFirst({
      where: eq(classSubjects.id, assignment.classSubjectId),
      with: { subject: true },
    });

    // Query submissions
    const subs = await tx.query.assignmentSubmissions.findMany({
      where: and(
        eq(assignmentSubmissions.schoolId, school.id),
        eq(assignmentSubmissions.assignmentId, assignmentId)
      ),
      orderBy: [assignmentSubmissions.submittedAt],
    });

    // If no submissions exist yet, query enrolled students to populate roster
    const studentIds = subs.map((s: any) => s.studentId);
    let enrolledStudents: any[] = [];
    if (studentIds.length > 0) {
      enrolledStudents = await tx.query.students.findMany({
        where: and(
          eq(students.schoolId, school.id),
          inArray(students.id, studentIds)
        ),
      });
    } else {
      enrolledStudents = await tx.query.students.findMany({
        where: and(
          eq(students.schoolId, school.id),
          eq(students.currentSectionId, assignment.sectionId),
          eq(students.isActive, true)
        ),
        orderBy: [students.admissionNumber],
      });
    }

    const studentMap = new Map(enrolledStudents.map((st) => [st.id, st]));

    const submissionItems: StudentSubmissionItem[] = [];

    if (subs.length > 0) {
      for (const s of subs) {
        const st = studentMap.get(s.studentId);
        const firstName = st ? decryptData(st.firstNameEncrypted) : "Student";
        const lastName = st ? decryptData(st.lastNameEncrypted) : "";
        submissionItems.push({
          submissionId: s.id,
          studentId: s.studentId,
          studentName: `${firstName} ${lastName}`.trim(),
          admissionNumber: st?.admissionNumber || "",
          rollNumber: st?.rollNumber || null,
          marksAwarded: s.marksAwarded,
          remarks: s.remarks,
          isLate: s.isLate,
          plagiarismFlagged: s.plagiarismFlagged,
          submittedAt: s.submittedAt ? s.submittedAt.toISOString() : new Date().toISOString(),
          maxMarks: assignment.maxMarks || 100,
        });
      }
    } else {
      // Create draft rows for enrolled students
      for (const st of enrolledStudents) {
        const firstName = decryptData(st.firstNameEncrypted);
        const lastName = decryptData(st.lastNameEncrypted);
        submissionItems.push({
          submissionId: `temp-${st.id}`,
          studentId: st.id,
          studentName: `${firstName} ${lastName}`.trim(),
          admissionNumber: st.admissionNumber,
          rollNumber: st.rollNumber,
          marksAwarded: null,
          remarks: null,
          isLate: false,
          plagiarismFlagged: false,
          submittedAt: new Date().toISOString(),
          maxMarks: assignment.maxMarks || 100,
        });
      }
    }

    const gradedCount = submissionItems.filter((s) => s.marksAwarded !== null).length;
    const assignmentItem: TeacherAssignmentItem = {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description || "",
      className: sectionRow?.class?.displayName || "Class",
      sectionName: sectionRow?.name || "Section",
      subjectName: classSubjectRow?.subject?.name || "Subject",
      maxMarks: assignment.maxMarks || 100,
      dueDate: assignment.dueDate.toISOString(),
      status: assignment.status,
      plagiarismCheckEnabled: assignment.plagiarismCheckEnabled,
      totalSubmissions: submissionItems.length,
      gradedCount,
      ungradedCount: Math.max(0, submissionItems.length - gradedCount),
      lateCount: submissionItems.filter((s) => s.isLate).length,
      plagiarismCount: submissionItems.filter((s) => s.plagiarismFlagged).length,
    };

    return {
      assignment: assignmentItem,
      submissions: submissionItems,
    };
  });
}

/**
 * 3. Batch save assignment grades (Keyboard-flow submission + parent T2 domain event emission AC-T7)
 */
export async function saveAssignmentGrades(
  assignmentId: string,
  grades: Array<{
    submissionId: string;
    studentId: string;
    marksAwarded: number | null;
    remarks?: string | undefined;
  }>
): Promise<{ success: boolean; savedCount: number; message: string }> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    // 1. Scope and ownership assertion (AC-T2)
    const { assignment } = await assertTeacherCanGradeAssignment(ctx.userId, assignmentId, {
      tx,
      schoolId: school.id,
    });

    const maxMarks = assignment.maxMarks || 100;
    let savedCount = 0;

    for (const g of grades) {
      if (g.marksAwarded !== null && g.marksAwarded !== undefined) {
        if (g.marksAwarded < 0 || g.marksAwarded > maxMarks) {
          throw new Error(
            `Mark ${g.marksAwarded} exceeds maximum allowed marks of ${maxMarks}`
          );
        }
      }

      // Check if submission exists
      const existingSub = await tx.query.assignmentSubmissions.findFirst({
        where: and(
          eq(assignmentSubmissions.schoolId, school.id),
          eq(assignmentSubmissions.assignmentId, assignmentId),
          eq(assignmentSubmissions.studentId, g.studentId)
        ),
      });

      if (existingSub) {
        await tx
          .update(assignmentSubmissions)
          .set({
            marksAwarded: g.marksAwarded,
            remarks: g.remarks ?? existingSub.remarks,
            gradedByTeacherId: ctx.userId,
            gradedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(assignmentSubmissions.id, existingSub.id));
      } else {
        await tx.insert(assignmentSubmissions).values({
          schoolId: school.id,
          assignmentId,
          studentId: g.studentId,
          marksAwarded: g.marksAwarded,
          remarks: g.remarks ?? null,
          gradedByTeacherId: ctx.userId,
          gradedAt: new Date(),
          submittedAt: new Date(),
        });
      }
      savedCount++;
    }

    // Check if all submissions are now graded
    const allSubs = await tx.query.assignmentSubmissions.findMany({
      where: and(
        eq(assignmentSubmissions.schoolId, school.id),
        eq(assignmentSubmissions.assignmentId, assignmentId)
      ),
    });

    const allGraded =
      allSubs.length > 0 &&
      allSubs.every((s: any) => s.marksAwarded !== null && s.marksAwarded !== undefined);

    if (allGraded && assignment.status !== "GRADED") {
      await tx
        .update(assignments)
        .set({ status: "GRADED", updatedAt: new Date() })
        .where(eq(assignments.id, assignmentId));
    }

    // 2. Emit Domain Event: HomeworkGradedEvent for cross-role parent PWA consumption (AC-T7)
    await tx.insert(domainEvents).values({
      schoolId: school.id,
      aggregateId: assignmentId,
      eventType: "HomeworkGradedEvent",
      payload: {
        assignmentId,
        assignmentTitle: assignment.title,
        gradedByTeacherId: ctx.userId,
        gradedCount: savedCount,
        allGraded,
        studentGrades: grades.map((g) => ({
          studentId: g.studentId,
          marksAwarded: g.marksAwarded,
        })),
        gradedAt: new Date().toISOString(),
      },
      status: "PENDING",
    });

    revalidatePath("/teacher/grading");
    revalidatePath("/teacher/dashboard");

    return {
      success: true,
      savedCount,
      message: `${savedCount} submission(s) graded successfully.`,
    };
  });
}

/**
 * 4. Fetch exams and allocated subjects for scholastic marks entry
 */
export async function getTeacherExamsAndAllocations(): Promise<{
  exams: ExamOptionItem[];
  allocations: ExamAllocationItem[];
  locksMap: Record<string, boolean>;
}> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    // 1. Active Exams
    const examRows = await tx.query.exams.findMany({
      where: and(eq(exams.schoolId, school.id), isNull(exams.deletedAt)),
      orderBy: [desc(exams.startDate)],
    });

    // 2. Teacher Scope & Class-Subject Allocations
    const assignedClassSubjects = await tx.query.classSubjects.findMany({
      where: and(
        eq(classSubjects.schoolId, school.id),
        eq(classSubjects.assignedTeacherId, ctx.userId)
      ),
      with: {
        class: true,
        subject: true,
      },
    });

    const sectionSubjectAllocations = await tx.query.sectionSubjectTeachers.findMany({
      where: and(
        eq(sectionSubjectTeachers.schoolId, school.id),
        eq(sectionSubjectTeachers.teacherId, ctx.userId),
        eq(sectionSubjectTeachers.isActive, true)
      ),
      with: {
        section: {
          with: {
            class: true,
          },
        },
        classSubject: {
          with: {
            subject: true,
          },
        },
      },
    });

    const allocations: ExamAllocationItem[] = [];

    assignedClassSubjects.forEach((cs: any) => {
      if (cs.class && cs.subject) {
        allocations.push({
          classId: cs.class.id,
          className: cs.class.displayName || cs.class.name,
          subjectId: cs.subject.id,
          subjectName: cs.subject.name,
          maxMarks: cs.subject.maxMarks || 100,
        });
      }
    });

    sectionSubjectAllocations.forEach((ssa: any) => {
      if (ssa.section?.class && ssa.classSubject?.subject) {
        allocations.push({
          classId: ssa.section.class.id,
          className: `${ssa.section.class.displayName || ssa.section.class.name} (${ssa.section.name})`,
          sectionId: ssa.section.id,
          sectionName: ssa.section.name,
          subjectId: ssa.classSubject.subject.id,
          subjectName: ssa.classSubject.subject.name,
          maxMarks: ssa.classSubject.subject.maxMarks || 100,
        });
      }
    });

    // 3. Locks Map
    const allLocks = await tx.query.examMarksLocks.findMany({
      where: and(
        eq(examMarksLocks.schoolId, school.id),
        eq(examMarksLocks.status, "LOCKED")
      ),
    });

    const locksMap: Record<string, boolean> = {};
    for (const l of allLocks) {
      locksMap[`${l.examId}-${l.classId}-${l.subjectId}`] = true;
    }

    return {
      exams: examRows.map((e: any) => ({
        id: e.id,
        name: e.name,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        isLocked: e.isLocked,
      })),
      allocations,
      locksMap,
    };
  });
}

/**
 * 5. Fetch student roster with marks for selected exam allocation
 */
export async function getExamMarksRoster(
  examId: string,
  classId: string,
  subjectId: string,
  sectionId?: string
): Promise<{
  students: StudentExamMarkItem[];
  isLocked: boolean;
  lockReason?: string;
  maxMarks: number;
}> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    // 0. Permission Guard (S16-F01)
    if (sectionId) {
      const scope = await resolveTeacherScope(ctx.userId, { schoolId: school.id, tx });
      const isClassTeacher = scope.classTeacherSections.includes(sectionId);
      const isAllocatedSubjectTeacher = scope.teachingSections.some(
        (ts) => ts.sectionId === sectionId && ts.subjectId === subjectId
      );
      const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role as string);

      if (!isAdmin && !isClassTeacher && !isAllocatedSubjectTeacher) {
        throw new TeacherScopeError(
          `Teacher is not authorized to view marks roster for section ${sectionId} subject ${subjectId}`,
          403,
          "SUBJECT_TEACHER_FORBIDDEN"
        );
      }
    }

    // 1. Check lock state (AC-T6)
    const lock = await tx.query.examMarksLocks.findFirst({
      where: and(
        eq(examMarksLocks.schoolId, school.id),
        eq(examMarksLocks.examId, examId),
        eq(examMarksLocks.classId, classId),
        eq(examMarksLocks.subjectId, subjectId),
        eq(examMarksLocks.status, "LOCKED")
      ),
    });

    const exam = await tx.query.exams.findFirst({
      where: and(eq(exams.schoolId, school.id), eq(exams.id, examId)),
    });

    const isLocked = !!lock || (exam ? exam.isLocked : false);
    const lockReason = lock?.reason || (exam?.isLocked ? "Exam lifecycle finalized by Administration." : undefined);

    // 2. Query Subject Max Marks
    const subj = await tx.query.subjects.findFirst({
      where: and(eq(subjects.schoolId, school.id), eq(subjects.id, subjectId)),
    });
    const maxMarks = subj?.maxMarks || 100;

    // 3. Query Students in Class / Section
    const studentFilter = [
      eq(students.schoolId, school.id),
      eq(students.currentClassId, classId),
      eq(students.isActive, true),
    ];
    if (sectionId) {
      studentFilter.push(eq(students.currentSectionId, sectionId));
    }

    const enrolledStudents = await tx.query.students.findMany({
      where: and(...studentFilter),
      orderBy: [students.admissionNumber],
    });

    // 4. Query Existing Mark Entries
    const existingMarks = await tx.query.markEntries.findMany({
      where: and(
        eq(markEntries.schoolId, school.id),
        eq(markEntries.examId, examId),
        eq(markEntries.subjectId, subjectId)
      ),
    });

    const marksLookup = new Map<string, any>(existingMarks.map((m: any) => [m.studentId, m]));

    const roster = enrolledStudents.map((st: any) => {
      const entry: any = marksLookup.get(st.id);
      const marksVal =
        entry?.marksObtained !== null && entry?.marksObtained !== undefined
          ? Number(entry.marksObtained)
          : null;

      return {
        studentId: st.id,
        name: `${decryptData(st.firstNameEncrypted)} ${decryptData(st.lastNameEncrypted)}`.trim(),
        admissionNumber: st.admissionNumber,
        rollNumber: st.rollNumber,
        marksObtained: marksVal,
        isAbsent: entry?.isAbsent || false,
        remarks: entry?.remarks || null,
      };
    });

    return {
      students: roster,
      isLocked,
      lockReason,
      maxMarks,
    };
  });
}

/**
 * 6. Save Scholastic Examination Marks (Respects lock windows, allocation guards, and maxMarks AC-T6 / S16)
 */
export async function saveExamMarks(payload: {
  examId: string;
  classId: string;
  subjectId: string;
  sectionId?: string | undefined;
  entries: Array<{
    studentId: string;
    marksObtained: number | null;
    isAbsent: boolean;
    remarks?: string | undefined;
  }>;
}): Promise<{ success: boolean; count: number; message: string }> {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  if (!payload.sectionId) {
    throw new Error("Section ID is required to record exam marks.");
  }

  // 1. Allocation Guard (Condition A & S16-F01)
  await assertSubjectTeacherPermission(ctx.userId, payload.sectionId, payload.subjectId, {
    schoolId: school.id,
    role: ctx.role,
  });

  return await withTenant(school.id, async (tx: any) => {
    // 2. Anti-Tamper & IDOR Membership Check (S16-F02)
    // Aborts entire transaction if any studentId is outside payload.sectionId
    await assertStudentRosterMembership(
      payload.entries.map((e) => e.studentId),
      payload.sectionId!,
      school.id,
      tx
    );

    // 3. Strict Window Lock Check (AC-T6 & 423 code)
    const lock = await tx.query.examMarksLocks.findFirst({
      where: and(
        eq(examMarksLocks.schoolId, school.id),
        eq(examMarksLocks.examId, payload.examId),
        eq(examMarksLocks.classId, payload.classId),
        eq(examMarksLocks.subjectId, payload.subjectId),
        eq(examMarksLocks.status, "LOCKED")
      ),
    });

    if (lock) {
      throw new TeacherScopeError(
        `Cannot save marks: This examination window was locked on ${lock.lockedAt?.toLocaleDateString()}.`,
        423,
        "MARKS_WINDOW_LOCKED"
      );
    }

    const exam = await tx.query.exams.findFirst({
      where: and(eq(exams.schoolId, school.id), eq(exams.id, payload.examId)),
    });

    if (exam?.isLocked) {
      throw new TeacherScopeError(
        "Cannot save marks: Examination cycle has been finalized by Administration.",
        423,
        "MARKS_WINDOW_LOCKED"
      );
    }

    // 2. Validate maxMarks per row
    const subj = await tx.query.subjects.findFirst({
      where: and(eq(subjects.schoolId, school.id), eq(subjects.id, payload.subjectId)),
    });
    const maxMarks = subj?.maxMarks || 100;

    for (const entry of payload.entries) {
      if (entry.marksObtained !== null && entry.marksObtained !== undefined) {
        if (entry.marksObtained < 0 || entry.marksObtained > maxMarks) {
          throw new Error(
            `Mark ${entry.marksObtained} exceeds max allowable marks of ${maxMarks}`
          );
        }
      }
    }

    // 3. Upsert entries into markEntries table
    for (const entry of payload.entries) {
      const existing = await tx.query.markEntries.findFirst({
        where: and(
          eq(markEntries.schoolId, school.id),
          eq(markEntries.examId, payload.examId),
          eq(markEntries.subjectId, payload.subjectId),
          eq(markEntries.studentId, entry.studentId)
        ),
      });

      const marksNumeric =
        entry.isAbsent || entry.marksObtained === null
          ? null
          : entry.marksObtained.toString();

      if (existing) {
        await tx
          .update(markEntries)
          .set({
            marksObtained: marksNumeric,
            isAbsent: entry.isAbsent,
            remarks: entry.remarks || existing.remarks,
            enteredById: ctx.userId,
            updatedAt: new Date(),
          })
          .where(eq(markEntries.id, existing.id));
      } else {
        await tx.insert(markEntries).values({
          schoolId: school.id,
          examId: payload.examId,
          subjectId: payload.subjectId,
          studentId: entry.studentId,
          marksObtained: marksNumeric,
          isAbsent: entry.isAbsent,
          remarks: entry.remarks || null,
          enteredById: ctx.userId,
        });
      }
    }

    // 4. Emit ExamMarksRecordedEvent
    await tx.insert(domainEvents).values({
      schoolId: school.id,
      aggregateId: `${payload.examId}:${payload.subjectId}`,
      eventType: "ExamMarksRecordedEvent",
      payload: {
        examId: payload.examId,
        subjectId: payload.subjectId,
        classId: payload.classId,
        sectionId: payload.sectionId,
        enteredByUserId: ctx.userId,
        entriesCount: payload.entries.length,
        recordedAt: new Date().toISOString(),
      },
      status: "PENDING",
    });

    revalidatePath("/teacher/grading");
    revalidatePath("/teacher/dashboard");

    return {
      success: true,
      count: payload.entries.length,
      message: `Marks recorded for ${payload.entries.length} students.`,
    };
  });
}
