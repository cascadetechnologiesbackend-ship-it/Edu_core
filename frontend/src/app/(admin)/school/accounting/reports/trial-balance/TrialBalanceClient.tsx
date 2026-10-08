"use client";

import React, { useState } from "react";
import { TrialBalanceReport } from "@schoolmitra/backend/lib/financialReportsEngine";
import { exportFinancialReportExcelAction } from "../actions";
import {
  FileText,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  RefreshCw,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";

interface TrialBalanceClientProps {
  initialReport: TrialBalanceReport;
  userRole: string;
}

export function TrialBalanceClient({ initialReport, userRole }: TrialBalanceClientProps) {
  const [report, setReport] = useState<TrialBalanceReport>(initialReport);
  const [startDate, setStartDate] = useState<string>(initialReport.startDate?.split("T")[0] || "");
  const [endDate, setEndDate] = useState<string>(initialReport.endDate?.split("T")[0] || "");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "SCHOOL_ADMIN";

  const handleApplyFilter = async (s?: string, e?: string) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      const sVal = s !== undefined ? s : startDate;
      const eVal = e !== undefined ? e : endDate;
      if (sVal) queryParams.set("startDate", sVal);
      if (eVal) queryParams.set("endDate", eVal);

      const res = await fetch(`/api/reports/trial-balance?${queryParams.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setReport(json.data);
          toast.success("Trial balance refreshed");
        }
      } else {
        // Fallback: reload with URL search params
        window.location.search = queryParams.toString();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update statement");
    } finally {
      setLoading(false);
    }
  };

  const handlePreset = (type: "ALL" | "FY" | "MONTH") => {
    const now = new Date();
    if (type === "ALL") {
      setStartDate("");
      setEndDate("");
      window.location.href = "/school/accounting/reports/trial-balance";
    } else if (type === "FY") {
      // Indian Fiscal Year starts April 1st
      const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const start = `${currentYear}-04-01`;
      const end = `${currentYear + 1}-03-31`;
      setStartDate(start);
      setEndDate(end);
      window.location.href = `/school/accounting/reports/trial-balance?startDate=${start}&endDate=${end}`;
    } else if (type === "MONTH") {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const start = `${year}-${month}-01`;
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      const end = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
      setStartDate(start);
      setEndDate(end);
      window.location.href = `/school/accounting/reports/trial-balance?startDate=${start}&endDate=${end}`;
    }
  };

  const handleExportExcel = async () => {
    if (!isAdmin) {
      toast.error("Exporting financial statements is restricted to Administrators.");
      return;
    }
    setExporting(true);
    try {
      const res = await exportFinancialReportExcelAction({
        reportType: "TRIAL_BALANCE",
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (!res.success || !res.base64) {
        throw new Error(res.message || "Export failed");
      }

      const byteCharacters = atob(res.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename || "Trial_Balance.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Excel statement exported successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to download Excel statement");
    } finally {
      setExporting(false);
    }
  };

  const filteredRows = report.rows.filter(
    (r) =>
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.type.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mr-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>Date Range:</span>
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
          />
          <button
            onClick={() => handleApplyFilter()}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Apply Filter
          </button>

          <div className="h-4 w-px bg-gray-200 dark:bg-slate-800 mx-1" />

          {/* Preset Buttons */}
          <button
            onClick={() => handlePreset("ALL")}
            className="px-2.5 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200"
          >
            All History
          </button>
          <button
            onClick={() => handlePreset("FY")}
            className="px-2.5 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200"
          >
            Current FY
          </button>
          <button
            onClick={() => handlePreset("MONTH")}
            className="px-2.5 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200"
          >
            This Month
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-200 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition inline-flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF
          </button>
          {isAdmin && (
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-sm inline-flex items-center gap-1.5"
            >
              <Download className={`w-3.5 h-3.5 ${exporting ? "animate-spin" : ""}`} />
              Export XLSX
            </button>
          )}
        </div>
      </div>

      {/* Discrepancy or Equilibrium Banner */}
      {report.isBalanced ? (
        <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Trial Balance is in Exact Equilibrium</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Sum of Debits strictly equals Sum of Credits (₹
                {report.totalDebits.toLocaleString("en-IN")}). No un-reconciled discrepancies found.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-emerald-200/60 dark:bg-emerald-900/60 px-2.5 py-1 rounded-md">
            Δ ₹0.00
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl text-rose-900 dark:text-rose-200 animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <p className="text-sm font-bold">⚠️ TRIAL BALANCE DISCREPANCY DETECTED</p>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Total Debits (₹{report.totalDebits.toLocaleString("en-IN")}) do not equal Total Credits (₹
                {report.totalCredits.toLocaleString("en-IN")}). Discrepancy of ₹
                {report.discrepancy.toLocaleString("en-IN")} requires immediate adjusting journal entry.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-rose-200 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-700">
            DISCREPANCY: ₹{report.discrepancy.toFixed(2)}
          </span>
        </div>
      )}

      {/* Printable Report Header */}
      <div className="hidden print:block text-center border-b pb-4 mb-4">
        <h1 className="text-2xl font-bold uppercase">{report.schoolName}</h1>
        <h2 className="text-lg font-semibold text-gray-700">TRIAL BALANCE REPORT</h2>
        <p className="text-xs text-gray-500">
          Period: {report.startDate ? report.startDate.split("T")[0] : "Inception"} to{" "}
          {report.endDate ? report.endDate.split("T")[0] : "Present"} | Generated:{" "}
          {new Date(report.generatedAt).toLocaleString("en-IN")}
        </p>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="w-72">
            <input
              type="text"
              placeholder="Search by code, account, or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>
          <span className="text-xs text-gray-400">
            Showing {filteredRows.length} active ledger accounts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-300 border-b border-gray-200 dark:border-slate-800 font-semibold">
                <th className="py-3 px-4 w-28">Code</th>
                <th className="py-3 px-4">Account Name</th>
                <th className="py-3 px-4 w-32">Classification</th>
                <th className="py-3 px-4 text-right w-36">Debit Balance (₹)</th>
                <th className="py-3 px-4 text-right w-36">Credit Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 text-gray-700 dark:text-slate-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400 italic">
                    No transactions or account activity found for the selected period.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.accountId}
                    className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono font-medium text-gray-900 dark:text-white">
                      {row.code}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-gray-900 dark:text-white">
                      {row.name}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          row.type === "ASSET"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                            : row.type === "LIABILITY"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                            : row.type === "EQUITY"
                            ? "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300"
                            : row.type === "REVENUE"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                        }`}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium text-gray-900 dark:text-white">
                      {row.netDebit > 0 ? `₹${row.netDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium text-gray-900 dark:text-white">
                      {row.netCredit > 0 ? `₹${row.netCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                  </tr>
                ))
              )}

              {/* Visible Discrepancy Row if debits !== credits */}
              {!report.isBalanced && (
                <tr className="bg-rose-100/90 dark:bg-rose-950/70 border-y-2 border-rose-500 font-bold text-rose-900 dark:text-rose-200">
                  <td className="py-3 px-4 font-mono">DISC-01</td>
                  <td className="py-3 px-4">⚠️ TRIAL BALANCE UNBALANCED DISCREPANCY</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-300 dark:bg-rose-900 text-rose-900 dark:text-rose-100">
                      IMBALANCE
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-rose-700 dark:text-rose-300">
                    {report.totalDebits < report.totalCredits
                      ? `₹${report.discrepancy.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-rose-700 dark:text-rose-300">
                    {report.totalDebits > report.totalCredits
                      ? `₹${report.discrepancy.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100/80 dark:bg-slate-800 border-t-2 border-gray-300 dark:border-slate-700 font-bold text-gray-900 dark:text-white">
                <td colSpan={3} className="py-3.5 px-4 text-right uppercase tracking-wider text-xs">
                  Grand Total Debits & Credits:
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-sm">
                  ₹{report.totalDebits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-sm">
                  ₹{report.totalCredits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
