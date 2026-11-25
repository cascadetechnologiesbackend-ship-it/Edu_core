"use client";

import React, { useState, useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import {
  DATASET_SCHEMAS,
  ImportDatasetKey,
  parseCsvText,
  validateImportBatch,
  generateRejectedRowsCsv,
  BatchValidationSummary,
} from "@/lib/importExportEngine";

const WIZARD_STEPS = [
  "Template",
  "Upload",
  "Column Mapping",
  "Preview",
  "Validate",
  "Review",
  "Execute",
  "Result",
] as const;

export interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasetKey: ImportDatasetKey;
  onExecuteImport?: (
    validRows: Record<string, string>[]
  ) => Promise<{ importedCount: number; message?: string }>;
}

export function ImportWizard({
  open,
  onOpenChange,
  datasetKey,
  onExecuteImport,
}: ImportWizardProps) {
  const schema = DATASET_SCHEMAS[datasetKey];

  const [stepIndex, setStepIndex] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<BatchValidationSummary | null>(null);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ importedCount: number; message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentStep = WIZARD_STEPS[stepIndex];

  const mappedRows = useMemo(() => {
    return rawRows.map((row) => {
      const mapped: Record<string, string> = {};
      for (const col of schema.columns) {
        const sourceHeader = columnMap[col.key];
        mapped[col.key] = sourceHeader ? row[sourceHeader] ?? "" : "";
      }
      return mapped;
    });
  }, [rawRows, columnMap, schema.columns]);

  const handleReset = () => {
    setStepIndex(0);
    setFileName(null);
    setHeaders([]);
    setRawRows([]);
    setColumnMap({});
    setValidation(null);
    setExecuting(false);
    setResult(null);
    setError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError("The uploaded file is empty or has no data rows.");
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);

      // Auto-map matching headers
      const autoMap: Record<string, string> = {};
      for (const col of schema.columns) {
        const match = parsed.headers.find(
          (h) =>
            h.trim().toLowerCase() === col.key.toLowerCase() ||
            h.trim().toLowerCase() === col.label.toLowerCase()
        );
        if (match) autoMap[col.key] = match;
      }
      setColumnMap(autoMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse uploaded file.");
    }
  };

  const handleRunValidation = () => {
    setError(null);
    try {
      const summary = validateImportBatch(datasetKey, mappedRows);
      setValidation(summary);
      setStepIndex(5); // Review
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed.");
    }
  };

  const handleExecute = async () => {
    if (!validation) return;
    setError(null);
    setExecuting(true);
    try {
      const validRows = validation.rows
        .filter((r) => r.isValid)
        .map((r) => r.data);

      if (onExecuteImport) {
        const res = await onExecuteImport(validRows);
        setResult(res);
      } else {
        setResult({
          importedCount: validRows.length,
          message: `Successfully imported ${validRows.length} ${schema.displayName} records.`,
        });
      }
      setStepIndex(7); // Result
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import execution failed.");
    } finally {
      setExecuting(false);
    }
  };

  const handleDownloadErrors = () => {
    if (!validation) return;
    const csv = generateRejectedRowsCsv(validation);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${datasetKey.toLowerCase()}-rejected-rows.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canGoNext = () => {
    if (stepIndex === 1 && rawRows.length === 0) return false;
    if (stepIndex === 4) return false; // Validate step uses explicit button
    if (stepIndex === 6) return false; // Execute step uses explicit button
    if (stepIndex === 7) return false;
    return true;
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleReset();
        onOpenChange(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby="import-wizard-description"
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl focus:outline-none dark:border-slate-800 dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Import {schema.displayName}
                </Dialog.Title>
                <Dialog.Description
                  id="import-wizard-description"
                  className="text-xs text-slate-500 dark:text-slate-400"
                >
                  Step {stepIndex + 1} of {WIZARD_STEPS.length}: {currentStep}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close import wizard"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Stepper */}
          <nav aria-label="Import wizard steps" className="border-b border-slate-100 px-6 py-3 dark:border-slate-800/80">
            <ol className="flex items-center justify-between gap-1 overflow-x-auto text-xs">
              {WIZARD_STEPS.map((label, idx) => {
                const isActive = idx === stepIndex;
                const isDone = idx < stepIndex;
                return (
                  <li
                    key={label}
                    aria-current={isActive ? "step" : undefined}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 font-medium ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                        : isDone
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]">
                      {isDone ? "✓" : idx + 1}
                    </span>
                    <span>{label}</span>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {stepIndex === 0 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Download the official Excel template for <strong>{schema.displayName}</strong>. It includes required headers, instructions, and reference values.
                </p>
                <a
                  href={`/api/import-export/template?dataset=${datasetKey}`}
                  download
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>Download {schema.displayName} Template (.xlsx)</span>
                </a>
              </div>
            )}

            {stepIndex === 1 && (
              <div className="space-y-4">
                <label
                  htmlFor="import-file-input"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-indigo-400 dark:border-slate-700"
                >
                  <Upload className="h-8 w-8 text-slate-400" aria-hidden="true" />
                  <span className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    {fileName ? `Selected: ${fileName}` : "Click to upload CSV file"}
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    Maximum 5,000 rows per batch
                  </span>
                  <input
                    id="import-file-input"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
                {rawRows.length > 0 && (
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Parsed {rawRows.length} rows and {headers.length} columns.
                  </p>
                )}
              </div>
            )}

            {stepIndex === 2 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Map your file columns to the target schema fields.
                </p>
                <div className="space-y-2">
                  {schema.columns.map((col) => (
                    <div
                      key={col.key}
                      className="grid grid-cols-2 items-center gap-4 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
                    >
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {col.label}{" "}
                        {col.required && <span className="text-red-500">*</span>}
                      </div>
                      <select
                        aria-label={`Map column for ${col.label}`}
                        value={columnMap[col.key] ?? ""}
                        onChange={(e) =>
                          setColumnMap((prev) => ({ ...prev, [col.key]: e.target.value }))
                        }
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="">-- Unmapped --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stepIndex === 3 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Previewing first {Math.min(5, mappedRows.length)} of {mappedRows.length} mapped rows.
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/70">
                      <tr>
                        {schema.columns.slice(0, 5).map((col) => (
                          <th key={col.key} className="px-3 py-2 font-semibold">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {mappedRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx}>
                          {schema.columns.slice(0, 5).map((col) => (
                            <td key={col.key} className="px-3 py-2 text-slate-700 dark:text-slate-300">
                              {row[col.key] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {stepIndex === 4 && (
              <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Run dry-run validation on {mappedRows.length} rows before committing to the database.
                </p>
                <button
                  type="button"
                  onClick={handleRunValidation}
                  className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Validate {mappedRows.length} Rows
                </button>
              </div>
            )}

            {stepIndex === 5 && validation && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <div className="text-xs text-slate-500">Total Rows</div>
                    <div className="text-xl font-semibold">{validation.totalRows}</div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <div className="text-xs text-emerald-700 dark:text-emerald-400">Valid</div>
                    <div className="text-xl font-semibold text-emerald-700 dark:text-emerald-300">
                      {validation.validRowsCount}
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                    <div className="text-xs text-amber-700 dark:text-amber-400">Errors</div>
                    <div className="text-xl font-semibold text-amber-700 dark:text-amber-300">
                      {validation.invalidRowsCount}
                    </div>
                  </div>
                </div>
                {validation.invalidRowsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadErrors}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Download Rejected Rows CSV</span>
                  </button>
                )}
              </div>
            )}

            {stepIndex === 6 && validation && (
              <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Ready to import <strong>{validation.validRowsCount}</strong> valid records into{" "}
                  <strong>{schema.displayName}</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={executing || validation.validRowsCount === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {executing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  <span>{executing ? "Importing..." : "Confirm & Execute Import"}</span>
                </button>
              </div>
            )}

            {stepIndex === 7 && result && (
              <div className="flex flex-col items-center justify-center space-y-3 py-6 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden="true" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Import Complete
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {result.message || `Imported ${result.importedCount} records successfully.`}
                </p>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={stepIndex === 0 || stepIndex === 7 || executing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-2">
              {stepIndex === 7 ? (
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Done
                  </button>
                </Dialog.Close>
              ) : (
                <button
                  type="button"
                  onClick={() => setStepIndex((i) => Math.min(WIZARD_STEPS.length - 1, i + 1))}
                  disabled={!canGoNext()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  <span>Next</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
