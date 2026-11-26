"use server";

import { db, withTenant } from "@/db";
import {
  feeInvoices,
  feePayments,
  feeRefunds,
  accountLedgerTransactions,
  bankAccounts,
  students,
  studentFamilyMembers,
  classes,
  sections,
  domainEvents,
} from "@/db/schema";
import { eq, and, or, inArray, desc, sql, gt, ilike, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import {
  decryptData,
  computeSearchHash,
  computeLegacySearchHash,
} from "@/lib/encryption";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import crypto from "crypto";
import {
  assertAcademicYearNotLocked,
  getBankAccountChartAccountId,
  getCashMainChartAccountId,
  getStudentReceivableChartAccountId,
} from "@schoolmitra/backend/lib/chartOfAccountsEngine";
import {
  projectToStudentFeeCard,
  fetchStudentFeeCard,
} from "@/lib/studentFeeCard";
import { archiveReceiptPdfToS3 } from "@/workers/financeAutomation";
import { invalidateFinanceOnPayment } from "@/lib/financeCache";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toPaise(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val));
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

function formatSchoolAddress(school: any): string | undefined {
  if (!school) return undefined;
  const parts = [school.address, school.city, school.state, school.pincode]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

export interface InvoiceCollectionItem {
  invoiceId: string;
  amountPaid: number;
  discountAdjustment?: number | undefined;
  lateFeeAdjustment?: number | undefined;
}

export interface MultiInvoiceCollectionPayload {
  studentId: string;
  items: InvoiceCollectionItem[];
  paymentMethod: "CASH" | "UPI" | "CHEQUE" | "DD" | "NEFT" | "RTGS" | "ONLINE";
  bankAccountId?: string | null;
  transactionReference?: string | null;
  remarks?: string | null;
  idempotencyKey?: string;
}

interface CachedLookup {
  expiresAt: number;
  map: Map<string, string>;
}
const classCache = new Map<string, CachedLookup>();
const sectionCache = new Map<string, CachedLookup>();
const CLASS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getCachedClassMap(schoolId: string): Promise<Map<string, string>> {
  const now = Date.now();
  const cached = classCache.get(schoolId);
  if (cached && cached.expiresAt > now) {
    return cached.map;
  }
  const schoolClasses = await withTenant(schoolId, async (tx) => {
    return await tx.query.classes.findMany({
      where: eq(classes.schoolId, schoolId),
      columns: { id: true, displayName: true },
    });
  });
  const map = new Map(schoolClasses.map((c: any) => [c.id, c.displayName]));
  classCache.set(schoolId, { expiresAt: now + CLASS_CACHE_TTL_MS, map });
  return map;
}

async function getCachedSectionMap(schoolId: string): Promise<Map<string, string>> {
  const now = Date.now();
  const cached = sectionCache.get(schoolId);
  if (cached && cached.expiresAt > now) {
    return cached.map;
  }
  const schoolSections = await withTenant(schoolId, async (tx) => {
    if (!tx.query.sections?.findMany) return [];
    return await tx.query.sections.findMany({
      where: eq(sections.schoolId, schoolId),
      columns: { id: true, name: true },
    });
  });
  const map = new Map(schoolSections.map((s: any) => [s.id, s.name]));
  sectionCache.set(schoolId, { expiresAt: now + CLASS_CACHE_TTL_MS, map });
  return map;
}

export async function clearClassCache(schoolId?: string) {
  if (schoolId) {
    classCache.delete(schoolId);
    sectionCache.delete(schoolId);
  } else {
    classCache.clear();
    sectionCache.clear();
  }
}

/**
 * GAP-05 & P0 Partial Search: Server-side debounced student search.
 * Matches via:
 *  - `students.namePrefixHashes` GIN overlap (`&&` / `@>`) for 3+ char partial names
 *  - exact HKDF + legacy search hashes on first/last name
 *  - `admissionNumber` (`ilike`), `rollNumber` (`ilike`), valid UUID
 *  - `studentFamilyMembers` phone/email search hash
 *  - `feeInvoices.invoiceNumber` (`ilike`), `feePayments.receiptNumber` (`ilike`)
 *  - class / section name match
 *  - browse mode (empty query): prioritizes students with pending dues first with pagination.
 * Decrypts ONLY matched rows (<= 20) inside `withTenant`. Never decrypts the whole roster.
 */
export async function searchStudentsAction(
  query?: string,
  options?: { offset?: number; limit?: number },
) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const cleanQuery = (query || "").trim();
    const pageLimit = Math.min(Math.max(options?.limit ?? 20, 1), 50);
    const pageOffset = Math.max(options?.offset ?? 0, 0);

    // 1. Fetch cached classes & sections for name mapping & class/section query matching
    const [classMap, sectionMap] = await Promise.all([
      getCachedClassMap(school.id),
      getCachedSectionMap(school.id),
    ]);

    const result = await withTenant(school.id, async (tx) => {
      let studentRows: Array<{
        id: string;
        admissionNumber: string;
        firstNameEncrypted: string;
        lastNameEncrypted: string;
        currentClassId: string | null;
        currentSectionId?: string | null;
      }> = [];

      const hasSelect = typeof (tx as any).select === "function";

      if (!cleanQuery) {
        // Browse mode: prioritize students with pending dues first
        let prioritizedIds: string[] = [];
        if (hasSelect) {
          const dueRows = await (tx as any)
            .select({
              studentId: feeInvoices.studentId,
              dueSum: sql<string>`SUM(${feeInvoices.balanceAmount})`,
            })
            .from(feeInvoices)
            .where(
              and(
                eq(feeInvoices.schoolId, school.id),
                inArray(feeInvoices.status, ["PENDING", "PARTIAL", "OVERDUE"]),
                isNull(feeInvoices.deletedAt),
              ),
            )
            .groupBy(feeInvoices.studentId)
            .orderBy(sql`SUM(${feeInvoices.balanceAmount}) DESC`)
            .limit(pageLimit)
            .offset(pageOffset);
          prioritizedIds = dueRows.map((r: any) => r.studentId).filter(Boolean);
        }

        if (prioritizedIds.length > 0) {
          const dueStudents = await tx.query.students.findMany({
            where: and(
              eq(students.schoolId, school.id),
              eq(students.isActive, true),
              inArray(students.id, prioritizedIds),
            ),
            columns: {
              id: true,
              admissionNumber: true,
              firstNameEncrypted: true,
              lastNameEncrypted: true,
              currentClassId: true,
              currentSectionId: true,
            },
            limit: pageLimit,
          });
          studentRows = dueStudents;

          if (studentRows.length < pageLimit) {
            const remaining = pageLimit - studentRows.length;
            const excludeIds = studentRows.map((s) => s.id);
            const extraStudents = await tx.query.students.findMany({
              where: and(
                eq(students.schoolId, school.id),
                eq(students.isActive, true),
                ...(excludeIds.length > 0
                  ? [sql`${students.id} NOT IN (${sql.join(excludeIds.map((id) => sql`${id}`), sql`, `)})`]
                  : []),
              ),
              columns: {
                id: true,
                admissionNumber: true,
                firstNameEncrypted: true,
                lastNameEncrypted: true,
                currentClassId: true,
                currentSectionId: true,
              },
              limit: remaining,
            });
            studentRows = [...studentRows, ...extraStudents];
          }
        } else {
          studentRows = await tx.query.students.findMany({
            where: and(eq(students.schoolId, school.id), eq(students.isActive, true)),
            columns: {
              id: true,
              admissionNumber: true,
              firstNameEncrypted: true,
              lastNameEncrypted: true,
              currentClassId: true,
              currentSectionId: true,
            },
            limit: pageLimit,
            ...(pageOffset > 0 ? { offset: pageOffset } : {}),
          });
        }
      } else {
        // Indexed search across prefix hashes, exact hashes, admission/roll, UUID, family, invoice, receipt, class/section
        const normQuery = cleanQuery.toLowerCase().replace(/\s+/g, " ").trim();
        const hash = computeSearchHash(normQuery);
        const legacyHash = computeLegacySearchHash(normQuery);

        // Escape LIKE metacharacters (%, _, \) to prevent wildcard injection (OPEN-16)
        const escapedLikeQuery = cleanQuery.replace(/[%_\\]/g, "\\$&");

        const searchConditions: any[] = [
          ilike(students.admissionNumber, `${escapedLikeQuery}%`),
          ilike(students.rollNumber, `${escapedLikeQuery}%`),
          eq(students.firstNameSearchHash, hash),
          eq(students.lastNameSearchHash, hash),
          eq(students.firstNameSearchHash, legacyHash),
          eq(students.lastNameSearchHash, legacyHash),
        ];

        if (UUID_REGEX.test(cleanQuery)) {
          searchConditions.push(eq(students.id, cleanQuery));
        }

        // 3+ char partial name match via GIN-indexed name_prefix_hashes
        const prefixTokenHashes: string[] = [];
        if (normQuery.length >= 3) {
          prefixTokenHashes.push(hash, legacyHash);
        }

        const parts = normQuery.split(/\s+/).filter(Boolean);
        if (parts.length > 1) {
          for (const part of parts) {
            const pHash = computeSearchHash(part);
            const pLegacy = computeLegacySearchHash(part);
            searchConditions.push(
              eq(students.firstNameSearchHash, pHash),
              eq(students.lastNameSearchHash, pHash),
              eq(students.firstNameSearchHash, pLegacy),
              eq(students.lastNameSearchHash, pLegacy),
            );
            if (part.length >= 3) {
              prefixTokenHashes.push(pHash, pLegacy);
            }
          }
        }

        if (prefixTokenHashes.length > 0) {
          const uniquePrefixHashes = Array.from(new Set(prefixTokenHashes));
          searchConditions.push(
            sql`${students.namePrefixHashes} && ARRAY[${sql.join(
              uniquePrefixHashes.map((h) => sql`${h}`),
              sql`, `,
            )}]::text[]`,
          );
        }

        // Class & Section name matches (in-memory cached maps)
        const matchingClassIds: string[] = [];
        for (const [cid, cname] of classMap.entries()) {
          if (cname && cname.toLowerCase().includes(normQuery)) {
            matchingClassIds.push(cid);
          }
        }
        if (matchingClassIds.length > 0) {
          searchConditions.push(inArray(students.currentClassId, matchingClassIds));
        }

        const matchingSectionIds: string[] = [];
        for (const [sid, sname] of sectionMap.entries()) {
          if (sname && sname.toLowerCase().includes(normQuery)) {
            matchingSectionIds.push(sid);
          }
        }
        if (matchingSectionIds.length > 0) {
          searchConditions.push(inArray(students.currentSectionId, matchingSectionIds));
        }

        // Auxiliary lookups (family mobile/email hash, invoice #, receipt #) via tx.select
        if (hasSelect) {
          const [famRows, invRows, payRows] = await Promise.all([
            (tx as any)
              .select({ studentId: studentFamilyMembers.studentId })
              .from(studentFamilyMembers)
              .where(
                and(
                  eq(studentFamilyMembers.schoolId, school.id),
                  or(
                    eq(studentFamilyMembers.mobileSearchHash, hash),
                    eq(studentFamilyMembers.mobileSearchHash, legacyHash),
                    eq(studentFamilyMembers.emailSearchHash, hash),
                    eq(studentFamilyMembers.emailSearchHash, legacyHash),
                  ),
                ),
              )
              .limit(20),
            (tx as any)
              .select({ studentId: feeInvoices.studentId })
              .from(feeInvoices)
              .where(
                and(
                  eq(feeInvoices.schoolId, school.id),
                  ilike(feeInvoices.invoiceNumber, `${escapedLikeQuery}%`),
                ),
              )
              .limit(20),
            (tx as any)
              .select({ studentId: feePayments.studentId })
              .from(feePayments)
              .where(
                and(
                  eq(feePayments.schoolId, school.id),
                  or(
                    ilike(feePayments.receiptNumber, `${escapedLikeQuery}%`),
                    ilike(feePayments.receiptGroupId, `${escapedLikeQuery}%`),
                  ),
                ),
              )
              .limit(20),
          ]);

          const auxStudentIds = Array.from(
            new Set([
              ...famRows.map((r: any) => r.studentId),
              ...invRows.map((r: any) => r.studentId),
              ...payRows.map((r: any) => r.studentId),
            ].filter(Boolean)),
          );
          if (auxStudentIds.length > 0) {
            searchConditions.push(inArray(students.id, auxStudentIds));
          }
        }

        studentRows = await tx.query.students.findMany({
          where: and(
            eq(students.schoolId, school.id),
            eq(students.isActive, true),
            or(...searchConditions),
          ),
          columns: {
            id: true,
            admissionNumber: true,
            firstNameEncrypted: true,
            lastNameEncrypted: true,
            currentClassId: true,
            currentSectionId: true,
          },
          limit: pageLimit,
          ...(pageOffset > 0 ? { offset: pageOffset } : {}),
        });
      }

      if (studentRows.length === 0) {
        return [];
      }

      // 3. Decrypt ONLY returned rows (<= 20 rows, at most 40 decrypts instead of full table)
      const matchedStudents = studentRows.map((s) => {
        const firstName = decryptData(s.firstNameEncrypted) || "";
        const lastName = decryptData(s.lastNameEncrypted) || "";
        const fullName = `${firstName} ${lastName}`.trim();
        const admNo = s.admissionNumber || "";
        const className = s.currentClassId
          ? classMap.get(s.currentClassId) || "Class"
          : "Unassigned";
        const sectionName = s.currentSectionId
          ? sectionMap.get(s.currentSectionId) || null
          : null;

        return {
          id: s.id,
          admissionNumber: admNo,
          name: fullName || "Student",
          className,
          sectionName,
        };
      });

      // 4. Fetch pending/overdue invoices for matched students to compute total dues (integer paise)
      const matchedIds = matchedStudents.map((s) => s.id);
      const studentInvoices = await tx.query.feeInvoices.findMany({
        where: and(
          eq(feeInvoices.schoolId, school.id),
          inArray(feeInvoices.studentId, matchedIds),
          inArray(feeInvoices.status, ["PENDING", "PARTIAL", "OVERDUE"]),
        ),
      });

      const duesMap = new Map<string, { totalDuePaise: number; count: number }>();
      for (const inv of studentInvoices) {
        const existing = duesMap.get(inv.studentId) || { totalDuePaise: 0, count: 0 };
        existing.totalDuePaise += toPaise(inv.balanceAmount);
        existing.count += 1;
        duesMap.set(inv.studentId, existing);
      }

      const projected = matchedStudents.map((s) => {
        const dueInfo = duesMap.get(s.id) || { totalDuePaise: 0, count: 0 };
        return projectToStudentFeeCard({
          id: s.id,
          admissionNumber: s.admissionNumber,
          fullName: s.name,
          name: s.name,
          className: s.className,
          sectionName: s.sectionName,
          totalDue: fromPaise(dueInfo.totalDuePaise),
          pendingInvoiceCount: dueInfo.count,
        });
      });

      // Prioritize students with pending dues first
      projected.sort((a, b) => (b.totalDue || 0) - (a.totalDue || 0));
      return projected;
    });

    return {
      success: true,
      students: result,
      hasMore: result.length === pageLimit,
    };
  } catch (error: any) {
    console.error("searchStudentsAction error:", error);
    return {
      success: false,
      message: error.message || "Failed to search students",
      students: [],
      hasMore: false,
    };
  }
}

