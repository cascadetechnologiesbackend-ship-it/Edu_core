import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  classes,
  sections,
  subjects,
  classSubjects,
  users,
  timetableSubstitutions,
} from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { getActiveAcademicYear } from "./actions/auth-helper";
import { getCanonicalTeachingStaff } from "../hr/actions";
import AmsHubClient from "./components/AmsHubClient";

export const metadata: Metadata = {
  title: "Academic Management System",
  description:
    "Class-centric academic hub for classes, sections, subjects, timetables, and curriculum.",
};

export default async function AcademicsPage() {
  const session = await auth();
  const schoolId = session?.user?.schoolId || "";
  const role = session?.user?.role || "STUDENT";
  const userId = session?.user?.id || "";

  // 1. Resolve Active Academic Year server-side
  const activeYear = schoolId
    ? await getActiveAcademicYear(schoolId).catch(() => null)
    : null;

  // 2. Fetch School Data with strict tenant scoping
  const [classroomsList, subjectsList, mappingsList, teachersList, pendingSubsResult] =
    await Promise.all([
      db.query.classes.findMany({
        where: and(
          eq(classes.schoolId, schoolId),
          eq(classes.isActive, true),
        ),
        orderBy: [classes.sortOrder],
        with: {
          sections: {
            where: and(
              eq(sections.schoolId, schoolId),
              eq(sections.isActive, true),
            ),
          },
        },
      }),

      db.query.subjects.findMany({
        where: and(
          eq(subjects.schoolId, schoolId),
          eq(subjects.isActive, true),
        ),
        orderBy: [subjects.name],
      }),

      db.query.classSubjects.findMany({
        where: eq(classSubjects.schoolId, schoolId),
        with: {
          class: true,
          subject: true,
        },
      }),

      getCanonicalTeachingStaff(schoolId).catch(() => []),

      db
        .select({ c: count() })
        .from(timetableSubstitutions)
        .where(
          and(
            eq(timetableSubstitutions.schoolId, schoolId),
            eq(timetableSubstitutions.status, "PENDING"),
          ),
        )
        .catch(() => [{ c: 0 }]),
    ]);

  const isTeacher = role === "TEACHER";
  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(role);

  // Filter mappings for teachers if needed
  const filteredMappings = isTeacher
    ? mappingsList.filter((m) => m.assignedTeacherId === userId)
    : mappingsList;

  return (
    <div className="space-y-6">
      <AmsHubClient
        activeYear={activeYear as any}
        classrooms={classroomsList as any}
        subjects={subjectsList as any}
        mappings={filteredMappings as any}
        teachers={teachersList as any}
        pendingSubstitutionsCount={Number(pendingSubsResult[0]?.c ?? 0)}
        role={role}
        userId={userId}
        isAdmin={isAdmin}
      />
    </div>
  );
}
