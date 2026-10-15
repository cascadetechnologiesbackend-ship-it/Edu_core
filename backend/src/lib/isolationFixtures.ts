import { Pool } from "pg";
import { encryptData } from "./encryption";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

export const ISOLATION_IDS = {
  schoolA: {
    id: "a1111111-1111-4111-8111-111111111111",
    name: "Isolation School A (CBSE)",
    slug: "iso-school-a",
    code: "ISO-A",
    udise: "UDA99000101",
    academicYearId: "a2222222-2222-4222-8222-222222222222",
    classId: "a3333333-3333-4333-8333-333333333333",
    subjectId: "a4444444-4444-4444-8444-444444444444",
    adminUserId: "a5555555-5555-4555-8555-555555555555",
    adminRoleId: "a5555555-aaaa-4555-8555-555555555555",
    adminEmail: "admin.a@isolation.internal",
    teacherA1UserId: "a6666666-6666-4666-8666-666666666666",
    teacherA1RoleId: "a6666666-aaaa-4666-8666-666666666666",
    teacherA1Email: "teacher.a1@isolation.internal",
    teacherA2UserId: "a7777777-7777-4777-8777-777777777777",
    teacherA2RoleId: "a7777777-aaaa-4777-8777-777777777777",
    teacherA2Email: "teacher.a2@isolation.internal",
    parentUserId: "a8888888-8888-4888-8888-888888888888",
    parentRoleId: "a8888888-aaaa-4888-8888-888888888888",
    parentEmail: "parent.a@isolation.internal",
    studentId: "a9999999-9999-4999-8999-999999999999",
    admissionNumber: "ISO-A-1001",
    studentDob: "2010-05-15T00:00:00.000Z",
    examTypeId: "aaaaaaa0-0000-4aaa-8aaa-000000000000",
    examId: "aaaaaaa1-1111-4aaa-8aaa-111111111111",
    scheduleId: "aaaaaaa2-2222-4aaa-8aaa-222222222222",
    setupId: "aaaaaaa3-3333-4aaa-8aaa-333333333333",
    resultSettingId: "aaaaaaa4-4444-4aaa-8aaa-444444444444",
    snapshotId: "aaaaaaa5-5555-4aaa-8aaa-555555555555",
    jobId: "aaaaaaa6-6666-4aaa-8aaa-666666666666",
  },
  schoolB: {
    id: "b1111111-1111-4111-8111-111111111111",
    name: "Isolation School B (ICSE)",
    slug: "iso-school-b",
    code: "ISO-B",
    udise: "UDB99000202",
    academicYearId: "b2222222-2222-4222-8222-222222222222",
    classId: "b3333333-3333-4333-8333-333333333333",
    subjectId: "b4444444-4444-4444-8444-444444444444",
    adminUserId: "b5555555-5555-4555-8555-555555555555",
    adminRoleId: "b5555555-bbbb-4555-8555-555555555555",
    adminEmail: "admin.b@isolation.internal",
    teacherB1UserId: "b6666666-6666-4666-8666-666666666666",
    teacherB1RoleId: "b6666666-bbbb-4666-8666-666666666666",
    teacherB1Email: "teacher.b1@isolation.internal",
    parentUserId: "b8888888-8888-4888-8888-888888888888",
    parentRoleId: "b8888888-bbbb-4888-8888-888888888888",
    parentEmail: "parent.b@isolation.internal",
    studentId: "b9999999-9999-4999-8999-999999999999",
    admissionNumber: "ISO-B-2001",
    studentDob: "2010-08-20T00:00:00.000Z",
    examTypeId: "bbbbbbb0-0000-4bbb-8bbb-000000000000",
    examId: "bbbbbbb1-1111-4bbb-8bbb-111111111111",
    scheduleId: "bbbbbbb2-2222-4bbb-8bbb-222222222222",
    setupId: "bbbbbbb3-3333-4bbb-8bbb-333333333333",
    resultSettingId: "bbbbbbb4-4444-4bbb-8bbb-444444444444",
    snapshotId: "bbbbbbb5-5555-4bbb-8bbb-555555555555",
    jobId: "bbbbbbb6-6666-4bbb-8bbb-666666666666",
  },
};

