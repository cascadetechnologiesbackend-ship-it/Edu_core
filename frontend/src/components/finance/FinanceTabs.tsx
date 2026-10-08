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
  { id: "incomes", label: "Incomes", href: "/school/accounts/incomes" },
  { id: "expenses", label: "Expenses", href: "/school/accounts/expenses" },
  { id: "bank-accounts", label: "Bank Accounts", href: "/school/accounts/bank-accounts" },
  { id: "income-heads", label: "Income Heads", href: "/school/accounts/income-heads" },
  { id: "expense-heads", label: "Expense Heads", href: "/school/accounts/expense-heads" },
];

export interface FinanceTabsProps {
  primaryTabs?: FinanceTabItem[];
  overflowTabs?: FinanceTabItem[];
  activeSection?: "finance" | "accounts";
  storageKey?: string;
  className?: string;
}

export function FinanceTabs({
  primaryTabs,
  overflowTabs,
  activeSection = "finance",
  storageKey = "finance_active_tab",
  className,
}: FinanceTabsProps) {
  const effectivePrimary =
    primaryTabs ||
    (activeSection === "accounts"
      ? DEFAULT_ACCOUNTS_PRIMARY_TABS
      : DEFAULT_FINANCE_PRIMARY_TABS);

  const effectiveOverflow =
    overflowTabs ||
    (activeSection === "accounts" ? [] : DEFAULT_FINANCE_OVERFLOW_TABS);

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
    <div className={cn("flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-slate-800 pb-2", className)}>
      <nav className="flex flex-wrap items-center gap-1.5" aria-label="Finance Navigation Tabs">
        {effectivePrimary.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.id}
              href={tab.href as any}
              className={cn(
                "relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-indigo-600 text-white shadow-sm font-semibold dark:bg-indigo-500"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 text-[11px] font-bold rounded-full",
                    isActive
                      ? "bg-white/20 text-white"
                      : tab.badgeVariant === "destructive"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                      : tab.badgeVariant === "warning"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                      : "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200"
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
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150",
                isOverflowActive
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80"
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
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
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
                          "flex items-center justify-between px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-indigo-50 text-indigo-600 font-semibold dark:bg-indigo-950/50 dark:text-indigo-400"
                            : "text-gray-700 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800"
                        )}
                      >
                        <span>{tab.label}</span>
                        {tab.badge !== undefined && (
                          <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400">
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
