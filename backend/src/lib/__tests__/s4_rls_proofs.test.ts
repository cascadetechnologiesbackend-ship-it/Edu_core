import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import crypto from "crypto";

/**
 * S4-T1 / S5-T3: Live Postgres RLS Runtime Proof Suite
 *
 * Replaces text/regex matching with empirical behavioral tests running live against PostgreSQL.
 * Verified with the non-owner role `schoolmitra_app` / `schoolmitra_app_login`.
 *
 * Verifies:
 * 1. Unset tenant context = 0 rows returned (fail-closed under FORCE RLS).
 * 2. School A context returns School A records, but strictly denies School B records.
 * 3. SYSTEM_AUTH role allows reading users by email before session exists.
 * 4. SYSTEM_AUTH role strictly fails on writes under WITH CHECK (cannot forge writes).
 * 5. Marking attendance within withTenant(schoolA) succeeds.
 * 6. Marking attendance without tenant context fails with Postgres RLS violation error.
 */

const migrationDbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

const appDbUrl =
  process.env.APP_DATABASE_URL ||
  (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("schoolmitra_app_login")
    ? process.env.DATABASE_URL
    : migrationDbUrl.replace(/\/\/[^:]+:[^@]+@/, "//schoolmitra_app_login:schoolmitra_app_secure@"));

