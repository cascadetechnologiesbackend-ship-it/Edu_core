"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FinanceTabItem {
  id: string;
  label: string;
  href: string;
  badge?: number | string;
  badgeVariant?: "default" | "warning" | "destructive";
}

export const DEFAULT_FINANCE_PRIMARY_TABS: FinanceTabItem[] = [
  { id: "hub", label: "Finance Hub", href: "/school/fees-dashboard" },
  { id: "collect", label: "Collect Fee", href: "/school/collect-fees" },
  { id: "dues", label: "Dues", href: "/school/due-fees" },
  { id: "daybook", label: "Day Book", href: "/school/transactions" },
  { id: "concessions", label: "Concessions", href: "/school/fees-discount" },
  { id: "reconciliation", label: "Reconciliation", href: "/school/online-payments" },
];

export const DEFAULT_FINANCE_OVERFLOW_TABS: FinanceTabItem[] = [
  { id: "reports", label: "Reports", href: "/fees/reports" },
  { id: "pricing-matrix", label: "Pricing Matrix", href: "/school/fee-structures" },
  { id: "assign-fees", label: "Assign Fees", href: "/school/assign-fees" },
  { id: "fee-heads", label: "Fee Heads", href: "/school/fee-types" },
  { id: "fee-groups", label: "Fee Groups", href: "/school/fee-groups" },
  { id: "due-slips", label: "Due Slips", href: "/school/generate-due-slip" },
  { id: "challans", label: "Challans", href: "/school/fee-challans" },
  { id: "refunds", label: "Refunds", href: "/school/refunds" },
  { id: "carry-forward", label: "Carry Forward", href: "/school/fees-carry-forward" },
  { id: "import-center", label: "Import Center", href: "/school/import-center" },
  { id: "audit-log", label: "Audit Log", href: "/school/fee-audit" },
];

export const DEFAULT_ACCOUNTS_PRIMARY_TABS: FinanceTabItem[] = [
  { id: "accounts-hub", label: "Accounts Hub", href: "/school/accounting/dashboard" },
  { id: "reports", label: "Financial Reports", href: "/school/accounting/reports" },
  { id: "incomes", label: "Incomes", href: "/school/accounts/incomes" },
  { id: "expenses", label: "Expenses", href: "/school/accounts/expenses" },
  { id: "bank-accounts", label: "Bank Accounts", href: "/school/accounts/bank-accounts" },
  { id: "brs", label: "Bank Reconciliation", href: "/school/accounts/bank-reconciliation" },
  { id: "vouchers", label: "Journal & Contra", href: "/school/accounts/journal-vouchers" },
];

export const DEFAULT_ACCOUNTS_OVERFLOW_TABS: FinanceTabItem[] = [
  { id: "trial-balance", label: "Trial Balance", href: "/school/accounting/reports/trial-balance" },
  { id: "income-expenditure", label: "Income & Expenditure", href: "/school/accounting/reports/income-expenditure" },
  { id: "balance-sheet", label: "Balance Sheet", href: "/school/accounting/reports/balance-sheet" },
  { id: "concession-summary", label: "Concession Summary", href: "/school/accounting/reports/concessions" },
  { id: "income-heads", label: "Income Heads", href: "/school/accounts/income-heads" },
  { id: "expense-heads", label: "Expense Heads", href: "/school/accounts/expense-heads" },
];

export const ACCOUNTANT_FINANCE_PRIMARY_TABS: FinanceTabItem[] = [
  { id: "hub", label: "Finance Hub", href: "/school/fees-dashboard" },
  { id: "collect", label: "Collect Fee", href: "/school/collect-fees" },
  { id: "dues", label: "Dues Work List", href: "/school/due-fees" },
  { id: "daybook", label: "Day Book", href: "/school/transactions" },
  { id: "concessions", label: "Discounts & Concessions", href: "/school/fees-discount" },
  { id: "refunds", label: "Refunds", href: "/school/refunds" },
  { id: "pricing-matrix", label: "Pricing Matrix", href: "/school/fee-structures" },
];

