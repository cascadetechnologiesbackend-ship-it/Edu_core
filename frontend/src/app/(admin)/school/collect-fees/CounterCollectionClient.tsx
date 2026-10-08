"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  CreditCard,
  Search,
  CheckCircle2,
  Receipt,
  User,
  QrCode,
  Banknote,
  Building2,
  Sparkles,
  RotateCcw,
  Percent,
  Clock,
  History,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  searchStudentsAction,
  getStudentInvoicesAction,
  processCounterCollection,
  MultiInvoiceCollectionPayload,
} from "./actions";
import { ReceiptSheet, ReceiptData } from "@/components/finance/ReceiptSheet";
import { cn } from "@/lib/utils";

interface StudentSearchResult {
  id: string;
  admissionNumber: string;
  name: string;
  className: string;
  totalDue?: number;
  pendingInvoiceCount?: number;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  feeHeadName: string;
  term: string;
  dueDate: string;
  grossAmount: number;
  discountAmount: number;
  lateFeeAmount: number;
  taxAmount: number;
  netAmount: number;
  paidAmount: number;
  balanceAmount: number;
  suggestedLateFee: number;
  status: string;
}

interface BankAccountOption {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
}

interface SelectedInvoiceItem {
  invoiceId: string;
  amountToPay: number;
  discountAdjustment: number;
  lateFeeAdjustment: number;
}