describe("Live Postgres RLS Runtime Closure (Non-Owner Role)", () => {
  let pool: Pool;
  const schoolAId = crypto.randomUUID();
  const schoolBId = crypto.randomUUID();
  const studentAId = crypto.randomUUID();
  const studentBId = crypto.randomUUID();
  const academicYearAId = crypto.randomUUID();
  const academicYearBId = crypto.randomUUID();
  const sectionAId = crypto.randomUUID();
  const teacherUserId = crypto.randomUUID();

  beforeAll(async () => {
    // Setup test pool (owner connection for seeding test fixtures)
    const adminPool = new Pool({ connectionString: migrationDbUrl });
    const adminClient = await adminPool.connect();

    try {
      // 1. Ensure schoolmitra_app and schoolmitra_app_login roles exist
      await adminClient.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'schoolmitra_app') THEN
            CREATE ROLE schoolmitra_app NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'schoolmitra_app_login') THEN
            CREATE ROLE schoolmitra_app_login WITH LOGIN PASSWORD 'schoolmitra_app_secure' IN ROLE schoolmitra_app;
          ELSE
            GRANT schoolmitra_app TO schoolmitra_app_login;
          END IF;
        END;
        $$;
        GRANT USAGE ON SCHEMA public TO schoolmitra_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO schoolmitra_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO schoolmitra_app;
      `);

      // 2. Seed test fixtures as owner (bypass RLS for seeding)
      await adminClient.query(
        `INSERT INTO schools (id, name, slug, udise_code, board, address, city, state, pincode, phone, email, principal_name, established_year, is_active)
         VALUES ($1, 'RLS Test School A', $2, $3, 'CBSE', '123 St', 'City', 'State', '123456', '9999999999', 'a@test.com', 'Principal A', 2020, true)
         ON CONFLICT (id) DO NOTHING`,
        [schoolAId, `rls-a-${Date.now()}`, `UDA${Date.now().toString().slice(-8)}`],
      );

      await adminClient.query(
        `INSERT INTO schools (id, name, slug, udise_code, board, address, city, state, pincode, phone, email, principal_name, established_year, is_active)
         VALUES ($1, 'RLS Test School B', $2, $3, 'CBSE', '456 St', 'City', 'State', '123456', '8888888888', 'b@test.com', 'Principal B', 2020, true)
         ON CONFLICT (id) DO NOTHING`,
        [schoolBId, `rls-b-${Date.now()}`, `UDB${Date.now().toString().slice(-8)}`],
      );

      await adminClient.query(
        `INSERT INTO academic_years (id, school_id, label, start_date, end_date, is_active)
         VALUES ($1, $2, '2026-2027', '2026-04-01', '2027-03-31', true)
         ON CONFLICT (id) DO NOTHING`,
        [academicYearAId, schoolAId],
      );

      await adminClient.query(
        `INSERT INTO academic_years (id, school_id, label, start_date, end_date, is_active)
         VALUES ($1, $2, '2026-2027', '2026-04-01', '2027-03-31', true)
         ON CONFLICT (id) DO NOTHING`,
        [academicYearBId, schoolBId],
      );

      const classAId = crypto.randomUUID();
      await adminClient.query(
        `INSERT INTO classes (id, school_id, academic_year_id, grade_level, display_name, sort_order, is_active)
         VALUES ($1, $2, $3, 'CLASS_1', 'Class 1', 1, true)
         ON CONFLICT (id) DO NOTHING`,
        [classAId, schoolAId, academicYearAId],
      );

      await adminClient.query(
        `INSERT INTO sections (id, school_id, class_id, name, room_number, capacity, is_active)
         VALUES ($1, $2, $3, 'A', '101', 30, true)
         ON CONFLICT (id) DO NOTHING`,
        [sectionAId, schoolAId, classAId],
      );

      await adminClient.query(
        `INSERT INTO students (id, school_id, academic_year_id, admission_number, first_name_encrypted, last_name_encrypted, date_of_birth, gender, category, admission_date, is_active)
         VALUES ($1, $2, $3, 'ADM-A-01', 'enc_a', 'enc_a', '2015-01-01', 'MALE', 'GENERAL', '2026-04-01', true)
         ON CONFLICT (id) DO NOTHING`,
        [studentAId, schoolAId, academicYearAId],
      );

      await adminClient.query(
        `INSERT INTO students (id, school_id, academic_year_id, admission_number, first_name_encrypted, last_name_encrypted, date_of_birth, gender, category, admission_date, is_active)
         VALUES ($1, $2, $3, 'ADM-B-01', 'enc_b', 'enc_b', '2015-01-01', 'MALE', 'GENERAL', '2026-04-01', true)
         ON CONFLICT (id) DO NOTHING`,
        [studentBId, schoolBId, academicYearBId],
      );

      await adminClient.query(
        `INSERT INTO users (id, school_id, email, password_hash, is_active)
         VALUES ($1, $2, $3, 'hash123', true)
         ON CONFLICT (id) DO NOTHING`,
        [teacherUserId, schoolAId, `teacher-${Date.now()}@test.com`],
      );
    } finally {
      adminClient.release();
      await adminPool.end();
    }

    // Connect test suite as non-owner role schoolmitra_app_login
    pool = new Pool({
      connectionString: appDbUrl,
    });

    // Belt-and-suspenders: ensure SET ROLE schoolmitra_app is applied
    pool.on("connect", (client) => {
      client.query("SET ROLE schoolmitra_app").catch(() => {});
    });
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  // ── 1. Unset context fail-closed proof ─────────────────────────────────────
  it("unset tenant context returns 0 rows (fail-closed under FORCE RLS)", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Explicitly ensure app.current_school_id is empty
      await client.query("SELECT set_config('app.current_school_id', '', true)");
      await client.query("SELECT set_config('app.current_role', '', true)");

      const res = await client.query("SELECT count(*) as cnt FROM students WHERE id = $1", [
        studentAId,
      ]);
      expect(Number(res.rows[0].cnt)).toBe(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  // ── 2. Cross-tenant denial proof ───────────────────────────────────────────
  it("school A context allows reading school A rows, but strictly denies school B rows", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_school_id', $1, true)", [schoolAId]);

      // School A student is visible
      const visibleRes = await client.query(
        "SELECT count(*) as cnt FROM students WHERE id = $1",
        [studentAId],
      );
      expect(Number(visibleRes.rows[0].cnt)).toBe(1);

      // School B student is invisible (filtered out by RLS)
      const invisibleRes = await client.query(
        "SELECT count(*) as cnt FROM students WHERE id = $1",
        [studentBId],
      );
      expect(Number(invisibleRes.rows[0].cnt)).toBe(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  // ── 3. SYSTEM_AUTH pre-session lookup proof ────────────────────────────────
  it("SYSTEM_AUTH allows reading users table before session exists", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_role', 'SYSTEM_AUTH', true)");
      await client.query("SELECT set_config('app.current_school_id', '', true)");

      const res = await client.query("SELECT count(*) as cnt FROM users WHERE id = $1", [
        teacherUserId,
      ]);
      expect(Number(res.rows[0].cnt)).toBe(1);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  // ── 4. SYSTEM_AUTH fails all writes WITH CHECK proof ───────────────────────
  it("writes under SYSTEM_AUTH strictly fail WITH CHECK (cannot forge tenant writes)", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_role', 'SYSTEM_AUTH', true)");
      await client.query("SELECT set_config('app.current_school_id', '', true)");

      // Attempting to insert a user without a valid tenant context must violate RLS WITH CHECK
      let errorThrown: any = null;
      try {
        await client.query(
          `INSERT INTO users (id, school_id, email, password_hash, is_active)
           VALUES ($1, $2, 'forged@test.com', 'hash', true)`,
          [crypto.randomUUID(), schoolAId],
        );
      } catch (err) {
        errorThrown = err;
      }

      expect(errorThrown).not.toBeNull();
      expect(errorThrown.message).toMatch(/new row violates row-level security policy/i);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  // ── 5. Teacher attendance within withTenant(schoolA) succeeds ─────────────
  it("marking attendance within withTenant(schoolA) context succeeds", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_school_id', $1, true)", [schoolAId]);

      const attendanceId = crypto.randomUUID();
      const insertRes = await client.query(
        `INSERT INTO student_attendance (id, school_id, student_id, section_id, academic_year_id, attendance_date, status, marked_by_id)
         VALUES ($1, $2, $3, $4, $5, '2026-10-12 09:00:00+00', 'PRESENT', $6)
         RETURNING id`,
        [attendanceId, schoolAId, studentAId, sectionAId, academicYearAId, teacherUserId],
      );

      expect(insertRes.rows[0].id).toBe(attendanceId);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  // ── 6. Marking attendance without tenant context fails with RLS error ─────
  it("marking attendance without tenant context fails with RLS policy violation", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Explicitly clear tenant context
      await client.query("SELECT set_config('app.current_school_id', '', true)");
      await client.query("SELECT set_config('app.current_role', '', true)");

      let errorThrown: any = null;
      try {
        await client.query(
          `INSERT INTO student_attendance (id, school_id, student_id, section_id, academic_year_id, attendance_date, status, marked_by_id)
           VALUES ($1, $2, $3, $4, $5, '2026-10-12 09:00:00+00', 'PRESENT', $6)`,
          [crypto.randomUUID(), schoolAId, studentAId, sectionAId, academicYearAId, teacherUserId],
        );
      } catch (err) {
        errorThrown = err;
      }

      expect(errorThrown).not.toBeNull();
      expect(errorThrown.message).toMatch(
        /new row violates row-level security policy for table "student_attendance"/i,
      );
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  // ── 7. PLATFORM_ADMIN read arm allows reading cross-tenant data ───────────
  it("PLATFORM_ADMIN role allows reading students across all schools (super-admin view)", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Set platform role context, clear tenant school
      await client.query("SELECT set_config('app.current_school_id', '', true)");
      await client.query("SELECT set_config('app.current_role', 'PLATFORM_ADMIN', true)");

      const res = await client.query(
        "SELECT id, school_id FROM students WHERE id IN ($1, $2)",
        [studentAId, studentBId],
      );

      // PLATFORM_ADMIN sees rows from both School A and School B
      expect(res.rows).toHaveLength(2);
      const returnedIds = res.rows.map((r: any) => r.id);
      expect(returnedIds).toContain(studentAId);
      expect(returnedIds).toContain(studentBId);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  // ── 8. PLATFORM_ADMIN strictly denies writes without tenant context ────────
  it("PLATFORM_ADMIN role strictly denies writes outside withTenant context", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_school_id', '', true)");
      await client.query("SELECT set_config('app.current_role', 'PLATFORM_ADMIN', true)");

      let writeError: any = null;
      try {
        await client.query(
          `INSERT INTO student_attendance (id, school_id, student_id, section_id, academic_year_id, attendance_date, status, marked_by_id)
           VALUES ($1, $2, $3, $4, $5, '2026-10-12 09:00:00+00', 'PRESENT', $6)`,
          [crypto.randomUUID(), schoolAId, studentAId, sectionAId, academicYearAId, teacherUserId],
        );
      } catch (err) {
        writeError = err;
      }

      expect(writeError).not.toBeNull();
      expect(writeError.message).toMatch(
        /new row violates row-level security policy for table "student_attendance"/i,
      );
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  // ── 9. Impersonated super admin runs within withTenant and succeeds ────────
  it("super admin impersonating School A succeeds with attendance mark in School A", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Impersonated context: sets tenant school A
      await client.query("SELECT set_config('app.current_school_id', $1, true)", [schoolAId]);

      const attendanceId = crypto.randomUUID();
      const insertRes = await client.query(
        `INSERT INTO student_attendance (id, school_id, student_id, section_id, academic_year_id, attendance_date, status, marked_by_id)
         VALUES ($1, $2, $3, $4, $5, '2026-10-12 09:00:00+00', 'PRESENT', $6)
         RETURNING id`,
        [attendanceId, schoolAId, studentAId, sectionAId, academicYearAId, teacherUserId],
      );

      expect(insertRes.rows[0].id).toBe(attendanceId);

      // Verify cross-tenant write into School B under impersonation of School A is DENIED
      let crossTenantError: any = null;
      try {
        await client.query(
          `INSERT INTO student_attendance (id, school_id, student_id, section_id, academic_year_id, attendance_date, status, marked_by_id)
           VALUES ($1, $2, $3, $4, $5, '2026-10-12 09:00:00+00', 'PRESENT', $6)`,
          [crypto.randomUUID(), schoolBId, studentBId, sectionAId, academicYearBId, teacherUserId],
        );
      } catch (err) {
        crossTenantError = err;
      }

      expect(crossTenantError).not.toBeNull();
      expect(crossTenantError.message).toMatch(
        /new row violates row-level security policy for table "student_attendance"/i,
      );
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  // ── 10. S7-T0 Proof: PLATFORM_ADMIN strictly denies DELETE on foreign-school rows ──
  it("S7-T0: PLATFORM_ADMIN role can SELECT cross-tenant rows but strictly affects 0 rows on DELETE", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_school_id', '', true)");
      await client.query("SELECT set_config('app.current_role', 'PLATFORM_ADMIN', true)");

      // (a) SELECT across tenants returns rows
      const selectRes = await client.query(
        "SELECT id, school_id FROM students WHERE id = $1",
        [studentAId],
      );
      expect(selectRes.rows).toHaveLength(1);
      expect(selectRes.rows[0].id).toBe(studentAId);

      // (b) DELETE on student row in School A affects 0 rows under PLATFORM_ADMIN context
      const deleteRes = await client.query(
        "DELETE FROM students WHERE id = $1",
        [studentAId],
      );
      expect(deleteRes.rowCount).toBe(0);

      // Verify row still exists in database
      const verifyRes = await client.query(
        "SELECT id FROM students WHERE id = $1",
        [studentAId],
      );
      expect(verifyRes.rows).toHaveLength(1);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  // ── 11. S7-T0 Proof: PLATFORM_ADMIN strictly denies UPDATE on foreign-school rows ──
  it("S7-T0: PLATFORM_ADMIN role strictly affects 0 rows on UPDATE of tenant rows", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_school_id', '', true)");
      await client.query("SELECT set_config('app.current_role', 'PLATFORM_ADMIN', true)");

      const updateRes = await client.query(
        "UPDATE students SET category = 'OBC' WHERE id = $1",
        [studentAId],
      );
      expect(updateRes.rowCount).toBe(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  // ── 12. S7-T0 Proof: SYSTEM_AUTH strictly denies DELETE on users table ───────
  it("S7-T0: SYSTEM_AUTH role can read users but strictly affects 0 rows on DELETE", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_school_id', '', true)");
      await client.query("SELECT set_config('app.current_role', 'SYSTEM_AUTH', true)");

      // Verify SELECT works
      const selectRes = await client.query(
        "SELECT id, email FROM users WHERE id = $1",
        [teacherUserId],
      );
      expect(selectRes.rows).toHaveLength(1);

      // Verify DELETE affects 0 rows
      const deleteRes = await client.query(
        "DELETE FROM users WHERE id = $1",
        [teacherUserId],
      );
      expect(deleteRes.rowCount).toBe(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  // ── 13. S7-T0 Proof: SYSTEM_AUTH strictly denies UPDATE on users table ───────
  it("S7-T0: SYSTEM_AUTH role strictly affects 0 rows on UPDATE of users", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_school_id', '', true)");
      await client.query("SELECT set_config('app.current_role', 'SYSTEM_AUTH', true)");

      const updateRes = await client.query(
        "UPDATE users SET email = 'hacked@example.com' WHERE id = $1",
        [teacherUserId],
      );
      expect(updateRes.rowCount).toBe(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  // ── 14. S7-T0 Proof: Tenant-scoped session succeeds on UPDATE and DELETE of tenant rows ──
  it("S7-T0: withTenant(schoolA) successfully executes UPDATE and DELETE on School A rows", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_school_id', $1, true)", [schoolAId]);

      // Seed a transient attendance row in School A
      const tempAttendanceId = crypto.randomUUID();
      await client.query(
        `INSERT INTO student_attendance (id, school_id, student_id, section_id, academic_year_id, attendance_date, status, marked_by_id)
         VALUES ($1, $2, $3, $4, $5, '2026-10-12 10:00:00+00', 'ABSENT', $6)`,
        [tempAttendanceId, schoolAId, studentAId, sectionAId, academicYearAId, teacherUserId],
      );

      // UPDATE on School A row succeeds
      const updateRes = await client.query(
        "UPDATE student_attendance SET status = 'PRESENT' WHERE id = $1",
        [tempAttendanceId],
      );
      expect(updateRes.rowCount).toBe(1);

      // DELETE on School A row succeeds
      const deleteRes = await client.query(
        "DELETE FROM student_attendance WHERE id = $1",
        [tempAttendanceId],
      );
      expect(deleteRes.rowCount).toBe(1);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  // ── 15. S7-T0 Proof: Tenant-scoped session strictly affects 0 rows on foreign School B rows ──
  it("S7-T0: withTenant(schoolA) strictly affects 0 rows on UPDATE and DELETE of School B rows", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_school_id', $1, true)", [schoolAId]);

      // UPDATE on School B student row affects 0 rows
      const updateRes = await client.query(
        "UPDATE students SET category = 'OBC' WHERE id = $1",
        [studentBId],
      );
      expect(updateRes.rowCount).toBe(0);

      // DELETE on School B student row affects 0 rows
      const deleteRes = await client.query(
        "DELETE FROM students WHERE id = $1",
        [studentBId],
      );
      expect(deleteRes.rowCount).toBe(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});
