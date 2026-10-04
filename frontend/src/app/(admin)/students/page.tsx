import { db } from "@/db";
import {
  students,
  classes,
  sections,
  sectionSubjectTeachers,
  classSubjects,
} from "@/db/schema";
import { desc, eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { decryptData } from "@/lib/encryption";
import { StudentDirectoryClient } from "./StudentDirectoryClient";

export default async function StudentsDirectoryPage() {
  const ctx = await requireAuth();
  const school = await requireSchool(ctx);

  // Fetch classes and all sections in parallel with role-specific section checks
  let classTeacherSections: { id: string }[] = [];
  let subjectAllocations: { sectionId: string }[] = [];
  let defaultTeacherClasses: { classId: string }[] = [];

  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role);

  // For admins, allStudents has no teacher section filter — run it concurrently with classes and sections
  const [schoolClasses, allSections, adminStudents, roleQueryResults] = await Promise.all([
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
    isAdmin
      ? db.query.students.findMany({
          where: eq(students.schoolId, school.id),
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
          limit: 200,
        })
      : Promise.resolve(null),
    ctx.role === "TEACHER"
      ? Promise.all([
          db.query.sections.findMany({
            where: and(
              eq(sections.schoolId, school.id),
              eq(sections.classTeacherId, ctx.userId),
              eq(sections.isActive, true),
            ),
            columns: { id: true },
          }),
          db.query.sectionSubjectTeachers.findMany({
            where: and(
              eq(sectionSubjectTeachers.schoolId, school.id),
              eq(sectionSubjectTeachers.teacherId, ctx.userId),
              eq(sectionSubjectTeachers.isActive, true),
            ),
            columns: { sectionId: true },
          }),
          db.query.classSubjects.findMany({
            where: and(
              eq(classSubjects.schoolId, school.id),
              eq(classSubjects.assignedTeacherId, ctx.userId),
            ),
            columns: { classId: true },
          }),
        ])
      : Promise.resolve(null),
  ]);

  let allStudents = adminStudents;

  if (ctx.role === "TEACHER" && roleQueryResults) {
    const [ctSections, saSections, dtClasses] = roleQueryResults;
    classTeacherSections = ctSections;
    subjectAllocations = saSections;
    defaultTeacherClasses = dtClasses;

    let defaultTeacherSections: { id: string }[] = [];
    if (defaultTeacherClasses.length > 0) {
      defaultTeacherSections = allSections.filter((s) =>
        defaultTeacherClasses.some((c) => c.classId === s.classId) && s.isActive,
      ).map((s) => ({ id: s.id }));
    }

    const sectionIdSet = new Set<string>([
      ...classTeacherSections.map((s) => s.id),
      ...subjectAllocations.map((s) => s.sectionId),
      ...defaultTeacherSections.map((s) => s.id),
    ]);
    const allowedSectionIds = Array.from(sectionIdSet);

    // Query teacher's scoped students with column projection
    allStudents = await db.query.students.findMany({
      where: and(
        eq(students.schoolId, school.id),
        allowedSectionIds.length > 0
          ? inArray(students.currentSectionId, allowedSectionIds)
          : eq(students.id, "00000000-0000-0000-0000-000000000000"), // no permitted sections
      ),
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
      limit: 200,
    });
  }

  if (!allStudents) {
    allStudents = [];
  }

  // allSections already fetched above in the parallel block
  const sectionMap = new Map(allSections.map((s) => [s.id, s]));

  const mappedStudents = allStudents.map((s) => {
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
        students={mappedStudents}
        classes={schoolClasses.map((c) => ({ id: c.id, name: c.displayName }))}
      />
    </div>
  );
}
