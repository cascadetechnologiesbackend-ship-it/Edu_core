"use server";

import { db } from "@/db";
import {
  feeInvoices,
  feePayments,
  accountLedgerTransactions,
  bankAccounts,
  students,
  classes,
} from "@/db/schema";
import { eq, and, or, inArray, desc, sql, gt, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { decryptData, computeSearchHash, computeLegacySearchHash } from "@/lib/encryption";
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

interface CachedClasses {
  expiresAt: number;
  classMap: Map<string, string>;
}
const classCache = new Map<string, CachedClasses>();
const CLASS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getCachedClassMap(schoolId: string): Promise<Map<string, string>> {
  const now = Date.now();
  const cached = classCache.get(schoolId);
  if (cached && cached.expiresAt > now) {
    return cached.classMap;
  }
  const schoolClasses = await db.query.classes.findMany({
    where: eq(classes.schoolId, schoolId),
    columns: { id: true, displayName: true },
  });
  const map = new Map(schoolClasses.map((c) => [c.id, c.displayName]));
  classCache.set(schoolId, { expiresAt: now + CLASS_CACHE_TTL_MS, classMap: map });
  return map;
}

export async function clearClassCache(schoolId?: string) {
  if (schoolId) {
    classCache.delete(schoolId);
  } else {
    classCache.clear();
  }
}

/**
 * GAP-05: Server-side debounced student search.
 * High-performance indexed lookup using dual search hashes and admission number prefix.
 * Decrypts student names server-side only for matched rows (<= 20); scopes by tenant schoolId.
 * Returns matching students with aggregated dues summaries.
 */
export async function searchStudentsAction(query?: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const cleanQuery = (query || "").trim();

    // 1. Fetch cached classes for class name mapping (zero DB round-trip on warm searches)
    const classMap = await getCachedClassMap(school.id);

    // 2. Query students matching search hash or admission prefix, capped at LIMIT 20 at DB level
    let studentRows: Array<{
      id: string;
      admissionNumber: string;
      firstNameEncrypted: string;
      lastNameEncrypted: string;
      currentClassId: string | null;
    }> = [];

    if (!cleanQuery) {
      // Empty query: fetch first 20 active students for this school
      studentRows = await db.query.students.findMany({
        where: and(eq(students.schoolId, school.id), eq(students.isActive, true)),
        columns: {
          id: true,
          admissionNumber: true,
          firstNameEncrypted: true,
          lastNameEncrypted: true,
          currentClassId: true,
        },
        limit: 20,
      });
    } else {
      // Indexed dual search hash (HKDF + legacy) and admission number prefix match
      const hash = computeSearchHash(cleanQuery);
      const legacyHash = computeLegacySearchHash(cleanQuery);

      // Escape LIKE metacharacters (%, _, \) to prevent wildcard injection in admission number match (OPEN-16)
      const escapedLikeQuery = cleanQuery.replace(/[%_\\]/g, "\\$&");

      const searchConditions = [
        ilike(students.admissionNumber, `${escapedLikeQuery}%`),
        eq(students.firstNameSearchHash, hash),
        eq(students.lastNameSearchHash, hash),
        eq(students.firstNameSearchHash, legacyHash),
        eq(students.lastNameSearchHash, legacyHash),
      ];

      // Multi-word name support (e.g. "Rahul Sharma")
      const parts = cleanQuery.split(/\s+/).filter(Boolean);
      if (parts.length > 1) {
        for (const part of parts) {
          const pHash = computeSearchHash(part);
          const pLegacy = computeLegacySearchHash(part);
          searchConditions.push(
            eq(students.firstNameSearchHash, pHash),
            eq(students.lastNameSearchHash, pHash),
            eq(students.firstNameSearchHash, pLegacy),
            eq(students.lastNameSearchHash, pLegacy)
          );
        }
      }

      studentRows = await db.query.students.findMany({
        where: and(
          eq(students.schoolId, school.id),
          eq(students.isActive, true),
          or(...searchConditions)
        ),
        columns: {
          id: true,
          admissionNumber: true,
          firstNameEncrypted: true,
          lastNameEncrypted: true,
          currentClassId: true,
        },
        limit: 20,
      });
    }

    if (studentRows.length === 0) {
      return { success: true, students: [] };
    }

    // 3. Decrypt ONLY returned rows (<= 20 rows, at most 40 decrypts instead of full table)
    const matchedStudents = studentRows.map((s) => {
      const firstName = decryptData(s.firstNameEncrypted) || "";
      const lastName = decryptData(s.lastNameEncrypted) || "";
      const fullName = `${firstName} ${lastName}`.trim();
      const admNo = s.admissionNumber || "";
      const className = s.currentClassId ? classMap.get(s.currentClassId) || "Class" : "Unassigned";

      return {
        id: s.id,
        admissionNumber: admNo,
        name: fullName || "Student",
        className,
      };
    });

    // 4. Fetch pending/overdue invoices for matched students to compute total dues
    const matchedIds = matchedStudents.map((s) => s.id);
    const studentInvoices = await db.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.schoolId, school.id),
        inArray(feeInvoices.studentId, matchedIds),
        inArray(feeInvoices.status, ["PENDING", "PARTIAL", "OVERDUE"])
      ),
    });

    const duesMap = new Map<string, { totalDue: number; count: number }>();
    for (const inv of studentInvoices) {
      const existing = duesMap.get(inv.studentId) || { totalDue: 0, count: 0 };
      existing.totalDue += parseFloat(inv.balanceAmount || "0");
      existing.count += 1;
      duesMap.set(inv.studentId, existing);
    }

    const result = matchedStudents.map((s) => {
      const dueInfo = duesMap.get(s.id) || { totalDue: 0, count: 0 };
      return projectToStudentFeeCard({
        id: s.id,
        admissionNumber: s.admissionNumber,
        fullName: s.name,
        name: s.name,
        className: s.className,
        totalDue: dueInfo.totalDue,
        pendingInvoiceCount: dueInfo.count,
      });
    });

    return { success: true, students: result };
  } catch (error: any) {
    console.error("searchStudentsAction error:", error);
    return { success: false, message: error.message || "Failed to search students", students: [] };
  }
}

