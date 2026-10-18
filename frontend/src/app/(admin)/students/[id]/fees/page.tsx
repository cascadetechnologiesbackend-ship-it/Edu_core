import { db, withTenant } from "@/db";
import { feeInvoices, students, feePayments } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { assertRouteAccess } from "@/lib/routeGuards";
import { GenerateInvoicesButton } from "./GenerateInvoicesButton";

export default async function StudentFeeLedgerPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, `/students/${params.id}`, { id: ctx.userId, email: ctx.email });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const school = await requireSchool(ctx);
  const studentId = decodeURIComponent(params.id).trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId);
  const studentWhere = isUuid
    ? and(eq(students.id, studentId), eq(students.schoolId, school.id))
    : and(eq(students.admissionNumber, studentId), eq(students.schoolId, school.id));

  const result = await withTenant(school.id, async (tx) => {
    const student = await tx.query.students.findFirst({
      where: studentWhere,
    });

    if (!student) {
      return null;
    }

    const studentInvoices = await tx.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.studentId, student.id),
        eq(feeInvoices.schoolId, school.id),
      ),
      with: { feeStructure: { with: { feeHead: true } } },
      orderBy: [desc(feeInvoices.dueDate)],
    });

    const studentPayments = await tx.query.feePayments.findMany({
      where: and(
        eq(feePayments.studentId, student.id),
        eq(feePayments.schoolId, school.id),
      ),
      orderBy: [desc(feePayments.paymentDate)],
    });

    return { student, studentInvoices, studentPayments };
  });

  if (!result) {
    notFound();
  }

  const { student, studentInvoices, studentPayments } = result;
  const name = `${decryptData(student.firstNameEncrypted) || "Student"} ${decryptData(student.lastNameEncrypted) || ""}`.trim();

  // Calculate totals
  let totalBilled = 0;
  let totalPaid = 0;
  let totalBalance = 0;
  let totalConcessions = 0;

  studentInvoices.forEach((inv) => {
    totalBilled += parseFloat(inv.grossAmount || "0");
    totalConcessions += parseFloat(inv.discountAmount || "0");
    totalPaid += parseFloat(inv.paidAmount || "0");
    totalBalance += parseFloat(inv.balanceAmount || "0");
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href={`/students/${student.id}`}
              className="text-blue-600 hover:underline text-sm font-medium"
            >
              &larr; Back to Profile
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Fee Ledger: {name}
          </h1>
          <p className="text-sm text-gray-500">
            Admission No: {student.admissionNumber}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <GenerateInvoicesButton studentId={student.id} />
          <Link
            href={`/fees/collect?studentId=${student.id}`}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors"
          >
            Collect Payment
          </Link>
        </div>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
          <p className="text-sm text-gray-500 font-medium">Total Billed</p>
          <p className="text-2xl font-bold mt-1">₹{totalBilled.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
          <p className="text-sm text-gray-500 font-medium">Total Concessions</p>
          <p className="text-2xl font-bold mt-1 text-green-600">
            ₹{totalConcessions.toFixed(2)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
          <p className="text-sm text-gray-500 font-medium">Total Paid</p>
          <p className="text-2xl font-bold mt-1 text-blue-600">
            ₹{totalPaid.toFixed(2)}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl shadow-sm border border-red-200 dark:border-red-900/30">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">
            Outstanding Balance
          </p>
          <p className="text-2xl font-bold mt-1 text-red-700 dark:text-red-500">
            ₹{totalBalance.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Invoices */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Fee Types & Billing
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
            {studentInvoices.length === 0 ? (
              <p className="p-4 text-gray-500 text-sm">No fee items found.</p>
            ) : (
              studentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">
                        {inv.feeStructure?.feeHead?.name || "Fee Type"}
                      </span>
                      <span className="block text-xs font-mono text-gray-400">
                        #{inv.invoiceNumber} • {inv.term}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        inv.status === "PAID"
                          ? "bg-green-100 text-green-800"
                          : inv.status === "PARTIAL"
                            ? "bg-yellow-100 text-yellow-800"
                            : inv.status === "OVERDUE"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-gray-500" suppressHydrationWarning>
                      Due: {new Date(inv.dueDate).toLocaleDateString("en-IN", { timeZone: "UTC" })}
                    </span>
                    <span className="font-semibold">Net: ₹{inv.netAmount}</span>
                  </div>
                  {parseFloat(inv.balanceAmount) > 0 && (
                    <div className="text-right text-sm text-red-600 mt-1 font-medium">
                      Balance: ₹{inv.balanceAmount}
                    </div>
                  )}
                </div>
              ))
            )}
                </div>
        </div>

          {/* Payments */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Payment History
              </h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
              {studentPayments.length === 0 ? (
                <p className="p-4 text-gray-500 text-sm">No payments recorded.</p>
              ) : (
                studentPayments.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm">
                        {p.receiptNumber}
                      </span>
                      <span className="font-semibold text-green-600">
                        ₹{p.amountPaid}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span suppressHydrationWarning>{new Date(p.paymentDate).toLocaleDateString("en-IN", { timeZone: "UTC" })}</span>
                      <span className="uppercase">{p.paymentMethod}</span>
                    </div>
                    {p.transactionReference && (
                      <div className="text-xs text-gray-400 mt-1 font-mono">
                        Txn: {p.transactionReference}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      );
}
