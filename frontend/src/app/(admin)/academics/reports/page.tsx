import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { classes, sections } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getActiveAcademicYear } from "../actions/auth-helper";
import { getTeacherWorkloadReport } from "../actions/reports.actions";
import ReportsClient from "./ReportsClient";

export const metadata: Metadata = {
  title: "Academic Reports — Educore AMS",
  description: "Operational academic reports: syllabus coverage, teacher workload, and assignments",
};

export default async function AcademicReportsPage() {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.schoolId) {
    redirect("/login");
  }

  const schoolId = session.user.schoolId;

  let activeYear;
  try {
    activeYear = await getActiveAcademicYear(schoolId);
  } catch {
    // If no active year is configured yet, fall back gracefully
    activeYear = null;
  }

  const allClasses = activeYear
    ? await db.query.classes.findMany({
        where: and(
          eq(classes.schoolId, schoolId),
          eq(classes.academicYearId, activeYear.id),
          eq(classes.isActive, true),
        ),
        with: {
          sections: {
            where: eq(sections.isActive, true),
            orderBy: [asc(sections.name)],
          },
          classSubjects: {
            with: {
              subject: { columns: { name: true, code: true } },
            },
          },
        },
        orderBy: [asc(classes.sortOrder), asc(classes.gradeLevel)],
      })
    : [];

  const initialWorkload = await getTeacherWorkloadReport().catch(() => []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <ReportsClient
        classes={allClasses as any}
        activeYearName={activeYear?.label || "Active Session"}
        initialTeacherWorkload={initialWorkload as any}
      />
    </div>
  );
}
