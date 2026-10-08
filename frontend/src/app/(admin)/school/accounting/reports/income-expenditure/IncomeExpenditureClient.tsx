"use client";

import React, { useState } from "react";
import { IncomeExpenditureReport } from "@schoolmitra/backend/lib/financialReportsEngine";
import { exportFinancialReportExcelAction } from "../actions";
import {
  TrendingUp,
  Printer,
  Download,
  Calendar,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";

interface IncomeExpenditureClientProps {
  initialReport: IncomeExpenditureReport;
  userRole: string;
}

export function IncomeExpenditureClient({
  initialReport,
  userRole,
}: IncomeExpenditureClientProps) {
  const [report, setReport] = useState<IncomeExpenditureReport>(initialReport);
  const [startDate, setStartDate] = useState<string>(initialReport.startDate?.split("T")[0] || "");
  const [endDate, setEndDate] = useState<string>(initialReport.endDate?.split("T")[0] || "");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "SCHOOL_ADMIN";

  const handleApplyFilter = () => {
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.set("startDate", startDate);
    if (endDate) queryParams.set("endDate", endDate);
    window.location.search = queryParams.toString();
  };

  const handlePreset = (type: "ALL" | "FY" | "MONTH") => {
    const now = new Date();
    if (type === "ALL") {
      window.location.href = "/school/accounting/reports/income-expenditure";
    } else if (type === "FY") {
      const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const start = `${currentYear}-04-01`;
      const end = `${currentYear + 1}-03-31`;
      window.location.href = `/school/accounting/reports/income-expenditure?startDate=${start}&endDate=${end}`;
    } else if (type === "MONTH") {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const start = `${year}-${month}-01`;
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      const end = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
      window.location.href = `/school/accounting/reports/income-expenditure?startDate=${start}&endDate=${end}`;
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
        reportType: "INCOME_EXPENDITURE",
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
      a.download = res.filename || "Income_Expenditure.xlsx";
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
            onClick={handleApplyFilter}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Apply Filter
          </button>

          <div className="h-4 w-px bg-gray-200 dark:bg-slate-800 mx-1" />

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

      {/* Net Operating Surplus / Deficit Card */}
      <div
        className={`p-6 rounded-2xl border ${
          report.isSurplus
            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60"
            : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60"
        } flex flex-wrap items-center justify-between gap-4`}
      >
        <div>
          <span className="text-xs font-semibold tracking-wide uppercase text-gray-500 dark:text-gray-400">
            Institutional Operational Bottom-Line
          </span>
          <h2
            className={`text-3xl font-extrabold tracking-tight mt-1 ${
              report.isSurplus
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-rose-700 dark:text-rose-300"
            }`}
          >
            {report.isSurplus ? "NET SURPLUS: " : "NET DEFICIT: "}₹
            {Math.abs(report.netSurplus).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Total Revenues (₹{report.totalIncome.toLocaleString("en-IN")}) minus Total Expenditures (₹
            {report.totalExpenditure.toLocaleString("en-IN")})
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-xs text-gray-500 block">Total Revenue</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-lg">
              ₹{report.totalIncome.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-500 block">Total Expenditure</span>
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-lg">
              ₹{report.totalExpenditure.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Income vs Expenditure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income / Revenue Side */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm">
                A. Income & Revenues
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">
              ₹{report.totalIncome.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-slate-800/40 text-gray-500 border-b border-gray-100 dark:border-slate-800">
                <th className="py-2.5 px-4 w-24">Code</th>
                <th className="py-2.5 px-4">Account / Head</th>
                <th className="py-2.5 px-4 text-right w-32">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
              {report.incomeRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-gray-400 italic">
                    No revenue recorded in this period.
                  </td>
                </tr>
              ) : (
                report.incomeRows.map((row) => (
                  <tr key={row.accountId} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 font-mono text-gray-500">{row.code}</td>
                    <td className="py-2 px-4 font-medium text-gray-900 dark:text-white">{row.name}</td>
                    <td className="py-2 px-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                      ₹
                      {(row.netCredit > 0 ? row.netCredit : -row.netDebit).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 dark:bg-slate-800/60 font-bold border-t border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white">
                <td colSpan={2} className="py-2.5 px-4 text-right uppercase">
                  Total Income (A):
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                  ₹{report.totalIncome.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Expenditure Side */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-rose-50/60 dark:bg-rose-950/20 border-b border-rose-100 dark:border-rose-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <h3 className="font-semibold text-rose-900 dark:text-rose-200 text-sm">
                B. Expenditure & Operating Costs
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-rose-700 dark:text-rose-300">
              ₹{report.totalExpenditure.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-slate-800/40 text-gray-500 border-b border-gray-100 dark:border-slate-800">
                <th className="py-2.5 px-4 w-24">Code</th>
                <th className="py-2.5 px-4">Account / Head</th>
                <th className="py-2.5 px-4 text-right w-32">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
              {report.expenditureRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-gray-400 italic">
                    No expenditures recorded in this period.
                  </td>
                </tr>
              ) : (
                report.expenditureRows.map((row) => (
                  <tr key={row.accountId} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 font-mono text-gray-500">{row.code}</td>
                    <td className="py-2 px-4 font-medium text-gray-900 dark:text-white">{row.name}</td>
                    <td className="py-2 px-4 text-right font-mono font-medium text-rose-600 dark:text-rose-400">
                      ₹
                      {(row.netDebit > 0 ? row.netDebit : -row.netCredit).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 dark:bg-slate-800/60 font-bold border-t border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white">
                <td colSpan={2} className="py-2.5 px-4 text-right uppercase">
                  Total Expenditure (B):
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-rose-600 dark:text-rose-400">
                  ₹{report.totalExpenditure.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
