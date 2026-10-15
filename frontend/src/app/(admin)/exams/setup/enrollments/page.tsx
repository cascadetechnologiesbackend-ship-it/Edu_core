import { db } from "@/db";
import { classes, sections, academicYears } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Metadata } from "next";
import { requireAuth } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { hasExamPermission } from "@/lib/examPermissions";
import { EnrollmentClient } from "./EnrollmentClient";

export const metadata: Metadata = {
  title: "Student Subject & Elective Enrollments | SchoolMitra ERP",
  description: "Manage student subject enrollments and elective selections for examinations and academics",
};

export default async function StudentEnrollmentsPage() {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/exams", {
    id: ctx.userId,
    email: ctx.email,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = ctx.schoolId || "";
  const canManage = hasExamPermission(ctx.role, "exam.enrollments.manage");

  const data = await withDataPhaseTiming("/exams/setup/enrollments", async () => {
    return assertQueryBudget(
      async () => {
        const [classList, sectionList] = await Promise.all([
          db.query.classes.findMany({
            where: and(eq(classes.schoolId, schoolId), eq(classes.isActive, true)),
            orderBy: (t, { asc }) => [asc(t.sortOrder)],
          }),
          db.query.sections.findMany({
            where: and(eq(sections.schoolId, schoolId), eq(sections.isActive, true)),
            orderBy: (t, { asc }) => [asc(t.name)],
          }),
        ]);

        return {
          classes: classList.map((c) => ({ id: c.id, gradeLevel: c.gradeLevel })),
          sections: sectionList.map((s) => ({
            id: s.id,
            classId: s.classId,
            name: s.name,
          })),
        };
      },
      { maxQueries: 5 },
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <EnrollmentClient
        classes={data.classes}
        sections={data.sections}
        canManage={canManage}
      />
    </div>
  );
}
