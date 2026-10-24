"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  PlusCircle,
  Search,
  Sparkles,
  Calculator,
  Building2,
  DollarSign,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { AppModal } from "@/components/ui/AppModal";
import { Combobox, type ComboboxOption } from "@/components/forms/Combobox";
import { INDIAN_STATES, getStateByCode } from "@/lib/reference/indiaReferenceData";
import { createSalaryTemplate, associateSalaryTemplate } from "../actions";

interface TemplatesTabProps {
  salaryTemplates: any[];
  staffList: any[];
  isAuthorizedHR: boolean;
  onRefresh?: (() => void) | undefined;
}

export function TemplatesTab({
  salaryTemplates,
  staffList,
  isAuthorizedHR,
  onRefresh,
}: TemplatesTabProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState<"create" | "associate" | null>(null);

  // Create Template Form State
  const [templateForm, setTemplateForm] = useState({
    name: "",
    basicPercent: 50,
    daPercent: 10,
    hraPercent: 20,
    esiApplicable: true,
    pfEmployeePercent: 12,
    pfEmployerPercent: 12,
    professionalTaxState: "DL",
  });

  // Associate Template Form State
  const [associationForm, setAssociationForm] = useState({
    staffId: "",
    templateId: "",
    baseGrossSalary: 45000,
    monthlyTds: 1200,
  });

  // State options for Professional Tax Combobox
  const stateOptions: ComboboxOption[] = useMemo(() => {
    return INDIAN_STATES.map((s) => ({
      value: s.code,
      label: s.nameEn,
      subLabel: `${s.code}${s.isUnionTerritory ? " • UT" : " • State"}`,
      searchTerms: [s.code, s.nameHi, s.isUnionTerritory ? "Union Territory" : "State"],
    }));
  }, []);

  // Staff options for assignment
  const staffOptions: ComboboxOption[] = useMemo(() => {
    return staffList.map((s) => ({
      value: s.id,
      label: `${s.firstName} ${s.lastName}`,
      subLabel: `${s.employeeCode || "No Code"} • ${s.designation?.name || "Staff"}`,
      searchTerms: [s.employeeCode || "", s.department?.name || ""],
    }));
  }, [staffList]);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return salaryTemplates;
    const q = searchQuery.toLowerCase().trim();
    return salaryTemplates.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.professionalTaxState?.toLowerCase().includes(q)
    );
  }, [salaryTemplates, searchQuery]);

  // Selected template for salary calculator preview in association modal
  const selectedTemplateForCalc = useMemo(() => {
    return salaryTemplates.find((t) => t.id === associationForm.templateId);
  }, [salaryTemplates, associationForm.templateId]);

  // Calculated Preview
  const salaryPreview = useMemo(() => {
    if (!selectedTemplateForCalc || !associationForm.baseGrossSalary) return null;
    const gross = Number(associationForm.baseGrossSalary) || 0;
    const basic = (gross * parseFloat(selectedTemplateForCalc.basicPercent || 0)) / 100;
    const da = (gross * parseFloat(selectedTemplateForCalc.daPercent || 0)) / 100;
    const hra = (gross * parseFloat(selectedTemplateForCalc.hraPercent || 0)) / 100;
    const pfEmployee = (basic * parseFloat(selectedTemplateForCalc.pfEmployeePercent || 0)) / 100;
    const monthlyTds = Number(associationForm.monthlyTds) || 0;
    const estDeductions = pfEmployee + monthlyTds;
    const estNet = Math.max(0, gross - estDeductions);

    return {
      gross,
      basic,
      da,
      hra,
      pfEmployee,
      monthlyTds,
      estDeductions,
      estNet,
    };
  }, [selectedTemplateForCalc, associationForm.baseGrossSalary, associationForm.monthlyTds]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    setLoading(true);
    const res = await createSalaryTemplate({
      ...templateForm,
      otherAllowances: [],
    });
    setLoading(false);
    if (res.success) {
      toast.success(`Salary template "${templateForm.name}" created successfully!`);
      setTemplateForm({
        name: "",
        basicPercent: 50,
        daPercent: 10,
        hraPercent: 20,
        esiApplicable: true,
        pfEmployeePercent: 12,
        pfEmployerPercent: 12,
        professionalTaxState: "DL",
      });
      setModalType(null);
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || "Failed to create template");
    }
  };

  const handleAssociateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!associationForm.staffId || !associationForm.templateId) {
      toast.error("Please select both staff member and salary template");
      return;
    }
    setLoading(true);
    const res = await associateSalaryTemplate(
      associationForm.staffId,
      associationForm.templateId,
      Number(associationForm.baseGrossSalary),
      Number(associationForm.monthlyTds)
    );
    setLoading(false);
    if (res.success) {
      toast.success("Salary structure successfully assigned to staff!");
      setModalType(null);
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || "Failed to associate template");
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Wage & Salary Templates
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Define statutory salary structures, PF/ESI components, and state-wise professional tax bands
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAuthorizedHR && (
            <>
              <button
                type="button"
                onClick={() => setModalType("associate")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors min-h-[40px]"
              >
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Assign Staff Salary</span>
              </button>
              <button
                type="button"
                onClick={() => setModalType("create")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors min-h-[40px]"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Template</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search templates by title or PT state..."
          className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
        />
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {searchQuery ? "No templates match your search" : "No salary templates configured yet"}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Create salary templates with standard Basic, DA, HRA splits and statutory deductions to assign to teaching and non-teaching staff.
          </p>
          {isAuthorizedHR && !searchQuery && (
            <button
              type="button"
              onClick={() => setModalType("create")}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Create First Template
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((t) => {
            const stateInfo = getStateByCode(t.professionalTaxState);
            const stateDisplay = stateInfo
              ? `${stateInfo.nameEn} (${stateInfo.code})`
              : t.professionalTaxState || "Default";

            return (
              <div
                key={t.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                        {t.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Statutory Structure
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                      PT: {stateDisplay}
                    </span>
                  </div>

                  {/* Components Breakdown */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-850 text-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Basic
                      </span>
                      <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                        {t.basicPercent}%
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        DA
                      </span>
                      <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                        {t.daPercent}%
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        HRA
                      </span>
                      <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                        {t.hraPercent}%
                      </p>
                    </div>
                  </div>

                  {/* Deductions Summary */}
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 pt-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span>PF Employee / Employer:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {t.pfEmployeePercent}% / {t.pfEmployerPercent}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span>ESI Applicable:</span>
                      <span
                        className={`font-semibold ${
                          t.esiApplicable
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-400"
                        }`}
                      >
                        {t.esiApplicable ? "Yes (0.75% / 3.25%)" : "No"}
                      </span>
                    </div>
                  </div>
                </div>

                {isAuthorizedHR && (
                  <button
                    type="button"
                    onClick={() => {
                      setAssociationForm((prev) => ({
                        ...prev,
                        templateId: t.id,
                      }));
                      setModalType("associate");
                    }}
                    className="w-full py-2 text-xs font-semibold rounded-xl border border-indigo-200 dark:border-indigo-850 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/40 transition-colors flex items-center justify-center gap-1.5 min-h-[36px]"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Assign to Staff</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Salary Template */}
      <AppModal
        open={modalType === "create"}
        onClose={() => setModalType(null)}
        title="Create Wage & Salary Template"
      >
        <form onSubmit={handleCreateTemplate} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Template Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Regular Teaching Faculty Pay Band (Grade I)"
              value={templateForm.name}
              onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
              className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Professional Tax State Combobox */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Professional Tax Jurisdiction (State / UT) *
            </label>
            <Combobox
              options={stateOptions}
              value={templateForm.professionalTaxState}
              onChange={(val) =>
                setTemplateForm({ ...templateForm, professionalTaxState: val })
              }
              placeholder="Select Indian State or Union Territory"
              searchPlaceholder="Search 36 States/UTs (e.g. Delhi, Maharashtra, DL, MH)..."
              disabled={loading}
              isHindi={false}
              className="w-full"
            />
            <p className="text-[11px] text-slate-400">
              Determines monthly Professional Tax slab rules applied during payroll calculation.
            </p>
          </div>

          {/* Gross Percentage Splits */}
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              Gross Salary Allocation Components (% of Base Gross)
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 font-medium">Basic % *</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={templateForm.basicPercent}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      basicPercent: Number(e.target.value),
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 font-medium">DA % *</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={templateForm.daPercent}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      daPercent: Number(e.target.value),
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 font-medium">HRA % *</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={templateForm.hraPercent}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      hraPercent: Number(e.target.value),
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Total allowance percent: {templateForm.basicPercent + templateForm.daPercent + templateForm.hraPercent}%
              {templateForm.basicPercent + templateForm.daPercent + templateForm.hraPercent > 100 && (
                <span className="text-amber-500 font-semibold ml-1">
                  (Exceeds 100% of Base Gross)
                </span>
              )}
            </div>
          </div>

          {/* Statutory Deductions */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
            <label className="font-semibold text-slate-700 dark:text-slate-300 block">
              Statutory Contributions (EPFO & ESIC)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 font-medium">PF Employee %</span>
                <input
                  type="number"
                  step="0.1"
                  value={templateForm.pfEmployeePercent}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      pfEmployeePercent: Number(e.target.value),
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 font-medium">PF Employer %</span>
                <input
                  type="number"
                  step="0.1"
                  value={templateForm.pfEmployerPercent}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      pfEmployerPercent: Number(e.target.value),
                    })
                  }
                  className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={templateForm.esiApplicable}
                onChange={(e) =>
                  setTemplateForm({ ...templateForm, esiApplicable: e.target.checked })
                }
                className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                Enable ESIC contributions (applicable for gross monthly wages ≤ ₹21,000)
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalType(null)}
              className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[38px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors min-h-[38px] disabled:opacity-50"
            >
              {loading ? "Creating..." : "Save Template"}
            </button>
          </div>
        </form>
      </AppModal>

      {/* Modal: Assign / Associate Salary Template to Staff */}
      <AppModal
        open={modalType === "associate"}
        onClose={() => setModalType(null)}
        title="Assign Salary Structure to Staff"
      >
        <form onSubmit={handleAssociateTemplate} className="space-y-4 text-xs">
          {/* Select Staff Combobox */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Select Staff Member *
            </label>
            <Combobox
              options={staffOptions}
              value={associationForm.staffId}
              onChange={(val) => setAssociationForm({ ...associationForm, staffId: val })}
              placeholder="Search staff by name or employee code..."
              searchPlaceholder="Type staff name or code..."
              disabled={loading}
              isHindi={false}
              className="w-full"
            />
          </div>

          {/* Select Template */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Select Salary Template *
            </label>
            <select
              required
              value={associationForm.templateId}
              onChange={(e) =>
                setAssociationForm({ ...associationForm, templateId: e.target.value })
              }
              className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">-- Choose Template --</option>
              {salaryTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (Basic: {t.basicPercent}%, PT: {t.professionalTaxState})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Base Monthly Gross (₹) *
              </label>
              <input
                type="number"
                min="1000"
                step="500"
                required
                value={associationForm.baseGrossSalary}
                onChange={(e) =>
                  setAssociationForm({
                    ...associationForm,
                    baseGrossSalary: Number(e.target.value),
                  })
                }
                className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Monthly TDS Deduction (₹)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={associationForm.monthlyTds}
                onChange={(e) =>
                  setAssociationForm({
                    ...associationForm,
                    monthlyTds: Number(e.target.value),
                  })
                }
                className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Live Preview Calculator */}
          {salaryPreview && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-900 dark:text-indigo-300">
                <Calculator className="w-3.5 h-3.5" />
                <span>Estimated Monthly Compensation Breakdown</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Basic ({selectedTemplateForCalc?.basicPercent}%):</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    ₹{salaryPreview.basic.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>DA ({selectedTemplateForCalc?.daPercent}%):</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    ₹{salaryPreview.da.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>HRA ({selectedTemplateForCalc?.hraPercent}%):</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    ₹{salaryPreview.hra.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>PF Employee ({selectedTemplateForCalc?.pfEmployeePercent}%):</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    -₹{salaryPreview.pfEmployee.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between col-span-2 pt-1 border-t border-indigo-200/50 dark:border-indigo-850/50 font-bold text-xs">
                  <span className="text-slate-800 dark:text-slate-200">Estimated Net Pay:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ₹{salaryPreview.estNet.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalType(null)}
              className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[38px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors min-h-[38px] disabled:opacity-50"
            >
              {loading ? "Assigning..." : "Assign Salary"}
            </button>
          </div>
        </form>
      </AppModal>
    </div>
  );
}
