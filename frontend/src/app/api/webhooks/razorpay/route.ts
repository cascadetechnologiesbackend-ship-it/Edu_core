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
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || secret === "change-me") {
      console.error("[Razorpay Webhook] CRITICAL: RAZORPAY_WEBHOOK_SECRET is not configured.");
      return NextResponse.json({ error: "Webhook signature verification service unavailable" }, { status: 503 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

      const expectedBuf = Buffer.from(expectedSignature, "utf8");
      const sigBuf = Buffer.from(signature, "utf8");

      if (
        expectedBuf.length !== sigBuf.length ||
        !crypto.timingSafeEqual(expectedBuf, sigBuf)
      ) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 400 },
        );
      }

    const event = JSON.parse(rawBody);

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;

      const log = await db.query.paymentGatewayLogs.findFirst({
        where: eq(paymentGatewayLogs.gatewayOrderId, orderId),
      });

      if (!log || !log.feeInvoiceId) {
        return NextResponse.json({ success: true, message: "Unrelated order" });
      }

      // Idempotency guard: prevent duplicate payment crediting on webhook retries
      if (log.status === "PAID" || log.gatewayPaymentId === payment.id) {
        return NextResponse.json({ success: true, message: "Order already fulfilled" });
      }

      const existingPayment = await db.query.feePayments.findFirst({
        where: eq(feePayments.transactionReference, payment.id),
      });
      if (existingPayment) {
        return NextResponse.json({ success: true, message: "Payment already recorded" });
      }

      const invoice = await db.query.feeInvoices.findFirst({
        where: eq(feeInvoices.id, log.feeInvoiceId),
      });

      if (!invoice) return NextResponse.json({ success: true });

      const amountPaid = payment.amount / 100;

      const newPaidAmount = parseFloat(invoice.paidAmount) + amountPaid;
      const newBalanceAmount = parseFloat(invoice.netAmount) - newPaidAmount;

      let newStatus = invoice.status;
      if (newBalanceAmount <= 0) {
        newStatus = "PAID";
      } else if (newPaidAmount > 0) {
        newStatus = "PARTIAL";
      }

      // Extract gateway processing fee and tax (AZ-04)
      // Razorpay provides fee in paise (which includes tax)
      let feeAmount = 0;
      if (typeof payment.fee === "number" && !isNaN(payment.fee)) {
        feeAmount = payment.fee / 100;
      } else if (typeof payment.fee_amount === "number" && !isNaN(payment.fee_amount)) {
        feeAmount = payment.fee_amount;
      }

      if (feeAmount === 0 && typeof payment.tax === "number" && !isNaN(payment.tax)) {
        feeAmount = payment.tax / 100;
      }

      const receiptNumber = `RZR-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      let createdPaymentId: string | null = null;
      let alreadyProcessed = false;

      await db.transaction(async (tx) => {
        // 1. Atomic Compare-And-Swap (CAS) update: only transition if status <> 'PAID'
        const [casLog] = await tx
          .update(paymentGatewayLogs)
          .set({
            status: "PAID",
            gatewayPaymentId: payment.id,
            gatewaySignature: signature,
            feeAmount: feeAmount.toFixed(2),
            webhookPayload: JSON.stringify({
              id: payment.id,
              order_id: payment.order_id,
              amount: payment.amount,
              fee: payment.fee,
              tax: payment.tax,
              method: payment.method,
              currency: payment.currency,
            }),
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
          // Already marked PAID concurrently
          alreadyProcessed = true;
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
        if (newBalanceAmount <= 0) {
          newStatus = "PAID";
        } else if (newPaidAmount > 0) {
          newStatus = "PARTIAL";
        }

        // 3. Create Payment with catch for 23505 unique constraint violation
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
              transactionReference: payment.id,
              paymentDate: new Date(),
              remarks: "Online Payment via Razorpay",
              collectedById: null, // Online payment
            })
            .returning();

          if (insertedPayment) {
            createdPaymentId = insertedPayment.id;
          }
        } catch (insertErr: any) {
          // Postgres 23505: unique_violation on (school_id, transaction_reference)
          if (insertErr.code === "23505" || insertErr.message?.includes("unique")) {
            alreadyProcessed = true;
            return;
          }
          throw insertErr;
        }

        // 4. Update Invoice
        await tx
          .update(feeInvoices)
          .set({
            paidAmount: newPaidAmount.toFixed(2),
            balanceAmount: newBalanceAmount.toFixed(2),
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
          description: `Online Gateway Settlement (Razorpay Webhook) - Payment ID: ${payment.id}`,
          transactionDate: new Date(),
          createdById: null,
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
        return NextResponse.json({ success: true, message: "Order already fulfilled" });
      }

      // Asynchronously trigger S3 PDF archival (AZ-03)
      if (createdPaymentId) {
        archiveReceiptPdfToS3(invoice.schoolId, createdPaymentId).catch((err) => {
          console.error("[Razorpay Webhook] Async S3 receipt archival failed:", err);
        });
      }

      return NextResponse.json({
        success: true,
        paymentId: createdPaymentId,
        receiptNumber,
        receiptAvailable: true,
        downloadUrl: createdPaymentId ? `/api/receipt/${createdPaymentId}` : undefined,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Razorpay Webhook Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed. Please contact support." },
      { status: 500 }
    );
  }
}
