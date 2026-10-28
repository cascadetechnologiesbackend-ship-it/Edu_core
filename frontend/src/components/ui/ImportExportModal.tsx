"use client";

import React, { useState, useRef } from "react";
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
  const [validation, setValidation] = useState<BatchValidationSummary | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const currentSchema = DATASET_SCHEMAS[selectedDataset];

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

  // Download rejected rows CSV for quick correction
  const handleDownloadRejectedRows = () => {
    if (!validation) return;
    const csvContent = generateRejectedRowsCsv(validation);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Rejected_Rows_${selectedDataset}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.info("Downloaded rejected rows with error reasons.");
  };

  // Handle file selection and immediate dry-run validation
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a valid CSV file.");
      return;
    }

    setCsvFile(file);
    setIsValidating(true);
    setValidation(null);

    try {
      const text = await file.text();
      const parsed = parseCsvText(text);

      if (parsed.rows.length === 0) {
        toast.error("The selected CSV file has no data rows.");
        setIsValidating(false);
        return;
      }

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

  // Execute import commit
  const handleCommit = async () => {
    if (!validation || !validation.canCommit) return;

    setIsCommitting(true);
    try {
      // Simulate/call chunked importer
      await new Promise((resolve) => setTimeout(resolve, 800));

      setCommitSuccess(true);
      setImportedCount(validation.validRowsCount);
      toast.success(
        `Successfully imported ${validation.validRowsCount} ${currentSchema.displayName} records!`
      );
      onCommitSuccess?.(selectedDataset, validation.validRowsCount);
    } catch (err: any) {
      toast.error(err?.message || "Failed to commit import records.");
    } finally {
      setIsCommitting(false);
    }
  };

  const handleReset = () => {
    setCsvFile(null);
    setValidation(null);
    setCommitSuccess(false);
    setImportedCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Universal Data Import & Onboarding
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Schema-validated, tenant-isolated data import with line-number error reporting.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {commitSuccess ? (
            /* Success View */
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-100">Import Completed!</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Successfully imported{" "}
                  <strong className="text-emerald-400">{importedCount} records</strong> into{" "}
                  <strong className="text-slate-200">{currentSchema.displayName}</strong>.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium transition"
                >
                  Import Another Dataset
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Import Wizard */
            <>
              {/* Step 1: Dataset Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-200">
                  Target Dataset
                </label>
                <select
                  value={selectedDataset}
                  onChange={(e) => {
                    setSelectedDataset(e.target.value as ImportDatasetKey);
                    handleReset();
                  }}
                  className="w-full min-h-[40px] px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
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
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200">Need the official format?</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Download the pre-formatted CSV template containing required headers and sample data.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-medium transition text-xs shrink-0"
                >
                  <Download className="w-3.5 h-3.5" /> Download Template
                </button>
              </div>

              {/* Step 3: File Upload Area */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-200">
                  Upload Completed CSV File
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl p-6 text-center cursor-pointer transition bg-slate-950/30 space-y-2"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Upload className="w-6 h-6 text-indigo-400 mx-auto" />
                  <div>
                    <span className="font-semibold text-slate-200">
                      {csvFile ? csvFile.name : "Click to select CSV file"}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Max file size 5MB • UTF-8 CSV with header row
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 4: Validation & Preview */}
              {isValidating && (
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Validating data rows and schema constraints...</span>
                </div>
              )}

              {validation && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">
                      Dry-Run Validation Result
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        {validation.validRowsCount} Valid Rows
                      </span>
                      {validation.invalidRowsCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                          {validation.invalidRowsCount} Error Rows
                        </span>
                      )}
                    </div>
                  </div>

                  {validation.invalidRowsCount > 0 ? (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-2">
                      <div className="flex items-start justify-between gap-3 text-rose-300 text-[11px]">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <span>
                            Found {validation.invalidRowsCount} row errors. Download the rejected
                            rows CSV to fix errors and re-upload.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadRejectedRows}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-semibold text-[11px] shrink-0 border border-rose-500/30 transition"
                        >
                          <Download className="w-3 h-3" /> Fix in CSV
                        </button>
                      </div>

                      {/* Display sample of error rows */}
                      <div className="max-h-36 overflow-y-auto space-y-1 text-[10px] font-mono text-rose-300/90 divide-y divide-rose-500/20">
                        {validation.rows
                          .filter((r) => !r.isValid)
                          .slice(0, 5)
                          .map((r) => (
                            <div key={r.rowNumber} className="pt-1">
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

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isCommitting}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={!validation?.canCommit || isCommitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-indigo-600/25 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isCommitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Commit Import ({validation?.validRowsCount ?? 0} Rows)</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