export interface StudentFinancialSummary {
  totalBilled: number;
  totalPaid: number;
  totalConcessions: number;
  totalRefunded: number;
  totalOutstanding: number;
  overdueAmount: number;
  creditBalance: number;
  recentPayments: Array<{
    id: string;
    receiptNumber: string;
    receiptGroupId: string | null;
    amountPaid: number;
    paymentMethod: string;
    paymentDate: string;
    transactionReference: string | null;
  }>;
}

/**
 * GT-06: Fetch authoritative StudentFeeCard projection plus consolidated financial summary.
 * Sanitizes and strips all non-finance PII data server-side.
 */
export async function getStudentFeeCardAction(studentId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    if (!studentId) {
      return { success: false, message: "Student ID is required", feeCard: null, summary: null };
    }

    const feeCard = await fetchStudentFeeCard(db, school.id, studentId);
    if (!feeCard) {
      return { success: false, message: "Student not found", feeCard: null, summary: null };
    }

    const summary = await withTenant(school.id, async (tx): Promise<StudentFinancialSummary> => {
      const [activePayments, allPayments] = await Promise.all([
        tx.query.feePayments.findMany({
          where: and(
            eq(feePayments.schoolId, school.id),
            eq(feePayments.studentId, studentId),
            eq(feePayments.isCancelled, false),
          ),
          orderBy: [desc(feePayments.paymentDate)],
          limit: 15,
        }),
        tx.query.feePayments.findMany({
          where: and(
            eq(feePayments.schoolId, school.id),
            eq(feePayments.studentId, studentId),
          ),
          columns: { id: true, amountPaid: true, isCancelled: true },
        }),
      ]);

      const allPaymentIds = allPayments.map((p) => p.id);
      const refunds =
        allPaymentIds.length > 0
          ? await tx.query.feeRefunds.findMany({
              where: and(
                eq(feeRefunds.schoolId, school.id),
                inArray(feeRefunds.feePaymentId, allPaymentIds),
                inArray(feeRefunds.status, ["APPROVED", "PROCESSED"]),
              ),
            })
          : [];

      const now = Date.now();
      let totalBilledPaise = 0;
      let totalConcessionsPaise = 0;
      let totalOutstandingPaise = 0;
      let overduePaise = 0;

      for (const inv of feeCard.invoices) {
        if (inv.status === "CANCELLED" || inv.status === "WAIVED" || inv.status === "PROJECTED") {
          continue;
        }
        totalBilledPaise += toPaise(inv.netAmount);
        totalConcessionsPaise += toPaise(inv.discountAmount);
        const balP = toPaise(inv.balanceAmount);
        if (["PENDING", "PARTIAL", "OVERDUE"].includes(inv.status)) {
          totalOutstandingPaise += balP;
          const dueTs = inv.dueDate ? new Date(inv.dueDate).getTime() : NaN;
          if (inv.status === "OVERDUE" || (Number.isFinite(dueTs) && dueTs < now && balP > 0)) {
            overduePaise += balP;
          }
        }
      }

      let totalPaidPaise = 0;
      for (const p of allPayments) {
        if (!p.isCancelled) {
          totalPaidPaise += toPaise(p.amountPaid);
        }
      }

      let totalRefundedPaise = 0;
      for (const r of refunds) {
        totalRefundedPaise += toPaise(r.refundAmount);
      }

      return {
        totalBilled: fromPaise(totalBilledPaise),
        totalPaid: fromPaise(totalPaidPaise),
        totalConcessions: fromPaise(totalConcessionsPaise),
        totalRefunded: fromPaise(totalRefundedPaise),
        totalOutstanding: fromPaise(totalOutstandingPaise),
        overdueAmount: fromPaise(overduePaise),
        creditBalance: feeCard.creditBalance,
        recentPayments: activePayments.map((p) => ({
          id: p.id,
          receiptNumber: p.receiptNumber,
          receiptGroupId: p.receiptGroupId || null,
          amountPaid: fromPaise(toPaise(p.amountPaid)),
          paymentMethod: p.paymentMethod,
          paymentDate:
            p.paymentDate instanceof Date
              ? p.paymentDate.toISOString()
              : String(p.paymentDate),
          transactionReference: p.transactionReference || null,
        })),
      };
    });

    return { success: true, feeCard, summary };
  } catch (error: any) {
    console.error("getStudentFeeCardAction error:", error);
    return {
      success: false,
      message: error.message || "Failed to load student fee card",
      feeCard: null,
      summary: null,
    };
  }
}

