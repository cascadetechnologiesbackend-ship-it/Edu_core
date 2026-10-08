"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  Search,
  BookOpen,
  Building2,
  Receipt,
  FileCheck,
  ShieldCheck,
  Percent,
  History,
  TrendingUp,
  RotateCcw,
} from "lucide-react";

export interface FinanceCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCollect?: () => void;
  onSelectIncome?: () => void;
  onSelectExpense?: () => void;
}

export function FinanceCommandPalette({
  open,
  onOpenChange,
  onSelectCollect,
  onSelectIncome,
  onSelectExpense,
}: FinanceCommandPaletteProps) {
  const router = useRouter();

  // Listen to Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-28 px-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="fixed inset-0 -z-10"
        onClick={() => onOpenChange(false)}
      />

      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <Command label="Finance Quick Jump & Actions" className="w-full">
          <div className="flex items-center px-4 border-b border-gray-200 dark:border-slate-800">
            <Search className="w-5 h-5 text-gray-400 mr-2 shrink-0" />
            <Command.Input
              placeholder="Type a screen, command, or action... (e.g. collect, dues, expense)"
              className="w-full py-4 text-base bg-transparent border-0 outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
              autoFocus
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 space-y-1">
            <Command.Empty className="py-8 text-center text-sm text-gray-500">
              No matching finance screens or commands found.
            </Command.Empty>

            <Command.Group heading="Quick Actions" className="text-xs font-semibold text-gray-400 px-2 py-1">
              <Command.Item
                onSelect={() =>
                  runCommand(() => {
                    if (onSelectCollect) onSelectCollect();
                    else router.push("/school/collect-fees");
                  })
                }
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>Collect Fees at Counter</span>
              </Command.Item>

              <Command.Item
                onSelect={() =>
                  runCommand(() => {
                    if (onSelectIncome) onSelectIncome();
                    else router.push("/school/accounts/incomes");
                  })
                }
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 cursor-pointer"
              >
                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                <span>Record Misc / Counter Income</span>
              </Command.Item>

              <Command.Item
                onSelect={() =>
                  runCommand(() => {
                    if (onSelectExpense) onSelectExpense();
                    else router.push("/school/accounts/expenses");
                  })
                }
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600 cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4 text-amber-600" />
                <span>Submit Expense Voucher</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Finance & Fees Screens" className="text-xs font-semibold text-gray-400 px-2 py-1">
              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/fees-dashboard"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <TrendingUp className="w-4 h-4 text-gray-500" />
                <span>Finance Hub & Analytics</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/due-fees"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-gray-500" />
                <span>Dues & Defaulter Work List</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/transactions"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <Receipt className="w-4 h-4 text-gray-500" />
                <span>Day Book & Transactions Ledger</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/fees-discount"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <Percent className="w-4 h-4 text-gray-500" />
                <span>Discounts & Concessions Workbench</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/online-payments"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <FileCheck className="w-4 h-4 text-gray-500" />
                <span>Online Gateway Reconciliation Queue</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/fee-challans"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-gray-500" />
                <span>Bank Challans Lifecycle</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/due-slip-history"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <History className="w-4 h-4 text-gray-500" />
                <span>Due Slips History & Batch Print</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/refunds"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-gray-500" />
                <span>Fee Refunds & Reversals Workbench</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Accounts & Ledger Screens" className="text-xs font-semibold text-gray-400 px-2 py-1">
              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/accounting/dashboard"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-gray-500" />
                <span>Accounts & Treasury Hub</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/accounting/reports/trial-balance"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Trial Balance Statement</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/accounting/reports/income-expenditure"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Income & Expenditure Statement</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/accounting/reports/balance-sheet"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-violet-600" />
                <span>Balance Sheet Report</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/accounting/reports/concessions"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <Percent className="w-4 h-4 text-purple-600" />
                <span>Concession & Waiver Summary Report</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/accounts/bank-reconciliation"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <FileCheck className="w-4 h-4 text-blue-600" />
                <span>Bank Statement Reconciliation (BRS)</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/accounts/journal-vouchers"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <Receipt className="w-4 h-4 text-amber-600" />
                <span>Journal Vouchers & Contra Entries</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/accounts/bank-accounts"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-gray-500" />
                <span>Bank Accounts Master</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => router.push("/school/fee-audit"))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-gray-500" />
                <span>Financial & Fee Audit Logs</span>
              </Command.Item>
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-800 text-[11px] text-gray-400">
            <span>Navigation: Use ↑ ↓ and ↵ to select</span>
            <span>ESC to close</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
