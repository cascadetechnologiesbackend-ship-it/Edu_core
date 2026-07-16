import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { db } from "@/db";
import {
  certificates,
  students,
  reportCards,
  schools,
  classes,
} from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { decryptData } from "@/lib/encryption";
import { TopperCertificate } from "@/lib/pdf/templates/TopperCertificate";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cert = await db.query.certificates.findFirst({
      where: eq(certificates.id, params.id),
    });

    if (!cert) {
      return NextResponse.json(
        { error: "Certificate not found" },
        { status: 404 },
      );
    }

    // DPDP / Security check: Parent can only download for their child
    const student = await db.query.students.findFirst({
      where: eq(students.id, cert.studentId),
    });

    if (!student)
      return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const isAdmin = [
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
      "TEACHER",
    ].includes(session.user.role as string);
    const isParent = session.user.id === student.primaryParentUserId;

    if (!isAdmin && !isParent) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const school = await db.query.schools.findFirst({
      where: eq(schools.id, cert.schoolId),
    });

    const studentClass = await db.query.classes.findFirst({
      where: eq(classes.id, student.currentClassId ?? ""),
    });

    // Find the report card to fetch ranking/marks details
    const reportCard = await db.query.reportCards.findFirst({
      where: and(
        eq(reportCards.studentId, student.id),
        isNotNull(reportCards.rank),
      ),
      with: { exam: { with: { academicYear: true } } },
      orderBy: (t, { desc }) => [desc(t.generatedAt)],
    });

    if (!reportCard) {
      return NextResponse.json(
        {
          error:
            "No report card with rank found for this student to generate certificate",
        },
        { status: 400 },
      );
    }

    const gradeData = reportCard.gradeData as Record<string, any>;
    const studentName = `${decryptData(student.firstNameEncrypted)} ${decryptData(student.lastNameEncrypted)}`;

    // Total active students in this class for the class size
    const classSizeResult = await db.query.students.findMany({
      where: and(
        eq(students.currentClassId, studentClass?.id ?? ""),
        eq(students.isActive, true),
      ),
    });

    const payload = {
      schoolName: school?.name ?? "SchoolMitra ERP",
      studentName,
      classDisplay: studentClass?.displayName ?? "—",
      section: "A",
      academicYear: reportCard.exam?.academicYear?.label ?? "—",
      examName: reportCard.exam?.name ?? "—",
      rank: reportCard.rank ?? 1,
      totalStudents: classSizeResult.length || 30,
      totalMarks: gradeData["totalMarks"] ?? 0,
      totalMaxMarks: gradeData["totalMaxMarks"] ?? 100,
      overallPercent: gradeData["overallPercent"] ?? 0,
      overallGrade: reportCard.overallGrade ?? "A1",
      issuedDate: cert.issuedDate.toLocaleDateString("en-IN"),
      certificateNumber: cert.certificateNumber,
      ...(school?.address ? { schoolAddress: school.address } : {}),
      ...(school?.principalName ? { principalName: school.principalName } : {}),
      ...(gradeData["overallGradePoint"]
        ? { cgpa: gradeData["overallGradePoint"] }
        : {}),
    };

    const pdfBuffer = await renderToBuffer(
      <TopperCertificate data={payload} />,
    );

    const safeStudentName = studentName.replace(/[^a-zA-Z0-9_]/g, "_");
    const filename = `TopperCertificate_${safeStudentName}.pdf`;

    return new NextResponse(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[certificate-download]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
