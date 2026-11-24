"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  Calendar,
  Lock,
  PlusCircle,
  FileCheck,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Download,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { AppModal } from "@/components/ui/AppModal";
import { Combobox, type ComboboxOption } from "@/components/forms/Combobox";
import {
  runPayrollForMonth,
  approveAndLockPayroll,
  createStaffLoan,
} from "../actions";

interface PayrollTabProps {
  payrollRuns: any[];
  staffList: any[];
  isAuthorizedHR: boolean;
  isAuthorizedLock: boolean;
  onRefresh?: () => void;
}

export function PayrollTab({
  payrollRuns,
  staffList,
  isAuthorizedHR,
  isAuthorizedLock,
  onRefresh,
}: PayrollTabProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Month selector for run
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [payrollMonth, setPayrollMonth] = useState(currentMonthStr);

  // Modal states
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [lockTargetId, setLockTargetId] = useState<string | null>(null);

  // Loan Form State
  const [loanForm, setLoanForm] = useState({
    staffId: "",
    principalAmount: 20000,
    emiAmount: 2000,
  });

  // Staff Combobox Options
  const staffOptions: ComboboxOption[] = React.useMemo(() => {
    return staffList.map((s) => ({
      value: s.id,
      label: `${s.firstName} ${s.lastName}`,
      subLabel: `${s.employeeCode || "No Code"} • ${s.designation?.name || "Staff"}`,
      searchTerms: [s.employeeCode || "", s.department?.name || ""],
    }));
  }, [staffList]);

  const handleRunPayroll = async () => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(payrollMonth)) {
      toast.error("Please enter a valid month in YYYY-MM format (e.g. 2026-10)");
      return;
    }
    setLoading(true);
    const res = await runPayrollForMonth(payrollMonth);
    setLoading(false);
    if (res.success) {
      toast.success(`Payroll draft generated for ${payrollMonth}!`);
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || "Failed to trigger payroll run");
    }
  };

  const handleLockPayroll = async () => {
    if (!lockTargetId) return;
    setLoading(true);
    const res = await approveAndLockPayroll(lockTargetId);
    setLoading(false);
    if (res.success) {
      toast.success("Payroll successfully approved and locked! Loan EMIs deducted and ledger synced.");
      setLockTargetId(null);
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || "Failed to lock payroll");
    }
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.staffId) {
      toast.error("Please select a staff member");
      return;
    }
    if (loanForm.emiAmount > loanForm.principalAmount) {
      toast.error("Monthly EMI cannot exceed principal amount");
      return;
    }
    setLoading(true);
    const res = await createStaffLoan({
      staffId: loanForm.staffId,
      principalAmount: Number(loanForm.principalAmount),
      emiAmount: Number(loanForm.emiAmount),
    });
    setLoading(false);
    if (res.success) {
      toast.success("Staff loan recorded! Monthly EMI will deduct automatically during payroll runs.");
      setIsLoanModalOpen(false);
      setLoanForm({
        staffId: "",
        principalAmount: 20000,
        emiAmount: 2000,
      });
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || "Failed to record loan");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Quick Loan Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground dark:text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#B45309] dark:text-[#FFD60A]" />
            Payroll & Statutory Disbursals
          </h2>
          <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">
            Automate monthly salary runs, statutory deductions (PF, ESI, PT), and staff loan EMIs
          </p>
        </div>

        {isAuthorizedHR && (
          <button
            type="button"
            onClick={() => setIsLoanModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-card border border-border/40 dark:border-border/40 text-muted-foreground dark:text-foreground hover:bg-muted/30 dark:hover:bg-muted/60 shadow-sm transition-colors min-h-[40px] shrink-0"
          >
            <CreditCard className="w-4 h-4 text-[#B45309] dark:text-[#FFD60A]" />
            <span>Record Staff Loan / Advance</span>
          </button>
        )}
      </div>

      {/* Monthly Payroll Processing Card - Apple Warm Amber */}
      <div className="relative overflow-hidden rounded-3xl bg-card border border-amber-500/25 p-6 sm:p-7 shadow-xs">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
              <Calendar className="w-3.5 h-3.5" />
              <span>Monthly Salary Execution Engine</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-foreground">
              Process & Draft Monthly Payroll
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Calculates Base, DA, HRA components, applies EPFO (12%) & ESIC rules, evaluates state-wise Professional Tax slabs, auto-deducts staff loan EMIs, and logs complete audit records.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-muted/40 p-2.5 rounded-2xl border border-border/40 shrink-0">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground px-2 block">
                Target Month
              </span>
              <input
                type="text"
                placeholder="YYYY-MM (e.g. 2026-10)"
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(e.target.value)}
                className="bg-card border border-border/60 px-3 py-2 rounded-xl text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500 w-full sm:w-44"
              />
            </div>
            {isAuthorizedHR && (
              <button
                type="button"
                disabled={loading}
                onClick={handleRunPayroll}
                className="self-end sm:self-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-[#B45309] dark:bg-[#FFD60A] text-white dark:text-black hover:opacity-90 shadow-xs transition-all min-h-[44px] disabled:opacity-50 shrink-0"
              >
                {loading ? "Processing..." : "Trigger Draft Run"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Previous Payroll Runs Table */}
      <div className="bg-white dark:bg-card border border-border/40 dark:border-border/40 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-border/40 dark:border-border/40 bg-muted/20 dark:bg-muted/30 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-foreground dark:text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>Historical Payroll Batches</span>
            </h3>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">
              Review draft cycles, finalize manager sign-offs, and inspect disbursement totals
            </p>
          </div>
        </div>

        {payrollRuns.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Calendar className="w-10 h-10 text-muted-foreground dark:text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold text-muted-foreground dark:text-muted-foreground">
              No payroll runs executed yet
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Select a target month above and trigger a draft run to compute monthly salary statements.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40 dark:divide-border/40">
            {payrollRuns.map((pr) => {
              const isLocked = pr.status === "APPROVED";

              return (
                <div
                  key={pr.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/20 dark:hover:bg-muted/40 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-base text-foreground dark:text-white">
                        {pr.month}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase ${
                          isLocked
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                      >
                        {pr.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground dark:text-muted-foreground">
                      <div>
                        Gross Total:{" "}
                        <strong className="text-foreground dark:text-foreground">
                          ₹{Number(pr.totalGross || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </strong>
                      </div>
                      <span>•</span>
                      <div>
                        Deductions:{" "}
                        <strong className="text-rose-600 dark:text-rose-400">
                          ₹{Number(pr.totalDeductions || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </strong>
                      </div>
                      <span>•</span>
                      <div>
                        Net Disbursed:{" "}
                        <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                          ₹{Number(pr.totalNetPay || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    {!isLocked && isAuthorizedLock && (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => setLockTargetId(pr.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#B45309] dark:bg-[#FFD60A] text-white dark:text-black hover:opacity-90 shadow-xs transition-colors min-h-[44px]"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Lock Payroll & Deduct Loans</span>
                      </button>
                    )}

                    {isLocked && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted/50 dark:bg-muted/60 text-muted-foreground dark:text-muted-foreground">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Locked & Audited</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Record Staff Loan */}
      <AppModal
        open={isLoanModalOpen}
        onClose={() => setIsLoanModalOpen(false)}
        title="Record Staff Loan / Salary Advance"
      >
        <form onSubmit={handleCreateLoan} className="space-y-4 text-xs">
          {/* Staff Combobox */}
          <div className="space-y-1">
            <label className="font-semibold text-muted-foreground dark:text-muted-foreground">
              Staff Member *
            </label>
            <Combobox
              options={staffOptions}
              value={loanForm.staffId}
              onChange={(val) => setLoanForm({ ...loanForm, staffId: val })}
              placeholder="Search faculty / staff by name or code..."
              searchPlaceholder="Type name or code..."
              disabled={loading}
              isHindi={false}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground dark:text-muted-foreground">
                Principal Loan Amount (₹) *
              </label>
              <input
                type="number"
                min="1000"
                step="500"
                required
                value={loanForm.principalAmount}
                onChange={(e) =>
                  setLoanForm({
                    ...loanForm,
                    principalAmount: Number(e.target.value),
                  })
                }
                className="w-full border border-border/40 dark:border-border/40 bg-muted/30 dark:bg-card p-2.5 rounded-xl text-xs text-foreground dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground dark:text-muted-foreground">
                Monthly EMI Deduction (₹) *
              </label>
              <input
                type="number"
                min="500"
                step="250"
                required
                value={loanForm.emiAmount}
                onChange={(e) =>
                  setLoanForm({
                    ...loanForm,
                    emiAmount: Number(e.target.value),
                  })
                }
                className="w-full border border-border/40 dark:border-border/40 bg-muted/30 dark:bg-card p-2.5 rounded-xl text-xs text-foreground dark:text-white"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/40 text-amber-850 dark:text-amber-200">
            <p className="font-semibold text-[11px] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Automated Recovery Policy</span>
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
              The specified monthly EMI (₹{loanForm.emiAmount}) will be deducted automatically each month when the Principal locks the payroll, until the total principal (₹{loanForm.principalAmount}) reaches zero.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/40 dark:border-border/40">
            <button
              type="button"
              onClick={() => setIsLoanModalOpen(false)}
              className="px-4 py-2 text-xs rounded-xl border border-border/40 dark:border-border/40 text-muted-foreground dark:text-muted-foreground hover:bg-muted/30 dark:hover:bg-muted/60 min-h-[38px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-[#B45309] dark:bg-[#FFD60A] text-white dark:text-black hover:opacity-90 shadow-xs transition-colors min-h-[44px] disabled:opacity-50"
            >
              {loading ? "Recording..." : "Record Staff Loan"}
            </button>
          </div>
        </form>
      </AppModal>

      {/* Modal: Confirm Lock Payroll */}
      <AppModal
        open={Boolean(lockTargetId)}
        onClose={() => setLockTargetId(null)}
        title="Approve & Lock Monthly Payroll"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-foreground">
            <p className="font-semibold">
              Principal Executive Sign-Off
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Approving and locking this payroll batch will update staff outstanding loan balances, generate final audit records, and disburse statutory notifications. This action is irreversible.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/40 dark:border-border/40">
            <button
              type="button"
              onClick={() => setLockTargetId(null)}
              className="px-4 py-2 text-xs rounded-xl border border-border/40 dark:border-border/40 text-muted-foreground dark:text-muted-foreground hover:bg-muted/30 dark:hover:bg-muted/60 min-h-[38px]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleLockPayroll}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-[#B45309] dark:bg-[#FFD60A] text-white dark:text-black hover:opacity-90 shadow-xs transition-colors min-h-[44px] disabled:opacity-50"
            >
              {loading ? "Approving..." : "Confirm & Lock Batch"}
            </button>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
