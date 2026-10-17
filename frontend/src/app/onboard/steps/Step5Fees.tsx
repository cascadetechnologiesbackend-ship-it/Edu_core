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
        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          Step 5: Fee Architecture
        </span>
        <h2 className="text-2xl font-black text-white mt-1">
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
            className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between gap-3 shadow-xs"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-extrabold text-xs text-white">
                  {head.name}
                </h4>
                <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                  [{head.code}]
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFeeHead(idx)}
                className="text-slate-500 hover:text-rose-400 p-1 transition"
                title="Remove fee head"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-800/80">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {head.category}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-300 border border-blue-800/50">
                {head.headType}
              </span>
              {head.isRefundable && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
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
        className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3"
      >
        <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
          <Receipt className="w-3.5 h-3.5 text-primary" />
          <span>Add Custom Fee Head</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fee Head Name (e.g. Sports Fee)"
            className="px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-primary min-h-[38px]"
          />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Code (e.g. SPT)"
            className="px-3.5 py-2 text-xs font-mono rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-primary min-h-[38px]"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-primary min-h-[38px]"
          >
            <option value="RECURRING">RECURRING (Per Term/Month)</option>
            <option value="ONE_TIME">ONE_TIME (Admission)</option>
            <option value="OPTIONAL">OPTIONAL (Transport/Mess)</option>
          </select>
          <button
            type="button"
            onClick={handleAddFeeHead}
            className="px-4 py-2 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-xl inline-flex items-center justify-center gap-1.5 transition shadow-xs min-h-[38px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Fee Head</span>
          </button>
        </div>
      </form>
    </div>
  );
}
