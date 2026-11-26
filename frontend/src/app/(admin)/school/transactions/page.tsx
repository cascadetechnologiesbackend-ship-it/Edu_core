export const dynamic = "force-dynamic";

import { db, withTenant } from "@/db";
import { feePayments, feeInvoices, students, schools } from "@/db/schema";
import { eq, desc, and, lt, or, ilike, inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  decryptData,
  computeSearchHash,
  computeLegacySearchHash,
} from "@/lib/encryption";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { QuickActionBar } from "@/components/finance/QuickActionBar";
import { DayBookClient, TransactionRow } from "./DayBookClient";
import { ListOrdered } from "lucide-react";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { getCachedFinanceData, setCachedFinanceData } from "@/lib/financeCache";

interface CachedDayBookPayload {
  mappedTransactions: TransactionRow[];
  totalCollected: number;
  schoolName: string;
  asOf: string;
}

function toPaise(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val));
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { method?: string; q?: string; cursor?: string };
}) {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;
  const searchQ = (searchParams.q || "").trim();

  const data = await withDataPhaseTiming("/school/transactions", async () => {
    return assertQueryBudget(
      async () => {
        const isFirstPage = !searchParams.cursor && !searchQ;
        const filterKey = { method: searchParams.method || "all" };

        if (isFirstPage) {
          const cached = await getCachedFinanceData<CachedDayBookPayload>(
            schoolId,
            "day_book_page_1",
            filterKey,
          );
          if (cached) {
            return {
              schoolName: cached.schoolName,
              mappedTransactions: cached.mappedTransactions,
              totalCollected: cached.totalCollected,
              asOf: cached.asOf,
            };
          }
        }

        const result = await withTenant(schoolId, async (tx) => {
          const whereClauses: any[] = [eq(feePayments.schoolId, schoolId)];
          if (searchParams.method) {
            whereClauses.push(eq(feePayments.paymentMethod, searchParams.method as any));
          }
          if (searchParams.cursor) {
            whereClauses.push(lt(feePayments.id, searchParams.cursor));
          }

          // Server-side `q` search across receipt#, receiptGroupId, UTR, student name/admission, invoice#
          if (searchQ) {
            const escapedQ = searchQ.replace(/[%_\\]/g, "\\$&");
            const normQ = searchQ.toLowerCase().replace(/\s+/g, " ").trim();
            const qHash = computeSearchHash(normQ);
            const qLegacyHash = computeLegacySearchHash(normQ);

            const studentSearchConds: any[] = [
              ilike(students.admissionNumber, `${escapedQ}%`),
              eq(students.firstNameSearchHash, qHash),
              eq(students.lastNameSearchHash, qHash),
              eq(students.firstNameSearchHash, qLegacyHash),
              eq(students.lastNameSearchHash, qLegacyHash),
            ];
            if (normQ.length >= 3) {
              studentSearchConds.push(
                sql`${students.namePrefixHashes} && ARRAY[${qHash}, ${qLegacyHash}]::text[]`,
              );
            }

            const [matchedStudentRows, matchedInvoiceRows] = await Promise.all([
              tx
                .select({ id: students.id })
                .from(students)
                .where(and(eq(students.schoolId, schoolId), or(...studentSearchConds)))
                .limit(50),
              tx
                .select({ id: feeInvoices.id })
                .from(feeInvoices)
                .where(
                  and(
                    eq(feeInvoices.schoolId, schoolId),
                    ilike(feeInvoices.invoiceNumber, `${escapedQ}%`),
                  ),
                )
                .limit(50),
            ]);

            const qOrConditions: any[] = [
              ilike(feePayments.receiptNumber, `%${escapedQ}%`),
              ilike(feePayments.receiptGroupId, `%${escapedQ}%`),
              ilike(feePayments.transactionReference, `%${escapedQ}%`),
            ];
            if (matchedStudentRows.length > 0) {
              qOrConditions.push(
                inArray(
                  feePayments.studentId,
                  matchedStudentRows.map((s) => s.id),
                ),
              );
            }
            if (matchedInvoiceRows.length > 0) {
              qOrConditions.push(
                inArray(
                  feePayments.feeInvoiceId,
                  matchedInvoiceRows.map((i) => i.id),
                ),
              );
            }

            whereClauses.push(or(...qOrConditions));
          }

          // Active collection total (strictly excludes isCancelled = true)
          const activeWhereClauses: any[] = [
            eq(feePayments.schoolId, schoolId),
            eq(feePayments.isCancelled, false),
            ...whereClauses.filter((_, idx) => idx > 0), // keep method/q/cursor filters
          ];

          const [activeSchool, payments, activeSumRows] = await Promise.all([
            tx.query.schools.findFirst({
              where: eq(schools.id, schoolId),
            }),
            tx.query.feePayments.findMany({
              where: and(...whereClauses),
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
              orderBy: [desc(feePayments.paymentDate), desc(feePayments.id)],
              limit: 100,
            }),
            tx
              .select({
                total: sql<string>`COALESCE(SUM(${feePayments.amountPaid}), 0)`,
              })
              .from(feePayments)
              .where(and(...activeWhereClauses)),
          ]);

          if (!activeSchool) return null;

          const totalCollectedPaise = toPaise(activeSumRows[0]?.total || "0");
          const totalCollected = Math.round(totalCollectedPaise) / 100;

          const mappedTransactions: TransactionRow[] = payments.map((p) => {
            const firstName = decryptData(p.student?.firstNameEncrypted) || "";
            const lastName = decryptData(p.student?.lastNameEncrypted) || "";
            const studentName = `${firstName} ${lastName}`.trim() || "Student";

            return {
              id: p.id,
              receiptNumber: p.receiptNumber,
              receiptGroupId: p.receiptGroupId || null,
              invoiceNumber: p.invoice?.invoiceNumber || "N/A",
              studentId: p.studentId,
              studentName,
              admissionNumber: p.student?.admissionNumber || "N/A",
              feeHeadName: p.invoice?.feeStructure?.feeHead?.name || "Tuition Fee",
              term: p.invoice?.term || "ANNUAL",
              paymentMethod: p.paymentMethod,
              transactionReference: p.transactionReference,
              paymentDate: p.paymentDate
                ? new Date(p.paymentDate).toISOString()
                : new Date().toISOString(),
              amountPaid: toPaise(p.amountPaid) / 100,
              remarks: p.remarks,
              collectedByName: p.collectedBy?.email || undefined,
              grossAmount: p.invoice ? toPaise(p.invoice.grossAmount) / 100 : undefined,
              balanceRemaining: p.invoice ? toPaise(p.invoice.balanceAmount) / 100 : undefined,
              status: p.status || (p.isCancelled ? "REVERSED" : "ACTIVE"),
              isCancelled: Boolean(p.isCancelled || p.status === "REVERSED"),
              cancellationReason: p.cancellationReason || null,
            };
          });

          const asOf = new Date().toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          });

          return {
            schoolName: activeSchool.name,
            mappedTransactions,
            totalCollected,
            asOf,
          };
        });

        if (!result) return null;

        if (isFirstPage) {
          await setCachedFinanceData(
            schoolId,
            "day_book_page_1",
            {
              mappedTransactions: result.mappedTransactions,
              totalCollected: result.totalCollected,
              schoolName: result.schoolName,
              asOf: result.asOf,
            },
            {
              tags: [`school:${schoolId}`, `fin:payments:${schoolId}`],
              params: filterKey,
            },
          );
        }

        return result;
      },
      { maxQueries: 10, label: "/school/transactions" },
    );
  });

  if (!data) return <div>School not found</div>;

  return (
    <div className="space-y-6">
      {/* Finance Navigation Tabs */}
      <FinanceTabs activeSection="finance" />

      {/* Header Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-3xl border border-border/40 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <ListOrdered className="w-3.5 h-3.5" /> Operations & Day Book
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-2">
            Central Fee Transactions Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete transaction register with official A4 PDF &amp; thermal receipt reprinting, Excel export, and audited reversal guard.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl px-5 py-3 text-right">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase">
              Active Collection Total
            </p>
            <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-300">
              ₹{data.totalCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>

          <QuickActionBar userRole={session.user.role} />
        </div>
      </div>

      {/* Day Book Client */}
      <DayBookClient
        transactions={data.mappedTransactions}
        schoolName={data.schoolName}
        userRole={session.user.role}
        activeMethod={searchParams.method}
        asOf={data.asOf}
      />
    </div>
  );
}
