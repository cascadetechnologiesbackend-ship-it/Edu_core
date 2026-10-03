import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  timetablePeriods,
  assignments,
  lessonPlans,
  assessments,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getActiveAcademicYear } from "../../actions/auth-helper";
import {
  getClassWithDetails,
  getClassHubOverview,
} from "../../actions/class-setup.actions";
import { getBellSchedule } from "../../actions/timetable.actions";
import { getSubjects, getTeachersList } from "../../actions";
import ClassHubClient from "./ClassHubClient";
import { cache } from "react";

// Cached per-request so generateMetadata and the page body share one DB call
const getClassWithDetailsCached = cache(async (classId: string) => {
  return getClassWithDetails(classId);
});

export async function generateMetadata({
  params,
}: {
  params: { classId: string };
}): Promise<Metadata> {
  const cls = await getClassWithDetailsCached(params.classId);
  return {
    title: cls ? `${cls.displayName} — Class Hub` : "Class Hub",
  };
}

export default async function ClassHubPage({
  params,
}: {
  params: { classId: string };
}) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.schoolId) {
    redirect("/login");
  }

  const schoolId = session.user.schoolId;
  const role = session.user.role;
  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(role);
  const isTeacher = role === "TEACHER";

  const [cls, overview, activeYear, bellPeriods, allSubjects, allTeachers] =
    await Promise.all([
      getClassWithDetailsCached(params.classId),
      getClassHubOverview(params.classId).catch(() => null),
      getActiveAcademicYear(schoolId).catch(() => null),
      getBellSchedule().catch(() => []),
      getSubjects().catch(() => []),
      getTeachersList().catch(() => []),
    ]);

  if (!cls || !overview) notFound();

  const secIds = cls.sections.map((s: any) => s.id);
  const csIds = cls.classSubjects.map((cs: any) => cs.id);

  // Fetch initial timetable periods for all sections in this class
  const timetable =
    secIds.length > 0
      ? await db.query.timetablePeriods.findMany({
          where: and(
            eq(timetablePeriods.schoolId, schoolId),
            inArray(timetablePeriods.sectionId, secIds),
            eq(timetablePeriods.isActive, true),
          ),
          with: {
            subject: { columns: { id: true, name: true, code: true } },
            teacher: { columns: { id: true, email: true } },
          },
        })
      : [];

  // Fetch initial assignments for this class
  const classAssignments =
    csIds.length > 0
      ? await db.query.assignments.findMany({
          where: and(
            eq(assignments.schoolId, schoolId),
            inArray(assignments.classSubjectId, csIds),
          ),
          with: {
            classSubject: { with: { subject: { columns: { name: true } } } },
            section: { columns: { id: true, name: true } },
          },
          limit: 20,
        })
      : [];

  // Fetch initial lesson plans
  const classLessons =
    csIds.length > 0
      ? await db.query.lessonPlans.findMany({
          where: and(
            eq(lessonPlans.schoolId, schoolId),
            inArray(lessonPlans.classSubjectId, csIds),
          ),
          with: {
            classSubject: { with: { subject: { columns: { name: true } } } },
          },
          limit: 20,
        })
      : [];

  // Fetch initial assessments
  const classAssessments =
    csIds.length > 0
      ? await db.query.assessments.findMany({
          where: and(
            eq(assessments.schoolId, schoolId),
            inArray(assessments.classSubjectId, csIds),
          ),
          with: {
            classSubject: { with: { subject: { columns: { name: true } } } },
            section: { columns: { id: true, name: true } },
          },
          limit: 20,
        })
      : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <ClassHubClient
        cls={cls as any}
        overview={overview}
        activeYearName={activeYear?.label || "Active Session"}
        bellPeriods={bellPeriods as any}
        allSubjects={allSubjects as any}
        allTeachers={allTeachers as any}
        initialTimetable={timetable}
        initialAssignments={classAssignments}
        initialLessonPlans={classLessons}
        initialAssessments={classAssessments}
        isAdmin={isAdmin}
        isTeacher={isTeacher}
        userId={session.user.id}
      />
    </div>
  );
}
