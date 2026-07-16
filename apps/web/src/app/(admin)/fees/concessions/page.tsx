import { db } from "@/db";
import { feeConcessions, students, feeHeads, academicYears } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createFeeConcession } from "./actions";
import { decryptData } from "@/lib/encryption";

export default async function FeeConcessionsPage() {
  const activeSchool = await db.query.schools.findFirst();
  const activeYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isActive, true),
  });

  if (!activeSchool || !activeYear) return <div>No active school/year.</div>;

  const allStudents = await db.query.students.findMany({
    where: eq(students.schoolId, activeSchool.id),
    limit: 100, // In reality, we'd use a search API, but keeping it simple for the MVP
  });

  const existingHeads = await db.query.feeHeads.findMany({
    where: eq(feeHeads.schoolId, activeSchool.id),
  });

  const existingConcessions = await db.query.feeConcessions.findMany({
    where: eq(feeConcessions.academicYearId, activeYear.id),
    orderBy: [desc(feeConcessions.createdAt)],
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Fee Concessions
        </h1>
        <p className="text-sm text-gray-500">
          Manage student fee concessions & scholarships.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow border border-gray-200 dark:border-slate-800 space-y-6 max-w-2xl">
        <h2 className="text-lg font-semibold">Grant New Concession</h2>
        <form action={createFeeConcession as any} className="space-y-4">
          <input type="hidden" name="schoolId" value={activeSchool.id} />
          <input type="hidden" name="academicYearId" value={activeYear.id} />
          <input
            type="hidden"
            name="approvedById"
            value={
              activeSchool.id /* using school id as mock approver id for now */
            }
          />

          <div>
            <label className="block text-sm font-medium mb-1">Student</label>
            <select
              name="studentId"
              required
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
            >
              <option value="">-- Select Student --</option>
              {allStudents.map((s) => {
                const fName = decryptData(s.firstNameEncrypted) || "Unknown";
                const lName = decryptData(s.lastNameEncrypted) || "";
                return (
                  <option key={s.id} value={s.id}>
                    {s.admissionNumber} - {fName} {lName}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Concession Type
              </label>
              <select
                name="concessionType"
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
              >
                <option value="STAFF_WARD">Staff Ward</option>
                <option value="SIBLING">Sibling Discount</option>
                <option value="RTE_FREE">RTE (Free Education)</option>
                <option value="MERIT_SCHOLARSHIP">Merit Scholarship</option>
                <option value="CUSTOM">Custom</option>
                <option value="MANAGEMENT_QUOTA">Management Quota</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Concession Name
              </label>
              <input
                type="text"
                name="concessionName"
                required
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
                placeholder="e.g. RTE 100%"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Applies To
              </label>
              <select
                name="appliesTo"
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
              >
                <option value="ALL">All Fees</option>
                {existingHeads.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Discount %
              </label>
              <input
                type="number"
                step="0.01"
                name="discountPercentage"
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Fixed Discount (₹)
              </label>
              <input
                type="number"
                step="0.01"
                name="discountAmount"
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-medium py-2 rounded-md hover:bg-blue-700"
          >
            Grant Concession
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow border border-gray-200 dark:border-slate-800 mt-8">
        <h2 className="text-lg font-semibold mb-4">Granted Concessions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700 text-gray-500">
                <th className="pb-3">Student ID</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Name</th>
                <th className="pb-3">Applies To</th>
                <th className="pb-3 text-right">Discount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {existingConcessions.map((c: any) => (
                <tr
                  key={c.id}
                  className="hover:bg-gray-50 dark:hover:bg-slate-800/50"
                >
                  <td className="py-3 font-mono text-xs">
                    {c.studentId.slice(0, 8)}...
                  </td>
                  <td className="py-3">
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                      {c.concessionType}
                    </span>
                  </td>
                  <td className="py-3">{c.concessionName}</td>
                  <td className="py-3">
                    {c.appliesTo === "ALL" ? "All Fees" : "Specific Head"}
                  </td>
                  <td className="py-3 text-right font-medium text-green-600">
                    {c.discountPercentage
                      ? `${c.discountPercentage}%`
                      : `₹${c.discountAmount}`}
                  </td>
                </tr>
              ))}
              {existingConcessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    No concessions granted.
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
