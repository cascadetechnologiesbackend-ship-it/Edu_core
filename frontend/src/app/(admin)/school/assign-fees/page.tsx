export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeStructures, feeHeads, classes, academicYears } from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceSubNav } from "@/components/layout/FinanceSubNav";
import { UserCheck, Plus, Calendar, IndianRupee, Layers } from "lucide-react";
import { assignFeeStructure } from "./actions";

export default async function AssignFeesPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const [activeYear, allClasses, allHeads, structures] = await Promise.all([
    db.query.academicYears.findFirst({
      where: and(eq(academicYears.schoolId, schoolId), eq(academicYears.isActive, true)),
    }),
    db.query.classes.findMany({
      where: eq(classes.schoolId, schoolId),
      orderBy: [asc(classes.sortOrder)],
    }),
    db.query.feeHeads.findMany({
      where: eq(feeHeads.schoolId, schoolId),
      orderBy: [desc(feeHeads.priority)],
    }),
    db.query.feeStructures.findMany({
      where: eq(feeStructures.schoolId, schoolId),
      with: {
        class: true,
        feeHead: true,
      },
      orderBy: [desc(feeStructures.createdAt)],
    }),
  ]);

  if (!activeYear) {
    return (
      <div className="space-y-6">
        <FinanceSubNav activeSection="setup" />
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800">
          <p className="text-gray-500">No active academic session found. Please activate an academic year first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FinanceSubNav activeSection="setup" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <UserCheck className="w-3.5 h-3.5" /> Structure Configuration
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Assign Fees Matrix
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Map Fee Heads to classes, configure term amounts and due dates, and auto-provision student fee invoices.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assignment Form */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm h-fit">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-emerald-600" /> Assign Fee to Class
          </h2>
          <form
            action={async (formData) => {
              "use server";
              await assignFeeStructure(formData);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="academicYearId" value={activeYear.id} />

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Target Class (Grade) *
              </label>
              <select
                name="classId"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
              >
                {allClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Fee Head *
              </label>
              <select
                name="feeHeadId"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
              >
                {allHeads.map((head) => (
                  <option key={head.id} value={head.id}>
                    {head.name} ({head.headType})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Term Schedule *
                </label>
                <select
                  name="term"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
                >
                  <option value="ANNUAL">Annual</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="HALF_YEARLY">Half Yearly</option>
                  <option value="ONE_TIME">One Time</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  required
                  placeholder="e.g. 25000"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Due Date *
                </label>
                <input
                  type="date"
                  name="dueDate"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Late Fine (₹)
                </label>
                <input
                  type="number"
                  name="lateFeeAmount"
                  defaultValue="0"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" name="autoGenerateInvoices" defaultChecked className="rounded text-emerald-600" />
                Auto-generate invoices for enrolled students
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow-sm"
            >
              Assign & Sync Invoices
            </button>
          </form>
        </div>

        {/* Existing Matrix List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                Configured Class Fee Pricing Matrix ({structures.length})
              </h3>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {structures.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No fees assigned yet. Use the form on the left to assign fee heads to classes.
                </div>
              ) : (
                structures.map((st) => (
                  <div key={st.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-white text-sm">
                          {st.class.displayName}
                        </span>
                        <span className="text-gray-400">&rarr;</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400 text-sm">
                          {st.feeHead.name}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400">
                          {st.term}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                          <IndianRupee className="w-3 h-3" /> {parseFloat(st.amount).toLocaleString("en-IN")}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Due: {new Date(st.dueDate).toLocaleDateString("en-IN")}
                        </span>
                        {parseFloat(st.lateFeeAmount || "0") > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 dark:text-amber-400">
                              Fine: ₹{st.lateFeeAmount}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                      Synchronized
                    </span>
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