/**
 * Fetch pending invoices for a specific student with breakdown and suggested late fees.
 */
export async function getStudentInvoicesAction(studentId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    if (!studentId) {
      return { success: false, message: "Student ID is required", invoices: [] };
    }

    const invoices = await withTenant(school.id, async (tx) => {
      return await tx.query.feeInvoices.findMany({
        where: and(
          eq(feeInvoices.schoolId, school.id),
          eq(feeInvoices.studentId, studentId),
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
      });
    });

    const now = new Date();

    const mapped = invoices.map((inv) => {
      let suggestedLateFeePaise = 0;
      if (inv.dueDate && new Date(inv.dueDate) < now) {
        const daysOverdue = Math.floor(
          (now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24),
        );
        const graceDays = inv.feeStructure?.lateFeeStartAfterDays || 0;
        if (daysOverdue > graceDays) {
          const daysPastGrace = daysOverdue - graceDays;
          const fixedPaise = toPaise(inv.feeStructure?.lateFeeAmount);
          const dailyPaise = toPaise(inv.feeStructure?.dailyLateFeeAmount);
          const capPaise = inv.feeStructure?.lateFeeCap
            ? toPaise(inv.feeStructure.lateFeeCap)
            : Number.MAX_SAFE_INTEGER;

          let calculatedPaise = fixedPaise;
          if (dailyPaise > 0) {
            calculatedPaise += daysPastGrace * dailyPaise;
          }
          suggestedLateFeePaise = Math.min(calculatedPaise, capPaise);
        }
      }

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        feeHeadName: inv.feeStructure?.feeHead?.name || "Fee Invoice",
        term: inv.term,
        dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString() : new Date().toISOString(),
        grossAmount: fromPaise(toPaise(inv.grossAmount)),
        discountAmount: fromPaise(toPaise(inv.discountAmount)),
        lateFeeAmount: fromPaise(toPaise(inv.lateFeeAmount)),
        taxAmount: fromPaise(toPaise(inv.taxAmount)),
        netAmount: fromPaise(toPaise(inv.netAmount)),
        paidAmount: fromPaise(toPaise(inv.paidAmount)),
        balanceAmount: fromPaise(toPaise(inv.balanceAmount)),
        suggestedLateFee: fromPaise(suggestedLateFeePaise),
        status: inv.status,
      };
    });

    return { success: true, invoices: mapped };
  } catch (error: any) {
    console.error("getStudentInvoicesAction error:", error);
    return { success: false, message: error.message || "Failed to load invoices", invoices: [] };
  }
}

