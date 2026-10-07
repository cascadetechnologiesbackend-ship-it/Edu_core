export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeDiscounts, feeHeads } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceSubNav } from "@/components/layout/FinanceSubNav";
import { Percent, Plus, Tag, ShieldCheck, CheckCircle2 } from "lucide-react";
import { createFeeDiscount, toggleFeeDiscount } from "./actions";

export default async function FeesDiscountPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const [discounts, heads] = await Promise.all([
    db.query.feeDiscounts.findMany({
      where: eq(feeDiscounts.schoolId, schoolId),
      with: {
        feeHead: true,
      },
      orderBy: [desc(feeDiscounts.createdAt)],
    }),
    db.query.feeHeads.findMany({
      where: eq(feeHeads.schoolId, schoolId),
      orderBy: [desc(feeHeads.priority)],
    }),
  ]);

  return (
    <div className="space-y-6">
      <FinanceSubNav activeSection="setup" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Percent className="w-3.5 h-3.5" /> Structure Configuration
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Fees Discount & Concession Policies
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Establish discount policies (Sibling Concession, Staff Ward, Merit Scholarship, EWS), percentage or flat allowances, and approval controls.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Add Policy Form */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm h-fit">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-purple-600" /> New Discount Policy
          </h2>
          <form
            action={async (formData) => {
              "use server";
              await createFeeDiscount(formData);
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
                placeholder="e.g. Sibling Discount 15%"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Discount Code
                </label>
                <input
                  type="text"
                  name="code"
                  placeholder="SIBLING15"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Type *
                </label>
                <select
                  name="discountType"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Flat Amount (₹)</option>
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
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Applies To Fee Head
              </label>
              <select
                name="appliesToFeeHeadId"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
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
                <input type="checkbox" name="requiresApproval" defaultChecked className="rounded text-purple-600" />
                Requires Principal / Admin Approval
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition shadow-sm"
            >
              Create Discount Policy
            </button>
          </form>
        </div>

        {/* Right: Policy Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                Active Discount Policies ({discounts.length})
              </h3>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {discounts.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No discount policies configured yet. Create a policy on the left.
                </div>
              ) : (
                discounts.map((disc) => (
                  <div key={disc.id} className="p-5 flex items-start justify-between hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-white text-base">
                          {disc.name}
                        </span>
                        {disc.code && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 font-semibold">
                            {disc.code}
                          </span>
                        )}
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-bold">
                          {disc.discountType === "PERCENTAGE" ? `${disc.discountValue}% OFF` : `₹ ${disc.discountValue} OFF`}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>Applies: {disc.feeHead?.name || "All Eligible Heads"}</span>
                        <span>•</span>
                        {disc.requiresApproval ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Requires Approval
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Auto-apply OK</span>
                        )}
                      </div>
                    </div>

                    <form
                      action={async () => {
                        "use server";
                        await toggleFeeDiscount(disc.id);
                      }}
                    >
                      <button
                        type="submit"
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          disc.isActive
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-red-50 hover:text-red-600"
                            : "bg-gray-100 text-gray-500 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600"
                        }`}
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
    </div>
  );
}
