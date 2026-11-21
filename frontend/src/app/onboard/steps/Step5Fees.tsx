"use client";

import React, { useState } from "react";
import { useOnboarding } from "../onboardContext";
import { FeeHeadSetupItem } from "@/app/actions/onboard";
import { DollarSign, Plus, X, Receipt } from "lucide-react";

export function Step5Fees() {
  const { feeHeadsList, addFeeHead, removeFeeHead } = useOnboarding();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState<FeeHeadSetupItem["category"]>("RECURRING");
  const [headType, setHeadType] = useState<FeeHeadSetupItem["headType"]>("TUITION");

  const handleAddFeeHead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addFeeHead(name.trim(), code.trim(), category, headType);
    setName("");
    setCode("");
  };

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
          Step 5: Fee Architecture
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
          Billing Plans & Fee Heads
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Standard Indian school fee heads are pre-configured with recurring schedules and statutory refundability.
          Customize or add additional fee types as needed.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
        {feeHeadsList.map((head, idx) => (
          <div
            key={head.code + idx}
            className="p-4 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/[0.08] flex flex-col justify-between gap-3 shadow-level-0 hover:border-white/20 transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-xs text-white">
                  {head.name}
                </h4>
                <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                  [{head.code}]
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFeeHead(idx)}
                className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/[0.05] transition"
                title="Remove fee head"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-white/[0.08]">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-300 border border-white/10">
                {head.category}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {head.headType}
              </span>
              {head.isRefundable && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Refundable
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Custom Fee Head Form */}
      <form
        onSubmit={handleAddFeeHead}
        className="bg-slate-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 space-y-3 shadow-level-0"
      >
        <div className="flex items-center gap-2 text-white font-semibold text-xs uppercase tracking-wider">
          <Receipt className="w-3.5 h-3.5 text-blue-400" />
          <span>Add Custom Fee Head</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fee Head Name (e.g. Sports Fee)"
            className="px-3.5 py-2.5 text-xs rounded-xl bg-slate-950/60 hover:bg-slate-950/80 border border-white/10 focus:border-blue-500 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all min-h-[38px] sm:min-h-[44px]"
          />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Code (e.g. SPT)"
            className="px-3.5 py-2.5 text-xs font-mono rounded-xl bg-slate-950/60 hover:bg-slate-950/80 border border-white/10 focus:border-blue-500 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all min-h-[38px] sm:min-h-[44px]"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="px-3.5 py-2.5 text-xs rounded-xl bg-slate-950/60 hover:bg-slate-950/80 border border-white/10 focus:border-blue-500 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all min-h-[38px] sm:min-h-[44px]"
          >
            <option value="RECURRING">RECURRING (Per Term/Month)</option>
            <option value="ONE_TIME">ONE_TIME (Admission)</option>
            <option value="OPTIONAL">OPTIONAL (Transport/Mess)</option>
          </select>
          <button
            type="button"
            onClick={handleAddFeeHead}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold text-xs rounded-xl inline-flex items-center justify-center gap-1.5 transition shadow-level-1 min-h-[38px] sm:min-h-[44px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Fee Head</span>
          </button>
        </div>
      </form>
    </div>
  );
}
