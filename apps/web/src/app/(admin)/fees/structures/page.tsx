import { db } from "@/db";
import { feeHeads, feeStructures, classes, academicYears, schools } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { createFeeHead, createFeeStructure } from "./actions";
import { getCached, setCached } from "@/lib/cache";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function FeeStructuresPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const activeSchool = await db.query.schools.findFirst({
    where: eq(schools.id, session.user.schoolId),
  });
  const activeYear = await db.query.academicYears.findFirst({
    where: and(
      eq(academicYears.isActive, true),
      eq(academicYears.schoolId, session.user.schoolId),
    ),
  });

  if (!activeSchool || !activeYear) return <div>No active school/year.</div>;

  const allClasses = await db.query.classes.findMany({
    where: eq(classes.academicYearId, activeYear.id),
    orderBy: [classes.sortOrder],
  });

  const existingHeads = await db.query.feeHeads.findMany({
    where: eq(feeHeads.schoolId, activeSchool.id),
    orderBy: [desc(feeHeads.createdAt)],
  });

  const cacheKey = `feeStructures:${activeYear.id}`;
  let existingStructures = await getCached<any[]>(cacheKey);

  if (!existingStructures) {
    existingStructures = await db.query.feeStructures.findMany({
      where: eq(feeStructures.academicYearId, activeYear.id),
      orderBy: [desc(feeStructures.createdAt)],
      with: {
        feeHead: true,
        class: true,
      },
    });
    // Parse dates to string for caching, or just cache as is and let hydration handle it
    await setCached(cacheKey, existingStructures);
  } else {
    // Re-hydrate Date objects since JSON.parse leaves them as strings
    existingStructures = existingStructures.map((s) => ({
      ...s,
      dueDate: new Date(s.dueDate),
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
    }));
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Fee Structures Setup
        </h1>
        <p className="text-sm text-gray-500">
          Configure fee heads and structures for {activeYear.label}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Fee Heads */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow border border-gray-200 dark:border-slate-800 space-y-6">
          <h2 className="text-lg font-semibold">1. Create Fee Head</h2>
          <form action={createFeeHead as any} className="space-y-4">
            <input type="hidden" name="schoolId" value={activeSchool.id} />

            <div>
              <label className="block text-sm font-medium mb-1">
                Head Name
              </label>
              <input
                type="text"
                name="name"
                required
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
                placeholder="e.g. Tuition Fee"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Head Type
              </label>
              <select
                name="headType"
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
              >
                <option value="TUITION">Tuition</option>
                <option value="TRANSPORT">Transport</option>
                <option value="LIBRARY">Library</option>
                <option value="LAB">Lab</option>
                <option value="SPORTS">Sports</option>
                <option value="MISCELLANEOUS">Miscellaneous</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-medium py-2 rounded-md hover:bg-blue-700"
            >
              Create Fee Head
            </button>
          </form>

          <div className="mt-6 border-t pt-4">
            <h3 className="text-sm font-medium mb-3">Existing Heads</h3>
            <ul className="space-y-2">
              {existingHeads.map((head) => (
                <li
                  key={head.id}
                  className="text-sm flex justify-between bg-gray-50 dark:bg-slate-800 p-2 rounded"
                >
                  <span>{head.name}</span>
                  <span className="text-gray-500 text-xs bg-gray-200 dark:bg-slate-700 px-2 py-0.5 rounded">
                    {head.headType}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Fee Structures */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow border border-gray-200 dark:border-slate-800 space-y-6">
          <h2 className="text-lg font-semibold">
            2. Assign Structure to Class
          </h2>
          <form action={createFeeStructure as any} className="space-y-4">
            <input type="hidden" name="schoolId" value={activeSchool.id} />
            <input type="hidden" name="academicYearId" value={activeYear.id} />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Class</label>
                <select
                  name="classId"
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
                >
                  {allClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Fee Head
                </label>
                <select
                  name="feeHeadId"
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
                >
                  {existingHeads.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Term</label>
                <select
                  name="term"
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="HALF_YEARLY">Half Yearly</option>
                  <option value="ANNUAL">Annual</option>
                  <option value="ONE_TIME">One Time</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Due Date</label>
              <input
                type="datetime-local"
                name="dueDate"
                required
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
              />
            </div>

            <div className="border p-4 rounded-md space-y-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Late Fee Rules (Optional)
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs mb-1">Type</label>
                  <select
                    name="lateFeeType"
                    className="w-full rounded border border-gray-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm"
                  >
                    <option value="">None</option>
                    <option value="FLAT">Flat</option>
                    <option value="PERCENTAGE">Percentage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1">Penalty</label>
                  <input
                    type="number"
                    step="0.01"
                    name="lateFeeAmount"
                    className="w-full rounded border border-gray-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">After (Days)</label>
                  <input
                    type="number"
                    name="lateFeeStartAfterDays"
                    className="w-full rounded border border-gray-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-green-600 text-white font-medium py-2 rounded-md hover:bg-green-700"
            >
              Save Structure
            </button>
          </form>
        </div>
      </div>

      {/* Existing Structures Table */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow border border-gray-200 dark:border-slate-800 mt-8">
        <h2 className="text-lg font-semibold mb-4">Active Fee Structures</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700 text-gray-500">
                <th className="pb-3">Class</th>
                <th className="pb-3">Head</th>
                <th className="pb-3">Term</th>
                <th className="pb-3 text-right">Amount (₹)</th>
                <th className="pb-3 text-right">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {existingStructures.map((s: any) => (
                <tr
                  key={s.id}
                  className="hover:bg-gray-50 dark:hover:bg-slate-800/50"
                >
                  <td className="py-3">{s.class?.displayName}</td>
                  <td className="py-3">{s.feeHead?.name}</td>
                  <td className="py-3">
                    <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded">
                      {s.term}
                    </span>
                  </td>
                  <td className="py-3 text-right font-medium">{s.amount}</td>
                  <td className="py-3 text-right text-gray-500">
                    {s.dueDate.toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {existingStructures.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    No fee structures configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
