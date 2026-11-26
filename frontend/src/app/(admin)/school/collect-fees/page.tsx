export const dynamic = "force-dynamic";

import { db } from "@/db";
import { schools, bankAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCachedSession } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { QuickActionBar } from "@/components/finance/QuickActionBar";
import { CounterCollectionClient } from "./CounterCollectionClient";
import { CreditCard } from "lucide-react";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";

import { assertRouteAccess } from "@/lib/routeGuards";

export default async function CollectFeesPage() {
  const session = await getCachedSession();
  if (!session?.user?.schoolId) redirect("/login");

  const access = assertRouteAccess(session.user.role, "/school/collect-fees", {
    id: session.user.id,
    email: session.user.email ?? undefined,
    schoolId: session.user.schoolId,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = session.user.schoolId;

  const data = await withDataPhaseTiming("/school/collect-fees", async () => {
    return assertQueryBudget(
      async () => {
        const [activeSchool, schoolBanks] = await Promise.all([
          db.query.schools.findFirst({
            where: eq(schools.id, schoolId),
          }),
          db.query.bankAccounts.findMany({
            where: and(eq(bankAccounts.schoolId, schoolId), eq(bankAccounts.isActive, true)),
          }),
        ]);

        if (!activeSchool) return null;

        const mappedBanks = schoolBanks.map((b) => ({
          id: b.id,
          accountName: b.accountName,
          bankName: b.bankName,
          accountNumber: b.accountNumber,
        }));

        return {
          activeSchool,
          mappedBanks,
          initialStudents: [],
        };
      },
      { maxQueries: 5, label: "POS Landing (PF 1.2 <= 5 queries)" }
    );
  });

  if (!data?.activeSchool) return <div>School not found</div>;

  const schoolAddress = [
    data.activeSchool.address,
    data.activeSchool.city,
    data.activeSchool.state,
    data.activeSchool.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      {/* Finance Navigation Tabs */}
      <FinanceTabs activeSection="finance" />

      {/* Header Banner & Quick Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-3xl border border-border/40 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#248A3D]/10 dark:bg-[#30D158]/10 text-[#248A3D] dark:text-[#30D158] border border-[#248A3D]/20 dark:border-[#30D158]/20">
            <CreditCard className="w-3.5 h-3.5" /> POS Counter Terminal
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-2">
            Collect Student Fees
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rapid POS fee collection with multi-invoice settlement, dynamic UPI QR, cash change calculator, and instant 80mm thermal receipt printing.
          </p>
        </div>

        <QuickActionBar userRole={session.user.role} />
      </div>

      {/* Interactive POS Counter Terminal */}
      <CounterCollectionClient
        initialStudents={data.initialStudents}
        bankAccounts={data.mappedBanks}
        schoolName={data.activeSchool.name}
        schoolAddress={schoolAddress}
        schoolPhone={data.activeSchool.phone}
      />
    </div>
  );
}
