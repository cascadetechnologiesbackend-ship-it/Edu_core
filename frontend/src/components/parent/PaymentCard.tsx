"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  CheckCircle2,
  Download,
  ArrowRight,
  Clock,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CheckoutButton, type RazorpayPaymentSuccessData } from "@/app/(parent)/portal/CheckoutButton";
import type { DerivedFeedCard } from "@/lib/parentEventEngine/types";

export interface PaymentCardProps {
  card: DerivedFeedCard;
  studentName?: string | undefined;
  onPaymentSuccess?: ((data: RazorpayPaymentSuccessData) => void) | undefined;
  className?: string | undefined;
}

export function PaymentCard({
  card,
  studentName = "Child",
  onPaymentSuccess,
  className,
}: PaymentCardProps) {
  const [successData, setSuccessData] = useState<RazorpayPaymentSuccessData | null>(null);

  const payload = card.payload || {};
  const invoiceId = payload.invoiceId || card.id;
  const balanceAmount = Number(payload.balanceAmount || 0);
  const lateFeeAmount = Number(payload.lateFeeAmount || 0);
  const termName = payload.termName || "School Term";
  const dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
  const isOverdue = payload.status === "OVERDUE" || (dueDate && dueDate < new Date());

  const handleSuccess = (data: RazorpayPaymentSuccessData) => {
    setSuccessData(data);
    toast.success("Fee payment confirmed!", {
      description: `Receipt #${data.receiptNumber || "Generated"} is ready for download.`,
    });
    onPaymentSuccess?.(data);
  };

  // ─── POST-PAYMENT SUCCESS STATE (PaymentSuccessCard) ─────────────────────────
  if (successData || payload.lastPaymentStatus === "PAID") {
    const receiptNum = successData?.receiptNumber || payload.receiptNumber || "CONFIRMED";
    const receiptDownloadHref = successData?.paymentId
      ? `/api/receipt/${successData.paymentId}`
      : `/parent/fees`;

    return (
      <div
        data-card-id={card.id}
        data-card-type="PaymentSuccessCard"
        className={cn(
          "rounded-2xl bg-emerald-950/30 border border-emerald-800/60 p-4 sm:p-5 shadow-sm border-l-4 border-l-emerald-500",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight">
                {termName} Fee Paid
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Payment of ₹{balanceAmount.toLocaleString("en-IN")} confirmed for {studentName}.
              </p>
              <div className="text-[11px] font-mono text-emerald-400 mt-1">
                Receipt: {receiptNum}
              </div>
            </div>
          </div>

          <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Paid
          </span>
        </div>

        {/* Micro-progress indicator: 100% completed */}
        <div className="mt-3.5 pt-3 border-t border-emerald-900/40">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
            <span className="text-slate-300">Status</span>
            <span className="font-semibold text-emerald-400">Receipt Ready</span>
          </div>
          <div className="flex items-center gap-1 w-full">
            {["Initiating", "Processing", "Paid", "Receipt Ready"].map((step) => (
              <div key={step} className="h-1.5 flex-1 rounded-full bg-emerald-500" />
            ))}
          </div>
        </div>

        {/* Post-payment NextBestAction */}
        <div className="mt-4 pt-3 border-t border-emerald-900/40 flex items-center justify-between gap-3">
          <Link
            href="/parent/dashboard"
            className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Back to today
          </Link>

          <a
            href={receiptDownloadHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download receipt</span>
          </a>
        </div>
      </div>
    );
  }

  // ─── PROACTIVE DUE / OVERDUE STATE (PaymentCard) ───────────────────────────
  const countdownText = isOverdue
    ? "Overdue - late fee added"
    : payload.daysUntilDue !== undefined
    ? `Due in ${payload.daysUntilDue} ${payload.daysUntilDue === 1 ? "day" : "days"}`
    : "Due soon";

  const severityBorder = isOverdue ? "border-l-4 border-l-rose-500" : "border-l-4 border-l-amber-500";

  return (
    <div
      data-card-id={card.id}
      data-card-type="PaymentCard"
      data-card-tier="T1_action_required"
      className={cn(
        "rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 shadow-sm transition-all hover:border-slate-700/80",
        severityBorder,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5 text-indigo-400">
            <CreditCard className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight">
              {termName} Fee
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              Balance of ₹{balanceAmount.toLocaleString("en-IN")} pending for {studentName}.
              {lateFeeAmount > 0 && ` Includes ₹${lateFeeAmount.toLocaleString("en-IN")} late fee.`}
            </p>
          </div>
        </div>

        <span
          className={cn(
            "text-[10px] font-semibold px-2.5 py-0.5 rounded-full border tracking-wide shrink-0",
            isOverdue
              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
              : "bg-amber-500/20 text-amber-300 border-amber-500/30"
          )}
        >
          {countdownText}
        </span>
      </div>

      {/* Micro-progress indicator: "Due" phase */}
      <div className="mt-3.5 pt-3 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
          <span className="text-slate-300">Payment Status</span>
          <span className={cn("font-semibold", isOverdue ? "text-rose-400" : "text-amber-400")}>
            {isOverdue ? "Overdue" : "Action Required"}
          </span>
        </div>
        <div className="flex items-center gap-1 w-full">
          <div className={cn("h-1.5 flex-1 rounded-full", isOverdue ? "bg-rose-500" : "bg-amber-500")} />
          <div className="h-1.5 flex-1 rounded-full bg-slate-800" />
          <div className="h-1.5 flex-1 rounded-full bg-slate-800" />
          <div className="h-1.5 flex-1 rounded-full bg-slate-800" />
        </div>
      </div>

      {/* Actions footer: 1-click Pay Now via Razorpay + View Breakdown secondary */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
        <Link
          href={`/parent/fees?invoiceId=${invoiceId}`}
          className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          View breakdown
        </Link>

        <CheckoutButton
          invoiceId={invoiceId}
          amount={balanceAmount}
          studentName={studentName}
          label={`Pay ₹${balanceAmount.toLocaleString("en-IN")}`}
          onSuccess={handleSuccess}
        />
      </div>
    </div>
  );
}

export default PaymentCard;
