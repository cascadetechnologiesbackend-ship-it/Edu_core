export const dynamic = "force-dynamic";

import { db, withTenant } from "@/db";
import { schools } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
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
import { assertRouteAccess } from "@/lib/routeGuards";

interface CachedMasterConfig {
  activeSchool: { id: string; name: string };
  allAcademicYears: Array<{
    id: string;
    label: string;
    isActive: boolean;
    isLocked: boolean;
    startDate: string;
    endDate: string;
    lockReason: string | null;
  }>;
  allClasses: Array<{
    id: string;
    displayName: string;
    sortOrder: number;
  }>;
}

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

  const access = assertRouteAccess(session.user.role, "/school/fees-dashboard", {
    id: session.user.id,
    email: session.user.email ?? undefined,
    schoolId: session.user.schoolId,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = session.user.schoolId;

  const data = await withDataPhaseTiming("/school/fees-dashboard", async () => {
    return assertQueryBudget(
      async () => {
        let masterConfig = await getCachedFinanceData<CachedMasterConfig>(
          schoolId,
          "hub_master_config"
        );

        let activeSchool = masterConfig?.activeSchool ?? null;
        if (!activeSchool) {
          const schoolRow = await db.query.schools.findFirst({
            where: eq(schools.id, schoolId),
            columns: { id: true, name: true },
          });
          if (!schoolRow) return null;
          activeSchool = { id: schoolRow.id, name: schoolRow.name };
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // If masterConfig is already cached, we can check bands23 cache before entering DB
        if (masterConfig) {
          const selectedYear =
            (searchParams.ayId
              ? masterConfig.allAcademicYears.find((ay) => ay.id === searchParams.ayId)
              : null) ||
            masterConfig.allAcademicYears.find((ay) => ay.isActive) ||
            masterConfig.allAcademicYears[0];

          const selectedAyId = selectedYear?.id || "";

          const cachedBands23 = await getCachedFinanceData<CachedBands23Payload>(
            schoolId,
            "hub_bands23",
            selectedAyId
          );

          if (cachedBands23) {
            const ayJoinFilter = selectedAyId
              ? sql`AND fi.academic_year_id = ${selectedAyId}`
              : sql``;

            const todayRow = await withTenant(schoolId, async (tx) => {
              const res = await tx.execute(sql`
                SELECT
                  COALESCE(SUM(fp.amount_paid), 0)::float AS today_collected,
                  COUNT(fp.id)::int AS today_count
                FROM fee_payments fp
                JOIN fee_invoices fi ON fi.id = fp.fee_invoice_id
                WHERE fp.school_id = ${schoolId}
                  AND fp.is_cancelled = false
                  AND fp.status != 'REVERSED'
                  AND fp.payment_date >= ${todayStart}
                  ${ayJoinFilter}
              `);
              return (res.rows?.[0] || {}) as {
                today_collected?: number;
                today_count?: number;
              };
            });

            return {
              activeSchool: masterConfig.activeSchool,
              allAcademicYears: masterConfig.allAcademicYears,
              allClasses: masterConfig.allClasses,
              selectedAyId,
              todayCollected: Number(todayRow.today_collected || 0),
              todayPaymentsCount: Number(todayRow.today_count || 0),
              ...cachedBands23,
            };
          }
        }

        // Cache miss on masterConfig and/or bands23: consolidate into one withTenant session (<= 5 queries total)
        const now = new Date();
        const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const days60Ago = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        const result = await withTenant(schoolId, async (tx) => {
          if (!masterConfig) {
            const masterRes = await tx.execute(sql`
              SELECT
                COALESCE((
                  SELECT json_agg(
                    json_build_object(
                      'id', ay.id,
                      'label', ay.label,
                      'isActive', ay.is_active,
                      'isLocked', COALESCE(ay.is_locked, false),
                      'startDate', ay.start_date,
                      'endDate', ay.end_date,
                      'lockReason', ay.lock_reason
                    )
                    ORDER BY ay.start_date DESC
                  )
                  FROM academic_years ay
                  WHERE ay.school_id = ${schoolId}
                ), '[]'::json) AS years,
                COALESCE((
                  SELECT json_agg(
                    json_build_object(
                      'id', c.id,
                      'displayName', c.display_name,
                      'sortOrder', c.sort_order
                    )
                    ORDER BY c.sort_order ASC
                  )
                  FROM classes c
                  WHERE c.school_id = ${schoolId}
                ), '[]'::json) AS classes
            `);

            const mRow = (masterRes.rows?.[0] || {}) as {
              years?: CachedMasterConfig["allAcademicYears"];
              classes?: CachedMasterConfig["allClasses"];
            };

            masterConfig = {
              activeSchool: activeSchool!,
              allAcademicYears: Array.isArray(mRow.years) ? mRow.years : [],
              allClasses: Array.isArray(mRow.classes) ? mRow.classes : [],
            };

            await setCachedFinanceData(schoolId, "hub_master_config", masterConfig, {
              ttlSeconds: 3600,
              tags: [`school:${schoolId}`],
            });
          }

          const { allAcademicYears, allClasses } = masterConfig;
          const selectedYear =
            (searchParams.ayId
              ? allAcademicYears.find((ay) => ay.id === searchParams.ayId)
              : null) ||
            allAcademicYears.find((ay) => ay.isActive) ||
            allAcademicYears[0];

          const selectedAyId = selectedYear?.id || "";
          const ayFilter = selectedAyId
            ? sql`AND fi.academic_year_id = ${selectedAyId}`
            : sql``;

          const cachedBands23 = await getCachedFinanceData<CachedBands23Payload>(
            schoolId,
            "hub_bands23",
            selectedAyId
          );

          if (cachedBands23) {
            const todayRes = await tx.execute(sql`
              SELECT
                COALESCE(SUM(fp.amount_paid), 0)::float AS today_collected,
                COUNT(fp.id)::int AS today_count
              FROM fee_payments fp
              JOIN fee_invoices fi ON fi.id = fp.fee_invoice_id
              WHERE fp.school_id = ${schoolId}
                AND fp.is_cancelled = false
                AND fp.status != 'REVERSED'
                AND fp.payment_date >= ${todayStart}
                ${ayFilter}
            `);
            const todayRow = (todayRes.rows?.[0] || {}) as {
              today_collected?: number;
              today_count?: number;
            };
            return {
              activeSchool: masterConfig.activeSchool,
              allAcademicYears,
              allClasses,
              selectedAyId,
              todayCollected: Number(todayRow.today_collected || 0),
              todayPaymentsCount: Number(todayRow.today_count || 0),
              ...cachedBands23,
            };
          }

          // Single consolidated CTE query for all KPIs, aging, defaulters, recent payments, mode breakdown, and class stats
          const aggRes = await tx.execute(sql`
            WITH today_stats AS (
              SELECT
                COALESCE(SUM(fp.amount_paid), 0)::float AS today_collected,
                COUNT(fp.id)::int AS today_count
              FROM fee_payments fp
              JOIN fee_invoices fi ON fi.id = fp.fee_invoice_id
              WHERE fp.school_id = ${schoolId}
                AND fp.is_cancelled = false
                AND fp.status != 'REVERSED'
                AND fp.payment_date >= ${todayStart}
                ${ayFilter}
            ),
            invoice_kpis AS (
              SELECT
                COALESCE(SUM(CASE WHEN fi.status != 'CANCELLED' THEN fi.net_amount ELSE 0 END), 0)::float AS total_billed,
                COALESCE(SUM(CASE WHEN fi.status != 'CANCELLED' THEN fi.paid_amount ELSE 0 END), 0)::float AS total_collected,
                COALESCE(SUM(CASE WHEN fi.status NOT IN ('PAID', 'WAIVED', 'CANCELLED') AND CAST(fi.balance_amount AS numeric) > 0 THEN fi.balance_amount ELSE 0 END), 0)::float AS total_dues,
                COALESCE(SUM(CASE WHEN fi.status NOT IN ('PAID', 'WAIVED', 'CANCELLED') AND CAST(fi.balance_amount AS numeric) > 0 AND fi.due_date >= ${now} THEN fi.balance_amount ELSE 0 END), 0)::float AS aging_current,
                COALESCE(SUM(CASE WHEN fi.status NOT IN ('PAID', 'WAIVED', 'CANCELLED') AND CAST(fi.balance_amount AS numeric) > 0 AND fi.due_date < ${now} AND fi.due_date >= ${days30Ago} THEN fi.balance_amount ELSE 0 END), 0)::float AS aging_0_30,
                COALESCE(SUM(CASE WHEN fi.status NOT IN ('PAID', 'WAIVED', 'CANCELLED') AND CAST(fi.balance_amount AS numeric) > 0 AND fi.due_date < ${days30Ago} AND fi.due_date >= ${days60Ago} THEN fi.balance_amount ELSE 0 END), 0)::float AS aging_31_60,
                COALESCE(SUM(CASE WHEN fi.status NOT IN ('PAID', 'WAIVED', 'CANCELLED') AND CAST(fi.balance_amount AS numeric) > 0 AND fi.due_date < ${days60Ago} THEN fi.balance_amount ELSE 0 END), 0)::float AS aging_60_plus
              FROM fee_invoices fi
              WHERE fi.school_id = ${schoolId}
                AND fi.deleted_at IS NULL
                ${ayFilter}
            ),
            top_defaulters AS (
              SELECT
                fi.student_id AS "studentId",
                SUM(fi.balance_amount)::float AS "dueAmount",
                COUNT(fi.id)::int AS "invoiceCount",
                GREATEST(0, MAX(FLOOR(EXTRACT(EPOCH FROM (${now}::timestamptz - fi.due_date)) / 86400)))::int AS "daysOverdue",
                s.admission_number AS "admissionNumber",
                s.first_name_encrypted AS "firstNameEncrypted",
                s.last_name_encrypted AS "lastNameEncrypted",
                s.current_class_id AS "currentClassId"
              FROM fee_invoices fi
              JOIN students s ON s.id = fi.student_id
              WHERE fi.school_id = ${schoolId}
                AND fi.deleted_at IS NULL
                AND fi.status NOT IN ('PAID', 'WAIVED', 'CANCELLED')
                AND CAST(fi.balance_amount AS numeric) > 0
                ${ayFilter}
              GROUP BY fi.student_id, s.admission_number, s.first_name_encrypted, s.last_name_encrypted, s.current_class_id
              ORDER BY "dueAmount" DESC
              LIMIT 10
            ),
            recent_payments AS (
              SELECT
                fp.id,
                fp.receipt_number AS "receiptNumber",
                fp.student_id AS "studentId",
                fp.amount_paid::float AS amount,
                fp.payment_method AS "paymentMethod",
                fp.payment_date AS "paymentDate",
                s.admission_number AS "admissionNumber",
                s.first_name_encrypted AS "firstNameEncrypted",
                s.last_name_encrypted AS "lastNameEncrypted"
              FROM fee_payments fp
              JOIN fee_invoices fi ON fi.id = fp.fee_invoice_id
              JOIN students s ON s.id = fp.student_id
              WHERE fp.school_id = ${schoolId}
                AND fp.is_cancelled = false
                AND fp.status != 'REVERSED'
                ${ayFilter}
              ORDER BY fp.payment_date DESC, fp.id DESC
              LIMIT 25
            ),
            mode_breakdown AS (
              SELECT
                fp.payment_method AS mode,
                COALESCE(SUM(fp.amount_paid), 0)::float AS amount
              FROM fee_payments fp
              JOIN fee_invoices fi ON fi.id = fp.fee_invoice_id
              WHERE fp.school_id = ${schoolId}
                AND fp.is_cancelled = false
                AND fp.status != 'REVERSED'
                ${ayFilter}
              GROUP BY fp.payment_method
              ORDER BY amount DESC
            ),
            class_stats AS (
              SELECT
                s.current_class_id AS "classId",
                COALESCE(SUM(fi.net_amount), 0)::float AS billed,
                COALESCE(SUM(fi.paid_amount), 0)::float AS collected,
                COALESCE(SUM(CASE WHEN fi.status NOT IN ('PAID', 'WAIVED', 'CANCELLED') AND CAST(fi.balance_amount AS numeric) > 0 THEN fi.balance_amount ELSE 0 END), 0)::float AS due
              FROM fee_invoices fi
              JOIN students s ON s.id = fi.student_id
              WHERE fi.school_id = ${schoolId}
                AND fi.deleted_at IS NULL
                AND fi.status != 'CANCELLED'
                AND s.current_class_id IS NOT NULL
                ${ayFilter}
              GROUP BY s.current_class_id
            )
            SELECT
              (SELECT row_to_json(today_stats) FROM today_stats) AS today_stats,
              (SELECT row_to_json(invoice_kpis) FROM invoice_kpis) AS invoice_kpis,
              COALESCE((SELECT json_agg(top_defaulters) FROM top_defaulters), '[]'::json) AS top_defaulters,
              COALESCE((SELECT json_agg(recent_payments) FROM recent_payments), '[]'::json) AS recent_payments,
              COALESCE((SELECT json_agg(mode_breakdown) FROM mode_breakdown), '[]'::json) AS mode_breakdown,
              COALESCE((SELECT json_agg(class_stats) FROM class_stats), '[]'::json) AS class_stats
          `);

          const row = (aggRes.rows?.[0] || {}) as any;
          const todayStats = row.today_stats || {};
          const kpiRow = row.invoice_kpis || {};
          const classMap = new Map(allClasses.map((c) => [c.id, c.displayName]));

          const totalBilled = Number(kpiRow.total_billed || 0);
          const totalCollected = Number(kpiRow.total_collected || 0);
          const totalDues = Number(kpiRow.total_dues || 0);
          const overdue60Plus = Number(kpiRow.aging_60_plus || 0);
          const recoveryRate =
            totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

          const aging: AgingSummary = {
            current: Number(kpiRow.aging_current || 0),
            days0to30: Number(kpiRow.aging_0_30 || 0),
            days31to60: Number(kpiRow.aging_31_60 || 0),
            days60plus: overdue60Plus,
          };

          const topDefaulters: DefaulterItem[] = (Array.isArray(row.top_defaulters)
            ? row.top_defaulters
            : []
          ).map((d: any) => {
            const fn = decryptData(d.firstNameEncrypted) || "";
            const ln = decryptData(d.lastNameEncrypted) || "";
            return {
              studentId: d.studentId,
              studentName: `${fn} ${ln}`.trim() || "Student",
              admissionNumber: d.admissionNumber || "N/A",
              className: d.currentClassId ? classMap.get(d.currentClassId) || "Class" : "Class",
              dueAmount: Number(d.dueAmount || 0),
              daysOverdue: Number(d.daysOverdue || 0),
              invoiceCount: Number(d.invoiceCount || 0),
            };
          });

          const recentPayments: RecentPaymentItem[] = (Array.isArray(row.recent_payments)
            ? row.recent_payments
            : []
          ).map((p: any) => {
            const fn = decryptData(p.firstNameEncrypted) || "";
            const ln = decryptData(p.lastNameEncrypted) || "";
            return {
              id: p.id,
              receiptNumber: p.receiptNumber,
              studentId: p.studentId,
              studentName: `${fn} ${ln}`.trim() || "Student",
              admissionNumber: p.admissionNumber || "N/A",
              amount: Number(p.amount || 0),
              paymentMethod: p.paymentMethod,
              paymentDate: p.paymentDate
                ? new Date(p.paymentDate).toISOString()
                : new Date().toISOString(),
            };
          });

          const rawModes: Array<{ mode: string; amount: number }> = Array.isArray(
            row.mode_breakdown
          )
            ? row.mode_breakdown
            : [];
          const totalModeAmount = rawModes.reduce((acc, m) => acc + Number(m.amount || 0), 0);
          const modeBreakdown: ModeBreakdownItem[] = rawModes.map((m) => {
            const amt = Number(m.amount || 0);
            return {
              mode: m.mode || "CASH",
              amount: amt,
              percentage: totalModeAmount > 0 ? Math.round((amt / totalModeAmount) * 100) : 0,
            };
          });

          const classOrderMap = new Map(allClasses.map((c) => [c.id, c.sortOrder]));
          const classStats: ClassStatItem[] = (Array.isArray(row.class_stats)
            ? row.class_stats
            : []
          )
            .map((cs: any) => {
              const billed = Number(cs.billed || 0);
              const collected = Number(cs.collected || 0);
              return {
                sortOrder: classOrderMap.get(cs.classId) ?? 999,
                className: classMap.get(cs.classId) || "Unknown",
                billed,
                collected,
                due: Number(cs.due || 0),
                rate: billed > 0 ? Math.round((collected / billed) * 100) : 0,
              };
            })
            .filter((s: any) => s.billed > 0 || s.collected > 0)
            .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
            .map(({ sortOrder: _sortOrder, ...rest }: any) => rest);

          const bands23Data: CachedBands23Payload = {
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

          await setCachedFinanceData(schoolId, "hub_bands23", bands23Data, {
            params: selectedAyId,
            tags: [`school:${schoolId}`, `fin:payments:${schoolId}`, `fin:dues:${schoolId}`],
          });

          return {
            activeSchool: masterConfig.activeSchool,
            allAcademicYears,
            allClasses,
            selectedAyId,
            todayCollected: Number(todayStats.today_collected || 0),
            todayPaymentsCount: Number(todayStats.today_count || 0),
            ...bands23Data,
          };
        });

        return result;
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
    startDate: ay.startDate ? new Date(ay.startDate).toISOString() : "",
    endDate: ay.endDate ? new Date(ay.endDate).toISOString() : "",
    lockReason: ay.lockReason,
  }));

  return (
    <div className="space-y-6">
      <FinanceTabs activeSection="finance" userRole={session.user.role} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-3xl border border-border/40 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#248A3D]/10 text-[#248A3D] dark:text-[#30D158] border border-[#248A3D]/20">
            <BarChart3 className="w-3.5 h-3.5" /> Finance Hub & Telemetry
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-2">
            Central Finance & Fees Analytics Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time collection velocity, overdue aging buckets, and quick cashier actions for {activeSchool.name}.
          </p>
        </div>

        <QuickActionBar userRole={session.user.role} />
      </div>

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
