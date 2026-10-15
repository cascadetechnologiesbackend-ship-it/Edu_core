import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  feeInvoices,
  feePayments,
  paymentGatewayLogs,
  accountLedgerTransactions,
  bankAccounts,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { archiveReceiptPdfToS3 } from "@/workers/financeAutomation";
import {
  getBankAccountChartAccountId,
  getCashMainChartAccountId,
  getStudentReceivableChartAccountId,
} from "@/lib/chartOfAccountsEngine";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting: max 15 requests per minute per user
    const { checkRateLimit } = await import("@/lib/rateLimiter");
    const allowed = await checkRateLimit(`rate:razorpay:${session.user.id}`, 15, 60000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many payment verification requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing required Razorpay verification parameters" },
        { status: 400 }
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret || secret === "change-me") {
      console.error("[Razorpay Verify] CRITICAL: RAZORPAY_KEY_SECRET is not configured.");
      return NextResponse.json(
        { error: "Payment verification service temporarily unavailable" },
        { status: 503 }
      );
    }

    // Verify HMAC-SHA256 signature
    const bodyToSign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(bodyToSign)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    const sigBuf = Buffer.from(razorpay_signature, "utf8");

    if (
      expectedBuf.length !== sigBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, sigBuf)
    ) {
      return NextResponse.json(
        { error: "Invalid payment signature verification failed" },
        { status: 400 }
      );
    }

    // Look up gateway order log
    const log = await db.query.paymentGatewayLogs.findFirst({
      where: eq(paymentGatewayLogs.gatewayOrderId, razorpay_order_id),
    });

    if (!log || !log.feeInvoiceId) {
      return NextResponse.json({ error: "Associated invoice order not found" }, { status: 404 });
    }

    const invoice = await db.query.feeInvoices.findFirst({
      where: eq(feeInvoices.id, log.feeInvoiceId),
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice record not found" }, { status: 404 });
    }

    // Tenant boundary check
    const userSchoolId = (session.user as any).schoolId;
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";
    if (!isSuperAdmin && (!userSchoolId || typeof userSchoolId !== "string")) {
      return NextResponse.json({ error: "Forbidden: tenant school scope required" }, { status: 403 });
    }
    if (!isSuperAdmin && invoice.schoolId !== userSchoolId) {
      return NextResponse.json({ error: "Forbidden: cross-tenant access denied" }, { status: 403 });
    }

    // Idempotency check: if order was already completed (e.g. by concurrent webhook)
    if (log.status === "PAID" || log.gatewayPaymentId === razorpay_payment_id) {
      const existingPayment = await db.query.feePayments.findFirst({
        where: eq(feePayments.transactionReference, razorpay_payment_id),
      });

      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        paymentId: existingPayment?.id || null,
        receiptNumber: existingPayment?.receiptNumber || "RECORDED",
        downloadUrl: existingPayment ? `/api/receipt/${existingPayment.id}` : undefined,
      });
    }

    const amountPaid = parseFloat(log.amount);
    const receiptNumber = `RZR-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    let createdPaymentId: string | null = null;
    let alreadyProcessed = false;
    let existingPaymentRecord: any = null;

    await db.transaction(async (tx) => {
      // 1. Atomic Compare-And-Swap (CAS) update: only transition if status <> 'PAID'
      const [casLog] = await tx
        .update(paymentGatewayLogs)
        .set({
          status: "PAID",
          gatewayPaymentId: razorpay_payment_id,
          gatewaySignature: razorpay_signature,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(paymentGatewayLogs.id, log.id),
            sql`${paymentGatewayLogs.status} <> 'PAID'`
          )
        )
        .returning();

      if (!casLog) {
        // CAS failed: concurrent webhook or duplicate verify already marked it PAID!
        alreadyProcessed = true;
        existingPaymentRecord = await tx.query.feePayments.findFirst({
          where: eq(feePayments.transactionReference, razorpay_payment_id),
        });
        return;
      }

      // 2. Lock invoice row FOR UPDATE
      const [lockedInvoice] = await tx
        .select()
        .from(feeInvoices)
        .where(eq(feeInvoices.id, log.feeInvoiceId!))
        .for("update");

      if (!lockedInvoice) {
        throw new Error("Invoice record not found under lock");
      }

      const lockedPaidAmount = parseFloat(lockedInvoice.paidAmount || "0");
      const lockedNetAmount = parseFloat(lockedInvoice.netAmount || "0");
      const newPaidAmount = lockedPaidAmount + amountPaid;
      const newBalanceAmount = lockedNetAmount - newPaidAmount;

      let newStatus = lockedInvoice.status;
      if (newBalanceAmount <= 0.01) {
        newStatus = "PAID";
      } else if (newPaidAmount > 0) {
        newStatus = "PARTIAL";
      }

      // 3. Record feePayment with catch for 23505 unique violation
      try {
        const [insertedPayment] = await tx
          .insert(feePayments)
          .values({
            receiptNumber,
            schoolId: lockedInvoice.schoolId,
            studentId: lockedInvoice.studentId,
            feeInvoiceId: lockedInvoice.id,
            amountPaid: amountPaid.toFixed(2),
            paymentMethod: "ONLINE",
            transactionReference: razorpay_payment_id,
            paymentDate: new Date(),
            remarks: `Verified Razorpay payment (Role: ${session.user.role})`,
            collectedById: ["ACCOUNTANT", "SCHOOL_ADMIN", "PRINCIPAL"].includes(session.user.role)
              ? session.user.id
              : null,
          })
          .returning();

        if (insertedPayment) {
          createdPaymentId = insertedPayment.id;
        }
      } catch (insertErr: any) {
        // Postgres 23505: unique_violation on (school_id, transaction_reference)
        if (insertErr.code === "23505" || insertErr.message?.includes("unique")) {
          alreadyProcessed = true;
          existingPaymentRecord = await tx.query.feePayments.findFirst({
            where: eq(feePayments.transactionReference, razorpay_payment_id),
          });
          return;
        }
        throw insertErr;
      }

      // 4. Update invoice balance and status
      await tx
        .update(feeInvoices)
        .set({
          paidAmount: newPaidAmount.toFixed(2),
          balanceAmount: Math.max(0, newBalanceAmount).toFixed(2),
          status: newStatus,
        })
        .where(eq(feeInvoices.id, lockedInvoice.id));

      // 5. Resolve Chart of Accounts & Post Consolidated Credit Entry to General Ledger (P2-T1 S0 Invariant)
      const primaryBank = await tx.query.bankAccounts.findFirst({
        where: and(eq(bankAccounts.schoolId, lockedInvoice.schoolId), eq(bankAccounts.isActive, true)),
      });

      const primaryBankId = primaryBank ? primaryBank.id : null;
      const bankChartAccountId = primaryBankId
        ? await getBankAccountChartAccountId(lockedInvoice.schoolId, primaryBankId, tx)
        : await getCashMainChartAccountId(lockedInvoice.schoolId, tx);
      const studentReceivableAccountId = await getStudentReceivableChartAccountId(lockedInvoice.schoolId, tx);

      const txNumber = `TX-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

      await tx.insert(accountLedgerTransactions).values({
        schoolId: lockedInvoice.schoolId,
        transactionNumber: txNumber,
        sourceType: "FEE_COLLECTION",
        sourceId: createdPaymentId || log.id,
        bankAccountId: primaryBankId,
        debitAccountId: bankChartAccountId,
        creditAccountId: studentReceivableAccountId,
        transactionType: "CREDIT",
        amount: amountPaid.toFixed(2),
        description: `Online Gateway Settlement (Razorpay) - Payment ID: ${razorpay_payment_id}`,
        transactionDate: new Date(),
        createdById: session.user.id || null,
      });

      if (primaryBankId) {
        await tx
          .update(bankAccounts)
          .set({
            currentBalance: sql`${bankAccounts.currentBalance} + ${amountPaid.toFixed(2)}`,
            updatedAt: new Date(),
          })
          .where(eq(bankAccounts.id, primaryBankId));
      }
    });

    if (alreadyProcessed) {
      const finalPayment = existingPaymentRecord || (await db.query.feePayments.findFirst({
        where: eq(feePayments.transactionReference, razorpay_payment_id),
      }));
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        paymentId: finalPayment?.id || null,
        receiptNumber: finalPayment?.receiptNumber || "RECORDED",
        downloadUrl: finalPayment ? `/api/receipt/${finalPayment.id}` : undefined,
      });
    }

    // Asynchronously archive PDF to S3
    if (createdPaymentId) {
      archiveReceiptPdfToS3(invoice.schoolId, createdPaymentId).catch((err) => {
        console.error("[Razorpay Verify] Async S3 receipt archival failed:", err);
      });
    }

    return NextResponse.json({
      success: true,
      paymentId: createdPaymentId,
      receiptNumber,
      downloadUrl: createdPaymentId ? `/api/receipt/${createdPaymentId}` : undefined,
    });
  } catch (error: any) {
    console.error("[Razorpay Verify] Verification error:", error);
    return NextResponse.json(
      { error: "Payment verification failed. Please contact support." },
      { status: 500 }
    );
  }
}
