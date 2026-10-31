import { db } from "@/db";
import {
  classes,
  sections,
  students,
  subjects,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { decryptData } from "../encryption";

export interface ResolvedStudentIdentity {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  rollNumber: string | null;
  sectionId: string | null;
  sectionName: string;
  className: string;
  classSectionDisplayName: string;
}

export interface ResolvedSectionContext {
  id: string;
  sectionName: string;
  className: string;
  classSectionDisplayName: string;
}

export interface ResolvedSubjectContext {
  id: string;
  subjectName: string;
  maxMarks: number;
}

/**
 * Batch resolves student identities including decrypted first/last names,
 * roll numbers, and linked class/section display names in a single query pass.
 *
 * Adheres to S24 Honesty Law: Zero placeholder string literals ("Student", etc.).
 * If a name is missing or unresolvable, returns an honest empty string.
 */
export async function batchResolveStudentIdentities(
  schoolId: string,
  studentIds: string[],
  tx?: any
): Promise<Map<string, ResolvedStudentIdentity>> {
  const result = new Map<string, ResolvedStudentIdentity>();
  if (!studentIds || studentIds.length === 0) return result;

  const uniqueIds = Array.from(new Set<string>(studentIds.filter(Boolean)));
  if (uniqueIds.length === 0) return result;

  const txDb = tx || db;

  // 1. Fetch student rows
  const studentRows = await txDb.query.students.findMany({
    where: and(
      eq(students.schoolId, schoolId),
      inArray(students.id, uniqueIds)
    ),
    columns: {
      id: true,
      firstNameEncrypted: true,
      lastNameEncrypted: true,
      rollNumber: true,
      currentClassId: true,
      currentSectionId: true,
    },
  });

  if (studentRows.length === 0) return result;

  // 2. Collect section and class IDs for batch resolution
  const sectionIds: string[] = Array.from(
    new Set<string>(
      studentRows
        .map((s: { currentSectionId: string | null }) => s.currentSectionId)
        .filter((id: string | null): id is string => Boolean(id))
    )
  );

  const sectionMap = await batchResolveSectionContexts(schoolId, sectionIds, txDb);

  // 3. Decrypt and map each student
  for (const s of studentRows) {
    let firstName = "";
    let lastName = "";

    try {
      if (s.firstNameEncrypted) {
        firstName = (decryptData(s.firstNameEncrypted) || "").trim();
      }
    } catch {
      firstName = "";
    }

    try {
      if (s.lastNameEncrypted) {
        lastName = (decryptData(s.lastNameEncrypted) || "").trim();
      }
    } catch {
      lastName = "";
    }

    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const secCtx = s.currentSectionId ? sectionMap.get(s.currentSectionId) : undefined;

    result.set(s.id, {
      id: s.id,
      fullName,
      firstName,
      lastName,
      rollNumber: s.rollNumber || null,
      sectionId: s.currentSectionId || null,
      sectionName: secCtx?.sectionName || "",
      className: secCtx?.className || "",
      classSectionDisplayName: secCtx?.classSectionDisplayName || "",
    });
  }

  return result;
}

/**
 * Batch resolves sections and their linked class names in a single query pass.
 *
 * Adheres to S24 Honesty Law: Zero placeholder string literals ("Section", "Class").
 */
export async function batchResolveSectionContexts(
  schoolId: string,
  sectionIds: string[],
  tx?: any
): Promise<Map<string, ResolvedSectionContext>> {
  const result = new Map<string, ResolvedSectionContext>();
  if (!sectionIds || sectionIds.length === 0) return result;

  const uniqueIds = Array.from(new Set<string>(sectionIds.filter(Boolean)));
  if (uniqueIds.length === 0) return result;

  const txDb = tx || db;

  const sectionRows = await txDb.query.sections.findMany({
    where: and(
      eq(sections.schoolId, schoolId),
      inArray(sections.id, uniqueIds)
    ),
    with: {
      class: true,
    },
  });

  for (const sec of sectionRows) {
    const sName = sec.name || "";
    const cName = sec.class?.displayName || sec.class?.gradeLevel || "";
    const classSectionDisplayName = cName && sName ? `${cName}-${sName}` : cName || sName;

    result.set(sec.id, {
      id: sec.id,
      sectionName: sName,
      className: cName,
      classSectionDisplayName,
    });
  }

  return result;
}

/**
 * Batch resolves subjects and their configured max marks in a single query pass.
 *
 * Adheres to S24 Honesty Law: Zero placeholder string literals ("Subject").
 */
export async function batchResolveSubjectContexts(
  schoolId: string,
  subjectIds: string[],
  tx?: any
): Promise<Map<string, ResolvedSubjectContext>> {
  const result = new Map<string, ResolvedSubjectContext>();
  if (!subjectIds || subjectIds.length === 0) return result;

  const uniqueIds = Array.from(new Set<string>(subjectIds.filter(Boolean)));
  if (uniqueIds.length === 0) return result;

  const txDb = tx || db;

  const subjectRows = await txDb.query.subjects.findMany({
    where: and(
      eq(subjects.schoolId, schoolId),
      inArray(subjects.id, uniqueIds)
    ),
    columns: {
      id: true,
      name: true,
      maxMarks: true,
    },
  });

  for (const sub of subjectRows) {
    result.set(sub.id, {
      id: sub.id,
      subjectName: sub.name || "",
      maxMarks: typeof sub.maxMarks === "number" ? sub.maxMarks : 100,
    });
  }

  return result;
}
