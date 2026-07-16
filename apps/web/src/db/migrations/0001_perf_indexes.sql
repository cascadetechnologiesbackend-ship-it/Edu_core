-- Custom Performance Indexes Migration
-- This migration adds indexes to frequently queried columns and foreign keys
-- to prevent sequential scans and optimize Next.js rendering speed.

-- Core / Auth
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_school_idx ON users(school_id);
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON user_roles(user_id);

-- Students
CREATE INDEX IF NOT EXISTS students_school_id_idx ON students(school_id);
CREATE INDEX IF NOT EXISTS students_class_id_idx ON students(class_id);
CREATE INDEX IF NOT EXISTS students_section_id_idx ON students(section_id);
CREATE INDEX IF NOT EXISTS students_admission_no_idx ON students(admission_number);

-- Staff
CREATE INDEX IF NOT EXISTS staff_school_id_idx ON staff(school_id);
CREATE INDEX IF NOT EXISTS staff_department_id_idx ON staff(department_id);
CREATE INDEX IF NOT EXISTS staff_email_idx ON staff(email);

-- Fees
CREATE INDEX IF NOT EXISTS fee_invoices_student_id_idx ON fee_invoices(student_id);
CREATE INDEX IF NOT EXISTS fee_invoices_school_id_idx ON fee_invoices(school_id);
CREATE INDEX IF NOT EXISTS fee_payments_invoice_id_idx ON fee_payments(invoice_id);

-- Attendance
CREATE INDEX IF NOT EXISTS attendance_student_date_idx ON attendance_records(student_id, date);
CREATE INDEX IF NOT EXISTS attendance_section_date_idx ON attendance_records(section_id, date);

-- Exams & Marks
CREATE INDEX IF NOT EXISTS marks_student_exam_idx ON mark_entries(student_id, exam_id);
CREATE INDEX IF NOT EXISTS marks_subject_exam_idx ON mark_entries(subject_id, exam_id);
CREATE INDEX IF NOT EXISTS report_cards_student_exam_idx ON report_cards(student_id, exam_id);

-- DPDP / Audit
CREATE INDEX IF NOT EXISTS audit_logs_school_id_idx ON audit_logs(school_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_record_id_idx ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS dpdp_consents_student_idx ON dpdp_consents(student_id);

-- Admissions
CREATE INDEX IF NOT EXISTS admission_applications_school_idx ON admission_applications(school_id);
CREATE INDEX IF NOT EXISTS admission_applications_number_idx ON admission_applications(application_number);
