"use client";

import React, { useState } from "react";
import {
  FileText,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  X,
  Search,
  Building,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/finance/DataTable";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { clearChallan, generateChallan } from "./actions";
import { cn } from "@/lib/utils";

export interface ChallanRow {
  id: string;
  challanNumber: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  feeHeadName: string;
  invoiceNumber: string;
  dueDate: string;
  amount: number;
  status: string;
  referenceNumber?: string | null | undefined;
}

export interface ChallansClientProps {
  challans: ChallanRow[];
  schoolName: string;
  unpaidInvoices: Array<{
    id: string;
    invoiceNumber: string;
    studentName: string;
    admissionNumber: string;
    balanceAmount: number;
  }>;
}

export function ChallansClient({ challans, schoolName, unpaidInvoices }: ChallansClientProps) {
  // Print Modal State
  const [printChallan, setPrintChallan] = useState<ChallanRow | null>(null);

  // Clear Modal State
  const [clearingChallan, setClearingChallan] = useState<ChallanRow | null>(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  // Generate Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [challanDueDate, setChallanDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleClearSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearingChallan) return;
    setIsClearing(true);

    const fd = new FormData();
    fd.append("challanId", clearingChallan.id);
    if (referenceNumber) fd.append("referenceNumber", referenceNumber);

    const res = await clearChallan(fd);
    setIsClearing(false);

    if (res.success) {
      toast.success(res.message);
      setClearingChallan(null);
      setReferenceNumber("");
    } else {
      toast.error(res.message || "Failed to clear challan.");
    }
  };

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId) {
      toast.error("Please select an invoice.");
      return;
    }
    setIsGenerating(true);

    const fd = new FormData();
    fd.append("invoiceId", selectedInvoiceId);
    fd.append("dueDate", challanDueDate);

    const res = await generateChallan(fd);
    setIsGenerating(false);

    if (res.success) {
      toast.success(res.message);
      setShowGenerateModal(false);
      setSelectedInvoiceId("");
    } else {
      toast.error(res.message || "Failed to generate challan.");
    }
  };

  const columns: ColumnDef<ChallanRow>[] = [
    {
      id: "challan",
      header: "Challan #",
      accessorKey: "challanNumber",
      sortable: true,
      cell: (row) => (
        <div>
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
            {row.challanNumber}
          </span>
          <p className="text-[11px] text-gray-400 font-mono">Inv #{row.invoiceNumber}</p>
        </div>
      ),
    },
    {
      id: "student",
      header: "Student",
      accessorKey: "studentName",
      sortable: true,
      cell: (row) => (
        <div>
          <p className="font-bold text-gray-900 dark:text-white">{row.studentName}</p>
          <p className="text-[11px] text-gray-400 font-mono">Adm #{row.admissionNumber}</p>
        </div>
      ),
    },
    {
      id: "feeHead",
      header: "Particulars",
      accessorKey: "feeHeadName",
      sortable: true,
      cell: (row) => <span className="font-medium text-xs">{row.feeHeadName}</span>,
    },
    {
      id: "dueDate",
      header: "Due Date",
      accessorKey: "dueDate",
      sortable: true,
      cell: (row) => (
        <span className="font-mono text-xs text-gray-600 dark:text-slate-300">
          {new Date(row.dueDate).toLocaleDateString("en-IN")}
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
      header: "Status",
      accessorKey: "status",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">
          Bank Challans Registry ({challans.length})
        </h3>
        <button
          type="button"
          onClick={() => setShowGenerateModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition active:scale-95"
        >
          <Plus className="w-4 h-4" /> Issue Bank Challan
        </button>
      </div>

      {/* Challans DataTable */}
      <DataTable
        columns={columns}
        data={challans}
        pageSize={25}
        actions={(row) => (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPrintChallan(row)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-xs font-semibold transition"
              title="Print 3-Part Bank Challan"
            >
              <Printer className="w-3.5 h-3.5" /> 3-Part
            </button>

            {row.status !== "CLEARED" && (
              <button
                type="button"
                onClick={() => setClearingChallan(row)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition active:scale-95"
              >
                <Check className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        )}
      />

      {/* 3-Part Print Modal */}
      {printChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="fixed inset-0 -z-10" onClick={() => setPrintChallan(null)} />

          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800 print:hidden">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                3-Part Bank Deposit Slip Preview
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition"
                >
                  Print Challan
                </button>
                <button
                  type="button"
                  onClick={() => setPrintChallan(null)}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 3-Part Layout: Student Copy | School Copy | Bank Copy */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              {(["STUDENT COPY", "SCHOOL COPY", "BANK COPY"] as const).map((copyName) => (
                <div
                  key={copyName}
                  className="p-4 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700 space-y-3 bg-gray-50/50 dark:bg-slate-800/20"
                >
                  <div className="text-center pb-2 border-b border-gray-200 dark:border-slate-700">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      {copyName}
                    </p>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                      {schoolName}
                    </h4>
                    <p className="text-[10px] text-gray-500 font-sans">Bank Fee Deposit Challan</p>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Challan #:</span>
                      <span className="font-bold">{printChallan.challanNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Invoice #:</span>
                      <span>{printChallan.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Student:</span>
                      <span className="font-bold">{printChallan.studentName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Adm #:</span>
                      <span>{printChallan.admissionNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Due Date:</span>
                      <span>{new Date(printChallan.dueDate).toLocaleDateString("en-IN")}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200 dark:border-slate-700 flex justify-between font-bold text-sm text-gray-900 dark:text-white">
                    <span>Payable:</span>
                    <span>₹{printChallan.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="pt-6 border-t border-gray-200 dark:border-slate-700 flex justify-between text-[10px] text-gray-400">
                    <span>Depositor Signature</span>
                    <span>Bank Seal</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Clear Challan Modal */}
      {clearingChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="fixed inset-0 -z-10" onClick={() => setClearingChallan(null)} />

          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Clear Bank Challan #{clearingChallan.challanNumber}
            </h3>
            <p className="text-xs text-gray-500">
              Clear deposit of ₹{clearingChallan.amount.toLocaleString("en-IN")} for {clearingChallan.studentName}. This will record a receipt and update bank balance.
            </p>

            <form onSubmit={handleClearSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Bank Scroll / UTR Reference # (Optional)
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. UTR92837482 or Branch Scroll #12"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClearingChallan(null)}
                  disabled={isClearing}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClearing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-50"
                >
                  {isClearing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Clearance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Challan Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="fixed inset-0 -z-10" onClick={() => setShowGenerateModal(false)} />

          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" />
              Issue New Bank Deposit Challan
            </h3>

            <form onSubmit={handleGenerateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Select Unpaid Invoice *
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Select Invoice...</option>
                  {unpaidInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      #{inv.invoiceNumber} - {inv.studentName} (Adm #{inv.admissionNumber}) — ₹{inv.balanceAmount}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Challan Valid Until (Due Date) *
                </label>
                <input
                  type="date"
                  value={challanDueDate}
                  onChange={(e) => setChallanDueDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  disabled={isGenerating}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50"
                >
                  {isGenerating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Generate Challan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
