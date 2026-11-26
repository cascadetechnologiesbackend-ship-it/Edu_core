"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  Calendar,
  CreditCard,
  PieChart,
  Users,
  ChevronRight,
  ArrowUpRight,
  ExternalLink,
  Receipt,
  FileSpreadsheet,
  Lock,
  Unlock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDestructive } from "@/components/finance/ConfirmDestructive";
import { toggleAcademicYearFiscalLockAction } from "./actions";
import { MoneyKpi } from "@/components/finance/MoneyKpi";
import { AgingBadge, StatusBadge } from "@/components/finance/StatusBadge";
import { StudentLedgerDrawer } from "@/components/finance/StudentLedgerDrawer";
import { EmptyState } from "@/components/finance/EmptyState";
import { cn } from "@/lib/utils";

export interface DashboardKPIs {
  todayCollected: number;
  todayPaymentsCount: number;
  totalBilled: number;
  totalCollected: number;
  totalDues: number;
  recoveryRate: number;
  overdue60Plus: number;
}

export interface AgingSummary {
  current: number;
  days0to30: number;
  days31to60: number;
  days60plus: number;
}

export interface DefaulterItem {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  dueAmount: number;
  daysOverdue: number;
  invoiceCount: number;
}

export interface RecentPaymentItem {
  id: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
}

export interface ModeBreakdownItem {
  mode: string;
  amount: number;
  percentage: number;
}

export interface ClassStatItem {
  className: string;
  billed: number;
  collected: number;
  due: number;
  rate: number;
}

export interface AcademicYearItem {
  id: string;
  label: string;
  isActive: boolean;
  isLocked: boolean;
  startDate?: string;
  endDate?: string;
  lockReason?: string | null;
}

export interface FeesDashboardClientProps {
  academicYearsList: AcademicYearItem[];
  selectedAyId: string;
  userRole?: string;
  kpis: DashboardKPIs;
  aging: AgingSummary;
  topDefaulters: DefaulterItem[];
  recentPayments: RecentPaymentItem[];
  modeBreakdown: ModeBreakdownItem[];
  classStats: ClassStatItem[];
}

