"use client";

import React, { useState } from "react";
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Calendar,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import {
  StudentFeesData,
  StudentFeeInvoiceItem,
  FeeInvoiceStatus,
} from "@/app/(student)/student/fees/feesActions";
import { CheckoutButton } from "@/app/(parent)/portal/CheckoutButton";
import { EmptyStateCTA } from "@/components/ui/EmptyStateCTA";

const INVOICE_STATUS_CONFIG: Record<
  FeeInvoiceStatus,
  { label: string; color: string }
> = {
  PAID: {
    label: "Paid / चुकता",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  PARTIAL: {
    label: "Partial / आंशिक",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  PENDING: {
    label: "Pending / लंबित",
    color: "text-slate-400 bg-slate-800 border-slate-700",
  },
  OVERDUE: {
    label: "Overdue / देय तिथि समाप्त",
    color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  },
  WAIVED: {
    label: "Waived / माफ",
    color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  },
  CANCELLED: {
    label: "Cancelled / रद्द",
    color: "text-slate-500 bg-slate-900 border-slate-800",
  },
};

export function StudentFeesClient({ data }: { data: StudentFeesData }) {
  const [activeTab, setActiveTab] = useState<"invoices" | "payments">("invoices");

  return (
    <div className="space-y-6 pb-12">
      {/* Header Context Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Receipt className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Fees & Receipts
              </h1>
              <p className="text-xs text-slate-400">
                शुल्क चालान एवं भुगतान रसीदें • {data.student.className} - {data.student.sectionName}
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("invoices")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "invoices"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Invoices / चालान ({data.invoices.length})
            </button>
            <button
              onClick={() => setActiveTab("payments")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "payments"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Receipts / रसीदें ({data.payments.length})
            </button>
          </div>
        </div>

        {/* Financial Summary Strip */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-semibold text-slate-400">
              Total Billed / कुल देय
            </span>
            <div className="text-xl font-black text-slate-200 font-mono mt-0.5">
              ₹{data.totalBilled.toLocaleString("en-IN")}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-semibold text-emerald-400">
              Total Paid / भुगतान किया गया
            </span>
            <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
              ₹{data.totalPaid.toLocaleString("en-IN")}
            </div>
          </div>

          <div
            className={`border rounded-2xl p-4 ${
              data.totalOutstanding > 0
                ? "bg-rose-950/30 border-rose-500/30"
                : "bg-slate-950/60 border-slate-800"
            }`}
          >
            <span
              className={`text-[10px] uppercase font-semibold ${
                data.totalOutstanding > 0 ? "text-rose-300" : "text-slate-400"
              }`}
            >
              Balance Due / शेष बकाया
            </span>
            <div
              className={`text-xl font-black font-mono mt-0.5 ${
                data.totalOutstanding > 0 ? "text-rose-400" : "text-slate-200"
              }`}
            >
              ₹{data.totalOutstanding.toLocaleString("en-IN")}
            </div>
          </div>
        </div>
      </div>

      {activeTab === "invoices" ? (
        /* INVOICES LIST */
        <div className="space-y-4">
          {data.invoices.length === 0 ? (
            <EmptyStateCTA
              icon={Receipt}
              title="No Invoices Generated"
              hint="No fee invoices have been raised for this student record yet."
              className="border-slate-800 bg-slate-900/40"
            />
          ) : (
            <div className="space-y-3">
              {data.invoices.map((inv) => {
                const conf = INVOICE_STATUS_CONFIG[inv.status];
                const canPay =
                  inv.balanceAmount > 0 && inv.status !== "CANCELLED";

                return (
                  <div
                    key={inv.id}
                    className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 hover:border-slate-700 transition shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-white">
                            {inv.term}
                          </h3>
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            #{inv.invoiceNumber}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>Due Date: {inv.dueDate}</span>
                        </p>
                      </div>

                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full border ${conf.color}`}
                      >
                        {conf.label}
                      </span>
                    </div>

                    {/* Breakdown */}
                    <div className="bg-slate-950/60 rounded-2xl p-3 border border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">
                          Total
                        </div>
                        <div className="font-mono font-bold text-slate-200 mt-0.5">
                          ₹{inv.totalAmount.toLocaleString("en-IN")}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">
                          Paid
                        </div>
                        <div className="font-mono font-bold text-emerald-400 mt-0.5">
                          ₹{inv.paidAmount.toLocaleString("en-IN")}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">
                          Balance
                        </div>
                        <div
                          className={`font-mono font-bold mt-0.5 ${
                            inv.balanceAmount > 0
                              ? "text-rose-400"
                              : "text-slate-400"
                          }`}
                        >
                          ₹{inv.balanceAmount.toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>

                    {/* Pay Action using Razorpay CheckoutButton */}
                    {canPay && (
                      <div className="pt-1 flex items-center justify-end">
                        <CheckoutButton
                          invoiceId={inv.id}
                          amount={inv.balanceAmount}
                          studentName={data.student.studentName}
                          label={`Pay ₹${inv.balanceAmount.toLocaleString("en-IN")}`}
                          className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md shadow-rose-600/30 text-xs px-4 py-2 font-bold"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* PAYMENT RECEIPTS HISTORY */
        <div className="space-y-4">
          {data.payments.length === 0 ? (
            <EmptyStateCTA
              icon={CreditCard}
              title="No Payment Receipts"
              hint="No fee payments have been processed or confirmed for this account yet."
              className="border-slate-800 bg-slate-900/40"
            />
          ) : (
            <div className="space-y-2.5">
              {data.payments.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 flex items-center justify-between gap-4 hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          Receipt #{p.receiptNumber}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                          {p.paymentMode}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <span>{p.paymentDate}</span>
                        {p.transactionRef && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[11px] text-slate-500">
                              Ref: {p.transactionRef}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-emerald-400 font-mono">
                      ₹{p.amount.toLocaleString("en-IN")}
                    </div>
                    <span className="text-[10px] text-emerald-400/80 font-medium uppercase tracking-wider">
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
