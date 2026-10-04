import Razorpay from "razorpay";
import { db } from "@/db";
import { feeInvoices, paymentGatewayLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { students } from "@/db/schema";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { invoiceId, amount } = await req.json();

    if (!invoiceId || !amount) {
      return NextResponse.json(
        { error: "Missing invoiceId or amount" },
        { status: 400 },
      );
    }

    const invoice = await db.query.feeInvoices.findFirst({
      where: eq(feeInvoices.id, invoiceId),
    });

    if (!invoice)
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const userSchoolId = (session.user as any).schoolId;
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";
    if (!isSuperAdmin && userSchoolId && invoice.schoolId !== userSchoolId) {
      return NextResponse.json({ error: "Forbidden: cross-tenant access denied" }, { status: 403 });
    }

    if (session.user.role === "PARENT") {
      const student = await db.query.students.findFirst({
        where: eq(students.id, invoice.studentId),
      });
      if (!student || student.primaryParentUserId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden: invoice does not belong to your ward" }, { status: 403 });
      }
    }

    // Verify amount is valid and within invoice outstanding balance
    const reqAmount = parseFloat(amount);
    const balance = parseFloat(invoice.balanceAmount);
    if (isNaN(reqAmount) || reqAmount <= 0 || reqAmount > balance + 0.01) {
      return NextResponse.json({ error: "Invalid payment amount requested" }, { status: 400 });
    }

    // Validate if keys exist
    if (
      !process.env.RAZORPAY_KEY_ID ||
      process.env.RAZORPAY_KEY_ID === "change-me"
    ) {
      return NextResponse.json({ error: "Payment Gateway not configured" }, { status: 500 });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    // Amount in paise
    const amountInPaise = Math.round(parseFloat(amount) * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `RCPT_${invoice.invoiceNumber}`,
    });

    await db.insert(paymentGatewayLogs).values({
      schoolId: invoice.schoolId,
      feeInvoiceId: invoice.id,
      gateway: "RAZORPAY",
      gatewayOrderId: order.id,
      amount: amount.toFixed(2),
      currency: "INR",
      status: "CREATED",
    });

    return NextResponse.json(order);
  } catch (error: any) {
    console.error("Razorpay Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
