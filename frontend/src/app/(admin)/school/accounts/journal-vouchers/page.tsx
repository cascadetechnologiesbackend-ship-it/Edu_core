import React from "react";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { getJournalVouchersAction, getChartOfAccountsForJVAction } from "./actions";
import { JournalVouchersClient } from "./JournalVouchersClient";

export const metadata = {
  title: "Journal Vouchers & Contra Entries | SchoolMitra",
  description: "Record cash-bank contra entries and multi-row general journal adjustments.",
};

interface PageProps {
  searchParams: {
    sourceType?: string;
  };
}

export default async function JournalVouchersPage({ searchParams }: PageProps) {
  // RBAC: SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT, PRINCIPAL (read-only for non-admins)
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PRINCIPAL"] as const);
  const school = await requireSchool(ctx);

  const [vouchersRes, accountsRes] = await Promise.all([
    getJournalVouchersAction({ sourceType: searchParams.sourceType }),
    getChartOfAccountsForJVAction(),
  ]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      <JournalVouchersClient
        initialVouchers={vouchersRes.items}
        chartAccounts={accountsRes.accounts}
        bankAccounts={accountsRes.bankAccounts}
        userRole={ctx.role}
      />
    </div>
  );
}
