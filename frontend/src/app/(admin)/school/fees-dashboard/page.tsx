export const dynamic = "force-dynamic";

import { db } from "@/db";
import {
  feeInvoices,
  feePayments,
  classes,
  academicYears,
  schools,
} from "@/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { decryptData } from "@/lib/encryption";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { QuickActionBar } from "@/components/finance/QuickActionBar";
import {
  FeesDashboardClient,
  DashboardKPIs,
  AgingSummary,
  DefaulterItem,
  RecentPaymentItem,
  ModeBreakdownItem,
  ClassStatItem,
} from "./FeesDashboardClient";
import { BarChart3 } from "lucide-react";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { getCachedFinanceData, setCachedFinanceData } from "@/lib/financeCache";

interface CachedBands23Payload {
  kpisBands23: {
    totalBilled: number;
    totalCollected: number;
    totalDues: number;
    recoveryRate: number;
    overdue60Plus: number;
  };
  aging: AgingSummary;
  topDefaulters: DefaulterItem[];
  recentPayments: RecentPaymentItem[];
  modeBreakdown: ModeBreakdownItem[];
  classStats: ClassStatItem[];
}

export default async function FeesDashboardPage({
  searchParams,
}: {
  searchParams: { ayId?: string };
}) {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  // Execute consolidated data phase with server timing spans and query budget assert (limit <= 5)
  const data = await withDataPhaseTiming("/school/fees-dashboard", async () => {
    return assertQueryBudget(
      async () => {
        // 1. Parallel fetch of master configuration: Active School, Academic Years & Classes
        const [activeSchool, allAcademicYears, allClasses] = await Promise.all([
          db.query.schools.findFirst({
            where: eq(schools.id, schoolId),
          }),
          db.query.academicYears.findMany({
            where: eq(academicYears.schoolId, schoolId),
            orderBy: [desc(academicYears.startDate)],
          }),
          db.query.classes.findMany({
            where: eq(classes.schoolId, schoolId),
          }),
        ]);

        if (!activeSchool) return null;

        // Resolve selected academic year
        const selectedYear =
          (searchParams.ayId
            ? allAcademicYears.find((ay) => ay.id === searchParams.ayId)
            : null) ||
          allAcademicYears.find((ay) => ay.isActive) ||
          allAcademicYears[0];

        const selectedAyId = selectedYear?.id || "";

        // Today's boundaries for S1 live counter
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 2. Band 1: S1 Live Counter - Fetch today's payments (1 scoped indexed query)
        const todayPaymentsPromise = db.query.feePayments.findMany({
          where: and(
            eq(feePayments.schoolId, schoolId),
            gte(feePayments.paymentDate, today)
          ),
          columns: {
            amountPaid: true,
          },
        });

        // 3. Band 2 & 3: Check S2 Cache (Jittered 270s-330s)
        const cachedBands23 = await getCachedFinanceData<CachedBands23Payload>(
          schoolId,
          "hub_bands23",
          selectedAyId
        );

        let bands23Data: CachedBands23Payload;

        if (cachedBands23) {
          // Cache HIT: 0 queries for Bands 2 & 3!
          const todayPayments = await todayPaymentsPromise;
          let todayCollected = 0;
          for (const p of todayPayments) {
            todayCollected += parseFloat(p.amountPaid || "0");
          }

          return {
            activeSchool,
            allAcademicYears,
            allClasses,
            selectedAyId,
            todayCollected,
            todayPaymentsCount: todayPayments.length,
            ...cachedBands23,
          };
        }

        // Cache MISS: Run remaining queries to populate Band 2 & 3
        const [todayPayments, invoices, payments, dailyRollup] = await Promise.all([
          todayPaymentsPromise,
          db.query.feeInvoices.findMany({
            where: selectedAyId
              ? and(
                  eq(feeInvoices.schoolId, schoolId),
                  eq(feeInvoices.academicYearId, selectedAyId)
                )
              : eq(feeInvoices.schoolId, schoolId),
            with: {
              student: true,
            },
            limit: 500,
          }),
          db.query.feePayments.findMany({
            where: eq(feePayments.schoolId, schoolId),
            with: {
              student: true,
            },
            orderBy: [desc(feePayments.paymentDate)],
            limit: 10,
          }),
          getCachedFinanceData<any>(schoolId, "rollups_daily"),
        ]);

        let todayCollected = 0;
        for (const p of todayPayments) {
          todayCollected += parseFloat(p.amountPaid || "0");
        }

        const classMap = new Map(allClasses.map((c) => [c.id, c.displayName]));

        // Calculate Bands 2 & 3 metrics
        let totalBilled = 0;
        let totalCollected = 0;
        let totalDues = 0;
        let overdue60Plus = 0;

        const now = Date.now();
        const aging: AgingSummary = {
          current: 0,
          days0to30: 0,
          days31to60: 0,
          days60plus: 0,
        };

        const defaulterMap = new Map<
          string,
          {
            studentId: string;
            studentName: string;
            admissionNumber: string;
            className: string;
            dueAmount: number;
            maxDaysOverdue: number;
            invoiceCount: number;
          }
        >();

        const classStatsMap = new Map<
          string,
          { className: string; billed: number; collected: number; due: number }
        >();

        for (const c of allClasses) {
          classStatsMap.set(c.id, {
            className: c.displayName,
            billed: 0,
            collected: 0,
            due: 0,
          });
        }

        for (const inv of invoices) {
          const net = parseFloat(inv.netAmount || "0");
          const paid = parseFloat(inv.paidAmount || "0");
          const bal = parseFloat(inv.balanceAmount || "0");

          totalBilled += net;
          totalCollected += paid;
          totalDues += bal;

          const dueTime = new Date(inv.dueDate).getTime();
          const daysOverdue = Math.max(0, Math.floor((now - dueTime) / (1000 * 60 * 60 * 24)));

          if (bal > 0) {
            if (daysOverdue === 0) {
              aging.current += bal;
            } else if (daysOverdue <= 30) {
              aging.days0to30 += bal;
            } else if (daysOverdue <= 60) {
              aging.days31to60 += bal;
            } else {
              aging.days60plus += bal;
              overdue60Plus += bal;
            }

            if (inv.studentId) {
              const existing = defaulterMap.get(inv.studentId);
              if (existing) {
                existing.dueAmount += bal;
                existing.invoiceCount += 1;
                existing.maxDaysOverdue = Math.max(existing.maxDaysOverdue, daysOverdue);
              } else {
                const fn = decryptData(inv.student?.firstNameEncrypted) || "";
                const ln = decryptData(inv.student?.lastNameEncrypted) || "";
                const sName = `${fn} ${ln}`.trim() || "Student";
                const cName = inv.student?.currentClassId
                  ? classMap.get(inv.student.currentClassId) || "Class"
                  : "Class";

                defaulterMap.set(inv.studentId, {
                  studentId: inv.studentId,
                  studentName: sName,
                  admissionNumber: inv.student?.admissionNumber || "N/A",
                  className: cName,
                  dueAmount: bal,
                  maxDaysOverdue: daysOverdue,
                  invoiceCount: 1,
                });
              }
            }
          }

          const cId = inv.student?.currentClassId;
          if (cId && classStatsMap.has(cId)) {
            const stat = classStatsMap.get(cId)!;
            stat.billed += net;
            stat.collected += paid;
            stat.due += bal;
          }
        }

        const recoveryRate =
          totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

        const topDefaulters: DefaulterItem[] = Array.from(defaulterMap.values())
          .sort((a, b) => b.dueAmount - a.dueAmount)
          .slice(0, 10)
          .map((d) => ({
            studentId: d.studentId,
            studentName: d.studentName,
            admissionNumber: d.admissionNumber,
            className: d.className,
            dueAmount: d.dueAmount,
            daysOverdue: d.maxDaysOverdue,
            invoiceCount: d.invoiceCount,
          }));

        const recentPayments: RecentPaymentItem[] = payments.map((p) => {
          const fn = decryptData(p.student?.firstNameEncrypted) || "";
          const ln = decryptData(p.student?.lastNameEncrypted) || "";
          const sName = `${fn} ${ln}`.trim() || "Student";

          return {
            id: p.id,
            receiptNumber: p.receiptNumber,
            studentId: p.studentId,
            studentName: sName,
            admissionNumber: p.student?.admissionNumber || "N/A",
            amount: parseFloat(p.amountPaid || "0"),
            paymentMethod: p.paymentMethod,
            paymentDate: p.paymentDate.toISOString(),
          };
        });

        // Mode breakdown from pre-aggregated rollups or default map (PF-R91)
        const modeBreakdown: ModeBreakdownItem[] = dailyRollup?.modeBreakdown || [
          { mode: "CASH", amount: 0, percentage: 0 },
        ];

        const classStats: ClassStatItem[] = Array.from(classStatsMap.values())
          .filter((s) => s.billed > 0 || s.collected > 0)
          .map((s) => ({
            className: s.className,
            billed: s.billed,
            collected: s.collected,
            due: s.due,
            rate: s.billed > 0 ? Math.round((s.collected / s.billed) * 100) : 0,
          }));

        bands23Data = {
          kpisBands23: {
            totalBilled,
            totalCollected,
            totalDues,
            recoveryRate,
            overdue60Plus,
          },
          aging,
          topDefaulters,
          recentPayments,
          modeBreakdown,
          classStats,
        };

        // Populate S2 cache with tenant isolation and tags (PF-R45, PF-R41)
        await setCachedFinanceData(schoolId, "hub_bands23", bands23Data, {
          params: selectedAyId,
          tags: [`school:${schoolId}`, `fin:payments:${schoolId}`, `fin:dues:${schoolId}`],
        });

        return {
          activeSchool,
          allAcademicYears,
          allClasses,
          selectedAyId,
          todayCollected,
          todayPaymentsCount: todayPayments.length,
          ...bands23Data,
        };
      },
      { maxQueries: 5, label: "Finance Hub Landing (PF 1.2 <= 5 queries)" }
    );
  });

  if (!data?.activeSchool) return <div>School not found</div>;

  const {
    activeSchool,
    allAcademicYears,
    selectedAyId,
    todayCollected,
    todayPaymentsCount,
    kpisBands23,
    aging,
    topDefaulters,
    recentPayments,
    modeBreakdown,
    classStats,
  } = data;

  const kpis: DashboardKPIs = {
    todayCollected,
    todayPaymentsCount,
    ...kpisBands23,
  };

  const academicYearsList = allAcademicYears.map((ay) => ({
    id: ay.id,
    label: ay.label,
    isActive: ay.isActive,
    isLocked: ay.isLocked || false,
    startDate: ay.startDate.toISOString(),
    endDate: ay.endDate.toISOString(),
    lockReason: ay.lockReason,
  }));

  return (
    <div className="space-y-6">
      {/* Finance Navigation Tabs */}
      <FinanceTabs activeSection="finance" />

      {/* Header Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <BarChart3 className="w-3.5 h-3.5" /> Finance Hub & Telemetry
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Central Finance & Fees Analytics Hub
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Real-time collection velocity, overdue aging buckets, and quick cashier actions for {activeSchool.name}.
          </p>
        </div>

        <QuickActionBar userRole={session.user.role} />
      </div>

      {/* Interactive Client Component with Band 1, 2, 3 and Slide-Over Drawer */}
      <FeesDashboardClient
        academicYearsList={academicYearsList}
        selectedAyId={selectedAyId}
        userRole={session.user.role}
        kpis={kpis}
        aging={aging}
        topDefaulters={topDefaulters}
        recentPayments={recentPayments}
        modeBreakdown={modeBreakdown}
        classStats={classStats}
      />
    </div>
  );
}
