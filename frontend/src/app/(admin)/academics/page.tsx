import { Metadata } from "next";
import { requireAuth } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import {
  classes,
  sections,
  subjects,
  classSubjects,
  sectionSubjectTeachers,
  users,
  timetableSubstitutions,
  schools,
} from "@/db/schema";
import { eq, and, count, isNull } from "drizzle-orm";
import { getActiveAcademicYear } from "./actions/auth-helper";
import { getCanonicalTeachingStaff } from "../hr/teachingStaff";
import AmsHubClient from "./components/AmsHubClient";

export const metadata: Metadata = {
  description:
    "Class-centric academic hub for classes, sections, subjects, timetables, and curriculum.",
};

import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";

import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";

export default async function AcademicsPage() {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/academics", { id: ctx.userId, email: ctx.email });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  let schoolId = ctx.schoolId || "";
  if (!schoolId && ctx.role === "SUPER_ADMIN") {
    const activeSchool = await db.query.schools.findFirst({
      where: eq(schools.isActive, true),
      columns: { id: true },
    });
    schoolId = activeSchool?.id || "";
  }

  const role = ctx.role;
  const userId = ctx.userId;

  const data = await withDataPhaseTiming("/academics", async () => {
    return assertQueryBudget(
      async () => {
        // Fetch all School Data with strict tenant scoping
        const [activeYear, teachersList] = await Promise.all([
          schoolId
            ? getActiveAcademicYear(schoolId).catch(() => null)
            : Promise.resolve(null),
          getCanonicalTeachingStaff(schoolId).catch(() => []),
        ]);

        const tenantData = schoolId
          ? await withTenant(schoolId, async (tx) => {
              const classroomsList = await tx.query.classes.findMany({
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
              });

              const subjectsList = await tx.query.subjects.findMany({
                where: and(
                  eq(subjects.schoolId, schoolId),
                  eq(subjects.isActive, true),
                ),
                orderBy: [subjects.name],
              });

              const mappingsList = await tx.query.classSubjects.findMany({
                where: eq(classSubjects.schoolId, schoolId),
                with: {
                  class: true,
                  subject: true,
                  sectionSubjectTeachers: {
                    where: and(
                      eq(sectionSubjectTeachers.schoolId, schoolId),
                      eq(sectionSubjectTeachers.isActive, true),
                      isNull(sectionSubjectTeachers.effectiveTo),
                    ),
                    with: {
                      teacher: { columns: { id: true, email: true } },
                      section: { columns: { id: true, name: true } },
                    },
                  },
                },
              });

              const pendingSubsResult = await tx
                .select({ c: count() })
                .from(timetableSubstitutions)
                .where(
                  and(
                    eq(timetableSubstitutions.schoolId, schoolId),
                    eq(timetableSubstitutions.status, "PENDING"),
                  ),
                )
                .catch(() => [{ c: 0 }]);

              return {
                classroomsList,
                subjectsList,
                mappingsList,
                pendingSubsResult,
              };
            })
          : {
              classroomsList: [],
              subjectsList: [],
              mappingsList: [],
              pendingSubsResult: [{ c: 0 }],
            };

        return {
          activeYear,
          teachersList,
          ...tenantData,
        };
      },
      { maxQueries: 12, label: "Academics Hub" }
    );
  });

  const isTeacher = role === "TEACHER";
  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(role);

  // Filter mappings for teachers if needed
  const filteredMappings = isTeacher
    ? data.mappingsList.filter((m) => m.assignedTeacherId === userId)
    : data.mappingsList;

  return (
    <div className="space-y-6">
      <AmsHubClient
        activeYear={data.activeYear as any}
        classrooms={data.classroomsList as any}
        subjects={data.subjectsList as any}
        mappings={filteredMappings as any}
        teachers={data.teachersList as any}
        pendingSubstitutionsCount={Number(data.pendingSubsResult[0]?.c ?? 0)}
        role={role}
        userId={userId}
        isAdmin={isAdmin}
      />
    </div>
  );
}
