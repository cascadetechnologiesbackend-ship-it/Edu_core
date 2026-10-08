import { db } from "@/db";
import { feePayments, students, schools, feeInvoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { ReceiptPDF } from "@/lib/pdf/templates/ReceiptPDF";
import { auth } from "@/lib/auth";
import { getPresignedDownloadUrl } from "@/lib/storage";

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

  const user = session.user as { id: string; role: string; schoolId?: string | null };
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  // Strict tenant boundary
  if (!isSuperAdmin && user.schoolId && payment.schoolId !== user.schoolId) {
    return NextResponse.json({ error: "Forbidden: cross-tenant access denied" }, { status: 403 });
  }

  const student = await db.query.students.findFirst({
    where: eq(students.id, payment.studentId),
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Role-based boundary: Parents & Students can only view their own receipts
  if (user.role === "PARENT") {
    if (student.primaryParentUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden: receipt does not belong to your ward" }, { status: 403 });
    }
  } else if (user.role === "STUDENT") {
    if (student.userId && student.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden: access denied" }, { status: 403 });
    }
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

  // AZ-03: If archived in S3 and storage is active, redirect to presigned S3 URL
  if (payment.receiptS3Key && process.env.AWS_ACCESS_KEY_ID) {
    try {
      const downloadUrl = await getPresignedDownloadUrl(payment.receiptS3Key);
      if (downloadUrl && !downloadUrl.startsWith("/api/receipt/download")) {
        return NextResponse.redirect(downloadUrl);
      }
    } catch (s3Err) {
      console.warn("[ReceiptAPI] S3 presigned URL lookup failed, falling back to dynamic render:", s3Err);
    }
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
