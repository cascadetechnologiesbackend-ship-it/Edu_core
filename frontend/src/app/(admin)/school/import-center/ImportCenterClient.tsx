"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw,
  Eye,
  XCircle,
  Users,
  GraduationCap,
  Coins,
  ArrowRight,
  ClipboardPaste,
  FileCode,
} from "lucide-react";
import Link from "next/link";
import {
  validateHistoricalFeeBalances,
  importHistoricalFeeBalances,
  validateStudentImportAction,
  commitStudentImportAction,
  validateStaffImportAction,
  commitStaffImportAction,
  DryRunValidationResult,
  ImportCommitResult,
} from "./actions";
import { type DryRunValidationSummary } from "@schoolmitra/backend/lib/bulkImportResilience";

interface ImportCenterClientProps {
  academicYears: { id: string; name: string; isActive: boolean }[];
}

type ImportTab = "STUDENTS" | "STAFF" | "FEES";

export function ImportCenterClient({ academicYears }: ImportCenterClientProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>("STUDENTS");
  const [academicYearId, setAcademicYearId] = useState(
    academicYears.find((y) => y.isActive)?.id || academicYears[0]?.id || ""
  );
  const [rawTextContent, setRawTextContent] = useState("");
  const [parsedRows, setParsedRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);

  // Dry run preview state
  const [dryRunSummary, setDryRunSummary] = useState<DryRunValidationSummary | null>(null);

  // Commit result state
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(null);

  // Sample CSV Templates
  const studentSampleCsv = `Admission Number,First Name,Last Name,Gender,Date of Birth (YYYY-MM-DD),Class Name,Section,Parent / Guardian Name,Parent Phone,Parent Email,Category (Optional)
ADM-2026-001,Aarav,Sharma,MALE,14/05/2012,Class 10,A,Rajesh Sharma,+91 98765-43210,rajesh@example.com,GENERAL
ADM-2026-002,Diya,Patel,FEMALE,2012-07-22,10-A,,Kiran Patel,919876543211,kiran@example.com,OBC
ADM-2026-003,Rohan,Verma,MALE,05/11/2012,X A,,Suresh Verma,98765 43212,,GENERAL`;

  const staffSampleCsv = `Employee Code,First Name,Last Name,Official Email,Contact Phone,Department,Designation,System Role,Gender,Date of Birth
EMP-101,Vikram,Malhotra,vikram.malhotra@school.in,+91 98765-43220,Mathematics,Senior TGT Teacher,TEACHER,MALE,1985-04-12
EMP-102,Ananya,Iyer,ananya.iyer@school.in,919876543221,Science,TGT Science,TEACHER,FEMALE,1990-09-18
EMP-103,Ramesh,Gupta,ramesh.gupta@school.in,98765 43222,Finance,Senior Accountant,ACCOUNTANT,MALE,1982-12-01`;

  const feeSampleCsv = `admissionNumber,grossAmount,dueDate
ADM-2026-001,4500,2026-11-15
ADM-2026-002,12000,2026-11-20
ADM-2026-003,3250,2026-12-01`;

  const downloadSampleTemplate = (tab: ImportTab) => {
    let content = "";
    let filename = "";
    if (tab === "STUDENTS") {
      content = studentSampleCsv;
      filename = "schoolmitra_students_template.csv";
    } else if (tab === "STAFF") {
      content = staffSampleCsv;
      filename = "schoolmitra_staff_template.csv";
    } else {
      content = feeSampleCsv;
      filename = "schoolmitra_opening_fee_balances_template.csv";
    }

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadRejectedCsv = () => {
    if (!commitResult?.rejectedRowsCsv) return;
    const blob = new Blob([commitResult.rejectedRowsCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `rejected_${activeTab.toLowerCase()}_rows.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to parse CSV or TSV string into row objects
  const parseTextToRows = (text: string): Record<string, string>[] => {
    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) return [];

    const firstLine = lines[0]!;
    const isTsv = firstLine.includes("\t") && !firstLine.includes(",");
    const delimiter = isTsv ? "\t" : ",";

    const parseLine = (line: string): string[] => {
      if (isTsv) {
        return line.split("\t").map((c) => c.trim().replace(/^"|"$/g, ""));
      }
      const result: string[] = [];
      let current = "";
      let insideQuote = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (insideQuote && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            insideQuote = !insideQuote;
          }
        } else if (char === delimiter && !insideQuote) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(firstLine);
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]!);
      const rowObj: Record<string, string> = {};
      let hasData = false;
      for (let h = 0; h < headers.length; h++) {
        const header = headers[h] || `col_${h}`;
        const val = values[h] ?? "";
        if (val) hasData = true;
        rowObj[header] = val;
      }
      if (hasData) {
        rows.push(rowObj);
      }
    }
    return rows;
  };

  // Handle CSV file upload
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawTextContent(text);
      const rows = parseTextToRows(text);
      setParsedRows(rows);
      setDryRunSummary(null);
      setCommitResult(null);
    };
    reader.readAsText(file);
  };

  // Helper to extract clean string representation from ExcelJS cell (handling richText, formulas, dates)
  const getExcelCellString = (cell: any): string => {
    if (!cell) return "";
    const val = cell.value;
    if (val === null || val === undefined) return "";
    if (val instanceof Date) {
      if (!isNaN(val.getTime())) {
        const yyyy = val.getUTCFullYear();
        const mm = String(val.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(val.getUTCDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }
    }
    if (typeof val === "object") {
      if (Array.isArray(val.richText)) {
        return val.richText.map((t: any) => t.text || "").join("").trim();
      }
      if (val.result !== undefined && val.result !== null) {
        return String(val.result).trim();
      }
      if (val.text !== undefined && val.text !== null) {
        return String(val.text).trim();
      }
    }
    return String(cell.text || cell.value || "").trim();
  };

  // Handle binary .xlsx file upload using existing exceljs bundle
  const handleXlsxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setIsParsingFile(true);

    try {
      const buffer = await file.arrayBuffer();
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      // Select first sheet with data (rowCount > 1), or fallback to sheet 0
      const worksheet =
        workbook.worksheets.find((ws) => (ws.actualRowCount || ws.rowCount) > 1) ||
        workbook.worksheets[0];

      if (!worksheet) {
        alert("Excel workbook contains no sheets.");
        return;
      }

      const headers: string[] = [];
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber] = getExcelCellString(cell);
      });

      const rows: Record<string, string>[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowObj: Record<string, string> = {};
        let hasData = false;

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const header = headers[colNumber];
          if (!header) return;

          const strVal = getExcelCellString(cell);
          if (strVal) hasData = true;
          rowObj[header] = strVal;
        });

        if (hasData) {
          rows.push(rowObj);
        }
      });

      setParsedRows(rows);
      // Re-generate text preview
      if (rows.length > 0) {
        const headerKeys = Object.keys(rows[0]!);
        const textPreview = [
          headerKeys.join(","),
          ...rows.slice(0, 10).map((r) => headerKeys.map((k) => `"${r[k] || ""}"`).join(",")),
        ].join("\n");
        setRawTextContent(textPreview);
      }
      setDryRunSummary(null);
      setCommitResult(null);
    } catch (err: any) {
      alert(`Failed to parse Excel file: ${err.message}`);
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleTextareaChange = (text: string) => {
    setRawTextContent(text);
    const rows = parseTextToRows(text);
    setParsedRows(rows.length > 0 ? rows : null);
    setDryRunSummary(null);
    setCommitResult(null);
  };

  const getEffectiveRows = (): Record<string, string>[] | null => {
    if (parsedRows && parsedRows.length > 0) return parsedRows;
    if (rawTextContent.trim()) {
      const rows = parseTextToRows(rawTextContent);
      return rows.length > 0 ? rows : null;
    }
    return null;
  };

  // Run dry-run validation preview
  const handleDryRun = async () => {
    const rows = getEffectiveRows();
    if (!rows || rows.length === 0) {
      alert("Please upload a CSV / Excel file or paste rows into the text area.");
      return;
    }

    setIsValidating(true);
    setCommitResult(null);

    try {
      if (activeTab === "STUDENTS") {
        const res = await validateStudentImportAction(rows);
        setDryRunSummary(res);
      } else if (activeTab === "STAFF") {
        const res = await validateStaffImportAction(rows);
        setDryRunSummary(res);
      } else {
        if (!academicYearId) {
          alert("Please select an academic year.");
          return;
        }
        const feeRows = rows.map((r) => {
          const rawAmount =
            r["grossAmount"] ||
            r["gross amount"] ||
            r["amount"] ||
            r["balance"] ||
            r["opening balance"] ||
            r["dues"] ||
            "0";
          return {
            admissionNumber:
              r["admissionNumber"] ||
              r["admission number"] ||
              r["adm no"] ||
              r["admission_no"] ||
              r["student id"] ||
              "",
            grossAmount: parseFloat(String(rawAmount).replace(/[^0-9.-]/g, "")) || 0,
            dueDate: r["dueDate"] || r["due date"] || r["due_date"] || undefined,
          };
        });
        const res = await validateHistoricalFeeBalances(academicYearId, feeRows);
        if (res.summary) {
          setDryRunSummary(res.summary);
        }
      }
    } catch (err: any) {
      alert(err.message || "Failed to run dry-run validation preview.");
    } finally {
      setIsValidating(false);
    }
  };

  // Run resilient batch commit
  const handleImport = async () => {
    const rows = getEffectiveRows();
    if (!rows || rows.length === 0) {
      alert("Please upload a CSV / Excel file or paste rows into the text area.");
      return;
    }

    setIsSubmitting(true);
    setCommitResult(null);

    try {
      if (activeTab === "STUDENTS") {
        const res = await commitStudentImportAction(rows, { resilient: true });
        setCommitResult(res);
      } else if (activeTab === "STAFF") {
        const res = await commitStaffImportAction(rows, { resilient: true });
        setCommitResult(res);
      } else {
        if (!academicYearId) {
          alert("Please select an academic year.");
          return;
        }
        const feeRows = rows.map((r) => {
          const rawAmount =
            r["grossAmount"] ||
            r["gross amount"] ||
            r["amount"] ||
            r["balance"] ||
            r["opening balance"] ||
            r["dues"] ||
            "0";
          return {
            admissionNumber:
              r["admissionNumber"] ||
              r["admission number"] ||
              r["adm no"] ||
              r["admission_no"] ||
              r["student id"] ||
              "",
            grossAmount: parseFloat(String(rawAmount).replace(/[^0-9.-]/g, "")) || 0,
            dueDate: r["dueDate"] || r["due date"] || r["due_date"] || undefined,
          };
        });
        const res = await importHistoricalFeeBalances(academicYearId, feeRows);
        setCommitResult({
          success: res.success,
          totalProcessed: rows.length,
          createdCount: res.count,
          skippedCount: res.skippedCount || res.errors.length,
          errors: res.errors,
          rejectedRowsCsv: res.rejectedRowsCsv || "",
          message: res.message,
          finishedState: res.finishedState,
        });
      }
    } catch (err: any) {
      setCommitResult({
        success: false,
        totalProcessed: rows.length,
        createdCount: 0,
        skippedCount: rows.length,
        errors: [err.message || "Failed to process import"],
        rejectedRowsCsv: "",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchTab = (tab: ImportTab) => {
    setActiveTab(tab);
    setRawTextContent("");
    setParsedRows(null);
    setFileName("");
    setDryRunSummary(null);
    setCommitResult(null);
  };

  return (
    <div className="space-y-8">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-1">
        <button
          onClick={() => switchTab("STUDENTS")}
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-semibold transition border-b-2 -mb-1 ${
            activeTab === "STUDENTS"
              ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
              : "border-transparent text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Students Import</span>
        </button>

        <button
          onClick={() => switchTab("STAFF")}
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-semibold transition border-b-2 -mb-1 ${
            activeTab === "STAFF"
              ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
              : "border-transparent text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Import</span>
        </button>

        <button
          onClick={() => switchTab("FEES")}
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-semibold transition border-b-2 -mb-1 ${
            activeTab === "FEES"
              ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
              : "border-transparent text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Opening Fee Balances</span>
        </button>
      </div>

      {/* Finished State Banner (Charter Law 2) */}
      {commitResult && (
        <div
          className={`p-6 rounded-2xl border text-sm space-y-4 shadow-sm ${
            commitResult.success && commitResult.skippedCount === 0
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
              : commitResult.success
              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200"
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              {commitResult.success ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="text-base font-bold">
                  {commitResult.finishedState?.title || "Import Execution Finished"}
                </h4>
                <p className="mt-1 font-medium">
                  {commitResult.finishedState?.message || commitResult.message}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                  <span className="font-semibold px-2.5 py-0.5 rounded-full bg-white/60 dark:bg-black/20">
                    Total: {commitResult.totalProcessed}
                  </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full bg-emerald-100/60 dark:bg-emerald-900/40">
                    Created: {commitResult.createdCount}
                  </span>
                  {commitResult.duplicatesMergedCount !== undefined && commitResult.duplicatesMergedCount > 0 && (
                    <span className="font-semibold text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full bg-blue-100/60 dark:bg-blue-900/40">
                      Merged Duplicates: {commitResult.duplicatesMergedCount}
                    </span>
                  )}
                  {commitResult.skippedCount > 0 && (
                    <span className="font-semibold text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full bg-amber-100/60 dark:bg-amber-900/40">
                      Skipped: {commitResult.skippedCount}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {commitResult.rejectedRowsCsv && (
                <button
                  onClick={downloadRejectedCsv}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white font-semibold text-xs transition shadow-sm hover:bg-gray-50"
                >
                  <Download className="w-4 h-4 text-rose-600" /> Download Rejected Rows CSV
                </button>
              )}

              {commitResult.finishedState?.nextActionHref && (
                <Link
                  href={commitResult.finishedState.nextActionHref}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm"
                >
                  <span>{commitResult.finishedState.nextActionLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>

          {commitResult.errors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 text-xs">
              <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
                Row-Level Skip Reasons ({commitResult.errors.length}):
              </p>
              <ul className="list-disc pl-5 max-h-40 overflow-y-auto space-y-1 font-mono text-[11px]">
                {commitResult.errors.slice(0, 50).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {commitResult.errors.length > 50 && (
                  <li className="font-sans italic">... and {commitResult.errors.length - 50} more. Download rejected CSV above for full report.</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Instructions & Template Helper Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {activeTab === "STUDENTS" && "Bulk Students Onboarding & Class Enrollment"}
                {activeTab === "STAFF" && "Bulk Staff Onboarding & Credentials Provisioning"}
                {activeTab === "FEES" && "Historical Fee Balances & External Invoices"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {activeTab === "STUDENTS" && "Accepts messy school files: phone prefixes (+91/91), dates (DD/MM/YYYY), and section variants ('10-A', 'X A', 'Class 10 - A')."}
                {activeTab === "STAFF" && "Provisions staff records, temporary passwords, departments, and designations. Role clamped to TEACHER, STAFF, ACCOUNTANT."}
                {activeTab === "FEES" && "Imports opening balances and prior year dues into fee invoices with automatic audit trails."}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-800 space-y-2 text-xs text-gray-600 dark:text-slate-300">
            <p className="font-semibold text-gray-900 dark:text-white">Resilient Parser Guarantees (Charter BR4):</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Messy Phone Normalization:</strong> <code>+91 98765-43210</code>, <code>919876543210</code>, <code>(987) 654-3210</code> are all cleaned to 10 digits.
              </li>
              <li>
                <strong>Date Flexibility:</strong> Dates in <code>DD/MM/YYYY</code>, <code>DD-MM-YYYY</code>, <code>YYYY-MM-DD</code>, or Excel serial numbers are normalized.
              </li>
              <li>
                <strong>Fuzzy Class & Section Matching:</strong> Section variants like <code>10-A</code>, <code>10 A</code>, <code>X-A</code>, <code>Class 10 - A</code> automatically resolve to active classes.
              </li>
              <li>
                <strong>Zero Duplicates (Idempotency):</strong> Re-uploading the same file merges duplicates and creates zero duplicates.
              </li>
              <li>
                <strong>Row-Level Resilience:</strong> Valid rows persist; defective rows yield actionable clerk fixes and downloadable CSV.
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Template Helper
            </span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-1">
              Download Standard CSV Template
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              Pre-formatted template with standard column headers for {activeTab.toLowerCase()}.
            </p>
          </div>

          <button
            onClick={() => downloadSampleTemplate(activeTab)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs font-semibold text-gray-800 dark:text-slate-200 transition"
          >
            <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Download Sample CSV
          </button>
        </div>
      </div>

      {/* Main Upload / Input Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Batch Data Importer: {activeTab === "STUDENTS" ? "Students" : activeTab === "STAFF" ? "Staff" : "Opening Balances"}
          </h3>

          {activeTab === "FEES" && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                Academic Year:
              </label>
              <select
                value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
                className="text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.name} {ay.isActive ? "(Active)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 3 Input Methods Grid: CSV Upload, Excel .XLSX Binary Upload, Paste Textarea */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Method 1: CSV Upload */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 space-y-2">
            <label className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              1. Upload CSV File (.csv)
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              className="w-full text-xs text-gray-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-slate-800 dark:file:text-slate-200"
            />
            <p className="text-[11px] text-gray-400">Standard comma-separated file exported from any software.</p>
          </div>

          {/* Method 2: .XLSX Binary Upload using ExcelJS */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 space-y-2">
            <label className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              2. Upload Excel Workbook (.xlsx)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleXlsxUpload}
              disabled={isParsingFile}
              className="w-full text-xs text-gray-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-slate-800 dark:file:text-slate-200 disabled:opacity-50"
            />
            <p className="text-[11px] text-gray-400">
              {isParsingFile ? "Reading Excel sheet in browser..." : "Native Microsoft Excel spreadsheet (.xlsx) parsed via exceljs."}
            </p>
          </div>
        </div>

        {/* Method 3: Paste-from-Excel Textarea */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
            <ClipboardPaste className="w-4 h-4 text-indigo-600" />
            3. Or Paste Raw Content (Copy & Paste directly from Excel or CSV):
          </label>
          <textarea
            value={rawTextContent}
            onChange={(e) => handleTextareaChange(e.target.value)}
            rows={5}
            placeholder={
              activeTab === "STUDENTS"
                ? `Admission Number\tFirst Name\tLast Name\tClass Name\tSection\tParent Phone\nADM-001\tAarav\tSharma\t10-A\t\t9876543210`
                : activeTab === "STAFF"
                ? `Employee Code\tFirst Name\tLast Name\tOfficial Email\tContact Phone\tSystem Role\nEMP-101\tVikram\tMalhotra\tvikram@school.in\t9876543210\tTEACHER`
                : `admissionNumber,grossAmount,dueDate\nADM-001,5000,2026-11-30`
            }
            className="w-full font-mono text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[11px] text-gray-400">
            {fileName ? `Loaded file: ${fileName}` : "Tip: You can select cells in Excel, press Ctrl+C, and paste directly here."}
          </p>
        </div>

        {/* Dry-Run Validation Preview Section */}
        {dryRunSummary && (
          <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Dry-Run Preview: Clerk Validation Report
                </h4>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Pre-flight inspection for {dryRunSummary.totalRows} row(s) before committing to institutional database.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                  ✓ {dryRunSummary.validRowsCount} Valid
                </span>
                {dryRunSummary.duplicatesCount > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                    ℹ {dryRunSummary.duplicatesCount} Existing / Duplicate
                  </span>
                )}
                {dryRunSummary.invalidRowsCount > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                    ✕ {dryRunSummary.invalidRowsCount} Defective
                  </span>
                )}
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 dark:bg-slate-800/80 sticky top-0 text-gray-600 dark:text-slate-400 font-semibold border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Line #</th>
                    <th className="py-2.5 px-3">Identifier</th>
                    <th className="py-2.5 px-3">Name / Role</th>
                    <th className="py-2.5 px-3">Resolved Class/Dept</th>
                    <th className="py-2.5 px-3">Status / Actionable Fix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {dryRunSummary.rows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={`hover:bg-gray-50/50 dark:hover:bg-slate-800/40 ${
                        row.isValid ? "" : "bg-rose-50/30 dark:bg-rose-950/20"
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono text-gray-400">#{row.rowNumber}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-gray-900 dark:text-white">
                        {row.identifier || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-gray-800 dark:text-slate-200 font-medium">
                        {row.displayName || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-slate-300">
                        {row.classSection || "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        {row.isValid ? (
                          row.isDuplicate ? (
                            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Already Registered (Will Merge)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Ready to Import
                            </span>
                          )
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                              <XCircle className="w-3.5 h-3.5 shrink-0" /> {row.error}
                            </span>
                            {row.actionableFix && (
                              <p className="text-[11px] text-gray-500 dark:text-slate-400 pl-4">
                                Fix: {row.actionableFix}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
          <button
            onClick={handleDryRun}
            disabled={isValidating || !rawTextContent.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 font-semibold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isValidating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> Validating Preview...
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Preview & Validate (Dry Run)
              </>
            )}
          </button>

          <button
            onClick={handleImport}
            disabled={isSubmitting || !rawTextContent.trim()}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Committing Records...
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" /> Run Resilient Import
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
