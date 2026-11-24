"use client";

import React, { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import {
  X,
  CreditCard,
  Send,
  Calendar,
  CheckCircle2,
  Clock,
  History,
  Tag,
  AlertCircle,
  FileText,
  User,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sendDueReminder } from "@/app/(admin)/school/due-fees/actions";
import {
  getStudentInvoicesAction,
  getStudentFeeCardAction,
} from "@/app/(admin)/school/collect-fees/actions";

export interface StudentLedgerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string | null;
  studentName: string;
  admissionNumber: string;
  className: string;
  onCollect?: (studentId: string) => void;
}

export function StudentLedgerDrawer({
  open,
  onOpenChange,
  studentId,
  studentName,
  admissionNumber,
  className: studentClass,
  onCollect,
}: StudentLedgerDrawerProps) {
  const [activeTab, setActiveTab] = useState<"invoices" | "reminders">("invoices");
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    if (open && studentId) {
      setLoading(true);
      getStudentFeeCardAction(studentId)
        .then((res) => {
          setLoading(false);
          if (res.success && res.feeCard) {
            setInvoices(res.feeCard.invoices);
          } else {
            getStudentInvoicesAction(studentId).then((r) => {
              if (r.success && r.invoices) setInvoices(r.invoices);
            });
          }
        })
        .catch(() => {
          getStudentInvoicesAction(studentId)
            .then((r) => {
              setLoading(false);
              if (r.success && r.invoices) setInvoices(r.invoices);
            })
            .catch(() => setLoading(false));
        });
    }
  }, [open, studentId]);

  const totalOutstanding = invoices.reduce(
    (sum, inv) => sum + (inv.balanceAmount || 0),
    0
  );

  const handleSendReminder = async (invoiceId: string) => {
    setSendingReminder(true);
    const res = await sendDueReminder(invoiceId);
    setSendingReminder(false);
    if (res.success) {
      toast.success(res.message);
      setInvoices((prev) =>
        prev.map((i) => (i.id === invoiceId ? { ...i, reminderSentD7: true } : i))
      );
    } else {
      toast.error(res.message || "Failed to dispatch reminder");
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-card shadow-2xl border-l border-border/40 flex flex-col focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-250"
          )}
        >
          {/* Header */}
          <div className="p-6 border-b border-border/40 flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#248A3D] dark:bg-[#30D158] text-white dark:text-black flex items-center justify-center font-bold text-lg shadow-sm">
                {studentName.charAt(0)}
              </div>
              <div>
                <DialogPrimitive.Title className="text-lg font-bold text-foreground">
                  {studentName}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-muted-foreground font-mono mt-0.5">
                  Admission: #{admissionNumber} • {studentClass}
                </DialogPrimitive.Description>
              </div>
            </div>
            <DialogPrimitive.Close className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-foreground hover:bg-muted/60 transition">
              <X className="w-5 h-5" />
              <span className="sr-only">Close drawer</span>
            </DialogPrimitive.Close>
          </div>

          {/* Dues KPI Ribbon */}
          <div className="px-6 py-4 bg-muted/30 border-b border-border/40 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Total Outstanding
              </span>
              <p className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
                ₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Pending Invoices
              </span>
              <p className="text-base font-bold text-foreground">
                {invoices.length} Bills
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border/40 px-6">
            <button
              type="button"
              onClick={() => setActiveTab("invoices")}
              className={cn(
                "py-3 text-xs font-bold border-b-2 mr-6 transition-all flex items-center gap-1.5",
                activeTab === "invoices"
                  ? "border-[#248A3D] dark:border-[#30D158] text-[#248A3D] dark:text-[#30D158]"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:text-muted-foreground"
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Pending Dues ({invoices.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("reminders")}
              className={cn(
                "py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5",
                activeTab === "reminders"
                  ? "border-[#248A3D] dark:border-[#30D158] text-[#248A3D] dark:text-[#30D158]"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:text-muted-foreground"
              )}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Reminder History</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loading ? (
              <div className="p-8 text-center text-xs text-gray-400 animate-pulse">
                Fetching student ledger and fee records...
              </div>
            ) : activeTab === "invoices" ? (
              invoices.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-dashed border-emerald-200 dark:border-emerald-800/60">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                    No Outstanding Dues
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                    Student has paid all invoiced terms up to date.
                  </p>
                </div>
              ) : (
                invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-4 rounded-2xl border border-border/40 hover:border-gray-300 dark:hover:border-border/40 bg-card shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">
                            {inv.feeHeadName}
                          </h4>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                            {inv.term}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                          Invoice #{inv.invoiceNumber} • Due:{" "}
                          {new Date(inv.dueDate).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-400 block">Balance Due</span>
                        <span className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400">
                          ₹{inv.balanceAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 text-[11px] text-gray-500">
                      <div>
                        <span>Gross: </span>
                        <span className="font-semibold text-foreground">
                          ₹{inv.grossAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div>
                        <span>Paid: </span>
                        <span className="font-semibold text-emerald-600">
                          ₹{inv.paidAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="text-right">
                        {inv.suggestedLateFee > 0 && (
                          <span className="text-amber-600 font-semibold">
                            +₹{inv.suggestedLateFee} Late Fee
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={sendingReminder}
                        onClick={() => handleSendReminder(inv.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-400 transition"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send Reminder</span>
                      </button>

                      <Link
                        href={`/school/collect-fees`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition active:scale-95"
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>Collect Now</span>
                      </Link>
                    </div>
                  </div>
                ))
              )
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 space-y-2">
                  <h4 className="text-xs font-bold text-foreground uppercase">
                    Automated Reminder Ladder (AUTO-03)
                  </h4>
                  <p className="text-xs text-gray-500">
                    Reminders are scheduled for D-7 days before due date, D+15 days overdue, and D+30 days overdue.
                  </p>
                </div>

                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3.5 rounded-xl border border-border/40 text-xs space-y-1"
                  >
                    <div className="flex justify-between font-semibold text-foreground">
                      <span>{inv.feeHeadName} ({inv.invoiceNumber})</span>
                      <span className="text-gray-400 font-normal">
                        Due: {new Date(inv.dueDate).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 text-[11px]">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                        SMS/WhatsApp Ready
                      </span>
                      <span className="text-gray-400">Status: Dispatched via ladder</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="p-4 border-t border-border/40 bg-muted/20 flex items-center justify-between gap-3">
            <Link
              href="/school/collect-fees"
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-[#248A3D] hover:bg-[#1f7232] dark:bg-[#30D158] dark:hover:bg-[#28b84d] text-white dark:text-black shadow-sm transition active:scale-95"
            >
              <CreditCard className="w-4 h-4" />
              <span>Open Collect Terminal</span>
            </Link>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
