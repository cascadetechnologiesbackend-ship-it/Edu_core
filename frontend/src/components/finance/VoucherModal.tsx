"use client";

import React, { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  X,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  IndianRupee,
  Receipt,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createIncomeVoucher } from "@/app/(admin)/school/accounts/incomes/actions";
import { createExpenseVoucher } from "@/app/(admin)/school/accounts/expenses/actions";

export interface VoucherModalProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  type?: "INCOME" | "EXPENSE";
  isIncome?: boolean;
  heads?: Array<{ id: string; name: string }>;
  bankAccounts?: Array<{ id: string; bankName: string; accountName: string; accountNumber?: string }>;
  onSuccess?: () => void;
}

export function VoucherModal({
  open,
  onOpenChange,
  onClose,
  type = "INCOME",
  isIncome: isIncomeProp,
  heads = [
    { id: "misc-fee-head", name: "Miscellaneous Fee Income" },
    { id: "canteen-income", name: "Canteen & Cafeteria Revenue" },
    { id: "library-fines", name: "Library Fines & Late Charges" },
    { id: "alumni-donations", name: "Alumni & Voluntary Donations" },
  ],
  bankAccounts = [],
  onSuccess,
}: VoucherModalProps) {
  const isIncome = isIncomeProp !== undefined ? isIncomeProp : type === "INCOME";

  const handleClose = () => {
    if (onClose) onClose();
    if (onOpenChange) onOpenChange(false);
  };

  // Form State with smart defaults (AUTO-10)
  const [headId, setHeadId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [bankAccountId, setBankAccountId] = useState("CASH");
  const [partyName, setPartyName] = useState(""); // vendorName or paymentSource
  const [transactionReference, setTransactionReference] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load smart defaults from localStorage on mount
  useEffect(() => {
    if (open) {
      try {
        const lastMode = localStorage.getItem(`edu_last_voucher_mode_${type}`);
        const lastBank = localStorage.getItem(`edu_last_voucher_bank_${type}`);
        if (lastMode) setPaymentMode(lastMode);
        if (lastBank) setBankAccountId(lastBank);
        if (heads.length > 0 && !headId && heads[0]?.id) setHeadId(heads[0].id);
      } catch (e) {}
    }
  }, [open, type, heads, headId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!headId) {
      toast.error(`Please select an ${isIncome ? "income" : "expense"} category head.`);
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount greater than zero.");
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append(isIncome ? "incomeHeadId" : "expenseHeadId", headId);
    formData.append("amount", parsedAmount.toFixed(2));
    formData.append("paymentMode", paymentMode);
    formData.append("bankAccountId", bankAccountId === "CASH" ? "" : bankAccountId);
    formData.append(isIncome ? "paymentSource" : "vendorName", partyName.trim());
    formData.append("transactionReference", transactionReference.trim());
    formData.append("entryDate", entryDate);
    formData.append("remarks", remarks.trim());

    try {
      if (isIncome) {
        const res = await createIncomeVoucher(formData);
        if (res.success) {
          toast.success(`Income Voucher #${res.voucherNumber} created successfully!`, {
            action: {
              label: "View",
              onClick: () => {
                window.location.href = "/school/transactions";
              },
            },
          });
          saveSmartDefaults();
          handleReset();
          handleClose();
          if (onSuccess) onSuccess();
        }
      } else {
        const res = await createExpenseVoucher(formData);
        if (res.success) {
          toast.success(`Expense Voucher #${res.voucherNumber} recorded successfully!`, {
            action: {
              label: "View",
              onClick: () => {
                window.location.href = "/school/transactions";
              },
            },
          });
          saveSmartDefaults();
          handleReset();
          handleClose();
          if (onSuccess) onSuccess();
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create voucher");
    } finally {
      setSubmitting(false);
    }
  };

  const saveSmartDefaults = () => {
    try {
      localStorage.setItem(`edu_last_voucher_mode_${type}`, paymentMode);
      localStorage.setItem(`edu_last_voucher_bank_${type}`, bankAccountId);
    } catch (e) {}
  };

  const handleReset = () => {
    setAmount("");
    setPartyName("");
    setTransactionReference("");
    setRemarks("");
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(val) => {
        if (!val) {
          handleClose();
        } else if (onOpenChange) {
          onOpenChange(val);
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-gray-200 dark:border-slate-800 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "w-9 h-9 rounded-2xl flex items-center justify-center font-bold",
                  isIncome
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                    : "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                )}
              >
                {isIncome ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
              </span>
              <div>
                <DialogPrimitive.Title className="text-base font-bold text-gray-900 dark:text-white">
                  {isIncome ? "Record Direct Income" : "Record Expense Voucher"}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-gray-500 dark:text-slate-400">
                  {isIncome
                    ? "Non-fee incoming revenue, donations, or bank interest"
                    : "Operating expenses, vendor payments, or maintenance bills"}
                </DialogPrimitive.Description>
              </div>
            </div>
            <DialogPrimitive.Close className="rounded-xl p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition">
              <X className="w-4 h-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Field 1: Transaction Date (Defaults to today) */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                1. Transaction Date *
              </label>
              <input
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
              />
            </div>

            {/* Field 2: Account Head (Select) */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                2. Account Head *
              </label>
              <select
                required
                value={headId}
                onChange={(e) => setHeadId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="">Select Fee / Miscellaneous Income Head</option>
                {heads.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Field 3: Amount (font-mono INR) */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                3. Amount (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full min-h-[44px] pl-7 pr-3 py-2 text-sm font-bold font-mono text-gray-900 dark:text-white rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Field 4: Payer / Description */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                4. Payer / Description *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Canteen Operator, Alumni Donation, Library Fine"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Field 5: Narration */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                5. Narration / Particulars
              </label>
              <input
                type="text"
                placeholder="Voucher narrative and settlement particulars"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Live Double-Entry Preview Line */}
            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/60 text-xs font-mono space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                Live Double-Entry Preview (AM-03)
              </span>
              <p className="font-bold text-emerald-600 dark:text-emerald-400">
                Dr Cash/Bank INR {parseFloat(amount || "0") > 0 ? parseFloat(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"} — Cr {heads.find((h) => h.id === headId)?.name || "Selected Head"} INR {parseFloat(amount || "0") > 0 ? parseFloat(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "w-full min-h-[44px] py-3 px-4 rounded-2xl text-white font-bold text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2",
                  isIncome
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                    : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20"
                )}
              >
                {isIncome ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                <span>
                  {submitting
                    ? "Posting Voucher to Ledger..."
                    : isIncome
                    ? "Post Income Voucher"
                    : "Post Expense Voucher"}
                </span>
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
