"use server";

import { db } from "@/db";
import {
  classes,
  sections,
  subjects,
  classSubjects,
  timetablePeriods,
  assignments,
  assignmentSubmissions,
  lessonPlans,
  academicYears,
  users,
} from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/auditLogger";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

async function getAuditContext(session: any) {
  const reqHeaders = headers();
  const ip = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = reqHeaders.get("user-agent") ?? "unknown";
  return {
    db,
    session,
    ip,
    userAgent,
  };
}

// Ensure caller is authorized
async function checkAuth(allowedRoles?: string[]) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.schoolId) {
    throw new Error("Unauthorized");
  }
  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    throw new Error("Access Denied: Insufficient Permissions");
  }
  return session;
}

// ─── 1. Classrooms & Sections Actions ──────────────────────────────────────────

export async function getClassrooms() {
  await checkAuth();
  return await db.query.classes.findMany({
    where: eq(classes.isActive, true),
    orderBy: [classes.sortOrder],
    with: {
      sections: {
        where: eq(sections.isActive, true),
      },
    },
  });
}

export async function getTeachersList() {
  await checkAuth();
  // Fetch users that are teachers
  return await db.query.users.findMany({
    where: eq(users.isActive, true),
    orderBy: [users.email],
  });
}

export async function saveClassroom(data: { id?: string; gradeLevel: any; displayName: string; sortOrder: number }) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const activeYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isActive, true),
  });
  if (!activeYear) throw new Error("No active academic year");

  if (data.id) {
    await db
      .update(classes)
      .set({
        gradeLevel: data.gradeLevel,
        displayName: data.displayName,
        sortOrder: data.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(classes.id, data.id));
  } else {
    await db.insert(classes).values({
      schoolId: session.user.schoolId!,
      academicYearId: activeYear.id,
      gradeLevel: data.gradeLevel,
      displayName: data.displayName,
      sortOrder: data.sortOrder,
    });
  }
  revalidatePath("/academics");
  return { success: true };
}

export async function saveSection(data: { id?: string; classId: string; name: string; capacity: number; classTeacherId?: string | null; roomNumber?: string | null }) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);

  const classTeacherIdVal = data.classTeacherId || null;
  const roomNumberVal = data.roomNumber || null;

  if (data.id) {
    await db
      .update(sections)
      .set({
        name: data.name,
        capacity: data.capacity,
        ...(classTeacherIdVal !== undefined ? { classTeacherId: classTeacherIdVal } : {}),
        ...(roomNumberVal !== undefined ? { roomNumber: roomNumberVal } : {}),
        updatedAt: new Date(),
      })
      .where(eq(sections.id, data.id));
  } else {
    await db.insert(sections).values({
      schoolId: session.user.schoolId!,
      classId: data.classId,
      name: data.name,
      capacity: data.capacity,
      ...(classTeacherIdVal ? { classTeacherId: classTeacherIdVal } : {}),
      ...(roomNumberVal ? { roomNumber: roomNumberVal } : {}),
    });
  }
  revalidatePath("/academics");
  return { success: true };
}

// ─── 2. Subject Master Actions ────────────────────────────────────────────────

export async function getSubjects() {
  await checkAuth();
  return await db.query.subjects.findMany({
    where: eq(subjects.isActive, true),
    orderBy: [subjects.name],
  });
}

export async function saveSubject(data: { id?: string; code: string; name: string; nameHindi?: string | null; subjectType: "THEORY" | "PRACTICAL" | "CO_SCHOLASTIC" | "LANGUAGE" | "ACTIVITY"; maxMarks?: number; passingMarks?: number }) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const maxMarksVal = data.maxMarks ?? 100;
  const passingMarksVal = data.passingMarks ?? 33;
  const nameHindiVal = data.nameHindi || null;

  if (data.id) {
    await db
      .update(subjects)
      .set({
        code: data.code,
        name: data.name,
        ...(nameHindiVal !== undefined ? { nameHindi: nameHindiVal } : {}),
        subjectType: data.subjectType,
        maxMarks: maxMarksVal,
        passingMarks: passingMarksVal,
        updatedAt: new Date(),
      })
      .where(eq(subjects.id, data.id));
  } else {
    await db.insert(subjects).values({
      schoolId: session.user.schoolId!,
      code: data.code,
      name: data.name,
      ...(nameHindiVal ? { nameHindi: nameHindiVal } : {}),
      subjectType: data.subjectType,
      maxMarks: maxMarksVal,
      passingMarks: passingMarksVal,
    });
  }
  revalidatePath("/academics");
  return { success: true };
}

// ─── 3. Class Subjects Mapping Actions ────────────────────────────────────────

export async function getClassSubjectsList() {
  await checkAuth();
  return await db.query.classSubjects.findMany({
    with: {
      class: true,
      subject: true,
    },
  });
}

