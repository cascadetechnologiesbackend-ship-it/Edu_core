export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeInvoices, students, schools, bankAccounts, classes } from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { decryptData } from "@/lib/encryption";
import { FinanceSubNav } from "@/components/layout/FinanceSubNav";
import { CounterCollectionClient } from "./CounterCollectionClient";
import { CreditCard } from "lucide-react";

export default async function CollectFeesPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const [activeSchool, pendingInvoices, schoolBanks, allClasses] = await Promise.all([
    db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
    }),
    db.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.schoolId, schoolId),
        inArray(feeInvoices.status, ["PENDING", "PARTIAL", "OVERDUE"]),
      ),
      with: {
        feeStructure: {
          with: {
            feeHead: true,
          },
        },
      },
      orderBy: [desc(feeInvoices.dueDate)],
    }),
    db.query.bankAccounts.findMany({
      where: and(eq(bankAccounts.schoolId, schoolId), eq(bankAccounts.isActive, true)),
    }),
    db.query.classes.findMany({
      where: eq(classes.schoolId, schoolId),
    }),
  ]);

  if (!activeSchool) return <div>School not found</div>;

  const studentIds = Array.from(new Set(pendingInvoices.map((i) => i.studentId)));

  let relatedStudents: any[] = [];
  if (studentIds.length > 0) {
    relatedStudents = await db.query.students.findMany({
      where: inArray(students.id, studentIds),
    });
  }

  const classMap = new Map(allClasses.map((c) => [c.id, c.displayName]));

  const mappedStudents = relatedStudents.map((s) => {
    const className = s.currentClassId ? classMap.get(s.currentClassId) || "Class" : "Unassigned";
    return {
      id: s.id,
      admissionNumber: s.admissionNumber,
      name: `${decryptData(s.firstNameEncrypted) || ""} ${decryptData(s.lastNameEncrypted) || ""}`.trim() || "Student",
      className,
    };
  });

  const mappedInvoices = pendingInvoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    studentId: inv.studentId,
    feeHeadName: inv.feeStructure?.feeHead?.name || "Fee Invoice",
    term: inv.term,
    dueDate: inv.dueDate.toISOString(),
    grossAmount: inv.grossAmount,
    paidAmount: inv.paidAmount,
    balanceAmount: inv.balanceAmount,
    status: inv.status,
  }));

  const mappedBanks = schoolBanks.map((b) => ({
    id: b.id,
    accountName: b.accountName,
    bankName: b.bankName,
    accountNumber: b.accountNumber,
  }));

  return (
    <div className="space-y-6">
      <FinanceSubNav activeSection="operations" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CreditCard className="w-3.5 h-3.5" /> Operations & Transactions
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Collect Student Fees
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Offline fee counter for Cash, Cheque, UPI, DD, and Bank Transfers with instant thermal receipt & PDF invoice issuance.
          </p>
        </div>
      </div>

      <CounterCollectionClient
        students={mappedStudents}
        invoices={mappedInvoices}
        bankAccounts={mappedBanks}
        schoolName={activeSchool.name}
      />
    </div>
  );
}
