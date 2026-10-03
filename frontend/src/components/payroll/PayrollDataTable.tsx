"use client";

import { useState } from "react";
import { ProcessedPayrollRecord } from "@/lib/payrollEngine";
import {
  Search,
  Filter,
  AlertCircle,
  CreditCard,
  FileText,
  Building2,
  Users,
  CheckCircle2,
} from "lucide-react";

interface PayrollDataTableProps {
  records: ProcessedPayrollRecord[];
  onViewPayslip?: (record: ProcessedPayrollRecord) => void;
  onEditPayrollRow?: (record: ProcessedPayrollRecord) => void;
}

export function PayrollDataTable({
  records,
  onViewPayslip,
  onEditPayrollRow,
}: PayrollDataTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("ALL");
  const [filterLwpOnly, setFilterLwpOnly] = useState(false);

  // Extract unique departments for filter dropdown
  const departments = Array.from(
    new Set(records.map((r) => r.departmentName).filter(Boolean))
  );

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.designationName && r.designationName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesDept =
      selectedDeptFilter === "ALL" || r.departmentName === selectedDeptFilter;

    const matchesLwp = !filterLwpOnly || r.lwpDays > 0;

    return matchesSearch && matchesDept && matchesLwp;
  });

  return (
    <div className="space-y-4">
      {/* ── Table Toolbar & Filters ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by staff name, employee code, or designation..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="rounded-xl bg-slate-950 border border-slate-800 text-xs text-white px-3 py-2"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer px-3 py-2 rounded-xl bg-slate-950 border border-slate-800">
            <input
              type="checkbox"
              checked={filterLwpOnly}
              onChange={(e) => setFilterLwpOnly(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
            />
            <span>LWP Staff Only</span>
          </label>
        </div>
      </div>

      {/* ── Scannable Financial Grid Table ───────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3.5">Employee</th>
                <th className="px-4 py-3.5 text-right">Gross Salary</th>
                <th className="px-4 py-3.5 text-right">LWP & Base</th>
                <th className="px-4 py-3.5 text-right">Emp. PF</th>
                <th className="px-4 py-3.5 text-right">Emp. ESI</th>
                <th className="px-4 py-3.5 text-right">PT</th>
                <th className="px-4 py-3.5 text-right">Loan EMI</th>
                <th className="px-4 py-3.5 text-right">Total Deductions</th>
                <th className="px-4 py-3.5 text-right">Net Disbursed</th>
                <th className="px-4 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                    <div className="space-y-2">
                      <Users className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="font-semibold text-slate-300">No payroll records match your filter criteria.</p>
                      <p className="text-xs text-slate-500">Try adjusting your search term or department filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr
                    key={r.staffId}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Employee Profile Column */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-white text-xs">{r.staffName}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-mono text-slate-300">{r.employeeCode}</span>
                        {r.designationName && <span>• {r.designationName}</span>}
                      </div>
                    </td>

                    {/* Gross Salary */}
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-200">
                      ₹{r.grossSalary.toLocaleString("en-IN")}
                    </td>

                    {/* LWP & Effective Base */}
                    <td className="px-4 py-3.5 text-right">
                      {r.lwpDays > 0 ? (
                        <div className="inline-flex items-center gap-1 text-amber-400 font-semibold" title={`LWP Deduction: ₹${r.lwpDeduction}`}>
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{r.lwpDays}d (-₹{r.lwpDeduction})</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">0d</span>
                      )}
                      <div className="text-[10px] text-slate-400 font-mono">
                        Eff: ₹{r.effectiveGross.toLocaleString("en-IN")}
                      </div>
                    </td>

                    {/* Employee PF */}
                    <td className="px-4 py-3.5 text-right text-slate-300">
                      ₹{r.statutory.employeePF.toLocaleString("en-IN")}
                    </td>

                    {/* Employee ESI */}
                    <td className="px-4 py-3.5 text-right text-slate-300">
                      {r.statutory.employeeESI > 0 ? (
                        <span className="text-purple-300">₹{r.statutory.employeeESI.toLocaleString("en-IN")}</span>
                      ) : (
                        <span className="text-slate-500">Exempt</span>
                      )}
                    </td>

                    {/* PT */}
                    <td className="px-4 py-3.5 text-right text-slate-300">
                      ₹{r.statutory.professionalTax}
                    </td>

                    {/* Loan EMI */}
                    <td className="px-4 py-3.5 text-right">
                      {r.loanEmiDeduction > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-semibold border border-blue-500/30">
                          <CreditCard className="w-3 h-3" /> ₹{r.loanEmiDeduction.toLocaleString("en-IN")}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>

                    {/* Total Deductions */}
                    <td className="px-4 py-3.5 text-right font-semibold text-red-400">
                      -₹{r.totalDeductions.toLocaleString("en-IN")}
                    </td>

                    {/* Net Disbursed Pay */}
                    <td className="px-4 py-3.5 text-right font-black text-sm text-emerald-400 bg-emerald-950/20">
                      ₹{r.netPay.toLocaleString("en-IN")}
                    </td>

                    {/* Action Column */}
                    <td className="px-4 py-3.5 text-center">
                      {onViewPayslip && (
                        <button
                          onClick={() => onViewPayslip(r)}
                          className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white transition text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" /> Payslip
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
