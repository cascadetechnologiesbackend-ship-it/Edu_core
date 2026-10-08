import React from "react";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { generateTrialBalanceReport } from "@schoolmitra/backend/lib/financialReportsEngine";
import { TrialBalanceClient } from "./TrialBalanceClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface TrialBalancePageProps {
  searchParams: {
    startDate?: string;
    endDate?: string;
  };
}

export default async function TrialBalancePage({ searchParams }: TrialBalancePageProps) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
  const school = await requireSchool(ctx);

  const report = await generateTrialBalanceReport(school.id, {
    startDate: searchParams.startDate || null,
    endDate: searchParams.endDate || null,
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
            Trial Balance Statement
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Verifies arithmetic balance of all debit and credit ledger balances for {school.name}
          </p>
        </div>
      </div>

      <FinanceTabs activeSection="accounts" />

      <TrialBalanceClient initialReport={report} userRole={ctx.role} />
    </div>
  );
}