export async function saveClassSubject(data: { id?: string; classId: string; subjectId: string; assignedTeacherId?: string | null; periodsPerWeek?: number; isElective?: boolean }) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const assignedTeacherIdVal = data.assignedTeacherId || null;
  const periodsPerWeekVal = data.periodsPerWeek ?? 5;
  const isElectiveVal = data.isElective ?? false;

  if (data.id) {
    await db
      .update(classSubjects)
      .set({
        ...(assignedTeacherIdVal !== undefined ? { assignedTeacherId: assignedTeacherIdVal } : {}),
        periodsPerWeek: periodsPerWeekVal,
        isElective: isElectiveVal,
        updatedAt: new Date(),
      })
      .where(eq(classSubjects.id, data.id));
  } else {
    await db.insert(classSubjects).values({
      schoolId: session.user.schoolId!,
      classId: data.classId,
      subjectId: data.subjectId,
      ...(assignedTeacherIdVal ? { assignedTeacherId: assignedTeacherIdVal } : {}),
      periodsPerWeek: periodsPerWeekVal,
      isElective: isElectiveVal,
    });
  }
  revalidatePath("/academics");
  return { success: true };
}

// ─── 4. Timetable Period Actions ──────────────────────────────────────────────

export async function getSectionTimetable(sectionId: string) {
  await checkAuth();
  return await db.query.timetablePeriods.findMany({
    where: and(
      eq(timetablePeriods.sectionId, sectionId),
      eq(timetablePeriods.isActive, true)
    ),
    with: {
      subject: true,
    },
  });
}

export async function saveTimetablePeriod(data: {
  id?: string;
  sectionId: string;
  dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";
  periodNumber: number;
  startTime: string;
  endTime: string;
  periodType: "REGULAR" | "ASSEMBLY" | "BREAK" | "LUNCH" | "LAB" | "PT" | "LIBRARY" | "FREE";
  subjectId?: string | null;
  teacherId?: string | null;
  roomNumber?: string | null;
}) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const activeYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isActive, true),
  });
  if (!activeYear) throw new Error("No active academic year");

  const subjectIdVal = data.subjectId || null;
  const teacherIdVal = data.teacherId || null;
  const roomNumberVal = data.roomNumber || null;

  // Enforce Teacher double-booking check
  if (data.teacherId) {
    const conflict = await db.query.timetablePeriods.findFirst({
      where: and(
        eq(timetablePeriods.isActive, true),
        eq(timetablePeriods.academicYearId, activeYear.id),
        eq(timetablePeriods.dayOfWeek, data.dayOfWeek),
        eq(timetablePeriods.periodNumber, data.periodNumber),
        eq(timetablePeriods.teacherId, data.teacherId)
      ),
    });
    if (conflict && (!data.id || conflict.id !== data.id)) {
      throw new Error(`Conflict: Teacher is already booked for Period ${data.periodNumber} on ${data.dayOfWeek}.`);
    }
  }

  if (data.id) {
    await db
      .update(timetablePeriods)
      .set({
        startTime: data.startTime,
        endTime: data.endTime,
        periodType: data.periodType,
        ...(subjectIdVal !== undefined ? { subjectId: subjectIdVal } : {}),
        ...(teacherIdVal !== undefined ? { teacherId: teacherIdVal } : {}),
        ...(roomNumberVal !== undefined ? { roomNumber: roomNumberVal } : {}),
        updatedAt: new Date(),
      })
      .where(eq(timetablePeriods.id, data.id));
  } else {
    await db.insert(timetablePeriods).values({
      schoolId: session.user.schoolId!,
      academicYearId: activeYear.id,
      sectionId: data.sectionId,
      dayOfWeek: data.dayOfWeek,
      periodNumber: data.periodNumber,
      startTime: data.startTime,
      endTime: data.endTime,
      periodType: data.periodType,
      ...(subjectIdVal ? { subjectId: subjectIdVal } : {}),
      ...(teacherIdVal ? { teacherId: teacherIdVal } : {}),
      ...(roomNumberVal ? { roomNumber: roomNumberVal } : {}),
    });
  }
  revalidatePath("/academics");
  return { success: true };
}

// ─── 5. Assignment Actions ────────────────────────────────────────────────────

