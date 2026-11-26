export const dynamic = "force-dynamic";

import { withTenant } from "@/db";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { decryptData, computeSearchHash } from "@/lib/encryption";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { QuickActionBar } from "@/components/finance/QuickActionBar";
import { DueFeesClient, DueFeeRow } from "./DueFeesClient";
import { Clock } from "lucide-react";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { assertRouteAccess } from "@/lib/routeGuards";

const PAGE_SIZE = 50;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val?: string): val is string {
  return Boolean(val && UUID_REGEX.test(val));
}

export interface DueFeesSearchParams {
  ayId?: string;
  classId?: string;
  sectionId?: string;
  feeHeadId?: string;
  term?: string;
  status?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  minDue?: string;
  maxDue?: string;
  bracket?: string;
  q?: string;
  cursor?: string;
}

export default async function DueFeesPage({
  searchParams,
}: {
  searchParams: DueFeesSearchParams;
}) {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const access = assertRouteAccess(session.user.role, "/school/due-fees", {
    id: session.user.id,
    email: session.user.email ?? undefined,
    schoolId: session.user.schoolId,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = session.user.schoolId;

  const ayId = isValidUuid(searchParams.ayId) ? searchParams.ayId : undefined;
  const classId = isValidUuid(searchParams.classId) ? searchParams.classId : undefined;
  const sectionId = isValidUuid(searchParams.sectionId) ? searchParams.sectionId : undefined;
  const feeHeadId = isValidUuid(searchParams.feeHeadId) ? searchParams.feeHeadId : undefined;

  const validTerms = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL", "ONE_TIME"];
  const term =
    searchParams.term && validTerms.includes(searchParams.term) ? searchParams.term : undefined;

  const validStatuses = [
    "UPCOMING",
    "DUE_TODAY",
    "OVERDUE",
    "PARTIAL",
    "PENDING",
    "WAIVED",
    "CANCELLED",
  ];
  const status =
    searchParams.status && validStatuses.includes(searchParams.status)
      ? searchParams.status
      : undefined;

  const validBrackets = ["0-30", "31-60", "60+"];
  const bracket =
    searchParams.bracket && validBrackets.includes(searchParams.bracket)
      ? searchParams.bracket
      : undefined;

  const dueDateFrom =
    searchParams.dueDateFrom && !isNaN(Date.parse(searchParams.dueDateFrom))
      ? new Date(`${searchParams.dueDateFrom.slice(0, 10)}T00:00:00.000Z`)
      : undefined;
  const dueDateTo =
    searchParams.dueDateTo && !isNaN(Date.parse(searchParams.dueDateTo))
      ? new Date(`${searchParams.dueDateTo.slice(0, 10)}T23:59:59.999Z`)
      : undefined;

  const minDueNum =
    searchParams.minDue !== undefined && searchParams.minDue !== ""
      ? Number(searchParams.minDue)
      : undefined;
  const minDue = minDueNum !== undefined && !isNaN(minDueNum) ? minDueNum : undefined;

  const maxDueNum =
    searchParams.maxDue !== undefined && searchParams.maxDue !== ""
      ? Number(searchParams.maxDue)
      : undefined;
  const maxDue = maxDueNum !== undefined && !isNaN(maxDueNum) ? maxDueNum : undefined;

  const q = searchParams.q?.trim() || "";

  let cursorDate: Date | undefined;
  let cursorId: string | undefined;
  if (searchParams.cursor && searchParams.cursor.includes("|")) {
    const [rawDate, rawId] = searchParams.cursor.split("|");
    if (rawDate && rawId && !isNaN(Date.parse(rawDate)) && isValidUuid(rawId)) {
      cursorDate = new Date(rawDate);
      cursorId = rawId;
    }
  }

  const data = await withDataPhaseTiming("/school/due-fees", async () => {
    return assertQueryBudget(
      async () => {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setUTCHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setUTCHours(23, 59, 59, 999);

        // Build base SQL filter fragments (shared by bucket aggregation & paginated worklist)
        const ayFilter = ayId ? sql`AND fi.academic_year_id = ${ayId}::uuid` : sql``;
        const classFilter = classId
          ? sql`AND s.current_class_id = ${classId}::uuid`
          : sql``;
        const sectionFilter = sectionId
          ? sql`AND s.current_section_id = ${sectionId}::uuid`
          : sql``;
        const feeHeadFilter = feeHeadId
          ? sql`AND fs.fee_head_id = ${feeHeadId}::uuid`
          : sql``;
        const termFilter = term ? sql`AND fi.term = ${term}` : sql``;
        const dateFromFilter = dueDateFrom
          ? sql`AND fi.due_date >= ${dueDateFrom}`
          : sql``;
        const dateToFilter = dueDateTo ? sql`AND fi.due_date <= ${dueDateTo}` : sql``;
        const minDueFilter =
          minDue !== undefined
            ? sql`AND CAST(fi.balance_amount AS numeric) >= ${minDue}`
            : sql``;
        const maxDueFilter =
          maxDue !== undefined
            ? sql`AND CAST(fi.balance_amount AS numeric) <= ${maxDue}`
            : sql``;

        let statusFilter = sql`AND fi.status IN ('PENDING', 'PARTIAL', 'OVERDUE') AND CAST(fi.balance_amount AS numeric) > 0`;
        if (status === "UPCOMING") {
          statusFilter = sql`AND fi.status IN ('PENDING', 'PARTIAL') AND fi.due_date > ${todayEnd} AND CAST(fi.balance_amount AS numeric) > 0`;
        } else if (status === "DUE_TODAY") {
          statusFilter = sql`AND fi.status IN ('PENDING', 'PARTIAL', 'OVERDUE') AND fi.due_date >= ${todayStart} AND fi.due_date <= ${todayEnd} AND CAST(fi.balance_amount AS numeric) > 0`;
        } else if (status === "OVERDUE") {
          statusFilter = sql`AND (fi.status = 'OVERDUE' OR (fi.status IN ('PENDING', 'PARTIAL') AND fi.due_date < ${todayStart})) AND CAST(fi.balance_amount AS numeric) > 0`;
        } else if (status === "PARTIAL") {
          statusFilter = sql`AND fi.status = 'PARTIAL' AND CAST(fi.balance_amount AS numeric) > 0`;
        } else if (status === "PENDING") {
          statusFilter = sql`AND fi.status = 'PENDING' AND CAST(fi.balance_amount AS numeric) > 0`;
        } else if (status === "WAIVED") {
          statusFilter = sql`AND fi.status = 'WAIVED'`;
        } else if (status === "CANCELLED") {
          statusFilter = sql`AND fi.status = 'CANCELLED'`;
        }

        let searchFilter = sql``;
        if (q.length > 0) {
          const normalizedQ = q.toLowerCase().replace(/\s+/g, " ");
          const fullHash = computeSearchHash(normalizedQ);
          const words = normalizedQ.split(" ").filter((w) => w.length >= 3);
          const prefixHashes = Array.from(
            new Set([
              ...(normalizedQ.length >= 3 ? [fullHash] : []),
              ...words.map((w) => computeSearchHash(w)),
            ])
          );
          const likePattern = `%${q}%`;

          if (prefixHashes.length > 0) {
            const hashArraySql = sql.join(
              prefixHashes.map((h) => sql`${h}`),
              sql`, `
            );
            searchFilter = sql`AND (
              s.name_prefix_hashes && ARRAY[${hashArraySql}]::text[]
              OR s.first_name_search_hash = ${fullHash}
              OR s.last_name_search_hash = ${fullHash}
              OR s.admission_number ILIKE ${likePattern}
              OR fi.invoice_number ILIKE ${likePattern}
            )`;
          } else {
            searchFilter = sql`AND (
              s.first_name_search_hash = ${fullHash}
              OR s.last_name_search_hash = ${fullHash}
              OR s.admission_number ILIKE ${likePattern}
              OR fi.invoice_number ILIKE ${likePattern}
            )`;
          }
        }

        const daysOverdueExpr = sql`GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (${now}::timestamptz - fi.due_date)) / 86400))`;

        let bracketFilter = sql``;
        let bracketPredicate = sql`TRUE`;
        if (bracket === "0-30") {
          bracketPredicate = sql`${daysOverdueExpr} <= 30`;
          bracketFilter = sql`AND ${bracketPredicate}`;
        } else if (bracket === "31-60") {
          bracketPredicate = sql`${daysOverdueExpr} > 30 AND ${daysOverdueExpr} <= 60`;
          bracketFilter = sql`AND ${bracketPredicate}`;
        } else if (bracket === "60+") {
          bracketPredicate = sql`${daysOverdueExpr} > 60`;
          bracketFilter = sql`AND ${bracketPredicate}`;
        }

        const cursorFilter =
          cursorDate && cursorId
            ? sql`AND (fi.due_date > ${cursorDate} OR (fi.due_date = ${cursorDate} AND fi.id > ${cursorId}::uuid))`
            : sql``;

        return await withTenant(schoolId, async (tx) => {
          // 1. Fetch dropdown metadata in a single SQL query
          const metaRes = await tx.execute(sql`
            SELECT
              COALESCE((
                SELECT json_agg(json_build_object('id', ay.id, 'label', ay.label, 'isActive', ay.is_active) ORDER BY ay.start_date DESC)
                FROM academic_years ay WHERE ay.school_id = ${schoolId}
              ), '[]'::json) AS academic_years,
              COALESCE((
                SELECT json_agg(json_build_object('id', c.id, 'label', c.display_name) ORDER BY c.sort_order ASC)
                FROM classes c WHERE c.school_id = ${schoolId}
              ), '[]'::json) AS classes,
              COALESCE((
                SELECT json_agg(json_build_object('id', sec.id, 'label', sec.name, 'classId', sec.class_id) ORDER BY sec.name ASC)
                FROM sections sec WHERE sec.school_id = ${schoolId}
              ), '[]'::json) AS sections,
              COALESCE((
                SELECT json_agg(json_build_object('id', fh.id, 'label', fh.name) ORDER BY fh.priority ASC, fh.name ASC)
                FROM fee_heads fh WHERE fh.school_id = ${schoolId} AND fh.deleted_at IS NULL
              ), '[]'::json) AS fee_heads
          `);

          const metaRow = (metaRes.rows?.[0] || {}) as any;

          // 2. Compute full-dataset dues_buckets & totalCount across ALL matching rows in SQL
          const bucketsRes = await tx.execute(sql`
            SELECT
              COALESCE(SUM(fi.balance_amount), 0)::float AS total_due,
              COALESCE(SUM(CASE WHEN ${daysOverdueExpr} <= 30 THEN fi.balance_amount ELSE 0 END), 0)::float AS bracket_0_30,
              COALESCE(SUM(CASE WHEN ${daysOverdueExpr} > 30 AND ${daysOverdueExpr} <= 60 THEN fi.balance_amount ELSE 0 END), 0)::float AS bracket_31_60,
              COALESCE(SUM(CASE WHEN ${daysOverdueExpr} > 60 THEN fi.balance_amount ELSE 0 END), 0)::float AS bracket_60_plus,
              COUNT(*) FILTER (WHERE ${bracketPredicate})::int AS total_count
            FROM fee_invoices fi
            JOIN students s ON s.id = fi.student_id
            LEFT JOIN fee_structures fs ON fs.id = fi.fee_structure_id
            WHERE fi.school_id = ${schoolId}
              AND fi.deleted_at IS NULL
              ${ayFilter}
              ${classFilter}
              ${sectionFilter}
              ${feeHeadFilter}
              ${termFilter}
              ${statusFilter}
              ${dateFromFilter}
              ${dateToFilter}
              ${minDueFilter}
              ${maxDueFilter}
              ${searchFilter}
          `);

          const bRow = (bucketsRes.rows?.[0] || {}) as Record<string, number>;
          const bucketSummary = {
            totalDue: Number(bRow.total_due || 0),
            bracket0to30: Number(bRow.bracket_0_30 || 0),
            bracket31to60: Number(bRow.bracket_31_60 || 0),
            bracket60plus: Number(bRow.bracket_60_plus || 0),
            totalCount: Number(bRow.total_count || 0),
          };

          // 3. Keyset cursor-paginated worklist query (PAGE_SIZE + 1 to detect nextCursor)
          const rowsRes = await tx.execute(sql`
            SELECT
              fi.id,
              fi.invoice_number AS "invoiceNumber",
              fi.student_id AS "studentId",
              fi.due_date AS "dueDate",
              fi.balance_amount::float AS "balanceAmount",
              fi.late_fee_amount::float AS "lateFeeAmount",
              fi.status,
              fi.term,
              fi.reminder_sent_d7 AS "reminderSent",
              ${daysOverdueExpr}::int AS "daysOverdue",
              s.admission_number AS "admissionNumber",
              s.first_name_encrypted AS "firstNameEncrypted",
              s.last_name_encrypted AS "lastNameEncrypted",
              s.current_class_id AS "classId",
              c.display_name AS "className",
              sec.name AS "sectionName",
              fh.name AS "feeHeadName"
            FROM fee_invoices fi
            JOIN students s ON s.id = fi.student_id
            LEFT JOIN classes c ON c.id = s.current_class_id
            LEFT JOIN sections sec ON sec.id = s.current_section_id
            LEFT JOIN fee_structures fs ON fs.id = fi.fee_structure_id
            LEFT JOIN fee_heads fh ON fh.id = fs.fee_head_id
            WHERE fi.school_id = ${schoolId}
              AND fi.deleted_at IS NULL
              ${ayFilter}
              ${classFilter}
              ${sectionFilter}
              ${feeHeadFilter}
              ${termFilter}
              ${statusFilter}
              ${dateFromFilter}
              ${dateToFilter}
              ${minDueFilter}
              ${maxDueFilter}
              ${searchFilter}
              ${bracketFilter}
              ${cursorFilter}
            ORDER BY fi.due_date ASC, fi.id ASC
            LIMIT ${PAGE_SIZE + 1}
          `);

          const rawRows = (rowsRes.rows || []) as any[];
          const hasMore = rawRows.length > PAGE_SIZE;
          const pageRows = hasMore ? rawRows.slice(0, PAGE_SIZE) : rawRows;

          const items: DueFeeRow[] = pageRows.map((inv) => {
            const daysOverdue = Number(inv.daysOverdue || 0);
            let ageBracket: "0-30" | "31-60" | "60+" = "0-30";
            if (daysOverdue > 60) ageBracket = "60+";
            else if (daysOverdue > 30) ageBracket = "31-60";

            const fn = decryptData(inv.firstNameEncrypted) || "";
            const ln = decryptData(inv.lastNameEncrypted) || "";
            const studentName = `${fn} ${ln}`.trim() || "Student";

            return {
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              studentId: inv.studentId,
              studentName,
              admissionNumber: inv.admissionNumber || "N/A",
              className: inv.sectionName
                ? `${inv.className || "Class"} - ${inv.sectionName}`
                : inv.className || "Unassigned",
              classId: inv.classId || "",
              feeHeadName: inv.feeHeadName || "Tuition / General Fee",
              dueDate: inv.dueDate
                ? new Date(inv.dueDate).toISOString()
                : new Date().toISOString(),
              balanceAmount: Number(inv.balanceAmount || 0),
              lateFeeAmount: Number(inv.lateFeeAmount || 0),
              daysOverdue,
              ageBracket,
              status: inv.status,
              term: inv.term,
              reminderSent: Boolean(inv.reminderSent),
            };
          });

          const lastItem = items[items.length - 1];
          const nextCursor =
            hasMore && lastItem ? `${lastItem.dueDate}|${lastItem.id}` : null;

          return {
            items,
            bucketSummary,
            nextCursor,
            academicYearsList: Array.isArray(metaRow.academic_years)
              ? metaRow.academic_years
              : [],
            classesList: Array.isArray(metaRow.classes) ? metaRow.classes : [],
            sectionsList: Array.isArray(metaRow.sections) ? metaRow.sections : [],
            feeHeadsList: Array.isArray(metaRow.fee_heads) ? metaRow.fee_heads : [],
          };
        });
      },
      { maxQueries: 10, label: "Dues Work List (PF 1.2 <= 10 queries)" }
    );
  });

  const {
    items,
    bucketSummary,
    nextCursor,
    academicYearsList,
    classesList,
    sectionsList,
    feeHeadsList,
  } = data;

  return (
    <div className="space-y-6">
      <FinanceTabs activeSection="finance" userRole={session.user.role} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-3xl border border-border/40 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Operations & Defaulters
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-2">
            Search Due Fees & Aging Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track receivables across aging brackets, explore student fee ledgers in slide-over drawers, and trigger instant reminders.
          </p>
        </div>

        <QuickActionBar userRole={session.user.role} />
      </div>

      <DueFeesClient
        items={items}
        totalDue={bucketSummary.totalDue}
        bracket0to30={bucketSummary.bracket0to30}
        bracket31to60={bucketSummary.bracket31to60}
        bracket60plus={bucketSummary.bracket60plus}
        totalCount={bucketSummary.totalCount}
        pageSize={PAGE_SIZE}
        nextCursor={nextCursor}
        activeCursor={cursorId ? searchParams.cursor : undefined}
        academicYearsList={academicYearsList}
        classesList={classesList}
        sectionsList={sectionsList}
        feeHeadsList={feeHeadsList}
        activeFilters={{
          ayId,
          classId,
          sectionId,
          feeHeadId,
          term,
          status,
          bracket,
          dueDateFrom: searchParams.dueDateFrom,
          dueDateTo: searchParams.dueDateTo,
          minDue: searchParams.minDue,
          maxDue: searchParams.maxDue,
          q: searchParams.q,
        }}
      />
    </div>
  );
}
