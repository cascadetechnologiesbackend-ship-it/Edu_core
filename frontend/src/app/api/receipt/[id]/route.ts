import { db } from "@/db";
import { feePayments, students, schools, feeInvoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { ReceiptPDF } from "@/lib/pdf/templates/ReceiptPDF";
import { auth } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payment = await db.query.feePayments.findFirst({
    where: eq(feePayments.id, params.id),
  });

  if (!payment) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const student = await db.query.students.findFirst({
    where: eq(students.id, payment.studentId),
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const school = await db.query.schools.findFirst({
    where: eq(schools.id, payment.schoolId),
  });

  const invoice = payment.feeInvoiceId
    ? await db.query.feeInvoices.findFirst({
        where: eq(feeInvoices.id, payment.feeInvoiceId),
      })
    : null;

  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const stream = await renderToStream(
    React.createElement(ReceiptPDF, { payment, invoice, student, school }),
  );

  return new NextResponse(stream as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${payment.receiptNumber}.pdf"`,
    },
  });
}
