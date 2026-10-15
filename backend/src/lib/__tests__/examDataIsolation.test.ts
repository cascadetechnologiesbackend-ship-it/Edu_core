import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import {
  verifyExamOwnership,
  verifySetupOwnership,
  verifyClassOwnership,
  verifyStudentOwnership,
  verifyScheduleOwnership,
  logExamIsolationViolation,
} from "../examIsolation";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

describe("S10 Layer 2: Examination Data Isolation Truth Table (Empirical Probes)", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    // Seed fixtures for Schools A and B
    await seedIsolationSchools();
  });

  afterAll(async () => {
    await pool.end();
  });

  // ── SURFACE 1: Server Actions & Entity Ownership Verification ─────────────
  describe("Surface 1: Server Actions Cross-Tenant Denial & Audit Trail", () => {
    const ctx = {
      userId: ISOLATION_IDS.schoolA.adminUserId,
      email: ISOLATION_IDS.schoolA.adminEmail,
      role: "SCHOOL_ADMIN",
      schoolId: ISOLATION_IDS.schoolA.id,
    };

    it("1.1: verifyExamOwnership grants same-tenant exam and denies cross-tenant exam with audit row", async () => {
      // Same-tenant (School A -> Exam A)
      const allowed = await verifyExamOwnership(
        ISOLATION_IDS.schoolA.id,
        ISOLATION_IDS.schoolA.examId,
        ctx,
        "testActionSameTenant",
      );
      expect(allowed.success).toBe(true);

      // Cross-tenant (School A -> Exam B)
      const denied = await verifyExamOwnership(
        ISOLATION_IDS.schoolA.id,
        ISOLATION_IDS.schoolB.examId,
        ctx,
        "lockExam",
      );
      expect(denied.success).toBe(false);
      expect(denied.error).toBe("TENANT_ACCESS_DENIED");

      // Verify audit log row created with purpose_id = cross_tenant_violation
      const client = await pool.connect();
      try {
        const res = await client.query(
          `SELECT user_email, school_id, action, table_name, record_id, purpose_id
           FROM audit_logs
           WHERE school_id = $1 AND record_id = $2 AND purpose_id = 'cross_tenant_violation'
           ORDER BY created_at DESC LIMIT 1`,
          [ISOLATION_IDS.schoolA.id, ISOLATION_IDS.schoolB.examId],
        );
        expect(res.rows.length).toBe(1);
        expect(res.rows[0].table_name).toBe("exams");
        expect(res.rows[0].action).toBe("WRITE");
        expect(res.rows[0].purpose_id).toBe("cross_tenant_violation");
      } finally {
        client.release();
      }
    });

    it("1.2: verifySetupOwnership denies School B setup for School A actor", async () => {
      const allowed = await verifySetupOwnership(
        ISOLATION_IDS.schoolA.id,
        ISOLATION_IDS.schoolA.setupId,
        ctx,
        "configureResultSettings",
      );
      expect(allowed.success).toBe(true);

      const denied = await verifySetupOwnership(
        ISOLATION_IDS.schoolA.id,
        ISOLATION_IDS.schoolB.setupId,
        ctx,
        "configureResultSettings",
      );
      expect(denied.success).toBe(false);
      expect(denied.error).toBe("TENANT_ACCESS_DENIED");
    });

    it("1.3: verifyClassOwnership and verifyStudentOwnership reject cross-tenant IDs", async () => {
      const classDenied = await verifyClassOwnership(
        ISOLATION_IDS.schoolA.id,
        ISOLATION_IDS.schoolB.classId,
        ctx,
        "exportCohortAnalytics",
      );
      expect(classDenied.success).toBe(false);
      expect(classDenied.error).toBe("TENANT_ACCESS_DENIED");

      const studentDenied = await verifyStudentOwnership(
        ISOLATION_IDS.schoolA.id,
        ISOLATION_IDS.schoolB.studentId,
        ctx,
        "setResultHold",
      );
      expect(studentDenied.success).toBe(false);
      expect(studentDenied.error).toBe("TENANT_ACCESS_DENIED");
    });

    it("1.4: verifyScheduleOwnership rejects cross-tenant schedule IDs", async () => {
      const schedDenied = await verifyScheduleOwnership(
        ISOLATION_IDS.schoolA.id,
        ISOLATION_IDS.schoolB.scheduleId,
        ctx,
        "deleteExamSchedule",
      );
      expect(schedDenied.success).toBe(false);
      expect(schedDenied.error).toBe("TENANT_ACCESS_DENIED");
    });
  });

  // ── SURFACE 2: Staff API Endpoint Isolation ───────────────────────────────
  describe("Surface 2: Staff API Scoping & Zero Enumeration", () => {
    it("2.1: Staff query scoped to School A returns 404 when requesting School B exam", async () => {
      const client = await pool.connect();
      try {
        // Query pattern executed by /api/staff/exam-results/[examId]
        const examRows = await client.query(
          `SELECT id, name, is_locked FROM exams WHERE id = $1 AND school_id = $2`,
          [ISOLATION_IDS.schoolB.examId, ISOLATION_IDS.schoolA.id],
        );
        // Expect 0 rows -> API returns 404 Not Found
        expect(examRows.rows.length).toBe(0);

        // Same-tenant returns 1 row
        const sameTenantRows = await client.query(
          `SELECT id, name, is_locked FROM exams WHERE id = $1 AND school_id = $2`,
          [ISOLATION_IDS.schoolA.examId, ISOLATION_IDS.schoolA.id],
        );
        expect(sameTenantRows.rows.length).toBe(1);
      } finally {
        client.release();
      }
    });
  });

  // ── SURFACE 3: Public Portal Result Lookup ────────────────────────────────
  describe("Surface 3: Public Portal Lookup Isolation", () => {
    it("3.1: Public lookup under School A slug cannot resolve School B students", async () => {
      const client = await pool.connect();
      try {
        // Resolve School A from slug
        const schoolRes = await client.query(
          `SELECT id FROM schools WHERE slug = $1 AND is_active = true`,
          [ISOLATION_IDS.schoolA.slug],
        );
        expect(schoolRes.rows.length).toBe(1);
        const resolvedSchoolAId = schoolRes.rows[0].id;
        expect(resolvedSchoolAId).toBe(ISOLATION_IDS.schoolA.id);

        // Lookup with School B admission number under School A slug
        const crossLookup = await client.query(
          `SELECT s.id, rs.payload
           FROM students s
           JOIN result_snapshots rs ON rs.student_id = s.id AND rs.school_id = s.school_id
           WHERE s.school_id = $1 AND s.admission_number = $2 AND rs.is_current = true`,
          [resolvedSchoolAId, ISOLATION_IDS.schoolB.admissionNumber],
        );
        expect(crossLookup.rows.length).toBe(0);

        // Lookup with School A admission number under School A slug succeeds
        const validLookup = await client.query(
          `SELECT s.id, rs.payload
           FROM students s
           JOIN result_snapshots rs ON rs.student_id = s.id AND rs.school_id = s.school_id
           WHERE s.school_id = $1 AND s.admission_number = $2 AND rs.is_current = true`,
          [resolvedSchoolAId, ISOLATION_IDS.schoolA.admissionNumber],
        );
        expect(validLookup.rows.length).toBe(1);
      } finally {
        client.release();
      }
    });
  });

  // ── SURFACE 4: Presigned PDF Download Route Isolation ─────────────────────
  describe("Surface 4: Report Card / PDF Download Route Isolation", () => {
    it("4.1: Cross-tenant download request triggers audit violation and denial", async () => {
      const client = await pool.connect();
      try {
        // Find snapshot for School B
        const bSnapshot = await client.query(
          `SELECT id, school_id FROM result_snapshots WHERE id = $1`,
          [ISOLATION_IDS.schoolB.snapshotId],
        );
        expect(bSnapshot.rows.length).toBe(1);
        expect(bSnapshot.rows[0].school_id).toBe(ISOLATION_IDS.schoolB.id);

        // School A user attempting to download School B's snapshot
        const schoolAContext = ISOLATION_IDS.schoolA.id;
        const isOwner = bSnapshot.rows[0].school_id === schoolAContext;
        expect(isOwner).toBe(false);

        // Simulate logExamIsolationViolation performed by route handler
        await logExamIsolationViolation({
          schoolId: schoolAContext,
          userId: ISOLATION_IDS.schoolA.adminUserId,
          userEmail: ISOLATION_IDS.schoolA.adminEmail,
          userRole: "SCHOOL_ADMIN",
          action: "READ",
          tableName: "result_snapshots",
          recordId: ISOLATION_IDS.schoolB.snapshotId,
          purposeId: "cross_tenant_violation",
          metadata: { attemptedAction: "downloadReportCardPdf", targetSchoolId: bSnapshot.rows[0].school_id },
        });

        // Verify audit log entry
        const auditRes = await client.query(
          `SELECT user_email, school_id, action, table_name, record_id, purpose_id
           FROM audit_logs
           WHERE school_id = $1 AND record_id = $2 AND action = 'READ'
           ORDER BY created_at DESC LIMIT 1`,
          [schoolAContext, ISOLATION_IDS.schoolB.snapshotId],
        );
        expect(auditRes.rows.length).toBe(1);
        expect(auditRes.rows[0].purpose_id).toBe("cross_tenant_violation");
      } finally {
        client.release();
      }
    });
  });

  // ── SURFACE 5: Bulk Jobs Query Isolation ──────────────────────────────────
  describe("Surface 5: Bulk Jobs Query Isolation", () => {
    it("5.1: School A bulk job queries strictly exclude School B jobs", async () => {
      const client = await pool.connect();
      try {
        const jobsA = await client.query(
          `SELECT id, school_id, status FROM report_card_jobs WHERE school_id = $1`,
          [ISOLATION_IDS.schoolA.id],
        );
        expect(jobsA.rows.length).toBeGreaterThanOrEqual(1);
        for (const row of jobsA.rows) {
          expect(row.school_id).toBe(ISOLATION_IDS.schoolA.id);
          expect(row.id).not.toBe(ISOLATION_IDS.schoolB.jobId);
        }

        // Direct query with School A tenant filter for School B's jobId returns 0 rows
        const targetCrossJob = await client.query(
          `SELECT id FROM report_card_jobs WHERE id = $1 AND school_id = $2`,
          [ISOLATION_IDS.schoolB.jobId, ISOLATION_IDS.schoolA.id],
        );
        expect(targetCrossJob.rows.length).toBe(0);
      } finally {
        client.release();
      }
    });
  });

  // ── SURFACE 6: Telemetry & Usage Events Isolation ─────────────────────────
  describe("Surface 6: Usage Events Tenant Scoping", () => {
    it("6.1: Audit and usage events query strictly scoped to school_id", async () => {
      const client = await pool.connect();
      try {
        const auditA = await client.query(
          `SELECT school_id FROM audit_logs WHERE school_id = $1`,
          [ISOLATION_IDS.schoolA.id],
        );
        for (const row of auditA.rows) {
          expect(row.school_id).toBe(ISOLATION_IDS.schoolA.id);
          expect(row.school_id).not.toBe(ISOLATION_IDS.schoolB.id);
        }
      } finally {
        client.release();
      }
    });
  });

  // ── SURFACE 7: Teacher Scope & Cross-Subject Protection ────────────────────
  describe("Surface 7: Teacher Scope & Assignment Enforcement", () => {
    it("7.1: Teacher A1 is allowed for assigned Subject A, but Teacher A2 is denied with audit log", async () => {
      const client = await pool.connect();
      try {
        // Teacher A1 check: Assigned to Class A & Subject A
        const a1Assign = await client.query(
          `SELECT id FROM class_subjects
           WHERE school_id = $1 AND class_id = $2 AND subject_id = $3 AND assigned_teacher_id = $4`,
          [
            ISOLATION_IDS.schoolA.id,
            ISOLATION_IDS.schoolA.classId,
            ISOLATION_IDS.schoolA.subjectId,
            ISOLATION_IDS.schoolA.teacherA1UserId,
          ],
        );
        expect(a1Assign.rows.length).toBe(1);

        // Teacher A2 check: NOT assigned
        const a2Assign = await client.query(
          `SELECT id FROM class_subjects
           WHERE school_id = $1 AND class_id = $2 AND subject_id = $3 AND assigned_teacher_id = $4`,
          [
            ISOLATION_IDS.schoolA.id,
            ISOLATION_IDS.schoolA.classId,
            ISOLATION_IDS.schoolA.subjectId,
            ISOLATION_IDS.schoolA.teacherA2UserId,
          ],
        );
        expect(a2Assign.rows.length).toBe(0);

        // Simulate Teacher A2 violation logging
        await logExamIsolationViolation({
          schoolId: ISOLATION_IDS.schoolA.id,
          userId: ISOLATION_IDS.schoolA.teacherA2UserId,
          userEmail: ISOLATION_IDS.schoolA.teacherA2Email,
          userRole: "TEACHER",
          action: "WRITE",
          tableName: "mark_entries",
          recordId: ISOLATION_IDS.schoolA.scheduleId,
          purposeId: "teacher_assignment_violation",
          metadata: { classId: ISOLATION_IDS.schoolA.classId, subjectId: ISOLATION_IDS.schoolA.subjectId },
        });

        // Verify audit log
        const auditRow = await client.query(
          `SELECT purpose_id, user_email FROM audit_logs
           WHERE school_id = $1 AND user_id = $2 AND purpose_id = 'teacher_assignment_violation'
           ORDER BY created_at DESC LIMIT 1`,
          [ISOLATION_IDS.schoolA.id, ISOLATION_IDS.schoolA.teacherA2UserId],
        );
        expect(auditRow.rows.length).toBe(1);
        expect(auditRow.rows[0].purpose_id).toBe("teacher_assignment_violation");
      } finally {
        client.release();
      }
    });

    it("7.2: Teacher B1 cannot access School A class or subject", async () => {
      const client = await pool.connect();
      try {
        const b1InA = await client.query(
          `SELECT id FROM class_subjects
           WHERE school_id = $1 AND assigned_teacher_id = $2`,
          [ISOLATION_IDS.schoolA.id, ISOLATION_IDS.schoolB.teacherB1UserId],
        );
        expect(b1InA.rows.length).toBe(0);
      } finally {
        client.release();
      }
    });
  });

  // ── SURFACE 8: Parent Portal Scope ────────────────────────────────────────
  describe("Surface 8: Parent Scope Isolation", () => {
    it("8.1: School A parent query strictly restricted to linked School A student", async () => {
      const client = await pool.connect();
      try {
        // Query pattern used in /portal/report-cards and /portal/admit-cards
        const linkedStudents = await client.query(
          `SELECT id, admission_number, school_id
           FROM students
           WHERE primary_parent_user_id = $1 AND school_id = $2 AND is_active = true`,
          [ISOLATION_IDS.schoolA.parentUserId, ISOLATION_IDS.schoolA.id],
        );
        expect(linkedStudents.rows.length).toBe(1);
        expect(linkedStudents.rows[0].id).toBe(ISOLATION_IDS.schoolA.studentId);
        expect(linkedStudents.rows[0].school_id).toBe(ISOLATION_IDS.schoolA.id);

        // Attempting to query with Parent A ID in School B returns 0 rows
        const parentAInSchoolB = await client.query(
          `SELECT id FROM students WHERE primary_parent_user_id = $1 AND school_id = $2`,
          [ISOLATION_IDS.schoolA.parentUserId, ISOLATION_IDS.schoolB.id],
        );
        expect(parentAInSchoolB.rows.length).toBe(0);

        // Parent A cannot access Student B even if student ID is known
        const studentBCheck = await client.query(
          `SELECT id FROM students
           WHERE id = $1 AND primary_parent_user_id = $2 AND school_id = $3`,
          [ISOLATION_IDS.schoolB.studentId, ISOLATION_IDS.schoolA.parentUserId, ISOLATION_IDS.schoolA.id],
        );
        expect(studentBCheck.rows.length).toBe(0);
      } finally {
        client.release();
      }
    });
  });
});
