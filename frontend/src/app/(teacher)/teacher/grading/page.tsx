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
} from "@/db/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import TeacherGradingClient from "./TeacherGradingClient";

export const metadata: Metadata = {
  title: "Gradebook & Marks Entry | Educator PWA",
  description: "Record scholastic marks for assigned subjects and classes.",
};

export default async function TeacherGradingPage() {
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
      eq(classSubjects.assignedTeacherId, userId)
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

  // 4. Fetch students for first allocation if available
  let initialStudents: any[] = [];
  if (allocations.length > 0 && allocations[0]) {
    const firstAlloc = allocations[0];
    const enrolled = await db.query.students.findMany({
      where: and(
        eq(students.schoolId, schoolId),
        eq(students.currentClassId, firstAlloc.classId),
        eq(students.isActive, true)
      ),
      orderBy: [students.admissionNumber],
    });

    initialStudents = enrolled.map((st) => ({
      studentId: st.id,
      name: `${decryptData(st.firstNameEncrypted)} ${decryptData(st.lastNameEncrypted)}`.trim(),
      admissionNumber: st.admissionNumber,
      rollNumber: st.rollNumber,
      marks: "",
      isAbsent: false,
    }));
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
        initialStudents={initialStudents}
      />
    </div>
  );
}
