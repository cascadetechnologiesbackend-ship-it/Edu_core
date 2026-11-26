export const dynamic = "force-dynamic";

import { db, withTenant } from "@/db";
import { schools } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { assertRouteAccess } from "@/lib/routeGuards";
import { decryptData } from "@/lib/encryption";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { QuickActionBar } from "@/components/finance/QuickActionBar";
import { Calculator } from "lucide-react";
import {
  AccountantDashboardClient,
  AccountantDashboardData,
} from "./AccountantDashboardClient";

export default async function AccountantDashboardPage({
  searchParams,
}: {
  searchParams: { ayId?: string };
}) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
  const school = await requireSchool(ctx);

  const access = assertRouteAccess(ctx.role, "/accountant/dashboard", {
    id: ctx.userId,
    email: ctx.email ?? undefined,
    schoolId: school.id,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = school.id;

  const dashboardData = await withDataPhaseTiming("/accountant/dashboard", async () => {
    return assertQueryBudget(
      async (): Promise<AccountantDashboardData | null> => {
        const activeSchool = await db.query.schools.findFirst({
          where: eq(schools.id, schoolId),
          columns: { id: true, name: true },
        });
        if (!activeSchool) return null;

        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        return await withTenant(schoolId, async (tx) => {
          const metaRes = await tx.execute(sql`
            SELECT
              COALESCE((
                SELECT json_agg(
                  json_build_object('id', ay.id, 'label', ay.label, 'isActive', ay.is_active)
                  ORDER BY ay.start_date DESC
                )
                FROM academic_years ay
                WHERE ay.school_id = ${schoolId}
              ), '[]'::json) AS years,
              COALESCE((
                SELECT json_agg(
                  json_build_object('id', c.id, 'displayName', c.display_name, 'sortOrder', c.sort_order)
                  ORDER BY c.sort_order ASC
                )
                FROM classes c
                WHERE c.school_id = ${schoolId}
              ), '[]'::json) AS classes
          `);

          const metaRow = (metaRes.rows?.[0] || {}) as {
            years?: Array<{ id: string; label: string; isActive: boolean }>;
            classes?: Array<{ id: string; displayName: string; sortOrder: number }>;
          };

          const academicYearsList = Array.isArray(metaRow.years) ? metaRow.years : [];
          const allClasses = Array.isArray(metaRow.classes) ? metaRow.classes : [];

          const selectedYear =
            (searchParams.ayId
              ? academicYearsList.find((ay) => ay.id === searchParams.ayId)
              : null) ||
            academicYearsList.find((ay) => ay.isActive) ||
            academicYearsList[0];

          const selectedAyId = selectedYear?.id || "";
          const ayFilter = selectedAyId
            ? sql`AND fi.academic_year_id = ${selectedAyId}`
            : sql``;

          const aggRes = await tx.execute(sql`
            WITH collection_kpis AS (
              SELECT
                COALESCE(SUM(CASE WHEN fp.payment_date >= ${todayStart} THEN fp.amount_paid ELSE 0 END), 0)::float AS today_collected,
                COUNT(fp.id) FILTER (WHERE fp.payment_date >= ${todayStart})::int AS today_count,
                COALESCE(SUM(CASE WHEN fp.payment_date >= ${monthStart} THEN fp.amount_paid ELSE 0 END), 0)::float AS mtd_collected,
                COUNT(fp.id) FILTER (WHERE fp.payment_date >= ${monthStart})::int AS mtd_count
              FROM fee_payments fp
              JOIN fee_invoices fi ON fi.id = fp.fee_invoice_id
              WHERE fp.school_id = ${schoolId}
                AND fp.is_cancelled = false
                AND fp.status != 'REVERSED'
                ${ayFilter}
            ),
            dues_kpis AS (
              SELECT
                COALESCE(SUM(fi.balance_amount), 0)::float AS total_dues,
                COUNT(fi.id)::int AS open_invoices_count,
                COALESCE(SUM(CASE WHEN fi.due_date < ${now} OR fi.status = 'OVERDUE' THEN fi.balance_amount ELSE 0 END), 0)::float AS overdue_dues,
                COUNT(fi.id) FILTER (WHERE fi.due_date < ${now} OR fi.status = 'OVERDUE')::int AS overdue_count
              FROM fee_invoices fi
              WHERE fi.school_id = ${schoolId}
                AND fi.deleted_at IS NULL
                AND fi.status NOT IN ('PAID', 'WAIVED', 'CANCELLED')
                AND CAST(fi.balance_amount AS numeric) > 0
                ${ayFilter}
            ),
            mode_breakdown AS (
              SELECT
                fp.payment_method AS mode,
                COALESCE(SUM(fp.amount_paid), 0)::float AS amount,
                COUNT(fp.id)::int AS count
              FROM fee_payments fp
              JOIN fee_invoices fi ON fi.id = fp.fee_invoice_id
              WHERE fp.school_id = ${schoolId}
                AND fp.is_cancelled = false
                AND fp.status != 'REVERSED'
                ${ayFilter}
              GROUP BY fp.payment_method
              ORDER BY amount DESC
            ),
            class_collections AS (
              SELECT
                s.current_class_id AS "classId",
                COALESCE(SUM(fp.amount_paid), 0)::float AS collected,
                COUNT(fp.id)::int AS payments_count
              FROM fee_payments fp
              JOIN fee_invoices fi ON fi.id = fp.fee_invoice_id
              JOIN students s ON s.id = fp.student_id
              WHERE fp.school_id = ${schoolId}
                AND fp.is_cancelled = false
                AND fp.status != 'REVERSED'
                AND s.current_class_id IS NOT NULL
                ${ayFilter}
              GROUP BY s.current_class_id
            ),
            recent_tx AS (
              SELECT
                fp.id,
                fp.receipt_number AS "receiptNumber",
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
              LIMIT 15
            ),
            pending_refund_stats AS (
              SELECT COUNT(fr.id)::int AS cnt
              FROM fee_refunds fr
              JOIN fee_payments fp ON fp.id = fr.fee_payment_id
              JOIN fee_invoices fi ON fi.id = fp.fee_invoice_id
              WHERE fr.school_id = ${schoolId}
                AND fr.status = 'PENDING'
                ${ayFilter}
            ),
            pending_refund_list AS (
              SELECT
                fr.id,
                fr.refund_amount::float AS "refundAmount",
                fr.reason,
                fr.created_at AS "createdAt",
                fp.receipt_number AS "receiptNumber",
                s.admission_number AS "admissionNumber",
                s.first_name_encrypted AS "firstNameEncrypted",
                s.last_name_encrypted AS "lastNameEncrypted"
              FROM fee_refunds fr
              JOIN fee_payments fp ON fp.id = fr.fee_payment_id
              JOIN fee_invoices fi ON fi.id = fp.fee_invoice_id
              JOIN students s ON s.id = fp.student_id
              WHERE fr.school_id = ${schoolId}
                AND fr.status = 'PENDING'
                ${ayFilter}
              ORDER BY fr.created_at DESC
              LIMIT 10
            ),
            brs_pending AS (
              SELECT COUNT(*)::int AS cnt
              FROM account_ledger_transactions alt
              WHERE alt.school_id = ${schoolId}
                AND alt.bank_account_id IS NOT NULL
                AND alt.bank_reconciliation_status = 'UNRECONCILED'
            ),
            failed_gateway AS (
              SELECT
                pgl.id,
                pgl.gateway,
                pgl.gateway_order_id AS "gatewayOrderId",
                pgl.gateway_payment_id AS "gatewayPaymentId",
                pgl.amount::float AS amount,
                pgl.created_at AS "createdAt",
                fi.invoice_number AS "invoiceNumber"
              FROM payment_gateway_logs pgl
              LEFT JOIN fee_invoices fi ON fi.id = pgl.fee_invoice_id
              WHERE pgl.school_id = ${schoolId}
                AND pgl.status = 'FAILED'
                ${selectedAyId ? sql`AND (fi.academic_year_id = ${selectedAyId} OR pgl.fee_invoice_id IS NULL)` : sql``}
              ORDER BY pgl.created_at DESC
              LIMIT 10
            )
            SELECT
              (SELECT row_to_json(collection_kpis) FROM collection_kpis) AS collection_kpis,
              (SELECT row_to_json(dues_kpis) FROM dues_kpis) AS dues_kpis,
              COALESCE((SELECT json_agg(mode_breakdown) FROM mode_breakdown), '[]'::json) AS mode_breakdown,
              COALESCE((SELECT json_agg(class_collections) FROM class_collections), '[]'::json) AS class_collections,
              COALESCE((SELECT json_agg(recent_tx) FROM recent_tx), '[]'::json) AS recent_tx,
              (SELECT cnt FROM pending_refund_stats) AS pending_refunds_count,
              COALESCE((SELECT json_agg(pending_refund_list) FROM pending_refund_list), '[]'::json) AS pending_refunds,
              (SELECT cnt FROM brs_pending) AS pending_brs_count,
              COALESCE((SELECT json_agg(failed_gateway) FROM failed_gateway), '[]'::json) AS failed_gateway
          `);

          const row = (aggRes.rows?.[0] || {}) as any;
          const colKpi = row.collection_kpis || {};
          const dueKpi = row.dues_kpis || {};
          const classMap = new Map(allClasses.map((c) => [c.id, c.displayName]));
          const classOrderMap = new Map(allClasses.map((c) => [c.id, c.sortOrder]));

          const rawModes = Array.isArray(row.mode_breakdown) ? row.mode_breakdown : [];
          const totalModeAmt = rawModes.reduce((s: number, m: any) => s + Number(m.amount || 0), 0);

          const modeBreakdown = rawModes.map((m: any) => {
            const amount = Number(m.amount || 0);
            return {
              mode: m.mode || "CASH",
              amount,
              count: Number(m.count || 0),
              percentage: totalModeAmt > 0 ? Math.round((amount / totalModeAmt) * 100) : 0,
            };
          });

          const rawClasses = Array.isArray(row.class_collections) ? row.class_collections : [];
          const classCollections = rawClasses
            .map((c: any) => ({
              classId: c.classId,
              className: classMap.get(c.classId) || "Class",
              sortOrder: classOrderMap.get(c.classId) ?? 999,
              collected: Number(c.collected || 0),
              paymentsCount: Number(c.payments_count || 0),
            }))
            .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
            .map(({ sortOrder: _s, ...rest }: any) => rest);

          const recentTransactions = (Array.isArray(row.recent_tx) ? row.recent_tx : []).map(
            (t: any) => {
              const fn = decryptData(t.firstNameEncrypted) || "";
              const ln = decryptData(t.lastNameEncrypted) || "";
              return {
                id: t.id,
                receiptNumber: t.receiptNumber,
                studentName: `${fn} ${ln}`.trim() || "Student",
                admissionNumber: t.admissionNumber || "N/A",
                amount: Number(t.amount || 0),
                paymentMethod: t.paymentMethod,
                paymentDate: t.paymentDate
                  ? new Date(t.paymentDate).toISOString()
                  : new Date().toISOString(),
              };
            }
          );

          const pendingRefunds = (
            Array.isArray(row.pending_refunds) ? row.pending_refunds : []
          ).map((r: any) => {
            const fn = decryptData(r.firstNameEncrypted) || "";
            const ln = decryptData(r.lastNameEncrypted) || "";
            return {
              id: r.id,
              receiptNumber: r.receiptNumber || "N/A",
              studentName: `${fn} ${ln}`.trim() || "Student",
              admissionNumber: r.admissionNumber || "N/A",
              refundAmount: Number(r.refundAmount || 0),
              reason: r.reason || "",
              createdAt: r.createdAt
                ? new Date(r.createdAt).toISOString()
                : new Date().toISOString(),
            };
          });

          const failedPayments = (
            Array.isArray(row.failed_gateway) ? row.failed_gateway : []
          ).map((f: any) => ({
            id: f.id,
            gateway: f.gateway || "RAZORPAY",
            gatewayOrderId: f.gatewayOrderId || "N/A",
            gatewayPaymentId: f.gatewayPaymentId || null,
            invoiceNumber: f.invoiceNumber || "N/A",
            amount: Number(f.amount || 0),
            createdAt: f.createdAt
              ? new Date(f.createdAt).toISOString()
              : new Date().toISOString(),
          }));

          return {
            schoolName: activeSchool.name,
            academicYearsList,
            selectedAyId,
            kpis: {
              todayCollected: Number(colKpi.today_collected || 0),
              todayCount: Number(colKpi.today_count || 0),
              mtdCollected: Number(colKpi.mtd_collected || 0),
              mtdCount: Number(colKpi.mtd_count || 0),
              totalDues: Number(dueKpi.total_dues || 0),
              openInvoicesCount: Number(dueKpi.open_invoices_count || 0),
              overdueDues: Number(dueKpi.overdue_dues || 0),
              overdueCount: Number(dueKpi.overdue_count || 0),
              pendingRefundsCount: Number(row.pending_refunds_count || 0),
              pendingBrsCount: Number(row.pending_brs_count || 0),
            },
            modeBreakdown,
            classCollections,
            recentTransactions,
            pendingRefunds,
            failedPayments,
          };
        });
      },
      { maxQueries: 8, label: "Accountant Operational Dashboard" }
    );
  });

  if (!dashboardData) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        School record not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FinanceTabs activeSection="finance" userRole={ctx.role} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-3xl border border-border/40 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#248A3D]/10 text-[#248A3D] dark:text-[#30D158] border border-[#248A3D]/20">
            <Calculator className="w-3.5 h-3.5" /> Operational Accountant Desk
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-2">
            Daily Counter & Treasury Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live collections, dues queue, BRS reconciliation backlog, refund requests, and gateway exceptions for {dashboardData.schoolName}.
          </p>
        </div>

        <QuickActionBar userRole={ctx.role} />
      </div>

      <AccountantDashboardClient data={dashboardData} />
    </div>
  );
}