export async function seedIsolationSchools() {
  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();

  try {
    console.log("[SeedIsolation] Seeding Schools A and B for Layer 2 Data Isolation Drill...");

    // ── 1. SCHOOLS & TENANT FIXTURES ──────────────────────────────────────────
    for (const s of [ISOLATION_IDS.schoolA, ISOLATION_IDS.schoolB]) {
      const board = s.id === ISOLATION_IDS.schoolA.id ? "CBSE" : "ICSE";
      await client.query(
        `INSERT INTO schools (id, name, slug, udise_code, board, address, city, state, pincode, phone, email, principal_name, established_year, is_active)
         VALUES ($1, $2, $3, $4, $5, '123 Testway', 'New Delhi', 'Delhi', '110001', '9876543210', $6, 'Principal', 2010, true)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, is_active = true`,
        [s.id, s.name, s.slug, s.udise, board, `${s.slug}@isolation.internal`],
      );

      // Academic Year (uses label, startDate, endDate)
      await client.query(
        `INSERT INTO academic_years (id, school_id, label, start_date, end_date, is_active)
         VALUES ($1, $2, '2026-2027', '2026-04-01 00:00:00+00', '2027-03-31 23:59:59+00', true)
         ON CONFLICT (id) DO NOTHING`,
        [s.academicYearId, s.id],
      );

      // Class (grade_level is 'CLASS_10', sort_order is 10)
      const classDisplayName = s.id === ISOLATION_IDS.schoolA.id ? "Class 10-A" : "Grade 10-Alpha";
      await client.query(
        `INSERT INTO classes (id, school_id, academic_year_id, grade_level, display_name, sort_order, is_active)
         VALUES ($1, $2, $3, 'CLASS_10', $4, 10, true)
         ON CONFLICT (id) DO NOTHING`,
        [s.classId, s.id, s.academicYearId, classDisplayName],
      );

      // Subject (subject_type is 'THEORY')
      const subjName = s.id === ISOLATION_IDS.schoolA.id ? "Mathematics" : "Physics";
      const subjCode = s.id === ISOLATION_IDS.schoolA.id ? "MATH-A" : "PHYS-B";
      await client.query(
        `INSERT INTO subjects (id, school_id, code, name, subject_type, max_marks, passing_marks, is_active)
         VALUES ($1, $2, $3, $4, 'THEORY', 100, 33, true)
         ON CONFLICT (id) DO NOTHING`,
        [s.subjectId, s.id, subjCode, subjName],
      );

      // Roles for tenant
      await client.query(
        `INSERT INTO roles (id, school_id, name, display_name, is_system_role)
         VALUES ($1, $2, 'SCHOOL_ADMIN', 'School Admin', true)
         ON CONFLICT (id) DO NOTHING`,
        [s.adminRoleId, s.id],
      );
      await client.query(
        `INSERT INTO roles (id, school_id, name, display_name, is_system_role)
         VALUES ($1, $2, 'PARENT', 'Parent', true)
         ON CONFLICT (id) DO NOTHING`,
        [s.parentRoleId, s.id],
      );

      // Admin User
      await client.query(
        `INSERT INTO users (id, school_id, email, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (id) DO NOTHING`,
        [s.adminUserId, s.id, s.adminEmail],
      );
      await client.query(
        `INSERT INTO user_roles (id, user_id, role_id, school_id)
         VALUES (gen_random_uuid(), $1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [s.adminUserId, s.adminRoleId, s.id],
      );

      // Parent User
      await client.query(
        `INSERT INTO users (id, school_id, email, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (id) DO NOTHING`,
        [s.parentUserId, s.id, s.parentEmail],
      );
      await client.query(
        `INSERT INTO user_roles (id, user_id, role_id, school_id)
         VALUES (gen_random_uuid(), $1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [s.parentUserId, s.parentRoleId, s.id],
      );

      // Student
      const firstName = s.id === ISOLATION_IDS.schoolA.id ? "Aarav" : "Rohan";
      const lastName = s.id === ISOLATION_IDS.schoolA.id ? "Sharma" : "Verma";
      const firstEnc = encryptData(firstName);
      const lastEnc = encryptData(lastName);

      await client.query(
        `INSERT INTO students (id, school_id, academic_year_id, admission_number, first_name_encrypted, last_name_encrypted, date_of_birth, gender, category, admission_date, current_class_id, primary_parent_user_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'MALE', 'GENERAL', '2026-04-01 00:00:00+00', $8, $9, true)
         ON CONFLICT (id) DO NOTHING`,
        [s.studentId, s.id, s.academicYearId, s.admissionNumber, firstEnc, lastEnc, s.studentDob, s.classId, s.parentUserId],
      );

      // Exam Type
      const etCode = s.id === ISOLATION_IDS.schoolA.id ? "HY_CBSE" : "TA_ICSE";
      await client.query(
        `INSERT INTO exam_types (id, school_id, name, code, exam_type, is_active)
         VALUES ($1, $2, 'Term Examination', $3, 'HALF_YEARLY', true)
         ON CONFLICT (id) DO NOTHING`,
        [s.examTypeId, s.id, etCode],
      );

      // Exam
      const examName = s.id === ISOLATION_IDS.schoolA.id ? "Half Yearly Examination 2026-27" : "Terminal Assessment 2026-27";
      await client.query(
        `INSERT INTO exams (id, school_id, academic_year_id, exam_type_id, name, start_date, end_date, is_locked)
         VALUES ($1, $2, $3, $4, $5, '2026-09-15 09:00:00+00', '2026-09-25 17:00:00+00', false)
         ON CONFLICT (id) DO NOTHING`,
        [s.examId, s.id, s.academicYearId, s.examTypeId, examName],
      );

      // Schedule
      await client.query(
        `INSERT INTO exam_schedules (id, school_id, exam_id, class_id, subject_id, exam_date, start_time, duration_minutes, max_marks, passing_marks)
         VALUES ($1, $2, $3, $4, $5, '2026-09-18', '09:00:00', 180, 100.00, 33.00)
         ON CONFLICT (id) DO NOTHING`,
        [s.scheduleId, s.id, s.examId, s.classId, s.subjectId],
      );

      // Admit Card Settings
      await client.query(
        `INSERT INTO exam_admit_card_settings (id, school_id, exam_id, available_from, available_until, fee_lock_mode, fee_lock_threshold_amount)
         VALUES (gen_random_uuid(), $1, $2, '2026-09-01 00:00:00+00', '2026-09-30 23:59:59+00', 'OFF', 0.00)
         ON CONFLICT (exam_id) DO NOTHING`,
        [s.id, s.examId],
      );

      // Report Card Setup
      const setupName = s.id === ISOLATION_IDS.schoolA.id ? "CBSE Term 1 Setup" : "ICSE Term 1 Setup";
      await client.query(
        `INSERT INTO report_card_setups (id, school_id, academic_year_id, name, exam_weightages, layout, is_active, created_by_id)
         VALUES ($1, $2, $3, $4, $5, '{}', true, $6)
         ON CONFLICT (id) DO NOTHING`,
        [s.setupId, s.id, s.academicYearId, setupName, JSON.stringify([{ examId: s.examId, weightPercent: 100 }]), s.adminUserId],
      );

      // Result Settings
      await client.query(
        `INSERT INTO result_settings (id, school_id, setup_id, withhold_all, release_at, fee_lock_mode, fee_lock_threshold_amount, public_lookup_enabled, public_toppers_enabled)
         VALUES ($1, $2, $3, false, '2026-09-26 00:00:00+00', 'OFF', 0.00, true, true)
         ON CONFLICT (setup_id) DO UPDATE SET withhold_all = false, public_lookup_enabled = true`,
        [s.resultSettingId, s.id, s.setupId],
      );

      // Result Snapshot
      const snapshotPayload = {
        student: {
          id: s.studentId,
          name: `${firstName} ${lastName}`,
          admissionNumber: s.admissionNumber,
          classId: s.classId,
        },
        summary: {
          totalMarks: 92,
          totalMax: 100,
          percentage: 92.0,
          overallGrade: "A1",
          resultStatus: "PASSED",
          rank: 1,
        },
        subjects: [
          {
            subjectName: subjName,
            totalMax: 100,
            totalObtained: 92,
            grade: "A1",
          },
        ],
      };

      await client.query(
        `INSERT INTO result_snapshots (id, school_id, setup_id, student_id, version, payload, frozen_at, frozen_by_id, is_current, published_at)
         VALUES ($1, $2, $3, $4, 1, $5, NOW(), $6, true, NOW())
         ON CONFLICT (setup_id, student_id, version) DO UPDATE SET is_current = true`,
        [s.snapshotId, s.id, s.setupId, s.studentId, JSON.stringify(snapshotPayload), s.adminUserId],
      );

      // Bulk Job
      await client.query(
        `INSERT INTO report_card_jobs (id, school_id, exam_id, class_id, setup_id, job_type, total_students, processed_count, failed_count, status, triggered_by_id)
         VALUES ($1, $2, $3, $4, $5, 'REPORT_CARD', 1, 1, 0, 'DONE', $6)
         ON CONFLICT (id) DO NOTHING`,
        [s.jobId, s.id, s.examId, s.classId, s.setupId, s.adminUserId],
      );
    }

    // ── 2. TEACHER ASSIGNMENTS ────────────────────────────────────────────────
    await client.query(
      `INSERT INTO roles (id, school_id, name, display_name, is_system_role)
       VALUES ($1, $2, 'TEACHER', 'Teacher', true)
       ON CONFLICT (id) DO NOTHING`,
      [ISOLATION_IDS.schoolA.teacherA1RoleId, ISOLATION_IDS.schoolA.id],
    );
    await client.query(
      `INSERT INTO roles (id, school_id, name, display_name, is_system_role)
       VALUES ($1, $2, 'TEACHER', 'Teacher', true)
       ON CONFLICT (id) DO NOTHING`,
      [ISOLATION_IDS.schoolB.teacherB1RoleId, ISOLATION_IDS.schoolB.id],
    );

    // Teacher A1
    await client.query(
      `INSERT INTO users (id, school_id, email, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (id) DO NOTHING`,
      [ISOLATION_IDS.schoolA.teacherA1UserId, ISOLATION_IDS.schoolA.id, ISOLATION_IDS.schoolA.teacherA1Email],
    );
    await client.query(
      `INSERT INTO user_roles (id, user_id, role_id, school_id)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [ISOLATION_IDS.schoolA.teacherA1UserId, ISOLATION_IDS.schoolA.teacherA1RoleId, ISOLATION_IDS.schoolA.id],
    );

    await client.query(
      `INSERT INTO class_subjects (id, school_id, class_id, subject_id, assigned_teacher_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [
        ISOLATION_IDS.schoolA.id,
        ISOLATION_IDS.schoolA.classId,
        ISOLATION_IDS.schoolA.subjectId,
        ISOLATION_IDS.schoolA.teacherA1UserId,
      ],
    );

    // Teacher A2
    await client.query(
      `INSERT INTO users (id, school_id, email, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (id) DO NOTHING`,
      [ISOLATION_IDS.schoolA.teacherA2UserId, ISOLATION_IDS.schoolA.id, ISOLATION_IDS.schoolA.teacherA2Email],
    );
    await client.query(
      `INSERT INTO user_roles (id, user_id, role_id, school_id)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [ISOLATION_IDS.schoolA.teacherA2UserId, ISOLATION_IDS.schoolA.teacherA1RoleId, ISOLATION_IDS.schoolA.id],
    );

    // Teacher B1
    await client.query(
      `INSERT INTO users (id, school_id, email, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (id) DO NOTHING`,
      [ISOLATION_IDS.schoolB.teacherB1UserId, ISOLATION_IDS.schoolB.id, ISOLATION_IDS.schoolB.teacherB1Email],
    );
    await client.query(
      `INSERT INTO user_roles (id, user_id, role_id, school_id)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [ISOLATION_IDS.schoolB.teacherB1UserId, ISOLATION_IDS.schoolB.teacherB1RoleId, ISOLATION_IDS.schoolB.id],
    );

    await client.query(
      `INSERT INTO class_subjects (id, school_id, class_id, subject_id, assigned_teacher_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [
        ISOLATION_IDS.schoolB.id,
        ISOLATION_IDS.schoolB.classId,
        ISOLATION_IDS.schoolB.subjectId,
        ISOLATION_IDS.schoolB.teacherB1UserId,
      ],
    );

    console.log("✅ [SeedIsolation] Successfully seeded Schools A and B with all isolation test fixtures.");
  } finally {
    client.release();
    await pool.end();
  }
}
