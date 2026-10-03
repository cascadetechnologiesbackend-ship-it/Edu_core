import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  classSubjects,
  sections,
  assignments,
  assessments,
} from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { verifyTeacherAccessToClassSubject } from "../../../../actions/auth-helper";
import { getSyllabusUnits } from "../../../../actions/syllabus.actions";
import { getSectionSubjectTeachers } from "../../../../actions/class-setup.actions";
import { getSubjectSyllabusProgress } from "../../../../actions/reports.actions";
import { getLessonPlans, getTeachersList } from "../../../../actions";
import SubjectWorkspaceClient from "./SubjectWorkspaceClient";
import { cache } from "react";

// Cached per-request: generateMetadata + page body share one auth() call and one DB query
const getAuthSession = cache(async () => auth());

const getClassSubjectCached = cache(async (classSubjectId: string, schoolId: string) => {
  return db.query.classSubjects.findFirst({
    where: and(
      eq(classSubjects.id, classSubjectId),
      eq(classSubjects.schoolId, schoolId),
    ),
    with: {
      subject: true,
      class: {
        with: {
          sections: {
            where: eq(sections.isActive, true),
            orderBy: [asc(sections.name)],
          },
        },
      },
      teacher: { columns: { id: true, email: true } },
    },
  });
});

export async function generateMetadata({
  params,
}: {
  params: { classId: string; classSubjectId: string };
}): Promise<Metadata> {
  const session = await getAuthSession();
  if (!session?.user?.schoolId) return { title: "Subject Workspace" };

  const cs = await getClassSubjectCached(params.classSubjectId, session.user.schoolId);

  return {
    title: cs
      ? `${cs.subject.name} (${cs.class.displayName}) — Subject Workspace`
      : "Subject Workspace",
  };
}

export default async function SubjectWorkspacePage({
  params,
}: {
  params: { classId: string; classSubjectId: string };
}) {
  const session = await getAuthSession();
  if (!session?.user?.id || !session?.user?.schoolId) {
    redirect("/login");
  }

  const schoolId = session.user.schoolId;
  const role = session.user.role;
  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(role);
  const isTeacher = role === "TEACHER";

  // Teacher authorization check
  if (isTeacher) {
    try {
      await verifyTeacherAccessToClassSubject(session as any, params.classSubjectId);
    } catch {
      // Forbidden or unassigned
      redirect(`/academics/classes/${params.classId}`);
    }
  }

  // Load classSubject details — reuses cached result from generateMetadata
  const cs = await getClassSubjectCached(params.classSubjectId, schoolId);

  if (!cs || cs.classId !== params.classId) {
    notFound();
  }

  // Fetch all domain data in parallel
  const [
    units,
    lessons,
    sectionTeachers,
    progressData,
    allTeachers,
    subjectAssignments,
    subjectAssessments,
  ] = await Promise.all([
    getSyllabusUnits(params.classSubjectId).catch(() => []),
    getLessonPlans(params.classSubjectId).catch(() => []),
    getSectionSubjectTeachers(params.classSubjectId).catch(() => []),
    getSubjectSyllabusProgress(params.classSubjectId).catch(() => null),
    getTeachersList().catch(() => []),
    db.query.assignments.findMany({
      where: and(
        eq(assignments.schoolId, schoolId),
        eq(assignments.classSubjectId, params.classSubjectId),
      ),
      with: {
        section: { columns: { name: true } },
      },
      orderBy: [desc(assignments.dueDate)],
    }),
    db.query.assessments.findMany({
      where: and(
        eq(assessments.schoolId, schoolId),
        eq(assessments.classSubjectId, params.classSubjectId),
      ),
      with: {
        section: { columns: { name: true } },
      },
      orderBy: [desc(assessments.date)],
    }),
  ]);

  const initialProgress = {
    totalTopics: progressData?.totalTopics ?? 0,
    completedTopics: progressData?.completedTopics ?? 0,
    percentage: progressData?.percentage ?? 0,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <SubjectWorkspaceClient
        classSubjectId={cs.id}
        classId={cs.classId}
        className={cs.class.displayName}
        subjectName={cs.subject.name}
        subjectCode={cs.subject.code}
        leadTeacherEmail={cs.teacher?.email ?? null}
        sections={cs.class.sections.map((s) => ({ id: s.id, name: s.name }))}
        sectionTeachers={sectionTeachers as any}
        initialUnits={units as any}
        initialLessonPlans={lessons as any}
        initialAssignments={subjectAssignments as any}
        initialAssessments={subjectAssessments as any}
        initialProgress={initialProgress}
        allTeachers={allTeachers}
        isAdmin={isAdmin}
        isTeacher={isTeacher}
        userId={session.user.id}
      />
    </div>
  );
}
