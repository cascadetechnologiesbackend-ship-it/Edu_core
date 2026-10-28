"use server";

import { getCachedSession } from "@/lib/serverAuth";
import { withTenant } from "@/db";
import {
  exams,
  examClassScopes,
  examSchedules,
  examMarksLocks,
  examAdmitCardSettings,
  examAdmitCardHolds,
  markEntries,
  reportCards,
  resultSettings,
  reportCardSetups,
  subjects,
  feeInvoices,
} from "@/db/schema";
import { and, eq, inArray, isNull, desc, asc } from "drizzle-orm";
import { resolveStudentScope } from "@/lib/studentEventEngine/scopeResolver";

export interface StudentDatesheetItem {
  id: string;
  examId: string;
  examName: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  examDate: string;
  startTime: string;
  durationMinutes: number;
  roomNumber: string | null;
  maxMarks: number;
  passingMarks: number;
}

export interface StudentAdmitCardBanner {
  examId: string;
  examName: string;
  status: "AVAILABLE" | "HELD" | "FEE_BLOCKED" | "NOT_RELEASED";
  holdReason: string | null;
  dueAmount: number;
  softFeeWarning: boolean;
  instructions: string | null;
  examCentre: string | null;
  reportingTime: string | null;
}

export interface StudentSubjectMark {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  marksObtained: number | null;
  maxMarks: number;
  practicalMarks: number | null;
  practicalMaxMarks: number | null;
  grade: string | null;
  remarks: string | null;
  isAbsent: boolean;
}

export interface StudentExamResultItem {
  examId: string;
  examName: string;
  startDate: string | null;
  endDate: string | null;
  isLocked: boolean;
  lockStatusLabel: string;
  marks: StudentSubjectMark[];
  totalMarksObtained: number | null;
  totalMaxMarks: number | null;
  percentage: number | null;
  reportCard: {
    id: string;
    overallGrade: string | null;
    rank: number | null;
    attendancePercent: number | null;
    teacherRemarks: string | null;
    principalRemarks: string | null;
    pdfS3Key: string | null;
    generatedAt: string | null;
  } | null;
}

export interface StudentMarksData {
  success: boolean;
  student: {
    studentId: string;
    studentName: string;
    className: string;
    sectionName: string;
    academicYearLabel: string;
  };
  datesheet: StudentDatesheetItem[];
  admitCards: StudentAdmitCardBanner[];
  results: StudentExamResultItem[];
  error?: string;
}

