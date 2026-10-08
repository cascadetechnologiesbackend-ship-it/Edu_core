export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feePayments, schools } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { decryptData } from "@/lib/encryption";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { QuickActionBar } from "@/components/finance/QuickActionBar";
import { DayBookClient, TransactionRow } from "./DayBookClient";
import { ListOrdered } from "lucide-react";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { method?: string; q?: string };
}) {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const [activeSchool, payments] = await Promise.all([
    db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
    }),
    db.query.feePayments.findMany({
      where: eq(feePayments.schoolId, schoolId),
      with: {
        student: true,
        invoice: {
          with: {
            feeStructure: {
              with: {
                feeHead: true,
              },
            },
          },
        },
        collectedBy: true,
      },
      orderBy: [desc(feePayments.paymentDate)],
      limit: 200,
    }),
  ]);

  if (!activeSchool) return <div>School not found</div>;

  const filtered = searchParams.method
    ? payments.filter((p) => p.paymentMethod === searchParams.method)
    : payments;

  const totalCollected = filtered.reduce((acc, p) => acc + parseFloat(p.amountPaid), 0);

  const mappedTransactions: TransactionRow[] = filtered.map((p) => {
    const firstName = decryptData(p.student?.firstNameEncrypted) || "";
    const lastName = decryptData(p.student?.lastNameEncrypted) || "";
    const studentName = `${firstName} ${lastName}`.trim() || "Student";

    return {
      id: p.id,
      receiptNumber: p.receiptNumber,
      invoiceNumber: p.invoice?.invoiceNumber || "N/A",
      studentId: p.studentId,
      studentName,
      admissionNumber: p.student?.admissionNumber || "N/A",
      feeHeadName: p.invoice?.feeStructure?.feeHead?.name || "Tuition Fee",
      term: p.invoice?.term || "ANNUAL",
      paymentMethod: p.paymentMethod,
      transactionReference: p.transactionReference,
      paymentDate: p.paymentDate.toISOString(),
      amountPaid: parseFloat(p.amountPaid),
      remarks: p.remarks,
      collectedByName: p.collectedBy?.email || undefined,
      grossAmount: p.invoice ? parseFloat(p.invoice.grossAmount) : undefined,
      balanceRemaining: p.invoice ? parseFloat(p.invoice.balanceAmount) : undefined,
    };
  });

  return (
    <div className="space-y-6">
      {/* Finance Navigation Tabs */}
      <FinanceTabs activeSection="finance" />

      {/* Header Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <ListOrdered className="w-3.5 h-3.5" /> Operations & Day Book
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Central Fee Transactions Ledger
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Complete transaction register with thermal receipt reprinting, Excel export, and audited reversal guard.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl px-5 py-3 text-right">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase">
              Filtered Collection Total
            </p>
            <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-300">
              ₹{totalCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>

          <QuickActionBar userRole={session.user.role} />
        </div>
      </div>

      {/* Day Book Client */}
      <DayBookClient
        transactions={mappedTransactions}
        schoolName={activeSchool.name}
        userRole={session.user.role}
        activeMethod={searchParams.method}
      />
    </div>
  );
}
