# Specification Template: SchoolMitra Journey Specification

> **Spec Governance Rule**: Every future specification in this repository must derive from and cite [docs/product-destination-charter.json](file:///v:/Cascade/2026/Edu_core/docs/product-destination-charter.json). No spec may be opened without a valid `north_star` block and `persona_jobs` mapping.

```json
{
  "spec_id": "SXX-JOURNEY-NAME",
  "version": "1.0.0",
  "spec_series": "edu_core_spec_series",
  "spec_type": "journey_spec",
  "governing_charter": "docs/product-destination-charter.json",
  "north_star": {
    "destination_sentence": "One real school, 500-2000 students, one board, one state, runs one full academic term entirely on SchoolMitra: zero Excel registers, zero untracked phone calls, fee cycle closed monthly, attendance under four minutes per section, exams conducted end to end with published results — and the school renews and refers another school.",
    "journeys_advanced": [
      "J1_fee_day" // Choose from: J1_fee_day, J2_month_end_close, J3_the_period, J4_weekly_review, J5_parent_loop, J6_homework_cycle, J7_admission_season, J8_exam_season, J9_rollover, J10_school_onboarding
    ],
    "target_metrics_moved": [
      {
        "metric": "fee_day_reconciled_by_3pm",
        "expected_delta": "Increases daily reconciliation rate from baseline to >95%"
      }
    ]
  },
  "persona_jobs": [
    {
      "persona_id": "office_admin", // office_admin | accountant | principal | teacher | parent | student
      "job_name": "Collect and account for today's fees",
      "trigger": "Counter fee payment or daily closing time",
      "finished_state_message": "Today's collection Rs X, reconciled Rs Y, N defaulters queued for reminder — day closed.",
      "walkthrough_verification": "Automated Vitest/Playwright test verifying finished state is visible on screen after completing collection"
    }
  ],
  "scope_boundaries": {
    "non_goals_confirmed": [
      "No hardware or biometric dependencies",
      "No external curriculum content",
      "No LLMs in core operational workflows",
      "No new standalone role apps"
    ],
    "migration_required": false
  },
  "phases": [
    {
      "phase_id": "P1",
      "title": "Phase title",
      "tasks": [
        "Task 1 description"
      ],
      "walkthrough_verification": "Step-by-step role walkthrough asserting final screen text and next action"
    }
  ],
  "definition_of_done": "All phases green, typecheck green, zero regressions, finished state verified by automated walkthrough."
}
```

---

## Instructions for Authors
1. **Name the Job in the H1**: Ensure the UI screens delivered in this spec have `<h1>` titles naming the job (e.g., *"Collect Today's Fees"* instead of *"Invoice Roster"*).
2. **Explicit Finished State**: The workflow must conclude with clear confirmation metrics and a next action button.
3. **Walkthrough Obligation**: Every implementation phase must conclude with an automated or scripted persona walkthrough asserting that the finished state is reachable.

