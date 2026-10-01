import { db } from "@/db";
import {
  students,
  classes,
  sections,
  sectionSubjectTeachers,
  classSubjects,
} from "@/db/schema";
import { desc, eq, and, inArray } from "drizzle-orm";
import crypto from "crypto";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { StudentDirectoryClient } from "./StudentDirectoryClient";

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

function decryptData(encryptedText: string | null) {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split(":");
    const ivStr = parts[0];
    const encryptedStr = parts[1];
    if (!ivStr || !encryptedStr) return encryptedText;

    const iv = Buffer.from(ivStr, "hex");
    const encrypted = Buffer.from(encryptedStr, "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY, "hex"),
      iv,
    );
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return encryptedText;
  }
}

export default async function StudentsDirectoryPage() {
  const ctx = await requireAuth();
  const school = await requireSchool(ctx);

  // Fetch all active classes for filter dropdown
  const schoolClasses = await db.query.classes.findMany({
    where: and(
      eq(classes.schoolId, school.id),
      eq(classes.isActive, true),
    ),
    orderBy: [classes.sortOrder, classes.displayName],
  });

  // Role-based student filtering
  let allowedSectionIds: string[] | null = null;
  if (ctx.role === "TEACHER") {
    // Collect sections where this teacher is assigned as class teacher
    const classTeacherSections = await db.query.sections.findMany({
      where: and(
        eq(sections.schoolId, school.id),
        eq(sections.classTeacherId, ctx.userId),
        eq(sections.isActive, true),
      ),
      columns: { id: true },
    });

    // Collect sections where teacher is allocated in sectionSubjectTeachers
    const subjectAllocations = await db.query.sectionSubjectTeachers.findMany({
      where: and(
        eq(sectionSubjectTeachers.schoolId, school.id),
        eq(sectionSubjectTeachers.teacherId, ctx.userId),
        eq(sectionSubjectTeachers.isActive, true),
      ),
      columns: { sectionId: true },
    });

    // Collect class default teacher sections
    const defaultTeacherClasses = await db.query.classSubjects.findMany({
      where: and(
        eq(classSubjects.schoolId, school.id),
        eq(classSubjects.assignedTeacherId, ctx.userId),
      ),
      columns: { classId: true },
    });
    let defaultTeacherSections: { id: string }[] = [];
    if (defaultTeacherClasses.length > 0) {
      defaultTeacherSections = await db.query.sections.findMany({
        where: and(
          eq(sections.schoolId, school.id),
          inArray(sections.classId, defaultTeacherClasses.map((c) => c.classId)),
          eq(sections.isActive, true),
        ),
        columns: { id: true },
      });
    }

    const sectionIdSet = new Set<string>([
      ...classTeacherSections.map((s) => s.id),
      ...subjectAllocations.map((s) => s.sectionId),
      ...defaultTeacherSections.map((s) => s.id),
    ]);

    allowedSectionIds = Array.from(sectionIdSet);
  }

  // Query students for this school
  const allStudents = await db.query.students.findMany({
    where: and(
      eq(students.schoolId, school.id),
      allowedSectionIds !== null
        ? allowedSectionIds.length > 0
          ? inArray(students.currentSectionId, allowedSectionIds)
          : eq(students.id, "00000000-0000-0000-0000-000000000000") // no permitted sections
        : undefined,
    ),
    orderBy: [desc(students.createdAt)],
    limit: 200,
  });

  // Query section details for placement resolution
  const allSections = await db.query.sections.findMany({
    where: eq(sections.schoolId, school.id),
    with: { class: true },
  });
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
