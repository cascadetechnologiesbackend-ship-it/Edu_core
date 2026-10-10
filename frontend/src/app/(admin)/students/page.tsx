import { db } from "@/db";
import {
  students,
  classes,
  sections,
} from "@/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { decryptData } from "@/lib/encryption";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import { StudentDirectoryClient } from "./StudentDirectoryClient";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";

const INITIAL_PAGE_SIZE = 30;

export default async function StudentsDirectoryPage() {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/students", { id: ctx.userId, email: ctx.email });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const school = await requireSchool(ctx);

  const { schoolClasses, mappedStudents, initialNextCursor } = await withDataPhaseTiming(
    "/students",
    async () => {
      return assertQueryBudget(
        async () => {
          const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role);

          // Build student filter condition: admins see all school students;
          // teachers are scoped to sections where they are class teacher, subject teacher, or default class teacher.
          const studentCondition = isAdmin
            ? eq(students.schoolId, school.id)
            : and(
                eq(students.schoolId, school.id),
                sql`${students.currentSectionId} IN (
                  SELECT s.id FROM sections s WHERE s.school_id = ${school.id} AND s.is_active = true AND (
                    s.class_teacher_id = ${ctx.userId}
                    OR s.id IN (SELECT sst.section_id FROM section_subject_teachers sst WHERE sst.school_id = ${school.id} AND sst.teacher_id = ${ctx.userId} AND sst.is_active = true)
                    OR s.class_id IN (SELECT cs.class_id FROM class_subjects cs WHERE cs.school_id = ${school.id} AND cs.assigned_teacher_id = ${ctx.userId})
                  )
                )`
              );

          // Run classes, sections, and initial students in a single parallel Promise.all (zero sequential roundtrip)
          const [classesList, allSections, initialStudentRows] = await Promise.all([
            db.query.classes.findMany({
              where: and(
                eq(classes.schoolId, school.id),
                eq(classes.isActive, true),
              ),
              orderBy: [classes.sortOrder, classes.displayName],
            }),
            db.query.sections.findMany({
              where: eq(sections.schoolId, school.id),
              with: { class: true },
            }),
            db.query.students.findMany({
              where: studentCondition,
              columns: {
                id: true,
                admissionNumber: true,
                firstNameEncrypted: true,
                lastNameEncrypted: true,
                gender: true,
                currentClassId: true,
                currentSectionId: true,
                isActive: true,
                createdAt: true,
              },
              orderBy: [desc(students.createdAt)],
              limit: INITIAL_PAGE_SIZE + 1, // +1 for cursor computation
            }),
          ]);

          const hasNextPage = initialStudentRows.length > INITIAL_PAGE_SIZE;
          const pagedRows = hasNextPage ? initialStudentRows.slice(0, INITIAL_PAGE_SIZE) : initialStudentRows;
          const nextCursor = hasNextPage && pagedRows.length > 0
            ? pagedRows[pagedRows.length - 1]!.createdAt.toISOString()
            : null;

          const sectionMap = new Map(allSections.map((s) => [s.id, s]));

          const mapped = pagedRows.map((s) => {
            const sec = s.currentSectionId ? sectionMap.get(s.currentSectionId) : null;
            const firstName = decryptData(s.firstNameEncrypted) || "Unknown";
            const lastName = decryptData(s.lastNameEncrypted) || "";
            const fullName = `${firstName} ${lastName}`.trim();

            return {
              id: s.id,
              admissionNumber: s.admissionNumber,
              fullName,
              gender: s.gender,
              className: sec?.class?.displayName || "",
              sectionName: sec?.name || "",
              classId: s.currentClassId || null,
              sectionId: s.currentSectionId || null,
              isActive: s.isActive,
              createdAt: s.createdAt.toISOString(),
            };
          });

          return {
            schoolClasses: classesList,
            mappedStudents: mapped,
            initialNextCursor: nextCursor,
          };
        },
        { maxQueries: 5, label: "Students SIS Directory" }
      );
    }
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Student Information System (SIS)
          </h1>
          <p className="text-gray-500 mt-1">
            Search, manage, and view 360-degree operational profiles for all students.
          </p>
        </div>
      </div>

      <StudentDirectoryClient
        initialStudents={mappedStudents}
        initialNextCursor={initialNextCursor}
        classes={schoolClasses.map((c) => ({ id: c.id, name: c.displayName }))}
      />
    </div>
  );
}
