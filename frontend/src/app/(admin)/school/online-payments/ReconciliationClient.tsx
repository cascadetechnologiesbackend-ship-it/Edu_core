"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  ExternalLink,
  Loader2,
  Code2,
  X,
  CreditCard,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/finance/DataTable";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { reconcileOnlinePayment } from "./actions";
import { cn } from "@/lib/utils";

export interface GatewayLogRow {
  id: string;
  gateway: string;
  gatewayOrderId?: string | null | undefined;
  gatewayPaymentId?: string | null | undefined;
  invoiceNumber?: string | null | undefined;
  amount: number;
  status: string;
  isReconciled: boolean;
  webhookPayload?: string | null | undefined;
  createdAt: string;
}

export interface ReconciliationClientProps {
  logs: GatewayLogRow[];
  userRole: string;
}

export function ReconciliationClient({ logs, userRole }: ReconciliationClientProps) {
  const router = useRouter();

  // Active Tab: "QUEUE" | "ALL" | "DISCREPANCY"
  const [activeTab, setActiveTab] = useState<"QUEUE" | "ALL" | "DISCREPANCY">("QUEUE");

  // Selected Log for JSON Webhook Inspector Modal
  const [inspectLog, setInspectLog] = useState<GatewayLogRow | null>(null);

  // Settle loading state
  const [settlingId, setSettlingId] = useState<string | null>(null);

  // Search filter
  const [search, setSearch] = useState("");

  const filteredLogs = useMemo(() => {
    let list = logs;
    if (activeTab === "QUEUE") {
      list = list.filter((l) => l.status === "PAID" && !l.isReconciled);
    } else if (activeTab === "DISCREPANCY") {
      list = list.filter((l) => l.status === "FAILED" || (l.status === "ATTEMPTED"));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.gateway.toLowerCase().includes(q) ||
          (l.gatewayOrderId && l.gatewayOrderId.toLowerCase().includes(q)) ||
          (l.gatewayPaymentId && l.gatewayPaymentId.toLowerCase().includes(q)) ||
          (l.invoiceNumber && l.invoiceNumber.toLowerCase().includes(q))
      );
    }

    return list;
  }, [logs, activeTab, search]);

  const handleSettle = async (logId: string) => {
    try {
      setSettlingId(logId);
      const res = await reconcileOnlinePayment(logId);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message || "Failed to settle payment.");
      }
    } catch (err: any) {
      toast.error(err.message || "Settlement failed.");
    } finally {
      setSettlingId(null);
    }
  };

  const columns: ColumnDef<GatewayLogRow>[] = [
    {
      id: "gateway",
      header: "Gateway & Order",
      accessorKey: "gateway",
      sortable: true,
      cell: (row) => (
        <div>
          <span className="font-bold text-indigo-600 dark:text-indigo-400">{row.gateway}</span>
          <p className="text-[11px] text-gray-400 font-mono">Order: {row.gatewayOrderId || "N/A"}</p>
        </div>
      ),
    },
    {
      id: "paymentId",
      header: "Payment ID",
      accessorKey: "gatewayPaymentId",
      sortable: true,
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-gray-800 dark:text-slate-200">
          {row.gatewayPaymentId || "—"}
        </span>
      ),
    },
    {
      id: "invoice",
      header: "Linked Invoice",
      accessorKey: "invoiceNumber",
      sortable: true,
      cell: (row) => (
        <span className="font-mono text-xs text-gray-600 dark:text-slate-300">
          {row.invoiceNumber ? `#${row.invoiceNumber}` : "Unlinked"}
        </span>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      accessorKey: "amount",
      sortable: true,
      cell: (row) => (
        <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
          ₹{row.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      id: "status",
      header: "Gateway Status",
      accessorKey: "status",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "reconciled",
      header: "Ledger State",
      cell: (row) =>
        row.isReconciled ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
            <CheckCircle2 className="w-3 h-3" /> Reconciled
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
            <Clock className="w-3 h-3" /> Unsettled
          </span>
        ),
    },
    {
      id: "timestamp",
      header: "Timestamp",
      accessorKey: "createdAt",
      sortable: true,
      cell: (row) => (
        <span className="text-xs text-gray-500 font-mono">
          {new Date(row.createdAt).toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation & Search Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("QUEUE")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition",
              activeTab === "QUEUE"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200"
            )}
          >
            Needs Settlement ({logs.filter((l) => l.status === "PAID" && !l.isReconciled).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition",
              activeTab === "ALL"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200"
            )}
          >
            All Logs ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("DISCREPANCY")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition",
              activeTab === "DISCREPANCY"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200"
            )}
          >
            Failed / Discrepancies
          </button>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order ID, payment ID..."
            className="w-full px-3.5 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Reconciliation DataTable */}
      <DataTable
        columns={columns}
        data={filteredLogs}
        pageSize={25}
        actions={(row) => (
          <div className="flex items-center justify-end gap-2">
            {row.webhookPayload && (
              <button
                type="button"
                onClick={() => setInspectLog(row)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                title="Inspect Webhook Payload"
              >
                <Code2 className="w-4 h-4" />
              </button>
            )}

            {row.status === "PAID" && !row.isReconciled && (
              <button
                type="button"
                onClick={() => handleSettle(row.id)}
                disabled={settlingId === row.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                {settlingId === row.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Settle to Ledger
              </button>
            )}
          </div>
        )}
        emptyTitle="No Gateway Records Found"
        emptyDescription="All transactions in this view are cleared and reconciled."
      />

      {/* Webhook Payload Inspector Modal */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="fixed inset-0 -z-10"
            onClick={() => setInspectLog(null)}
          />

          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Webhook Payload Inspector: #{inspectLog.gatewayPaymentId || inspectLog.gatewayOrderId}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 bg-gray-950 rounded-2xl p-4 overflow-x-auto max-h-96">
              <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(inspectLog.webhookPayload || "{}"), null, 2);
                  } catch (e) {
                    return inspectLog.webhookPayload || "No payload stored.";
                  }
                })()}
              </pre>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