export async function getStudentMarksAction(
  studentIdParam?: string
): Promise<StudentMarksData> {
  const session = await getCachedSession();
  const userId = session?.user?.id || "";
  const schoolId = session?.user?.schoolId || "";
  const role = session?.user?.role || "STUDENT";

  if (!userId || !schoolId) {
    return {
      success: false,
      student: {
        studentId: "",
        studentName: "",
        className: "",
        sectionName: "",
        academicYearLabel: "",
      },
      datesheet: [],
      admitCards: [],
      results: [],
      error: "Authentication required",
    };
  }

  try {
    const scope = await resolveStudentScope(userId, {
      schoolId,
      studentId: studentIdParam ?? null,
      role,
    });

    if (!scope.classId || !scope.academicYearId) {
      return {
        success: true,
        student: {
          studentId: scope.studentId,
          studentName: scope.studentName,
          className: scope.className,
          sectionName: scope.sectionName,
          academicYearLabel: scope.academicYearLabel,
        },
        datesheet: [],
        admitCards: [],
        results: [],
      };
    }

    const classId = scope.classId;
    const academicYearId = scope.academicYearId;

    return await withTenant(scope.schoolId, async (tx) => {
      // 1. Fetch student's outstanding fee dues for admit-card / result fee locks
      const invoices = await tx.query.feeInvoices.findMany({
        where: and(
          eq(feeInvoices.schoolId, scope.schoolId),
          eq(feeInvoices.studentId, scope.studentId)
        ),
      });

      let outstandingDues = 0;
      for (const inv of invoices) {
        if (
          inv.status === "PENDING" ||
          inv.status === "PARTIAL" ||
          inv.status === "OVERDUE"
        ) {
          outstandingDues += Number(inv.balanceAmount || 0);
        }
      }

      // 2. Fetch Exams scoped to student's class
      const classScopeRows = await tx.query.examClassScopes.findMany({
        where: and(
          eq(examClassScopes.schoolId, scope.schoolId),
          eq(examClassScopes.classId, classId)
        ),
      });

      const scopedExamIds = classScopeRows.map((s) => s.examId);

      // Also find exams for academic year
      const examRows = await tx.query.exams.findMany({
        where: and(
          eq(exams.schoolId, scope.schoolId),
          eq(exams.academicYearId, academicYearId)
        ),
        orderBy: [desc(exams.startDate)],
      });

      // Filter to relevant exams
      const relevantExams = examRows.filter(
        (e) => scopedExamIds.length === 0 || scopedExamIds.includes(e.id)
      );

      const relevantExamIds = relevantExams.map((e) => e.id);

      // 3. Fetch Datesheet (exam_schedules)
      let datesheetItems: StudentDatesheetItem[] = [];
      if (relevantExamIds.length > 0) {
        const schedules = await tx.query.examSchedules.findMany({
          where: and(
            eq(examSchedules.schoolId, scope.schoolId),
            eq(examSchedules.classId, classId),
            inArray(examSchedules.examId, relevantExamIds)
          ),
          orderBy: [asc(examSchedules.examDate), asc(examSchedules.startTime)],
        });

        if (schedules.length > 0) {
          const subjectIds = Array.from(
            new Set(schedules.map((s) => s.subjectId))
          );
          const subRows = await tx.query.subjects.findMany({
            where: and(
              eq(subjects.schoolId, scope.schoolId),
              inArray(subjects.id, subjectIds)
            ),
            columns: { id: true, name: true, code: true },
          });

          const subMap = new Map(subRows.map((s) => [s.id, s]));
          const examMap = new Map(relevantExams.map((e) => [e.id, e]));

          datesheetItems = schedules.map((sch) => {
            const sub = subMap.get(sch.subjectId);
            const ex = examMap.get(sch.examId);
            return {
              id: sch.id,
              examId: sch.examId,
              examName: ex?.name || "Exam",
              subjectId: sch.subjectId,
              subjectName: sub?.name || "Subject",
              subjectCode: sub?.code || null,
              examDate: sch.examDate,
              startTime: sch.startTime,
              durationMinutes: sch.durationMinutes,
              roomNumber: sch.roomNumber,
              maxMarks: Number(sch.maxMarks),
              passingMarks: Number(sch.passingMarks),
            };
          });
        }
      }

      // 4. Fetch Admit Card Banners
      const admitCardBanners: StudentAdmitCardBanner[] = [];
      const now = new Date();

      if (relevantExamIds.length > 0) {
        const admitSettings = await tx.query.examAdmitCardSettings.findMany({
          where: and(
            eq(examAdmitCardSettings.schoolId, scope.schoolId),
            inArray(examAdmitCardSettings.examId, relevantExamIds)
          ),
        });

        const admitHolds = await tx.query.examAdmitCardHolds.findMany({
          where: and(
            eq(examAdmitCardHolds.schoolId, scope.schoolId),
            eq(examAdmitCardHolds.studentId, scope.studentId),
            inArray(examAdmitCardHolds.examId, relevantExamIds),
            isNull(examAdmitCardHolds.releasedAt)
          ),
        });

        const holdByExam = new Map(admitHolds.map((h) => [h.examId, h]));
        const settingsByExam = new Map(admitSettings.map((s) => [s.examId, s]));

        for (const ex of relevantExams) {
          const settings = settingsByExam.get(ex.id);
          const hold = holdByExam.get(ex.id);

          if (!settings && !hold) continue;

          const threshold = Number(settings?.feeLockThresholdAmount || 0);
          const feeExceeded = outstandingDues > threshold;

          let status: "AVAILABLE" | "HELD" | "FEE_BLOCKED" | "NOT_RELEASED" =
            "AVAILABLE";
          let holdReason: string | null = null;
          let softFeeWarning = false;

          if (hold) {
            status = "HELD";
            holdReason = hold.reason;
          } else if (
            !settings?.isReleased ||
            (settings.availableFrom && now < new Date(settings.availableFrom)) ||
            (settings.availableUntil && now > new Date(settings.availableUntil))
          ) {
            status = "NOT_RELEASED";
          } else if (settings.feeLockMode === "HARD" && feeExceeded) {
            status = "FEE_BLOCKED";
          } else if (settings.feeLockMode === "SOFT" && feeExceeded) {
            softFeeWarning = true;
          }

          admitCardBanners.push({
            examId: ex.id,
            examName: ex.name,
            status,
            holdReason,
            dueAmount: outstandingDues,
            softFeeWarning,
            instructions: settings?.instructions || null,
            examCentre: settings?.examCentre || null,
            reportingTime: settings?.reportingTime || null,
          });
        }
      }

      // 5. Exam Results & Locks (AC-10, BR5)
      const results: StudentExamResultItem[] = [];

      if (relevantExamIds.length > 0) {
        // Fetch marks locks for student's class
        const marksLocks = await tx.query.examMarksLocks.findMany({
          where: and(
            eq(examMarksLocks.schoolId, scope.schoolId),
            eq(examMarksLocks.classId, classId),
            inArray(examMarksLocks.examId, relevantExamIds)
          ),
        });

        // Fetch report card setups & result settings
        const setups = await tx.query.reportCardSetups.findMany({
          where: and(
            eq(reportCardSetups.schoolId, scope.schoolId),
            eq(reportCardSetups.academicYearId, academicYearId)
          ),
        });

        const setupIds = setups.map((s) => s.id);
        const resSettings = setupIds.length > 0
          ? await tx.query.resultSettings.findMany({
              where: and(
                eq(resultSettings.schoolId, scope.schoolId),
                inArray(resultSettings.setupId, setupIds)
              ),
            })
          : [];

        // Fetch student's report cards
        const studentReportCards = await tx.query.reportCards.findMany({
          where: and(
            eq(reportCards.schoolId, scope.schoolId),
            eq(reportCards.studentId, scope.studentId),
            inArray(reportCards.examId, relevantExamIds)
          ),
        });

        const reportCardByExam = new Map(
          studentReportCards.map((rc) => [rc.examId, rc])
        );

        // Fetch mark entries for student
        const studentMarks = await tx.query.markEntries.findMany({
          where: and(
            eq(markEntries.schoolId, scope.schoolId),
            eq(markEntries.studentId, scope.studentId),
            inArray(markEntries.examId, relevantExamIds)
          ),
        });

        // Subject names map
        const allMarkSubjectIds = Array.from(
          new Set(studentMarks.map((m) => m.subjectId))
        );
        const allSubjects = allMarkSubjectIds.length > 0
          ? await tx.query.subjects.findMany({
              where: and(
                eq(subjects.schoolId, scope.schoolId),
                inArray(subjects.id, allMarkSubjectIds)
              ),
              columns: { id: true, name: true, code: true },
            })
          : [];
        const subMap = new Map(allSubjects.map((s) => [s.id, s]));

        for (const ex of relevantExams) {
          // Check lock status:
          // A: Check if any marks lock exists for this exam and class.
          const examLocks = marksLocks.filter((l) => l.examId === ex.id);
          const hasUnfinalizedLocks =
            examLocks.length === 0 ||
            examLocks.some((l) => l.status !== "LOCKED");

          // B: Check global resultSettings (if configured)
          const isResultSettingWithheld = resSettings.some(
            (rs) =>
              rs.withholdAll ||
              (rs.releaseAt && now < new Date(rs.releaseAt))
          );

          // Canonical gating rule (AC-10, BR5):
          // Results are locked if locks are not complete OR result settings withhold them
          const isLocked = hasUnfinalizedLocks || isResultSettingWithheld;

          const lockStatusLabel = isLocked
            ? "Results awaited / परिणाम प्रतीक्षित है"
            : "Results Published / परिणाम घोषित";

          const examMarksList = studentMarks.filter((m) => m.examId === ex.id);
          const rc = reportCardByExam.get(ex.id);

          // If locked: Student NEVER receives raw draft marks (zero leak!)
          if (isLocked) {
            results.push({
              examId: ex.id,
              examName: ex.name,
              startDate: ex.startDate ? new Date(ex.startDate).toISOString() : null,
              endDate: ex.endDate ? new Date(ex.endDate).toISOString() : null,
              isLocked: true,
              lockStatusLabel,
              marks: [],
              totalMarksObtained: null,
              totalMaxMarks: null,
              percentage: null,
              reportCard: null,
            });
          } else {
            // Unlocked: surface student's marks and report card
            let totalObtained = 0;
            let totalMax = 0;

            const mappedMarks: StudentSubjectMark[] = examMarksList.map((m) => {
              const sub = subMap.get(m.subjectId);
              const obtained = m.marksObtained !== null ? Number(m.marksObtained) : null;
              const max = Number(m.maxMarks);

              if (obtained !== null && !m.isAbsent) {
                totalObtained += obtained;
              }
              totalMax += max;

              return {
                subjectId: m.subjectId,
                subjectName: sub?.name || "Subject",
                subjectCode: sub?.code || null,
                marksObtained: obtained,
                maxMarks: max,
                practicalMarks: m.practicalMarks !== null ? Number(m.practicalMarks) : null,
                practicalMaxMarks: m.practicalMaxMarks !== null ? Number(m.practicalMaxMarks) : null,
                grade: m.grade || null,
                remarks: m.remarks || null,
                isAbsent: m.isAbsent,
              };
            });

            const percentage =
              totalMax > 0
                ? Math.round((totalObtained / totalMax) * 1000) / 10
                : null;

            results.push({
              examId: ex.id,
              examName: ex.name,
              startDate: ex.startDate ? new Date(ex.startDate).toISOString() : null,
              endDate: ex.endDate ? new Date(ex.endDate).toISOString() : null,
              isLocked: false,
              lockStatusLabel,
              marks: mappedMarks,
              totalMarksObtained: totalObtained,
              totalMaxMarks: totalMax,
              percentage,
              reportCard: rc
                ? {
                    id: rc.id,
                    overallGrade: rc.overallGrade,
                    rank: rc.rank,
                    attendancePercent: rc.attendancePercent ? Number(rc.attendancePercent) : null,
                    teacherRemarks: rc.teacherRemarks,
                    principalRemarks: rc.principalRemarks,
                    pdfS3Key: rc.pdfS3Key,
                    generatedAt: rc.generatedAt ? new Date(rc.generatedAt).toISOString() : null,
                  }
                : null,
            });
          }
        }
      }

      return {
        success: true,
        student: {
          studentId: scope.studentId,
          studentName: scope.studentName,
          className: scope.className,
          sectionName: scope.sectionName,
          academicYearLabel: scope.academicYearLabel,
        },
        datesheet: datesheetItems,
        admitCards: admitCardBanners,
        results,
      };
    });
  } catch (err: any) {
    return {
      success: false,
      student: {
        studentId: "",
        studentName: "",
        className: "",
        sectionName: "",
        academicYearLabel: "",
      },
      datesheet: [],
      admitCards: [],
      results: [],
      error: err.message || "Failed to load examination records",
    };
  }
}
