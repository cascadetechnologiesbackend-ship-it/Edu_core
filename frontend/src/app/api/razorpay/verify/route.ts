import { auth } from "@/lib/auth";
import { db } from "@/db";
import { feeInvoices, feePayments, paymentGatewayLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { archiveReceiptPdfToS3 } from "@/workers/financeAutomation";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    if (!isSuperAdmin && userSchoolId && invoice.schoolId !== userSchoolId) {
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
    const newPaidAmount = parseFloat(invoice.paidAmount) + amountPaid;
    const newBalanceAmount = parseFloat(invoice.netAmount) - newPaidAmount;

    let newStatus = invoice.status;
    if (newBalanceAmount <= 0.01) {
      newStatus = "PAID";
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIAL";
    }

    const receiptNumber = `RZR-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    let createdPaymentId: string | null = null;

    await db.transaction(async (tx) => {
      // 1. Update gateway log to PAID
      await tx
        .update(paymentGatewayLogs)
        .set({
          status: "PAID",
          gatewayPaymentId: razorpay_payment_id,
          gatewaySignature: razorpay_signature,
          updatedAt: new Date(),
        })
        .where(eq(paymentGatewayLogs.id, log.id));

      // 2. Record feePayment
      const [insertedPayment] = await tx
        .insert(feePayments)
        .values({
          receiptNumber,
          schoolId: invoice.schoolId,
          studentId: invoice.studentId,
          feeInvoiceId: invoice.id,
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

      // 3. Update invoice balance and status
      await tx
        .update(feeInvoices)
        .set({
          paidAmount: newPaidAmount.toFixed(2),
          balanceAmount: Math.max(0, newBalanceAmount).toFixed(2),
          status: newStatus,
        })
        .where(eq(feeInvoices.id, invoice.id));
    });

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
