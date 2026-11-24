"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Plus,
  IndianRupee,
  Building2,
  AlertTriangle,
  Receipt,
  User,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/finance/DataTable";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { ConfirmDestructive } from "@/components/finance/ConfirmDestructive";
import { MoneyKpi } from "@/components/finance/MoneyKpi";
import { cn } from "@/lib/utils";
import {
  requestFeeRefund,
  approveFeeRefund,
  rejectFeeRefund,
  processFeeRefund,
  searchPaidPaymentsForRefundAction,
} from "./actions";

export interface RefundRow {
  id: string;
  receiptNumber: string;
  invoiceNumber: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  refundAmount: number;
  originalAmountPaid: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "PROCESSED" | "REJECTED";
  approvedByName?: string | undefined;
  approvedAt?: string | undefined;
  processedAt?: string | undefined;
  createdAt: string;
}

export interface BankAccountOption {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  currentBalance: string;
}

export function RefundsClient({
  refunds,
  bankAccounts,
  userRole,
}: {
  refunds: RefundRow[];
  bankAccounts: BankAccountOption[];
  userRole: string;
}) {
  const router = useRouter();
  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(userRole);

  // Filter state
  const [activeStatus, setActiveStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Request Modal State
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [searchReceiptQuery, setSearchReceiptQuery] = useState("");
  const [searchingReceipts, setSearchingReceipts] = useState(false);
  const [paymentSearchResults, setPaymentSearchResults] = useState<any[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [requestRefundAmount, setRequestRefundAmount] = useState<number>(0);
  const [requestReason, setRequestReason] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Reject Modal State
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  // Process Modal State
  const [processTarget, setProcessTarget] = useState<RefundRow | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string>(bankAccounts[0]?.id || "");
  const [processing, setProcessing] = useState(false);

  // Action Loading states
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Filtered Refunds
  const filteredRefunds = useMemo(() => {
    return refunds.filter((r) => {
      const matchesStatus = activeStatus === "ALL" || r.status === activeStatus;
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        r.receiptNumber.toLowerCase().includes(q) ||
        r.studentName.toLowerCase().includes(q) ||
        r.admissionNumber.toLowerCase().includes(q) ||
        r.invoiceNumber.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [refunds, activeStatus, searchTerm]);

  // Aggregate Metrics
  const totalProcessed = useMemo(
    () => refunds.filter((r) => r.status === "PROCESSED").reduce((acc, r) => acc + r.refundAmount, 0),
    [refunds]
  );
  const pendingCount = useMemo(() => refunds.filter((r) => r.status === "PENDING").length, [refunds]);
  const pendingAmount = useMemo(
    () => refunds.filter((r) => r.status === "PENDING").reduce((acc, r) => acc + r.refundAmount, 0),
    [refunds]
  );
  const approvedCount = useMemo(() => refunds.filter((r) => r.status === "APPROVED").length, [refunds]);
  const approvedAmount = useMemo(
    () => refunds.filter((r) => r.status === "APPROVED").reduce((acc, r) => acc + r.refundAmount, 0),
    [refunds]
  );

  // Search receipts handler
  const handleSearchReceipts = async (query: string) => {
    setSearchReceiptQuery(query);
    setSearchingReceipts(true);
    try {
      const res = await searchPaidPaymentsForRefundAction(query);
      if (res.success && res.results) {
        setPaymentSearchResults(res.results);
      }
    } catch {
      toast.error("Failed to search payments");
    } finally {
      setSearchingReceipts(false);
    }
  };

  // Open Request Modal
  const openNewRequestModal = () => {
    setRequestModalOpen(true);
    setSelectedPayment(null);
    setRequestRefundAmount(0);
    setRequestReason("");
    setSearchReceiptQuery("");
    handleSearchReceipts("");
  };

  // Submit Request
  const handleSubmitRequest = async () => {
    if (!selectedPayment) {
      toast.error("Please select a fee payment receipt to refund");
      return;
    }
    if (requestRefundAmount <= 0) {
      toast.error("Refund amount must be greater than zero");
      return;
    }
    if (requestRefundAmount > selectedPayment.maxRefundable) {
      toast.error(`Refund amount cannot exceed ₹${selectedPayment.maxRefundable.toLocaleString("en-IN")}`);
      return;
    }
    if (!requestReason.trim() || requestReason.trim().length < 5) {
      toast.error("Please specify a reason with at least 5 characters");
      return;
    }

    setSubmittingRequest(true);
    try {
      const res = await requestFeeRefund({
        feePaymentId: selectedPayment.paymentId,
        refundAmount: requestRefundAmount,
        reason: requestReason.trim(),
      });
      if (res.success) {
        toast.success(res.message);
        setRequestModalOpen(false);
        router.refresh();
      } else {
        toast.error(res.message || "Failed to submit refund request");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Handle Approve
  const handleApprove = async (refundId: string) => {
    setApprovingId(refundId);
    try {
      const res = await approveFeeRefund(refundId);
      if (res.success) {
        toast.success("Refund request approved!");
        router.refresh();
      } else {
        toast.error(res.message || "Approval failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Error during approval");
    } finally {
      setApprovingId(null);
    }
  };

  // Handle Reject
  const handleRejectConfirm = async (reason: string) => {
    if (!rejectTargetId) return;
    setRejecting(true);
    try {
      const res = await rejectFeeRefund(rejectTargetId, reason);
      if (res.success) {
        toast.success("Refund request rejected and logged to audit.");
        setRejectTargetId(null);
        router.refresh();
      } else {
        toast.error(res.message || "Failed to reject refund");
      }
    } catch (err: any) {
      toast.error(err.message || "Rejection error");
    } finally {
      setRejecting(false);
    }
  };

  // Handle Process Payout
  const handleProcessSubmit = async () => {
    if (!processTarget) return;
    setProcessing(true);
    try {
      const res = await processFeeRefund(processTarget.id, selectedBankId);
      if (res.success) {
        toast.success(res.message);
        setProcessTarget(null);
        router.refresh();
      } else {
        toast.error(res.message || "Failed to process refund");
      }
    } catch (err: any) {
      toast.error(err.message || "Processing error");
    } finally {
      setProcessing(false);
    }
  };

  // Table Column Definitions
  const columns: ColumnDef<RefundRow>[] = [
    {
      id: "reference",
      header: "Refund ID / Date",
      cell: (row) => (
        <div className="space-y-0.5">
          <span className="font-mono text-xs font-bold text-foreground">
            {row.id.slice(0, 8).toUpperCase()}
          </span>
          <p className="text-[11px] text-gray-500">
            {new Date(row.createdAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
      ),
    },
    {
      id: "receipt",
      header: "Linked Receipt",
      cell: (row) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-mono text-xs font-semibold text-[#248A3D] dark:text-[#30D158]">
              #{row.receiptNumber}
            </span>
          </div>
          <p className="text-[11px] text-gray-500">Inv: {row.invoiceNumber}</p>
        </div>
      ),
    },
    {
      id: "student",
      header: "Student & Class",
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-foreground">
            {row.studentName}
          </p>
          <p className="text-[11px] text-gray-500">
            Adm: {row.admissionNumber} • {row.className}
          </p>
        </div>
      ),
    },
    {
      id: "amount",
      header: "Refund Amount",
      cell: (row) => (
        <div className="space-y-0.5">
          <span className="font-mono text-sm font-bold text-rose-600 dark:text-rose-400">
            ₹{row.refundAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
          <p className="text-[10px] text-gray-400">
            Orig: ₹{row.originalAmountPaid.toLocaleString("en-IN")}
          </p>
        </div>
      ),
    },
    {
      id: "reason",
      header: "Reason & Notes",
      cell: (row) => (
        <div className="max-w-xs">
          <p className="text-xs text-foreground truncate" title={row.reason}>
            {row.reason}
          </p>
          {row.approvedByName && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              Approved by: {row.approvedByName}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => {
        if (row.status === "PENDING" && isAdmin) {
          return (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleApprove(row.id)}
                disabled={approvingId === row.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition border border-emerald-200 dark:border-emerald-800"
              >
                {approvingId === row.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                Approve
              </button>
              <button
                type="button"
                onClick={() => setRejectTargetId(row.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition border border-rose-200 dark:border-rose-800"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>
          );
        }

        if (row.status === "APPROVED" && isAdmin) {
          return (
            <button
              type="button"
              onClick={() => {
                setProcessTarget(row);
                setSelectedBankId(bankAccounts[0]?.id || "");
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#248A3D] dark:bg-[#30D158] text-white dark:text-black hover:opacity-90 transition shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Process Payout
            </button>
          );
        }

        if (row.status === "PROCESSED") {
          return (
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Reversed & Paid
            </span>
          );
        }

        return <span className="text-xs text-gray-400">—</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MoneyKpi
          title="Total Disbursed Refunds"
          amount={`₹${totalProcessed.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          variant="rose"
          subtitle="Processed & debited to general ledger"
        />
        <MoneyKpi
          title="Pending Approval Requests"
          amount={`₹${pendingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          variant="amber"
          subtitle={`${pendingCount} request${pendingCount === 1 ? "" : "s"} awaiting review`}
        />
        <MoneyKpi
          title="Approved Payouts Pending"
          amount={`₹${approvedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          variant="primary"
          subtitle={`${approvedCount} approved, awaiting disbursement`}
        />
      </div>

      {/* Action Bar & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-4 rounded-2xl border border-border/40 shadow-sm">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {["ALL", "PENDING", "APPROVED", "PROCESSED", "REJECTED"].map((st) => (
            <button
              key={st}
              onClick={() => setActiveStatus(st)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                activeStatus === st
                  ? "bg-[#248A3D] dark:bg-[#30D158] text-white dark:text-black shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-gray-200"
              )}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Right Search & New Request CTA */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search receipt, student, reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-border/40 bg-muted/30 text-foreground outline-none focus:border-[#248A3D] dark:focus:border-[#30D158]"
            />
          </div>

          <button
            type="button"
            onClick={openNewRequestModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#248A3D] hover:bg-[#1f7232] dark:bg-[#30D158] dark:hover:bg-[#28b84d] text-white dark:text-black shadow-sm transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            New Refund Request
          </button>
        </div>
      </div>

      {/* Refunds DataTable */}
      <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden p-4">
        <DataTable
          columns={columns}
          data={filteredRefunds}
          pageSize={15}
          emptyTitle="No Fee Refunds Found"
          emptyDescription="There are no fee refund records matching your current filter criteria."
        />
      </div>

      {/* New Refund Request Modal */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="fixed inset-0 -z-10" onClick={() => !submittingRequest && setRequestModalOpen(false)} />
          <div className="w-full max-w-2xl bg-card border border-border/40 rounded-3xl shadow-2xl overflow-hidden p-6 animate-in zoom-in-95 duration-150 space-y-5">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-[#248A3D] dark:text-[#30D158]" />
                  Initiate Fee Refund Request
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Search paid receipt, select invoice line item, and submit for admin approval.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRequestModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-muted-foreground text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {/* Step 1: Select Payment */}
            {!selectedPayment ? (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-foreground uppercase">
                  1. Search Paid Receipt (by Receipt #, Student Name, or Admission #)
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchReceiptQuery}
                    onChange={(e) => handleSearchReceipts(e.target.value)}
                    placeholder="Type receipt #, student name, or admission #..."
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border/40 bg-muted/30 text-foreground outline-none focus:border-[#248A3D] dark:focus:border-[#30D158]"
                    autoFocus
                  />
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pt-1">
                  {searchingReceipts ? (
                    <div className="py-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#248A3D] dark:text-[#30D158]" />
                      Searching paid receipts...
                    </div>
                  ) : paymentSearchResults.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400">
                      No eligible paid receipts found for refund.
                    </div>
                  ) : (
                    paymentSearchResults.map((p) => (
                      <div
                        key={p.paymentId}
                        onClick={() => {
                          setSelectedPayment(p);
                          setRequestRefundAmount(p.maxRefundable);
                        }}
                        className="p-3 rounded-xl border border-border/40 hover:border-[#248A3D]/50 bg-card/50 hover:bg-muted/40 cursor-pointer transition flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#248A3D] dark:text-[#30D158]">
                              #{p.receiptNumber}
                            </span>
                            <span className="text-xs font-medium text-foreground">
                              {p.studentName} ({p.className})
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500">
                            Inv: {p.invoiceNumber} • Head: {p.feeHeadName} • Paid: ₹{p.amountPaid} via {p.paymentMethod}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{p.maxRefundable.toLocaleString("en-IN")}
                          </span>
                          <p className="text-[10px] text-gray-400">Max Refundable</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected Payment Summary */}
                <div className="p-3.5 rounded-2xl bg-[#248A3D]/10 dark:bg-[#30D158]/10 border border-[#248A3D]/20 dark:border-[#30D158]/20 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-[#248A3D] dark:text-[#30D158] uppercase tracking-wider">
                      Selected Receipt
                    </span>
                    <h4 className="text-sm font-bold text-foreground">
                      #{selectedPayment.receiptNumber} • {selectedPayment.studentName}
                    </h4>
                    <p className="text-xs text-gray-500">
                      Adm: {selectedPayment.admissionNumber} • {selectedPayment.className} • Inv: {selectedPayment.invoiceNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedPayment(null)}
                      className="text-xs font-semibold text-[#248A3D] dark:text-[#30D158] hover:underline"
                    >
                      Change
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                      Max: ₹{selectedPayment.maxRefundable.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                {/* Refund Amount Input */}
                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase mb-1">
                    Refund Amount (₹) *
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max={selectedPayment.maxRefundable}
                      value={requestRefundAmount || ""}
                      onChange={(e) => setRequestRefundAmount(parseFloat(e.target.value) || 0)}
                      className="w-full pl-9 pr-3 py-2 text-sm font-mono font-bold rounded-xl border border-border/40 bg-muted/30 text-foreground outline-none focus:border-[#248A3D] dark:focus:border-[#30D158]"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Cannot exceed ₹{selectedPayment.maxRefundable.toLocaleString("en-IN")} (original payment minus previous refunds).
                  </p>
                </div>

                {/* Reason Input */}
                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase mb-1">
                    Reason for Refund * (Minimum 5 characters)
                  </label>
                  <textarea
                    rows={3}
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    placeholder="e.g. Accidental double payment via counter, student transferred, fee concession retroactively applied..."
                    className="w-full p-3 text-sm rounded-xl border border-border/40 bg-muted/30 text-foreground outline-none focus:border-[#248A3D] dark:focus:border-[#30D158]"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => setRequestModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted/60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitRequest}
                    disabled={submittingRequest}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#248A3D] hover:bg-[#1f7232] dark:bg-[#30D158] dark:hover:bg-[#28b84d] text-white dark:text-black shadow-sm disabled:opacity-50"
                  >
                    {submittingRequest && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Submit for Approval
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Destructive Dialog */}
      <ConfirmDestructive
        isOpen={!!rejectTargetId}
        onClose={() => setRejectTargetId(null)}
        title="Reject Fee Refund Request"
        description="Are you sure you want to reject this fee refund? This action will mark the request as REJECTED and record the reason in the immutable audit log."
        confirmLabel="Reject Refund"
        requireReason={true}
        reasonPlaceholder="Specify reason for rejection (required for compliance)..."
        isPending={rejecting}
        onConfirm={handleRejectConfirm}
      />

      {/* Process Payout Modal */}
      {processTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="fixed inset-0 -z-10" onClick={() => !processing && setProcessTarget(null)} />
          <div className="w-full max-w-lg bg-card border border-border/40 rounded-3xl shadow-2xl overflow-hidden p-6 animate-in zoom-in-95 duration-150 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#248A3D]/10 text-[#248A3D] dark:text-[#30D158] flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Process Payout & Reverse Ledger
                </h3>
                <p className="text-xs text-muted-foreground">
                  Receipt #{processTarget.receiptNumber} • ₹{processTarget.refundAmount.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 space-y-1.5 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Ledger & Invoice Impact Warning
              </div>
              <p>
                Processing this payout will immediately debit the school bank account, post a reversal DEBIT entry to the general ledger, and restore <strong>₹{processTarget.refundAmount.toLocaleString("en-IN")}</strong> to the student&apos;s invoice balance.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-foreground uppercase">
                Select Disbursing Bank Vault
              </label>
              <select
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-border/40 bg-muted/30 text-foreground outline-none focus:border-[#248A3D] dark:focus:border-[#30D158]"
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - {b.accountName} (Bal: ₹{parseFloat(b.currentBalance).toLocaleString("en-IN")})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
              <button
                type="button"
                onClick={() => setProcessTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted/60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessSubmit}
                disabled={processing}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#248A3D] hover:bg-[#1f7232] dark:bg-[#30D158] dark:hover:bg-[#28b84d] text-white dark:text-black shadow-sm disabled:opacity-50"
              >
                {processing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm & Disburse Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
