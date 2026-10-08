import { Metadata } from "next";
import { requireAuth } from "@/lib/serverAuth";
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
import { getCanonicalTeachingStaff } from "../hr/teachingStaff";
import AmsHubClient from "./components/AmsHubClient";

export const metadata: Metadata = {
  description:
    "Class-centric academic hub for classes, sections, subjects, timetables, and curriculum.",
};

import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";

export default async function AcademicsPage() {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/academics", { id: ctx.userId, email: ctx.email });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = ctx.schoolId || "";
  const role = ctx.role;
  const userId = ctx.userId;

  // Fetch all School Data in parallel with strict tenant scoping
  const [activeYear, classroomsList, subjectsList, mappingsList, teachersList, pendingSubsResult] =
    await Promise.all([
      schoolId
        ? getActiveAcademicYear(schoolId).catch(() => null)
        : Promise.resolve(null),

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
