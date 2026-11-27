import "dotenv/config";
import { Client } from "pg";

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const s = await c.query("SELECT id, name, slug FROM schools WHERE slug = 'demo-cbse'");
  if (!s.rows[0]) {
    console.log("Oakridge Global Academy not found!");
    await c.end();
    return;
  }
  const sid = s.rows[0].id;
  console.log("School:", s.rows[0]);

  const tbls = [
    "academic_years",
    "academic_terms",
    "academic_calendar_events",
    "bell_schedule",
    "classes",
    "sections",
    "subjects",
    "class_subjects",
    "class_teacher_assignments",
    "section_subject_teachers",
    "timetable_periods",
    "timetable_substitutions",
    "syllabus_units",
    "syllabus_chapters",
    "syllabus_topics",
    "lesson_plans",
    "staff",
    "students",
    "student_family_members",
    "student_attendance",
    "assignments",
    "assignment_submissions",
    "question_bank",
    "question_papers",
    "question_paper_items",
    "exam_types",
    "exams",
    "exam_components",
    "exam_class_scopes",
    "exam_schedules",
    "exam_marks_locks",
    "mark_entries",
    "report_cards",
    "fee_heads",
    "fee_structures",
    "fee_invoices",
    "fee_payments",
    "bank_accounts",
    "income_heads",
    "expense_heads",
    "income_vouchers",
    "expense_vouchers",
    "leave_types",
    "leave_requests",
    "vehicles",
    "routes",
    "route_stops",
    "student_bus_passes",
    "books",
    "book_copies",
    "library_members",
    "book_issues",
    "events",
    "ptm_events",
    "ptm_slots",
    "ptm_bookings",
    "notices",
  ];

  for (const t of tbls) {
    try {
      const r = await c.query(`SELECT count(*)::int AS cnt FROM "${t}" WHERE school_id = $1`, [sid]);
      console.log(`  ${t.padEnd(28)}: ${r.rows[0].cnt}`);
    } catch (e: any) {
      console.log(`  ${t.padEnd(28)}: ERROR (${e.message})`);
    }
  }
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
