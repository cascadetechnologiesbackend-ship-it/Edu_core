"use server";

import { getCachedSession, requireAuth } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import {
  assignments,
  assignmentSubmissions,
  classSubjects,
  classes,
  sections,
  staff,
  users,
} from "@/db/schema";
import { and, eq, inArray, isNull, or, desc, asc } from "drizzle-orm";
import { resolveStudentScope } from "@/lib/studentEventEngine/scopeResolver";
import { scanContentForPII } from "@/lib/pii/scanEnforcement";
import { decryptData } from "@/../../backend/src/lib/encryption";

export interface StudentHomeworkItem {
  id: string;
  title: string;
  description: string | null;
  subjectName: string;
  className: string;
  sectionName: string;
  teacherName: string;
  dueDate: string;
  isPastDue: boolean;
  maxMarks: number | null;
  attachmentS3Key: string | null;
  status: string;
  isSubmitted: boolean;
  submission: {
    id: string;
    submittedAt: string | null;
    isLate: boolean;
    studentContent: string | null;
    attachmentS3Key: string | null;
    marksAwarded: number | null;
    remarks: string | null;
    gradedAt: string | null;
    isGraded: boolean;
  } | null;
}

export interface StudentHomeworkData {
  success: boolean;
  error?: string;
  disabled?: boolean;
  studentInfo?: {
    studentId: string;
    studentName: string;
    className: string;
    sectionName: string;
    rollNumber: string | null;
    admissionNumber: string;
  };
  pending: StudentHomeworkItem[];
  submitted: StudentHomeworkItem[];
  graded: StudentHomeworkItem[];
}

/**
 * 1. Fetch student homework grouped into Pending, Submitted, and Graded tabs.
 */
