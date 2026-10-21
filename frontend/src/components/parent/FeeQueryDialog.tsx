"use client";

import React, { useState } from "react";
import {
  HelpCircle,
  X,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { FeeQueryCategory } from "@/app/(parent)/parent/actions/feeQueryActions";

export interface FeeQueryDialogProps {
  invoiceId: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  locale?: string;
  trigger?: React.ReactNode;
}

export function FeeQueryDialog({
  invoiceId,
  invoiceNumber,
  studentId,
  studentName,
  locale = "en",
  trigger,
}: FeeQueryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<FeeQueryCategory>("BREAKDOWN");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories: Array<{ id: FeeQueryCategory; labelEn: string; labelHi: string }> = [
    { id: "BREAKDOWN", labelEn: "Item Breakdown", labelHi: "मद विवरण" },
    { id: "LATE_FEE", labelEn: "Late Fee Inquiry", labelHi: "विलंब शुल्क" },
    { id: "WAIVER_REQUEST", labelEn: "Waiver / Concession", labelHi: "छूट अनुरोध" },
    { id: "DOUBLE_PAYMENT", labelEn: "Duplicate Payment", labelHi: "दोहरा भुगतान" },
    { id: "OTHER", labelEn: "Other Inquiry", labelHi: "अन्य प्रश्न" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error(
        locale === "hi"
          ? "कृपया अपने प्रश्न का विवरण दर्ज करें।"
          : "Please describe your question."
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const { createFeeQuery } = await import("@/app/(parent)/parent/actions/feeQueryActions");
      const res = await createFeeQuery({
        studentId,
        invoiceId,
        category,
        message: message.trim(),
      });

      if (res.success) {
        toast.success(
          locale === "hi"
            ? "शुल्क प्रश्न जमा किया गया। विद्यालय 2 दिनों में उत्तर देगा।"
            : "Fee query submitted. School typically responds within 2 days."
        );
        setMessage("");
        setIsOpen(false);
      } else {
        toast.error(res.error || "Failed to submit query.");
      }
    } catch {
      toast.error("Network error while submitting fee query.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {trigger ? (
        <div onClick={() => setIsOpen(true)}>{trigger}</div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          data-testid="question-this-fee-button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
          <span>{locale === "hi" ? "प्रश्न पूछें" : "Question this fee"}</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl relative text-left"
            data-testid="fee-query-dialog"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
                {locale === "hi" ? "शुल्क समाधान" : "Fee Inquiry"}
              </span>
              <h2 className="text-lg font-bold text-slate-100 mt-0.5">
                {locale === "hi"
                  ? `${invoiceNumber} पर प्रश्न पूछें`
                  : `Question ${invoiceNumber}`}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {locale === "hi"
                  ? `${studentName} के इस इनवॉइस के संबंध में लेखाकार को संदेश भेजें।`
                  : `Send a direct question to the accounts department regarding ${studentName}'s invoice.`}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Category picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  {locale === "hi" ? "प्रश्न की श्रेणी" : "Inquiry Category"}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      data-testid={`category-chip-${c.id}`}
                      className={`text-xs px-3 py-1.5 rounded-xl font-medium border transition-colors ${
                        category === c.id
                          ? "bg-indigo-600/30 text-indigo-200 border-indigo-500/60"
                          : "bg-slate-800/80 text-slate-400 border-slate-700/80 hover:text-slate-200"
                      }`}
                    >
                      {locale === "hi" ? c.labelHi : c.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message field */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {locale === "hi" ? "आपका संदेश / प्रश्न" : "Your Question Details"}
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    locale === "hi"
                      ? "उदा. क्या इस इनवॉइस में बस शुल्क शामिल है? या विलंब शुल्क का कारण क्या है?"
                      : "e.g. Could you explain the transport charges, or verify my recent bank transfer?"
                  }
                  data-testid="fee-query-message-input"
                  className="w-full rounded-xl bg-slate-800/90 border border-slate-700 p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              {/* SLA disclosure (Calm UX) */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-[11px] text-slate-400">
                <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>
                  {locale === "hi"
                    ? "लेखा कार्यालय आमतौर पर 2 कार्य दिवसों में उत्तर देता है। अनुत्तरित रहने पर 7 दिन बाद यह स्वतः प्रधानाचार्य को भेज दिया जाता है।"
                    : "School accounts typically answers within 2 business days. If unresolved, it auto-escalates to the Principal after 7 days."}
                </span>
              </div>

              {/* Footer */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {locale === "hi" ? "रद्द करें" : "Cancel"}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !message.trim()}
                  data-testid="fee-query-submit-button"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isSubmitting
                      ? locale === "hi"
                        ? "भेजा जा रहा है..."
                        : "Submitting..."
                      : locale === "hi"
                      ? "प्रश्न जमा करें"
                      : "Submit Question"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default FeeQueryDialog;
