/**
 * First-Party Examination UX Telemetry Registry (Sprint S10 Layer 4)
 *
 * Invariants (UX-R62):
 * 1. First-party only: zero third-party tracking scripts or external analytics vendors.
 * 2. Strictly zero student PII: captures only screen route, element id, element label, action, actor role, user id.
 *    Student IDs, student names, mark figures, and PII are strictly rejected.
 * 3. Whitelisted element registry: server-side validation rejects arbitrary or unknown element IDs.
 */

export interface UxEventPayload {
  screen: string;
  elementId: string;
  elementLabel: string;
  action: "click" | "submit" | "tab_switch" | "filter_change" | "export" | "toggle";
}

export const KNOWN_UX_SCREENS = [
  "/exams/dashboard",
  "/exams/manage",
  "/exams/schedule",
  "/exams/marks",
  "/exams/admit-cards",
  "/exams/report-cards",
  "/exams/analytics",
  "/exams/usage",
  "/teacher/grading",
  "/portal/admit-cards",
  "/portal/report-cards",
] as const;

export type KnownUxScreen = (typeof KNOWN_UX_SCREENS)[number];

export const KNOWN_UX_ELEMENTS: Record<KnownUxScreen, Record<string, string>> = {
  "/exams/dashboard": {
    card_active_exams: "Active Exams Card",
    card_pending_marks: "Pending Marks Card",
    card_published_results: "Published Results Card",
    btn_quick_create_exam: "Quick Create Exam",
    btn_view_schedule: "View Schedule",
    btn_view_marks: "View Marks Entry",
    btn_view_report_cards: "View Report Cards",
    btn_view_analytics: "View Exam Analytics",
    btn_view_usage: "View Usage Analytics",
  },
  "/exams/manage": {
    btn_create_exam_modal: "Create Exam Modal Button",
    btn_load_board_defaults: "Load Board Defaults",
    btn_create_board_term_plan: "Create Board Term Plan",
    btn_wizard_next_step: "Wizard Next Step",
    btn_wizard_prev_step: "Wizard Previous Step",
    btn_submit_exam_form: "Submit Exam Form",
    btn_delete_exam: "Delete Exam Button",
    btn_manage_components: "Manage Components",
    btn_manage_grading_rules: "Manage Grading Rules",
  },
  "/exams/schedule": {
    tab_datesheet: "Datesheet Tab",
    tab_mark_distributions: "Mark Distributions Tab",
    btn_add_schedule_slot: "Add Schedule Slot",
    btn_publish_datesheet: "Publish Datesheet",
    btn_save_mark_distribution: "Save Mark Distribution",
    btn_export_schedule_pdf: "Export Schedule PDF",
  },
  "/exams/marks": {
    select_exam_filter: "Exam Select Filter",
    select_class_filter: "Class Select Filter",
    select_subject_filter: "Subject Select Filter",
    btn_save_marks_draft: "Save Marks Draft",
    btn_submit_marks: "Submit Marks for Review",
    btn_lock_marks: "Lock Marks Verification",
    btn_unlock_marks: "Unlock Marks Request",
    btn_export_marks_csv: "Export Marks CSV",
  },
  "/exams/admit-cards": {
    btn_save_admit_card_settings: "Save Admit Card Settings",
    btn_generate_bulk_admit_cards: "Generate Bulk Admit Cards",
    btn_toggle_admit_card_hold: "Toggle Admit Card Hold",
    btn_release_admit_card_hold: "Release Admit Card Hold",
    btn_override_fee_check: "Override Fee Check",
  },
  "/exams/report-cards": {
    tab_generate: "Generate Report Cards Tab",
    tab_templates: "Report Card Templates Tab",
    tab_setups: "Report Card Setups Tab",
    tab_settings: "Report Card Settings Tab",
    btn_create_report_card_setup: "Create Report Card Setup",
    btn_generate_bulk_report_cards: "Generate Bulk Report Cards",
    btn_download_batch_zip: "Download Bulk ZIP Archive",
    btn_retry_failed_batch: "Retry Failed Report Card Rows",
    btn_publish_all_results: "Publish All Results",
    btn_recompute_results: "Recompute Results",
    btn_set_result_hold: "Set Result Hold",
    btn_issue_topper_certificate: "Issue Topper Certificate",
  },
  "/exams/analytics": {
    btn_generate_merit_list: "Generate Merit List",
    btn_generate_rank_sheet: "Generate Rank Sheet",
    btn_export_cohort_analytics: "Export Cohort Analytics",
    select_analytics_class: "Analytics Class Selector",
    select_analytics_exam: "Analytics Exam Selector",
  },
  "/exams/usage": {
    select_usage_screen: "Usage Screen Selector",
    select_usage_timerange: "Usage Time Range Selector",
    btn_export_usage_report: "Export Usage Report",
  },
  "/teacher/grading": {
    select_grading_exam: "Teacher Exam Selector",
    select_grading_subject: "Teacher Subject Selector",
    btn_save_teacher_draft: "Teacher Save Draft",
    btn_submit_teacher_marks: "Teacher Submit Marks",
  },
  "/portal/admit-cards": {
    btn_download_student_admit_card: "Download Student Admit Card",
  },
  "/portal/report-cards": {
    btn_download_student_report_card: "Download Student Report Card",
  },
};

export const ALLOWED_UX_ACTIONS = [
  "click",
  "submit",
  "tab_switch",
  "filter_change",
  "export",
  "toggle",
] as const;

/**
 * Validates a single UX event payload against the known screen and element registry.
 */
export function validateUxEvent(
  event: unknown,
): { valid: true; data: UxEventPayload } | { valid: false; reason: string } {
  if (!event || typeof event !== "object") {
    return { valid: false, reason: "Payload must be a non-null object" };
  }

  const { screen, elementId, elementLabel, action } = event as Record<string, unknown>;

  if (typeof screen !== "string" || !KNOWN_UX_SCREENS.includes(screen as KnownUxScreen)) {
    return { valid: false, reason: `Unknown or unauthorized screen route: ${String(screen)}` };
  }

  const screenElements = KNOWN_UX_ELEMENTS[screen as KnownUxScreen];
  if (typeof elementId !== "string" || !screenElements[elementId]) {
    return { valid: false, reason: `Element '${String(elementId)}' is not registered for screen '${screen}'` };
  }

  if (typeof elementLabel !== "string" || elementLabel.trim().length === 0 || elementLabel.length > 100) {
    return { valid: false, reason: "elementLabel must be a non-empty string under 100 characters" };
  }

  if (typeof action !== "string" || !ALLOWED_UX_ACTIONS.includes(action as any)) {
    return { valid: false, reason: `Invalid action '${String(action)}'. Allowed: ${ALLOWED_UX_ACTIONS.join(", ")}` };
  }

  return {
    valid: true,
    data: {
      screen,
      elementId,
      elementLabel: elementLabel.trim(),
      action: action as UxEventPayload["action"],
    },
  };
}
