-- Migration 0059: Complete Fail-Closed Row-Level Security on Remaining Tenant Tables (SEC-RLS-002)
-- Enforces fail-closed multi-tenancy and FORCE RLS across all 136 tenant-owned domain tables.
-- Tested against disposable local/CI database only.

DO $$ 
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'sections',
    'class_teacher_assignments',
    'subjects',
    'class_subjects',
    'student_subject_enrollments',
    'academic_terms',
    'academic_calendar_events',
    'bell_schedule',
    'timetable_periods',
    'timetable_substitutions',
    'section_subject_teachers',
    'homeroom_report_remarks',
    'syllabus_units',
    'syllabus_chapters',
    'syllabus_topics',
    'lesson_plans',
    'assignments',
    'assignment_submissions',
    'assessments',
    'chart_of_accounts',
    'bank_accounts',
    'income_heads',
    'expense_heads',
    'income_vouchers',
    'expense_vouchers',
    'admission_applications',
    'admission_documents',
    'admission_workflow_steps',
    'waitlist',
    'staff_attendance',
    'attendance_notifications',
    'student_leave_requests',
    'notices',
    'sms_logs',
    'email_logs',
    'push_notification_logs',
    'events',
    'parent_teacher_messages',
    'user_push_subscriptions',
    'parent_feed_cards',
    'teacher_feed_cards',
    'parent_notification_preferences',
    'ptm_events',
    'ptm_slots',
    'ptm_bookings',
    'notice_acknowledgments',
    'academic_years',
    'roles',
    'user_roles',
    'audit_logs',
    'platform_audit_logs',
    'privacy_notices',
    'consent_purposes',
    'data_retention_policies',
    'pii_audit_trails',
    'drivers',
    'exam_types',
    'exams',
    'exam_components',
    'exam_class_scopes',
    'exam_mark_distributions',
    'mark_entries',
    'exam_marks_locks',
    'exam_admit_card_settings',
    'admit_card_templates',
    'exam_admit_card_holds',
    'cocurricular_areas',
    'cocurricular_grades',
    'report_card_setups',
    'result_settings',
    'result_snapshots',
    'result_holds',
    'uploaded_marksheets',
    'public_result_lookups',
    'report_cards',
    'certificates',
    'exam_schedules',
    'grade_rules',
    'report_card_jobs',
    'medical_exemptions',
    'usage_events',
    'fee_heads',
    'fee_structures',
    'fee_concessions',
    'fee_refunds',
    'fee_queries',
    'fee_groups',
    'fee_discounts',
    'fee_challans',
    'fee_due_slips',
    'fee_carry_forwards',
    'fee_audit_logs',
    'hostel_rooms',
    'hostel_allocations',
    'visitor_logs',
    'departments',
    'designations',
    'staff',
    'leave_types',
    'leave_requests',
    'salary_components',
    'payroll_runs',
    'payslips',
    'salary_templates',
    'staff_documents',
    'staff_loans',
    'leave_balances',
    'assets',
    'asset_assignments',
    'inventory_items',
    'purchase_orders',
    'stock_movements',
    'books',
    'book_copies',
    'library_members',
    'book_issues',
    'book_fines',
    'persons',
    'student_fee_advances',
    'student_fee_advance_allocations',
    'student_family_members',
    'student_medical_records',
    'student_class_history',
    'student_documents',
    'alumni',
    'student_document_requests',
    'profile_change_requests',
    'platform_announcements',
    'impersonation_sessions',
    'school_provisions',
    'vehicles',
    'routes',
    'route_stops',
    'student_bus_passes',
    'bus_boarding_events',
    'stop_change_requests'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_select_policy ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_insert_policy ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_update_policy ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_delete_policy ON %I;', tbl);

    -- SELECT: Strict tenant match OR global read for PLATFORM_ADMIN
    EXECUTE format('
      CREATE POLICY tenant_select_policy ON %I
        FOR SELECT
        USING (
          (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
          OR nullif(current_setting(''app.current_role'', true), '''') = ''PLATFORM_ADMIN''
        );
    ', tbl);

    -- INSERT: Strict tenant match required (no PLATFORM_ADMIN write bypass)
    EXECUTE format('
      CREATE POLICY tenant_insert_policy ON %I
        FOR INSERT
        WITH CHECK (
          (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
        );
    ', tbl);

    -- UPDATE: Strict tenant match required
    EXECUTE format('
      CREATE POLICY tenant_update_policy ON %I
        FOR UPDATE
        USING (
          (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
        )
        WITH CHECK (
          (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
        );
    ', tbl);

    -- DELETE: Strict tenant match required
    EXECUTE format('
      CREATE POLICY tenant_delete_policy ON %I
        FOR DELETE
        USING (
          (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
        );
    ', tbl);

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END $$;
--> statement-breakpoint
