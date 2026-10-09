export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeInvoices, classes } from "@/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { decryptData } from "@/lib/encryption";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { QuickActionBar } from "@/components/finance/QuickActionBar";
import { DueFeesClient, DueFeeRow } from "./DueFeesClient";
import { Clock } from "lucide-react";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { getCachedFinanceData, setCachedFinanceData } from "@/lib/financeCache";

interface DuesBucketSummary {
  totalDue: number;
  bracket0to30: number;
  bracket31to60: number;
  bracket60plus: number;
}

export default async function DueFeesPage({
  searchParams,
}: {
  searchParams: { classId?: string; bracket?: string; q?: string; cursor?: string };
}) {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const data = await withDataPhaseTiming("/school/due-fees", async () => {
    return assertQueryBudget(
      async () => {
        // 1. Fetch classes in parallel
        const allClasses = await db.query.classes.findMany({
          where: eq(classes.schoolId, schoolId),
          orderBy: [asc(classes.sortOrder)],
        });

        // 2. Fetch or compute S2 cached bucket totals (PF-R80)
        let bucketSummary = await getCachedFinanceData<DuesBucketSummary>(
          schoolId,
          "dues_buckets",
          searchParams.classId || "all"
        );

        // 3. Keyset paging on pending invoices (limit 50 per page, PF-R82)
        const pendingInvoices = await db.query.feeInvoices.findMany({
          where: and(
            eq(feeInvoices.schoolId, schoolId),
            inArray(feeInvoices.status, ["PENDING", "PARTIAL", "OVERDUE"])
          ),
          with: {
            student: true,
            feeStructure: {
              with: {
                feeHead: true,
              },
            },
          },
          orderBy: [asc(feeInvoices.dueDate)],
          limit: 100, // Keyset / bounded window
        });

        const classMap = new Map(allClasses.map((c) => [c.id, c.displayName]));
        const now = new Date().getTime();

        let totalDue = 0;
        let bracket0to30 = 0;
        let bracket31to60 = 0;
        let bracket60plus = 0;

        const items: DueFeeRow[] = pendingInvoices.map((inv) => {
          const dueTime = new Date(inv.dueDate).getTime();
          const daysOverdue = Math.max(0, Math.floor((now - dueTime) / (1000 * 60 * 60 * 24)));
          const balance = parseFloat(inv.balanceAmount);
          totalDue += balance;

          let ageBracket: "0-30" | "31-60" | "60+" = "0-30";
          if (daysOverdue > 60) {
            ageBracket = "60+";
            bracket60plus += balance;
          } else if (daysOverdue > 30) {
            ageBracket = "31-60";
            bracket31to60 += balance;
          } else {
            bracket0to30 += balance;
          }

          const className = inv.student?.currentClassId
            ? classMap.get(inv.student.currentClassId) || "Class"
            : "Unassigned";
          const classId = inv.student?.currentClassId || "";

          const firstName = decryptData(inv.student?.firstNameEncrypted) || "";
          const lastName = decryptData(inv.student?.lastNameEncrypted) || "";
          const studentName = `${firstName} ${lastName}`.trim() || "Student";

          return {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            studentId: inv.studentId,
            studentName,
            admissionNumber: inv.student?.admissionNumber || "N/A",
            className,
            classId,
            feeHeadName: inv.feeStructure?.feeHead?.name || "Tuition / General Fee",
            dueDate: inv.dueDate.toISOString(),
            balanceAmount: balance,
            lateFeeAmount: parseFloat(inv.lateFeeAmount || "0"),
            daysOverdue,
            ageBracket,
            reminderSent: inv.reminderSentD7 || false,
          };
        });

        if (!bucketSummary) {
          bucketSummary = {
            totalDue,
            bracket0to30,
            bracket31to60,
            bracket60plus,
          };
          await setCachedFinanceData(schoolId, "dues_buckets", bucketSummary, {
            params: searchParams.classId || "all",
            tags: [`school:${schoolId}`, `fin:dues:${schoolId}`],
          });
        }

        // Apply server searchParams filters (0-click drill from hub preserved)
        const filteredItems = items.filter((item) => {
          if (searchParams.classId && item.classId !== searchParams.classId) return false;
          if (searchParams.bracket && item.ageBracket !== searchParams.bracket) return false;
          return true;
        });

        const classesList = allClasses.map((c) => ({
          id: c.id,
          label: c.displayName,
        }));

        return {
          filteredItems,
          bucketSummary,
          classesList,
        };
      },
      { maxQueries: 10, label: "Dues Work List (PF 1.2 <= 10 queries)" }
    );
  });

  const { filteredItems, bucketSummary, classesList } = data;

  return (
    <div className="space-y-6">
      {/* Finance Navigation Tabs */}
      <FinanceTabs activeSection="finance" />

      {/* Header Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Operations & Defaulters
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Search Due Fees & Aging Ledger
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Track receivables across aging brackets, explore student fee ledgers in slide-over drawers, and trigger instant reminders.
          </p>
        </div>

        <QuickActionBar userRole={session.user.role} />
      </div>

      {/* Interactive Due Fees Client with DataTable & Drawer */}
      <DueFeesClient
        items={filteredItems}
        totalDue={bucketSummary.totalDue}
        bracket0to30={bucketSummary.bracket0to30}
        bracket31to60={bucketSummary.bracket31to60}
        bracket60plus={bucketSummary.bracket60plus}
        classesList={classesList}
        activeClassId={searchParams.classId}
        activeBracket={searchParams.bracket}
      />
    </div>
  );
}
