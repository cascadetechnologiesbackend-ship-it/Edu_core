"use server";

import { db } from "@/db";
import {
  students,
  sections,
  sectionSubjectTeachers,
  classSubjects,
} from "@/db/schema";
import { desc, eq, and, inArray, or, ilike, lt } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { decryptData, computeSearchHash, computeLegacySearchHash } from "@/lib/encryption";
import { assertRouteAccess } from "@/lib/routeGuards";
import type { StudentListItem } from "./StudentDirectoryClient";

export interface SearchStudentsParams {
  search?: string;
  classId?: string;
  status?: string;
  cursor?: string; // createdAt ISO string for cursor pagination
  limit?: number;
}

export interface SearchStudentsResult {
  students: StudentListItem[];
  nextCursor: string | null;
  totalReturned: number;
}

export async function searchStudentsAction(
  params: SearchStudentsParams = {}
): Promise<SearchStudentsResult> {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/students", { id: ctx.userId, email: ctx.email });
  if (!access.allowed) {
    throw new Error("Unauthorized access to students directory.");
  }

  const school = await requireSchool(ctx);
  const limit = Math.min(params.limit || 30, 50);

  // Determine role-based scoping
  let allowedSectionIds: string[] | null = null;

  if (ctx.role === "TEACHER") {
    const [ctSections, saSections, dtClasses] = await Promise.all([
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
    ]);

    const allSections = await db.query.sections.findMany({
      where: eq(sections.schoolId, school.id),
      columns: { id: true, classId: true, isActive: true },
    });

    const defaultTeacherSections = dtClasses.length > 0
      ? allSections.filter((s) => dtClasses.some((c) => c.classId === s.classId) && s.isActive).map((s) => s.id)
      : [];

    const sectionIdSet = new Set<string>([
      ...ctSections.map((s) => s.id),
      ...saSections.map((s) => s.sectionId),
      ...defaultTeacherSections,
    ]);
    allowedSectionIds = Array.from(sectionIdSet);
  }

  // Build filter conditions
  const conditions = [eq(students.schoolId, school.id)];

  if (allowedSectionIds !== null) {
    if (allowedSectionIds.length > 0) {
      conditions.push(inArray(students.currentSectionId, allowedSectionIds));
    } else {
      conditions.push(eq(students.id, "00000000-0000-0000-0000-000000000000"));
    }
  }

  if (params.classId && params.classId !== "ALL") {
    conditions.push(eq(students.currentClassId, params.classId));
  }

  if (params.status === "ACTIVE") {
    conditions.push(eq(students.isActive, true));
  } else if (params.status === "INACTIVE") {
    conditions.push(eq(students.isActive, false));
  }

  if (params.cursor) {
    const cursorDate = new Date(params.cursor);
    if (!isNaN(cursorDate.getTime())) {
      conditions.push(lt(students.createdAt, cursorDate));
    }
  }

  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    const hash = computeSearchHash(term);
    const legacyHash = computeLegacySearchHash(term);

    conditions.push(
      or(
        ilike(students.admissionNumber, `%${term}%`),
        eq(students.firstNameSearchHash, hash),
        eq(students.lastNameSearchHash, hash),
        eq(students.firstNameSearchHash, legacyHash),
        eq(students.lastNameSearchHash, legacyHash)
      )!
    );
  }

  const [studentRows, allSections] = await Promise.all([
    db.query.students.findMany({
      where: and(...conditions),
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
      limit: limit + 1, // +1 to determine if next page exists
    }),
    db.query.sections.findMany({
      where: eq(sections.schoolId, school.id),
      with: { class: true },
    }),
  ]);

  const hasNextPage = studentRows.length > limit;
  const pagedRows = hasNextPage ? studentRows.slice(0, limit) : studentRows;
  const nextCursor = hasNextPage && pagedRows.length > 0
    ? pagedRows[pagedRows.length - 1]!.createdAt.toISOString()
    : null;

  const sectionMap = new Map(allSections.map((s) => [s.id, s]));

  const mappedStudents: StudentListItem[] = pagedRows.map((s) => {
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
    students: mappedStudents,
    nextCursor,
    totalReturned: mappedStudents.length,
  };
}
