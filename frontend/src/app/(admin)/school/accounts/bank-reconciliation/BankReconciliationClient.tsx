"use client";

import React, { useState } from "react";
import {
  Building2,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileCheck,
  PlusCircle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Download,
} from "lucide-react";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import {
  BankStatementRowInput,
  MatchedResultItem,
  matchBankStatementAction,
  createAdjustingJournalVoucherAction,
} from "./actions";

interface BankAccountSummary {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string | null;
  currentBalance: string;
}

interface LedgerTxSummary {
  id: string;
  transactionNumber: string;
  amount: string;
  transactionType: string;
  sourceType: string;
  description: string | null;
  transactionDate: string;
}

interface AdjustingVoucherSummary {
  id: string;
  transactionNumber: string;
  amount: string;
  transactionType: string;
  description: string | null;
  transactionDate: string;
}

interface Props {
  bankAccounts: BankAccountSummary[];
  selectedAccount: BankAccountSummary | null;
  initialLedgerTransactions: LedgerTxSummary[];
  initialAdjustingVouchers: AdjustingVoucherSummary[];
  userRole: string;
}

export function BankReconciliationClient({
  bankAccounts,
  selectedAccount,
  initialLedgerTransactions,
  initialAdjustingVouchers,
  userRole,
}: Props) {
  const [selectedBankId, setSelectedBankId] = useState<string>(
    selectedAccount?.id || bankAccounts[0]?.id || "",
  );
  const [activeAccount, setActiveAccount] = useState<BankAccountSummary | null>(
    selectedAccount || bankAccounts[0] || null,
  );

  const [statementRows, setStatementRows] = useState<BankStatementRowInput[]>([]);
  const [matchedResults, setMatchedResults] = useState<MatchedResultItem[]>([]);
  const [summary, setSummary] = useState<{
    totalRows: number;
    matchedCount: number;
    ambiguousCount: number;
    unmatchedCount: number;
    statementClosingBalance: number;
    ledgerBalance: number;
    discrepancy: number;
  } | null>(null);

  const [isMatching, setIsMatching] = useState(false);
  const [matchTab, setMatchTab] = useState<"all" | "ambiguous" | "unmatched" | "matched">("all");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  // Adjusting JV Modal state
  const [jvModalOpen, setJvModalOpen] = useState(false);
  const [jvSubmitting, setJvSubmitting] = useState(false);
  const [jvForm, setJvForm] = useState<{
    type: "BANK_CHARGES" | "BANK_INTEREST";
    amount: number;
    entryDate: string;
    description: string;
    refNumber: string;
  }>({
    type: "BANK_CHARGES",
    amount: 0,
    entryDate: new Date().toISOString().slice(0, 10),
    description: "Bank Service & SMS Charges",
    refNumber: "",
  });

  const canCreateAdjustingJV = userRole === "SUPER_ADMIN" || userRole === "SCHOOL_ADMIN";

  const handleBankChange = (bankId: string) => {
    setSelectedBankId(bankId);
    const bank = bankAccounts.find((b) => b.id === bankId) || null;
    setActiveAccount(bank);
    setStatementRows([]);
    setMatchedResults([]);
    setSummary(null);
    window.location.href = `/school/accounts/bank-reconciliation?bankAccountId=${bankId}`;
  };

  // CSV parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseStatementCSV(text);
    };
    reader.readAsText(file);
  };

  const parseStatementCSV = (csvText: string) => {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setFeedback({ type: "error", message: "CSV file is empty or missing headers." });
      return;
    }

    const rows: BankStatementRowInput[] = [];
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const parts = line.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
      if (parts.length >= 4) {
        const date = parts[0] || new Date().toISOString().slice(0, 10);
        const description = parts[1] || `Transaction line ${i}`;
        const refNumber = parts[2] || "";
        const withdrawal = parseFloat(parts[3] || "0") || 0;
        const deposit = parseFloat(parts[4] || "0") || 0;
        const balance = parseFloat(parts[5] || "0") || 0;

        rows.push({
          id: `stmt-${i}-${Date.now()}`,
          date,
          description,
          refNumber,
          withdrawal,
          deposit,
          balance,
        });
      }
    }

    if (rows.length === 0) {
      setFeedback({ type: "error", message: "No valid transaction rows found in CSV." });
      return;
    }

    setStatementRows(rows);
    executeMatching(rows);
  };

  // Load Sample Statement
  const loadSampleStatement = () => {
    if (!activeAccount) return;
    const today = new Date().toISOString().slice(0, 10);
    const currBal = parseFloat(activeAccount.currentBalance);

    const sampleRows: BankStatementRowInput[] = [
      {
        id: "demo-1",
        date: today,
        description: "Direct Student Fee NEFT Deposit",
        refNumber: "NEFT908123",
        withdrawal: 0,
        deposit: 15000,
        balance: currBal + 15000,
      },
      {
        id: "demo-2",
        date: today,
        description: "Consolidated SMS & Account Maintenance Fee",
        refNumber: "CHG-BANK-01",
        withdrawal: 354,
        deposit: 0,
        balance: currBal + 15000 - 354,
      },
      {
        id: "demo-3",
        date: today,
        description: "Quarterly Savings Bank Interest",
        refNumber: "INT-Q3-88",
        withdrawal: 0,
        deposit: 1250,
        balance: currBal + 15000 - 354 + 1250,
      },
    ];

    setStatementRows(sampleRows);
    executeMatching(sampleRows);
  };

  const executeMatching = async (rows: BankStatementRowInput[]) => {
    if (!selectedBankId) return;
    setIsMatching(true);
    setFeedback(null);

    const res = await matchBankStatementAction({
      bankAccountId: selectedBankId,
      statementRows: rows,
    });

    setIsMatching(false);

    if (res.success && res.results && res.summary) {
      setMatchedResults(res.results);
      setSummary(res.summary);
      setFeedback({
        type: "success",
        message: `Statement matched: ${res.summary.matchedCount} verified, ${res.summary.ambiguousCount} ambiguous, ${res.summary.unmatchedCount} unmatched.`,
      });
    } else {
      setFeedback({
        type: "error",
        message: res.message || "Failed to reconcile statement.",
      });
    }
  };

  const openAdjustingModal = (row?: BankStatementRowInput) => {
    if (row) {
      const isFee = row.withdrawal > 0;
      setJvForm({
        type: isFee ? "BANK_CHARGES" : "BANK_INTEREST",
        amount: isFee ? row.withdrawal : row.deposit,
        entryDate: row.date.slice(0, 10),
        description: row.description || (isFee ? "Bank Service Charges" : "Bank Interest Income"),
        refNumber: row.refNumber || "",
      });
    } else {
      setJvForm({
        type: "BANK_CHARGES",
        amount: 0,
        entryDate: new Date().toISOString().slice(0, 10),
        description: "Bank Service Charges",
        refNumber: "",
      });
    }
    setJvModalOpen(true);
  };

  const handleCreateAdjustingJV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateAdjustingJV) {
      setFeedback({
        type: "error",
        message: "Forbidden: Only School Admins and Super Admins can post adjusting journal vouchers.",
      });
      return;
    }

    if (jvForm.amount <= 0) {
      setFeedback({ type: "error", message: "Amount must be greater than zero." });
      return;
    }

    setJvSubmitting(true);
    const res = await createAdjustingJournalVoucherAction({
      bankAccountId: selectedBankId,
      type: jvForm.type,
      amount: jvForm.amount,
      entryDate: jvForm.entryDate,
      description: jvForm.description,
      refNumber: jvForm.refNumber,
    });
    setJvSubmitting(false);

    if (res.success) {
      setJvModalOpen(false);
      setFeedback({
        type: "success",
        message: res.message || "Adjusting voucher created successfully.",
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      setFeedback({
        type: "error",
        message: res.message || "Failed to create adjusting voucher.",
      });
    }
  };

  const filteredResults = matchedResults.filter((r) => {
    if (matchTab === "all") return true;
    if (matchTab === "matched") return r.status === "MATCHED";
    if (matchTab === "ambiguous") return r.status === "AMBIGUOUS";
    if (matchTab === "unmatched") return r.status === "UNMATCHED";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Finance Navigation Tabs */}
      <FinanceTabs activeSection="accounts" />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <FileCheck className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Bank Statement Reconciliation (BRS)
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Import e-statements (CSV/Excel), match against ledger entries, isolate ambiguous candidates, and post adjusting JVs.
          </p>
        </div>

        {/* Bank Account Switcher */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <p className="text-xs text-gray-500 dark:text-slate-400">Ledger Book Balance</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              ₹{parseFloat(activeAccount?.currentBalance || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <select
            value={selectedBankId}
            onChange={(e) => handleBankChange(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500"
          >
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bankName} - {b.accountNumber.slice(-4)} (₹{parseFloat(b.currentBalance).toLocaleString("en-IN")})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Role Alert / Notice */}
      {!canCreateAdjustingJV && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-sm">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>
            <strong>Read-Only Mode ({userRole}):</strong> You can view reconciliation records and analyze statement match preview. Only School Admins and Super Admins may create Adjusting Journal Vouchers.
          </span>
        </div>
      )}

      {/* Status Feedback Banner */}
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

      {/* Statement Import Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Card */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-600" />
              Upload Bank Statement
            </h2>
            <button
              onClick={loadSampleStatement}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Load Sample Statement
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-slate-400">
            Accepts CSV format with columns: <code className="bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded">Date, Description, RefNo, Withdrawal, Deposit, Balance</code>
          </p>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl p-8 cursor-pointer transition-colors bg-gray-50/50 dark:bg-slate-800/40">
            <FileSpreadsheet className="w-10 h-10 text-gray-400 mb-2" />
            <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">
              Click to select bank statement CSV
            </span>
            <span className="text-xs text-gray-500 mt-1">UTF-8 formatted CSV or downloaded NetBanking statement</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Quick Action & Guidance Card */}
        <div className="bg-gradient-to-br from-indigo-50/60 to-purple-50/40 dark:from-slate-800/80 dark:to-slate-900 p-6 rounded-2xl border border-indigo-100 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300 font-semibold text-sm">
              <HelpCircle className="w-4 h-4" />
              <span>DECIDE-13 Matching Rules</span>
            </div>
            <ul className="text-xs text-gray-600 dark:text-slate-300 space-y-2 list-disc pl-4">
              <li><strong>1-to-1 Match:</strong> Exact calendar date and amount against un-reconciled ledger items.</li>
              <li><strong>Ambiguity Protection:</strong> Multiple candidates on the same date with identical amounts are placed in a suggestion list and <em>never auto-matched</em>.</li>
              <li><strong>Adjusting JV:</strong> Un-reconciled bank charges debit account 5200; interest credits account 4010.</li>
            </ul>
          </div>

          {canCreateAdjustingJV && (
            <button
              onClick={() => openAdjustingModal()}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm flex items-center justify-center gap-2 transition"
            >
              <PlusCircle className="w-4 h-4" />
              Create Adjusting JV
            </button>
          )}
        </div>
      </div>

      {/* KPI Reconciliation Summary Bar */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-slate-400">Statement Closing</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
              ₹{summary.statementClosingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-slate-400">Verified Matches</p>
            <div className="flex items-center gap-2 mt-1">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {summary.matchedCount}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/20 shadow-sm">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Ambiguous Candidates</p>
            <div className="flex items-center gap-2 mt-1">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {summary.ambiguousCount}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-slate-400">Unmatched / Adjustments</p>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {summary.unmatchedCount}
            </p>
          </div>
        </div>
      )}

      {/* Match Results Table */}
      {matchedResults.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Reconciliation Matrix
              </h3>
              <span className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                {matchedResults.length} records
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex rounded-xl bg-gray-100 dark:bg-slate-800 p-1 text-xs font-semibold">
              <button
                onClick={() => setMatchTab("all")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  matchTab === "all" ? "bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white" : "text-gray-600 dark:text-slate-400"
                }`}
              >
                All ({matchedResults.length})
              </button>
              <button
                onClick={() => setMatchTab("matched")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  matchTab === "matched" ? "bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400" : "text-gray-600 dark:text-slate-400"
                }`}
              >
                Matched ({summary?.matchedCount || 0})
              </button>
              <button
                onClick={() => setMatchTab("ambiguous")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  matchTab === "ambiguous" ? "bg-white dark:bg-slate-700 shadow text-amber-600 dark:text-amber-400" : "text-gray-600 dark:text-slate-400"
                }`}
              >
                Ambiguous ({summary?.ambiguousCount || 0})
              </button>
              <button
                onClick={() => setMatchTab("unmatched")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  matchTab === "unmatched" ? "bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white" : "text-gray-600 dark:text-slate-400"
                }`}
              >
                Unmatched ({summary?.unmatchedCount || 0})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/60 border-y border-gray-100 dark:border-slate-800 text-xs font-semibold text-gray-500 dark:text-slate-400">
                  <th className="py-3 px-4">STATEMENT DATE</th>
                  <th className="py-3 px-4">DESCRIPTION</th>
                  <th className="py-3 px-4">REF NO</th>
                  <th className="py-3 px-4 text-right">WITHDRAWAL</th>
                  <th className="py-3 px-4 text-right">DEPOSIT</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4">LEDGER CORRELATION</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredResults.map((item) => (
                  <tr key={item.statementRow.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 text-xs font-mono text-gray-600 dark:text-slate-300">
                      {item.statementRow.date.slice(0, 10)}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-white max-w-xs truncate">
                      {item.statementRow.description}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500 font-mono">
                      {item.statementRow.refNumber || "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-red-600">
                      {item.statementRow.withdrawal > 0 ? `₹${item.statementRow.withdrawal.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600">
                      {item.statementRow.deposit > 0 ? `₹${item.statementRow.deposit.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="py-3 px-4">
                      {item.status === "MATCHED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" /> Matched
                        </span>
                      )}
                      {item.status === "AMBIGUOUS" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          <AlertTriangle className="w-3 h-3" /> Ambiguous
                        </span>
                      )}
                      {item.status === "UNMATCHED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          Unmatched
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {item.status === "MATCHED" && item.matchedTx && (
                        <div className="space-y-0.5">
                          <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                            {item.matchedTx.transactionNumber}
                          </span>
                          <p className="text-gray-500 truncate max-w-xs">{item.matchedTx.description}</p>
                        </div>
                      )}
                      {item.status === "AMBIGUOUS" && item.suggestions && (
                        <div className="space-y-1">
                          <span className="text-amber-700 dark:text-amber-300 font-semibold text-xs">
                            {item.suggestions.length} same-day candidates found:
                          </span>
                          <div className="text-xs text-gray-500 font-mono space-y-0.5">
                            {item.suggestions.map((s) => (
                              <div key={s.id} className="truncate">
                                • {s.transactionNumber} (₹{parseFloat(s.amount).toLocaleString("en-IN")})
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.status === "UNMATCHED" && (
                        <span className="text-gray-400 italic">No ledger transaction on this date</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {item.status === "UNMATCHED" && canCreateAdjustingJV && (
                        <button
                          onClick={() => openAdjustingModal(item.statementRow)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition"
                        >
                          Create JV
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjusting JV Modal */}
      {jvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Create Adjusting Journal Voucher
              </h3>
              <button
                onClick={() => setJvModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAdjustingJV} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Adjustment Type
                </label>
                <select
                  value={jvForm.type}
                  onChange={(e) =>
                    setJvForm({
                      ...jvForm,
                      type: e.target.value as "BANK_CHARGES" | "BANK_INTEREST",
                      description:
                        e.target.value === "BANK_CHARGES"
                          ? "Bank Service & SMS Charges"
                          : "Bank Interest Income",
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="BANK_CHARGES">Bank Charges (Debit 5200 Expense / Credit 1010 Bank)</option>
                  <option value="BANK_INTEREST">Bank Interest (Debit 1010 Bank / Credit 4010 Income)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={jvForm.amount || ""}
                  onChange={(e) => setJvForm({ ...jvForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Voucher Entry Date
                </label>
                <input
                  type="date"
                  required
                  value={jvForm.entryDate}
                  onChange={(e) => setJvForm({ ...jvForm, entryDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Bank Reference / Narration
                </label>
                <input
                  type="text"
                  required
                  value={jvForm.description}
                  onChange={(e) => setJvForm({ ...jvForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setJvModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={jvSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {jvSubmitting ? "Posting JV..." : "Post Adjusting JV"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prior Adjusting JVs History Table */}
      {initialAdjustingVouchers.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-indigo-600" />
            Recently Posted BRS Adjusting JVs
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/60 border-y border-gray-100 dark:border-slate-800 text-xs font-semibold text-gray-500">
                  <th className="py-2.5 px-4">DATE</th>
                  <th className="py-2.5 px-4">VOUCHER NUMBER</th>
                  <th className="py-2.5 px-4">TYPE</th>
                  <th className="py-2.5 px-4">DESCRIPTION</th>
                  <th className="py-2.5 px-4 text-right">AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {initialAdjustingVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 text-xs font-mono text-gray-600 dark:text-slate-300">
                      {v.transactionDate.slice(0, 10)}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-indigo-600">
                      {v.transactionNumber}
                    </td>
                    <td className="py-2.5 px-4 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold ${
                          v.transactionType === "DEBIT"
                            ? "bg-red-50 text-red-700 dark:bg-red-950/40"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40"
                        }`}
                      >
                        {v.transactionType === "DEBIT" ? "Bank Charges" : "Bank Interest"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-gray-700 dark:text-slate-300 truncate max-w-sm">
                      {v.description}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-gray-900 dark:text-white">
                      ₹{parseFloat(v.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