async function resolveStudentDisplayInfo(tx: any, schoolId: string, studentId: string) {
  const student = await tx.query.students.findFirst({
    where: and(eq(students.id, studentId), eq(students.schoolId, schoolId)),
  });
  const firstName = decryptData(student?.firstNameEncrypted || null) || "";
  const lastName = decryptData(student?.lastNameEncrypted || null) || "";
  const studentName = `${firstName} ${lastName}`.trim() || "Student";

  const [classRow, sectionRow] = await Promise.all([
    student?.currentClassId
      ? tx.query.classes.findFirst({
          where: and(eq(classes.id, student.currentClassId), eq(classes.schoolId, schoolId)),
        })
      : Promise.resolve(null),
    student?.currentSectionId
      ? tx.query.sections.findFirst({
          where: and(eq(sections.id, student.currentSectionId), eq(sections.schoolId, schoolId)),
        })
      : Promise.resolve(null),
  ]);

  const className = [
    classRow?.displayName || "Class",
    sectionRow?.name,
  ]
    .filter(Boolean)
    .join(" - ");

  return {
    studentName,
    admissionNumber: student?.admissionNumber || "N/A",
    className,
  };
}

/**
 * GAP-01 & GAP-04: Multi-invoice counter collection in a single database transaction.
 * Uses integer-paise math, emits `FeePaidEvent` into `domainEvents` inside `withTenant`,
 * posts consolidated GL entry, updates bank balance, and writes immutable audit logs.
 */
