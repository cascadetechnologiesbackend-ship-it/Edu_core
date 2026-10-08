import React from "react";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { getBankReconciliationDataAction } from "./actions";
import { BankReconciliationClient } from "./BankReconciliationClient";

export const metadata = {
  title: "Bank Statement Reconciliation (BRS) | SchoolMitra",
  description: "Match statement lines against GL bank ledger, isolate ambiguous candidates, and post adjusting JVs.",
};

interface PageProps {
  searchParams: {
    bankAccountId?: string;
  };
}

export default async function BankReconciliationPage({ searchParams }: PageProps) {
  // RBAC: SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT, PRINCIPAL (read-only for non-admins)
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PRINCIPAL"] as const);
  const school = await requireSchool(ctx);

  const res = await getBankReconciliationDataAction(searchParams.bankAccountId);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      <BankReconciliationClient
        bankAccounts={res.bankAccounts.map((b) => ({
          id: b.id,
          bankName: b.bankName,
          accountName: b.accountName,
          accountNumber: b.accountNumber,
          ifscCode: b.ifscCode,
          currentBalance: b.currentBalance,
        }))}
        selectedAccount={
          res.selectedAccount
            ? {
                id: res.selectedAccount.id,
                bankName: res.selectedAccount.bankName,
                accountName: res.selectedAccount.accountName,
                accountNumber: res.selectedAccount.accountNumber,
                ifscCode: res.selectedAccount.ifscCode,
                currentBalance: res.selectedAccount.currentBalance,
              }
            : null
        }
        initialLedgerTransactions={res.ledgerTransactions}
        initialAdjustingVouchers={res.adjustingVouchers}
        userRole={ctx.role}
      />
    </div>
  );
}
