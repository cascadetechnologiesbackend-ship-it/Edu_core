export const dynamic = "force-dynamic";

import { db } from "@/db";
import { bankAccounts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import {
  Building2,
  Plus,
  Landmark,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { createBankAccount, toggleBankAccountStatus } from "./actions";

export default async function BankAccountsPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const access = assertRouteAccess(session.user.role, "/school/accounts/bank-accounts", {
    id: session.user.id,
    email: session.user.email ?? undefined,
    schoolId: session.user.schoolId,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = session.user.schoolId;
  const canManageBanks =
    session.user.role === "SUPER_ADMIN" || session.user.role === "SCHOOL_ADMIN";

  const accounts = await db.query.bankAccounts.findMany({
    where: eq(bankAccounts.schoolId, schoolId),
    orderBy: [desc(bankAccounts.createdAt)],
  });

  const totalBalance = accounts.reduce(
    (sum, acc) => sum + parseFloat(acc.currentBalance || "0"),
    0
  );

  return (
    <div className="space-y-6">
      <FinanceTabs activeSection="accounts" userRole={session.user.role} />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-2xl border border-border/40 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Landmark className="w-3.5 h-3.5" /> General Ledger Master
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-2">
            Bank Accounts & Vault Registry
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register official institutional bank accounts, cash chests, and manage opening balance liquidity.
          </p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-5 py-3 rounded-2xl flex items-center gap-3">
          <Wallet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          <div>
            <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Total Institutional Liquidity
            </div>
            <div className="text-xl font-extrabold text-emerald-900 dark:text-emerald-200 font-mono">
              ₹{totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      <div className={canManageBanks ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : "grid grid-cols-1 gap-6"}>
        {/* New Bank Account Form (Admin-only) */}
        {canManageBanks && (
        <div className="bg-card p-6 rounded-2xl border border-border/40 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <Plus className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-foreground">
              Add New Bank Account
            </h2>
          </div>

          <form
            action={async (formData) => {
              "use server";
              await createBankAccount(formData);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Bank Name *
              </label>
              <input
                type="text"
                name="bankName"
                placeholder="e.g. State Bank of India, HDFC Bank"
                required
                className="w-full text-xs rounded-xl border border-border/40 bg-card px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Account Holder / Name *
              </label>
              <input
                type="text"
                name="accountName"
                placeholder="e.g. SchoolMitra Public School - Ops"
                required
                className="w-full text-xs rounded-xl border border-border/40 bg-card px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Account Number *
              </label>
              <input
                type="text"
                name="accountNumber"
                placeholder="e.g. 50100239482910"
                required
                className="w-full text-xs rounded-xl border border-border/40 bg-card px-3 py-2.5 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  IFSC Code
                </label>
                <input
                  type="text"
                  name="ifscCode"
                  placeholder="e.g. SBIN0001234"
                  className="w-full text-xs rounded-xl border border-border/40 bg-card px-3 py-2.5 text-foreground uppercase font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Branch
                </label>
                <input
                  type="text"
                  name="branchName"
                  placeholder="e.g. Connaught Place"
                  className="w-full text-xs rounded-xl border border-border/40 bg-card px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Opening Balance (₹)
              </label>
              <input
                type="number"
                step="0.01"
                name="openingBalance"
                placeholder="0.00"
                defaultValue="0"
                className="w-full text-xs rounded-xl border border-border/40 bg-card px-3 py-2.5 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition"
            >
              <Building2 className="w-4 h-4" /> Save Bank Account
            </button>
          </form>
        </div>
        )}

        {/* Existing Accounts List */}
        <div className={`${canManageBanks ? "lg:col-span-2" : ""} bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden flex flex-col`}>
          <div className="p-6 border-b border-border/40">
            <h3 className="text-base font-bold text-foreground">
              Registered Bank Accounts ({accounts.length})
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Active ledger accounts linked to receipt collections and expense disbursements.
            </p>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border/40 text-muted-foreground uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Bank & Account</th>
                  <th className="py-3 px-4">Account Number</th>
                  <th className="py-3 px-4">Branch / IFSC</th>
                  <th className="py-3 px-4 text-right">Current Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-foreground">
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No institutional bank accounts registered yet. Add your primary school account using the form.
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-muted/40">
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">
                          {acc.bankName}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                          {acc.accountName}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-foreground">
                        {acc.accountNumber}
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        <div>{acc.branchName || "—"}</div>
                        <div className="font-mono text-gray-500">{acc.ifscCode || "—"}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{parseFloat(acc.currentBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            acc.isActive
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                              : "bg-muted/60 text-gray-500 border-border/40"
                          }`}
                        >
                          {acc.isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Inactive
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {canManageBanks ? (
                          <form
                            action={async () => {
                              "use server";
                              await toggleBankAccountStatus(acc.id, !acc.isActive);
                            }}
                          >
                            <button
                              type="submit"
                              className="text-[11px] font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white underline"
                            >
                              {acc.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </form>
                        ) : (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            View Only
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
