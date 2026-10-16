/**
 * S13 Layer 3 One-Time Mandatory Subject Enrollment Backfill Script
 *
 * Scans all schools in the database, executes the mandatory subject backfill,
 * and reports before/after counts of active students with zero subject enrollments.
 */

import { Pool } from "pg";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

async function run() {
  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();

  try {
    console.log("=== S13 Mandatory Subject Enrollment Backfill ===");

    // Fetch all schools
    const schoolsRes = await client.query(`SELECT id, name, slug FROM schools ORDER BY name`);
    console.log(`Found ${schoolsRes.rows.length} schools.`);

    const report: Array<{
      schoolId: string;
      name: string;
      activeStudents: number;
      beforeZeroEnrollments: number;
      insertedEnrollments: number;
      afterZeroEnrollments: number;
    }> = [];

    for (const school of schoolsRes.rows) {
      await client.query(`SELECT set_config('app.current_school_id', $1, true)`, [school.id]);

      // Count active students in school
      const totalActiveRes = await client.query(
        `SELECT COUNT(*) as cnt FROM students WHERE school_id = $1 AND deleted_at IS NULL AND is_active = true`,
        [school.id],
      );
      const activeStudents = parseInt(totalActiveRes.rows[0].cnt, 10);

      // Count active students with zero active enrollments before
      const beforeRes = await client.query(
        `SELECT COUNT(*) as cnt
         FROM students s
         WHERE s.school_id = $1
           AND s.deleted_at IS NULL
           AND s.is_active = true
           AND s.current_class_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM student_subject_enrollments sse
             WHERE sse.student_id = s.id
               AND sse.school_id = s.school_id
               AND sse.enrollment_status = 'ACTIVE'
           )`,
        [school.id],
      );
      const beforeZero = parseInt(beforeRes.rows[0].cnt, 10);

      // Execute backfill
      const insertRes = await client.query(
        `INSERT INTO student_subject_enrollments (
           id, school_id, student_id, class_subject_id, is_elective_taken, enrollment_status, enrolled_at, updated_at
         )
         SELECT
           gen_random_uuid(),
           s.school_id,
           s.id AS student_id,
           cs.id AS class_subject_id,
           true,
           'ACTIVE'::enrollment_status_enum,
           now(),
           now()
         FROM students s
         JOIN class_subjects cs ON cs.class_id = s.current_class_id AND cs.school_id = s.school_id
         WHERE s.school_id = $1
           AND s.deleted_at IS NULL
           AND s.is_active = true
           AND s.current_class_id IS NOT NULL
           AND cs.is_elective = false
         ON CONFLICT (student_id, class_subject_id) DO NOTHING`,
        [school.id],
      );
      const insertedCount = insertRes.rowCount || 0;

      // Count active students with zero active enrollments after
      const afterRes = await client.query(
        `SELECT COUNT(*) as cnt
         FROM students s
         WHERE s.school_id = $1
           AND s.deleted_at IS NULL
           AND s.is_active = true
           AND s.current_class_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM student_subject_enrollments sse
             WHERE sse.student_id = s.id
               AND sse.school_id = s.school_id
               AND sse.enrollment_status = 'ACTIVE'
           )`,
        [school.id],
      );
      const afterZero = parseInt(afterRes.rows[0].cnt, 10);

      report.push({
        schoolId: school.id,
        name: school.name,
        activeStudents,
        beforeZeroEnrollments: beforeZero,
        insertedEnrollments: insertedCount,
        afterZeroEnrollments: afterZero,
      });
    }

    console.table(report);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