/**
 * GT-06: Fetch authoritative StudentFeeCard projection.
 * Sanitizes and strips all non-finance PII data server-side.
 */
export async function getStudentFeeCardAction(studentId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    if (!studentId) {
      return { success: false, message: "Student ID is required", feeCard: null };
    }

    const feeCard = await fetchStudentFeeCard(db, school.id, studentId);
    if (!feeCard) {
      return { success: false, message: "Student not found", feeCard: null };
    }

    return { success: true, feeCard };
  } catch (error: any) {
    console.error("getStudentFeeCardAction error:", error);
    return { success: false, message: error.message || "Failed to load student fee card", feeCard: null };
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

    const invoices = await db.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.schoolId, school.id),
        eq(feeInvoices.studentId, studentId),
        inArray(feeInvoices.status, ["PENDING", "PARTIAL", "OVERDUE"])
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

    const now = new Date();

    const mapped = invoices.map((inv) => {
      let suggestedLateFee = 0;
      if (inv.dueDate && new Date(inv.dueDate) < now) {
        const daysOverdue = Math.floor(
          (now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        const graceDays = inv.feeStructure?.lateFeeStartAfterDays || 0;
        if (daysOverdue > graceDays) {
          const daysPastGrace = daysOverdue - graceDays;
          const fixedAmt = parseFloat(inv.feeStructure?.lateFeeAmount || "0");
          const dailyAmt = parseFloat(inv.feeStructure?.dailyLateFeeAmount || "0");
          const capAmt = inv.feeStructure?.lateFeeCap ? parseFloat(inv.feeStructure.lateFeeCap) : Infinity;

          let calculated = fixedAmt;
          if (dailyAmt > 0) {
            calculated += daysPastGrace * dailyAmt;
          }
          // ABSOLUTE cap semantics (ACC-08)
          suggestedLateFee = Math.min(calculated, capAmt);
        }
      }

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        feeHeadName: inv.feeStructure?.feeHead?.name || "Fee Invoice",
        term: inv.term,
        dueDate: inv.dueDate.toISOString(),
        grossAmount: parseFloat(inv.grossAmount),
        discountAmount: parseFloat(inv.discountAmount || "0"),
        lateFeeAmount: parseFloat(inv.lateFeeAmount || "0"),
        taxAmount: parseFloat(inv.taxAmount || "0"),
        netAmount: parseFloat(inv.netAmount),
        paidAmount: parseFloat(inv.paidAmount || "0"),
        balanceAmount: parseFloat(inv.balanceAmount),
        suggestedLateFee,
        status: inv.status,
      };
    });

    return { success: true, invoices: mapped };
  } catch (error: any) {
    console.error("getStudentInvoicesAction error:", error);
    return { success: false, message: error.message || "Failed to load invoices", invoices: [] };
  }
}

