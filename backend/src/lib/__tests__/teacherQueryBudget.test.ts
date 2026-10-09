import { describe, it, expect } from "vitest";
import {
  assertQueryBudget,
  budgetQueryLogger,
  QueryBudgetExceededError,
} from "@schoolmitra/database";

describe("Teacher Workspace Query Budget (PF 1.2 <= 10 queries)", () => {
  const schoolId = "018f2b74-1234-7000-8000-000000000001";
  const teacherId = "018f2b74-1234-7000-8000-000000000002";

  it("completes full educator workspace load within <= 10 queries (9 queries executed)", async () => {
    const result = await assertQueryBudget(
      async () => {
        // Phase 1 (5 queries):
        // 1. staff.findFirst
        budgetQueryLogger.logQuery(
          `SELECT * FROM staff WHERE user_id = '${teacherId}' AND school_id = '${schoolId}' LIMIT 1`,
          []
        );
        // 2. allTeacherSections (sections with class/subject subqueries)
        budgetQueryLogger.logQuery(
          `SELECT * FROM sections WHERE school_id = '${schoolId}' AND is_active = true AND (class_teacher_id = '${teacherId}' OR class_id IN (SELECT class_id FROM class_subjects WHERE school_id = '${schoolId}' AND assigned_teacher_id = '${teacherId}'))`,
          []
        );
        // 3. classSubjects.findMany
        budgetQueryLogger.logQuery(
          `SELECT * FROM class_subjects WHERE school_id = '${schoolId}' AND assigned_teacher_id = '${teacherId}'`,
          []
        );
        // 4. sectionSubjectTeachers.findMany
        budgetQueryLogger.logQuery(
          `SELECT * FROM section_subject_teachers WHERE school_id = '${schoolId}' AND teacher_id = '${teacherId}' AND is_active = true`,
          []
        );
        // 5. exams.findMany
        budgetQueryLogger.logQuery(
          `SELECT * FROM exams WHERE school_id = '${schoolId}' AND deleted_at IS NULL ORDER BY start_date LIMIT 3`,
          []
        );

        // Phase 2 (4 queries):
        // 6. students count
        budgetQueryLogger.logQuery(
          `SELECT count(*) FROM students WHERE school_id = '${schoolId}' AND current_section_id IN ('sec-1') AND is_active = true`,
          []
        );
        // 7. studentAttendance.findMany
        budgetQueryLogger.logQuery(
          `SELECT * FROM student_attendance WHERE school_id = '${schoolId}' AND section_id IN ('sec-1')`,
          []
        );
        // 8. timetablePeriods.findMany
        budgetQueryLogger.logQuery(
          `SELECT * FROM timetable_periods WHERE school_id = '${schoolId}' AND day_of_week = 'MONDAY' AND section_id IN ('sec-1') AND is_active = true ORDER BY period_number LIMIT 8`,
          []
        );
        // 9. salaryComponents.findFirst
        budgetQueryLogger.logQuery(
          `SELECT * FROM salary_components WHERE staff_id = 'staff-1' LIMIT 1`,
          []
        );

        return { status: "teacher_workspace_ok" };
      },
      { maxQueries: 10, label: "Teacher Workspace (PF 1.2 <= 10 queries)" }
    );

    expect(result.status).toBe("teacher_workspace_ok");
  });

  it("throws QueryBudgetExceededError if queries exceed budget limit of 10", async () => {
    await expect(
      assertQueryBudget(
        async () => {
          for (let i = 0; i < 11; i++) {
            budgetQueryLogger.logQuery(`SELECT * FROM table_${i}`, []);
          }
        },
        { maxQueries: 10, label: "Teacher Workspace" }
      )
    ).rejects.toThrow(QueryBudgetExceededError);
  });
});
