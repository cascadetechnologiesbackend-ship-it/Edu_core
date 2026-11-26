"use client";

import React, { useState, useMemo, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Checkbox from "@radix-ui/react-checkbox";
import { X, Download, Check, FileSpreadsheet, Calendar, Filter, Layers } from "lucide-react";
import { DATASET_SCHEMAS, ImportDatasetKey } from "@/lib/importExportEngine";
import { JobStatusBadge, type ImportExportJobStatus } from "./JobStatusBadge";

export type ExportFormat = "CSV" | "XLSX" | "PDF";
export type ExportScope = "all" | "filtered" | "dateRange";

export interface ExportRequestPayload {
  datasetKey: ImportDatasetKey;
  format: ExportFormat;
  columns: string[];
  scope: ExportScope;
  dateFrom?: string;
  dateTo?: string;
}

export interface ExportJobInfo {
  jobId: string;
  status: ImportExportJobStatus;
  downloadUrl?: string | null;
  recordCount?: number | null;
  errorMessage?: string | null;
}

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasetKey: ImportDatasetKey;
  filteredCount?: number;
  totalCount?: number;
  onConfirm?: (payload: ExportRequestPayload) => Promise<void> | void;
  onJobCompleted?: (job: ExportJobInfo) => void;
}

function triggerDownloadUrl(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function ExportDialog({
  open,
  onOpenChange,
  datasetKey,
  filteredCount,
  totalCount,
  onConfirm,
  onJobCompleted,
}: ExportDialogProps) {
  const schema = DATASET_SCHEMAS[datasetKey];
  const allColumnKeys = useMemo(
    () => schema.columns.filter((c) => !c.isSensitive).map((c) => c.key),
    [schema]
  );

  const [format, setFormat] = useState<ExportFormat>("XLSX");
  const [selectedColumns, setSelectedColumns] = useState<string[]>(allColumnKeys);
  const [scope, setScope] = useState<ExportScope>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [activeJob, setActiveJob] = useState<ExportJobInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedColumns(allColumnKeys);
    setActiveJob(null);
    setError(null);
  }, [datasetKey, open, allColumnKeys]);

  const toggleColumn = (key: string) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAllColumns = () => setSelectedColumns(allColumnKeys);
  const clearAllColumns = () => setSelectedColumns([]);

  const scopeDescription = useMemo(() => {
    if (scope === "all") {
      return totalCount !== undefined
        ? `Exports all ${totalCount} records in ${schema.displayName}.`
        : `Exports all available records in ${schema.displayName}.`;
    }
    if (scope === "filtered") {
      return filteredCount !== undefined
        ? `Exports ${filteredCount} records matching your current table filters.`
        : "Exports only records matching your current table filters.";
    }
    if (dateFrom && dateTo) {
      return `Exports records created or updated between ${dateFrom} and ${dateTo}.`;
    }
    return "Exports records within the specified date range.";
  }, [scope, totalCount, filteredCount, schema.displayName, dateFrom, dateTo]);

  const pollJobUntilTerminal = async (jobId: string): Promise<ExportJobInfo> => {
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await fetch(`/api/import-export/jobs/${encodeURIComponent(jobId)}`);
      if (!pollRes.ok) {
        const errData = await pollRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to check export job status.");
      }
      const data = await pollRes.json();
      const info: ExportJobInfo = {
        jobId: data.jobId,
        status: data.status,
        downloadUrl: data.downloadUrl,
        recordCount: data.recordCount,
        errorMessage: data.errorMessage,
      };
      setActiveJob(info);
      if (data.status === "COMPLETED" || data.status === "FAILED" || data.status === "EXPIRED") {
        return info;
      }
    }
    throw new Error("Export job is still processing. Check Job History in Import Center.");
  };

  const handleConfirm = async () => {
    setError(null);
    setActiveJob(null);
    if (selectedColumns.length === 0) {
      setError("Please select at least one column to export.");
      return;
    }
    if (scope === "dateRange" && (!dateFrom || !dateTo)) {
      setError("Please provide both start and end dates for the date range.");
      return;
    }
    if (scope === "dateRange" && dateFrom > dateTo) {
      setError("Start date cannot be after end date.");
      return;
    }

    const payload: ExportRequestPayload = {
      datasetKey,
      format,
      columns: selectedColumns,
      scope,
      ...(scope === "dateRange" ? { dateFrom, dateTo } : {}),
    };

    try {
      setSubmitting(true);
      if (onConfirm) {
        await onConfirm(payload);
        onOpenChange(false);
        return;
      }

      const res = await fetch("/api/import-export/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to start export job.");
      }

      let finalJob: ExportJobInfo = {
        jobId: data.jobId,
        status: data.status,
        downloadUrl: data.downloadUrl,
        recordCount: data.recordCount,
        errorMessage: data.error,
      };
      setActiveJob(finalJob);

      if (finalJob.status === "QUEUED" || finalJob.status === "PROCESSING") {
        finalJob = await pollJobUntilTerminal(finalJob.jobId);
      }

      if (finalJob.status === "FAILED") {
        throw new Error(finalJob.errorMessage || "Export job failed.");
      }

      if (finalJob.downloadUrl) {
        triggerDownloadUrl(finalJob.downloadUrl);
      }
      onJobCompleted?.(finalJob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby="export-dialog-description"
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl focus:outline-none dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Export {schema.displayName}
                </Dialog.Title>
                <Dialog.Description
                  id="export-dialog-description"
                  className="text-xs text-slate-500 dark:text-slate-400"
                >
                  Choose format, columns, and record scope.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close export dialog"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-5 space-y-5">
            {/* Format Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Export Format
              </label>
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Export format">
                {(["CSV", "XLSX", "PDF"] as ExportFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    role="radio"
                    aria-checked={format === fmt}
                    onClick={() => setFormat(fmt)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      format === fmt
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Scope Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Record Scope
              </label>
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Export scope">
                <button
                  type="button"
                  role="radio"
                  aria-checked={scope === "all"}
                  onClick={() => setScope("all")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    scope === "all"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                  All
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={scope === "filtered"}
                  onClick={() => setScope("filtered")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    scope === "filtered"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                  Filtered
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={scope === "dateRange"}
                  onClick={() => setScope("dateRange")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    scope === "dateRange"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  Date Range
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                {scopeDescription}
              </p>

              {scope === "dateRange" && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="export-date-from" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                      From
                    </label>
                    <input
                      id="export-date-from"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="export-date-to" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                      To
                    </label>
                    <input
                      id="export-date-to"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Column Multi-select */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Columns ({selectedColumns.length}/{allColumnKeys.length})
                </label>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAllColumns}
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Select all
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={clearAllColumns}
                    className="font-medium text-slate-500 hover:underline dark:text-slate-400"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2.5 dark:border-slate-800">
                {schema.columns
                  .filter((c) => !c.isSensitive)
                  .map((col) => {
                    const checked = selectedColumns.includes(col.key);
                    return (
                      <label
                        key={col.key}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <Checkbox.Root
                          checked={checked}
                          onCheckedChange={() => toggleColumn(col.key)}
                          aria-label={`Include column ${col.label}`}
                          className="flex h-4 w-4 items-center justify-center rounded border border-slate-300 bg-white data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600 dark:border-slate-600 dark:bg-slate-800"
                        >
                          <Checkbox.Indicator>
                            <Check className="h-3 w-3 text-white" />
                          </Checkbox.Indicator>
                        </Checkbox.Root>
                        <span className="text-slate-700 dark:text-slate-200">{col.label}</span>
                      </label>
                    );
                  })}
              </div>
            </div>

            {activeJob && (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  Job <span className="font-mono">{activeJob.jobId.slice(0, 8)}</span>
                  {typeof activeJob.recordCount === "number" && ` · ${activeJob.recordCount} rows`}
                </div>
                <JobStatusBadge
                  status={activeJob.status}
                  downloadUrl={activeJob.downloadUrl ?? null}
                />
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {error}
              </p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {activeJob?.status === "COMPLETED" ? "Close" : "Cancel"}
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{submitting ? "Exporting..." : `Export ${format}`}</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
