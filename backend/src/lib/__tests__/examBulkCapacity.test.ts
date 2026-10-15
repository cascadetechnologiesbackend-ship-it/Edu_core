import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import {
  executeBulkReportCardRun,
  detectAndRecoverStuckJobs,
  requeueFailedRows,
  getJobPresignedZipUrl,
  REPORT_CARD_CHUNK_SIZE,
} from "../bulkGenerationEngine";
import { buildZipArchive, inspectZipEntries } from "../zipPacker";
import { encryptData } from "../encryption";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

describe("S10 Layer 3: Bulk Report Card Generation Capacity & Hardening Drill", () => {
  let pool: Pool;

  const schoolId = "c1111111-1111-4111-8111-111111111111";
  const academicYearId = "c2222222-2222-4222-8222-222222222222";
  const classId = "c3333333-3333-4333-8333-333333333333";
  const subjectId = "c4444444-4444-4444-8444-444444444444";
  const examTypeId = "ccccccc0-0000-4ccc-8ccc-000000000000";
  const examId = "ccccccc1-1111-4ccc-8ccc-111111111111";
  const adminUserId = "c5555555-5555-4555-8555-555555555555";
  const adminRoleId = "c5555555-cccc-4555-8555-555555555555";

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    const client = await pool.connect();

    try {
      // 1. Seed benchmark school
      await client.query(
        `INSERT INTO schools (id, name, slug, udise_code, board, address, city, state, pincode, phone, email, principal_name, established_year, is_active)
         VALUES ($1, 'Capacity Benchmark Academy', 'capacity-academy', 'UDC99000303', 'CBSE', '456 Scale Road', 'Bengaluru', 'Karnataka', '560001', '9876543299', 'bench@capacity.internal', 'Dr. Scale', 2012, true)
         ON CONFLICT (id) DO UPDATE SET is_active = true`,
        [schoolId],
      );

      await client.query(
        `INSERT INTO academic_years (id, school_id, label, start_date, end_date, is_active)
         VALUES ($1, $2, '2026-2027', '2026-04-01 00:00:00+00', '2027-03-31 23:59:59+00', true)
         ON CONFLICT (id) DO NOTHING`,
        [academicYearId, schoolId],
      );

      await client.query(
        `INSERT INTO classes (id, school_id, academic_year_id, grade_level, display_name, sort_order, is_active)
         VALUES ($1, $2, $3, 'CLASS_10', 'Class 10 Scale', 10, true)
         ON CONFLICT (id) DO NOTHING`,
        [classId, schoolId, academicYearId],
      );

      await client.query(
        `INSERT INTO subjects (id, school_id, code, name, subject_type, max_marks, passing_marks, is_active)
         VALUES ($1, $2, 'MATH-CAP', 'Mathematics Scale', 'THEORY', 100, 33, true)
         ON CONFLICT (id) DO NOTHING`,
        [subjectId, schoolId],
      );

      await client.query(
        `INSERT INTO roles (id, school_id, name, display_name, is_system_role)
         VALUES ($1, $2, 'SCHOOL_ADMIN', 'School Admin', true)
         ON CONFLICT (id) DO NOTHING`,
        [adminRoleId, schoolId],
      );

      await client.query(
        `INSERT INTO users (id, school_id, email, is_active)
         VALUES ($1, $2, 'admin@capacity.internal', true)
         ON CONFLICT (id) DO NOTHING`,
        [adminUserId, schoolId],
      );

      await client.query(
        `INSERT INTO user_roles (id, user_id, role_id, school_id)
         VALUES (gen_random_uuid(), $1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [adminUserId, adminRoleId, schoolId],
      );

      await client.query(
        `INSERT INTO exam_types (id, school_id, name, code, exam_type, is_active)
         VALUES ($1, $2, 'Annual Assessment', 'ANN_CAP', 'ANNUAL', true)
         ON CONFLICT (id) DO NOTHING`,
        [examTypeId, schoolId],
      );

      await client.query(
        `INSERT INTO exams (id, school_id, academic_year_id, exam_type_id, name, start_date, end_date, is_locked)
         VALUES ($1, $2, $3, $4, 'Annual Exam Scale 2026-27', '2026-10-01 09:00:00+00', '2026-10-10 17:00:00+00', false)
         ON CONFLICT (id) DO NOTHING`,
        [examId, schoolId, academicYearId, examTypeId],
      );

      // Seed Grade Rules
      await client.query(
        `INSERT INTO grade_rules (id, school_id, class_group, min_percent, max_percent, grade, grade_point, description)
         VALUES 
           (gen_random_uuid(), $1, 'CLASS_9_10', '91.00', '100.00', 'A1', '10.0', 'Outstanding'),
           (gen_random_uuid(), $1, 'CLASS_9_10', '81.00', '90.99', 'A2', '9.0', 'Excellent'),
           (gen_random_uuid(), $1, 'CLASS_9_10', '71.00', '80.99', 'B1', '8.0', 'Very Good'),
           (gen_random_uuid(), $1, 'CLASS_9_10', '33.00', '70.99', 'C1', '6.0', 'Pass'),
           (gen_random_uuid(), $1, 'CLASS_9_10', '0.00', '32.99', 'E', '0.0', 'Needs Improvement')
         ON CONFLICT DO NOTHING`,
        [schoolId],
      );

      // 2. Efficiently seed 1,200 students with marks in bulk
      // Ensure clean student and marks dataset for benchmark school
      await client.query(`DELETE FROM mark_entries WHERE school_id = $1`, [schoolId]);
      await client.query(`DELETE FROM report_cards WHERE school_id = $1`, [schoolId]);
      await client.query(`DELETE FROM report_card_jobs WHERE school_id = $1`, [schoolId]);
      await client.query(`DELETE FROM students WHERE school_id = $1`, [schoolId]);

      console.log(`[CapacityDrill] Seeding 1,200 students with complete marks for realistic school scale...`);
      const encName = encryptData("Student");

      const studentRows: string[] = [];
      const markRows: string[] = [];

      for (let i = 1; i <= 1200; i++) {
        const sId = `c9999000-0000-4999-8999-${i.toString().padStart(12, "0")}`;
        const adm = `CAP-${i.toString().padStart(4, "0")}`;
        studentRows.push(
          `('${sId}', '${schoolId}', '${academicYearId}', '${adm}', '${encName}', '${encName}', '2010-01-01 00:00:00+00', 'MALE', 'GENERAL', '2026-04-01 00:00:00+00', '${classId}', true)`,
        );
        markRows.push(
          `(gen_random_uuid(), '${schoolId}', '${examId}', '${sId}', '${subjectId}', '85.00', '100.00', 'SUBMITTED', false, false, false, '${adminUserId}')`,
        );
      }

      // Insert in 200-row chunks for high-speed Postgres ingestion
      for (let j = 0; j < studentRows.length; j += 200) {
        const sChunk = studentRows.slice(j, j + 200);
        await client.query(
          `INSERT INTO students (id, school_id, academic_year_id, admission_number, first_name_encrypted, last_name_encrypted, date_of_birth, gender, category, admission_date, current_class_id, is_active)
           VALUES ${sChunk.join(", ")}`,
        );

        const mChunk = markRows.slice(j, j + 200);
        await client.query(
          `INSERT INTO mark_entries (id, school_id, exam_id, student_id, subject_id, marks_obtained, max_marks, status, is_absent, is_medical_exempt, is_practical_absent, entered_by_id)
           VALUES ${mChunk.join(", ")}`,
        );
      }
      console.log(`[CapacityDrill] Finished seeding 1,200 students with marks.`);
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("3.1: Bulk capacity benchmark at realistic school scale (1,200 students)", async () => {
    const jobId = "cccccccc-1200-4ccc-8ccc-000000000001";
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO report_card_jobs (id, school_id, exam_id, class_id, total_students, processed_count, failed_count, status, triggered_by_id)
         VALUES ($1, $2, $3, $4, 1200, 0, 0, 'QUEUED', $5)
         ON CONFLICT (id) DO UPDATE SET status = 'QUEUED', processed_count = 0, failed_count = 0`,
        [jobId, schoolId, examId, classId, adminUserId],
      );
    } finally {
      client.release();
    }

    const result = await executeBulkReportCardRun({
      jobId,
      schoolId,
      examId,
      classId,
      chunkSize: REPORT_CARD_CHUNK_SIZE, // 50 students per chunk
      mockPdfContent: true,
    });

    expect(result.status).toBe("DONE");
    expect(result.totalStudents).toBe(1200);
    expect(result.processedCount).toBe(1200);
    expect(result.failedCount).toBe(0);

    // Throughput and Memory assertions
    expect(result.durationMs).toBeGreaterThan(0);
    const throughputPerSec = Math.round((result.totalStudents / (result.durationMs / 1000)));
    console.log(`[CapacityMetrics] 1,200 Students: ${result.durationMs}ms total (${throughputPerSec} students/sec)`);
    console.log(`[CapacityMetrics] Peak RSS: ${result.peakRssMb} MB (t3.micro ceiling: 1024 MB)`);

    // Verify worker RSS memory headroom for t3.micro (stays well below 500 MB)
    expect(result.peakRssMb).toBeLessThan(500);

    // Verify S3 bulk ZIP delivery
    expect(result.zipS3Key).toBe(`${schoolId}/reports/bulk_${jobId}.zip`);
    expect(result.zipSizeBytes).toBeGreaterThan(50000);

    // Verify presigned download URL generation (3600s expiry)
    const downloadUrl = await getJobPresignedZipUrl(jobId, schoolId, 3600);
    expect(typeof downloadUrl).toBe("string");
    expect(downloadUrl.length).toBeGreaterThan(10);
  }, 45000);

  it("3.2: Per-student error isolation, partial failure, and targeted retry", async () => {
    const failJobId = "cccccccc-1200-4ccc-8ccc-000000000002";
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO report_card_jobs (id, school_id, exam_id, class_id, total_students, processed_count, failed_count, status, triggered_by_id)
         VALUES ($1, $2, $3, $4, 5, 0, 0, 'QUEUED', $5)
         ON CONFLICT (id) DO UPDATE SET status = 'QUEUED', processed_count = 0, failed_count = 0`,
        [failJobId, schoolId, examId, classId, adminUserId],
      );
    } finally {
      client.release();
    }

    // Select 5 students, 1 of which is non-existent to trigger failure
    const validStudents = await pool.query(
      `SELECT id FROM students WHERE school_id = $1 LIMIT 4`,
      [schoolId],
    );
    const testStudentIds = validStudents.rows.map((r) => r.id);
    const invalidStudentId = "c9999999-dead-4999-8999-000000000999";
    testStudentIds.push(invalidStudentId);

    const result = await executeBulkReportCardRun({
      jobId: failJobId,
      schoolId,
      examId,
      classId,
      studentIds: testStudentIds,
      chunkSize: 5,
      mockPdfContent: true,
    });

    // 4 students should succeed, 1 should fail
    expect(result.status).toBe("DONE");
    expect(result.processedCount).toBe(4);
    expect(result.failedCount).toBe(1);

    // Verify errorLog contains the failed student detail
    const jobRow = await pool.query(
      `SELECT error_log FROM report_card_jobs WHERE id = $1`,
      [failJobId],
    );
    const errorLog = jobRow.rows[0].error_log;
    expect(errorLog.failedStudents.length).toBe(1);
    expect(errorLog.failedStudents[0].studentId).toBe(invalidStudentId);

    // Requeue failed rows drill: seed the missing student and marks so retry will succeed
    const encName = encryptData("RetryStudent");
    await pool.query(
      `INSERT INTO students (id, school_id, academic_year_id, admission_number, first_name_encrypted, last_name_encrypted, date_of_birth, gender, category, admission_date, current_class_id, is_active)
       VALUES ($1, $2, $3, 'CAP-RETRY', $4, $4, '2010-01-01 00:00:00+00', 'MALE', 'GENERAL', '2026-04-01 00:00:00+00', $5, true)
       ON CONFLICT (id) DO NOTHING`,
      [invalidStudentId, schoolId, academicYearId, encName, classId],
    );
    await pool.query(
      `INSERT INTO mark_entries (id, school_id, exam_id, student_id, subject_id, marks_obtained, max_marks, status, entered_by_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, '90.00', '100.00', 'SUBMITTED', $5)
       ON CONFLICT DO NOTHING`,
      [schoolId, examId, invalidStudentId, subjectId, adminUserId],
    );

    const retryResult = await requeueFailedRows(failJobId, schoolId);
    expect(retryResult.status).toBe("DONE");
    expect(retryResult.processedCount).toBe(1);
    expect(retryResult.failedCount).toBe(0);
  }, 30000);

  it("3.3: Stuck job detection and automatic crash recovery", async () => {
    const stuckJobId = "cccccccc-1200-4ccc-8ccc-000000000003";
    const client = await pool.connect();
    try {
      // Insert a simulated stuck job with updatedAt 25 minutes ago
      await client.query(
        `INSERT INTO report_card_jobs (id, school_id, exam_id, class_id, total_students, processed_count, failed_count, status, triggered_by_id, updated_at)
         VALUES ($1, $2, $3, $4, 100, 20, 0, 'PROCESSING', $5, NOW() - INTERVAL '25 minutes')
         ON CONFLICT (id) DO UPDATE SET status = 'PROCESSING', updated_at = NOW() - INTERVAL '25 minutes'`,
        [stuckJobId, schoolId, examId, classId, adminUserId],
      );

      // Run stuck-job recovery with 15-minute timeout threshold
      const recoveredCount = await detectAndRecoverStuckJobs({
        schoolId,
        timeoutMinutes: 15,
      });

      expect(recoveredCount).toBeGreaterThanOrEqual(1);

      // Check job transitioned to FAILED
      const jobRes = await client.query(
        `SELECT status, error_log FROM report_card_jobs WHERE id = $1`,
        [stuckJobId],
      );
      expect(jobRes.rows[0].status).toBe("FAILED");
      expect(jobRes.rows[0].error_log.timeoutReason).toContain("Worker timeout");
    } finally {
      client.release();
    }
  });
});
