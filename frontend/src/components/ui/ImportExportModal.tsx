"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  FileCheck,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  DATASET_SCHEMAS,
  ImportDatasetKey,
  generateCsvTemplate,
  parseCsvText,
  validateImportBatch,
  generateRejectedRowsCsv,
  BatchValidationSummary,
} from "@/lib/importExportEngine";
import {
  commitStudentImportAction,
  commitStaffImportAction,
  type ImportCommitResult,
} from "@/app/(admin)/school/import-center/actions";

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDataset?: ImportDatasetKey;
  onCommitSuccess?: (datasetKey: ImportDatasetKey, count: number) => void;
}

export function ImportExportModal({
  isOpen,
  onClose,
  defaultDataset = "STUDENTS",
  onCommitSuccess,
}: ImportExportModalProps) {
  const [selectedDataset, setSelectedDataset] = useState<ImportDatasetKey>(defaultDataset);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [validation, setValidation] = useState<BatchValidationSummary | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    createdCount: number;
    skippedCount: number;
    totalProcessed: number;
  } | null>(null);
  const [serverError, setServerError] = useState<{
    message: string;
    errors: string[];
  } | null>(null);
  const [serverRejectedCsv, setServerRejectedCsv] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedDataset(defaultDataset);
      handleReset();
    }
  }, [isOpen, defaultDataset]);

  if (!isOpen) return null;

  const currentSchema = DATASET_SCHEMAS[selectedDataset];

  const handleReset = () => {
    setCsvFile(null);
    setParsedRows([]);
    setValidation(null);
    setCommitSuccess(false);
    setCommitResult(null);
    setServerError(null);
    setServerRejectedCsv(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDatasetChange = (newDataset: ImportDatasetKey) => {
    setSelectedDataset(newDataset);
    handleReset();
  };

  // Download schema-compliant template
  const handleDownloadTemplate = () => {
    const csvContent = generateCsvTemplate(selectedDataset);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `SchoolMitra_${selectedDataset}_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Template for ${currentSchema.displayName} downloaded.`);
  };

  // Generic CSV downloader helper
  const handleDownloadCsv = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.info("Downloaded rejected rows CSV with error reasons.");
  };

  // Download rejected rows from client dry-run validation
  const handleDownloadClientRejectedRows = () => {
    if (!validation) return;
    const csvContent = generateRejectedRowsCsv(validation);
    handleDownloadCsv(csvContent, `Validation_Errors_${selectedDataset}.csv`);
  };

  // Download rejected rows returned by server commit action
  const handleDownloadServerRejectedRows = () => {
    if (!serverRejectedCsv) return;
    handleDownloadCsv(serverRejectedCsv, `Server_Rejected_${selectedDataset}_${Date.now()}.csv`);
  };

  // Handle file selection and immediate dry-run validation
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a valid CSV file (.csv).");
      return;
    }

    setCsvFile(file);
    setIsValidating(true);
    setValidation(null);
    setServerError(null);
    setServerRejectedCsv(null);

    try {
      const text = await file.text();
      const parsed = parseCsvText(text);

      if (parsed.rows.length === 0) {
        toast.error("The selected CSV file has no data rows.");
        setParsedRows([]);
        return;
      }

      // Tier 1 defense: 5,000-row cap per file
      if (parsed.rows.length > 5000) {
        const msg = `Import file exceeds maximum allowed limit of 5000 rows (received ${parsed.rows.length} rows). Please split your file into smaller batches.`;
        toast.error(msg);
        setServerError({ message: msg, errors: [msg] });
        setParsedRows([]);
        return;
      }

      setParsedRows(parsed.rows);
      const valResult = validateImportBatch(selectedDataset, parsed.rows);
      setValidation(valResult);

      if (valResult.canCommit) {
        toast.success(`Validated ${valResult.validRowsCount} rows successfully.`);
      } else {
        toast.warning(
          `Validation found ${valResult.invalidRowsCount} error rows out of ${valResult.totalRows} total rows.`
        );
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to parse CSV file.");
    } finally {
      setIsValidating(false);
    }
  };

  // Execute real import commit server actions
  const handleCommit = async () => {
    if (!validation || !validation.canCommit || parsedRows.length === 0) return;

    setIsCommitting(true);
    setServerError(null);
    setServerRejectedCsv(null);

    try {
      let res: ImportCommitResult;

      if (selectedDataset === "STUDENTS") {
        res = await commitStudentImportAction(parsedRows);
      } else if (selectedDataset === "STAFF") {
        res = await commitStaffImportAction(parsedRows);
      } else {
        throw new Error(
          `Direct commit for ${currentSchema.displayName} is not yet implemented. Only STUDENTS and STAFF imports are enabled in this version.`
        );
      }

      if (!res.success) {
        const errMsg: string =
          res.message ||
          (res.errors && res.errors.length > 0 && res.errors[0] ? res.errors[0] : "Server rejected import batch.");
        setServerError({
          message: errMsg,
          errors: res.errors && res.errors.length > 0 ? res.errors : [errMsg],
        });
        if (res.rejectedRowsCsv) {
          setServerRejectedCsv(res.rejectedRowsCsv);
        }
        toast.error(errMsg);
        return;
      }

      // Server-confirmed success with honest counts
      const created = res.createdCount ?? 0;
      const skipped = res.skippedCount ?? 0;
      const total = res.totalProcessed ?? parsedRows.length;

      setCommitResult({
        createdCount: created,
        skippedCount: skipped,
        totalProcessed: total,
      });
      setCommitSuccess(true);

      toast.success(
        `Successfully processed ${total} records (${created} created, ${skipped} skipped) into ${currentSchema.displayName}!`
      );
      onCommitSuccess?.(selectedDataset, created);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to commit import records.";
      setServerError({
        message: errMsg,
        errors: [errMsg],
      });
      toast.error(errMsg);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-100 truncate">
                Universal Data Import & Onboarding
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate sm:whitespace-normal">
                Schema-validated, tenant-isolated data import with line-number error reporting.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isCommitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 text-xs text-slate-300">
          {commitSuccess && commitResult ? (
            /* Success View with Honest Server-Confirmed Counts */
            <div className="py-6 sm:py-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-100">Import Transaction Committed!</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Server confirmed all records were processed transactionally with tenant isolation in{" "}
                  <strong className="text-slate-200">{currentSchema.displayName}</strong>.
                </p>
              </div>

              {/* 3-Metric Stat Grid (Reflows to 1 column on 390px mobile) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 max-w-lg mx-auto pt-2">
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-center">
                  <span className="text-[11px] text-slate-400 font-medium block">Total In Batch</span>
                  <strong className="text-base font-bold text-slate-200 mt-0.5 block">
                    {commitResult.totalProcessed}
                  </strong>
                </div>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-center">
                  <span className="text-[11px] text-emerald-300 font-medium block">Created (New)</span>
                  <strong className="text-base font-bold text-emerald-400 mt-0.5 block">
                    {commitResult.createdCount}
                  </strong>
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-center">
                  <span className="text-[11px] text-amber-300 font-medium block">Skipped (Existing)</span>
                  <strong className="text-base font-bold text-amber-400 mt-0.5 block">
                    {commitResult.skippedCount}
                  </strong>
                </div>
              </div>

              {commitResult.skippedCount > 0 && (
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-left max-w-lg mx-auto flex items-start gap-2 text-[11px] text-slate-400">
                  <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Idempotency Law:</strong> {commitResult.skippedCount} records already existed with matching unique keys (admission number or employee code) and were skipped idempotently without duplicating institutional records.
                  </span>
                </div>
              )}

              <div className="pt-3 flex flex-col-reverse sm:flex-row items-center justify-center gap-2.5 sm:gap-3 max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium transition min-h-[40px]"
                >
                  Import Another Dataset
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-indigo-600/25 min-h-[40px]"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Import Wizard */
            <>
              {/* Step 1: Dataset Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-200">
                  Target Dataset
                </label>
                <select
                  value={selectedDataset}
                  onChange={(e) => handleDatasetChange(e.target.value as ImportDatasetKey)}
                  disabled={isCommitting}
                  className="w-full min-h-[42px] px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-xs disabled:opacity-50"
                >
                  {Object.values(DATASET_SCHEMAS).map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.displayName} ({s.columns.length} columns)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">{currentSchema.description}</p>
              </div>

              {/* Step 2: Download Template Button */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-semibold text-slate-200 block">Need the official format?</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Download the pre-formatted CSV template containing required headers and sample data.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={isCommitting}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-medium transition text-xs shrink-0 w-full sm:w-auto min-h-[38px] disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" /> Download Template
                </button>
              </div>

              {/* Step 3: File Upload Area */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-200">
                  Upload Completed CSV File
                </label>
                <div
                  onClick={() => !isCommitting && fileInputRef.current?.click()}
                  className={`border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 sm:p-6 text-center cursor-pointer transition bg-slate-950/30 space-y-2 ${
                    isCommitting ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    disabled={isCommitting}
                    className="hidden"
                  />
                  <Upload className="w-6 h-6 text-indigo-400 mx-auto" />
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-200 block truncate max-w-full px-2">
                      {csvFile ? csvFile.name : "Click to select CSV file"}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Max file size 5MB • Max 5,000 rows • UTF-8 CSV with header row
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 4: Validation Loading State */}
              {isValidating && (
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Validating data rows and schema constraints...</span>
                </div>
              )}

              {/* Step 4: Dry-Run Validation Result */}
              {validation && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-200">
                      Dry-Run Validation Result
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium shrink-0">
                        {validation.validRowsCount} Valid Rows
                      </span>
                      {validation.invalidRowsCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium shrink-0">
                          {validation.invalidRowsCount} Error Rows
                        </span>
                      )}
                    </div>
                  </div>

                  {validation.invalidRowsCount > 0 ? (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-rose-300 text-[11px]">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <span>
                            Found {validation.invalidRowsCount} row errors. Download the rejected
                            rows CSV to fix errors and re-upload.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadClientRejectedRows}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-semibold text-xs shrink-0 border border-rose-500/30 transition w-full sm:w-auto min-h-[38px]"
                        >
                          <Download className="w-3.5 h-3.5" /> Download Rejected Rows CSV
                        </button>
                      </div>

                      {/* Display sample of error rows */}
                      <div className="max-h-36 overflow-y-auto space-y-1 text-[10px] font-mono text-rose-300/90 divide-y divide-rose-500/20 break-words bg-black/20 p-2 rounded-lg">
                        {validation.rows
                          .filter((r) => !r.isValid)
                          .slice(0, 5)
                          .map((r) => (
                            <div key={r.rowNumber} className="pt-1 first:pt-0">
                              <strong>Line {r.rowNumber}:</strong> {r.errors.join("; ")}
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-300 text-[11px]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        All {validation.totalRows} data rows passed validation and are ready to
                        commit!
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Server Rejection / Error Reporting */}
              {serverError && (
                <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-xl space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-rose-300">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-rose-200 block text-xs">
                          Import Transaction Aborted (All-Or-Nothing Rollback)
                        </span>
                        <p className="text-[11px] text-rose-300/90 mt-0.5">
                          {serverError.message}
                        </p>
                      </div>
                    </div>
                    {serverRejectedCsv && (
                      <button
                        type="button"
                        onClick={handleDownloadServerRejectedRows}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600/30 hover:bg-rose-600/40 text-rose-200 font-semibold text-xs border border-rose-500/40 transition shrink-0 w-full sm:w-auto min-h-[38px]"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Rejected Rows CSV
                      </button>
                    )}
                  </div>

                  {serverError.errors && serverError.errors.length > 0 && (
                    <div className="max-h-36 overflow-y-auto space-y-1 text-[10px] font-mono text-rose-300/90 divide-y divide-rose-500/20 break-words bg-black/25 p-2 rounded-lg">
                      {serverError.errors.slice(0, 10).map((err, idx) => (
                        <div key={idx} className="pt-1 first:pt-0">
                          {err}
                        </div>
                      ))}
                      {serverError.errors.length > 10 && (
                        <div className="pt-1 text-[9px] text-rose-400 italic">
                          ...and {serverError.errors.length - 10} more errors. Download CSV for full line-numbered report.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isCommitting}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs transition font-medium min-h-[40px] flex items-center justify-center disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={!validation?.canCommit || isCommitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-indigo-600/25 disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px]"
                >
                  {isCommitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Committing to Institutional Database...</span>
                    </>
                  ) : (
                    <span>Commit Import ({validation?.validRowsCount ?? 0} Rows)</span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
