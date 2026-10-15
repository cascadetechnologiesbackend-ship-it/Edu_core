import { Metadata } from "next";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db } from "@/db";
import {
  exams,
  classSubjects,
  sectionSubjectTeachers,
  classes,
  sections,
  subjects,
  students,
  markEntries,
  examMarksLocks,
} from "@/db/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import TeacherGradingClient from "./TeacherGradingClient";

export const metadata: Metadata = {
  title: "Gradebook & Marks Entry | Educator PWA",
  description: "Record scholastic marks for assigned subjects and classes.",
};

export default async function TeacherGradingPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ examId?: string; classId?: string; subjectId?: string }>
    | { examId?: string; classId?: string; subjectId?: string };
}) {
  const resolvedParams =
    searchParams instanceof Promise ? await searchParams : searchParams || {};

  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);
  const schoolId = school.id;
  const userId = ctx.userId;

  // 1. Fetch active exams
  const examList = await db.query.exams.findMany({
    where: and(eq(exams.schoolId, schoolId), isNull(exams.deletedAt)),
    orderBy: [exams.startDate],
  });

  // 2. Query Teacher's Assigned Class-Subjects
  const assignedClassSubjects = await db.query.classSubjects.findMany({
    where: and(
      eq(classSubjects.schoolId, schoolId),
      eq(classSubjects.assignedTeacherId, userId),
    ),
    with: {
      class: true,
      subject: true,
    },
  });

  // 3. Query Section-Subject Overrides
  const sectionSubjectAllocations = await db.query.sectionSubjectTeachers.findMany({
    where: and(
      eq(sectionSubjectTeachers.schoolId, schoolId),
      eq(sectionSubjectTeachers.teacherId, userId),
      eq(sectionSubjectTeachers.isActive, true),
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

  // Format allocations list
  const allocations: Array<{
    classId: string;
    className: string;
    sectionId?: string;
    sectionName?: string;
    subjectId: string;
    subjectName: string;
    maxMarks: number;
  }> = [];

  assignedClassSubjects.forEach((cs) => {
    if (cs.class && cs.subject) {
      allocations.push({
        classId: cs.class.id,
        className: cs.class.displayName,
        subjectId: cs.subject.id,
        subjectName: cs.subject.name,
        maxMarks: cs.subject.maxMarks || 100,
      });
    }
  });

  sectionSubjectAllocations.forEach((ssa) => {
    if (ssa.section?.class && ssa.classSubject?.subject) {
      allocations.push({
        classId: ssa.section.class.id,
        className: `${ssa.section.class.displayName} (${ssa.section.name})`,
        sectionId: ssa.section.id,
        sectionName: ssa.section.name,
        subjectId: ssa.classSubject.subject.id,
        subjectName: ssa.classSubject.subject.name,
        maxMarks: ssa.classSubject.subject.maxMarks || 100,
      });
    }
  });

  // 4. Fetch locks for teacher's school
  const allLocks = await db.query.examMarksLocks.findMany({
    where: and(
      eq(examMarksLocks.schoolId, schoolId),
      eq(examMarksLocks.status, "LOCKED"),
    ),
  });

  const locksMap: Record<string, boolean> = {};
  for (const l of allLocks) {
    locksMap[`${l.examId}-${l.classId}-${l.subjectId}`] = true;
  }

  // Determine target allocation index from searchParams
  let targetAllocIndex = 0;
  if (resolvedParams.classId && resolvedParams.subjectId) {
    const idx = allocations.findIndex(
      (a) =>
        a.classId === resolvedParams.classId &&
        a.subjectId === resolvedParams.subjectId,
    );
    if (idx !== -1) targetAllocIndex = idx;
  } else if (resolvedParams.subjectId) {
    const idx = allocations.findIndex(
      (a) => a.subjectId === resolvedParams.subjectId,
    );
    if (idx !== -1) targetAllocIndex = idx;
  }

  // Determine target exam from searchParams
  let targetExamId = examList[0]?.id || "";
  if (resolvedParams.examId) {
    const matchedExam = examList.find((e) => e.id === resolvedParams.examId);
    if (matchedExam) targetExamId = matchedExam.id;
  }

  // 5. Fetch students and existing marks for target allocation if available
  let initialStudents: any[] = [];
  if (allocations.length > 0 && allocations[targetAllocIndex]) {
    const targetAlloc = allocations[targetAllocIndex]!;
    const enrolled = await db.query.students.findMany({
      where: and(
        eq(students.schoolId, schoolId),
        eq(students.currentClassId, targetAlloc.classId),
        eq(students.isActive, true),
      ),
      orderBy: [students.admissionNumber],
    });

    const existingMarks = targetExamId
      ? await db.query.markEntries.findMany({
          where: and(
            eq(markEntries.schoolId, schoolId),
            eq(markEntries.examId, targetExamId),
            eq(markEntries.subjectId, targetAlloc.subjectId),
          ),
        })
      : [];

    const marksLookup = new Map(existingMarks.map((m) => [m.studentId, m]));

    initialStudents = enrolled.map((st) => {
      const entry = marksLookup.get(st.id);
      return {
        studentId: st.id,
        name: `${decryptData(st.firstNameEncrypted)} ${decryptData(st.lastNameEncrypted)}`.trim(),
        admissionNumber: st.admissionNumber,
        rollNumber: st.rollNumber,
        marks:
          entry?.marksObtained !== null && entry?.marksObtained !== undefined
            ? entry.marksObtained
            : "",
        isAbsent: entry?.isAbsent || false,
      };
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
          Scholastic Marks &amp; Gradebook
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Enter and submit evaluation scores for your allocated subjects.
        </p>
      </div>

      <TeacherGradingClient
        exams={examList.map((e) => ({ id: e.id, name: e.name }))}
        allocations={allocations}
        initialExamId={targetExamId}
        initialAllocIndex={targetAllocIndex}
        initialStudents={initialStudents}
        locksMap={locksMap}
      />
    </div>
  );
}
