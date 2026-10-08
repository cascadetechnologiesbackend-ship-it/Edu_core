export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeHeads, feeStructures, classes, academicYears } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { FeeSetupWorkspace } from "@/features/fees";
import { getCached, setCached } from "@/lib/cache";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { QuickActionBar } from "@/components/finance/QuickActionBar";
import { LayoutTemplate } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Fee Setup & Class Pricing Matrix | SchoolMitra ERP",
  description: "Configure fee heads, allocation priorities, and class-wise fee pricing matrix.",
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
      <div className="space-y-6">
        <FinanceTabs activeSection="finance" />
        <div className="p-8 max-w-4xl mx-auto text-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm">
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

  const mappedYears = allYears.map((y) => ({
    id: y.id,
    label: y.label || `${y.startDate.getFullYear()}-${y.endDate.getFullYear()}`,
    isActive: y.isActive,
  }));

  const activeYearItem = {
    id: activeYear.id,
    label: activeYear.label || `${activeYear.startDate.getFullYear()}-${activeYear.endDate.getFullYear()}`,
    isActive: activeYear.isActive,
  };

  return (
    <div className="space-y-6">
      <FinanceTabs activeSection="finance" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <LayoutTemplate className="w-3.5 h-3.5" /> Setup Architecture & Pricing
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Fee Setup & Class Pricing Matrix
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Configure fee heads master, allocation priorities, and class-wise fee pricing matrix for {activeYearItem.label}.
          </p>
        </div>

        <QuickActionBar userRole={ctx.role} />
      </div>

      {/* Workspace */}
      <FeeSetupWorkspace
        activeYear={activeYearItem}
        allAcademicYears={mappedYears}
        classes={allClasses as any}
        feeHeads={allHeads as any}
        existingStructures={existingStructures as any}
      />
    </div>
  );
}
