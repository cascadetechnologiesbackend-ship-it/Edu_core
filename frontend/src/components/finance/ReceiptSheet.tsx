"use client";

import React, { useEffect, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Printer, Download, UserPlus, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReceiptItem {
  feeHeadName: string;
  invoiceNumber: string;
  term: string;
  grossAmount: number;
  discountAmount?: number | undefined;
  lateFeeAmount?: number | undefined;
  amountPaid: number;
  balanceRemaining: number;
}

export interface ReceiptData {
  schoolName: string;
  schoolAddress?: string | undefined;
  schoolPhone?: string | undefined;
  receiptNumber: string;
  date: string;
  cashierName?: string | undefined;
  student: {
    name: string;
    admissionNumber: string;
    className: string;
    fatherName?: string | undefined;
  };
  items: ReceiptItem[];
  totalAmountPaid: number;
  paymentMethod: string;
  bankName?: string | undefined;
  transactionReference?: string | null | undefined;
  remarks?: string | null | undefined;
  paymentId: string;
}

export interface ReceiptSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceiptData | null;
  onCollectNext?: () => void;
}

export function ReceiptSheet({
  open,
  onOpenChange,
  data,
  onCollectNext,
}: ReceiptSheetProps) {
  const printButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      // Focus print button on mount for rapid keyboard handling
      setTimeout(() => printButtonRef.current?.focus(), 100);
    }
  }, [open]);

  if (!data) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCollectNext = () => {
    onOpenChange(false);
    if (onCollectNext) onCollectNext();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-gray-200 dark:border-slate-800 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200"
          )}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </span>
              <div>
                <DialogPrimitive.Title className="text-sm font-bold text-gray-900 dark:text-white">
                  Payment Successful
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-gray-500 dark:text-slate-400 font-mono">
                  Receipt #{data.receiptNumber}
                </DialogPrimitive.Description>
              </div>
            </div>
            <DialogPrimitive.Close className="rounded-xl p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition">
              <X className="w-4 h-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* Thermal Receipt Body (Printed Area) */}
          <div
            id="thermal-receipt"
            className="my-4 p-4 rounded-2xl bg-gray-50 dark:bg-slate-950 border border-dashed border-gray-200 dark:border-slate-800 font-mono text-xs text-gray-800 dark:text-slate-200 space-y-3 print:bg-white print:text-black print:border-none print:p-0"
          >
            {/* School Branding */}
            <div className="text-center pb-2 border-b border-gray-200 dark:border-slate-800 print:border-black">
              <h3 className="font-bold text-sm tracking-wide uppercase text-gray-900 dark:text-white print:text-black">
                {data.schoolName}
              </h3>
              {data.schoolAddress && (
                <p className="text-[10px] text-gray-500 dark:text-slate-400 print:text-black">
                  {data.schoolAddress}
                </p>
              )}
              <p className="text-[11px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 mt-1 uppercase print:text-black">
                Official Fee Payment Receipt
              </p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
              <div>
                <span className="text-gray-400">Receipt No: </span>
                <span className="font-bold">{data.receiptNumber}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-400">Date: </span>
                <span>{data.date}</span>
              </div>
              <div>
                <span className="text-gray-400">Student: </span>
                <span className="font-semibold">{data.student.name}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-400">Adm No: </span>
                <span className="font-bold">#{data.student.admissionNumber}</span>
              </div>
              <div>
                <span className="text-gray-400">Class: </span>
                <span>{data.student.className}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-400">Mode: </span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 print:text-black">
                  {data.paymentMethod}
                </span>
              </div>
              {data.transactionReference && (
                <div className="col-span-2">
                  <span className="text-gray-400">Ref/UTR: </span>
                  <span className="font-mono">{data.transactionReference}</span>
                </div>
              )}
              {data.cashierName && (
                <div className="col-span-2 text-[10px] text-gray-400">
                  Cashier: {data.cashierName}
                </div>
              )}
            </div>

            {/* Fee Items Table */}
            <div className="border-t border-b border-gray-200 dark:border-slate-800 print:border-black py-2 my-2 space-y-1.5">
              <div className="flex justify-between font-bold text-[10px] text-gray-400 uppercase tracking-wider">
                <span>Fee Particulars</span>
                <span>Paid (₹)</span>
              </div>
              {data.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5 text-[11px]">
                  <div className="flex justify-between font-medium">
                    <span>
                      {item.feeHeadName} ({item.term})
                    </span>
                    <span className="font-bold">
                      ₹{item.amountPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>Inv: #{item.invoiceNumber}</span>
                    {item.balanceRemaining > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        Bal: ₹{item.balanceRemaining.toLocaleString("en-IN")}
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">Cleared</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Total Paid */}
            <div className="flex justify-between items-center text-sm font-bold text-gray-900 dark:text-white print:text-black pt-1">
              <span>Total Received:</span>
              <span className="text-base text-emerald-600 dark:text-emerald-400 print:text-black font-mono">
                ₹{data.totalAmountPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            {data.remarks && (
              <p className="text-[10px] text-gray-500 italic pt-1">
                Note: {data.remarks}
              </p>
            )}

            {/* Footer */}
            <div className="pt-3 text-center text-[10px] text-gray-400 print:text-black border-t border-dotted border-gray-200 dark:border-slate-800">
              <p>Thank you for your payment!</p>
              <p className="mt-0.5">Computer generated receipt • No signature required</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
            <button
              ref={printButtonRef}
              type="button"
              onClick={handlePrint}
              className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-gray-100 shadow-sm transition active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print (Thermal 80mm)</span>
            </button>

            {data.paymentId && (
              <a
                href={`/api/receipt/${data.paymentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 transition"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleCollectNext}
              className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Next Student</span>
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
