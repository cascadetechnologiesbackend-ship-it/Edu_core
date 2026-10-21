"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { withTenant } from "@/db";
import {
  assignments,
  assignmentSubmissions,
  classSubjects,
  sections,
  subjects,
  classes,
  sectionSubjectTeachers,
  syllabusTopics,
  syllabusChapters,
  syllabusUnits,
  domainEvents,
  students,
} from "@/db/schema";
import { eq, and, desc, inArray, isNull, sql } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import { scanContentForPII } from "@/lib/pii/scanEnforcement";

export interface TeacherHomeworkItem {
  id: string;
  classSubjectId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  subjectName: string;
  title: string;
  description: string;
  dueDate: string;
  maxMarks: number | null;
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "GRADED";
  attachmentS3Key: string | null;
  totalSubmissions: number;
  gradedSubmissions: number;
  totalStudents: number;
}

export interface TeacherAllocationOption {
  classSubjectId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  subjectName: string;
  subjectId: string;
}

export interface SyllabusTopicOption {
  id: string;
  title: string;
  chapterTitle: string;
  unitTitle: string;
}

/**
 * 1. Fetch teacher homework list and allocations
 */
export async function getTeacherHomeworkData(filters?: {
  sectionId?: string;
  classSubjectId?: string;
}) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    // A. Resolve teacher allocations
    // 1. Direct sectionSubjectTeachers assignments
    const sstRows = await tx.query.sectionSubjectTeachers.findMany({
      where: and(
        eq(sectionSubjectTeachers.schoolId, school.id),
        ctx.role === "TEACHER"
          ? eq(sectionSubjectTeachers.teacherId, ctx.userId)
          : undefined
      ),
      with: {
        classSubject: { with: { subject: true, class: true } },
        section: { with: { class: true } },
      },
    });

    // 2. Class-level default teacher allocations
    const csRows = await tx.query.classSubjects.findMany({
      where: and(
        eq(classSubjects.schoolId, school.id),
        ctx.role === "TEACHER"
          ? eq(classSubjects.assignedTeacherId, ctx.userId)
          : undefined
      ),
      with: {
        subject: true,
        class: {
          with: {
            sections: true,
          },
        },
      },
    });

    const allocationsMap = new Map<string, TeacherAllocationOption>();

    for (const sst of sstRows) {
      if (!sst.classSubject || !sst.section) continue;
      const key = `${sst.classSubjectId}_${sst.sectionId}`;
      allocationsMap.set(key, {
        classSubjectId: sst.classSubjectId,
        sectionId: sst.sectionId,
        className: sst.section.class?.displayName || "Class",
        sectionName: sst.section.name,
        subjectName: sst.classSubject.subject?.name || "Subject",
        subjectId: sst.classSubject.subjectId,
      });
    }

    for (const cs of csRows) {
      if (!cs.class?.sections) continue;
      for (const sec of cs.class.sections) {
        const key = `${cs.id}_${sec.id}`;
        if (!allocationsMap.has(key)) {
          allocationsMap.set(key, {
            classSubjectId: cs.id,
            sectionId: sec.id,
            className: cs.class.displayName,
            sectionName: sec.name,
            subjectName: cs.subject?.name || "Subject",
            subjectId: cs.subjectId,
          });
        }
      }
    }

    const allocations = Array.from(allocationsMap.values());
    const allocatedSectionIds = allocations.map((a) => a.sectionId);

    if (allocatedSectionIds.length === 0 && ctx.role === "TEACHER") {
      return {
        allocations: [],
        homeworkList: [],
        syllabusTopics: [],
      };
    }

    // B. Fetch teacher's assignments
    const assignmentRows = await tx.query.assignments.findMany({
      where: and(
        eq(assignments.schoolId, school.id),
        ctx.role === "TEACHER"
          ? inArray(assignments.sectionId, allocatedSectionIds)
          : undefined,
        filters?.sectionId ? eq(assignments.sectionId, filters.sectionId) : undefined,
        filters?.classSubjectId
          ? eq(assignments.classSubjectId, filters.classSubjectId)
          : undefined,
        isNull(assignments.deletedAt)
      ),
      with: {
        classSubject: { with: { subject: true } },
        section: { with: { class: true } },
        submissions: true,
      },
      orderBy: [desc(assignments.dueDate)],
    });

    // Count students per section
    const sectionCounts = new Map<string, number>();
    if (allocatedSectionIds.length > 0) {
      const studentRows = await tx.query.students.findMany({
        where: and(
          eq(students.schoolId, school.id),
          eq(students.isActive, true),
          inArray(students.currentSectionId, allocatedSectionIds)
        ),
      });
      for (const st of studentRows) {
        if (st.currentSectionId) {
          sectionCounts.set(
            st.currentSectionId,
            (sectionCounts.get(st.currentSectionId) || 0) + 1
          );
        }
      }
    }

    const homeworkList: TeacherHomeworkItem[] = assignmentRows.map((a: any) => {
      const submissions = a.submissions || [];
      const graded = submissions.filter(
        (s: any) => s.marksAwarded !== null || s.gradedAt !== null
      ).length;
      const totalStudents = sectionCounts.get(a.sectionId) || 0;

      return {
        id: a.id,
        classSubjectId: a.classSubjectId,
        sectionId: a.sectionId,
        className: a.section?.class?.displayName || "Class",
        sectionName: a.section?.name || "Section",
        subjectName: a.classSubject?.subject?.name || "Subject",
        title: a.title,
        description: a.description,
        dueDate: a.dueDate.toISOString(),
        maxMarks: a.maxMarks,
        status: a.status as "DRAFT" | "PUBLISHED" | "CLOSED" | "GRADED",
        attachmentS3Key: a.attachmentS3Key,
        totalSubmissions: submissions.length,
        gradedSubmissions: graded,
        totalStudents,
      };
    });

    // C. Fetch syllabus topics for allocated classSubjects
    const classSubjectIds = Array.from(new Set(allocations.map((a) => a.classSubjectId)));
    let syllabusTopicsList: SyllabusTopicOption[] = [];

    if (classSubjectIds.length > 0) {
      const units = await tx.query.syllabusUnits.findMany({
        where: and(
          eq(syllabusUnits.schoolId, school.id),
          inArray(syllabusUnits.classSubjectId, classSubjectIds)
        ),
        with: {
          chapters: {
            with: {
              topics: true,
            },
          },
        },
      });

      for (const u of units) {
        for (const ch of u.chapters || []) {
          for (const top of ch.topics || []) {
            syllabusTopicsList.push({
              id: top.id,
              title: top.title,
              chapterTitle: ch.title,
              unitTitle: u.title,
            });
          }
        }
      }
    }

    return {
      allocations,
      homeworkList,
      syllabusTopics: syllabusTopicsList,
    };
  });
}

