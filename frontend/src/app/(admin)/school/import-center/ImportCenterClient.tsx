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
} from "lucide-react";
import { importHistoricalFeeBalances } from "./actions";

interface ImportCenterClientProps {
  academicYears: { id: string; name: string; isActive: boolean }[];
}

export function ImportCenterClient({ academicYears }: ImportCenterClientProps) {
  const [academicYearId, setAcademicYearId] = useState(academicYears[0]?.id || "");
  const [csvContent, setCsvContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    count: number;
    errors: string[];
  } | null>(null);

  const sampleCsv = `admissionNumber,grossAmount,dueDate
ADM-2024-001,4500,2026-11-15
ADM-2024-002,12000,2026-11-20
ADM-2024-003,3250,2026-12-01`;

  const downloadSampleTemplate = () => {
    const blob = new Blob([sampleCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "schoolmitra_fee_dues_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!academicYearId) {
      alert("Please select an academic year.");
      return;
    }
    if (!csvContent.trim()) {
      alert("Please upload or paste CSV content.");
      return;
    }

    // Parse CSV lines
    const lines = csvContent
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) {
      alert("CSV must contain a header and at least one data row.");
      return;
    }

    const firstLine = lines[0];
    if (!firstLine) return;
    const header = firstLine.split(",").map((h) => h.trim().toLowerCase());
    const admIdx = header.indexOf("admissionnumber");
    const amountIdx = header.indexOf("grossamount");
    const dueIdx = header.indexOf("duedate");

    if (admIdx === -1 || amountIdx === -1) {
      alert("CSV must contain 'admissionNumber' and 'grossAmount' columns.");
      return;
    }

    const rows: { admissionNumber: string; grossAmount: number; dueDate?: string }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const cols = line.split(",").map((c) => c.trim());
      if (cols.length < 2) continue;
      const adm = cols[admIdx];
      const amtStr = cols[amountIdx];
      const amount = amtStr ? parseFloat(amtStr) : NaN;
      const due = dueIdx !== -1 && cols[dueIdx] ? cols[dueIdx] : undefined;

      if (adm && !isNaN(amount)) {
        rows.push({
          admissionNumber: adm,
          grossAmount: amount,
          ...(due ? { dueDate: due } : {}),
        });
      }
    }

    if (rows.length === 0) {
      alert("No valid data rows found in the CSV.");
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await importHistoricalFeeBalances(academicYearId, rows);
      setResult(res);
      if (res.success && res.errors.length === 0) {
        setCsvContent("");
      }
    } catch (err: any) {
      setResult({
        success: false,
        count: 0,
        errors: [err.message || "Failed to process import"],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Template Download & Instructions Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Historical Fee Balances & External Invoices
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Bulk-import existing student fee balances and legacy dues from legacy ERPs or spreadsheets.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-800 space-y-2 text-xs text-gray-600 dark:text-slate-300">
            <p className="font-semibold text-gray-900 dark:text-white">CSV Column Requirements:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <code className="bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                  admissionNumber
                </code>{" "}
                (Required) - Exact student admission ID in SchoolMitra.
              </li>
              <li>
                <code className="bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                  grossAmount
                </code>{" "}
                (Required) - Total amount outstanding in ₹.
              </li>
              <li>
                <code className="bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                  dueDate
                </code>{" "}
                (Optional) - Format YYYY-MM-DD. Defaults to 30 days from today.
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
              Download Standard CSV
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              Pre-formatted template with exact column headers to ensure zero parsing errors.
            </p>
          </div>

          <button
            onClick={downloadSampleTemplate}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs font-semibold text-gray-800 dark:text-slate-200 transition"
          >
            <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Download Sample CSV
          </button>
        </div>
      </div>

      {/* Import Form Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Batch Data Importer
        </h3>

        {result && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 ${
              result.success && result.errors.length === 0
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              )}
              <span>Import Processed: {result.count} records successfully created!</span>
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-1 pl-6">
                <p className="font-semibold">Warnings / Errors ({result.errors.length}):</p>
                <ul className="list-disc pl-4 max-h-32 overflow-y-auto space-y-0.5">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
              Assign to Academic Year *
            </label>
            <select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              className="w-full text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.isActive ? "(Current Active)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
              Upload CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="w-full text-xs text-gray-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-slate-800 dark:file:text-slate-200"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
            Or Paste Raw CSV Content Below:
          </label>
          <textarea
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            rows={6}
            placeholder={`admissionNumber,grossAmount,dueDate\nADM-001,5000,2026-11-30`}
            className="w-full font-mono text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleImport}
            disabled={isSubmitting || !csvContent.trim()}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Importing Records...
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" /> Run Batch Import
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
