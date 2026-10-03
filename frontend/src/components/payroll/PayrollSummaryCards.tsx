"use client";

import { Banknote, ShieldCheck, CreditCard, PieChart, Play, CheckCircle2, AlertCircle } from "lucide-react";

export interface PayrollSummaryMetrics {
  monthLabel: string; // e.g. "June 2026"
  status: "NOT_TRIGGERED" | "DRAFT" | "PROCESSED" | "APPROVED" | "PAID";
  totalEmployees: number;
  totalGrossOutflow: number;
  totalPfCollections: number;
  totalEsiCollections: number;
  totalNetDisbursed: number;
}

interface PayrollSummaryCardsProps {
  metrics: PayrollSummaryMetrics;
  onProcessPayroll?: () => void;
  onDownloadEcr?: () => void;
}

export function PayrollSummaryCards({
  metrics,
  onProcessPayroll,
  onDownloadEcr,
}: PayrollSummaryCardsProps) {
  const isProcessed = metrics.status === "PROCESSED" || metrics.status === "APPROVED" || metrics.status === "PAID";

  return (
    <div className="space-y-6">
      {/* ── Direct Visibility Status Banner ────────────────────────────────── */}
      <div className={`rounded-2xl border p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition shadow-md ${
        isProcessed
          ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-100"
          : "bg-blue-950/40 border-blue-500/40 text-blue-100"
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            isProcessed ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"
          }`}>
            {isProcessed ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                isProcessed
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              }`}>
                {isProcessed ? "Payroll Finalized" : "Payroll Pending"}
              </span>
              <span className="text-xs text-slate-400">• {metrics.totalEmployees} Active Staff</span>
            </div>
            <h2 className="text-xl font-bold mt-1 text-white">
              {isProcessed
                ? `Monthly Payroll Disbursed for ${metrics.monthLabel}`
                : `Payroll Not Triggered for ${metrics.monthLabel}`}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onDownloadEcr && isProcessed && (
            <button
              onClick={onDownloadEcr}
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Export EPFO ECR Text
            </button>
          )}

          {onProcessPayroll && (
            <button
              onClick={onProcessPayroll}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" /> {isProcessed ? "Recalculate Payroll" : "Run Monthly Payroll Now"}
            </button>
          )}
        </div>
      </div>

      {/* ── High Contrast Scannable Financial Data Cards ──────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Gross Outflow */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Gross Outflow</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-white tracking-tight">
              ₹{metrics.totalGrossOutflow.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Pre-deduction baseline salary</div>
          </div>
        </div>

        {/* Card 2: Total PF Collections */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">PF Collections (12%)</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-indigo-400 tracking-tight">
              ₹{metrics.totalPfCollections.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Employee + Employer EPF/EPS</div>
          </div>
        </div>

        {/* Card 3: Total ESI Contributions */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ESI Health Fund</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-purple-400 tracking-tight">
              ₹{metrics.totalEsiCollections.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">0.75% Employee + 3.25% Employer</div>
          </div>
        </div>

        {/* Card 4: Total Net Disbursed */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Net Disbursed</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-400 tracking-tight">
              ₹{metrics.totalNetDisbursed.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-1">Net bank transfer payload</div>
          </div>
        </div>
      </div>
    </div>
  );
}