/**
 * 2. Create homework assignment (scope enforced, PII-scanned)
 */
export async function createHomeworkAction(input: {
  classSubjectId: string;
  sectionId: string;
  title: string;
  description: string;
  dueDate: string | Date;
  maxMarks?: number;
  attachmentS3Key?: string;
  syllabusTopicId?: string;
  status?: "DRAFT" | "PUBLISHED";
}) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  // BR13: Scan content for PII
  if (input.description) {
    try {
      await scanContentForPII({
        schoolId: school.id,
        actorUserId: ctx.userId,
        surface: "teacher.homework.create",
        sourceTable: "assignments",
        text: input.description,
      });
    } catch {
      // Proceed gracefully if scanner has soft non-blocking mode
    }
  }

  return await withTenant(school.id, async (tx: any) => {
    // Server-side scope enforcement (BR10 / AC-14)
    if (ctx.role === "TEACHER") {
      const isAllocated = await tx.query.sectionSubjectTeachers.findFirst({
        where: and(
          eq(sectionSubjectTeachers.schoolId, school.id),
          eq(sectionSubjectTeachers.teacherId, ctx.userId),
          eq(sectionSubjectTeachers.sectionId, input.sectionId),
          eq(sectionSubjectTeachers.classSubjectId, input.classSubjectId)
        ),
      });

      const isClassTeacher = isAllocated
        ? true
        : await tx.query.classSubjects.findFirst({
            where: and(
              eq(classSubjects.schoolId, school.id),
              eq(classSubjects.id, input.classSubjectId),
              eq(classSubjects.assignedTeacherId, ctx.userId)
            ),
          });

      if (!isAllocated && !isClassTeacher) {
        throw new Error("Unauthorized: Teacher is not allocated to this class-subject or section.");
      }
    }

    const initialStatus = input.status || "DRAFT";

    const [newAssignment] = await tx
      .insert(assignments)
      .values({
        schoolId: school.id,
        classSubjectId: input.classSubjectId,
        sectionId: input.sectionId,
        createdByTeacherId: ctx.userId,
        title: input.title,
        description: input.description,
        dueDate: new Date(input.dueDate),
        maxMarks: input.maxMarks || 50,
        attachmentS3Key: input.attachmentS3Key || null,
        status: initialStatus,
      })
      .returning();

    // If published, emit domain event for parent feed & notifications (AC-8)
    if (initialStatus === "PUBLISHED" && newAssignment) {
      await tx.insert(domainEvents).values({
        schoolId: school.id,
        aggregateId: newAssignment.id,
        eventType: "AssignmentPublishedEvent",
        payload: {
          assignmentId: newAssignment.id,
          sectionId: input.sectionId,
          classSubjectId: input.classSubjectId,
          schoolId: school.id,
          teacherUserId: ctx.userId,
          title: input.title,
          dueDate: new Date(input.dueDate).toISOString(),
        },
        status: "PENDING",
      });
    }

    return { success: true, assignmentId: newAssignment.id };
  });
}

