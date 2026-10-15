import { db } from "@/db";
import {
  studentAttendance,
  examSchedules,
  exams,
  students,
  sections,
  auditLogs,
} from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export interface SyncExamAttendanceEntry {
  studentId: string;
  marksObtained?: number | null;
  isAbsent?: boolean;
  isMedicalExempt?: boolean;
  remarks?: string | null;
}

export interface SyncExamAttendanceInput {
  schoolId: string;
  examId: string;
  classId: string;
  subjectId: string;
  sectionId?: string | null | undefined;
  markedById: string;
  userEmail: string;
  userRole: string;
  entries: SyncExamAttendanceEntry[];
}

export interface ExamAttendanceSyncResult {
  syncedAbsencesCount: number;
  reconciledCount: number;
}

/**
 * Synchronizes examination marks absenteeism with the student_attendance table.
 * 
 * S11 Consistency & Isolation Rules:
 * 1. During marks entry, the student absent flag writes a student_attendance record with source='EXAM'
 *    linked to the exam_schedules row (preventing double-records via partial unique constraint).
 * 2. Unlocking marks and correcting from ABSENT to PRESENT does NOT silently delete attendance records;
 *    it updates status to PRESENT and records an audit log row for compliance.
 * 3. Medical exemptions are marked with status='LEAVE' and appropriate remarks.
 * 4. Strict tenant isolation by schoolId.
 */
