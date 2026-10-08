"use client";

import React, { useState } from "react";
import {
  Receipt,
  ArrowRightLeft,
  FilePlus,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Search,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
} from "lucide-react";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import {
  JournalVoucherListItem,
  JVRowInput,
  createContraEntryAction,
  createGeneralJournalVoucherAction,
} from "./actions";

interface ChartAccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface BankAccountOption {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  currentBalance: string;
}

interface Props {
  initialVouchers: JournalVoucherListItem[];
  chartAccounts: ChartAccountOption[];
  bankAccounts: BankAccountOption[];
  userRole: string;
}

export function JournalVouchersClient({
  initialVouchers,
  chartAccounts,
  bankAccounts,
  userRole,
}: Props) {
  const [activeTab, setActiveTab] = useState<"register" | "contra" | "general_jv">("register");
  const [vouchers, setVouchers] = useState<JournalVoucherListItem[]>(initialVouchers);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const canPostVouchers = userRole === "SUPER_ADMIN" || userRole === "SCHOOL_ADMIN";

  // ─── Contra State ─────────────────────────────────────────────────────────────
  const [contraForm, setContraForm] = useState<{
    transferType: "CASH_TO_BANK" | "BANK_TO_CASH" | "BANK_TO_BANK";
    fromBankAccountId: string;
    toBankAccountId: string;
    amount: number;
    entryDate: string;
    description: string;
  }>({
    transferType: "CASH_TO_BANK",
    fromBankAccountId: bankAccounts[0]?.id || "",
    toBankAccountId: bankAccounts[0]?.id || "",
    amount: 0,
    entryDate: new Date().toISOString().slice(0, 10),
    description: "Cash deposited into school bank account",
  });
  const [contraSubmitting, setContraSubmitting] = useState(false);

  // ─── General JV State ────────────────────────────────────────────────────────
  const [jvDate, setJvDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [jvDescription, setJvDescription] = useState<string>("");
  const [jvRows, setJvRows] = useState<JVRowInput[]>([
    { accountId: chartAccounts[0]?.id || "", type: "DEBIT", amount: 0 },
    { accountId: chartAccounts[1]?.id || "", type: "CREDIT", amount: 0 },
  ]);
  const [jvSubmitting, setJvSubmitting] = useState(false);

  // Calculate live sums for JV
  const totalDebits = jvRows
    .filter((r) => r.type === "DEBIT")
    .reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalCredits = jvRows
    .filter((r) => r.type === "CREDIT")
    .reduce((sum, r) => sum + (r.amount || 0), 0);
  const jvDifference = Math.abs(totalDebits - totalCredits);
  const isJvBalanced = jvDifference < 0.01 && totalDebits > 0 && jvRows.length >= 2;

  const handleAddJvRow = () => {
    setJvRows([
      ...jvRows,
      {
        accountId: chartAccounts[0]?.id || "",
        type: totalDebits > totalCredits ? "CREDIT" : "DEBIT",
        amount: Math.abs(totalDebits - totalCredits) || 0,
      },
    ]);
  };

  const handleRemoveJvRow = (index: number) => {
    if (jvRows.length <= 2) return;
    setJvRows(jvRows.filter((_, i) => i !== index));
  };

  const handleJvRowChange = (index: number, field: keyof JVRowInput, value: any) => {
    const updated = [...jvRows];
    const currentRow = updated[index];
    if (!currentRow) return;

    if (field === "amount") {
      currentRow.amount = parseFloat(value) || 0;
    } else if (field === "type") {
      currentRow.type = value as "DEBIT" | "CREDIT";
    } else if (field === "accountId") {
      currentRow.accountId = value as string;
    }
    setJvRows(updated);
  };

  const handleContraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPostVouchers) return;
    if (contraForm.amount <= 0) {
      setFeedback({ type: "error", message: "Amount must be greater than zero." });
      return;
    }

    setContraSubmitting(true);
    setFeedback(null);
    const res = await createContraEntryAction({
      transferType: contraForm.transferType,
      fromBankAccountId: contraForm.fromBankAccountId || undefined,
      toBankAccountId: contraForm.toBankAccountId || undefined,
      amount: contraForm.amount,
      entryDate: contraForm.entryDate,
      description: contraForm.description,
    });
    setContraSubmitting(false);

    if (res.success) {
      setFeedback({ type: "success", message: res.message || "Contra entry posted successfully." });
      setContraForm({
        ...contraForm,
        amount: 0,
        description: "Cash deposited into school bank account",
      });
      setTimeout(() => window.location.reload(), 1000);
    } else {
      setFeedback({ type: "error", message: res.message || "Failed to post Contra entry." });
    }
  };

  const handleJvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPostVouchers) return;
    if (!isJvBalanced) {
      setFeedback({
        type: "error",
        message: `Voucher is unbalanced! Debits: ₹${totalDebits.toFixed(2)}, Credits: ₹${totalCredits.toFixed(2)}.`,
      });
      return;
    }

    setJvSubmitting(true);
    setFeedback(null);
    const res = await createGeneralJournalVoucherAction({
      entries: jvRows,
      entryDate: jvDate,
      description: jvDescription || "General Journal Voucher",
    });
    setJvSubmitting(false);

    if (res.success) {
      setFeedback({ type: "success", message: res.message || "Journal voucher posted successfully." });
      setJvDescription("");
      setTimeout(() => window.location.reload(), 1000);
    } else {
      setFeedback({ type: "error", message: res.message || "Failed to post Journal Voucher." });
    }
  };

  // Filtered vouchers for register
  const filteredVouchers = vouchers.filter((v) => {
    if (filterType !== "ALL" && v.sourceType !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = v.transactionNumber.toLowerCase().includes(q);
      const matchDesc = v.description?.toLowerCase().includes(q) || false;
      const matchDebit = v.debitAccountName.toLowerCase().includes(q);
      const matchCredit = v.creditAccountName.toLowerCase().includes(q);
      if (!matchNum && !matchDesc && !matchDebit && !matchCredit) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Finance Navigation Tabs */}
      <FinanceTabs activeSection="accounts" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Receipt className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Journal Vouchers & Contra Entries (ACC-04)
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Record cash-bank contra movements and multi-row general journal vouchers with real-time balance validation.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex rounded-xl bg-gray-100 dark:bg-slate-800 p-1 text-sm font-semibold">
          <button
            onClick={() => setActiveTab("register")}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              activeTab === "register"
                ? "bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white"
                : "text-gray-600 dark:text-slate-400"
            }`}
          >
            <Receipt className="w-4 h-4" />
            Voucher Register
          </button>
          <button
            onClick={() => setActiveTab("contra")}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              activeTab === "contra"
                ? "bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white"
                : "text-gray-600 dark:text-slate-400"
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            New Contra
          </button>
          <button
            onClick={() => setActiveTab("general_jv")}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              activeTab === "general_jv"
                ? "bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white"
                : "text-gray-600 dark:text-slate-400"
            }`}
          >
            <FilePlus className="w-4 h-4" />
            New General JV
          </button>
        </div>
      </div>

      {/* Role Notice */}
      {!canPostVouchers && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-sm">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>
            <strong>Read-Only Mode ({userRole}):</strong> You can view all journal vouchers and contra transfers. Creating new entries requires School Admin or Super Admin authorization.
          </span>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border text-sm ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ─── TAB 1: VOUCHER REGISTER ─────────────────────────────────────────── */}
      {activeTab === "register" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search voucher #, account, narration..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs w-64 md:w-80"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
              >
                <option value="ALL">All Voucher Types</option>
                <option value="CONTRA">Contra Transfers</option>
                <option value="JOURNAL_VOUCHER">General JVs</option>
                <option value="BRS_ADJUSTMENT">BRS Adjustments</option>
              </select>
            </div>

            <span className="text-xs text-gray-500 font-medium">
              Showing {filteredVouchers.length} of {vouchers.length} entries
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/60 border-y border-gray-100 dark:border-slate-800 text-xs font-semibold text-gray-500">
                  <th className="py-3 px-4">DATE</th>
                  <th className="py-3 px-4">VOUCHER #</th>
                  <th className="py-3 px-4">TYPE</th>
                  <th className="py-3 px-4">DEBIT ACCOUNT</th>
                  <th className="py-3 px-4">CREDIT ACCOUNT</th>
                  <th className="py-3 px-4 text-right">AMOUNT</th>
                  <th className="py-3 px-4">NARRATION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 text-xs font-mono text-gray-600 dark:text-slate-300">
                      {v.transactionDate.slice(0, 10)}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-indigo-600">
                      {v.transactionNumber}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold ${
                          v.sourceType === "CONTRA"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40"
                            : v.sourceType === "JOURNAL_VOUCHER"
                            ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40"
                        }`}
                      >
                        {v.sourceType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {v.debitAccountName}
                      </span>
                      <span className="text-gray-400 font-mono ml-1">({v.debitAccountCode})</span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {v.creditAccountName}
                      </span>
                      <span className="text-gray-400 font-mono ml-1">({v.creditAccountCode})</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-gray-900 dark:text-white">
                      ₹{parseFloat(v.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600 dark:text-slate-300 truncate max-w-xs">
                      {v.description || "—"}
                    </td>
                  </tr>
                ))}
                {filteredVouchers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400 italic">
                      No matching vouchers found in the ledger.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 2: CONTRA ENTRY FORM ────────────────────────────────────────── */}
      {activeTab === "contra" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 max-w-2xl mx-auto space-y-6">
          <div className="border-b border-gray-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
              Record Contra Entry
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Internal liquidity transfers between cash vault and school bank accounts.
            </p>
          </div>

          <form onSubmit={handleContraSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Contra Transfer Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "CASH_TO_BANK", label: "Cash to Bank (Deposit)" },
                  { id: "BANK_TO_CASH", label: "Bank to Cash (Withdrawal)" },
                  { id: "BANK_TO_BANK", label: "Bank to Bank (Transfer)" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setContraForm({
                        ...contraForm,
                        transferType: t.id as any,
                        description:
                          t.id === "CASH_TO_BANK"
                            ? "Cash deposited into bank"
                            : t.id === "BANK_TO_CASH"
                            ? "Cash withdrawn from bank"
                            : "Inter-bank funds transfer",
                      })
                    }
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center transition ${
                      contraForm.transferType === t.id
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                        : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Source Bank (if applicable) */}
            {(contraForm.transferType === "BANK_TO_CASH" ||
              contraForm.transferType === "BANK_TO_BANK") && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Source Bank Account (From)
                </label>
                <select
                  value={contraForm.fromBankAccountId}
                  onChange={(e) =>
                    setContraForm({ ...contraForm, fromBankAccountId: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.accountNumber.slice(-4)} (Avail: ₹{parseFloat(b.currentBalance).toLocaleString("en-IN")})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Destination Bank (if applicable) */}
            {(contraForm.transferType === "CASH_TO_BANK" ||
              contraForm.transferType === "BANK_TO_BANK") && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Destination Bank Account (To)
                </label>
                <select
                  value={contraForm.toBankAccountId}
                  onChange={(e) =>
                    setContraForm({ ...contraForm, toBankAccountId: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.accountNumber.slice(-4)} (Avail: ₹{parseFloat(b.currentBalance).toLocaleString("en-IN")})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Transfer Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={contraForm.amount || ""}
                  onChange={(e) =>
                    setContraForm({ ...contraForm, amount: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Voucher Date
                </label>
                <input
                  type="date"
                  required
                  value={contraForm.entryDate}
                  onChange={(e) => setContraForm({ ...contraForm, entryDate: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Narration / Cheque / Slip Details
              </label>
              <input
                type="text"
                required
                value={contraForm.description}
                onChange={(e) => setContraForm({ ...contraForm, description: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={contraSubmitting || !canPostVouchers}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ArrowRightLeft className="w-4 h-4" />
                {contraSubmitting ? "Posting Contra Entry..." : "Post Contra Entry"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── TAB 3: MULTI-ROW GENERAL JOURNAL VOUCHER ────────────────────────── */}
      {activeTab === "general_jv" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FilePlus className="w-5 h-5 text-indigo-600" />
                General Journal Voucher
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Multi-row adjustment voucher between general ledger accounts. Debits and credits must balance.
              </p>
            </div>

            {/* Live Balance Status Badge */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                isJvBalanced
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-50 dark:bg-red-950/40 border-red-300 text-red-700 dark:text-red-300"
              }`}
            >
              {isJvBalanced ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Balanced (₹{totalDebits.toFixed(2)})
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Diff: ₹{jvDifference.toFixed(2)}
                </>
              )}
            </div>
          </div>

          <form onSubmit={handleJvSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Voucher Date
                </label>
                <input
                  type="date"
                  required
                  value={jvDate}
                  onChange={(e) => setJvDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  General Narration
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. End of year depreciation adjustment"
                  value={jvDescription}
                  onChange={(e) => setJvDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800/60 text-xs font-semibold text-gray-500">
                    <th className="py-2.5 px-3">CHART OF ACCOUNTS</th>
                    <th className="py-2.5 px-3 w-32">ENTRY TYPE</th>
                    <th className="py-2.5 px-3 w-40 text-right">AMOUNT (₹)</th>
                    <th className="py-2.5 px-3 w-16 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {jvRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/30">
                      <td className="py-2.5 px-3">
                        <select
                          value={row.accountId}
                          onChange={(e) => handleJvRowChange(idx, "accountId", e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                        >
                          {chartAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              [{a.code}] {a.name} ({a.type})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={row.type}
                          onChange={(e) => handleJvRowChange(idx, "type", e.target.value)}
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold ${
                            row.type === "DEBIT"
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40"
                              : "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40"
                          }`}
                        >
                          <option value="DEBIT">Debit (Dr)</option>
                          <option value="CREDIT">Credit (Cr)</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={row.amount || ""}
                          onChange={(e) => handleJvRowChange(idx, "amount", e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-right"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          disabled={jvRows.length <= 2}
                          onClick={() => handleRemoveJvRow(idx)}
                          className="text-gray-400 hover:text-red-500 disabled:opacity-20 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleAddJvRow}
                className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-50 flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Account Row
              </button>

              <div className="flex items-center gap-6 text-xs font-semibold">
                <div>
                  <span className="text-gray-500 mr-2">Total Debits:</span>
                  <span className="font-mono text-indigo-600">₹{totalDebits.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500 mr-2">Total Credits:</span>
                  <span className="font-mono text-emerald-600">₹{totalCredits.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={!isJvBalanced || jvSubmitting || !canPostVouchers}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Receipt className="w-4 h-4" />
                {jvSubmitting ? "Posting Journal Voucher..." : "Post General Journal Voucher"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
