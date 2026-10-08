"use client";

import React, { useState } from "react";
import { BalanceSheetReport } from "@schoolmitra/backend/lib/financialReportsEngine";
import { exportFinancialReportExcelAction } from "../actions";
import {
  ShieldCheck,
  Printer,
  Download,
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface BalanceSheetClientProps {
  initialReport: BalanceSheetReport;
  userRole: string;
}

export function BalanceSheetClient({ initialReport, userRole }: BalanceSheetClientProps) {
  const [report, setReport] = useState<BalanceSheetReport>(initialReport);
  const [asOfDate, setAsOfDate] = useState<string>(initialReport.asOfDate?.split("T")[0] || "");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "SCHOOL_ADMIN";

  const handleApplyFilter = () => {
    const queryParams = new URLSearchParams();
    if (asOfDate) queryParams.set("asOfDate", asOfDate);
    window.location.search = queryParams.toString();
  };

  const handleExportExcel = async () => {
    if (!isAdmin) {
      toast.error("Exporting financial statements is restricted to Administrators.");
      return;
    }
    setExporting(true);
    try {
      const res = await exportFinancialReportExcelAction({
        reportType: "BALANCE_SHEET",
        asOfDate: asOfDate || undefined,
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
      a.download = res.filename || "Balance_Sheet.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Excel balance sheet exported successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to download Excel statement");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mr-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>As of Date:</span>
          </div>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
          />
          <button
            onClick={handleApplyFilter}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Apply Cutoff
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

      {/* Tie-Out Verification Card */}
      {report.isTiedOut ? (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-center justify-between gap-4 text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-bold">✓ BALANCE SHEET TIED OUT & IN EQUILIBRIUM</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Accounting Equation Verified: Assets (₹{report.totalAssets.toLocaleString("en-IN")}) =
                Liabilities (₹{report.totalLiabilities.toLocaleString("en-IN")}) + Equity & Reserves (₹
                {report.totalEquityAndSurplus.toLocaleString("en-IN")})
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-emerald-200/60 dark:bg-emerald-900/60 px-3 py-1 rounded-md">
            EQUILIBRIUM: Δ ₹0.00
          </span>
        </div>
      ) : (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl flex items-center justify-between gap-4 text-rose-900 dark:text-rose-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <p className="text-sm font-bold">⚠️ TIE-OUT IMBALANCE DETECTED</p>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Assets (₹{report.totalAssets.toLocaleString("en-IN")}) do not tie out with Liabilities &
                Equity (₹{report.totalLiabilitiesAndEquity.toLocaleString("en-IN")}). Difference: ₹
                {report.tieOutDifference.toLocaleString("en-IN")}.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-rose-200 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-700">
            IMBALANCE: ₹{report.tieOutDifference.toFixed(2)}
          </span>
        </div>
      )}

      {/* Two Column Layout: Assets vs Liabilities & Equity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets Side */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between">
          <div>
            <div className="p-4 bg-blue-50/60 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 text-sm">
                1. Assets & Receivables
              </h3>
              <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300">
                ₹{report.totalAssets.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-slate-800/40 text-gray-500 border-b border-gray-100 dark:border-slate-800">
                  <th className="py-2.5 px-4 w-24">Code</th>
                  <th className="py-2.5 px-4">Account Name</th>
                  <th className="py-2.5 px-4 text-right w-32">Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                {report.assetRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-400 italic">
                      No asset balances recorded.
                    </td>
                  </tr>
                ) : (
                  report.assetRows.map((row) => (
                    <tr key={row.accountId} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-2 px-4 font-mono text-gray-500">{row.code}</td>
                      <td className="py-2 px-4 font-medium text-gray-900 dark:text-white">{row.name}</td>
                      <td className="py-2 px-4 text-right font-mono font-medium text-gray-900 dark:text-white">
                        ₹
                        {(row.netDebit > 0 ? row.netDebit : -row.netCredit).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-blue-100/70 dark:bg-blue-950/40 border-t border-blue-200 dark:border-blue-800 flex items-center justify-between font-bold text-xs text-blue-900 dark:text-blue-100">
            <span className="uppercase">TOTAL ASSETS (1):</span>
            <span className="font-mono text-sm">
              ₹{report.totalAssets.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Liabilities & Equity Side */}
        <div className="space-y-6">
          {/* Liabilities Table */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/40 flex items-center justify-between">
              <h3 className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                2A. Liabilities & Deposits
              </h3>
              <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
                ₹{report.totalLiabilities.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-slate-800/40 text-gray-500 border-b border-gray-100 dark:border-slate-800">
                  <th className="py-2.5 px-4 w-24">Code</th>
                  <th className="py-2.5 px-4">Account Name</th>
                  <th className="py-2.5 px-4 text-right w-32">Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                {report.liabilityRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-gray-400 italic">
                      No liabilities recorded.
                    </td>
                  </tr>
                ) : (
                  report.liabilityRows.map((row) => (
                    <tr key={row.accountId} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-2 px-4 font-mono text-gray-500">{row.code}</td>
                      <td className="py-2 px-4 font-medium text-gray-900 dark:text-white">{row.name}</td>
                      <td className="py-2 px-4 text-right font-mono font-medium text-gray-900 dark:text-white">
                        ₹
                        {(row.netCredit > 0 ? row.netCredit : -row.netDebit).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Equity & Reserves Table */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 bg-violet-50/60 dark:bg-violet-950/20 border-b border-violet-100 dark:border-violet-900/40 flex items-center justify-between">
              <h3 className="font-semibold text-violet-900 dark:text-violet-200 text-sm">
                2B. Equity & Accumulated Surplus
              </h3>
              <span className="text-xs font-mono font-bold text-violet-700 dark:text-violet-300">
                ₹{report.totalEquityAndSurplus.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-slate-800/40 text-gray-500 border-b border-gray-100 dark:border-slate-800">
                  <th className="py-2.5 px-4 w-24">Code</th>
                  <th className="py-2.5 px-4">Account Name</th>
                  <th className="py-2.5 px-4 text-right w-32">Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                {report.equityRows.map((row) => (
                  <tr key={row.accountId} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 font-mono text-gray-500">{row.code}</td>
                    <td className="py-2 px-4 font-medium text-gray-900 dark:text-white">{row.name}</td>
                    <td className="py-2 px-4 text-right font-mono font-medium text-gray-900 dark:text-white">
                      ₹
                      {(row.netCredit > 0 ? row.netCredit : -row.netDebit).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
                <tr className="bg-violet-50/40 dark:bg-violet-950/20 font-medium">
                  <td className="py-2 px-4 font-mono text-violet-600 dark:text-violet-400">3999</td>
                  <td className="py-2 px-4 text-violet-900 dark:text-violet-200">
                    Current Period Operating Surplus/(Deficit)
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-violet-700 dark:text-violet-300">
                    ₹
                    {report.currentPeriodSurplus.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Grand Total Liabilities + Equity */}
          <div className="p-4 bg-gray-100 dark:bg-slate-800 rounded-2xl border border-gray-300 dark:border-slate-700 flex items-center justify-between font-bold text-xs text-gray-900 dark:text-white">
            <span className="uppercase">TOTAL LIABILITIES & EQUITY (2A + 2B):</span>
            <span className="font-mono text-sm">
              ₹{report.totalLiabilitiesAndEquity.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
