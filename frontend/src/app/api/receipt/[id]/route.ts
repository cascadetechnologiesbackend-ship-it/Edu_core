import { db, withTenant } from "@/db";
import {
  feePayments,
  students,
  schools,
  feeInvoices,
  classes,
  sections,
  academicYears,
  users,
  studentClassHistory,
  studentFamilyMembers,
} from "@/db/schema";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { ReceiptPDF, type ReceiptPDFItem } from "@/lib/pdf/templates/ReceiptPDF";
import { auth } from "@/lib/auth";
import { getPresignedDownloadUrl } from "@/lib/storage";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toPaise(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val));
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

const ALLOWED_RECEIPT_ROLES = new Set([
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "ACCOUNTANT",
  "PARENT",
  "STUDENT",
]);

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; role: string; schoolId?: string | null };
  if (!ALLOWED_RECEIPT_ROLES.has(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!params.id || !UUID_REGEX.test(params.id)) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  if (!isSuperAdmin && !user.schoolId) {
    return NextResponse.json({ error: "Forbidden: missing school context" }, { status: 403 });
  }

  // Locate payment first (inside tenant scope when schoolId is known)
  const payment = user.schoolId && !isSuperAdmin
    ? await withTenant(user.schoolId, async (tx) => {
        return tx.query.feePayments.findFirst({
          where: and(eq(feePayments.id, params.id), eq(feePayments.schoolId, user.schoolId!)),
        });
      })
    : await db.query.feePayments.findFirst({
        where: eq(feePayments.id, params.id),
      });

  if (!payment) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  // Strict tenant boundary
  if (!isSuperAdmin && user.schoolId && payment.schoolId !== user.schoolId) {
    return NextResponse.json({ error: "Forbidden: cross-tenant access denied" }, { status: 403 });
  }

  const payload = await withTenant(payment.schoolId, async (tx) => {
    const student = await tx.query.students.findFirst({
      where: and(eq(students.id, payment.studentId), eq(students.schoolId, payment.schoolId)),
    });

    if (!student) {
      return { errorStatus: 404 as const, errorMessage: "Student not found" };
    }

    // Role-based boundary: Parents & Students can only view their own receipts
    if (user.role === "PARENT") {
      let isLinked = student.primaryParentUserId === user.id;
      if (!isLinked) {
        const fam = await tx.query.studentFamilyMembers.findFirst({
          where: and(
            eq(studentFamilyMembers.schoolId, payment.schoolId),
            eq(studentFamilyMembers.studentId, student.id),
            eq(studentFamilyMembers.userId, user.id),
          ),
        });
        isLinked = Boolean(fam);
      }
      if (!isLinked) {
        return {
          errorStatus: 403 as const,
          errorMessage: "Forbidden: receipt does not belong to your ward",
        };
      }
    } else if (user.role === "STUDENT") {
      if (!student.userId || student.userId !== user.id) {
        return { errorStatus: 403 as const, errorMessage: "Forbidden: access denied" };
      }
    }

    const school = await tx.query.schools.findFirst({
      where: eq(schools.id, payment.schoolId),
    });
    if (!school) {
      return { errorStatus: 404 as const, errorMessage: "School not found" };
    }

    // Fetch ALL payments sharing receiptGroupId (if set), otherwise just [payment]
    const groupPayments = payment.receiptGroupId
      ? await tx.query.feePayments.findMany({
          where: and(
            eq(feePayments.schoolId, payment.schoolId),
            eq(feePayments.receiptGroupId, payment.receiptGroupId),
          ),
          orderBy: [asc(feePayments.receiptNumber)],
        })
      : [payment];

    const effectivePayments = groupPayments.length > 0 ? groupPayments : [payment];

    const invoiceIds = Array.from(
      new Set(effectivePayments.map((p) => p.feeInvoiceId).filter(Boolean)),
    );

    const invoices =
      invoiceIds.length > 0
        ? await tx.query.feeInvoices.findMany({
            where: and(
              eq(feeInvoices.schoolId, payment.schoolId),
              inArray(feeInvoices.id, invoiceIds),
            ),
            with: {
              feeStructure: {
                with: {
                  feeHead: true,
                },
              },
            },
          })
        : [];

    const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));

    // Resolve student class & section via currentClassId/currentSectionId (with studentClassHistory fallback)
    const classHistory =
      !student.currentClassId || !student.currentSectionId
        ? await tx.query.studentClassHistory.findFirst({
            where: and(
              eq(studentClassHistory.schoolId, payment.schoolId),
              eq(studentClassHistory.studentId, student.id),
            ),
            orderBy: [desc(studentClassHistory.createdAt)],
          })
        : null;

    const effectiveClassId = student.currentClassId || classHistory?.classId || null;
    const effectiveSectionId = student.currentSectionId || classHistory?.sectionId || null;

    const resolvedYearId = invoices[0]?.academicYearId || student.academicYearId || null;

    const [classRow, sectionRow, academicYearRow, cashierRow] = await Promise.all([
      effectiveClassId
        ? tx.query.classes.findFirst({
            where: and(eq(classes.id, effectiveClassId), eq(classes.schoolId, payment.schoolId)),
          })
        : Promise.resolve(null),
      effectiveSectionId
        ? tx.query.sections.findFirst({
            where: and(
              eq(sections.id, effectiveSectionId),
              eq(sections.schoolId, payment.schoolId),
            ),
          })
        : Promise.resolve(null),
      resolvedYearId
        ? tx.query.academicYears.findFirst({
            where: and(
              eq(academicYears.id, resolvedYearId),
              eq(academicYears.schoolId, payment.schoolId),
            ),
          })
        : tx.query.academicYears.findFirst({
            where: and(
              eq(academicYears.schoolId, payment.schoolId),
              eq(academicYears.isActive, true),
            ),
          }),
      payment.collectedById
        ? tx.query.users.findFirst({
            where: eq(users.id, payment.collectedById),
            columns: { id: true, email: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      errorStatus: null,
      student,
      school,
      effectivePayments,
      invoiceMap,
      className: classRow?.displayName || "Class",
      sectionName: sectionRow?.name || null,
      academicYearLabel: academicYearRow?.label,
      cashierName: cashierRow?.email || undefined,
    };
  });

  if (payload.errorStatus) {
    return NextResponse.json({ error: payload.errorMessage }, { status: payload.errorStatus });
  }

  // Safely resolve school S3 logo presigned URL (only absolute http(s) URLs work in @react-pdf/renderer)
  let logoUrl: string | null = null;
  if (payload.school.logoS3Key && process.env.AWS_ACCESS_KEY_ID) {
    try {
      const signed = await getPresignedDownloadUrl(payload.school.logoS3Key);
      if (signed && signed.startsWith("http")) {
        logoUrl = signed;
      }
    } catch (logoErr) {
      console.warn("[ReceiptAPI] Failed to resolve school logo URL:", logoErr);
      logoUrl = null;
    }
  }

  const pdfItems: ReceiptPDFItem[] = payload.effectivePayments.map((p) => {
    const inv = payload.invoiceMap.get(p.feeInvoiceId);
    return {
      feeHeadName: inv?.feeStructure?.feeHead?.name || "Tuition / School Fee",
      invoiceNumber: inv?.invoiceNumber || "N/A",
      term: inv?.term || "ANNUAL",
      grossAmount: toPaise(inv?.grossAmount ?? p.amountPaid) / 100,
      discountAmount: toPaise(inv?.discountAmount ?? 0) / 100,
      lateFeeAmount: toPaise(inv?.lateFeeAmount ?? 0) / 100,
      amountPaid: toPaise(p.amountPaid) / 100,
      balanceAmount: toPaise(inv?.balanceAmount ?? 0) / 100,
    };
  });

  const stream = await renderToStream(
    React.createElement(ReceiptPDF, {
      payment,
      payments: payload.effectivePayments,
      invoice: payload.invoiceMap.get(payment.feeInvoiceId) || null,
      items: pdfItems,
      student: payload.student,
      className: payload.className,
      sectionName: payload.sectionName,
      school: payload.school,
      logoUrl,
      academicYear: payload.academicYearLabel,
      cashierName: payload.cashierName,
    }) as any,
  );

  const reqUrl = new URL(request.url);
  const inline = reqUrl.searchParams.get("inline") === "1";
  const receiptFileNo = payment.receiptGroupId || payment.receiptNumber;

  return new NextResponse(stream as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="receipt-${receiptFileNo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
