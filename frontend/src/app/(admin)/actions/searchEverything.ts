"use server";

import { db } from "@/db";
import { classes, subjects, students } from "@/db/schema";
import { eq, and, or, ilike, desc } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { decryptData } from "@/lib/encryption";

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Jump to" | "Actions";
  href: string;
  badge?: string;
}

export async function searchEverything(query: string = ""): Promise<SearchResultItem[]> {
  try {
    const ctx = await requireAuth();
    const school = await requireSchool(ctx);
    const trimmed = query.trim().toLowerCase();
    const results: SearchResultItem[] = [];

    // Role-filtered Actions
    const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role);

    const baseActions: SearchResultItem[] = [
      {
        id: "action-students",
        title: "Open Student Directory",
        subtitle: "Search, filter, and inspect enrolled students",
        category: "Actions",
        href: "/students",
        badge: "Students",
      },
      {
        id: "action-academics",
        title: "Academics Hub",
        subtitle: "Classrooms, sections, and curriculum progress",
        category: "Actions",
        href: "/academics",
        badge: "AMS",
      },
    ];

    if (isAdmin) {
      baseActions.unshift(
        {
          id: "action-create-class",
          title: "Create Class",
          subtitle: "Launch class & section setup wizard",
          category: "Actions",
          href: "/academics?create=true",
          badge: "Setup",
        },
        {
          id: "action-subjects",
          title: "Manage Subjects Catalog",
          subtitle: "View and edit catalog subjects",
          category: "Actions",
          href: "/academics/subjects",
          badge: "Curriculum",
        },
        {
          id: "action-mapping",
          title: "Map Subjects Matrix",
          subtitle: "Attach subjects and assign teachers across classes",
          category: "Actions",
          href: "/academics/mapping",
          badge: "Matrix",
        },
        {
          id: "action-hr",
          title: "Staff & HR Dashboard",
          subtitle: "Manage teaching and non-teaching staff onboarding",
          category: "Actions",
          href: "/hr",
          badge: "Staff",
        }
      );
    }

    // Filter actions if query exists
    const matchingActions = trimmed
      ? baseActions.filter(
          (a) =>
            a.title.toLowerCase().includes(trimmed) ||
            (a.subtitle && a.subtitle.toLowerCase().includes(trimmed))
        )
      : baseActions;

    results.push(...matchingActions);

    // If query is provided, search entities
    if (trimmed.length > 0) {
      // 1. Search Classes
      const classRows = await db.query.classes.findMany({
        where: and(
          eq(classes.schoolId, school.id),
          or(
            ilike(classes.displayName, `%${trimmed}%`),
            ilike(classes.gradeLevel, `%${trimmed}%`)
          )
        ),
        limit: 5,
        columns: { id: true, displayName: true, gradeLevel: true },
      });

      for (const cls of classRows) {
        results.push({
          id: `class-${cls.id}`,
          title: cls.displayName,
          subtitle: `Grade ${cls.gradeLevel} • Open Class Hub`,
          category: "Jump to",
          href: `/academics/classes/${cls.id}`,
          badge: "Class",
        });
      }

      // 2. Search Subjects
      const subjectRows = await db.query.subjects.findMany({
        where: and(
          eq(subjects.schoolId, school.id),
          or(
            ilike(subjects.name, `%${trimmed}%`),
            ilike(subjects.code, `%${trimmed}%`)
          )
        ),
        limit: 5,
        columns: { id: true, name: true, code: true, subjectType: true },
      });

      for (const sub of subjectRows) {
        results.push({
          id: `subject-${sub.id}`,
          title: sub.name,
          subtitle: `Code: ${sub.code} • ${sub.subjectType}`,
          category: "Jump to",
          href: `/academics/subjects`,
          badge: "Subject",
        });
      }

      // 3. Search Students
      const studentRows = await db.query.students.findMany({
        where: and(
          eq(students.schoolId, school.id),
          or(
            ilike(students.admissionNumber, `%${trimmed}%`),
            ilike(students.rollNumber, `%${trimmed}%`)
          )
        ),
        limit: 5,
        columns: {
          id: true,
          admissionNumber: true,
          rollNumber: true,
          firstNameEncrypted: true,
          lastNameEncrypted: true,
        },
      });

      for (const s of studentRows) {
        let fullName = "Student";
        try {
          const fn = s.firstNameEncrypted ? decryptData(s.firstNameEncrypted) : "";
          const ln = s.lastNameEncrypted ? decryptData(s.lastNameEncrypted) : "";
          fullName = `${fn} ${ln}`.trim() || `Adm #${s.admissionNumber}`;
        } catch {
          fullName = `Adm #${s.admissionNumber}`;
        }

        results.push({
          id: `student-${s.id}`,
          title: fullName,
          subtitle: `Adm: ${s.admissionNumber}${s.rollNumber ? ` • Roll: ${s.rollNumber}` : ""}`,
          category: "Jump to",
          href: `/students/${s.id}`,
          badge: "Student 360",
        });
      }
    }

    return results;
  } catch (error) {
    console.error("searchEverything error:", error);
    return [];
  }
}
