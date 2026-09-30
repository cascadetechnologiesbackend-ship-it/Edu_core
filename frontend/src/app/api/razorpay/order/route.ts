import Razorpay from "razorpay";
import { db } from "@/db";
import { feeInvoices, paymentGatewayLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
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
