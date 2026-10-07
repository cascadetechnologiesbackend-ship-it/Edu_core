export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeGroups, feeHeads, academicYears } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceSubNav } from "@/components/layout/FinanceSubNav";
import { Layers, Plus, Trash2, Calendar, Tag } from "lucide-react";
import { createFeeGroup, deleteFeeGroup } from "./actions";

export default async function FeeGroupsPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const [groups, heads, years] = await Promise.all([
    db.query.feeGroups.findMany({
      where: eq(feeGroups.schoolId, schoolId),
      with: {
        groupHeads: {
          with: {
            feeHead: true,
          },
        },
        academicYear: true,
      },
      orderBy: [desc(feeGroups.createdAt)],
    }),
    db.query.feeHeads.findMany({
      where: eq(feeHeads.schoolId, schoolId),
      orderBy: [desc(feeHeads.priority)],
    }),
    db.query.academicYears.findMany({
      where: eq(academicYears.schoolId, schoolId),
      orderBy: [desc(academicYears.startDate)],
    }),
  ]);

  return (
    <div className="space-y-6">
      <FinanceSubNav activeSection="setup" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <Layers className="w-3.5 h-3.5" /> Structure Configuration
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Fee Groups Master
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Cluster multiple Fee Heads into reusable package groups (e.g., Annual Charges Group, Monthly Tuition Package) for easy batch assignment to classes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Form */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm h-fit">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-indigo-600" /> Create Fee Group
          </h2>
          <form
            action={async (formData) => {
              "use server";
              await createFeeGroup(formData);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Group Name *
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g. Annual Charges 2026-27"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Academic Year *
              </label>
              <select
                name="academicYearId"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label} {y.isActive ? "(Active)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                Description
              </label>
              <textarea
                name="description"
                rows={2}
                placeholder="Optional group description"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-2">
                Include Fee Heads ({heads.length} Available)
              </label>
              <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-200 dark:border-slate-800 rounded-lg p-3 bg-gray-50/50 dark:bg-slate-800/30">
                {heads.map((head) => (
                  <label key={head.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300 cursor-pointer">
                    <input type="checkbox" name="feeHeadIds" value={head.id} className="rounded text-indigo-600" />
                    <span className="font-medium">{head.name}</span>
                    <span className="text-[10px] text-gray-400">({head.headType})</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition shadow-sm"
            >
              Create Fee Group
            </button>
          </form>
        </div>

        {/* Existing Groups List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                Configured Fee Groups ({groups.length})
              </h3>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {groups.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No fee groups created yet. Create your first fee group on the left.
                </div>
              ) : (
                groups.map((grp) => (
                  <div key={grp.id} className="p-5 flex items-start justify-between hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-900 dark:text-white text-base">
                          {grp.name}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {grp.academicYear?.label || "All Sessions"}
                        </span>
                      </div>
                      {grp.description && (
                        <p className="text-xs text-gray-500">{grp.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-xs text-gray-400 font-medium mr-1">Heads:</span>
                        {grp.groupHeads.length === 0 ? (
                          <span className="text-xs text-amber-500 italic">No heads linked</span>
                        ) : (
                          grp.groupHeads.map((gh) => (
                            <span
                              key={gh.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-xs font-medium"
                            >
                              <Tag className="w-3 h-3 text-indigo-500" />
                              {gh.feeHead.name}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <form
                      action={async () => {
                        "use server";
                        await deleteFeeGroup(grp.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                        title="Delete Fee Group"
                      >
                        <Trash2 className="w-4 h-4" />
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
