export const dynamic = "force-dynamic";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Percent, ShieldCheck } from "lucide-react";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db } from "@/db";
import { academicYears } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateConcessionSummaryReport } from "@schoolmitra/backend/lib/financialReportsEngine";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { ConcessionSummaryClient } from "./ConcessionSummaryClient";

interface ConcessionSummaryPageProps {
  searchParams?: {
    academicYearId?: string;
  };
}

export default async function ConcessionSummaryReportPage({
  searchParams,
}: ConcessionSummaryPageProps) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "ACCOUNTANT",
    "PRINCIPAL",
  ] as const);
  const school = await requireSchool(ctx);

  const [allYears, initialReport] = await Promise.all([
    db.query.academicYears.findMany({
      where: eq(academicYears.schoolId, school.id),
      orderBy: [desc(academicYears.startDate)],
    }),
    generateConcessionSummaryReport(school.id, searchParams?.academicYearId || null),
  ]);

  const yearOptions = allYears.map((y) => ({
    id: y.id,
    label: y.label,
    isActive: y.isActive,
    isLocked: y.isLocked,
  }));

  const isAdmin = ctx.role === "SUPER_ADMIN" || ctx.role === "SCHOOL_ADMIN";

  return (
    <div className="space-y-6 p-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/school/accounting/reports"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Financial Reports Hub
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Concession & Waiver Summary Report
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Revenue foregone analysis aggregated by Policy × Term × Class for {school.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <Percent className="w-3.5 h-3.5" />
            ACC-07 Revenue Realization
          </span>
          {!isAdmin && (
            <span className="text-xs px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-medium">
              Read-Only View
            </span>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <FinanceTabs activeSection="accounts" />

      {/* Interactive Report View */}
      <ConcessionSummaryClient
        initialReport={initialReport}
        academicYears={yearOptions}
        userRole={ctx.role}
      />
    </div>
  );
}