export async function syncExamAttendance(
  input: SyncExamAttendanceInput,
): Promise<ExamAttendanceSyncResult> {
  const {
    schoolId,
    examId,
    classId,
    subjectId,
    markedById,
    userEmail,
    userRole,
    entries,
  } = input;

  if (!entries || entries.length === 0) {
    return { syncedAbsencesCount: 0, reconciledCount: 0 };
  }

  // 1. Locate the exam schedule for this paper
  const schedule = await db.query.examSchedules.findFirst({
    where: and(
      eq(examSchedules.schoolId, schoolId),
      eq(examSchedules.examId, examId),
      eq(examSchedules.classId, classId),
      eq(examSchedules.subjectId, subjectId),
    ),
  });

  // 2. Fetch the exam metadata for academic year and fallback date
  const exam = await db.query.exams.findFirst({
    where: and(eq(exams.id, examId), eq(exams.schoolId, schoolId)),
  });

  const attendanceDate = schedule?.examDate
    ? new Date(schedule.examDate)
    : exam?.startDate
    ? new Date(exam.startDate)
    : new Date();

  const studentIds = entries.map((e) => e.studentId);

  // 3. Look up student records to get sectionId and academicYearId
  const studentRows = await db.query.students.findMany({
    where: and(
      eq(students.schoolId, schoolId),
      inArray(students.id, studentIds),
    ),
    columns: {
      id: true,
      currentClassId: true,
      currentSectionId: true,
      academicYearId: true,
    },
  });

  const studentMap = new Map<string, (typeof studentRows)[number]>();
  for (const s of studentRows) {
    studentMap.set(s.id, s);
  }

  // Fallback section for this class if student has no section assigned
  let defaultSectionId = input.sectionId || null;
  if (!defaultSectionId) {
    const sec = await db.query.sections.findFirst({
      where: and(eq(sections.schoolId, schoolId), eq(sections.classId, classId)),
      columns: { id: true },
    });
    defaultSectionId = sec?.id ?? null;
  }

  // 4. Look up existing attendance records for these students linked to this examSchedule
  const existingAttendanceRecords = schedule?.id
    ? await db.query.studentAttendance.findMany({
        where: and(
          eq(studentAttendance.schoolId, schoolId),
          eq(studentAttendance.examScheduleId, schedule.id),
          inArray(studentAttendance.studentId, studentIds),
        ),
      })
    : [];

  const existingMap = new Map<string, (typeof existingAttendanceRecords)[number]>();
  for (const a of existingAttendanceRecords) {
    existingMap.set(a.studentId, a);
  }

  let syncedAbsencesCount = 0;
  let reconciledCount = 0;

  for (const entry of entries) {
    const student = studentMap.get(entry.studentId);
    if (!student) continue;

    const sectionId =
      student.currentSectionId || defaultSectionId;
    if (!sectionId) continue;

    const academicYearId =
      student.academicYearId || exam?.academicYearId;
    if (!academicYearId) continue;

    const existing = existingMap.get(entry.studentId);

    if (entry.isAbsent) {
      const isMed = Boolean(entry.isMedicalExempt);
      const status = isMed ? "LEAVE" : "ABSENT";
      const remarks = isMed
        ? entry.remarks
          ? `EXAM_ABSENT_MEDICAL: ${entry.remarks}`
          : "EXAM_ABSENT_MEDICAL: Medical Exemption"
        : entry.remarks
        ? `EXAM_ABSENT: ${entry.remarks}`
        : "EXAM_ABSENT: Exam Day Absence";

      if (schedule?.id) {
        // Upsert on unique(student_id, exam_schedule_id) partial index
        await db.execute(sql`
          INSERT INTO student_attendance (
            id, school_id, student_id, section_id, academic_year_id,
            attendance_date, period_id, status, source, exam_schedule_id,
            marked_by_id, remarks, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), ${schoolId}, ${entry.studentId}, ${sectionId}, ${academicYearId},
            ${attendanceDate}, NULL, ${status}::attendance_status, 'EXAM', ${schedule.id},
            ${markedById}, ${remarks}, NOW(), NOW()
          )
          ON CONFLICT (student_id, exam_schedule_id) WHERE exam_schedule_id IS NOT NULL
          DO UPDATE SET
            status = EXCLUDED.status,
            remarks = EXCLUDED.remarks,
            marked_by_id = EXCLUDED.marked_by_id,
            updated_at = NOW();
        `);
      } else {
        // Fallback if paper has no schedule record
        if (existing) {
          await db
            .update(studentAttendance)
            .set({
              status,
              remarks,
              markedById,
              updatedAt: new Date(),
            })
            .where(eq(studentAttendance.id, existing.id));
        } else {
          await db.insert(studentAttendance).values({
            schoolId,
            studentId: entry.studentId,
            sectionId,
            academicYearId,
            attendanceDate,
            periodId: null,
            status,
            source: "EXAM",
            examScheduleId: null,
            markedById,
            remarks,
          });
        }
      }
      syncedAbsencesCount++;
    } else if (existing && (existing.status === "ABSENT" || existing.status === "LEAVE")) {
      // S11 Unlock Correction: Previously absent student is now marked present!
      // Do NOT silently delete attendance history: update to PRESENT and audit log the correction.
      const reconciledRemarks = `EXAM_RECONCILED: Corrected to PRESENT by ${userRole} from ${existing.status}`;

      await db
        .update(studentAttendance)
        .set({
          status: "PRESENT",
          remarks: reconciledRemarks,
          markedById,
          updatedAt: new Date(),
        })
        .where(eq(studentAttendance.id, existing.id));

      // Append immutable audit log for DPDP / compliance
      await db.insert(auditLogs).values({
        schoolId,
        userId: markedById,
        userEmail,
        userRole,
        action: "WRITE",
        tableName: "student_attendance",
        recordId: existing.id,
        purposeId: "exam_attendance_correction",
        ipAddress: "127.0.0.1",
        userAgent: "SchoolMitra/ExamSyncEngine",
        metadata: {
          event: "EXAM_ATTENDANCE_RECONCILED",
          studentId: entry.studentId,
          examId,
          examScheduleId: schedule?.id ?? null,
          previousStatus: existing.status,
          newStatus: "PRESENT",
          reason: "Marks unlock correction",
        },
      });

      reconciledCount++;
    }
  }

  return { syncedAbsencesCount, reconciledCount };
}

/**
 * Fetches exam-specific absentee metrics for dashboard charts.
 */
export async function getExamAttendanceMetrics(schoolId: string, examId?: string) {
  const query = db
    .select({
      examScheduleId: studentAttendance.examScheduleId,
      status: studentAttendance.status,
      count: sql<number>`count(*)::int`,
    })
    .from(studentAttendance)
    .where(
      and(
        eq(studentAttendance.schoolId, schoolId),
        eq(studentAttendance.source, "EXAM"),
      ),
    )
    .groupBy(studentAttendance.examScheduleId, studentAttendance.status);

  return query;
}
