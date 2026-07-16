import { db } from "@/db";
import { examTypes, academicYears } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createExam } from "../actions";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Exam | SchoolMitra ERP",
};

export default async function NewExamPage() {
  const activeYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isActive, true),
  });

  const allExamTypes = await db.query.examTypes.findMany({
    where: eq(examTypes.isActive, true),
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create New Exam</h1>
        <p className="text-sm text-gray-500">
          Schedule a new examination for {activeYear?.label ?? "the current academic year"}.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-6">
        <form action={createExam as any} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">Exam Name *</label>
            <input
              name="name"
              required
              placeholder="e.g., Unit Test 1 — July 2025"
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Exam Type *</label>
            <select
              name="examTypeId"
              required
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm"
            >
              <option value="">-- Select Type --</option>
              {allExamTypes.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.name}
                </option>
              ))}
            </select>
            {allExamTypes.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No exam types found. Please create exam types in settings first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date *</label>
              <input
                type="date"
                name="startDate"
                required
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date *</label>
              <input
                type="date"
                name="endDate"
                required
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <a
              href="/exams"
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </a>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              Create Exam
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
