import { db } from "@/db";
import { feeInvoices, feePayments, paymentGatewayLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import crypto from "crypto";

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

      const receiptNumber = `RZR-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

      await db.transaction(async (tx) => {
        // Update Log
        await tx
          .update(paymentGatewayLogs)
          .set({
            status: "PAID",
            gatewayPaymentId: payment.id,
            gatewaySignature: signature,
          })
          .where(eq(paymentGatewayLogs.id, log.id));

        // Create Payment
        await tx.insert(feePayments).values({
          receiptNumber,
          schoolId: invoice.schoolId,
          studentId: invoice.studentId,
          feeInvoiceId: invoice.id,
          amountPaid: amountPaid.toFixed(2),
          paymentMethod: "ONLINE",
          transactionReference: payment.id,
          paymentDate: new Date(),
          remarks: "Online Payment via Razorpay",
          collectedById: null, // Online payment
        });

        // Update Invoice
        await tx
          .update(feeInvoices)
          .set({
            paidAmount: newPaidAmount.toFixed(2),
            balanceAmount: newBalanceAmount.toFixed(2),
            status: newStatus,
          })
          .where(eq(feeInvoices.id, invoice.id));
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Razorpay Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
