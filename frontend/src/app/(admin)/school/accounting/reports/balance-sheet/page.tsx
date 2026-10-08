import React from "react";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { generateBalanceSheetReport } from "@schoolmitra/backend/lib/financialReportsEngine";
import { BalanceSheetClient } from "./BalanceSheetClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface BalanceSheetPageProps {
  searchParams: {
    asOfDate?: string;
  };
}

export default async function BalanceSheetPage({ searchParams }: BalanceSheetPageProps) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
  const school = await requireSchool(ctx);

  const report = await generateBalanceSheetReport(school.id, {
    asOfDate: searchParams.asOfDate || null,
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/school/accounting/reports"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Financial Reports Hub
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Balance Sheet Statement
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Statement of institutional financial position and equity reserves for {school.name}
          </p>
        </div>
      </div>

      <FinanceTabs activeSection="accounts" />

      <BalanceSheetClient initialReport={report} userRole={ctx.role} />
    </div>
  );
}
