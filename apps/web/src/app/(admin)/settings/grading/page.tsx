import { db } from "@/db";
import { gradeRules } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Metadata } from "next";
import { GradeRulesManager } from "./GradeRulesManager";

export const metadata: Metadata = {
  title: "Grading Configuration | SchoolMitra ERP",
};

const CLASS_GROUPS = [
  { value: "NURSERY_UKG", label: "Nursery / LKG / UKG" },
  { value: "CLASS_1_5", label: "Class 1 – 5" },
  { value: "CLASS_6_8", label: "Class 6 – 8" },
  { value: "CLASS_9_10", label: "Class 9 – 10" },
] as const;

export default async function GradingSettingsPage() {
  const school = await db.query.schools.findFirst();

  const allRules = school
    ? await db.query.gradeRules.findMany({
        where: eq(gradeRules.schoolId, school.id),
        orderBy: (t, { asc }) => [asc(t.classGroup), asc(t.minPercent)],
      })
    : [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Grading Configuration
        </h1>
        <p className="text-sm text-gray-500">
          Configure grade boundaries for each class group. These rules power
          automatic grade calculation when teachers enter marks.
        </p>
      </div>

      {school ? (
        <GradeRulesManager
          schoolId={school.id}
          classGroups={CLASS_GROUPS}
          existingRules={allRules.map((r) => ({
            id: r.id,
            classGroup: r.classGroup,
            minPercent: parseFloat(r.minPercent),
            maxPercent: parseFloat(r.maxPercent),
            grade: r.grade,
            gradePoint: parseFloat(r.gradePoint),
            description: r.description ?? "",
          }))}
        />
      ) : (
        <div className="p-8 text-center text-gray-500">
          No school found. Please complete school setup first.
        </div>
      )}
    </div>
  );
}