export async function processCounterCollection(input: FormData | MultiInvoiceCollectionPayload) {
  let ctx: any = null;
  let school: any = null;
  let idempotencyKey: string | null = null;

  try {
    ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    school = await requireSchool(ctx);

    let studentId = "";
    let items: InvoiceCollectionItem[] = [];
    let paymentMethod: any = "CASH";
    let bankAccountId: string | null = null;
    let transactionReference: string | null = null;
    let remarks: string | null = null;

    if (input instanceof FormData) {
      const payloadStr = input.get("payload") as string;
      if (payloadStr) {
        const parsed = JSON.parse(payloadStr);
        studentId = parsed.studentId;
        items = parsed.items;
        paymentMethod = parsed.paymentMethod || "CASH";
        bankAccountId = parsed.bankAccountId || null;
        transactionReference = parsed.transactionReference || null;
        remarks = parsed.remarks || null;
        idempotencyKey = parsed.idempotencyKey || null;
      } else {
        const invoiceId = input.get("invoiceId") as string;
        const amountPaidStr = input.get("amountPaid") as string;
        paymentMethod = input.get("paymentMethod") || "CASH";
        transactionReference = (input.get("transactionReference") as string) || null;
        remarks = (input.get("remarks") as string) || null;
        bankAccountId = (input.get("bankAccountId") as string) || null;
        idempotencyKey = (input.get("idempotencyKey") as string) || null;

        const amountPaid = parseFloat(amountPaidStr);
        if (invoiceId && !isNaN(amountPaid) && amountPaid > 0) {
          items = [{ invoiceId, amountPaid }];
        }
      }
    } else {
      studentId = input.studentId;
      items = input.items;
      paymentMethod = input.paymentMethod || "CASH";
      bankAccountId = input.bankAccountId || null;
      transactionReference = input.transactionReference || null;
      remarks = input.remarks || null;
      idempotencyKey = input.idempotencyKey || null;
    }

    if (!items || items.length === 0) {
      return { success: false, message: "At least one invoice must be selected for payment." };
    }

    let totalAmountPaidPaise = 0;
    for (const item of items) {
      if (
        !item ||
        typeof item.amountPaid !== "number" ||
        !Number.isFinite(item.amountPaid) ||
        Math.round(item.amountPaid * 100) <= 0
      ) {
        return { success: false, message: "Payment amount must be greater than zero." };
      }
      totalAmountPaidPaise += Math.round(item.amountPaid * 100);
    }

    if (totalAmountPaidPaise <= 0) {
      return { success: false, message: "Total payment amount must be greater than zero." };
    }

    const totalAmountPaid = fromPaise(totalAmountPaidPaise);
    const schoolAddress = formatSchoolAddress(school);
    const schoolPhone = school.phone || undefined;

    // Enforce fiscal lock invariant (ACC-06)
    await assertAcademicYearNotLocked(school.id, new Date(), db);

    // FIX-02: Idempotency check (within last 24 hours)
    if (idempotencyKey) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const idempPayload = await withTenant(school.id, async (tx) => {
        const existingPayments = await tx.query.feePayments.findMany({
          where: and(
            eq(feePayments.schoolId, school.id),
            eq(feePayments.collectedById, ctx.userId),
            eq(feePayments.idempotencyKey, idempotencyKey!),
            gt(feePayments.createdAt, yesterday),
          ),
          with: {
            invoice: {
              with: {
                feeStructure: {
                  with: {
                    feeHead: true,
                  },
                },
              },
            },
          },
        });

        if (existingPayments.length === 0 || !existingPayments[0]) return null;
        const firstPayment = existingPayments[0];
        const stuInfo = await resolveStudentDisplayInfo(tx, school.id, firstPayment.studentId);
        return { existingPayments, firstPayment, stuInfo };
      });

      if (idempPayload) {
        const { existingPayments, firstPayment, stuInfo } = idempPayload;
        const totalPaidPaise = existingPayments.reduce(
          (acc, p) => acc + toPaise(p.amountPaid),
          0,
        );
        const totalPaid = fromPaise(totalPaidPaise);

        return {
          success: true,
          message: "Idempotent response: payment was already processed.",
          receiptNumber: firstPayment.receiptGroupId || firstPayment.receiptNumber,
          paymentId: firstPayment.id,
          totalAmountPaid: totalPaid,
          paymentMethod: firstPayment.paymentMethod,
          transactionReference: firstPayment.transactionReference || undefined,
          date: firstPayment.paymentDate
            ? new Date(firstPayment.paymentDate).toLocaleString("en-IN")
            : new Date().toLocaleString("en-IN"),
          receiptData: {
            schoolName: school.name || "SchoolMitra Campus",
            schoolAddress,
            schoolPhone,
            receiptNumber: firstPayment.receiptGroupId || firstPayment.receiptNumber,
            date: firstPayment.paymentDate
              ? new Date(firstPayment.paymentDate).toISOString()
              : new Date().toISOString(),
            cashierName: ctx.email,
            student: {
              name: stuInfo.studentName,
              admissionNumber: stuInfo.admissionNumber,
              className: stuInfo.className,
            },
            items: existingPayments.map((p) => ({
              feeHeadName: p.invoice?.feeStructure?.feeHead?.name || "Fee Invoice",
              invoiceNumber: p.invoice?.invoiceNumber || "N/A",
              term: p.invoice?.term || "ANNUAL",
              grossAmount: fromPaise(toPaise(p.invoice?.grossAmount ?? p.amountPaid)),
              discountAmount: fromPaise(toPaise(p.invoice?.discountAmount)),
              lateFeeAmount: fromPaise(toPaise(p.invoice?.lateFeeAmount)),
              amountPaid: fromPaise(toPaise(p.amountPaid)),
              balanceRemaining: fromPaise(toPaise(p.invoice?.balanceAmount)),
            })),
            totalAmountPaid: totalPaid,
            paymentMethod: firstPayment.paymentMethod,
            transactionReference: firstPayment.transactionReference,
            remarks: firstPayment.remarks,
            paymentId: firstPayment.id,
          },
        };
      }
    }

    const baseReceiptNumber = `REC-${new Date().getFullYear()}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;
    const txNumber = `TX-${new Date().getFullYear()}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;

    const receiptItems: Array<{
      feeHeadName: string;
      invoiceNumber: string;
      term: string;
      grossAmount: number;
      discountAmount?: number;
      lateFeeAmount?: number;
      amountPaid: number;
      balanceRemaining: number;
    }> = [];

    let primaryPaymentId = "";
    let resolvedStudentId = studentId;
    let studentDisplayInfo = {
      studentName: "Student",
      admissionNumber: "N/A",
      className: "Class",
    };

    await withTenant(school.id, async (tx) => {
      let itemIndex = 0;
      const recordedInvoiceIds: string[] = [];

      for (const item of items) {
        const itemAmountPaidPaise = Math.round(item.amountPaid * 100);
        if (!item || itemAmountPaidPaise <= 0) continue;
        itemIndex++;

        const [lockedInvoice] = await tx
          .select()
          .from(feeInvoices)
          .where(and(eq(feeInvoices.id, item.invoiceId), eq(feeInvoices.schoolId, school.id)))
          .for("update");

        if (!lockedInvoice) {
          throw new Error(`Invoice #${item.invoiceId} not found.`);
        }

        if (!resolvedStudentId) {
          resolvedStudentId = lockedInvoice.studentId;
        }

        const invoiceWithRelations = await tx.query.feeInvoices.findFirst({
          where: eq(feeInvoices.id, lockedInvoice.id),
          with: {
            feeStructure: {
              with: {
                feeHead: true,
              },
            },
          },
        });
        const invoice = invoiceWithRelations || (lockedInvoice as any);

        // Integer-paise math for adjustments & balances
        const currentGrossPaise = toPaise(lockedInvoice.grossAmount);
        const discountAdjPaise =
          item.discountAdjustment && item.discountAdjustment > 0
            ? Math.round(item.discountAdjustment * 100)
            : 0;
        const lateFeeAdjPaise =
          item.lateFeeAdjustment && item.lateFeeAdjustment > 0
            ? Math.round(item.lateFeeAdjustment * 100)
            : 0;

        const currentDiscountPaise = toPaise(lockedInvoice.discountAmount) + discountAdjPaise;
        const currentLateFeePaise = toPaise(lockedInvoice.lateFeeAmount) + lateFeeAdjPaise;
        const currentTaxPaise = toPaise(lockedInvoice.taxAmount);

        const newNetPaise = Math.max(
          0,
          currentGrossPaise - currentDiscountPaise + currentLateFeePaise + currentTaxPaise,
        );
        const currentPaidPaise = toPaise(invoice.paidAmount);
        const outstandingBalancePaise = Math.max(0, newNetPaise - currentPaidPaise);

        if (itemAmountPaidPaise > outstandingBalancePaise) {
          throw new Error(
            `Payment amount ₹${fromPaise(itemAmountPaidPaise)} exceeds outstanding invoice balance of ₹${fromPaise(
              outstandingBalancePaise,
            ).toFixed(2)}.`,
          );
        }

        const newPaidPaise = currentPaidPaise + itemAmountPaidPaise;
        const newBalancePaise = Math.max(0, newNetPaise - newPaidPaise);

        let newStatus: any = invoice.status;
        if (newBalancePaise <= 0) {
          newStatus = "PAID";
        } else if (newPaidPaise > 0) {
          newStatus = "PARTIAL";
        }

        const itemReceiptNumber =
          items.length === 1 ? baseReceiptNumber : `${baseReceiptNumber}-${itemIndex}`;

        const [payment] = await tx
          .insert(feePayments)
          .values({
            receiptNumber: itemReceiptNumber,
            receiptGroupId: baseReceiptNumber,
            idempotencyKey: idempotencyKey || null,
            schoolId: invoice.schoolId,
            studentId: invoice.studentId,
            feeInvoiceId: invoice.id,
            amountPaid: (itemAmountPaidPaise / 100).toFixed(2),
            paymentMethod,
            transactionReference,
            paymentDate: new Date(),
            remarks,
            collectedById: ctx.userId,
            status: "ACTIVE",
            isCancelled: false,
          })
          .returning();

        if (!payment) throw new Error("Failed to record fee payment.");
        if (!primaryPaymentId) primaryPaymentId = payment.id;
        recordedInvoiceIds.push(invoice.id);

        await tx
          .update(feeInvoices)
          .set({
            discountAmount: (currentDiscountPaise / 100).toFixed(2),
            lateFeeAmount: (currentLateFeePaise / 100).toFixed(2),
            netAmount: (newNetPaise / 100).toFixed(2),
            paidAmount: (newPaidPaise / 100).toFixed(2),
            balanceAmount: (newBalancePaise / 100).toFixed(2),
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(and(eq(feeInvoices.id, invoice.id), eq(feeInvoices.schoolId, school.id)));

        await logFeeAuditEvent(tx, {
          schoolId: school.id,
          action: "FEE_COLLECTED",
          entityType: "FEE_PAYMENT",
          entityId: payment.id,
          previousData: {
            invoiceId: invoice.id,
            paidAmount: invoice.paidAmount,
            balanceAmount: invoice.balanceAmount,
          },
          newData: {
            paymentId: payment.id,
            receiptNumber: itemReceiptNumber,
            amountPaid: fromPaise(itemAmountPaidPaise),
            newPaidAmount: fromPaise(newPaidPaise),
            newBalanceAmount: fromPaise(newBalancePaise),
            paymentMethod,
          },
          reason:
            remarks ||
            `Counter collection of ₹${(itemAmountPaidPaise / 100).toFixed(2)} via ${paymentMethod}`,
          performedById: ctx.userId,
        });

        receiptItems.push({
          feeHeadName: invoice.feeStructure?.feeHead?.name || "Fee Invoice",
          invoiceNumber: invoice.invoiceNumber,
          term: invoice.term,
          grossAmount: fromPaise(currentGrossPaise),
          discountAmount: fromPaise(currentDiscountPaise),
          lateFeeAmount: fromPaise(currentLateFeePaise),
          amountPaid: fromPaise(itemAmountPaidPaise),
          balanceRemaining: fromPaise(newBalancePaise),
        });
      }

      // Resolve student display info (real class + section name) inside transaction
      if (resolvedStudentId) {
        studentDisplayInfo = await resolveStudentDisplayInfo(tx, school.id, resolvedStudentId);
      }

      // 4. Resolve Chart of Accounts & Post Consolidated Credit Entry to General Ledger
      const debitAccountId =
        bankAccountId && bankAccountId !== "CASH"
          ? await getBankAccountChartAccountId(school.id, bankAccountId, tx)
          : await getCashMainChartAccountId(school.id, tx);
      const creditAccountId = await getStudentReceivableChartAccountId(school.id, tx);

      const formattedTotal = (totalAmountPaidPaise / 100).toFixed(2);

      await tx.insert(accountLedgerTransactions).values({
        schoolId: school.id,
        transactionNumber: txNumber,
        sourceType: "FEE_COLLECTION",
        sourceId: primaryPaymentId,
        bankAccountId: bankAccountId === "CASH" ? null : bankAccountId,
        debitAccountId,
        creditAccountId,
        transactionType: "CREDIT",
        amount: formattedTotal,
        description: `Fee Collection Receipt #${baseReceiptNumber} (${paymentMethod})`,
        transactionDate: new Date(),
        createdById: ctx.userId,
      });

      // 5. If deposited into bank account, increment current balance in integer paise
      if (bankAccountId && bankAccountId !== "CASH") {
        await tx
          .update(bankAccounts)
          .set({
            currentBalance: sql`${bankAccounts.currentBalance} + ${formattedTotal}`,
            updatedAt: new Date(),
          })
          .where(and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.schoolId, school.id)));
      }

      // 6. Emit durable FeePaidEvent into domainEvents inside withTenant transaction
      await tx.insert(domainEvents).values({
        schoolId: school.id,
        aggregateId: primaryPaymentId,
        eventType: "FeePaidEvent",
        payload: {
          paymentId: primaryPaymentId,
          receiptNumber: baseReceiptNumber,
          studentId: resolvedStudentId,
          invoiceIds: recordedInvoiceIds,
          amountPaid: totalAmountPaid,
          paymentMode: paymentMethod,
          transactionReference: transactionReference || "",
        },
        status: "PENDING",
      });
    });

    // AZ-03: Asynchronously archive receipt PDF to S3 in the background
    if (primaryPaymentId && school?.id) {
      archiveReceiptPdfToS3(school.id, primaryPaymentId).catch((err) => {
        console.error("[ReceiptArchival] Background S3 archival error:", err);
      });
    }

    if (school?.id) {
      await invalidateFinanceOnPayment(school.id, items.map((i) => i.invoiceId));
    }

    revalidatePath("/school/collect-fees");
    revalidatePath("/school/transactions");
    revalidatePath("/school/due-fees");
    revalidatePath("/school/accounting/dashboard");
    revalidatePath("/school/fees-dashboard");

    const nowDateStr = new Date().toLocaleString("en-IN");

    return {
      success: true,
      receiptNumber: baseReceiptNumber,
      paymentId: primaryPaymentId,
      totalAmountPaid,
      paymentMethod,
      transactionReference,
      date: nowDateStr,
      items: receiptItems,
      receiptData: {
        schoolName: school.name || "SchoolMitra Campus",
        schoolAddress,
        schoolPhone,
        receiptNumber: baseReceiptNumber,
        date: nowDateStr,
        cashierName: ctx.email,
        student: {
          name: studentDisplayInfo.studentName,
          admissionNumber: studentDisplayInfo.admissionNumber,
          className: studentDisplayInfo.className,
        },
        items: receiptItems,
        totalAmountPaid,
        paymentMethod,
        transactionReference,
        remarks: remarks || undefined,
        paymentId: primaryPaymentId,
      },
    };
  } catch (error: any) {
    // Catch 0017 unique-violation (23505) on (school_id, collected_by_id, idempotency_key) and return original receipt
    if (
      error?.code === "23505" ||
      error?.message?.includes("fee_payments_idempotency_unique_idx") ||
      error?.message?.includes("23505")
    ) {
      if (idempotencyKey && school?.id) {
        try {
          const recovered = await withTenant(school.id, async (tx) => {
            const existingPayments = await tx.query.feePayments.findMany({
              where: and(
                eq(feePayments.schoolId, school.id),
                eq(feePayments.idempotencyKey, idempotencyKey!),
              ),
              with: {
                invoice: {
                  with: {
                    feeStructure: {
                      with: {
                        feeHead: true,
                      },
                    },
                  },
                },
              },
            });
            if (existingPayments.length === 0 || !existingPayments[0]) return null;
            const stuInfo = await resolveStudentDisplayInfo(
              tx,
              school.id,
              existingPayments[0].studentId,
            );
            return { existingPayments, firstPayment: existingPayments[0], stuInfo };
          });

          if (recovered) {
            const { existingPayments, firstPayment, stuInfo } = recovered;
            const totalPaid = fromPaise(
              existingPayments.reduce((acc, p) => acc + toPaise(p.amountPaid), 0),
            );
            const schoolAddress = formatSchoolAddress(school);
            const schoolPhone = school?.phone || undefined;

            return {
              success: true,
              message: "Idempotent response: payment was already processed.",
              receiptNumber: firstPayment.receiptGroupId || firstPayment.receiptNumber,
              paymentId: firstPayment.id,
              totalAmountPaid: totalPaid,
              paymentMethod: firstPayment.paymentMethod,
              transactionReference: firstPayment.transactionReference || undefined,
              date: firstPayment.paymentDate.toLocaleString("en-IN"),
              items: existingPayments.map((p) => ({
                feeHeadName: p.invoice?.feeStructure?.feeHead?.name || "Fee Invoice",
                invoiceNumber: p.invoice?.invoiceNumber || "N/A",
                term: p.invoice?.term || "ANNUAL",
                grossAmount: fromPaise(toPaise(p.invoice?.grossAmount ?? p.amountPaid)),
                discountAmount: fromPaise(toPaise(p.invoice?.discountAmount)),
                lateFeeAmount: fromPaise(toPaise(p.invoice?.lateFeeAmount)),
                amountPaid: fromPaise(toPaise(p.amountPaid)),
                balanceRemaining: fromPaise(toPaise(p.invoice?.balanceAmount)),
              })),
              receiptData: {
                schoolName: school?.name || "SchoolMitra Campus",
                schoolAddress,
                schoolPhone,
                receiptNumber: firstPayment.receiptGroupId || firstPayment.receiptNumber,
                date: firstPayment.paymentDate
                  ? new Date(firstPayment.paymentDate).toISOString()
                  : new Date().toISOString(),
                cashierName: ctx?.email || "Cashier",
                student: {
                  name: stuInfo.studentName,
                  admissionNumber: stuInfo.admissionNumber,
                  className: stuInfo.className,
                },
                items: existingPayments.map((p) => ({
                  feeHeadName: p.invoice?.feeStructure?.feeHead?.name || "Fee Invoice",
                  invoiceNumber: p.invoice?.invoiceNumber || "N/A",
                  term: p.invoice?.term || "ANNUAL",
                  grossAmount: fromPaise(toPaise(p.invoice?.grossAmount ?? p.amountPaid)),
                  discountAmount: fromPaise(toPaise(p.invoice?.discountAmount)),
                  lateFeeAmount: fromPaise(toPaise(p.invoice?.lateFeeAmount)),
                  amountPaid: fromPaise(toPaise(p.amountPaid)),
                  balanceRemaining: fromPaise(toPaise(p.invoice?.balanceAmount)),
                })),
                totalAmountPaid: totalPaid,
                paymentMethod: firstPayment.paymentMethod,
                transactionReference: firstPayment.transactionReference,
                remarks: firstPayment.remarks,
                paymentId: firstPayment.id,
              },
            };
          }
        } catch (fetchErr) {
          console.error("Failed to recover original receipt after 23505:", fetchErr);
        }
      }
    }

    console.error("processCounterCollection error:", error);
    return { success: false, message: error.message || "Failed to process payment." };
  }
}
