import { db } from "@/db";
import { feeInvoices, feePayments, students, academicYears } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { ExportButton } from "./ExportButton";
import { decryptData } from "@/lib/encryption";

export default async function FeeReportsPage() {
  const activeYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isActive, true),
  });

  if (!activeYear) return <div>No active academic year found.</div>;

  // 1. Fetch Collection Report Data
  // For MVP, we fetch all payments in this year, group them in memory.
  const allPayments = await db.query.feePayments.findMany({
    with: { invoice: true },
    orderBy: [desc(feePayments.paymentDate)],
  });

  // Very simplistic Daily grouping (limit to latest 10 days for UI)
  const collectionsByDate = allPayments.reduce(
    (acc, p) => {
      const dateStr =
        new Date(p.paymentDate).toISOString().split("T")[0] || "Unknown Date";
      if (!acc[dateStr]) acc[dateStr] = 0;
      acc[dateStr] += parseFloat(p.amountPaid);
      return acc;
    },
    {} as Record<string, number>,
  );

  const dailyCollectionData = Object.entries(collectionsByDate)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 10);

  // 2. Fetch Defaulter List (Ageing Buckets)
  const allInvoices = await db.query.feeInvoices.findMany({
    where: eq(feeInvoices.academicYearId, activeYear.id),
  });

  const pendingInvoices = allInvoices.filter(
    (i) =>
      ["PENDING", "PARTIAL", "OVERDUE"].includes(i.status) &&
      parseFloat(i.balanceAmount) > 0,
  );

  const ageingBuckets = {
    "0_30": 0,
    "31_60": 0,
    "61_90": 0,
    "90_plus": 0,
  };

  const today = new Date();

  const defaulterListForExport: any[] = [];

  const allStudentIds = Array.from(
    new Set(pendingInvoices.map((i) => i.studentId)),
  );
  let mappedStudents: Record<string, any> = {};
  if (allStudentIds.length > 0) {
    const s = await db.query.students.findMany({
      where: inArray(students.id, allStudentIds),
    });
    mappedStudents = s.reduce(
      (acc, student) => {
        acc[student.id] = {
          name: `${decryptData(student.firstNameEncrypted)} ${decryptData(student.lastNameEncrypted)}`.trim(),
          admissionNumber: student.admissionNumber,
        };
        return acc;
      },
      {} as Record<string, any>,
    );
  }

  pendingInvoices.forEach((inv) => {
    const diffTime = Math.abs(
      today.getTime() - new Date(inv.dueDate).getTime(),
    );
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Only count if overdue
    if (new Date(inv.dueDate) < today) {
      const balance = parseFloat(inv.balanceAmount);

      defaulterListForExport.push({
        Invoice: inv.invoiceNumber,
        Student: mappedStudents[inv.studentId]?.name || "Unknown",
        AdmissionNo: mappedStudents[inv.studentId]?.admissionNumber || "N/A",
        DueDate: new Date(inv.dueDate).toLocaleDateString(),
        OverdueDays: diffDays,
        Balance: balance,
      });

      if (diffDays <= 30) ageingBuckets["0_30"] += balance;
      else if (diffDays <= 60) ageingBuckets["31_60"] += balance;
      else if (diffDays <= 90) ageingBuckets["61_90"] += balance;
      else ageingBuckets["90_plus"] += balance;
    }
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Fee Reports & Analytics
          </h1>
          <p className="text-sm text-gray-500">
            Monitor collections, outstanding dues, and defaulters.
          </p>
        </div>
        <ExportButton
          data={defaulterListForExport}
          filename="Defaulter_List.xlsx"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Collections Overview */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow border border-gray-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold mb-4">
            Recent Daily Collections
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700 text-gray-500">
                  <th className="pb-3">Date</th>
                  <th className="pb-3 text-right">Total Collected (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {dailyCollectionData.map(([date, amount]) => (
                  <tr
                    key={date}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-3">{date}</td>
                    <td className="py-3 text-right font-medium text-green-600">
                      {amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {dailyCollectionData.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-8 text-center text-gray-500">
                      No collections recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ageing Buckets */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow border border-gray-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold mb-4">
            Defaulter Ageing Buckets
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 border rounded-lg">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                0 - 30 Days Overdue
              </span>
              <span className="text-lg font-bold text-red-500">
                ₹{ageingBuckets["0_30"].toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 border rounded-lg">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                31 - 60 Days Overdue
              </span>
              <span className="text-lg font-bold text-red-600">
                ₹{ageingBuckets["31_60"].toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 border rounded-lg">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                61 - 90 Days Overdue
              </span>
              <span className="text-lg font-bold text-red-700">
                ₹{ageingBuckets["61_90"].toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 border rounded-lg">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                90+ Days Overdue
              </span>
              <span className="text-lg font-bold text-red-800 dark:text-red-900">
                ₹{ageingBuckets["90_plus"].toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
