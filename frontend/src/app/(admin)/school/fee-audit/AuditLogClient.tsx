"use client";

import React, { useState, useMemo } from "react";
import {
  Clock,
  User,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  Search,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { FilterBar } from "@/components/finance/FilterBar";
import { DataTable, ColumnDef } from "@/components/finance/DataTable";

export interface AuditLogRow {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  previousData: string | null;
  newData: string | null;
  performerEmail: string;
}

export function AuditLogClient({
  logs,
  schoolName,
}: {
  logs: AuditLogRow[];
  schoolName: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter((log) => {
      return (
        log.action.toLowerCase().includes(q) ||
        log.entityType.toLowerCase().includes(q) ||
        (log.reason && log.reason.toLowerCase().includes(q)) ||
        log.performerEmail.toLowerCase().includes(q) ||
        log.entityId.toLowerCase().includes(q)
      );
    });
  }, [logs, searchQuery]);

  // Export to Excel / CSV
  const handleExport = async (format: "xlsx" | "csv") => {
    try {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Audit Event Logs");

      worksheet.columns = [
        { header: "Timestamp", key: "createdAt", width: 22 },
        { header: "Action", key: "action", width: 25 },
        { header: "Entity Type", key: "entityType", width: 20 },
        { header: "Entity ID", key: "entityId", width: 36 },
        { header: "Reason / Notes", key: "reason", width: 35 },
        { header: "Performed By", key: "performerEmail", width: 28 },
        { header: "Previous State", key: "previousData", width: 30 },
        { header: "New State", key: "newData", width: 30 },
      ];

      filteredLogs.forEach((l) => {
        worksheet.addRow({
          createdAt: new Date(l.createdAt).toLocaleString("en-IN"),
          action: l.action,
          entityType: l.entityType,
          entityId: l.entityId,
          reason: l.reason || "N/A",
          performerEmail: l.performerEmail,
          previousData: l.previousData || "None",
          newData: l.newData || "None",
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filteredLogs.length} audit records.`);
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
    }
  };

  const columns: ColumnDef<AuditLogRow>[] = [
    {
      header: "Timestamp",
      accessorKey: "createdAt",
      sortable: true,
      cell: (log) => (
        <div className="flex items-center gap-1.5 font-mono text-gray-500 dark:text-slate-400 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          {new Date(log.createdAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </div>
      ),
    },
    {
      header: "Action",
      accessorKey: "action",
      sortable: true,
      cell: (log) => {
        const isCancelled = log.action === "RECEIPT_CANCELLED";
        const isCarried = log.action === "FEE_CARRIED_FORWARD";
        const isRecon = log.action.includes("RECONCILE");
        const isConcession = log.action.includes("CONCESSION");

        const colorClass = isCancelled
          ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
          : isCarried
          ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
          : isRecon
          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
          : isConcession
          ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800"
          : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800";

        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${colorClass}`}>
            {log.action}
          </span>
        );
      },
    },
    {
      header: "Entity Type",
      accessorKey: "entityType",
      sortable: true,
      cell: (log) => (
        <span className="font-mono text-gray-600 dark:text-slate-400 text-xs">
          {log.entityType}
        </span>
      ),
    },
    {
      header: "Reason / Notes",
      accessorKey: "reason",
      cell: (log) => (
        <div className="max-w-md">
          <p className="text-gray-900 dark:text-white font-medium text-xs">
            {log.reason || "Administrative operation"}
          </p>
          {log.previousData && (
            <p className="text-[11px] text-gray-500 dark:text-slate-400 font-mono mt-0.5 truncate">
              Prev: {log.previousData}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Operator",
      accessorKey: "performerEmail",
      sortable: true,
      cell: (log) => (
        <div className="flex items-center gap-1.5 text-gray-700 dark:text-slate-300 text-xs whitespace-nowrap">
          <User className="w-3.5 h-3.5 text-gray-400" />
          {log.performerEmail}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <FilterBar
          searchKey="q"
          searchPlaceholder="Search audit events by reason, action, entity or operator..."
          filters={[
            {
              key: "action",
              label: "Action",
              options: [
                { label: "Receipt Cancelled", value: "RECEIPT_CANCELLED" },
                { label: "Fee Carried Forward", value: "FEE_CARRIED_FORWARD" },
                { label: "Gateway Reconcile", value: "RECONCILE_GATEWAY_PAYMENT" },
                { label: "Manual Adjustment", value: "MANUAL_ADJUSTMENT" },
                { label: "Fee Waived", value: "FEE_WAIVED" },
              ],
            },
            {
              key: "entityType",
              label: "Entity",
              options: [
                { label: "Fee Payment", value: "FEE_PAYMENT" },
                { label: "Fee Invoice", value: "FEE_INVOICE" },
                { label: "Carry Forward", value: "FEE_CARRY_FORWARD" },
                { label: "Gateway Log", value: "PAYMENT_GATEWAY_LOG" },
                { label: "Concession", value: "FEE_CONCESSION" },
              ],
            },
          ]}
          onSearchChange={setSearchQuery}
          className="flex-1"
        />

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => handleExport("xlsx")}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Audit Log DataTable */}
      <DataTable
        columns={columns}
        data={filteredLogs}
        emptyTitle="No audit logs recorded"
        emptyDescription="No matching audit logs recorded."
      />
    </div>
  );
}
