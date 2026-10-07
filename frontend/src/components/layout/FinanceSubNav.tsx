"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Clock,
  ListOrdered,
  Layers,
  Percent,
  UserCheck,
  FileText,
  History,
  ArrowRightLeft,
  ShieldCheck,
  UploadCloud,
  DollarSign,
  TrendingDown,
  Building,
  BarChart3,
  BookOpen,
} from "lucide-react";

interface FinanceSubNavProps {
  activeSection?: "operations" | "setup" | "audit" | "accounts" | "analytics";
}

export function FinanceSubNav({ activeSection }: FinanceSubNavProps) {
  const pathname = usePathname();

  const links = [
    // Dashboards
    {
      group: "Dashboards",
      items: [
        { href: "/school/fees-dashboard", label: "Fees Dashboard", icon: BarChart3 },
        { href: "/school/accounting/dashboard", label: "Accounts Hub", icon: BookOpen },
      ],
    },
    // Layer 1: Operations
    {
      group: "Operations",
      items: [
        { href: "/school/collect-fees", label: "Collect Fees", icon: CreditCard },
        { href: "/school/due-fees", label: "Search Due Fees", icon: Clock },
        { href: "/school/transactions", label: "All Transactions", icon: ListOrdered },
        { href: "/school/online-payments", label: "Online Gateway", icon: DollarSign },
        { href: "/school/fee-challans", label: "Fee Challans", icon: FileText },
      ],
    },
    // Layer 1: Setup & Structure
    {
      group: "Setup & Rules",
      items: [
        { href: "/school/fee-types", label: "Fee Types (Heads)", icon: ListOrdered },
        { href: "/school/fee-groups", label: "Fee Groups", icon: Layers },
        { href: "/school/fees-discount", label: "Discounts & Concessions", icon: Percent },
        { href: "/school/assign-fees", label: "Assign Fees Matrix", icon: UserCheck },
      ],
    },
    // Layer 1: Processing & Audit
    {
      group: "Processing & Audit",
      items: [
        { href: "/school/generate-due-slip", label: "Due Slips", icon: FileText },
        { href: "/school/due-slip-history", label: "Slip History", icon: History },
        { href: "/school/fees-carry-forward", label: "Carry Forward", icon: ArrowRightLeft },
        { href: "/school/fee-audit", label: "Data Audit", icon: ShieldCheck },
        { href: "/school/import-center", label: "Import Center", icon: UploadCloud },
      ],
    },
    // Layer 2: Accounts
    {
      group: "Accounts & Ledger",
      items: [
        { href: "/school/accounts/incomes", label: "Incomes", icon: DollarSign },
        { href: "/school/accounts/expenses", label: "Expenses", icon: TrendingDown },
        { href: "/school/accounts/bank-accounts", label: "Bank Accounts", icon: Building },
        { href: "/school/accounts/income-heads", label: "Income Heads", icon: ListOrdered },
        { href: "/school/accounts/expense-heads", label: "Expense Heads", icon: ListOrdered },
      ],
    },
  ];

  return (
    <div className="w-full bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 rounded-xl shadow-sm mb-6 p-2 overflow-x-auto">
      <div className="flex items-center gap-6 min-w-max px-2">
        {links.map((section) => (
          <div key={section.group} className="flex items-center gap-1.5 border-r border-gray-100 dark:border-slate-800 pr-5 last:border-r-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mr-1 select-none">
              {section.group}:
            </span>
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm font-semibold"
                      : "text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
