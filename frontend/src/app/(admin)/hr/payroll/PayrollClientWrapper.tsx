"use client";

import { useState } from "react";
import { PayrollSummaryCards } from "@/components/payroll/PayrollSummaryCards";
import { PayrollDataTable } from "@/components/payroll/PayrollDataTable";
import { SalaryTemplateModal } from "@/components/payroll/SalaryTemplateModal";
import { ProcessedPayrollRecord, SalaryTemplateConfig } from "@/lib/payrollEngine";
import { Sliders, Download, CheckCircle2, FileText, X } from "lucide-react";

interface PayrollClientWrapperProps {
  initialRecords: ProcessedPayrollRecord[];
  templates: (SalaryTemplateConfig & { id: string; name: string })[];
  monthLabel: string;
}

export function PayrollClientWrapper({
  initialRecords,
  templates,
  monthLabel,
}: PayrollClientWrapperProps) {
  const [records, setRecords] = useState<ProcessedPayrollRecord[]>(initialRecords);
  const [templateList, setTemplateList] = useState(templates);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<ProcessedPayrollRecord | null>(null);

  // Compute Aggregates for Top Metric Cards
  const totalGrossOutflow = records.reduce((acc, r) => acc + r.grossSalary, 0);
  const totalPfCollections = records.reduce(
    (acc, r) => acc + r.statutory.employeePF + r.statutory.totalEmployerPF,
    0
  );
  const totalEsiCollections = records.reduce(
    (acc, r) => acc + r.statutory.employeeESI + r.statutory.employerESI,
    0
  );
  const totalNetDisbursed = records.reduce((acc, r) => acc + r.netPay, 0);

  const metrics = {
    monthLabel,
    status: "PROCESSED" as const,
    totalEmployees: records.length,
    totalGrossOutflow,
    totalPfCollections,
    totalEsiCollections,
    totalNetDisbursed,
  };

  const handleDownloadEcrText = () => {
    // Generate EPFO ECR # Format Text File
    const lines = records.map((r, idx) => {
      const uan = `100987${(idx + 1).toString().padStart(6, "0")}`;
      const empName = r.staffName.toUpperCase();
      const gross = r.grossSalary;
      const epfWages = r.statutory.pfCappedWageBase;
      const epsWages = r.statutory.pfCappedWageBase;
      const edliWages = r.statutory.pfCappedWageBase;
      const eeShare = r.statutory.employeePF;
      const epsShare = r.statutory.employerEPS;
      const erShare = r.statutory.employerEPF;
      const ncpDays = r.lwpDays;
      const refund = 0;

      return `${uan}#~#${empName}#~#${gross}#~#${epfWages}#~#${epsWages}#~#${edliWages}#~#${eeShare}#~#${epsShare}#~#${erShare}#~#${ncpDays}#~#${refund}`;
    });

    const header = `# EPFO ECR TEXT FILE FORMAT - ${monthLabel}\n# UAN#~#MEMBER_NAME#~#GROSS_WAGES#~#EPF_WAGES#~#EPS_WAGES#~#EDLI_WAGES#~#EE_SHARE_12#~#EPS_SHARE_8_33#~#ER_SHARE_3_67#~#NCP_DAYS#~#REFUND\n`;
    const textContent = header + lines.join("\n");

    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `EPFO_ECR_${monthLabel.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* ── Action Header Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white">Monthly Payroll Run & Salary Templates</h1>
          <p className="text-xs text-slate-400 mt-1">
            Indian Statutory Compliance Engine (PF, ESI, PT), Loss-Of-Pay deductions, and Loan EMI recovery.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition flex items-center gap-2"
          >
            <Sliders className="w-4 h-4 text-blue-400" /> Manage Salary Templates ({templateList.length})
          </button>

          <button
            onClick={handleDownloadEcrText}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Download EPFO ECR Text File
          </button>
        </div>
      </div>

      {/* ── Direct Status & Financial Metric Summary Cards ───────────────── */}
      <PayrollSummaryCards
        metrics={metrics}
        onDownloadEcr={handleDownloadEcrText}
      />

      {/* ── Employee Payroll Line Items Data Grid ────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Staff Payroll Directory ({records.length})</h3>
          <span className="text-xs text-slate-400">Showing active calculated salaries for {monthLabel}</span>
        </div>

        <PayrollDataTable
          records={records}
          onViewPayslip={(record) => setSelectedPayslip(record)}
        />
      </div>

      {/* ── Salary Template Modal ────────────────────────────────────────── */}
      <SalaryTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSave={(tpl) => {
          setTemplateList([...templateList, { ...tpl, id: `tpl_${Date.now()}` }]);
        }}
      />

      {/* ── Payslip View Modal ───────────────────────────────────────────── */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="text-lg font-bold text-white">Salary Slip Breakdown</h3>
                  <p className="text-xs text-slate-400">{selectedPayslip.staffName} ({selectedPayslip.employeeCode})</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPayslip(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-slate-400">Gross Salary:</span>
                  <div className="text-sm font-bold text-white">₹{selectedPayslip.grossSalary.toLocaleString("en-IN")}</div>
                </div>
                <div>
                  <span className="text-slate-400">Effective Gross (post-LWP):</span>
                  <div className="text-sm font-bold text-amber-400">₹{selectedPayslip.effectiveGross.toLocaleString("en-IN")}</div>
                </div>
              </div>

              <div className="space-y-1.5 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="font-bold text-slate-300 pb-1 border-b border-slate-800">Earnings Components</div>
                <div className="flex justify-between text-slate-400"><span>Basic Salary (50%):</span> <span className="text-white">₹{selectedPayslip.basicSalary.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between text-slate-400"><span>Dearness Allowance DA (10%):</span> <span className="text-white">₹{selectedPayslip.daAmount.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between text-slate-400"><span>House Rent Allowance HRA (20%):</span> <span className="text-white">₹{selectedPayslip.hraAmount.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between text-slate-400"><span>Special Allowance (20%):</span> <span className="text-white">₹{selectedPayslip.specialAllowance.toLocaleString("en-IN")}</span></div>
              </div>

              <div className="space-y-1.5 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="font-bold text-slate-300 pb-1 border-b border-slate-800">Deductions Breakdown</div>
                <div className="flex justify-between text-slate-400"><span>LWP Deduction ({selectedPayslip.lwpDays} days):</span> <span className="text-amber-400">-₹{selectedPayslip.lwpDeduction.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between text-slate-400"><span>Employee PF (12%):</span> <span className="text-red-400">-₹{selectedPayslip.statutory.employeePF.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between text-slate-400"><span>Employee ESI (0.75%):</span> <span className="text-red-400">-₹{selectedPayslip.statutory.employeeESI.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between text-slate-400"><span>Professional Tax (PT):</span> <span className="text-red-400">-₹{selectedPayslip.statutory.professionalTax}</span></div>
                {selectedPayslip.loanEmiDeduction > 0 && (
                  <div className="flex justify-between text-slate-400"><span>Staff Loan EMI:</span> <span className="text-red-400">-₹{selectedPayslip.loanEmiDeduction.toLocaleString("en-IN")}</span></div>
                )}
                <div className="flex justify-between font-bold text-red-400 pt-1 border-t border-slate-800"><span>Total Deductions:</span> <span>-₹{selectedPayslip.totalDeductions.toLocaleString("en-IN")}</span></div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">NET DISBURSED SALARY</div>
                  <div className="text-xl font-black text-white">₹{selectedPayslip.netPay.toLocaleString("en-IN")}</div>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
