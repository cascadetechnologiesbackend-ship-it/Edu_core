"use client";

import React, { useState } from "react";
import {
  Percent,
  Plus,
  Tag,
  ShieldCheck,
  CheckCircle2,
  Users,
  Search,
} from "lucide-react";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { DataTable, ColumnDef } from "@/components/finance/DataTable";
import { createFeeDiscount, toggleFeeDiscount } from "./actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface DiscountTemplateItem {
  id: string;
  name: string;
  code?: string | null | undefined;
  discountType: string;
  discountValue: string;
  appliesToHeadName?: string | undefined;
  requiresApproval: boolean;
  isActive: boolean;
}

export interface StudentConcessionItem {
  id: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  concessionType: string;
  concessionName: string;
  discountPercentage?: string | null | undefined;
  discountAmount?: string | null | undefined;
  isActive: boolean;
}

export interface ConcessionsClientProps {
  discounts: DiscountTemplateItem[];
  concessions: StudentConcessionItem[];
  heads: Array<{ id: string; name: string }>;
}

export function ConcessionsClient({ discounts, concessions, heads }: ConcessionsClientProps) {
  const [activeTab, setActiveTab] = useState<"TEMPLATES" | "STUDENTS">("TEMPLATES");

  return (
    <div className="space-y-6">
      {/* Sub-tab Switcher */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-gray-200 dark:border-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("TEMPLATES")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition",
            activeTab === "TEMPLATES"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <Tag className="w-3.5 h-3.5" /> Discount Policy Templates ({discounts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("STUDENTS")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition",
            activeTab === "STUDENTS"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <Users className="w-3.5 h-3.5" /> Student Concession Assignments ({concessions.length})
        </button>
      </div>

      {activeTab === "TEMPLATES" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Policy Form */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm h-fit">
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-indigo-600" /> New Discount Policy
            </h2>
            <form
              action={async (formData) => {
                const res = await createFeeDiscount(formData);
                if (res.success) toast.success(res.message);
                else toast.error(res.message);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Policy Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Sibling Concession 15%"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    name="code"
                    placeholder="SIBLING15"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                    Type *
                  </label>
                  <select
                    name="discountType"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Flat (₹)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Discount Value *
                </label>
                <input
                  type="number"
                  name="discountValue"
                  step="0.01"
                  required
                  placeholder="e.g. 15 for 15% or 5000 for ₹5000"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Applies To Fee Head
                </label>
                <select
                  name="appliesToFeeHeadId"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="ALL">All Eligible Fee Heads</option>
                  {heads.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    name="requiresApproval"
                    defaultChecked
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  Requires Administrative Authorization
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition active:scale-95"
              >
                Create Discount Policy
              </button>
            </form>
          </div>

          {/* Active Policies List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 dark:text-white text-base">
                  Registered Concession Templates ({discounts.length})
                </h3>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {discounts.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-xs">
                    No discount policies configured yet.
                  </div>
                ) : (
                  discounts.map((disc) => (
                    <div
                      key={disc.id}
                      className="p-5 flex items-start justify-between hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white text-sm">
                            {disc.name}
                          </span>
                          {disc.code && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 font-semibold">
                              {disc.code}
                            </span>
                          )}
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold">
                            {disc.discountType === "PERCENTAGE"
                              ? `${disc.discountValue}% OFF`
                              : `₹ ${disc.discountValue} FLAT`}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                          <span>Applies: {disc.appliesToHeadName || "All Eligible Heads"}</span>
                          <span>•</span>
                          {disc.requiresApproval ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" /> Requires Approval
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Auto-Apply OK
                            </span>
                          )}
                        </div>
                      </div>

                      <form
                        action={async () => {
                          const res = await toggleFeeDiscount(disc.id);
                          if (res.success) toast.success(res.message);
                          else toast.error(res.message);
                        }}
                      >
                        <button
                          type="submit"
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-semibold transition",
                            disc.isActive
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                              : "bg-gray-100 text-gray-500 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600"
                          )}
                        >
                          {disc.isActive ? "Active" : "Inactive"}
                        </button>
                      </form>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Students Concessions Table */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Student Specific Concession Allocations ({concessions.length})
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Active student concession entitlements (Staff Ward, Sibling, RTE, Merit Scholarship).
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Category Type</th>
                  <th className="py-3 px-4">Concession Name</th>
                  <th className="py-3 px-4 text-right">Benefit Rate</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {concessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No individual student concessions registered yet.
                    </td>
                  </tr>
                ) : (
                  concessions.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                        {c.studentName}
                        <span className="block text-[11px] font-mono text-gray-400">
                          Adm #{c.admissionNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300">
                        {c.className}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {c.concessionType}
                      </td>
                      <td className="py-3 px-4 text-gray-800 dark:text-slate-200">
                        {c.concessionName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {c.discountPercentage
                          ? `${parseFloat(c.discountPercentage)}%`
                          : c.discountAmount
                          ? `₹${parseFloat(c.discountAmount).toLocaleString("en-IN")}`
                          : "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={c.isActive ? "ACTIVE" : "INACTIVE"} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