export async function getStudentHomeworkAction(
  previewStudentId?: string
): Promise<StudentHomeworkData> {
  const session = await getCachedSession();
  if (!session?.user) {
    return {
      success: false,
      error: "Authentication required",
      pending: [],
      submitted: [],
      graded: [],
    };
  }

  const schoolId = session.user.schoolId;
  if (!schoolId) {
    return {
      success: false,
      error: "School context missing",
      pending: [],
      submitted: [],
      graded: [],
    };
  }

  return await withTenant(schoolId, async (tx: any) => {
    const scope = await resolveStudentScope(session.user.id, {
      schoolId,
      role: session.user.role,
      ...(previewStudentId ? { studentId: previewStudentId } : {}),
      tx,
    });

    if (!scope) {
      return {
        success: false,
        error: "Student profile not found",
        pending: [],
        submitted: [],
        graded: [],
      };
    }

    if (scope.isAccountDisabled) {
      return {
        success: false,
        error: "Your student portal account is currently disabled by the school office.",
        disabled: true,
        pending: [],
        submitted: [],
        graded: [],
      };
    }

    // Class subjects eligible for the student
    const allClassSubjects = scope.classId
      ? await tx.query.classSubjects.findMany({
          where: and(
            eq(classSubjects.schoolId, schoolId),
            eq(classSubjects.classId, scope.classId)
          ),
          with: {
            subject: true,
          },
        })
      : [];

    const enrolledSet = new Set(scope.enrolledSubjectIds || []);
    const eligibleClassSubjects = allClassSubjects.filter((cs: any) => {
      if (cs.isElective) {
        return enrolledSet.has(cs.id);
      }
      return true;
    });

    const eligibleClassSubjectIds = eligibleClassSubjects.map((cs: any) => cs.id);
    const subjectNameMap = new Map<string, string>(
      eligibleClassSubjects.map((cs: any) => [
        cs.id,
        cs.subject?.name || "Academics",
      ])
    );

    if (eligibleClassSubjectIds.length === 0) {
      return {
        success: true,
        studentInfo: {
          studentId: scope.studentId,
          studentName: scope.studentName,
          className: scope.className,
          sectionName: scope.sectionName,
          rollNumber: scope.rollNumber,
          admissionNumber: scope.admissionNumber,
        },
        pending: [],
        submitted: [],
        graded: [],
      };
    }

    // Query assignments for student's section/class & enrolled subjects
    const rawAssignments = await tx.query.assignments.findMany({
      where: and(
        eq(assignments.schoolId, schoolId),
        inArray(assignments.classSubjectId, eligibleClassSubjectIds),
        scope.sectionId
          ? or(isNull(assignments.sectionId), eq(assignments.sectionId, scope.sectionId))
          : isNull(assignments.sectionId),
        inArray(assignments.status, ["PUBLISHED", "CLOSED", "GRADED"])
      ),
      orderBy: [desc(assignments.dueDate)],
    });

    // Submissions for this student
    const assignmentIds = rawAssignments.map((a: any) => a.id);
    const rawSubmissions =
      assignmentIds.length > 0
        ? await tx.query.assignmentSubmissions.findMany({
            where: and(
              eq(assignmentSubmissions.schoolId, schoolId),
              eq(assignmentSubmissions.studentId, scope.studentId),
              inArray(assignmentSubmissions.assignmentId, assignmentIds)
            ),
          })
        : [];

    const submissionMap = new Map<string, any>(
      rawSubmissions.map((s: any) => [s.assignmentId, s])
    );

    // Resolve teacher display names
    const teacherIds = Array.from(
      new Set(
        rawAssignments
          .map((a: any) => a.createdByTeacherId)
          .filter(Boolean) as string[]
      )
    );

    const teacherStaff =
      teacherIds.length > 0
        ? await tx.query.staff.findMany({
            where: and(
              eq(staff.schoolId, schoolId),
              inArray(staff.userId, teacherIds)
            ),
          })
        : [];

    const teacherNameMap = new Map<string, string>();
    for (const s of teacherStaff) {
      if (s.userId) {
        const fName = decryptData(s.firstNameEncrypted) || "";
        const lName = s.lastNameEncrypted
          ? decryptData(s.lastNameEncrypted) || ""
          : "";
        const fullName = `${fName} ${lName}`.trim();
        if (fullName) teacherNameMap.set(s.userId, fullName);
      }
    }

    const nowTime = Date.now();

    const allItems: StudentHomeworkItem[] = rawAssignments.map((a: any) => {
      const sub = submissionMap.get(a.id);
      const isPastDue = nowTime > new Date(a.dueDate).getTime();
      const subjectName = subjectNameMap.get(a.classSubjectId) || "Academics";
      const teacherName =
        teacherNameMap.get(a.createdByTeacherId) || "Subject Teacher";

      const isGraded = Boolean(
        sub && (sub.gradedAt || sub.marksAwarded !== null)
      );

      return {
        id: a.id,
        title: a.title,
        description: a.description || null,
        subjectName,
        className: scope.className,
        sectionName: scope.sectionName,
        teacherName,
        dueDate: a.dueDate instanceof Date ? a.dueDate.toISOString() : String(a.dueDate),
        isPastDue,
        maxMarks: a.maxMarks ?? null,
        attachmentS3Key: a.attachmentS3Key || null,
        status: a.status,
        isSubmitted: Boolean(sub),
        submission: sub
          ? {
              id: sub.id,
              submittedAt: sub.submittedAt
                ? sub.submittedAt instanceof Date
                  ? sub.submittedAt.toISOString()
                  : String(sub.submittedAt)
                : null,
              isLate: Boolean(sub.isLate),
              studentContent: sub.studentContent || null,
              attachmentS3Key: sub.attachmentS3Key || null,
              marksAwarded: sub.marksAwarded ?? null,
              remarks: sub.remarks || null,
              gradedAt: sub.gradedAt
                ? sub.gradedAt instanceof Date
                  ? sub.gradedAt.toISOString()
                  : String(sub.gradedAt)
                : null,
              isGraded,
            }
          : null,
      };
    });

    // Partition into 3 tabs
    // Pending: not submitted and status is PUBLISHED (or overdue published)
    const pending = allItems
      .filter((item) => !item.isSubmitted && item.status === "PUBLISHED")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    // Submitted: submitted but not graded yet (can resubmit)
    const submitted = allItems
      .filter((item) => item.isSubmitted && !item.submission?.isGraded)
      .sort((a, b) => {
        const tA = a.submission?.submittedAt ? new Date(a.submission.submittedAt).getTime() : 0;
        const tB = b.submission?.submittedAt ? new Date(b.submission.submittedAt).getTime() : 0;
        return tB - tA;
      });

    // Graded: submitted and graded
    const graded = allItems
      .filter((item) => item.isSubmitted && item.submission?.isGraded)
      .sort((a, b) => {
        const tA = a.submission?.gradedAt ? new Date(a.submission.gradedAt).getTime() : 0;
        const tB = b.submission?.gradedAt ? new Date(b.submission.gradedAt).getTime() : 0;
        return tB - tA;
      });

    return {
      success: true,
      studentInfo: {
        studentId: scope.studentId,
        studentName: scope.studentName,
        className: scope.className,
        sectionName: scope.sectionName,
        rollNumber: scope.rollNumber,
        admissionNumber: scope.admissionNumber,
      },
      pending,
      submitted,
      graded,
    };
  });
}

export interface SubmitHomeworkInput {
  assignmentId: string;
  studentContent?: string | undefined;
  attachmentS3Key?: string | undefined;
  previewStudentId?: string | undefined;
}

