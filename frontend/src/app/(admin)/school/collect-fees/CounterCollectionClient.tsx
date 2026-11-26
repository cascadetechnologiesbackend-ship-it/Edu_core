"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Script from "next/script";
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
import dynamic from "next/dynamic";
import {
  searchStudentsAction,
  getStudentInvoicesAction,
  getStudentFeeCardAction,
  processCounterCollection,
  MultiInvoiceCollectionPayload,
  type StudentFinancialSummary,
} from "./actions";
import type { ReceiptData } from "@/components/finance/ReceiptSheet";

const ReceiptSheet = dynamic(
  () => import("@/components/finance/ReceiptSheet").then((mod) => mod.ReceiptSheet),
  { ssr: false }
);
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/finance/EmptyState";
import type { StudentFeeCard } from "@schoolmitra/validators";

type StudentSearchResult = StudentFeeCard;

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
  schoolAddress,
  schoolPhone,
}: {
  initialStudents: StudentSearchResult[];
  bankAccounts: BankAccountOption[];
  schoolName: string;
  schoolAddress?: string | undefined;
  schoolPhone?: string | undefined;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>(initialStudents);
  const [searching, setSearching] = useState(false);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [recentStudents, setRecentStudents] = useState<StudentSearchResult[]>([]);

  // Selected Student, Financial Summary & Invoices
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const [studentSummary, setStudentSummary] = useState<StudentFinancialSummary | null>(null);
  const [studentConcessions, setStudentConcessions] = useState<
    Array<{ policy: string; status: string }>
  >([]);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
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
  const [isOpeningRzp, setIsOpeningRzp] = useState(false);

  // Receipt Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Focus search on mount for POS keyboard posture & register keyboard map (PF 4.1.0)
  useEffect(() => {
    searchInputRef.current?.focus();
    // Load recent students from localStorage
    try {
      const stored = localStorage.getItem("edu_counter_recent_students");
      if (stored) setRecentStudents(JSON.parse(stored).slice(0, 5));
    } catch (e) {
      // ignore
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (document.activeElement === searchInputRef.current) {
          setSearchTerm("");
          searchInputRef.current?.blur();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounced server-side student search + browse mode (students with pending dues first)
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const q = searchTerm.trim();
      if (!q && initialStudents.length > 0) {
        setSearchResults(initialStudents);
        setHasMoreResults(initialStudents.length >= 20);
        return;
      }
      setSearching(true);
      const res = await searchStudentsAction(q, { offset: 0, limit: 20 });
      if (cancelled) return;
      setSearching(false);
      if (res.success && res.students) {
        setSearchResults(res.students);
        setHasMoreResults(Boolean(res.hasMore));
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, initialStudents]);

  const handleLoadMoreStudents = async () => {
    setLoadingMore(true);
    const res = await searchStudentsAction(searchTerm.trim(), {
      offset: searchResults.length,
      limit: 20,
    });
    setLoadingMore(false);
    if (res.success && res.students) {
      setSearchResults((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        return [...prev, ...res.students.filter((s) => !seen.has(s.id))];
      });
      setHasMoreResults(Boolean(res.hasMore));
    }
  };

  // Load consolidated fee summary & pending invoices when a student is selected
  const handleSelectStudent = useCallback(async (stu: StudentSearchResult) => {
    setSelectedStudent(stu);
    setLoadingInvoices(true);
    setSelectedItems({});
    setStudentSummary(null);
    setStudentConcessions([]);
    setShowPaymentHistory(false);
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

    const [invRes, cardRes] = await Promise.all([
      getStudentInvoicesAction(stu.id),
      getStudentFeeCardAction(stu.id),
    ]);
    setLoadingInvoices(false);

    if (cardRes.success && cardRes.summary) {
      setStudentSummary(cardRes.summary);
      setStudentConcessions(cardRes.feeCard?.concessions || []);
      if (cardRes.feeCard) {
        setSelectedStudent((prev) =>
          prev
            ? {
                ...prev,
                className: cardRes.feeCard!.className,
                sectionName: cardRes.feeCard!.sectionName,
              }
            : prev,
        );
      }
    }

    if (invRes.success && invRes.invoices) {
      setStudentInvoices(invRes.invoices);
      // Default: select ALL pending invoices with full balance amount
      const initialMap: Record<string, SelectedInvoiceItem> = {};
      invRes.invoices.forEach((inv) => {
        initialMap[inv.id] = {
          invoiceId: inv.id,
          amountToPay: inv.balanceAmount,
          discountAdjustment: 0,
          lateFeeAdjustment: inv.suggestedLateFee > 0 ? inv.suggestedLateFee : 0,
        };
      });
      setSelectedItems(initialMap);
    } else {
      toast.error(invRes.message || "Failed to load student dues");
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

  // Handle Razorpay Online Counter Modal
  const handleLaunchRazorpayCounter = async () => {
    const itemsToSubmit = Object.values(selectedItems).filter((it) => it.amountToPay > 0);
    if (itemsToSubmit.length === 0 || !selectedStudent) {
      toast.error("Please select at least one invoice to collect.");
      return;
    }

    const firstInvoice = itemsToSubmit[0]?.invoiceId;
    if (!firstInvoice) return;

    setIsOpeningRzp(true);
    try {
      const res = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: firstInvoice,
          amount: grandTotalPayable,
        }),
      });

      const order = await res.json();
      if (!res.ok || order.error) {
        toast.error("Error creating gateway order: " + (order.error || "Unknown"));
        setIsOpeningRzp(false);
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TlW4pDX3FlFmRx",
        amount: order.amount,
        currency: order.currency || "INR",
        name: schoolName,
        description: `Counter Collection - Adm #${selectedStudent.admissionNumber}`,
        order_id: order.id,
        handler: async function (response: any) {
          toast.loading("Verifying online counter collection with bank...", { id: "rzp-counter-verify" });
          const verifyRes = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();
          toast.dismiss("rzp-counter-verify");

          if (verifyRes.ok && verifyData.success) {
            toast.success(`Online Payment verified! Receipt #${verifyData.receiptNumber}`);
            setTransactionReference(response.razorpay_payment_id);

            // Record multi-invoice collection
            const payload: MultiInvoiceCollectionPayload = {
              studentId: selectedStudent.id,
              items: itemsToSubmit.map((it) => ({
                invoiceId: it.invoiceId,
                amountPaid: it.amountToPay,
                discountAdjustment: it.discountAdjustment > 0 ? it.discountAdjustment : undefined,
                lateFeeAdjustment: it.lateFeeAdjustment > 0 ? it.lateFeeAdjustment : undefined,
              })),
              paymentMethod: "ONLINE",
              bankAccountId: bankAccountId === "CASH" ? null : bankAccountId,
              transactionReference: response.razorpay_payment_id,
              remarks: remarks.trim() || `Razorpay Counter Settlement: ${response.razorpay_payment_id}`,
            };
            const colRes = await processCounterCollection(payload);
            if (colRes.success && colRes.receiptNumber) {
              setReceiptData(colRes.receiptData as any);
              setReceiptModalOpen(true);
              handleNextStudent();
            }
          } else {
            toast.error("Signature verification failed: " + (verifyData.error || "Unknown error"));
          }
        },
        prefill: {
          name: selectedStudent.name,
          contact: (selectedStudent as any).primaryParentMobile || (selectedStudent as any).parentPhone || "9999999999",
        },
        theme: {
          color: "#007AFF",
        },
        modal: {
          ondismiss: function () {
            setIsOpeningRzp(false);
          },
        },
      };

      if (typeof window !== "undefined" && (window as any).Razorpay) {
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        toast.error("Razorpay SDK is loading, please try again in a moment.");
      }
    } catch (err: any) {
      toast.error("Gateway error: " + err.message);
    } finally {
      setIsOpeningRzp(false);
    }
  };

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

      setReceiptData(
        (res as any).receiptData || {
          schoolName,
          schoolAddress,
          schoolPhone,
          receiptNumber: res.receiptNumber,
          date: res.date || new Date().toLocaleString("en-IN"),
          student: {
            name: selectedStudent.name,
            admissionNumber: selectedStudent.admissionNumber,
            className: [selectedStudent.className, selectedStudent.sectionName]
              .filter(Boolean)
              .join(" - "),
          },
          items: res.items || [],
          totalAmountPaid: res.totalAmountPaid || grandTotalPayable,
          paymentMethod: res.paymentMethod || paymentMethod,
          bankName,
          transactionReference: res.transactionReference,
          remarks: remarks || undefined,
          paymentId: res.paymentId || "",
        },
      );

      setReceiptModalOpen(true);
    } else {
      toast.error(res.message || "Failed to process collection.");
    }
  };

  // Next student reset handler
  const handleNextStudent = () => {
    setSelectedStudent(null);
    setStudentSummary(null);
    setStudentConcessions([]);
    setShowPaymentHistory(false);
    setStudentInvoices([]);
    setSelectedItems({});
    setSearchTerm("");
    setCashTendered("");
    setTransactionReference("");
    setRemarks("");
    setUpiQrUrl(null);
    setTimeout(() => searchInputRef.current?.focus(), 150);
  };

  // Cash change calculation (paise-rounded)
  const tenderedNum = parseFloat(cashTendered || "0");
  const tenderedPaise = Number.isFinite(tenderedNum) ? Math.round(tenderedNum * 100) : 0;
  const payablePaise = Math.round(grandTotalPayable * 100);
  const changeDue =
    tenderedPaise >= payablePaise ? (tenderedPaise - payablePaise) / 100 : 0;
  const cashShortfall =
    tenderedPaise > 0 && tenderedPaise < payablePaise
      ? (payablePaise - tenderedPaise) / 100
      : 0;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Student Search & Invoice Breakdown (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Recent Students Quick Strip */}
          {recentStudents.length > 0 && !selectedStudent && (
            <div className="bg-card p-3.5 rounded-2xl border border-border/40 shadow-sm flex items-center gap-3 overflow-x-auto text-xs">
              <span className="flex items-center gap-1 font-semibold text-gray-500 whitespace-nowrap">
                <History className="w-3.5 h-3.5 text-[#248A3D] dark:text-[#30D158]" /> Recent:
              </span>
              <div className="flex items-center gap-2">
                {recentStudents.map((stu) => (
                  <button
                    key={stu.id}
                    type="button"
                    onClick={() => handleSelectStudent(stu)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-muted/40 hover:bg-muted/40 dark:hover:bg-muted/40 text-foreground border border-border/40 hover:border-[#248A3D]/30 transition"
                  >
                    <span className="font-medium">{stu.name}</span>
                    <span className="text-[10px] text-gray-400">#{stu.admissionNumber}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Student Search Box */}
          <div className="bg-card p-5 rounded-2xl border border-border/40 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-[#248A3D] dark:text-[#30D158]" />
                Find Student (Admission No, Name, Grade)
              </label>
              {searching && (
                <span className="text-[11px] text-[#248A3D] dark:text-[#30D158] animate-pulse">
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
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border/40 bg-card text-sm font-medium text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#248A3D] dark:focus:ring-[#30D158]/20 focus:border-[#248A3D] dark:focus:border-[#30D158] transition shadow-sm"
              />
            </div>

            {/* Matching Students List */}
            {!selectedStudent && (
              <div className="max-h-64 overflow-y-auto divide-y divide-border/40 border border-border/40 rounded-xl">
                {searchResults.length === 0 ? (
                  <EmptyState
                    icon={Search}
                    title={searchTerm.trim() ? "No Students Found" : "Search Student Roster"}
                    description={
                      searchTerm.trim()
                        ? `No students match "${searchTerm}". Check admission number or spelling.`
                        : "Type an admission number or student name above to look up ledger dues and collect fees."
                    }
                    className="p-6 md:p-6"
                  />
                ) : (
                  searchResults.map((stu) => (
                    <button
                      type="button"
                      key={stu.id}
                      onClick={() => handleSelectStudent(stu)}
                      className="w-full p-3 text-left flex items-center justify-between hover:bg-muted/40 transition group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#248A3D]/10 dark:bg-[#30D158]/10 text-[#248A3D] dark:text-[#30D158] flex items-center justify-center font-bold text-xs shadow-sm">
                          {stu.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground group-hover:text-[#248A3D] dark:text-[#30D158] dark:group-hover:text-[#30D158] transition">
                            {stu.name}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            Adm: #{stu.admissionNumber} • {stu.className}
                            {stu.sectionName ? ` - ${stu.sectionName}` : ""}
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
                {hasMoreResults && (
                  <div className="p-2 text-center bg-muted/20">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={handleLoadMoreStudents}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#248A3D] dark:text-[#30D158] hover:bg-muted/40 transition disabled:opacity-50"
                    >
                      {loadingMore ? "Loading..." : "Load More Students"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Student Invoices Card */}
          {selectedStudent && (
            <div className="bg-card p-5 rounded-2xl border border-border/40 shadow-sm space-y-4">
              {/* Student Header & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#248A3D] text-white dark:bg-[#30D158] dark:text-black flex items-center justify-center font-bold text-sm shadow-sm">
                    {selectedStudent.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-foreground">
                        {selectedStudent.name}
                      </h3>
                      <button
                        type="button"
                        onClick={handleNextStudent}
                        className="text-[11px] text-[#248A3D] dark:text-[#30D158] hover:underline"
                        title="Change student"
                      >
                        (Change)
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      Admission: #{selectedStudent.admissionNumber} • Grade:{" "}
                      {selectedStudent.className}
                      {selectedStudent.sectionName ? ` - ${selectedStudent.sectionName}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {studentInvoices.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleSettleAll}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#248A3D]/10 dark:bg-[#30D158]/10 text-[#248A3D] dark:text-[#30D158] hover:opacity-90 transition"
                    >
                      {Object.keys(selectedItems).length === studentInvoices.length
                        ? "Deselect All"
                        : "Settle All Dues"}
                    </button>
                  )}
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                    {studentInvoices.length} Pending
                  </span>
                </div>
              </div>

              {/* Consolidated Financial Summary Strip */}
              {studentSummary && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                      <span className="text-[10px] text-muted-foreground uppercase block">
                        Billed
                      </span>
                      <span className="font-bold font-mono text-foreground">
                        ₹{studentSummary.totalBilled.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase block">
                        Paid
                      </span>
                      <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        ₹{studentSummary.totalPaid.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40">
                      <span className="text-[10px] text-blue-700 dark:text-blue-400 uppercase block">
                        Concessions
                      </span>
                      <span className="font-bold font-mono text-blue-600 dark:text-blue-400">
                        ₹{studentSummary.totalConcessions.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                      <span className="text-[10px] text-muted-foreground uppercase block">
                        Refunded
                      </span>
                      <span className="font-bold font-mono text-foreground">
                        ₹{studentSummary.totalRefunded.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase block">
                        Outstanding
                      </span>
                      <span className="font-bold font-mono text-amber-700 dark:text-amber-400">
                        ₹{studentSummary.totalOutstanding.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "p-2.5 rounded-xl border",
                        studentSummary.overdueAmount > 0
                          ? "bg-rose-50/60 dark:bg-rose-950/30 border-rose-300/60 dark:border-rose-800/50"
                          : "bg-muted/30 border-border/40",
                      )}
                    >
                      <span
                        className={cn(
                          "text-[10px] uppercase block",
                          studentSummary.overdueAmount > 0
                            ? "text-rose-700 dark:text-rose-400"
                            : "text-muted-foreground",
                        )}
                      >
                        Overdue
                      </span>
                      <span
                        className={cn(
                          "font-bold font-mono",
                          studentSummary.overdueAmount > 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-foreground",
                        )}
                      >
                        ₹{studentSummary.overdueAmount.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  {/* Active Concessions & Payment History Toggle */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {studentConcessions.map((c, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium"
                        >
                          {c.policy} ({c.status})
                        </span>
                      ))}
                      {studentSummary.creditBalance > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                          Advance Credit: ₹{studentSummary.creditBalance.toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>

                    {studentSummary.recentPayments.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowPaymentHistory((v) => !v)}
                        className="inline-flex items-center gap-1 font-semibold text-[#248A3D] dark:text-[#30D158] hover:underline"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>
                          {showPaymentHistory
                            ? "Hide Payment History"
                            : `Payment History (${studentSummary.recentPayments.length})`}
                        </span>
                      </button>
                    )}
                  </div>

                  {showPaymentHistory && studentSummary.recentPayments.length > 0 && (
                    <div className="rounded-xl border border-border/40 bg-muted/20 divide-y divide-border/40 max-h-44 overflow-y-auto text-xs">
                      {studentSummary.recentPayments.map((p) => (
                        <div
                          key={p.id}
                          className="px-3 py-2 flex items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-mono font-bold text-foreground">
                              {p.receiptGroupId || p.receiptNumber}
                            </span>
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {p.paymentMethod}
                            </span>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(p.paymentDate).toLocaleDateString("en-IN")}
                              {p.transactionReference ? ` • Ref: ${p.transactionReference}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{p.amountPaid.toLocaleString("en-IN")}
                            </span>
                            <a
                              href={`/api/receipt/${p.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              A4 PDF
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
                <div
                  className={cn(
                    "space-y-3",
                    studentInvoices.length > 50 && "max-h-[640px] overflow-y-auto pr-1"
                  )}
                >
                  {studentInvoices.map((inv) => {
                    const isSelected = !!selectedItems[inv.id];
                    const selectedItem = selectedItems[inv.id];

                    return (
                      <div
                        key={inv.id}
                        className={cn(
                          "p-4 rounded-2xl border transition-all space-y-3",
                          isSelected
                            ? "border-[#248A3D] dark:border-[#30D158] bg-[#248A3D]/5 dark:bg-[#30D158]/5 shadow-sm"
                            : "border-border/40 hover:border-gray-300"
                        )}
                      >
                        {/* Top row: Checkbox, Head, Invoice Number, Balance */}
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleInvoice(inv)}
                              className="mt-1 h-4 w-4 rounded text-[#248A3D] dark:text-[#30D158] focus:ring-[#248A3D] dark:focus:ring-[#30D158]"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground">
                                  {inv.feeHeadName}
                                </span>
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground">
                                  {inv.term}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">
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
                          <div className="pt-2 border-t border-border/40 grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs items-center">
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
                                    ? "bg-[#248A3D] dark:bg-[#30D158] text-white border-[#248A3D] dark:border-[#30D158]"
                                    : "bg-card text-muted-foreground border-border/40"
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
                                    ? "bg-[#248A3D] dark:bg-[#30D158] text-white border-[#248A3D] dark:border-[#30D158]"
                                    : "bg-card text-muted-foreground border-border/40"
                                )}
                              >
                                50%
                              </button>
                            </div>

                            {/* Paying Amount Input */}
                            <div className="sm:col-span-7 flex items-center justify-end gap-2">
                              <label className="text-[11px] font-semibold text-muted-foreground">
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
                                className="w-28 px-2.5 py-1.5 rounded-lg border border-border/40 bg-card text-sm font-bold font-mono text-emerald-600 text-right focus:ring-1 focus:ring-[#248A3D] dark:focus:ring-[#30D158]"
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
                                  className="w-16 px-1.5 py-0.5 rounded border border-border/40 bg-card text-xs text-right font-mono"
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
                                  className="w-16 px-1.5 py-0.5 rounded border border-border/40 bg-card text-xs text-right font-mono"
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
          <div className="bg-card p-5 rounded-3xl border border-border/40 shadow-sm sticky top-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#248A3D] dark:text-[#30D158]" />
                <h2 className="text-base font-bold text-foreground">
                  Payment Terminal
                </h2>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#248A3D]/10 dark:bg-[#30D158]/10 text-[#248A3D] dark:text-[#30D158] font-semibold">
                POS Ready
              </span>
            </div>

            {!selectedStudent ? (
              <div className="p-8 text-center text-gray-400 text-xs border border-dashed border-border/40 rounded-2xl space-y-2">
                <User className="w-8 h-8 mx-auto text-gray-300 dark:text-muted-foreground" />
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
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/40/80 space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
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
                  <div className="flex justify-between text-base font-bold text-foreground border-t border-border/40 pt-2">
                    <span>Payable Total:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono text-lg">
                      ₹{grandTotalPayable.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Payment Method Segmented Control */}
                <div>
                  <label className="block text-xs font-bold text-foreground uppercase mb-2">
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
                              ? "bg-[#248A3D] dark:bg-[#30D158] text-white border-[#248A3D] dark:border-[#30D158] shadow-sm"
                              : "bg-card text-muted-foreground border-border/40 hover:bg-muted/40"
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
                        className="w-32 px-2.5 py-1 text-sm font-mono font-bold text-right rounded-lg border border-emerald-300 dark:border-emerald-700 bg-card focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    {tenderedNum > 0 && (
                      <div className="flex justify-between text-xs font-bold pt-1 border-t border-emerald-200/60 dark:border-emerald-800/40">
                        <span className="text-emerald-800 dark:text-emerald-300">
                          {cashShortfall > 0 ? "Cash Shortfall:" : "Return Change to Parent:"}
                        </span>
                        <span
                          className={cn(
                            "font-mono",
                            cashShortfall > 0 ? "text-rose-600" : "text-emerald-600 font-bold"
                          )}
                        >
                          {cashShortfall > 0
                            ? `-₹${cashShortfall.toLocaleString("en-IN")}`
                            : `₹${changeDue.toLocaleString("en-IN")}`}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === "UPI" && upiQrUrl && (
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 text-center space-y-2">
                    <p className="text-xs font-semibold text-foreground">
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

                {/* Razorpay Online Counter Modal Trigger */}
                {paymentMethod === "ONLINE" && (
                  <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" /> Razorpay Gateway Integration
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#248A3D]/10 dark:bg-[#30D158]/10 text-[#248A3D] dark:text-[#30D158] border border-[#248A3D]/20 dark:border-[#30D158]/20">
                        Test Mode Ready
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Launch Razorpay Checkout to let parent or student pay via Credit/Debit Card, NetBanking, or Wallet directly at the counter.
                    </p>
                    <button
                      type="button"
                      disabled={grandTotalPayable <= 0 || isOpeningRzp}
                      onClick={handleLaunchRazorpayCounter}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#248A3D] dark:bg-[#30D158] hover:bg-muted/400 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>
                        {isOpeningRzp
                          ? "Connecting to Gateway..."
                          : `Launch Razorpay (₹${grandTotalPayable.toLocaleString("en-IN")})`}
                      </span>
                    </button>
                  </div>
                )}

                {/* Bank Account Selection (for Non-Cash) */}
                {paymentMethod !== "CASH" && (
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase mb-1">
                      Deposit Bank Account
                    </label>
                    <select
                      value={bankAccountId}
                      onChange={(e) => setBankAccountId(e.target.value)}
                      className="w-full px-3 py-2 text-xs md:text-sm font-medium rounded-xl border border-border/40 bg-card text-foreground focus:ring-2 focus:ring-[#248A3D] dark:focus:ring-[#30D158]/20 focus:border-[#248A3D] dark:focus:border-[#30D158]"
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
                    <label className="block text-xs font-bold text-foreground uppercase mb-1">
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
                      className="w-full px-3 py-2 text-sm rounded-xl border border-border/40 bg-card text-foreground focus:ring-2 focus:ring-[#248A3D] dark:focus:ring-[#30D158]/20 focus:border-[#248A3D] dark:focus:border-[#30D158]"
                    />
                  </div>
                )}

                {/* Remarks Input */}
                <div>
                  <label className="block text-xs font-bold text-foreground uppercase mb-1">
                    Receipt Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Paid in full for Term 1 & 2"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border/40 bg-card text-foreground focus:ring-2 focus:ring-[#248A3D] dark:focus:ring-[#30D158]/20 focus:border-[#248A3D] dark:focus:border-[#30D158]"
                  />
                </div>

                {/* Collect Button */}
                <button
                  type="submit"
                  disabled={submitting || grandTotalPayable <= 0}
                  className="w-full min-h-[48px] py-3.5 px-4 rounded-2xl bg-[#248A3D] hover:bg-[#1f7232] dark:bg-[#30D158] dark:hover:bg-[#28b84d] disabled:opacity-50 text-white dark:text-black font-bold text-sm transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
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
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
    </>
  );
}