export function CounterCollectionClient({
  initialStudents,
  bankAccounts,
  schoolName,
}: {
  initialStudents: StudentSearchResult[];
  bankAccounts: BankAccountOption[];
  schoolName: string;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>(initialStudents);
  const [searching, setSearching] = useState(false);
  const [recentStudents, setRecentStudents] = useState<StudentSearchResult[]>([]);

  // Selected Student & Invoices
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const [studentInvoices, setStudentInvoices] = useState<InvoiceDetail[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Settlement Selection State: Map invoiceId -> SelectedInvoiceItem
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedInvoiceItem>>({});

  // Payment Form State
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "UPI" | "CHEQUE" | "DD" | "NEFT" | "RTGS" | "ONLINE"
  >("CASH");
  const [bankAccountId, setBankAccountId] = useState<string>("CASH");
  const [cashTendered, setCashTendered] = useState<string>("");
  const [transactionReference, setTransactionReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // UPI QR Code state
  const [upiQrUrl, setUpiQrUrl] = useState<string | null>(null);

  // Receipt Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Focus search on mount for POS keyboard posture
  useEffect(() => {
    searchInputRef.current?.focus();
    // Load recent students from localStorage
    try {
      const stored = localStorage.getItem("edu_counter_recent_students");
      if (stored) setRecentStudents(JSON.parse(stored).slice(0, 5));
    } catch (e) {
      // ignore
    }
  }, []);

  // Debounced server-side student search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchTerm.trim()) {
        setSearchResults(initialStudents);
        return;
      }
      setSearching(true);
      const res = await searchStudentsAction(searchTerm.trim());
      setSearching(false);
      if (res.success && res.students) {
        setSearchResults(res.students);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchTerm, initialStudents]);

  // Load invoices when a student is selected
  const handleSelectStudent = useCallback(async (stu: StudentSearchResult) => {
    setSelectedStudent(stu);
    setLoadingInvoices(true);
    setSelectedItems({});
    setCashTendered("");
    setUpiQrUrl(null);

    // Save to recents
    setRecentStudents((prev) => {
      const filtered = prev.filter((p) => p.id !== stu.id);
      const updated = [stu, ...filtered].slice(0, 5);
      try {
        localStorage.setItem("edu_counter_recent_students", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    const res = await getStudentInvoicesAction(stu.id);
    setLoadingInvoices(false);

    if (res.success && res.invoices) {
      setStudentInvoices(res.invoices);
      // Default: select ALL pending invoices with full balance amount
      const initialMap: Record<string, SelectedInvoiceItem> = {};
      res.invoices.forEach((inv) => {
        initialMap[inv.id] = {
          invoiceId: inv.id,
          amountToPay: inv.balanceAmount,
          discountAdjustment: 0,
          lateFeeAdjustment: inv.suggestedLateFee > 0 ? inv.suggestedLateFee : 0,
        };
      });
      setSelectedItems(initialMap);
    } else {
      toast.error(res.message || "Failed to load student dues");
    }
  }, []);

  // Toggle invoice inclusion
  const toggleInvoice = (inv: InvoiceDetail) => {
    setSelectedItems((prev) => {
      const copy = { ...prev };
      if (copy[inv.id]) {
        delete copy[inv.id];
      } else {
        copy[inv.id] = {
          invoiceId: inv.id,
          amountToPay: inv.balanceAmount,
          discountAdjustment: 0,
          lateFeeAdjustment: inv.suggestedLateFee > 0 ? inv.suggestedLateFee : 0,
        };
      }
      return copy;
    });
  };

  // Settle all toggle
  const toggleSettleAll = () => {
    if (Object.keys(selectedItems).length === studentInvoices.length) {
      setSelectedItems({});
    } else {
      const allMap: Record<string, SelectedInvoiceItem> = {};
      studentInvoices.forEach((inv) => {
        allMap[inv.id] = {
          invoiceId: inv.id,
          amountToPay: inv.balanceAmount,
          discountAdjustment: 0,
          lateFeeAdjustment: inv.suggestedLateFee > 0 ? inv.suggestedLateFee : 0,
        };
      });
      setSelectedItems(allMap);
    }
  };

  // Update item amount or adjustment
  const updateItem = (
    invoiceId: string,
    updates: Partial<SelectedInvoiceItem>
  ) => {
    setSelectedItems((prev) => {
      if (!prev[invoiceId]) return prev;
      return {
        ...prev,
        [invoiceId]: {
          ...prev[invoiceId],
          ...updates,
        },
      };
    });
  };

  // Calculate live totals
  const totalInvoicedSelected = Object.keys(selectedItems).reduce((sum, invId) => {
    const inv = studentInvoices.find((i) => i.id === invId);
    return sum + (inv ? inv.balanceAmount : 0);
  }, 0);

  const totalDiscountAdjustments = Object.values(selectedItems).reduce(
    (sum, item) => sum + (item.discountAdjustment || 0),
    0
  );

  const totalLateFeeAdjustments = Object.values(selectedItems).reduce(
    (sum, item) => sum + (item.lateFeeAdjustment || 0),
    0
  );

  const grandTotalPayable = Object.values(selectedItems).reduce(
    (sum, item) => sum + (item.amountToPay || 0),
    0
  );

  // Generate dynamic UPI QR Code when amount or method changes
  useEffect(() => {
    if (paymentMethod === "UPI" && grandTotalPayable > 0 && selectedStudent) {
      const upiPayload = `upi://pay?pa=schoolmitra@upi&pn=${encodeURIComponent(
        schoolName
      )}&am=${grandTotalPayable.toFixed(2)}&cu=INR&tn=Fee-Adm-${selectedStudent.admissionNumber}`;
      QRCode.toDataURL(upiPayload, { width: 160, margin: 1 })
        .then((url) => setUpiQrUrl(url))
        .catch(() => setUpiQrUrl(null));
    } else {
      setUpiQrUrl(null);
    }
  }, [paymentMethod, grandTotalPayable, selectedStudent, schoolName]);

  // Handle counter submit
  const handleSubmitCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error("Please select a student first.");
      return;
    }

    const itemsToSubmit = Object.values(selectedItems).filter((it) => it.amountToPay > 0);
    if (itemsToSubmit.length === 0) {
      toast.error("Please enter a payment amount for at least one invoice.");
      return;
    }

    setSubmitting(true);

    const payload: MultiInvoiceCollectionPayload = {
      studentId: selectedStudent.id,
      items: itemsToSubmit.map((it) => ({
        invoiceId: it.invoiceId,
        amountPaid: it.amountToPay,
        discountAdjustment: it.discountAdjustment > 0 ? it.discountAdjustment : undefined,
        lateFeeAdjustment: it.lateFeeAdjustment > 0 ? it.lateFeeAdjustment : undefined,
      })),
      paymentMethod,
      bankAccountId: bankAccountId === "CASH" ? null : bankAccountId,
      transactionReference: transactionReference.trim() || null,
      remarks: remarks.trim() || null,
    };

    const res = await processCounterCollection(payload);
    setSubmitting(false);

    if (res.success && res.receiptNumber) {
      toast.success(`Receipt #${res.receiptNumber} issued successfully!`);
      const bankName =
        bankAccounts.find((b) => b.id === bankAccountId)?.bankName || undefined;

      setReceiptData({
        schoolName,
        receiptNumber: res.receiptNumber,
        date: res.date || new Date().toLocaleString("en-IN"),
        student: {
          name: selectedStudent.name,
          admissionNumber: selectedStudent.admissionNumber,
          className: selectedStudent.className,
        },
        items: res.items || [],
        totalAmountPaid: res.totalAmountPaid || grandTotalPayable,
        paymentMethod: res.paymentMethod || paymentMethod,
        bankName,
        transactionReference: res.transactionReference,
        remarks: remarks || undefined,
        paymentId: res.paymentId || "",
      });

      setReceiptModalOpen(true);
    } else {
      toast.error(res.message || "Failed to process collection.");
    }
  };

  // Next student reset handler
  const handleNextStudent = () => {
    setSelectedStudent(null);
    setStudentInvoices([]);
    setSelectedItems({});
    setSearchTerm("");
    setCashTendered("");
    setTransactionReference("");
    setRemarks("");
    setUpiQrUrl(null);
    setTimeout(() => searchInputRef.current?.focus(), 150);
  };

  // Cash change calculation
  const tenderedNum = parseFloat(cashTendered || "0");
  const changeDue = tenderedNum >= grandTotalPayable ? tenderedNum - grandTotalPayable : 0;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Student Search & Invoice Breakdown (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Recent Students Quick Strip */}
          {recentStudents.length > 0 && !selectedStudent && (
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex items-center gap-3 overflow-x-auto text-xs">
              <span className="flex items-center gap-1 font-semibold text-gray-500 whitespace-nowrap">
                <History className="w-3.5 h-3.5 text-indigo-500" /> Recent:
              </span>
              <div className="flex items-center gap-2">
                {recentStudents.map((stu) => (
                  <button
                    key={stu.id}
                    type="button"
                    onClick={() => handleSelectStudent(stu)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:border-indigo-300 transition"
                  >
                    <span className="font-medium">{stu.name}</span>
                    <span className="text-[10px] text-gray-400">#{stu.admissionNumber}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Student Search Box */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-500" />
                Find Student (Admission No, Name, Grade)
              </label>
              {searching && (
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 animate-pulse">
                  Searching roster...
                </span>
              )}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by student name or admission number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
              />
            </div>

            {/* Matching Students List */}
            {!selectedStudent && (
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/80 border border-gray-100 dark:border-slate-800 rounded-xl">
                {searchResults.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400">
                    No students match your query. Try searching by admission number or full name.
                  </div>
                ) : (
                  searchResults.map((stu) => (
                    <button
                      type="button"
                      key={stu.id}
                      onClick={() => handleSelectStudent(stu)}
                      className="w-full p-3 text-left flex items-center justify-between hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shadow-sm">
                          {stu.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                            {stu.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400 font-mono">
                            Adm: #{stu.admissionNumber} • {stu.className}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        {stu.totalDue !== undefined && (
                          <div className="text-xs font-bold font-mono text-rose-600 dark:text-rose-400">
                            Due: ₹{stu.totalDue.toLocaleString("en-IN")}
                          </div>
                        )}
                        <span className="text-[10px] text-gray-400 flex items-center gap-1 justify-end">
                          Select <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Student Invoices Card */}
          {selectedStudent && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
              {/* Student Header & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    {selectedStudent.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-gray-900 dark:text-white">
                        {selectedStudent.name}
                      </h3>
                      <button
                        type="button"
                        onClick={handleNextStudent}
                        className="text-[11px] text-indigo-600 hover:underline"
                        title="Change student"
                      >
                        (Change)
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 font-mono">
                      Admission: #{selectedStudent.admissionNumber} • Grade: {selectedStudent.className}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {studentInvoices.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleSettleAll}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition"
                    >
                      {Object.keys(selectedItems).length === studentInvoices.length
                        ? "Deselect All"
                        : "Settle All Dues"}
                    </button>
                  )}
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                    {studentInvoices.length} Invoices
                  </span>
                </div>
              </div>

              {/* Invoices List */}
              {loadingInvoices ? (
                <div className="p-8 text-center text-xs text-gray-500 animate-pulse">
                  Loading pending invoices for {selectedStudent.name}...
                </div>
              ) : studentInvoices.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-dashed border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                    All dues are clear!
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                    No outstanding invoices found for this student.
                  </p>
                  <button
                    type="button"
                    onClick={handleNextStudent}
                    className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-sm"
                  >
                    Select Another Student
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {studentInvoices.map((inv) => {
                    const isSelected = !!selectedItems[inv.id];
                    const selectedItem = selectedItems[inv.id];

                    return (
                      <div
                        key={inv.id}
                        className={cn(
                          "p-4 rounded-2xl border transition-all space-y-3",
                          isSelected
                            ? "border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm"
                            : "border-gray-200 dark:border-slate-800 hover:border-gray-300"
                        )}
                      >
                        {/* Top row: Checkbox, Head, Invoice Number, Balance */}
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleInvoice(inv)}
                              className="mt-1 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-gray-900 dark:text-white">
                                  {inv.feeHeadName}
                                </span>
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                                  {inv.term}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-slate-400 font-mono mt-0.5">
                                Inv: #{inv.invoiceNumber} • Due:{" "}
                                {new Date(inv.dueDate).toLocaleDateString("en-IN")}
                              </p>
                            </div>
                          </label>

                          <div className="text-right">
                            <span className="text-xs text-gray-400 block">Due Balance</span>
                            <span className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400">
                              ₹{inv.balanceAmount.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>

                        {/* If selected: show payment inputs & presets */}
                        {isSelected && selectedItem && (
                          <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40 grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs items-center">
                            {/* Preset Buttons */}
                            <div className="sm:col-span-5 flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-400 uppercase font-semibold">
                                Preset:
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateItem(inv.id, { amountToPay: inv.balanceAmount })
                                }
                                className={cn(
                                  "px-2 py-1 rounded-lg text-[11px] font-semibold border transition",
                                  selectedItem.amountToPay === inv.balanceAmount
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-700"
                                )}
                              >
                                Full
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateItem(inv.id, {
                                    amountToPay: Math.round(inv.balanceAmount / 2),
                                  })
                                }
                                className={cn(
                                  "px-2 py-1 rounded-lg text-[11px] font-semibold border transition",
                                  selectedItem.amountToPay === Math.round(inv.balanceAmount / 2)
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-700"
                                )}
                              >
                                50%
                              </button>
                            </div>

                            {/* Paying Amount Input */}
                            <div className="sm:col-span-7 flex items-center justify-end gap-2">
                              <label className="text-[11px] font-semibold text-gray-600 dark:text-slate-300">
                                Amount (₹):
                              </label>
                              <input
                                type="number"
                                step="1"
                                min="1"
                                max={inv.balanceAmount + (selectedItem.lateFeeAdjustment || 0)}
                                value={selectedItem.amountToPay}
                                onChange={(e) =>
                                  updateItem(inv.id, {
                                    amountToPay: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-28 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold font-mono text-emerald-600 text-right focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>

                            {/* Adjustments: Discount & Late Fine Inputs */}
                            <div className="sm:col-span-12 flex flex-wrap items-center gap-3 pt-1 text-[11px] text-gray-500">
                              <div className="flex items-center gap-1.5">
                                <Percent className="w-3 h-3 text-emerald-600" />
                                <span>Disc Adjust (-):</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={selectedItem.discountAdjustment || ""}
                                  onChange={(e) =>
                                    updateItem(inv.id, {
                                      discountAdjustment: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-16 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-right font-mono"
                                />
                              </div>

                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Late Fine (+):</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={selectedItem.lateFeeAdjustment || ""}
                                  onChange={(e) =>
                                    updateItem(inv.id, {
                                      lateFeeAdjustment: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-16 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-right font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: POS Collection Terminal (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm sticky top-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Payment Terminal
                </h2>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold">
                POS Ready
              </span>
            </div>

            {!selectedStudent ? (
              <div className="p-8 text-center text-gray-400 text-xs border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl space-y-2">
                <User className="w-8 h-8 mx-auto text-gray-300 dark:text-slate-600" />
                <p>Select or search a student on the left to begin collection.</p>
              </div>
            ) : Object.keys(selectedItems).length === 0 ? (
              <div className="p-8 text-center text-amber-600 dark:text-amber-400 text-xs border border-dashed border-amber-200 dark:border-amber-800/40 rounded-2xl space-y-1">
                <AlertCircle className="w-6 h-6 mx-auto mb-1 text-amber-500" />
                <p className="font-semibold">No Invoices Selected</p>
                <p className="text-[11px] text-gray-500">
                  Select at least one invoice on the left to accept payment.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitCollection} className="space-y-4">
                {/* Live Totals Band */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-950/50 border border-gray-100 dark:border-slate-800/80 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-500 dark:text-slate-400">
                    <span>Selected Invoices Subtotal</span>
                    <span className="font-mono">₹{totalInvoicedSelected.toLocaleString("en-IN")}</span>
                  </div>
                  {totalDiscountAdjustments > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Total Discount Adjustment (-)</span>
                      <span className="font-mono">-₹{totalDiscountAdjustments.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {totalLateFeeAdjustments > 0 && (
                    <div className="flex justify-between text-amber-600 font-medium">
                      <span>Late Fine Adjustment (+)</span>
                      <span className="font-mono">+₹{totalLateFeeAdjustments.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-slate-800 pt-2">
                    <span>Payable Total:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono text-lg">
                      ₹{grandTotalPayable.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Payment Method Segmented Control */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-2">
                    Payment Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "CASH", label: "Cash", icon: Banknote },
                      { id: "UPI", label: "UPI / QR", icon: QrCode },
                      { id: "CHEQUE", label: "Cheque", icon: Building2 },
                      { id: "DD", label: "Demand Draft", icon: Building2 },
                      { id: "NEFT", label: "NEFT / RTGS", icon: Building2 },
                      { id: "ONLINE", label: "Online Card", icon: CreditCard },
                    ].map((mode) => {
                      const Icon = mode.icon;
                      const isModeActive = paymentMethod === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setPaymentMethod(mode.id as any)}
                          className={cn(
                            "flex flex-col items-center justify-center py-2 px-2 rounded-xl text-xs font-semibold border transition-all",
                            isModeActive
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                              : "bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5 mb-1" />
                          <span>{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic Mode UI: Cash change calculator OR UPI QR OR Cheque/Ref */}
                {paymentMethod === "CASH" && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                        Cash Tendered (₹):
                      </label>
                      <input
                        type="number"
                        placeholder={grandTotalPayable.toString()}
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        className="w-32 px-2.5 py-1 text-sm font-mono font-bold text-right rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    {tenderedNum > 0 && (
                      <div className="flex justify-between text-xs font-bold pt-1 border-t border-emerald-200/60 dark:border-emerald-800/40">
                        <span className="text-emerald-800 dark:text-emerald-300">
                          Return Change to Parent:
                        </span>
                        <span
                          className={cn(
                            "font-mono",
                            changeDue >= 0 ? "text-emerald-600 font-bold" : "text-rose-600"
                          )}
                        >
                          ₹{changeDue.toLocaleString("en-IN")}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === "UPI" && upiQrUrl && (
                  <div className="p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50 text-center space-y-2">
                    <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-300">
                      Scan QR Code to Pay ₹{grandTotalPayable.toLocaleString("en-IN")}
                    </p>
                    <div className="inline-block p-2 bg-white rounded-xl shadow-sm">
                      <img src={upiQrUrl} alt="UPI Payment QR" className="w-36 h-36 mx-auto" />
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono">
                      VPA: schoolmitra@upi • Adm #{selectedStudent.admissionNumber}
                    </p>
                  </div>
                )}

                {/* Bank Account Selection (for Non-Cash) */}
                {paymentMethod !== "CASH" && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                      Deposit Bank Account
                    </label>
                    <select
                      value={bankAccountId}
                      onChange={(e) => setBankAccountId(e.target.value)}
                      className="w-full px-3 py-2 text-xs md:text-sm font-medium rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      <option value="CASH">School Cash In Hand</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} - {b.accountName} ({b.accountNumber.slice(-4)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Reference / UTR Number for Digital / Cheque */}
                {paymentMethod !== "CASH" && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                      {paymentMethod === "CHEQUE"
                        ? "Cheque Number *"
                        : paymentMethod === "DD"
                        ? "DD Number *"
                        : "UTR / Transaction Reference"}
                    </label>
                    <input
                      type="text"
                      required={paymentMethod === "CHEQUE" || paymentMethod === "DD"}
                      placeholder="e.g. UTR9827364512 or Cheque 001928"
                      value={transactionReference}
                      onChange={(e) => setTransactionReference(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                )}

                {/* Remarks Input */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                    Receipt Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Paid in full for Term 1 & 2"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Collect Button */}
                <button
                  type="submit"
                  disabled={submitting || grandTotalPayable <= 0}
                  className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  <span>
                    {submitting
                      ? "Recording Collection..."
                      : `Collect ₹${grandTotalPayable.toLocaleString("en-IN")} & Issue Receipt`}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Instant Thermal Receipt Modal */}
      <ReceiptSheet
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        data={receiptData}
        onCollectNext={handleNextStudent}
      />
    </>
  );
}
