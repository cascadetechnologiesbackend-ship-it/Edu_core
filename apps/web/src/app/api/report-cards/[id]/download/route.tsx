// ─── Report Card PDF Download ─────────────────────────────────────────────────
// GET /api/report-cards/[id]/download
// Generates a fresh watermarked PDF on demand (used by parent portal).
// The watermark contains student name + current date — every download is fresh.

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { db } from "@/db";
import {
  reportCards,
  students,
  schools,
  classes,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { decryptData } from "@/lib/encryption";
import { ReportCardPDF, gradeToClassGroup, type ReportCardData } from "@/lib/pdf/ReportCardPDF";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reportCard = await db.query.reportCards.findFirst({
      where: eq(reportCards.id, params.id),
      with: { exam: { with: { examType: true, academicYear: true } } },
    });

    if (!reportCard) {
      return NextResponse.json({ error: "Report card not found" }, { status: 404 });
    }

    // DPDP: Parents can only download their own child's report card
    const student = await db.query.students.findFirst({
      where: eq(students.id, reportCard.studentId),
    });

    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"].includes(
      session.user.role as string,
    );
    const isParent = session.user.id === student.primaryParentUserId;

    if (!isAdmin && !isParent) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const school = await db.query.schools.findFirst({
      where: eq(schools.id, reportCard.schoolId),
    });

    const studentClass = await db.query.classes.findFirst({
      where: eq(classes.id, student.currentClassId ?? ""),
    });

    const classGroup = studentClass
      ? gradeToClassGroup(studentClass.gradeLevel)
      : "CLASS_1_5";

    const studentName = `${decryptData(student.firstNameEncrypted)} ${decryptData(student.lastNameEncrypted)}`;
    const today = new Date().toLocaleDateString("en-IN");

    const gradeData = reportCard.gradeData as Record<string, unknown>;

    // Build PDF based on class group
    let payload: ReportCardData;

    if (classGroup === "NURSERY_UKG") {
      payload = {
        classGroup: "NURSERY_UKG",
        data: {
          schoolName: school?.name ?? "School",
          studentName,
          admissionNumber: student.admissionNumber,
          classDisplay: studentClass?.displayName ?? "—",
          section: "A",
          academicYear: reportCard.exam?.academicYear?.label ?? "—",
          activitySkills: (gradeData["activitySkills"] as any[]) ?? [],
          isWatermarked: isParent,
          watermarkDate: today,
          ...(reportCard.attendancePercent ? { attendancePercent: parseFloat(reportCard.attendancePercent) } : {}),
          ...(reportCard.teacherRemarks ? { teacherRemarks: reportCard.teacherRemarks } : {}),
          ...(school?.principalName ? { principalName: school.principalName } : {}),
        },
      };
    } else if (classGroup === "CLASS_1_5") {
      const subjects = (gradeData["subjects"] as unknown[]) ?? [];
      payload = {
        classGroup: "CLASS_1_5",
        data: {
          schoolName: school?.name ?? "School",
          studentName,
          admissionNumber: student.admissionNumber,
          classDisplay: studentClass?.displayName ?? "—",
          section: "A",
          academicYear: reportCard.exam?.academicYear?.label ?? "—",
          examName: reportCard.exam?.name ?? "—",
          subjects: subjects as any[],
          totalMarks: (gradeData["totalMarks"] as number) ?? 0,
          totalMaxMarks: (gradeData["totalMaxMarks"] as number) ?? 0,
          overallGrade: reportCard.overallGrade ?? "—",
          isPassed: (gradeData["isPassed"] as boolean) ?? false,
          isWatermarked: isParent,
          watermarkDate: today,
          ...(reportCard.rank ? { rank: reportCard.rank } : {}),
          ...(reportCard.attendancePercent ? { attendancePercent: parseFloat(reportCard.attendancePercent) } : {}),
          ...(reportCard.teacherRemarks ? { teacherRemarks: reportCard.teacherRemarks } : {}),
          ...(reportCard.principalRemarks ? { principalRemarks: reportCard.principalRemarks } : {}),
          ...(school?.principalName ? { principalName: school.principalName } : {}),
        },
      };
    } else if (classGroup === "CLASS_6_8") {
      const subjects = (gradeData["subjects"] as unknown[]) ?? [];
      payload = {
        classGroup: "CLASS_6_8",
        data: {
          schoolName: school?.name ?? "School",
          studentName,
          admissionNumber: student.admissionNumber,
          classDisplay: studentClass?.displayName ?? "—",
          section: "A",
          academicYear: reportCard.exam?.academicYear?.label ?? "—",
          examName: reportCard.exam?.name ?? "—",
          scholasticSubjects: subjects as any[],
          coScholastic: (gradeData["coScholastic"] as any[]) ?? [],
          totalMarks: (gradeData["totalMarks"] as number) ?? 0,
          totalMaxMarks: (gradeData["totalMaxMarks"] as number) ?? 0,
          overallGrade: reportCard.overallGrade ?? "—",
          overallGradePoint: (gradeData["overallGradePoint"] as number) ?? 0,
          isPassed: (gradeData["isPassed"] as boolean) ?? false,
          isWatermarked: isParent,
          watermarkDate: today,
          ...(reportCard.rank ? { rank: reportCard.rank } : {}),
          ...(reportCard.attendancePercent ? { attendancePercent: parseFloat(reportCard.attendancePercent) } : {}),
          ...(reportCard.teacherRemarks ? { teacherRemarks: reportCard.teacherRemarks } : {}),
          ...(reportCard.principalRemarks ? { principalRemarks: reportCard.principalRemarks } : {}),
          ...(school?.principalName ? { principalName: school.principalName } : {}),
        },
      };
    } else {
      // CLASS_9_10
      const subjects = (gradeData["subjects"] as unknown[]) ?? [];
      payload = {
        classGroup: "CLASS_9_10",
        data: {
          schoolName: school?.name ?? "School",
          boardName: "CENTRAL BOARD OF SECONDARY EDUCATION",
          studentName,
          admissionNumber: student.admissionNumber,
          classDisplay: studentClass?.displayName ?? "—",
          section: "A",
          academicYear: reportCard.exam?.academicYear?.label ?? "—",
          examName: reportCard.exam?.name ?? "—",
          scholasticSubjects: subjects as any[],
          coScholastic: (gradeData["coScholastic"] as any[]) ?? [],
          overallGrade: reportCard.overallGrade ?? "—",
          isPassed: (gradeData["isPassed"] as boolean) ?? false,
          isWatermarked: isParent,
          watermarkDate: today,
          ...(reportCard.rank ? { rank: reportCard.rank } : {}),
          ...(reportCard.attendancePercent ? { attendancePercent: parseFloat(reportCard.attendancePercent) } : {}),
          ...(reportCard.teacherRemarks ? { teacherRemarks: reportCard.teacherRemarks } : {}),
          ...(reportCard.principalRemarks ? { principalRemarks: reportCard.principalRemarks } : {}),
          ...(school?.principalName ? { principalName: school.principalName } : {}),
        },
      };
    }

    const pdfBuffer = await renderToBuffer(<ReportCardPDF payload={payload} />);

    const safeStudentName = studentName.replace(/[^a-zA-Z0-9_]/g, "_");
    const filename = `ReportCard_${safeStudentName}_${reportCard.exam?.name?.replace(/\s/g, "_") ?? "exam"}.pdf`;

    return new NextResponse(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[report-card-download]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