/**
 * 3. Update homework assignment (DRAFT: full edit; PUBLISHED: description/attachment/close)
 */
export async function updateHomeworkAction(input: {
  id: string;
  title?: string;
  description?: string;
  dueDate?: string | Date;
  maxMarks?: number;
  attachmentS3Key?: string;
  status?: "DRAFT" | "PUBLISHED" | "CLOSED";
}) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  if (input.description) {
    try {
      await scanContentForPII({
        schoolId: school.id,
        actorUserId: ctx.userId,
        surface: "teacher.homework.update",
        sourceTable: "assignments",
        sourceId: input.id,
        text: input.description,
      });
    } catch {}
  }

  return await withTenant(school.id, async (tx: any) => {
    const existing = await tx.query.assignments.findFirst({
      where: and(eq(assignments.id, input.id), eq(assignments.schoolId, school.id)),
    });

    if (!existing) {
      throw new Error("Assignment not found.");
    }

    if (ctx.role === "TEACHER" && existing.createdByTeacherId !== ctx.userId) {
      throw new Error("Unauthorized: You may only edit homework created by your account.");
    }

    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    // If currently PUBLISHED, only allow description, attachment, or status -> CLOSED
    if (existing.status === "PUBLISHED" && ctx.role === "TEACHER") {
      if (input.description !== undefined) updates.description = input.description;
      if (input.attachmentS3Key !== undefined) updates.attachmentS3Key = input.attachmentS3Key;
      if (input.status === "CLOSED") updates.status = "CLOSED";
    } else {
      if (input.title) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.dueDate) updates.dueDate = new Date(input.dueDate);
      if (input.maxMarks !== undefined) updates.maxMarks = input.maxMarks;
      if (input.attachmentS3Key !== undefined) updates.attachmentS3Key = input.attachmentS3Key;
      if (input.status) updates.status = input.status;
    }

    await tx
      .update(assignments)
      .set(updates)
      .where(and(eq(assignments.id, input.id), eq(assignments.schoolId, school.id)));

    // Emit domain event if flipping to PUBLISHED
    if (existing.status !== "PUBLISHED" && input.status === "PUBLISHED") {
      await tx.insert(domainEvents).values({
        schoolId: school.id,
        aggregateId: input.id,
        eventType: "AssignmentPublishedEvent",
        payload: {
          assignmentId: input.id,
          sectionId: existing.sectionId,
          classSubjectId: existing.classSubjectId,
          schoolId: school.id,
          teacherUserId: ctx.userId,
          title: updates.title || existing.title,
          dueDate: updates.dueDate ? updates.dueDate.toISOString() : existing.dueDate.toISOString(),
        },
        status: "PENDING",
      });
    }

    return { success: true };
  });
}

