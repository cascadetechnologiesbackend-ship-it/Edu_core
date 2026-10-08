"use client";

import React, { useState } from "react";
import { ConcessionSummaryReport } from "@schoolmitra/backend/lib/financialReportsEngine";
import { exportConcessionSummaryXlsxAction, getConcessionSummaryReportAction } from "./actions";
import {
  FileText,
  Printer,
  Download,
  Calendar,
  RefreshCw,
  Search,
  Filter,
  Users,
  Percent,
  CheckCircle2,
  TrendingDown,
  Building2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

interface AcademicYearOption {
  id: string;
  label: string;
  isActive: boolean;
  isLocked: boolean;
}

interface ConcessionSummaryClientProps {
  initialReport: ConcessionSummaryReport;
  academicYears: AcademicYearOption[];
  userRole: string;
}

export function ConcessionSummaryClient({
  initialReport,
  academicYears,
  userRole,
}: ConcessionSummaryClientProps) {
  const [report, setReport] = useState<ConcessionSummaryReport>(initialReport);
  const [selectedYearId, setSelectedYearId] = useState<string>(
    initialReport.academicYearId || academicYears.find((y) => y.isActive)?.id || ""
  );
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");

  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "SCHOOL_ADMIN";

  const handleYearChange = async (yearId: string) => {
    setSelectedYearId(yearId);
    setLoading(true);
    try {
      const res = await getConcessionSummaryReportAction(yearId || null);
      if (res.success && res.data) {
        setReport(res.data);
        toast.success(`Loaded report for ${res.data.academicYearName}`);
      } else {
        toast.error(res.message || "Failed to load report");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error loading report");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (!isAdmin) {
      toast.error("Exporting financial reports is restricted to Administrators.");
      return;
    }

    setExporting(true);
    try {
      const res = await exportConcessionSummaryXlsxAction(selectedYearId || null);
      if (!res.success || !res.base64) {
        throw new Error(res.message || "Export failed");
      }

      // Download triggered from base64
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
      a.download = res.filename || "Concession_Summary_Report.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Excel report exported successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate Excel export");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Unique terms and types for filters
  const availableTerms = Array.from(new Set(report.rows.map((r) => r.term))).sort();
  const availableTypes = Array.from(new Set(report.rows.map((r) => r.concessionType))).sort();

  // Filtered rows
  const filteredRows = report.rows.filter((r) => {
    const matchesSearch =
      searchTerm === "" ||
      r.policyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.term.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTerm = selectedTerm === "ALL" || r.term === selectedTerm;
    const matchesType = selectedType === "ALL" || r.concessionType === selectedType;

    return matchesSearch && matchesTerm && matchesType;
  });

  const getTypeBadgeClass = (type: string) => {
    switch (type.toUpperCase()) {
      case "MERIT":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "SIBLING":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "STAFF_WARD":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "EWS":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-300 border-gray-200 dark:border-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Academic Session:
            </span>
            <select
              aria-label="Select Academic Session"
              value={selectedYearId}
              onChange={(e) => handleYearChange(e.target.value)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.label} {ay.isActive ? "(Active)" : ""} {ay.isLocked ? "🔒" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search policy, class, term..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 w-48 md:w-56 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {availableTerms.length > 0 && (
            <select
              aria-label="Filter by Academic Term"
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Terms</option>
              {availableTerms.map((t) => (
                <option key={t} value={t}>
                  Term: {t}
                </option>
              ))}
            </select>
          )}

          {availableTypes.length > 0 && (
            <select
              aria-label="Filter by Concession Type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Policy Types</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleYearChange(selectedYearId)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>

          {isAdmin ? (
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? "Exporting..." : "Export Excel (.xlsx)"}
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500 cursor-not-allowed">
              <Lock className="w-3.5 h-3.5" />
              Export (Admin Only)
            </div>
          )}
        </div>
      </div>

      {/* High-Level Financial Impact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Concessions / Revenue Foregone */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Revenue Foregone
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            ₹{report.totalConcessions.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Total concessions & waivers granted
          </p>
        </div>

        {/* Gross Tuition Billed */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Gross Tuition Billed
            </span>
            <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            ₹{report.totalGross.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Pre-discount tuition commitment
          </p>
        </div>

        {/* Net Realized Revenue */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Net Realized
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            ₹{report.totalNetRealized.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Post-concession collectable fees
          </p>
        </div>

        {/* Beneficiary Students */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Beneficiaries
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {report.totalBeneficiaries} <span className="text-sm font-normal text-gray-500">students</span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Students receiving financial aid
          </p>
        </div>

        {/* Realization Rate */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Realization Rate
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {report.overallRealizationRate.toFixed(1)}%
          </div>
          <div className="mt-1.5 w-full bg-gray-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.max(0, report.overallRealizationRate))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Policy Breakdown Chips */}
      {report.policyBreakdown.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-3">
            Policy-Wise Revenue Foregone Distribution
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {report.policyBreakdown.map((pb) => (
              <div
                key={pb.policyName}
                className="p-3 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                    {pb.policyName}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${getTypeBadgeClass(
                      pb.concessionType
                    )}`}
                  >
                    {pb.concessionType}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                    ₹{pb.concessionAmount.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {pb.studentCount} students ({pb.percentageOfTotal.toFixed(1)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Authoritative Detailed Concession Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Revenue Foregone Matrix (Policy × Term × Class)
            </h2>
          </div>
          <span className="text-xs text-gray-500">
            Showing {filteredRows.length} of {report.rows.length} records
          </span>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-slate-400 space-y-2">
            <Percent className="w-10 h-10 mx-auto text-gray-300 dark:text-slate-600" />
            <div className="font-medium text-sm text-gray-900 dark:text-white">
              No concessions or waivers found
            </div>
            <p className="text-xs max-w-sm mx-auto">
              There are no applied fee concessions or discount policies recorded for the selected
              academic session and filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-300 border-b border-gray-200 dark:border-slate-800 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Policy / Scheme Name</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Term</th>
                  <th className="px-3 py-3">Class / Standard</th>
                  <th className="px-3 py-3 text-right">Beneficiaries</th>
                  <th className="px-4 py-3 text-right">Gross Billed</th>
                  <th className="px-4 py-3 text-right">Concession Granted</th>
                  <th className="px-4 py-3 text-right">Net Realized</th>
                  <th className="px-4 py-3 text-right">Realization %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredRows.map((row, idx) => (
                  <tr
                    key={`${row.policyName}-${row.term}-${row.className}-${idx}`}
                    className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {row.policyName}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getTypeBadgeClass(
                          row.concessionType
                        )}`}
                      >
                        {row.concessionType}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-slate-300 font-mono">
                      {row.term}
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-slate-300">
                      {row.className}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-gray-900 dark:text-white">
                      {row.studentCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-slate-300">
                      ₹{row.grossAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                      ₹{row.concessionAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                      ₹{row.netRealized.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono font-semibold text-gray-900 dark:text-white">
                        {row.realizationRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-slate-800/80 border-t-2 border-gray-200 dark:border-slate-700 font-bold">
                <tr>
                  <td className="px-4 py-3 text-gray-900 dark:text-white" colSpan={4}>
                    TOTAL (ALL FILTERED ROWS)
                  </td>
                  <td className="px-3 py-3 text-right text-gray-900 dark:text-white">
                    {filteredRows.reduce((sum, r) => sum + r.studentCount, 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">
                    ₹
                    {filteredRows
                      .reduce((sum, r) => sum + r.grossAmount, 0)
                      .toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-purple-600 dark:text-purple-400">
                    ₹
                    {filteredRows
                      .reduce((sum, r) => sum + r.concessionAmount, 0)
                      .toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                    ₹
                    {filteredRows
                      .reduce((sum, r) => sum + r.netRealized, 0)
                      .toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">
                    {report.overallRealizationRate.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