export interface SubmitHomeworkResult {
  success: boolean;
  error?: string | undefined;
  blocked?: boolean | undefined;
  detectedTypes?: string[] | undefined;
  isLate?: boolean | undefined;
  submittedAt?: string | undefined;
  resubmitted?: boolean | undefined;
  offlineQueued?: boolean | undefined;
}

/**
 * 2. Submit or resubmit homework with server-side isLate calculation & DPDP PII scan.
 */
export async function submitHomeworkAction(
  input: SubmitHomeworkInput
): Promise<SubmitHomeworkResult> {
  const session = await getCachedSession();
  if (!session?.user) {
    return { success: false, error: "Authentication required" };
  }

  const schoolId = session.user.schoolId;
  if (!schoolId) {
    return { success: false, error: "School context missing" };
  }

  const trimmedContent = (input.studentContent || "").trim();
  const attachmentKey = (input.attachmentS3Key || "").trim();

  if (!trimmedContent && !attachmentKey) {
    return {
      success: false,
      error: "Please enter your answer text or attach a file before submitting.",
    };
  }

  return await withTenant(schoolId, async (tx: any) => {
    const scope = await resolveStudentScope(session.user.id, {
      schoolId,
      role: session.user.role,
      ...(input.previewStudentId ? { studentId: input.previewStudentId } : {}),
      tx,
    });

    if (!scope) {
      return { success: false, error: "Student scope not found" };
    }

    if (scope.isAccountDisabled) {
      return {
        success: false,
        error: "Your student account is suspended. You cannot submit homework.",
      };
    }

    // Verify assignment exists and is eligible
    const assignment = await tx.query.assignments.findFirst({
      where: and(
        eq(assignments.id, input.assignmentId),
        eq(assignments.schoolId, schoolId)
      ),
    });

    if (!assignment) {
      return { success: false, error: "Assignment not found." };
    }

    if (assignment.status !== "PUBLISHED") {
      return {
        success: false,
        error: "This assignment is closed and no longer accepting submissions.",
      };
    }

    // Section verification: sectionId must match or be null (class-wide)
    if (assignment.sectionId && assignment.sectionId !== scope.sectionId) {
      return {
        success: false,
        error: "You are not enrolled in the section for this assignment.",
      };
    }

    // DPDP Act 2023: Scan submission text for PII (BR6, AC-8)
    let finalContent: string | null = trimmedContent || null;
    if (trimmedContent) {
      const piiCheck = await scanContentForPII({
        schoolId,
        actorUserId: session.user.id,
        surface: "student.homework.submit",
        sourceTable: "assignment_submissions",
        sourceId: input.assignmentId,
        text: trimmedContent,
      });

      if (piiCheck.decision === "BLOCKED") {
        return {
          success: false,
          blocked: true,
          error: `Submission blocked: Your text contains sensitive personal information (${piiCheck.detectedTypes.join(
            ", "
          )}). Please remove personal numbers/details before submitting.`,
          detectedTypes: piiCheck.detectedTypes,
        };
      }

      if (piiCheck.decision === "MASKED" && piiCheck.redactedText) {
        finalContent = piiCheck.redactedText;
      }
    }

    // Server-side isLate calculation (BR4)
    const now = new Date();
    const isLate = now.getTime() > new Date(assignment.dueDate).getTime();

    // Check existing submission (unique per assignment + student)
    const existingSub = await tx.query.assignmentSubmissions.findFirst({
      where: and(
        eq(assignmentSubmissions.schoolId, schoolId),
        eq(assignmentSubmissions.assignmentId, input.assignmentId),
        eq(assignmentSubmissions.studentId, scope.studentId)
      ),
    });

    if (existingSub) {
      // If already graded, resubmission is prohibited
      if (existingSub.gradedAt || existingSub.marksAwarded !== null) {
        return {
          success: false,
          error: "Cannot resubmit: Your submission has already been graded by the teacher.",
        };
      }

      // Update existing submission row
      await tx
        .update(assignmentSubmissions)
        .set({
          studentContent: finalContent,
          attachmentS3Key: attachmentKey || existingSub.attachmentS3Key,
          submittedAt: now,
          isLate,
          updatedAt: now,
        })
        .where(
          and(
            eq(assignmentSubmissions.id, existingSub.id),
            eq(assignmentSubmissions.schoolId, schoolId)
          )
        );

      return {
        success: true,
        resubmitted: true,
        isLate,
        submittedAt: now.toISOString(),
      };
    }

    // Insert new submission row
    await tx.insert(assignmentSubmissions).values({
      schoolId,
      assignmentId: input.assignmentId,
      studentId: scope.studentId,
      studentContent: finalContent,
      attachmentS3Key: attachmentKey || null,
      submittedAt: now,
      isLate,
    });

    return {
      success: true,
      resubmitted: false,
      isLate,
      submittedAt: now.toISOString(),
    };
  });
}
