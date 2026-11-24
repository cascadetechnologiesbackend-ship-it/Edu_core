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
        <span className="text-xs font-semibold uppercase tracking-wider text-semantic-interactive">
          Step 5: Fee Architecture
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-foreground mt-1">
          Billing Plans & Fee Heads
        </h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
          Standard Indian school fee heads are pre-configured with recurring schedules and statutory refundability.
          Customize or add additional fee types as needed.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
        {feeHeadsList.map((head, idx) => (
          <div
            key={head.code + idx}
            className="p-4 rounded-2xl bg-card border border-border/40 flex flex-col justify-between gap-3 shadow-xs hover:border-border transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-xs text-foreground">
                  {head.name}
                </h4>
                <span className="font-mono text-[10px] text-muted-foreground block mt-0.5">
                  [{head.code}]
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFeeHead(idx)}
                className="text-muted-foreground hover:text-semantic-money-owed p-1.5 rounded-lg hover:bg-muted transition"
                title="Remove fee head"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/30">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground/80 border border-border/40">
                {head.category}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-semantic-interactive/10 text-semantic-interactive border border-semantic-interactive/20">
                {head.headType}
              </span>
              {head.isRefundable && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-semantic-money-in/10 text-semantic-money-in border border-semantic-money-in/20">
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
        className="bg-card border border-border/40 rounded-2xl p-5 space-y-3 shadow-xs"
      >
        <div className="flex items-center gap-2 text-foreground font-semibold text-xs uppercase tracking-wider">
          <Receipt className="w-3.5 h-3.5 text-semantic-interactive" />
          <span>Add Custom Fee Head</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fee Head Name (e.g. Sports Fee)"
            className="px-3.5 py-2.5 text-xs rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 focus:border-semantic-interactive text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-semantic-interactive/20 transition-all min-h-[38px] sm:min-h-[44px]"
          />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Code (e.g. SPT)"
            className="px-3.5 py-2.5 text-xs font-mono rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 focus:border-semantic-interactive text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-semantic-interactive/20 transition-all min-h-[38px] sm:min-h-[44px]"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="px-3.5 py-2.5 text-xs rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/40 focus:border-semantic-interactive text-foreground focus:outline-none focus:ring-2 focus:ring-semantic-interactive/20 transition-all min-h-[38px] sm:min-h-[44px]"
          >
            <option value="RECURRING">RECURRING (Per Term/Month)</option>
            <option value="ONE_TIME">ONE_TIME (Admission)</option>
            <option value="OPTIONAL">OPTIONAL (Transport/Mess)</option>
          </select>
          <button
            type="button"
            onClick={handleAddFeeHead}
            className="px-5 py-2.5 bg-semantic-interactive hover:bg-semantic-interactive/90 active:scale-[0.98] text-white font-semibold text-xs rounded-xl inline-flex items-center justify-center gap-1.5 transition shadow-xs min-h-[38px] sm:min-h-[44px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Fee Head</span>
          </button>
        </div>
      </form>
    </div>
  );
}