export function FeesDashboardClient({
  academicYearsList,
  selectedAyId,
  userRole,
  kpis,
  aging,
  topDefaulters,
  recentPayments,
  modeBreakdown,
  classStats,
}: FeesDashboardClientProps) {
  const router = useRouter();

  const [selectedStudentForDrawer, setSelectedStudentForDrawer] = useState<{
    studentId: string;
    studentName: string;
    admissionNumber: string;
    className: string;
  } | null>(null);

  const selectedAy =
    academicYearsList.find((ay) => ay.id === selectedAyId) || academicYearsList[0];

  const [fiscalLockModal, setFiscalLockModal] = useState<{
    isOpen: boolean;
    isLocked: boolean;
  }>({
    isOpen: false,
    isLocked: false,
  });
  const [isLockPending, setIsLockPending] = useState(false);

  // ACC-06: Dashboard Nudge for expired unlocked academic years
  const now = new Date();
  const daysSinceEnd =
    selectedAy?.endDate && new Date(selectedAy.endDate) < now && !selectedAy.isLocked
      ? Math.floor((now.getTime() - new Date(selectedAy.endDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

  const handleToggleLock = async (reason: string) => {
    if (!selectedAy) return;
    setIsLockPending(true);
    try {
      const targetLockState = !selectedAy.isLocked;
      const res = await toggleAcademicYearFiscalLockAction({
        academicYearId: selectedAy.id,
        isLocked: targetLockState,
        reason,
      });
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle fiscal lock.");
    } finally {
      setIsLockPending(false);
      setFiscalLockModal({ isOpen: false, isLocked: false });
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ayId = e.target.value;
    router.push(`/school/fees-dashboard?ayId=${encodeURIComponent(ayId)}` as any);
  };

  // Keyboard shortcut: Press 'C' to jump directly to Collect Fee POS Terminal (Spec 4.1.0 SCR-HUB)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === "c" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        )
      ) {
        e.preventDefault();
        router.push("/school/collect-fees");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <div className="space-y-8">
      {/* Session / Academic Year Selector Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border/40 shadow-level-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Active Scope
          </span>
          <select
            value={selectedAyId}
            onChange={handleYearChange}
            className="text-xs font-semibold bg-muted/40 hover:bg-muted/60 border border-border/60 text-foreground rounded-xl px-3 py-1.5 min-h-[40px] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            {academicYearsList.map((ay) => (
              <option key={ay.id} value={ay.id}>
                Session {ay.label} {ay.isLocked ? "🔒 [Locked]" : ay.isActive ? "(Current)" : ""}
              </option>
            ))}
          </select>

          {/* Lock Badge */}
          {selectedAy?.isLocked ? (
            <span
              title={`Locked on ${selectedAy.label}. Ledger mutations are strictly immutable.`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-semantic-money-owed/12 text-semantic-money-owed border border-semantic-money-owed/25"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
              <Lock className="w-3 h-3" /> Fiscal Locked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-semantic-money-in/12 text-semantic-money-in border border-semantic-money-in/25">
              <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
              <Unlock className="w-3 h-3" /> Fiscal Open
            </span>
          )}

          {/* SUPER_ADMIN Lock/Unlock Management Button (Hidden for ACCOUNTANT / PRINCIPAL) */}
          {userRole === "SUPER_ADMIN" && selectedAy && (
            <button
              onClick={() =>
                setFiscalLockModal({
                  isOpen: true,
                  isLocked: selectedAy.isLocked,
                })
              }
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1 ${
                selectedAy.isLocked
                  ? "bg-semantic-attention/12 text-semantic-attention border-semantic-attention/25 hover:bg-semantic-attention/20"
                  : "bg-semantic-money-owed/12 text-semantic-money-owed border-semantic-money-owed/25 hover:bg-semantic-money-owed/20"
              }`}
            >
              {selectedAy.isLocked ? (
                <>
                  <Unlock className="w-3 h-3" /> Unlock Fiscal Period
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3" /> Manage Fiscal Lock
                </>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-semantic-money-in animate-pulse" />
          Real-Time SQL Aggregated Telemetry
        </div>
      </div>

      {/* ACC-06: Dashboard Nudge for Expired Academic Year */}
      {daysSinceEnd > 0 && selectedAy && (
        <div className="p-4 rounded-2xl bg-semantic-attention/10 border border-semantic-attention/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-foreground text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-semantic-attention shrink-0" />
            <span>
              <strong>Fiscal Governance Nudge:</strong> Academic Year <strong>{selectedAy.label}</strong> ended <strong>{daysSinceEnd} days ago</strong>. Consider locking this period to ensure balance sheet and ledger immutability against backdated mutations.
            </span>
          </div>
          {userRole === "SUPER_ADMIN" && (
            <button
              onClick={() =>
                setFiscalLockModal({
                  isOpen: true,
                  isLocked: false,
                })
              }
              className="px-3 py-1.5 rounded-lg bg-semantic-attention text-white font-semibold hover:bg-semantic-attention/90 shrink-0 shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Lock className="w-3 h-3" /> Lock Academic Year
            </button>
          )}
        </div>
      )}

      {/* ConfirmDestructive Modal for Fiscal Lock/Unlock */}
      {selectedAy && (
        <ConfirmDestructive
          isOpen={fiscalLockModal.isOpen}
          onClose={() => setFiscalLockModal({ isOpen: false, isLocked: false })}
          title={
            selectedAy.isLocked
              ? `Unlock Academic Year ${selectedAy.label}`
              : `Lock Academic Year ${selectedAy.label}`
          }
          description={
            selectedAy.isLocked
              ? `Unlocking academic year ${selectedAy.label} temporarily permits backdated journal vouchers and transactions. A mandatory audit justification is required.`
              : `Locking academic year ${selectedAy.label} freezes the ledger. All backdated collections, cancellations, refunds, and journal entries will be strictly blocked (403).`
          }
          confirmLabel={
            selectedAy.isLocked ? "Unlock Period" : "Enforce Fiscal Lock"
          }
          requireReason={true}
          reasonPlaceholder="Mandatory fiscal governance justification (e.g. Annual Audit Complete)..."
          isPending={isLockPending}
          onConfirm={handleToggleLock}
        />
      )}

      {/* Band 1: Money KPIs (Every KPI is a Clickable Link to prefiltered worklists) */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Band 1: Core Financial Metrics & Quick Drills
          </h2>
          <span className="text-xs text-gray-400">Click any card to inspect underlying ledger</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MoneyKpi
            title="Today's Collections"
            amount={kpis.todayCollected}
            subtitle={`${kpis.todayPaymentsCount} receipts cleared today`}
            delta={{ value: "Live", label: "Cash & Bank", isPositive: true }}
            href="/school/transactions"
            variant="money_in"
          />

          <MoneyKpi
            title="Total Outstanding Dues"
            amount={kpis.totalDues}
            subtitle={`Uncollected fees in this session`}
            delta={{ value: `${kpis.recoveryRate}%`, label: "Recovery Rate", isPositive: false }}
            href={selectedAyId ? `/school/due-fees?ayId=${encodeURIComponent(selectedAyId)}` : "/school/due-fees"}
            variant="money_owed"
          />

          <MoneyKpi
            title="Critical Overdue (60+ Days)"
            amount={kpis.overdue60Plus}
            subtitle="Immediate follow-up required"
            delta={{ value: "Risk", label: "Default Warning", isPositive: false }}
            href={selectedAyId ? `/school/due-fees?bracket=60%2B&ayId=${encodeURIComponent(selectedAyId)}` : "/school/due-fees?bracket=60%2B"}
            variant="attention"
          />

          <MoneyKpi
            title="Gross Invoiced Demand"
            amount={kpis.totalBilled}
            subtitle={`₹${kpis.totalCollected.toLocaleString("en-IN")} collected`}
            delta={{ value: "Target", label: "Billed Total", isNeutral: true }}
            href="/school/fees-dashboard"
            variant="neutral"
          />

          {/* Slot 5: Collect Fee CTA Card (Spec 4.1.0 SCR-HUB) */}
          <Link
            href="/school/collect-fees"
            className="group relative flex flex-col justify-between p-5 rounded-3xl bg-semantic-interactive text-white shadow-level-1 hover:shadow-level-2 hover:scale-[1.01] transition-all duration-200 border border-semantic-interactive/40 min-h-[140px]"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white/80">
                  Quick Action
                </span>
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-white/20 text-[11px] font-mono font-bold text-white shadow-inner">
                  C
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mt-2 flex items-center gap-1.5">
                <CreditCard className="w-5 h-5 text-white/90" />
                Collect Fee
              </h3>
              <p className="text-xs text-white/80 mt-1">
                Open Counter POS terminal
              </p>
            </div>
            <div className="pt-2 flex items-center justify-between text-xs font-semibold text-white/90 group-hover:text-white">
              <span>Launch Terminal</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>

      {/* Band 2: Priority Work Lists & Aging Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aging Distribution Cards */}
        <div className="bg-card p-6 rounded-3xl border border-border/40 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/30">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Clock className="w-5 h-5 text-semantic-attention" />
                Receivables Aging Buckets
              </h3>
              <span className="text-xs text-muted-foreground font-mono">FIFO Dues</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Breakdown of pending balances categorized by due date elapsed.
            </p>
          </div>

          <div className="space-y-3.5 my-2">
            <Link
              href={(selectedAyId ? `/school/due-fees?ayId=${encodeURIComponent(selectedAyId)}` : "/school/due-fees") as any}
              className="flex items-center justify-between p-3 rounded-2xl bg-semantic-money-in/8 border border-semantic-money-in/20 hover:scale-[1.01] transition"
            >
              <div>
                <p className="text-xs font-semibold text-semantic-money-in">
                  Current (Not Due)
                </p>
                <p className="text-xs text-muted-foreground">Grace / Early Window</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold font-mono tabular-nums text-semantic-money-in">
                  ₹{aging.current.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </Link>

            <Link
              href={(selectedAyId ? `/school/due-fees?bracket=0-30&ayId=${encodeURIComponent(selectedAyId)}` : "/school/due-fees?bracket=0-30") as any}
              className="flex items-center justify-between p-3 rounded-2xl bg-semantic-attention/8 border border-semantic-attention/20 hover:scale-[1.01] transition"
            >
              <div>
                <p className="text-xs font-semibold text-semantic-attention">
                  1 - 30 Days Overdue
                </p>
                <p className="text-xs text-muted-foreground">First Warning Bracket</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold font-mono tabular-nums text-semantic-attention">
                  ₹{aging.days0to30.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </Link>

            <Link
              href={(selectedAyId ? `/school/due-fees?bracket=31-60&ayId=${encodeURIComponent(selectedAyId)}` : "/school/due-fees?bracket=31-60") as any}
              className="flex items-center justify-between p-3 rounded-2xl bg-semantic-attention/12 border border-semantic-attention/25 hover:scale-[1.01] transition"
            >
              <div>
                <p className="text-xs font-semibold text-semantic-attention">
                  31 - 60 Days Overdue
                </p>
                <p className="text-xs text-muted-foreground">Escalated Reminders</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold font-mono tabular-nums text-semantic-attention">
                  ₹{aging.days31to60.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </Link>

            <Link
              href={(selectedAyId ? `/school/due-fees?bracket=60%2B&ayId=${encodeURIComponent(selectedAyId)}` : "/school/due-fees?bracket=60%2B") as any}
              className="flex items-center justify-between p-3 rounded-2xl bg-semantic-money-owed/10 border border-semantic-money-owed/25 hover:scale-[1.01] transition"
            >
              <div>
                <p className="text-xs font-bold text-semantic-money-owed">
                  60+ Days Overdue (Critical)
                </p>
                <p className="text-xs text-muted-foreground">Formal Challan & Hold</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold font-mono tabular-nums text-semantic-money-owed">
                  ₹{aging.days60plus.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </Link>
          </div>

          <Link
            href="/school/due-fees"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold rounded-xl bg-muted hover:bg-muted/80 text-foreground transition"
          >
            Open Complete Due Ledger <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Top-10 Defaulters Work List */}
        <div className="lg:col-span-2 bg-card rounded-3xl border border-border/40 shadow-xs overflow-hidden flex flex-col justify-between">
          <div className="p-6 border-b border-border/30 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-semantic-money-owed" />
                Top Priority Defaulter Work List
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Highest balance receivables requiring urgent follow-up or cashier collection.
              </p>
            </div>
            <Link
              href="/school/due-fees"
              className="text-xs font-semibold text-semantic-interactive hover:underline flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border/40 text-muted-foreground uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4 text-center">Aging</th>
                  <th className="py-3 px-4 text-right">Outstanding (₹)</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {topDefaulters.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No overdue balances recorded for this academic year!
                    </td>
                  </tr>
                ) : (
                  topDefaulters.map((item) => (
                    <tr
                      key={item.studentId}
                      className="hover:bg-muted/30 transition"
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedStudentForDrawer({
                              studentId: item.studentId,
                              studentName: item.studentName,
                              admissionNumber: item.admissionNumber,
                              className: item.className,
                            })
                          }
                          className="font-bold text-foreground hover:text-semantic-interactive text-left transition"
                        >
                          {item.studentName}
                        </button>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          Adm #{item.admissionNumber}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground/80">
                        {item.className}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <AgingBadge daysOverdue={item.daysOverdue} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-semantic-money-owed">
                        ₹{item.dueAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/school/collect-fees` as any}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-semantic-interactive hover:bg-semantic-interactive/90 text-white font-semibold text-[11px] shadow-xs transition active:scale-95"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Collect
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (UX-R47) */}
          <div className="block md:hidden divide-y divide-border/30 p-3 space-y-3">
            {topDefaulters.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No overdue balances recorded for this academic year!
              </p>
            ) : (
              topDefaulters.map((item) => (
                <div
                  key={item.studentId}
                  className="pt-3 first:pt-0 flex flex-col gap-2.5 bg-muted/30 p-3.5 rounded-2xl border border-border/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedStudentForDrawer({
                          studentId: item.studentId,
                          studentName: item.studentName,
                          admissionNumber: item.admissionNumber,
                          className: item.className,
                        })
                      }
                      className="text-left font-bold text-sm text-foreground hover:text-semantic-interactive transition"
                    >
                      {item.studentName}
                      <span className="block text-[11px] font-normal text-muted-foreground font-mono mt-0.5">
                        Adm #{item.admissionNumber} • {item.className}
                      </span>
                    </button>
                    <AgingBadge daysOverdue={item.daysOverdue} />
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/30">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                        Outstanding
                      </span>
                      <span className="font-mono tabular-nums font-bold text-base text-semantic-money-owed">
                        ₹{item.dueAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <Link
                      href={`/school/collect-fees` as any}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-semantic-interactive hover:bg-semantic-interactive/90 text-white font-bold text-xs shadow-xs transition active:scale-95"
                    >
                      <CreditCard className="w-4 h-4" /> Collect Fee
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Band 3: Recent Activity Stream & Payment Mode Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Mode Volume Card */}
        <div className="bg-card p-6 rounded-3xl border border-border/40 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/30">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <PieChart className="w-5 h-5 text-semantic-interactive" />
              Tender Mode Volume
            </h3>
            <span className="text-xs text-muted-foreground font-mono">Collections</span>
          </div>

          <div className="space-y-4">
            {modeBreakdown.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No active payment collections recorded for this session.
              </p>
            ) : (
              modeBreakdown.map((item) => (
                <div key={item.mode} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-foreground/80">
                      {item.mode}
                    </span>
                    <span className="font-mono tabular-nums text-foreground font-bold">
                      ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-2.5 rounded-full transition-all duration-500 bg-semantic-interactive"
                      style={{ width: `${Math.max(2, item.percentage)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Collections Stream */}
        <div className="lg:col-span-2 bg-card rounded-3xl border border-border/40 shadow-xs overflow-hidden flex flex-col justify-between">
          <div className="p-6 border-b border-border/30 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Receipt className="w-5 h-5 text-semantic-money-in" />
                Live Fee Collections Activity Stream
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Last 10 fee collection payments recorded across counter, UPI, and bank transfers.
              </p>
            </div>
            <Link
              href="/school/transactions"
              className="text-xs font-semibold text-semantic-interactive hover:underline flex items-center gap-1"
            >
              Open Day Book <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border/40 text-muted-foreground uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No payments processed yet for this academic year.
                    </td>
                  </tr>
                ) : (
                  recentPayments.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-muted/30 transition"
                    >
                      <td className="py-3 px-4 font-mono tabular-nums font-bold text-semantic-interactive">
                        <a
                          href={`/api/receipt/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:underline"
                          title="Download Receipt PDF"
                        >
                          #{p.receiptNumber}
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </a>
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {p.studentName}
                        <span className="block text-[11px] text-muted-foreground font-mono">
                          Adm #{p.admissionNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={p.paymentMethod} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-semantic-money-in">
                        ₹{p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        {new Date(p.paymentDate).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (UX-R47) */}
          <div className="block md:hidden divide-y divide-border/30 p-3 space-y-2.5">
            {recentPayments.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No payments processed yet for this academic year.
              </p>
            ) : (
              recentPayments.map((p) => (
                <div
                  key={p.id}
                  className="pt-2.5 first:pt-0 flex flex-col gap-2 bg-muted/30 p-3 rounded-2xl border border-border/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono tabular-nums font-bold text-xs text-semantic-interactive">
                      #{p.receiptNumber}
                    </span>
                    <StatusBadge status={p.paymentMethod} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-xs text-foreground">
                        {p.studentName}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        Adm #{p.admissionNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono tabular-nums font-bold text-sm text-semantic-money-in block">
                        ₹{p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(p.paymentDate).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Class-wise Recovery Table */}
      <div className="bg-card rounded-3xl border border-border/40 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-border/30">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-semantic-interactive" />
            Division Collection Velocity
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Aggregated class-wise billed demand versus actual collections received.
          </p>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border/40 text-muted-foreground uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4 text-right">Invoiced (₹)</th>
                <th className="py-3 px-4 text-right">Collected (₹)</th>
                <th className="py-3 px-4 text-right">Outstanding (₹)</th>
                <th className="py-3 px-4 text-center">Recovery %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {classStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No class invoice structures assigned for this session.
                  </td>
                </tr>
              ) : (
                classStats.map((stat, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="py-3 px-4 font-bold text-foreground">
                      {stat.className}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-muted-foreground">
                      ₹{stat.billed.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-semantic-money-in font-semibold">
                      ₹{stat.collected.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-semantic-money-owed font-semibold">
                      ₹{stat.due.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={cn(
                          "inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border",
                          stat.rate >= 80
                            ? "bg-semantic-money-in/12 text-semantic-money-in border-semantic-money-in/25"
                            : stat.rate >= 50
                            ? "bg-semantic-attention/12 text-semantic-attention border-semantic-attention/25"
                            : "bg-semantic-money-owed/12 text-semantic-money-owed border-semantic-money-owed/25"
                        )}
                      >
                        {stat.rate}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View (UX-R47) */}
        <div className="block md:hidden divide-y divide-border/30 p-3 space-y-2.5">
          {classStats.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No class invoice structures assigned for this session.
            </p>
          ) : (
            classStats.map((stat, i) => (
              <div
                key={i}
                className="pt-2.5 first:pt-0 bg-muted/30 p-3.5 rounded-2xl border border-border/40 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">
                    {stat.className}
                  </span>
                  <span
                    className={cn(
                      "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border",
                      stat.rate >= 80
                        ? "bg-semantic-money-in/12 text-semantic-money-in border-semantic-money-in/25"
                        : stat.rate >= 50
                        ? "bg-semantic-attention/12 text-semantic-attention border-semantic-attention/25"
                        : "bg-semantic-money-owed/12 text-semantic-money-owed border-semantic-money-owed/25"
                    )}
                  >
                    {stat.rate}% Recovery
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/30 text-center">
                  <div className="bg-card p-2 rounded-xl border border-border/40">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                      Invoiced
                    </span>
                    <span className="font-mono tabular-nums font-bold text-xs text-foreground">
                      ₹{stat.billed.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="bg-card p-2 rounded-xl border border-border/40">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-semantic-money-in block">
                      Collected
                    </span>
                    <span className="font-mono tabular-nums font-bold text-xs text-semantic-money-in">
                      ₹{stat.collected.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="bg-card p-2 rounded-xl border border-border/40">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-semantic-money-owed block">
                      Due
                    </span>
                    <span className="font-mono tabular-nums font-bold text-xs text-semantic-money-owed">
                      ₹{stat.due.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Slide-over Student Fee Ledger Drawer */}
      {selectedStudentForDrawer && (
        <StudentLedgerDrawer
          open={!!selectedStudentForDrawer}
          onOpenChange={(open) => !open && setSelectedStudentForDrawer(null)}
          studentId={selectedStudentForDrawer.studentId}
          studentName={selectedStudentForDrawer.studentName}
          admissionNumber={selectedStudentForDrawer.admissionNumber}
          className={selectedStudentForDrawer.className}
        />
      )}
    </div>
  );
}
