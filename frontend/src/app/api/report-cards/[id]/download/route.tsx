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
  resultSnapshots,
  reportCardSetups,
  resultSettings,
  resultHolds,
  feeInvoices,
  students,
  schools,
  classes,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { decryptData } from "@/lib/encryption";
import {
  ReportCardPDF,
  gradeToClassGroup,
  type ReportCardData,
} from "@/lib/pdf/ReportCardPDF";

import { logExamIsolationViolation } from "@/lib/examIsolation";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = session.user.role as string;
    const isSuperAdmin = userRole === "SUPER_ADMIN";
    const userSchoolId = session.user.schoolId;

    if (!isSuperAdmin && (!userSchoolId || typeof userSchoolId !== "string")) {
      return NextResponse.json({ error: "Forbidden: tenant school scope required" }, { status: 403 });
    }

    // 1. Try finding in result_snapshots (S8)
    const snapshot = await db.query.resultSnapshots.findFirst({
      where: eq(resultSnapshots.id, params.id),
      with: { setup: true },
    });

    if (snapshot) {
      // Strict cross-tenant boundary
      if (!isSuperAdmin && snapshot.schoolId !== userSchoolId) {
        await logExamIsolationViolation({
          schoolId: userSchoolId,
          userId: session.user.id,
          userEmail: session.user.email,
          userRole,
          action: "READ",
          tableName: "result_snapshots",
          recordId: params.id,
          purposeId: "cross_tenant_violation",
          metadata: {
            reason: "Cross-tenant PDF download attempted",
            attemptedSchoolId: snapshot.schoolId,
          },
        });

        return NextResponse.json(
          { error: "Forbidden: cross-tenant access denied" },
          { status: 403 },
        );
      }

      const student = await db.query.students.findFirst({
        where: eq(students.id, snapshot.studentId),
      });

      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }

      const isAdmin = [
        "SUPER_ADMIN",
        "SCHOOL_ADMIN",
        "PRINCIPAL",
        "TEACHER",
      ].includes(userRole);
      const isParent = session.user.id === student.primaryParentUserId;
      const isStudent = session.user.id === student.userId;

      if (!isAdmin && !isParent && !isStudent) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Check S8 Release Gate for non-admin requests
      if (!isAdmin) {
        const [settings, hold] = await Promise.all([
          db.query.resultSettings.findFirst({
            where: and(
              eq(resultSettings.schoolId, snapshot.schoolId),
              eq(resultSettings.setupId, snapshot.setupId),
            ),
          }),
          db.query.resultHolds.findFirst({
            where: and(
              eq(resultHolds.schoolId, snapshot.schoolId),
              eq(resultHolds.setupId, snapshot.setupId),
              eq(resultHolds.studentId, snapshot.studentId),
            ),
          }),
        ]);

        if (settings?.withholdAll) {
          return NextResponse.json(
            { error: "Results withheld by administration" },
            { status: 403 },
          );
        }

        if (settings?.releaseAt && new Date(settings.releaseAt) > new Date()) {
          return NextResponse.json(
            { error: "Results scheduled for future release" },
            { status: 403 },
          );
        }

        if (hold) {
          return NextResponse.json(
            { error: `Result on hold: ${hold.reason}` },
            { status: 403 },
          );
        }

        if (settings?.feeLockMode === "HARD") {
          const invoices = await db.query.feeInvoices.findMany({
            where: and(
              eq(feeInvoices.schoolId, snapshot.schoolId),
              eq(feeInvoices.studentId, snapshot.studentId),
              isNull(feeInvoices.deletedAt),
            ),
            columns: { balanceAmount: true },
          });
          let dueAmount = 0;
          for (const inv of invoices) {
            const bal = parseFloat(inv.balanceAmount || "0");
            if (bal > 0) dueAmount += bal;
          }
          const threshold = parseFloat(settings.feeLockThresholdAmount || "0");
          if (dueAmount > threshold) {
            return NextResponse.json(
              { error: "Access locked due to outstanding tuition fees" },
              { status: 403 },
            );
          }
        }
      }

      const school = await db.query.schools.findFirst({
        where: eq(schools.id, snapshot.schoolId),
      });

      const studentClass = await db.query.classes.findFirst({
        where: eq(classes.id, student.currentClassId ?? ""),
      });

      const classGroup = studentClass
        ? gradeToClassGroup(studentClass.gradeLevel)
        : "CLASS_1_5";

      const studentName = `${decryptData(student.firstNameEncrypted)} ${decryptData(student.lastNameEncrypted)}`.trim();
      const today = new Date().toLocaleDateString("en-IN");

      const payloadData = snapshot.payload as any;
      const subjects = payloadData?.subjects ?? [];
      const summary = payloadData?.summary ?? {};

      let pdfPayload: ReportCardData = {
        classGroup: "CLASS_1_5",
        data: {
          schoolName: school?.name ?? "School",
          studentName,
          admissionNumber: student.admissionNumber,
          classDisplay: studentClass?.displayName ?? "—",
          section: "A",
          academicYear: snapshot.setup?.name ?? "Academic Year",
          examName: snapshot.setup?.name ?? "Examination",
          subjects: subjects.map((sub: any) => ({
            subjectName: sub.subjectName,
            maxMarks: sub.totalMax,
            marksObtained: sub.totalObtained,
            grade: sub.grade,
          })),
          totalMarks: summary.totalMarks ?? 0,
          totalMaxMarks: summary.totalMax ?? 0,
          overallGrade: summary.overallGrade ?? "—",
          isPassed: summary.resultStatus === "PASSED",
          isWatermarked: !isAdmin,
          watermarkDate: today,
          ...(summary.rank ? { rank: summary.rank } : {}),
          ...(school?.principalName
            ? { principalName: school.principalName }
            : {}),
        },
      };

      const pdfBuffer = await renderToBuffer(<ReportCardPDF payload={pdfPayload} />);
      const safeStudentName = studentName.replace(/[^a-zA-Z0-9_]/g, "_");
      const filename = `ReportCard_${safeStudentName}_v${snapshot.version}.pdf`;

      return new NextResponse(pdfBuffer as any, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // 2. Fallback to legacy reportCards
    const reportCard = await db.query.reportCards.findFirst({
      where: eq(reportCards.id, params.id),
      with: { exam: { with: { examType: true, academicYear: true } } },
    });

    if (!reportCard) {
      return NextResponse.json(
        { error: "Report card not found" },
        { status: 404 },
      );
    }

    // DPDP: Parents can only download their own child's report card
    const student = await db.query.students.findFirst({
      where: eq(students.id, reportCard.studentId),
    });

    if (!student)
      return NextResponse.json({ error: "Student not found" }, { status: 404 });

    // Strict cross-tenant boundary: staff must belong to the report card's school
    if (!isSuperAdmin && reportCard.schoolId !== userSchoolId) {
      await logExamIsolationViolation({
        schoolId: userSchoolId,
        userId: session.user.id,
        userEmail: session.user.email,
        userRole,
        action: "READ",
        tableName: "report_cards",
        recordId: params.id,
        purposeId: "cross_tenant_violation",
        metadata: {
          reason: "Cross-tenant legacy PDF download attempted",
          attemptedSchoolId: reportCard.schoolId,
        },
      });

      return NextResponse.json({ error: "Forbidden: cross-tenant access denied" }, { status: 403 });
    }

    const isAdmin = [
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
      "TEACHER",
    ].includes(userRole);
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
          ...(reportCard.attendancePercent
            ? { attendancePercent: parseFloat(reportCard.attendancePercent) }
            : {}),
          ...(reportCard.teacherRemarks
            ? { teacherRemarks: reportCard.teacherRemarks }
            : {}),
          ...(school?.principalName
            ? { principalName: school.principalName }
            : {}),
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
          ...(reportCard.attendancePercent
            ? { attendancePercent: parseFloat(reportCard.attendancePercent) }
            : {}),
          ...(reportCard.teacherRemarks
            ? { teacherRemarks: reportCard.teacherRemarks }
            : {}),
          ...(reportCard.principalRemarks
            ? { principalRemarks: reportCard.principalRemarks }
            : {}),
          ...(school?.principalName
            ? { principalName: school.principalName }
            : {}),
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
          ...(reportCard.attendancePercent
            ? { attendancePercent: parseFloat(reportCard.attendancePercent) }
            : {}),
          ...(reportCard.teacherRemarks
            ? { teacherRemarks: reportCard.teacherRemarks }
            : {}),
          ...(reportCard.principalRemarks
            ? { principalRemarks: reportCard.principalRemarks }
            : {}),
          ...(school?.principalName
            ? { principalName: school.principalName }
            : {}),
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
          ...(reportCard.attendancePercent
            ? { attendancePercent: parseFloat(reportCard.attendancePercent) }
            : {}),
          ...(reportCard.teacherRemarks
            ? { teacherRemarks: reportCard.teacherRemarks }
            : {}),
          ...(reportCard.principalRemarks
            ? { principalRemarks: reportCard.principalRemarks }
            : {}),
          ...(school?.principalName
            ? { principalName: school.principalName }
            : {}),
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
