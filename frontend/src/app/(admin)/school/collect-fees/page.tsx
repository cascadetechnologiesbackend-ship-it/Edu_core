export const dynamic = "force-dynamic";

import { db } from "@/db";
import { schools, bankAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { QuickActionBar } from "@/components/finance/QuickActionBar";
import { CounterCollectionClient } from "./CounterCollectionClient";
import { searchStudentsAction } from "./actions";
import { CreditCard, Sparkles } from "lucide-react";

export default async function CollectFeesPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const [activeSchool, schoolBanks, initialStudentsRes] = await Promise.all([
    db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
    }),
    db.query.bankAccounts.findMany({
      where: and(eq(bankAccounts.schoolId, schoolId), eq(bankAccounts.isActive, true)),
    }),
    searchStudentsAction(""), // Initial first batch of students with dues summary
  ]);

  if (!activeSchool) return <div>School not found</div>;

  const mappedBanks = schoolBanks.map((b) => ({
    id: b.id,
    accountName: b.accountName,
    bankName: b.bankName,
    accountNumber: b.accountNumber,
  }));

  const initialStudents = initialStudentsRes.success && initialStudentsRes.students
    ? initialStudentsRes.students
    : [];

  return (
    <div className="space-y-6">
      {/* Finance Navigation Tabs */}
      <FinanceTabs activeSection="finance" />

      {/* Header Banner & Quick Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CreditCard className="w-3.5 h-3.5" /> POS Counter Terminal
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Collect Student Fees
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Rapid POS fee collection with multi-invoice settlement, dynamic UPI QR, cash change calculator, and instant 80mm thermal receipt printing.
          </p>
        </div>

        <QuickActionBar userRole={session.user.role} />
      </div>

      {/* Interactive POS Counter Terminal */}
      <CounterCollectionClient
        initialStudents={initialStudents}
        bankAccounts={mappedBanks}
        schoolName={activeSchool.name}
      />
    </div>
  );
}
