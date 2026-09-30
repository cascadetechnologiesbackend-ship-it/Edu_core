import { db } from "@/db";
import { feeInvoices, students, feePayments, auditLogs } from "@/db/schema";
import { eq, desc, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { decryptData } from "@/lib/encryption";
import { CheckoutButton } from "./CheckoutButton";
import Link from "next/link";

export default async function ParentFeesPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return <div className="p-6">Please log in to view fees.</div>;
  }

  const parentUserId = session.user.id;
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session.user.role);

  // Find students linked to this parent (primary_parent_user_id)
  let myStudents = await db.query.students.findMany({
    where: eq(students.primaryParentUserId, parentUserId),
  });

  // If Admin and no students, fetch a demo student for preview
  if (myStudents.length === 0 && isAdmin) {
    const demoStudent = await db.query.students.findFirst({
      where: isNotNull(students.primaryParentUserId),
    });
    if (demoStudent) myStudents = [demoStudent];
  }

  if (myStudents.length === 0) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-red-600 mb-2">
          Access Restricted
        </h2>
        <p>
          No students linked to your account. If you are a parent, please
          contact the school administration.
        </p>
        {isAdmin && (
          <p className="mt-4 text-sm text-gray-500">
            Note: As an admin, a demo student would be shown here if any existed
            in the database.
          </p>
        )}
      </div>
    );
  }

  // Fetch dues and history
  const allInvoices = [];
  const allPayments = [];

  for (const student of myStudents) {
    // DPDP AUDIT LOGGING
    await db.insert(auditLogs).values({
      schoolId: student.schoolId,
      userId: parentUserId,
      userEmail: session.user.email || "unknown@parent",
      userRole: "PARENT",
      action: "READ",
      tableName: "fee_invoices",
      recordId: student.id,
      ipAddress: "127.0.0.1",
      userAgent: "ParentPortal",
      metadata: { note: "Parent viewed student fee ledger" },
    });

    const studentInvoices = await db.query.feeInvoices.findMany({
      where: eq(feeInvoices.studentId, student.id),
      with: { feeStructure: { with: { feeHead: true } } },
      orderBy: [desc(feeInvoices.dueDate)],
    });

    allInvoices.push(...studentInvoices.map((i) => ({ ...i, student })));

    const studentPayments = await db.query.feePayments.findMany({
      where: eq(feePayments.studentId, student.id),
      orderBy: [desc(feePayments.paymentDate)],
    });

    allPayments.push(...studentPayments.map((p) => ({ ...p, student })));
  }

  const pendingInvoices = allInvoices.filter((i) =>
    ["PENDING", "PARTIAL", "OVERDUE"].includes(i.status),
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Fee Management
          </h1>
          <p className="text-sm text-gray-500">
            View current dues and payment history for your wards.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md font-semibold">
            Fees & Dues
          </span>
          <Link
            href="/portal/report-cards"
            className="px-4 py-2 text-sm bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 dark:bg-slate-900 dark:border-slate-800 dark:text-gray-300 transition-colors"
          >
            Report Cards
          </Link>
          <Link
            href="/portal/consent"
            className="px-4 py-2 text-sm bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 dark:bg-slate-900 dark:border-slate-800 dark:text-gray-300 transition-colors"
          >
            Consent Center
          </Link>
          <Link
            href="/portal/rights"
            className="px-4 py-2 text-sm bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 dark:bg-slate-900 dark:border-slate-800 dark:text-gray-300 transition-colors"
          >
            Subject Rights
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow border border-gray-200 dark:border-slate-800 space-y-6">
        <h2 className="text-lg font-semibold">Current Dues</h2>

        {pendingInvoices.length === 0 ? (
          <p className="text-gray-500">No pending dues.</p>
        ) : (
          <div className="space-y-4">
            {pendingInvoices.map((inv) => {
              const fName =
                decryptData(inv.student.firstNameEncrypted) || "Student";
              return (
                <div
                  key={inv.id}
                  className="flex justify-between items-center p-4 border rounded-lg bg-gray-50 dark:bg-slate-800 dark:border-slate-700"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {fName} - {(inv.feeStructure?.feeHead as any)?.name} (
                      {inv.term})
                    </h3>
                    <p className="text-sm text-gray-500">
                      Invoice: {inv.invoiceNumber} | Due:{" "}
                      {inv.dueDate.toLocaleDateString()}
                    </p>
                    <p className="text-sm mt-1">
                      Gross: ₹{inv.grossAmount} | Discount: ₹
                      {inv.discountAmount} | Late Fee: ₹{inv.lateFeeAmount}
                    </p>
                  </div>
                  <div className="text-right flex flex-col gap-2">
                    <span className="text-xl font-bold text-red-600 dark:text-red-400">
                      ₹{inv.balanceAmount}
                    </span>
                    <CheckoutButton
                      invoiceId={inv.id}
                      amount={parseFloat(inv.balanceAmount)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow border border-gray-200 dark:border-slate-800 mt-8">
        <h2 className="text-lg font-semibold mb-4">Payment History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700 text-gray-500">
                <th className="pb-3">Date</th>
                <th className="pb-3">Student</th>
                <th className="pb-3">Receipt No</th>
                <th className="pb-3">Method</th>
                <th className="pb-3 text-right">Amount Paid</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {allPayments.map((p) => {
                const fName =
                  decryptData(p.student.firstNameEncrypted) || "Student";
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-3">
                      {p.paymentDate.toLocaleDateString()}
                    </td>
                    <td className="py-3">{fName}</td>
                    <td className="py-3 font-mono">{p.receiptNumber}</td>
                    <td className="py-3">{p.paymentMethod}</td>
                    <td className="py-3 text-right font-medium text-green-600">
                      ₹{p.amountPaid}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/fees/receipt/${p.id}` as any}
                        className="text-blue-600 hover:underline"
                      >
                        Download PDF
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {allPayments.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No payment history found.
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