export const ACCOUNTANT_ACCOUNTS_PRIMARY_TABS: FinanceTabItem[] = [
  { id: "accounts-hub", label: "Accounts Hub", href: "/school/accounting/dashboard" },
  { id: "concession-summary", label: "Concession Summary", href: "/school/accounting/reports/concessions" },
  { id: "brs", label: "BRS Reconcile", href: "/school/accounts/bank-reconciliation" },
];

export interface FinanceTabsProps {
  primaryTabs?: FinanceTabItem[];
  overflowTabs?: FinanceTabItem[];
  activeSection?: "finance" | "accounts";
  storageKey?: string;
  className?: string;
  userRole?: string;
}

export function FinanceTabs({
  primaryTabs,
  overflowTabs,
  activeSection = "finance",
  storageKey = "finance_active_tab",
  className,
  userRole,
}: FinanceTabsProps) {
  const isAccountant = userRole === "ACCOUNTANT";

  const effectivePrimary =
    primaryTabs ||
    (isAccountant
      ? activeSection === "accounts"
        ? ACCOUNTANT_ACCOUNTS_PRIMARY_TABS
        : ACCOUNTANT_FINANCE_PRIMARY_TABS
      : activeSection === "accounts"
      ? DEFAULT_ACCOUNTS_PRIMARY_TABS
      : DEFAULT_FINANCE_PRIMARY_TABS);

  const effectiveOverflow =
    overflowTabs ||
    (isAccountant
      ? []
      : activeSection === "accounts"
      ? DEFAULT_ACCOUNTS_OVERFLOW_TABS
      : DEFAULT_FINANCE_OVERFLOW_TABS);

  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Store active tab preference in localStorage
  useEffect(() => {
    const currentTab = [...effectivePrimary, ...effectiveOverflow].find(
      (t) => pathname === t.href || pathname.startsWith(t.href + "/")
    );
    if (currentTab && typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, currentTab.id);
      } catch {}
    }
  }, [pathname, effectivePrimary, effectiveOverflow, storageKey]);

  const isOverflowActive = effectiveOverflow.some(
    (t) => pathname === t.href || pathname.startsWith(t.href + "/")
  );

  return (
    <div className={cn("border-b border-border/40 pb-2", className)}>
      <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1" aria-label="Finance Navigation Tabs">
        {effectivePrimary.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.id}
              href={tab.href as any}
              className={cn(
                "relative inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] shrink-0 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-semantic-interactive/40",
                isActive
                  ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 text-[11px] font-bold rounded-full",
                    isActive
                      ? "bg-muted text-foreground"
                      : tab.badgeVariant === "destructive"
                      ? "bg-semantic-money-owed/15 text-semantic-money-owed"
                      : tab.badgeVariant === "warning"
                      ? "bg-semantic-attention/15 text-semantic-attention"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </Link>
          );
        })}

        {effectiveOverflow.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-semantic-interactive/40",
                isOverflowActive
                  ? "bg-card text-foreground font-semibold border border-border/50 shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              <MoreHorizontal className="w-4 h-4" />
              <span>More</span>
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", dropdownOpen && "rotate-180")} />
            </button>

            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-card border border-border/40 shadow-level-3 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-card-foreground">
                  <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    Setup & Operations
                  </div>
                  {effectiveOverflow.map((tab) => {
                    const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
                    return (
                      <Link
                        key={tab.id}
                        href={tab.href as any}
                        onClick={() => setDropdownOpen(false)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 text-sm transition-colors rounded-xl mx-1",
                          isActive
                            ? "bg-muted text-foreground font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        )}
                      >
                        <span>{tab.label}</span>
                        {tab.badge !== undefined && (
                          <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground">
                            {tab.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}
