import { Metadata } from "next";
import { requireAuth } from "@/lib/serverAuth";
import { assertRouteAccess } from "@/lib/routeGuards";
import { redirect } from "next/navigation";
import { db, withTenant } from "@/db";
import { classes, sections, subjects, classSubjects, sectionSubjectTeachers, schools } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCanonicalTeachingStaff } from "../../hr/teachingStaff";
import SubjectMappingTab from "../SubjectMappingTab";

export const metadata: Metadata = {
  title: "Subject Mapping Matrix | SchoolMitra ERP",
  description: "Curriculum mapping matrix: attach and manage subjects and teachers across classrooms",
};

export default async function SubjectMappingPage() {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/academics", {
    id: ctx.userId,
    email: ctx.email,
  });
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

  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role);

  const [teachingStaff, tenantData] = await Promise.all([
    schoolId ? getCanonicalTeachingStaff(schoolId).catch(() => []) : Promise.resolve([]),
    schoolId
      ? await withTenant(schoolId, async (tx) => {
          const classroomsList = await tx.query.classes.findMany({
            where: and(
              eq(classes.schoolId, schoolId),
              eq(classes.isActive, true)
            ),
            orderBy: [classes.sortOrder],
            with: {
              sections: {
                where: and(
                  eq(sections.schoolId, schoolId),
                  eq(sections.isActive, true),
                ),
                orderBy: [sections.name],
              },
            },
          });

          const subjectsList = await tx.query.subjects.findMany({
            where: and(
              eq(subjects.schoolId, schoolId),
              eq(subjects.isActive, true)
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

          return { classroomsList, subjectsList, mappingsList };
        })
      : { classroomsList: [], subjectsList: [], mappingsList: [] },
  ]);

  const teachers = teachingStaff.map((t) => ({
    id: t.id,
    email: t.email,
    name: t.name,
    displayName: `${t.name} (${t.employeeCode})`,
  }));

  return (
    <div className="space-y-6 max-w-[1280px] mx-auto px-4 md:px-6">
      {/* Breadcrumb Header */}
      <div className="border-b border-gray-100 dark:border-slate-800 pb-4">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-1">
          <Link href="/dashboard" className="hover:text-primary transition">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/academics" className="hover:text-primary transition">
            Academics
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-700 dark:text-gray-300 font-medium">
            Subject Matrix
          </span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Curriculum Subject Mapping
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Class × Subject allocation workbench. Configure core and elective subject distribution.
            </p>
          </div>
        </div>
      </div>

      <SubjectMappingTab
        mappings={tenantData.mappingsList as any}
        classrooms={tenantData.classroomsList as any}
        subjects={tenantData.subjectsList as any}
        teachers={teachers}
        isAdmin={isAdmin}
      />
    </div>
  );
}
