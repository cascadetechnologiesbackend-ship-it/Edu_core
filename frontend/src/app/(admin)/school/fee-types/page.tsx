export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeHeads, schools } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceSubNav } from "@/components/layout/FinanceSubNav";
import { ListOrdered, Plus, CheckCircle2, XCircle, Tag, ShieldAlert } from "lucide-react";
import { createFeeHead, toggleFeeHeadStatus } from "./actions";

export default async function FeeTypesPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const heads = await db.query.feeHeads.findMany({
    where: eq(feeHeads.schoolId, session.user.schoolId),
    orderBy: [desc(feeHeads.priority), desc(feeHeads.createdAt)],
  });

  return (
    <div className="space-y-6">
      <FinanceSubNav activeSection="setup" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <ListOrdered className="w-3.5 h-3.5" /> Setup & Structure Configuration
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Fee Types & Heads Master
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Define individual Fee Heads (Tuition, Admission, Exam, Transport, Library), frequency schedules, and GST taxation policies.
          </p>
        </div>
      </div>

      {/* Create New Fee Head Form & Table Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Quick Add Form */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm h-fit">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-blue-600" /> Add New Fee Head
          </h2>
          <form
            action={async (formData) => {
              "use server";
              await createFeeHead(formData);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Fee Head Name *
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g. Tuition Fee"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
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
                  placeholder="TUI"
                  maxLength={10}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Priority (1-99)
                </label>
                <input
                  type="number"
                  name="priority"
                  defaultValue="10"
                  min="1"
                  max="99"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Head Type *
              </label>
              <select
                name="headType"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
              >
                <option value="TUITION">Tuition Fee</option>
                <option value="ADMISSION">Admission Fee</option>
                <option value="EXAM">Examination Fee</option>
                <option value="TRANSPORT">Transport Fee</option>
                <option value="LIBRARY">Library Fee</option>
                <option value="LAB">Laboratory Fee</option>
                <option value="SPORTS">Sports & Activity Fee</option>
                <option value="HOSTEL">Hostel Fee</option>
                <option value="MISCELLANEOUS">Miscellaneous Fee</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Category
              </label>
              <select
                name="category"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
              >
                <option value="RECURRING">Recurring (Term / Monthly)</option>
                <option value="ONE_TIME">One-Time (Admission / Security)</option>
                <option value="OPTIONAL">Optional (Transport / Meal)</option>
              </select>
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" name="discountEligible" defaultChecked className="rounded text-blue-600" />
                Eligible for Concessions & Scholarships
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" name="lateFineEligible" className="rounded text-blue-600" />
                Incurs Late Fine Penalty after Due Date
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" name="isRefundable" className="rounded text-blue-600" />
                Caution Deposit / Refundable
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" name="isTaxable" className="rounded text-blue-600" />
                Taxable under GST (Commercial activities)
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow-sm"
            >
              Create Fee Head
            </button>
          </form>
        </div>

        {/* Right: List of Fee Heads */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-gray-900 dark:text-white text-base">
              Configured Fee Heads ({heads.length})
            </h3>
            <span className="text-xs text-gray-500">Sorted by Priority</span>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {heads.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No fee heads configured yet. Add your first head using the form on the left.
              </div>
            ) : (
              heads.map((head) => (
                <div key={head.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 dark:text-white text-sm">
                        {head.name}
                      </span>
                      {head.code && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400">
                          {head.code}
                        </span>
                      )}
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
                        {head.headType}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>Priority: #{head.priority}</span>
                      <span>•</span>
                      <span>Category: {head.category}</span>
                      {head.discountEligible && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Discount OK</span>
                        </>
                      )}
                      {head.lateFineEligible && (
                        <>
                          <span>•</span>
                          <span className="text-amber-600 dark:text-amber-400 font-medium">Fine OK</span>
                        </>
                      )}
                      {head.isTaxable && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-medium">GST {head.gstPercentage}%</span>
                        </>
                      )}
                    </div>
                  </div>

                  <form
                    action={async () => {
                      "use server";
                      await toggleFeeHeadStatus(head.id);
                    }}
                  >
                    <button
                      type="submit"
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        head.isActive
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-red-50 hover:text-red-600"
                          : "bg-gray-100 text-gray-500 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600"
                      }`}
                    >
                      {head.isActive ? "Active" : "Inactive"}
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
