export const dynamic = "force-dynamic";

import { db } from "@/db";
import { incomeHeads } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceSubNav } from "@/components/layout/FinanceSubNav";
import { ListOrdered, Plus, TrendingUp, CheckCircle2, XCircle } from "lucide-react";
import { createIncomeHead, toggleIncomeHeadStatus } from "./actions";

export default async function IncomeHeadsPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const heads = await db.query.incomeHeads.findMany({
    where: eq(incomeHeads.schoolId, schoolId),
    with: {
      vouchers: true,
    },
    orderBy: [desc(incomeHeads.createdAt)],
  });

  return (
    <div className="space-y-6">
      <FinanceSubNav activeSection="accounts" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="w-3.5 h-3.5" /> Chart of Accounts
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Non-Fee Income Heads
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Categorize non-tuition revenue channels like sponsorships, cafeteria rents, asset sales, and institutional grants.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* New Income Head Form */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
            <Plus className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Create Income Head
            </h2>
          </div>

          <form
            action={async (formData) => {
              "use server";
              await createIncomeHead(formData);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                Income Head Name *
              </label>
              <input
                type="text"
                name="name"
                placeholder="e.g. Canteen Rent, Event Sponsorship"
                required
                className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                Account Code
              </label>
              <input
                type="text"
                name="code"
                placeholder="e.g. INC-RENT-01"
                className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-gray-900 dark:text-white uppercase font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                Description / Classification
              </label>
              <textarea
                name="description"
                rows={3}
                placeholder="e.g. Monthly commercial lease collections from campus cafeteria operator"
                className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> Save Income Head
            </button>
          </form>
        </div>

        {/* Existing Income Heads Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Configured Revenue Heads ({heads.length})
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Active ledger categories used when generating non-fee revenue vouchers.
            </p>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Head Name</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Vouchers</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-800 dark:text-slate-200">
                {heads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500 dark:text-slate-400">
                      No income heads added yet. Define categories to begin logging non-fee earnings.
                    </td>
                  </tr>
                ) : (
                  heads.map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                        {h.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {h.code || "—"}
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-slate-400 max-w-xs truncate">
                        {h.description || "—"}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-gray-700 dark:text-slate-300">
                        {h.vouchers?.length || 0}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            h.isActive
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                              : "bg-gray-100 dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-700"
                          }`}
                        >
                          {h.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <form
                          action={async () => {
                            "use server";
                            await toggleIncomeHeadStatus(h.id, !h.isActive);
                          }}
                        >
                          <button
                            type="submit"
                            className="text-[11px] font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white underline"
                          >
                            {h.isActive ? "Disable" : "Enable"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
