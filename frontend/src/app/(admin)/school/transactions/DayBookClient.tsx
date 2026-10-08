"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Printer,
  FileDown,
  Trash2,
  Calendar,
  IndianRupee,
  CreditCard,
  Building2,
  QrCode,
  Banknote,
  Search,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { FilterBar } from "@/components/finance/FilterBar";
import { DataTable, ColumnDef } from "@/components/finance/DataTable";
import { ConfirmDestructive } from "@/components/finance/ConfirmDestructive";
import { ReceiptSheet, ReceiptData } from "@/components/finance/ReceiptSheet";
import { cancelTransaction } from "./actions";
import { cn } from "@/lib/utils";

export interface TransactionRow {
  id: string;
  receiptNumber: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  feeHeadName: string;
  term: string;
  paymentMethod: string;
  transactionReference?: string | null | undefined;
  paymentDate: string;
  amountPaid: number;
  remarks?: string | null | undefined;
  collectedByName?: string | undefined;
  grossAmount?: number | undefined;
  balanceRemaining?: number | undefined;
}

export function DayBookClient({
  transactions,
  schoolName,
  userRole,
  activeMethod,
}: {
  transactions: TransactionRow[];
  schoolName: string;
  userRole: string;
  activeMethod?: string | undefined;
}) {
  const router = useRouter();

  // Search filter
  const [clientSearch, setClientSearch] = useState("");

  // Receipt Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Cancellation Modal State
  const [cancellationTarget, setCancellationTarget] = useState<TransactionRow | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const filteredTransactions = useMemo(() => {
    if (!clientSearch.trim()) return transactions;
    const q = clientSearch.toLowerCase();
    return transactions.filter(
      (tx) =>
        tx.receiptNumber.toLowerCase().includes(q) ||
        tx.studentName.toLowerCase().includes(q) ||
        tx.admissionNumber.toLowerCase().includes(q) ||
        tx.feeHeadName.toLowerCase().includes(q) ||
        (tx.transactionReference && tx.transactionReference.toLowerCase().includes(q))
    );
  }, [transactions, clientSearch]);

  const totalCollected = filteredTransactions.reduce((acc, tx) => acc + tx.amountPaid, 0);

  // Open Receipt Modal for reprint
  const handleReprintReceipt = (tx: TransactionRow) => {
    setReceiptData({
      schoolName,
      receiptNumber: tx.receiptNumber,
      date: new Date(tx.paymentDate).toLocaleString("en-IN"),
      student: {
        name: tx.studentName,
        admissionNumber: tx.admissionNumber,
        className: "Enrolled",
      },
      items: [
        {
          feeHeadName: tx.feeHeadName,
          invoiceNumber: tx.invoiceNumber,
          term: tx.term,
          grossAmount: tx.grossAmount || tx.amountPaid,
          amountPaid: tx.amountPaid,
          balanceRemaining: tx.balanceRemaining || 0,
        },
      ],
      totalAmountPaid: tx.amountPaid,
      paymentMethod: tx.paymentMethod,
      transactionReference: tx.transactionReference,
      remarks: tx.remarks,
      paymentId: tx.id,
      cashierName: tx.collectedByName,
    });
    setReceiptModalOpen(true);
  };

  // Perform transaction reversal
  const handleConfirmCancellation = async (reason: string) => {
    if (!cancellationTarget) return;
    setCancelling(true);
    const res = await cancelTransaction({
      paymentId: cancellationTarget.id,
      reason,
    });
    setCancelling(false);

    if (res.success) {
      toast.success(res.message);
      setCancellationTarget(null);
      router.refresh();
    } else {
      toast.error(res.message || "Failed to cancel transaction");
    }
  };

  // Excel Export
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Day Book Transactions");

      worksheet.columns = [
        { header: "Receipt No", key: "receiptNumber", width: 20 },
        { header: "Student Name", key: "studentName", width: 25 },
        { header: "Admission No", key: "admissionNumber", width: 15 },
        { header: "Fee Particulars", key: "feeHeadName", width: 22 },
        { header: "Payment Mode", key: "paymentMethod", width: 14 },
        { header: "Reference / UTR", key: "transactionReference", width: 20 },
        { header: "Date & Time", key: "paymentDate", width: 22 },
        { header: "Amount Paid (INR)", key: "amountPaid", width: 18 },
      ];

      filteredTransactions.forEach((tx) => {
        worksheet.addRow({
          receiptNumber: tx.receiptNumber,
          studentName: tx.studentName,
          admissionNumber: tx.admissionNumber,
          feeHeadName: tx.feeHeadName,
          paymentMethod: tx.paymentMethod,
          transactionReference: tx.transactionReference || "N/A",
          paymentDate: new Date(tx.paymentDate).toLocaleString("en-IN"),
          amountPaid: tx.amountPaid,
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DayBook_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Transactions exported to Excel successfully");
    } catch (err) {
      toast.error("Failed to export Excel file");
    }
  };

  const columns: ColumnDef<TransactionRow>[] = [
    {
      id: "receiptNumber",
      header: "Receipt Details",
      accessorKey: "receiptNumber",
      sortable: true,
      cell: (row) => (
        <div>
          <button
            type="button"
            onClick={() => handleReprintReceipt(row)}
            className="font-mono font-bold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 text-left transition"
          >
            {row.receiptNumber}
          </button>
          <p className="text-[11px] text-gray-400 font-mono">Inv: #{row.invoiceNumber}</p>
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
          <p className="font-bold text-gray-900 dark:text-white text-xs">{row.studentName}</p>
          <p className="text-[11px] text-gray-400 font-mono">Adm #{row.admissionNumber}</p>
        </div>
      ),
    },
    {
      id: "feeHead",
      header: "Fee Type",
      accessorKey: "feeHeadName",
      sortable: true,
      cell: (row) => (
        <div>
          <span className="font-medium text-xs">{row.feeHeadName}</span>
          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 font-mono">
            {row.term}
          </span>
        </div>
      ),
    },
    {
      id: "paymentMethod",
      header: "Mode & Reference",
      accessorKey: "paymentMethod",
      sortable: true,
      cell: (row) => (
        <div>
          <span
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold tracking-wide",
              row.paymentMethod === "CASH"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : row.paymentMethod === "UPI"
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400"
                : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
            )}
          >
            {row.paymentMethod}
          </span>
          {row.transactionReference && (
            <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate max-w-[140px]">
              {row.transactionReference}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "paymentDate",
      header: "Timestamp",
      accessorKey: "paymentDate",
      sortable: true,
      cell: (row) => (
        <div className="text-xs font-mono text-gray-600 dark:text-slate-300">
          <p>{new Date(row.paymentDate).toLocaleDateString("en-IN")}</p>
          <p className="text-[10px] text-gray-400">
            {new Date(row.paymentDate).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      ),
    },
    {
      id: "amountPaid",
      header: "Amount Paid",
      accessorKey: "amountPaid",
      sortable: true,
      cell: (row) => (
        <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 text-sm">
          ₹{row.amountPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
  ];

  const canCancel = userRole === "SUPER_ADMIN" || userRole === "SCHOOL_ADMIN";

  return (
    <div className="space-y-6">
      {/* Central Day Book Table Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Fee Collections Day Book ({filteredTransactions.length})
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Audited transaction receipts with instant thermal reprint and reversal guard.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* FilterBar with URL query sync and debounced search */}
        <FilterBar
          searchPlaceholder="Search receipt number, student name, admission no, or UTR..."
          onSearchChange={setClientSearch}
          filters={[
            {
              key: "method",
              label: "Payment Mode",
              options: [
                { label: "Cash Counter", value: "CASH" },
                { label: "UPI / QR Code", value: "UPI" },
                { label: "Cheque", value: "CHEQUE" },
                { label: "Demand Draft (DD)", value: "DD" },
                { label: "NEFT / RTGS", value: "NEFT" },
                { label: "Online Gateway", value: "ONLINE" },
              ],
            },
          ]}
        />

        {/* TanStack DataTable */}
        <DataTable
          data={filteredTransactions}
          columns={columns}
          selectable={false}
          searchKey=""
          onRowClick={(row) => handleReprintReceipt(row)}
          actions={(row) => (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => handleReprintReceipt(row)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition"
                title="Reprint 80mm Thermal Receipt"
              >
                <Printer className="w-4 h-4" />
              </button>

              <a
                href={`/api/receipt/${row.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition"
                title="Download PDF Receipt"
              >
                <FileDown className="w-4 h-4" />
              </a>

              {canCancel && (
                <button
                  type="button"
                  onClick={() => setCancellationTarget(row)}
                  className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  title="Audited Cancellation & Reversal"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          emptyState={{
            title: "No Transactions Found",
            description: "No fee payments recorded matching your search or mode filter.",
            actionLabel: "Clear Filter",
            actionHref: "/school/transactions",
          }}
        />
      </div>

      {/* Reprint Receipt Sheet Modal */}
      <ReceiptSheet
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        data={receiptData}
      />

      {/* Cancellation Guard AlertDialog */}
      <ConfirmDestructive
        isOpen={!!cancellationTarget}
        onClose={() => setCancellationTarget(null)}
        title={`Cancel Receipt #${cancellationTarget?.receiptNumber}?`}
        description={`This will reverse the payment of ₹${cancellationTarget?.amountPaid?.toLocaleString(
          "en-IN"
        )}, restore the outstanding balance onto Invoice #${
          cancellationTarget?.invoiceNumber
        }, post a reversal ledger entry, and record an immutable audit log.`}
        confirmLabel={cancelling ? "Reversing..." : "Confirm Cancellation"}
        requireReason={true}
        isPending={cancelling}
        reasonPlaceholder="Specify reason for cancelling this fee collection (e.g. Bounced cheque, Cashier data error)..."
        onConfirm={handleConfirmCancellation}
      />
    </div>
  );
}
