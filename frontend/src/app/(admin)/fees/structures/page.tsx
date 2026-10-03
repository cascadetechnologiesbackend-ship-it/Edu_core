import { db } from "@/db";
import { feeHeads, feeStructures, classes, academicYears } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { FeeSetupWorkspace } from "./FeeSetupWorkspace";
import { getCached, setCached } from "@/lib/cache";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export const metadata = {
  title: "Fee Setup Wizard & Pricing Matrix | SchoolMitra ERP",
  description:
    "Configure fee heads, allocation priorities, and class-wise fee pricing matrix.",
};

export default async function FeeStructuresPage() {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "ACCOUNTANT",
  ] as const);
  const school = await requireSchool(ctx);

  // 1. Fetch active academic year
  const activeYear = await db.query.academicYears.findFirst({
    where: and(
      eq(academicYears.isActive, true),
      eq(academicYears.schoolId, school.id),
    ),
  });

  if (!activeYear) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          No Active Academic Year Found
        </h2>
        <p className="text-sm text-gray-500">
          Please configure and activate an academic year before managing fee structures.
        </p>
        <Link
          href="/academics/setup/calendar"
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Go to Academic Calendar &rarr;
        </Link>
      </div>
    );
  }

  // 2. Parallelized high-performance data fetching
  const cacheKey = `feeStructures:${activeYear.id}`;
  const [allYears, allClasses, allHeads, cachedStructures] = await Promise.all([
    db.query.academicYears.findMany({
      where: eq(academicYears.schoolId, school.id),
      orderBy: [asc(academicYears.startDate)],
    }),
    db.query.classes.findMany({
      where: and(
        eq(classes.schoolId, school.id),
        eq(classes.academicYearId, activeYear.id),
        eq(classes.isActive, true),
      ),
      orderBy: [asc(classes.sortOrder)],
    }),
    db.query.feeHeads.findMany({
      where: and(
        eq(feeHeads.schoolId, school.id),
        eq(feeHeads.isActive, true),
      ),
      orderBy: [asc(feeHeads.priority)],
    }),
    getCached<any[]>(cacheKey),
  ]);

  let existingStructures = cachedStructures;
  if (!existingStructures) {
    existingStructures = await db.query.feeStructures.findMany({
      where: and(
        eq(feeStructures.schoolId, school.id),
        eq(feeStructures.academicYearId, activeYear.id),
        eq(feeStructures.isActive, true),
      ),
    });
    await setCached(cacheKey, existingStructures);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/fees" className="hover:text-blue-600 transition-colors">
              Fees Management
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-gray-900 dark:text-white font-medium">
              Setup Wizard & Matrix
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Fee Setup & Pricing Architecture
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure fee heads master, allocation priorities, and class-wise pricing matrices for {activeYear.label}.
          </p>
        </div>
      </div>

      {/* Main Tabbed Interactive Workspace */}
      <FeeSetupWorkspace
        activeYear={activeYear}
        allAcademicYears={allYears}
        classes={allClasses}
        feeHeads={allHeads as any}
        existingStructures={existingStructures}
      />
    </div>
  );
}