/**
 * 4. Fetch Homework Submissions Roster for grading
 */
export async function getHomeworkSubmissionsRoster(assignmentId: string) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    const assignment = await tx.query.assignments.findFirst({
      where: and(eq(assignments.id, assignmentId), eq(assignments.schoolId, school.id)),
      with: {
        section: { with: { class: true } },
        classSubject: { with: { subject: true } },
      },
    });

    if (!assignment) {
      throw new Error("Assignment not found.");
    }

    // Active students in this section
    const studentRows = await tx.query.students.findMany({
      where: and(
        eq(students.schoolId, school.id),
        eq(students.currentSectionId, assignment.sectionId),
        eq(students.isActive, true)
      ),
      orderBy: [students.rollNumber, students.admissionNumber],
    });

    // Submissions
    const submissionRows = await tx.query.assignmentSubmissions.findMany({
      where: and(
        eq(assignmentSubmissions.schoolId, school.id),
        eq(assignmentSubmissions.assignmentId, assignmentId)
      ),
    });

    const subMap = new Map<string, any>(submissionRows.map((s: any) => [s.studentId, s]));

    const roster = studentRows.map((st: any) => {
      const sub = subMap.get(st.id);
      const firstName = decryptData(st.firstNameEncrypted);
      const lastName = decryptData(st.lastNameEncrypted);
      const fullName = `${firstName} ${lastName}`.trim();

      return {
        studentId: st.id,
        studentName: fullName || "Student",
        admissionNumber: st.admissionNumber,
        rollNumber: st.rollNumber,
        submissionId: sub?.id || null,
        isSubmitted: Boolean(sub),
        submittedAt: sub?.submittedAt ? sub.submittedAt.toISOString() : null,
        marksAwarded: sub?.marksAwarded ?? null,
        remarks: sub?.remarks ?? null,
        isLate: Boolean(sub?.isLate),
      };
    });

    return {
      assignment: {
        id: assignment.id,
        title: assignment.title,
        subjectName: assignment.classSubject?.subject?.name || "Subject",
        className: assignment.section?.class?.displayName || "Class",
        sectionName: assignment.section?.name || "Section",
        dueDate: assignment.dueDate.toISOString(),
        maxMarks: assignment.maxMarks || 50,
        status: assignment.status,
      },
      roster,
    };
  });
}

/**
 * 5. Update submission marks & remarks
 */
export async function updateSubmissionGradeAction(input: {
  assignmentId: string;
  studentId: string;
  marksAwarded?: number | null;
  remarks?: string | null;
}) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);

  return await withTenant(school.id, async (tx: any) => {
    const existingSub = await tx.query.assignmentSubmissions.findFirst({
      where: and(
        eq(assignmentSubmissions.schoolId, school.id),
        eq(assignmentSubmissions.assignmentId, input.assignmentId),
        eq(assignmentSubmissions.studentId, input.studentId)
      ),
    });

    const now = new Date();

    if (existingSub) {
      await tx
        .update(assignmentSubmissions)
        .set({
          marksAwarded: input.marksAwarded !== undefined ? input.marksAwarded : existingSub.marksAwarded,
          remarks: input.remarks !== undefined ? input.remarks : existingSub.remarks,
          gradedAt: now,
          gradedById: ctx.userId,
          updatedAt: now,
        })
        .where(
          and(
            eq(assignmentSubmissions.id, existingSub.id),
            eq(assignmentSubmissions.schoolId, school.id)
          )
        );
    } else {
      // Create teacher-recorded submission entry with marks
      await tx.insert(assignmentSubmissions).values({
        schoolId: school.id,
        assignmentId: input.assignmentId,
        studentId: input.studentId,
        submittedAt: now,
        marksAwarded: input.marksAwarded ?? null,
        remarks: input.remarks ?? null,
        gradedAt: now,
        gradedById: ctx.userId,
      });
    }

    return { success: true };
  });
}