export async function getAssignments(sectionId: string, classSubjectId: string) {
  const session = await checkAuth();
  const userRole = session.user.role;
  const userId = session.user.id;

  // Strict check: Teachers can only view assignments for their subject
  if (userRole === "TEACHER") {
    const mapping = await db.query.classSubjects.findFirst({
      where: and(
        eq(classSubjects.id, classSubjectId),
        eq(classSubjects.assignedTeacherId, userId)
      ),
    });
    if (!mapping) throw new Error("Access Denied: You do not teach this subject mapping.");
  }

  return await db.query.assignments.findMany({
    where: and(
      eq(assignments.sectionId, sectionId),
      eq(assignments.classSubjectId, classSubjectId)
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
  const session = await checkAuth(["TEACHER", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
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
        ...(attachmentS3KeyVal !== undefined ? { attachmentS3Key: attachmentS3KeyVal } : {}),
        status: data.status,
        updatedAt: new Date(),
      })
      .where(eq(assignments.id, data.id));
  } else {
    await db.insert(assignments).values({
      schoolId: session.user.schoolId!,
      classSubjectId: data.classSubjectId,
      sectionId: data.sectionId,
      createdByTeacherId: session.user.id,
      title: data.title,
      description: data.description,
      maxMarks: maxMarksVal,
      dueDate: new Date(data.dueDate),
      ...(attachmentS3KeyVal ? { attachmentS3Key: attachmentS3KeyVal } : {}),
      status: data.status,
    });
  }
  revalidatePath("/academics");
  return { success: true };
}

export async function getAssignmentSubmissions(assignmentId: string) {
  await checkAuth();
  return await db.query.assignmentSubmissions.findMany({
    where: eq(assignmentSubmissions.assignmentId, assignmentId),
    orderBy: [assignmentSubmissions.submittedAt],
  });
}

export async function gradeSubmission(data: { submissionId: string; marksAwarded: number; remarks?: string | null }) {
  const session = await checkAuth(["TEACHER", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const remarksVal = data.remarks || null;

  // Grade update
  const [updated] = await db
    .update(assignmentSubmissions)
    .set({
      marksAwarded: data.marksAwarded,
      ...(remarksVal !== undefined ? { remarks: remarksVal } : {}),
      gradedByTeacherId: session.user.id,
      gradedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(assignmentSubmissions.id, data.submissionId))
    .returning();

  if (!updated) throw new Error("Submission not found");

  const auditCtx = await getAuditContext(session);
  // DPDP Logging: Grading touched a student's academic marks records (PII write)
  await logAuditEvent(auditCtx as any, {
    action: "WRITE",
    tableName: "assignment_submissions",
    recordId: data.submissionId,
    purposeId: "academic_records",
    schoolId: session.user.schoolId!,
    metadata: { studentId: updated.studentId, marksAwarded: data.marksAwarded },
  });

  return { success: true };
}

export async function submitAssignment(data: { assignmentId: string; studentId: string; attachmentS3Key?: string | null; remarks?: string | null }) {
  // Allow students or parents (on behalf of children) to submit
  const session = await checkAuth(["STUDENT", "PARENT", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const attachmentS3KeyVal = data.attachmentS3Key || null;
  const remarksVal = data.remarks || null;

  const [newSub] = await db
    .insert(assignmentSubmissions)
    .values({
      assignmentId: data.assignmentId,
      studentId: data.studentId,
      schoolId: session.user.schoolId!,
      ...(attachmentS3KeyVal ? { attachmentS3Key: attachmentS3KeyVal } : {}),
      ...(remarksVal ? { remarks: remarksVal } : {}),
    })
    .returning();

  const auditCtx = await getAuditContext(session);
  // DPDP Logging: Submission uploaded (PII write)
  await logAuditEvent(auditCtx as any, {
    action: "WRITE",
    tableName: "assignment_submissions",
    recordId: newSub?.id || "",
    purposeId: "academic_records",
    schoolId: session.user.schoolId!,
    metadata: { studentId: data.studentId },
  });

  return { success: true };
}

// ─── 6. Lesson Plan Actions ───────────────────────────────────────────────────

export async function getLessonPlans(classSubjectId: string) {
  await checkAuth();
  return await db.query.lessonPlans({
    where: eq(lessonPlans.classSubjectId, classSubjectId),
    orderBy: [lessonPlans.plannedDate],
  } as any); // cast since query types match relations
}

export async function saveLessonPlan(data: {
  id?: string;
  classSubjectId: string;
  title: string;
  chapterName: string;
  ncertReference?: string | null;
  objectives?: string | null;
  plannedDate?: string | null;
  completedDate?: string | null;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
}) {
  const session = await checkAuth(["TEACHER", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  
  const ncertReferenceVal = data.ncertReference || null;
  const objectivesVal = data.objectives || null;
  const plannedDateVal = data.plannedDate ? new Date(data.plannedDate) : null;
  const completedDateVal = data.completedDate ? new Date(data.completedDate) : null;

  if (data.id) {
    await db
      .update(lessonPlans)
      .set({
        title: data.title,
        chapterName: data.chapterName,
        ...(ncertReferenceVal !== undefined ? { ncertReference: ncertReferenceVal } : {}),
        ...(objectivesVal !== undefined ? { objectives: objectivesVal } : {}),
        ...(plannedDateVal !== undefined ? { plannedDate: plannedDateVal } : {}),
        ...(completedDateVal !== undefined ? { completedDate: completedDateVal } : {}),
        status: data.status,
        updatedAt: new Date(),
      })
      .where(eq(lessonPlans.id, data.id));
  } else {
    await db.insert(lessonPlans).values({
      schoolId: session.user.schoolId!,
      classSubjectId: data.classSubjectId,
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
  revalidatePath("/academics");
  return { success: true };
}
