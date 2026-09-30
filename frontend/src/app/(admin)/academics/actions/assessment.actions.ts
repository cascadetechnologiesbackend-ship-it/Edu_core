"use server";

import { db } from "@/db";
import { assessments } from "@/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { checkAuth, verifyTeacherAccessToClassSubject } from "./auth-helper";

export async function getAssessments(
  classSubjectId: string,
  sectionId?: string,
) {
  const session = await checkAuth();
  await verifyTeacherAccessToClassSubject(session, classSubjectId, sectionId);

  return await db.query.assessments.findMany({
    where: and(
      eq(assessments.schoolId, session.user.schoolId),
      eq(assessments.classSubjectId, classSubjectId),
      sectionId ? eq(assessments.sectionId, sectionId) : undefined,
      isNull(assessments.deletedAt),
    ),
    with: {
      createdByTeacher: { columns: { id: true, email: true } },
      section: { columns: { id: true, name: true } },
      term: { columns: { id: true, name: true } },
    },
    orderBy: [desc(assessments.date)],
  });
}

export async function saveAssessment(data: {
  id?: string;
  classSubjectId: string;
  sectionId?: string | null;
  termId?: string | null;
  title: string;
  assessmentType:
    | "UNIT_TEST"
    | "MIDTERM"
    | "FINAL"
    | "QUIZ"
    | "PRACTICAL"
    | "PROJECT"
    | "FA"
    | "SA";
  date?: string | null;
  maxMarks?: number;
  syllabusCoverage?: string | null;
  status: "DRAFT" | "SCHEDULED" | "ONGOING" | "COMPLETED" | "CANCELLED";
}) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"]);
  await verifyTeacherAccessToClassSubject(
    session,
    data.classSubjectId,
    data.sectionId || undefined,
  );

  const sectionIdVal = data.sectionId || null;
  const termIdVal = data.termId || null;
  const dateVal = data.date || null;
  const syllabusCoverageVal = data.syllabusCoverage || null;
  const maxMarksVal = data.maxMarks ?? 100;

  if (data.id) {
    await db
      .update(assessments)
      .set({
        sectionId: sectionIdVal,
        termId: termIdVal,
        title: data.title,
        assessmentType: data.assessmentType,
        date: dateVal,
        maxMarks: maxMarksVal,
        syllabusCoverage: syllabusCoverageVal,
        status: data.status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(assessments.id, data.id),
          eq(assessments.schoolId, session.user.schoolId),
        ),
      );
  } else {
    await db.insert(assessments).values({
      schoolId: session.user.schoolId,
      classSubjectId: data.classSubjectId,
      sectionId: sectionIdVal,
      termId: termIdVal,
      title: data.title,
      assessmentType: data.assessmentType,
      date: dateVal,
      maxMarks: maxMarksVal,
      syllabusCoverage: syllabusCoverageVal,
      status: data.status,
      createdByTeacherId: session.user.id,
    });
  }

  revalidatePath("/academics");
  return { success: true };
}

export async function archiveAssessment(id: string) {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"]);

  const existing = await db.query.assessments.findFirst({
    where: and(
      eq(assessments.id, id),
      eq(assessments.schoolId, session.user.schoolId),
    ),
  });
  if (!existing) throw new Error("Assessment not found");

  await verifyTeacherAccessToClassSubject(
    session,
    existing.classSubjectId,
    existing.sectionId || undefined,
  );

  await db
    .update(assessments)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(assessments.id, id),
        eq(assessments.schoolId, session.user.schoolId),
      ),
    );

  revalidatePath("/academics");
  return { success: true };
}
