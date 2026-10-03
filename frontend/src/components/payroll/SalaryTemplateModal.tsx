"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle2, AlertTriangle, Sliders, ShieldCheck } from "lucide-react";
import { SalaryTemplateConfig } from "@/lib/payrollEngine";

interface SalaryTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: SalaryTemplateConfig & { name: string }) => void;
  initialData?: SalaryTemplateConfig & { name?: string };
}

export function SalaryTemplateModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: SalaryTemplateModalProps) {
  const [name, setName] = useState(initialData?.name || "Standard Teaching Faculty");
  const [basicPercent, setBasicPercent] = useState(initialData?.basicPercent ?? 50);
  const [daPercent, setDaPercent] = useState(initialData?.daPercent ?? 10);
  const [hraPercent, setHraPercent] = useState(initialData?.hraPercent ?? 20);
  const [pfEmployeePercent, setPfEmployeePercent] = useState(initialData?.pfEmployeePercent ?? 12);
  const [pfEmployerPercent, setPfEmployerPercent] = useState(initialData?.pfEmployerPercent ?? 12);
  const [esiApplicable, setEsiApplicable] = useState(initialData?.esiApplicable ?? false);
  const [professionalTaxState, setProfessionalTaxState] = useState(initialData?.professionalTaxState || "DL");

  const [error, setError] = useState("");

  // Computed Special Allowance Fallback
  const allocatedSum = basicPercent + daPercent + hraPercent;
  const specialPercent = Math.max(0, 100 - allocatedSum);
  const isValidTotal = allocatedSum <= 100;

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setBasicPercent(initialData.basicPercent ?? 50);
      setDaPercent(initialData.daPercent ?? 10);
      setHraPercent(initialData.hraPercent ?? 20);
      setPfEmployeePercent(initialData.pfEmployeePercent ?? 12);
      setPfEmployerPercent(initialData.pfEmployerPercent ?? 12);
      setEsiApplicable(initialData.esiApplicable ?? false);
      setProfessionalTaxState(initialData.professionalTaxState || "DL");
    }
  }, [initialData]);

  if (!isOpen) return null;

  const handleApplyPreset = (type: string) => {
    switch (type) {
      case "TEACHING":
        setName("Standard Teaching Faculty");
        setBasicPercent(50);
        setDaPercent(10);
        setHraPercent(20);
        setEsiApplicable(false);
        break;
      case "ADMIN":
        setName("Admin Cadre");
        setBasicPercent(45);
        setDaPercent(10);
        setHraPercent(25);
        setEsiApplicable(false);
        break;
      case "SUPPORT":
        setName("Support Staff");
        setBasicPercent(60);
        setDaPercent(15);
        setHraPercent(15);
        setEsiApplicable(true);
        break;
      case "CONTRACT":
        setName("Fixed Contract Staff");
        setBasicPercent(100);
        setDaPercent(0);
        setHraPercent(0);
        setEsiApplicable(false);
        break;
    }
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please provide a template name.");
      return;
    }

    if (allocatedSum > 100) {
      setError(`Component total (${allocatedSum}%) exceeds 100%. Please reduce Basic, DA, or HRA.`);
      return;
    }

    const payload: SalaryTemplateConfig & { name: string } = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      name,
      basicPercent,
      daPercent,
      hraPercent,
      pfEmployeePercent,
      pfEmployerPercent,
      esiApplicable,
      professionalTaxState,
    };
    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {initialData?.id ? "Edit Salary Template" : "Create Salary Template"}
              </h2>
              <p className="text-xs text-slate-400">
                Configure 100% percentage component allocations & statutory rules.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl text-xl font-bold"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-400">Load Quick Preset:</span>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Teaching (50/10/20)", key: "TEACHING" },
              { label: "Admin (45/10/25)", key: "ADMIN" },
              { label: "Support (60/15/15)", key: "SUPPORT" },
              { label: "Contract (100%)", key: "CONTRACT" },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handleApplyPreset(p.key)}
                className="px-3 py-1.5 rounded-xl border border-slate-800 hover:border-blue-500/50 bg-slate-950 text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                ⚡ {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSaveSubmit} className="space-y-5">
          {/* Template Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Template Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Teaching Faculty"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* 100% Component Allocation Visualizer Bar */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300">100% Component Allocation</span>
              <span className={isValidTotal ? "text-emerald-400" : "text-red-400"}>
                {allocatedSum}% allocated ({specialPercent}% Special Fallback)
              </span>
            </div>

            {/* Stacked Progress Bar */}
            <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex">
              <div style={{ width: `${Math.min(100, basicPercent)}%` }} className="bg-blue-500 h-full" title={`Basic: ${basicPercent}%`}></div>
              <div style={{ width: `${Math.min(100 - basicPercent, daPercent)}%` }} className="bg-indigo-500 h-full" title={`DA: ${daPercent}%`}></div>
              <div style={{ width: `${Math.min(100 - basicPercent - daPercent, hraPercent)}%` }} className="bg-purple-500 h-full" title={`HRA: ${hraPercent}%`}></div>
              <div style={{ width: `${specialPercent}%` }} className="bg-emerald-500 h-full" title={`Special: ${specialPercent}%`}></div>
            </div>

            <div className="flex flex-wrap gap-4 text-[11px] font-medium text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Basic ({basicPercent}%)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> DA ({daPercent}%)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> HRA ({hraPercent}%)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Special ({specialPercent}%)</span>
            </div>
          </div>

          {/* Component Sliders / Inputs */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Basic %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={basicPercent}
                onChange={(e) => setBasicPercent(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">DA %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={daPercent}
                onChange={(e) => setDaPercent(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">HRA %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={hraPercent}
                onChange={(e) => setHraPercent(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          {/* Statutory Rules */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-400" /> Statutory Compliance Controls
            </span>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">PF Employee Rate (%)</label>
                <input
                  type="number"
                  value={pfEmployeePercent}
                  onChange={(e) => setPfEmployeePercent(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Professional Tax State</label>
                <select
                  value={professionalTaxState}
                  onChange={(e) => setProfessionalTaxState(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="DL">Delhi (Nil ≤15k, ₹200 &gt;15k)</option>
                  <option value="MH">Maharashtra (₹200 Standard)</option>
                  <option value="KA">Karnataka (₹200 Standard)</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-800 bg-slate-950 cursor-pointer">
              <input
                type="checkbox"
                checked={esiApplicable}
                onChange={(e) => setEsiApplicable(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-300 font-medium">
                Force ESI Contribution (0.75% Employee / 3.25% Employer)
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValidTotal}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
            >
              Save Salary Template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
