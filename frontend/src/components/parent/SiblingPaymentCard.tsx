"use client";

import React, { useState } from "react";
import { Users2, CreditCard, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { CheckoutButton, type RazorpayPaymentSuccessData } from "@/app/(parent)/portal/CheckoutButton";
import { toast } from "sonner";

export interface SiblingFeeDetail {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  termName: string;
  balanceAmount: number;
  lateFeeAmount: number;
}

export interface SiblingPaymentCardProps {
  siblings: SiblingFeeDetail[];
  locale?: string;
  onSuccess?: () => void;
}

export function SiblingPaymentCard({
  siblings,
  locale = "en",
  onSuccess,
}: SiblingPaymentCardProps) {
  if (siblings.length < 2) return null;

  const totalBalance = siblings.reduce(
    (sum, s) => sum + s.balanceAmount + s.lateFeeAmount,
    0
  );

  const [paid, setPaid] = useState(false);

  const handleSuccess = (data: RazorpayPaymentSuccessData) => {
    setPaid(true);
    toast.success(
      locale === "hi"
        ? "दोनों बच्चों का शुल्क भुगतान सफलतापूर्वक पूरा हुआ!"
        : "Combined sibling payment successfully completed!",
      {
        description: `Receipt #${data.receiptNumber || "RECORDED"} is ready for each student invoice.`,
      }
    );
    onSuccess?.();
  };

  if (paid) {
    return (
      <div
        data-testid="sibling-payment-success-card"
        className="rounded-2xl bg-emerald-950/30 border border-emerald-800/60 p-4 sm:p-5 shadow-sm border-l-4 border-l-emerald-500"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              {locale === "hi" ? "संयुक्त भुगतान पूर्ण" : "Combined Sibling Payment Complete"}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              {locale === "hi"
                ? `सभी बच्चों का कुल ₹${totalBalance.toLocaleString("en-IN")} शुल्क चुकता हो गया है। रसीदें नीचे उपलब्ध हैं।`
                : `Total payment of ₹${totalBalance.toLocaleString("en-IN")} cleared across all siblings. Individual receipts generated.`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="sibling-combined-payment-card"
      className="rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-900/60 p-4 sm:p-5 shadow-sm space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
            <Users2 className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-indigo-400">
                {locale === "hi" ? "बहु-संतान सुविधा" : "Multi-Ward Family Feature"}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {siblings.length} {locale === "hi" ? "बच्चे" : "Siblings"}
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-100 mt-0.5">
              {locale === "hi"
                ? "सभी बच्चों का शुल्क एक साथ चुकाएं"
                : "Pay All Sibling Fees Together"}
            </h3>

            <p className="text-xs text-slate-400 mt-0.5">
              {locale === "hi"
                ? "एक ही भुगतान में दोनों बच्चों का शुल्क निपटाएं। प्रत्येक बच्चे के लिए अलग आधिकारिक रसीद बनेगी।"
                : "Consolidate sibling invoices into a single payment. Separate official receipts are issued per student."}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xs text-slate-400">
            {locale === "hi" ? "कुल देय राशि" : "Combined Total"}
          </div>
          <div className="text-lg sm:text-xl font-bold text-indigo-300">
            ₹{totalBalance.toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {/* Itemized sibling breakdown */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
        {siblings.map((s) => (
          <div key={s.invoiceId} className="p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center text-xs">
                {s.studentName.charAt(0)}
              </div>
              <div>
                <span className="font-semibold text-slate-200">{s.studentName}</span>
                <span className="text-[11px] text-slate-500 ml-1.5">
                  ({s.termName} • {s.invoiceNumber})
                </span>
              </div>
            </div>

            <div className="font-semibold text-slate-200">
              ₹{(s.balanceAmount + s.lateFeeAmount).toLocaleString("en-IN")}
            </div>
          </div>
        ))}
      </div>

      {/* Allocation policy transparency */}
      <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>
          {locale === "hi"
            ? "नियम: विलंब शुल्क पहले चुकता होता है, उसके बाद सबसे पुराना इनवॉइस पूर्णतः क्लियर होता है।"
            : "Rule: Allocates to late fees first, then oldest outstanding term invoice."}
        </span>
      </div>

      {/* 1-click combined checkout */}
      <div className="pt-2 border-t border-indigo-900/40 flex justify-end">
        <CheckoutButton
          invoiceId={siblings[0]?.invoiceId || ""}
          amount={totalBalance}
          studentName={`All Siblings (${siblings.map((s) => s.studentName).join(", ")})`}
          label={
            locale === "hi"
              ? `₹${totalBalance.toLocaleString("en-IN")} का संयुक्त भुगतान करें`
              : `Pay ₹${totalBalance.toLocaleString("en-IN")} for All Children`
          }
          onSuccess={handleSuccess}
        />
      </div>
    </div>
  );
}

export default SiblingPaymentCard;