/**
 * GAP-01 & GAP-04: Multi-invoice counter collection in a single database transaction.
 * Supports per-invoice partial payments, discount & late-fine adjustments,
 * single shared receipt number family, GL credit ledger entry, bank balance increment,
 * and immutable fee audit logging.
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
        // Fallback for legacy single-invoice form submit
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

    for (const item of items) {
      if (!item || typeof item.amountPaid !== "number" || isNaN(item.amountPaid) || item.amountPaid <= 0) {
        return { success: false, message: "Payment amount must be greater than zero." };
      }
    }

    const totalAmountPaid = items.reduce((sum, item) => sum + (item.amountPaid || 0), 0);
    if (totalAmountPaid <= 0) {
      return { success: false, message: "Total payment amount must be greater than zero." };
    }

    // Enforce fiscal lock invariant (ACC-06)
    await assertAcademicYearNotLocked(school.id, new Date(), db);

    // FIX-02: Idempotency check (within last 24 hours)
    if (idempotencyKey) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existingPayments = await db.query.feePayments.findMany({
        where: and(
          eq(feePayments.schoolId, school.id),
          eq(feePayments.collectedById, ctx.userId),
          eq(feePayments.idempotencyKey, idempotencyKey),
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

      if (existingPayments.length > 0 && existingPayments[0]) {
        const firstPayment = existingPayments[0];
        const student = await db.query.students.findFirst({
          where: eq(students.id, firstPayment.studentId),
        });
        const firstName = decryptData(student?.firstNameEncrypted || null) || "";
        const lastName = decryptData(student?.lastNameEncrypted || null) || "";
        const studentName = `${firstName} ${lastName}`.trim() || "Student";
        const totalPaid = existingPayments.reduce(
          (acc, p) => acc + parseFloat(p.amountPaid),
          0,
        );

        return {
          success: true,
          message: "Idempotent response: payment was already processed.",
          receiptNumber: firstPayment.receiptGroupId || firstPayment.receiptNumber,
          receiptData: {
            schoolName: school.name || "SchoolMitra Campus",
            receiptNumber: firstPayment.receiptGroupId || firstPayment.receiptNumber,
            date: firstPayment.paymentDate.toISOString(),
            cashierName: ctx.email,
            student: {
              name: studentName,
              admissionNumber: student?.admissionNumber || "N/A",
              className: "Enrolled",
            },
            items: existingPayments.map((p) => ({
              feeHeadName:
                p.invoice?.feeStructure?.feeHead?.name || "Fee Invoice",
              invoiceNumber: p.invoice?.invoiceNumber || "N/A",
              term: p.invoice?.term || "ANNUAL",
              grossAmount: parseFloat(
                p.invoice?.grossAmount || p.amountPaid,
              ),
              amountPaid: parseFloat(p.amountPaid),
              balanceRemaining: parseFloat(p.invoice?.balanceAmount || "0"),
            })),
            totalAmountPaid: totalPaid,
            paymentMethod: firstPayment.paymentMethod,
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

    await db.transaction(async (tx) => {
      let itemIndex = 0;
      for (const item of items) {
        itemIndex++;
        if (!item || item.amountPaid <= 0) continue;

        const invoice = await tx.query.feeInvoices.findFirst({
          where: and(eq(feeInvoices.id, item.invoiceId), eq(feeInvoices.schoolId, school.id)),
          with: {
            feeStructure: {
              with: {
                feeHead: true,
              },
            },
          },
        });

        if (!invoice) {
          throw new Error(`Invoice #${item.invoiceId} not found.`);
        }

        // Apply discount or late fee adjustments if specified
        let currentGross = parseFloat(invoice.grossAmount);
        let currentDiscount = parseFloat(invoice.discountAmount || "0");
        let currentLateFee = parseFloat(invoice.lateFeeAmount || "0");
        let currentTax = parseFloat(invoice.taxAmount || "0");

        if (item.discountAdjustment && item.discountAdjustment > 0) {
          currentDiscount += item.discountAdjustment;
        }
        if (item.lateFeeAdjustment && item.lateFeeAdjustment > 0) {
          currentLateFee += item.lateFeeAdjustment;
        }

        const newNetAmount = Math.max(
          0,
          currentGross - currentDiscount + currentLateFee + currentTax
        );
        const currentPaid = parseFloat(invoice.paidAmount || "0");
        const outstandingBalance = Math.max(0, newNetAmount - currentPaid);
        if (item.amountPaid > outstandingBalance) {
          throw new Error(
            `Payment amount ₹${item.amountPaid} exceeds outstanding invoice balance of ₹${outstandingBalance.toFixed(2)}.`
          );
        }
        const newPaidAmount = currentPaid + item.amountPaid;
        const newBalanceAmount = Math.max(0, newNetAmount - newPaidAmount);

        let newStatus: any = invoice.status;
        if (newBalanceAmount <= 0) {
          newStatus = "PAID";
        } else if (newPaidAmount > 0) {
          newStatus = "PARTIAL";
        }

        // Receipt number uniquely identifies this payment row
        const itemReceiptNumber =
          items.length === 1 ? baseReceiptNumber : `${baseReceiptNumber}-${itemIndex}`;

        // 1. Insert fee payment
        const [payment] = await tx
          .insert(feePayments)
          .values({
            receiptNumber: itemReceiptNumber,
            receiptGroupId: baseReceiptNumber,
            idempotencyKey: idempotencyKey || null,
            schoolId: invoice.schoolId,
            studentId: invoice.studentId,
            feeInvoiceId: invoice.id,
            amountPaid: item.amountPaid.toFixed(2),
            paymentMethod,
            transactionReference,
            paymentDate: new Date(),
            remarks,
            collectedById: ctx.userId,
          })
          .returning();

        if (!payment) throw new Error("Failed to record fee payment.");
        if (!primaryPaymentId) primaryPaymentId = payment.id;

        // 2. Update fee invoice balances & adjustments
        await tx
          .update(feeInvoices)
          .set({
            discountAmount: currentDiscount.toFixed(2),
            lateFeeAmount: currentLateFee.toFixed(2),
            netAmount: newNetAmount.toFixed(2),
            paidAmount: newPaidAmount.toFixed(2),
            balanceAmount: newBalanceAmount.toFixed(2),
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(feeInvoices.id, invoice.id));

        // 3. Write immutable audit log (GAP-04)
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
            amountPaid: item.amountPaid,
            newPaidAmount,
            newBalanceAmount,
            paymentMethod,
          },
          reason: remarks || `Counter collection of ₹${item.amountPaid} via ${paymentMethod}`,
          performedById: ctx.userId,
        });

        receiptItems.push({
          feeHeadName: invoice.feeStructure?.feeHead?.name || "Fee Invoice",
          invoiceNumber: invoice.invoiceNumber,
          term: invoice.term,
          grossAmount: currentGross,
          discountAmount: currentDiscount,
          lateFeeAmount: currentLateFee,
          amountPaid: item.amountPaid,
          balanceRemaining: newBalanceAmount,
        });
      }

      // 4. Resolve Chart of Accounts & Post Consolidated Credit Entry to General Ledger
      const debitAccountId = bankAccountId && bankAccountId !== "CASH"
        ? await getBankAccountChartAccountId(school.id, bankAccountId, tx)
        : await getCashMainChartAccountId(school.id, tx);
      const creditAccountId = await getStudentReceivableChartAccountId(school.id, tx);

      await tx.insert(accountLedgerTransactions).values({
        schoolId: school.id,
        transactionNumber: txNumber,
        sourceType: "FEE_COLLECTION",
        sourceId: primaryPaymentId,
        bankAccountId: bankAccountId === "CASH" ? null : bankAccountId,
        debitAccountId,
        creditAccountId,
        transactionType: "CREDIT",
        amount: totalAmountPaid.toFixed(2),
        description: `Fee Collection Receipt #${baseReceiptNumber} (${paymentMethod})`,
        transactionDate: new Date(),
        createdById: ctx.userId,
      });

      // 5. If deposited into bank account, increment current balance
      if (bankAccountId && bankAccountId !== "CASH") {
        await tx
          .update(bankAccounts)
          .set({
            currentBalance: sql`${bankAccounts.currentBalance} + ${totalAmountPaid}`,
            updatedAt: new Date(),
          })
          .where(eq(bankAccounts.id, bankAccountId));
      }
    });

    // AZ-03: Asynchronously archive receipt PDF to S3 in the background
    if (primaryPaymentId && school?.id) {
      archiveReceiptPdfToS3(school.id, primaryPaymentId).catch((err) => {
        console.error("[ReceiptArchival] Background S3 archival error:", err);
      });
    }

    // Invalidate tenant S2 finance caches matching payment, dues, and accounts tags
    if (school?.id) {
      await invalidateFinanceOnPayment(school.id, items.map((i) => i.invoiceId));
    }

    revalidatePath("/school/collect-fees");
    revalidatePath("/school/transactions");
    revalidatePath("/school/due-fees");
    revalidatePath("/school/accounting/dashboard");
    revalidatePath("/school/fees-dashboard");

    return {
      success: true,
      receiptNumber: baseReceiptNumber,
      paymentId: primaryPaymentId,
      totalAmountPaid,
      paymentMethod,
      transactionReference,
      date: new Date().toLocaleString("en-IN"),
      items: receiptItems,
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
          const existingPayments = await db.query.feePayments.findMany({
            where: and(
              eq(feePayments.schoolId, school.id),
              eq(feePayments.idempotencyKey, idempotencyKey),
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
          if (existingPayments.length > 0 && existingPayments[0]) {
            const firstPayment = existingPayments[0];
            const student = await db.query.students.findFirst({
              where: eq(students.id, firstPayment.studentId),
            });
            const firstName = decryptData(student?.firstNameEncrypted || null) || "";
            const lastName = decryptData(student?.lastNameEncrypted || null) || "";
            const studentName = `${firstName} ${lastName}`.trim() || "Student";
            const totalPaid = existingPayments.reduce(
              (acc, p) => acc + parseFloat(p.amountPaid),
              0,
            );

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
                grossAmount: parseFloat(p.invoice?.grossAmount || p.amountPaid),
                amountPaid: parseFloat(p.amountPaid),
                balanceRemaining: parseFloat(p.invoice?.balanceAmount || "0"),
              })),
              receiptData: {
                schoolName: school?.name || "SchoolMitra Campus",
                receiptNumber: firstPayment.receiptGroupId || firstPayment.receiptNumber,
                date: firstPayment.paymentDate.toISOString(),
                cashierName: ctx?.email || "Cashier",
                student: {
                  name: studentName,
                  admissionNumber: student?.admissionNumber || "N/A",
                  className: "Enrolled",
                },
                items: existingPayments.map((p) => ({
                  feeHeadName: p.invoice?.feeStructure?.feeHead?.name || "Fee Invoice",
                  invoiceNumber: p.invoice?.invoiceNumber || "N/A",
                  term: p.invoice?.term || "ANNUAL",
                  grossAmount: parseFloat(p.invoice?.grossAmount || p.amountPaid),
                  amountPaid: parseFloat(p.amountPaid),
                  balanceRemaining: parseFloat(p.invoice?.balanceAmount || "0"),
                })),
                totalAmountPaid: totalPaid,
                paymentMethod: firstPayment.paymentMethod,
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
