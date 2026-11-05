# SchoolMitra North Star Metrics

## Absolute Series Law
> *"Every metric gets a telemetry event, an admin-visible readout, and an automated test. A metric without a readout is a lie."*

---

## The Six Core Metrics

| Metric | Formal Definition | Target | Telemetry Event Name | Measurement Standard |
|---|---|---|---|---|
| **`attendance_mark_minutes`** | Median wall-clock time for a classroom teacher to open the roster, confirm marks, and submit section attendance. | **< 4 minutes** | `north_star_attendance_duration` | Measured from roster mount to server confirmation (`duration_ms`). |
| **`fee_day_reconciled_by_3pm`** | Percentage of the day's collected fee volume (counter cash + online gateway) verified and reconciled before 3:00 PM local time. | **≥ 95%** | `north_star_fee_day_reconciled` | Ratio of reconciled paise to total demand receipts at 15:00 IST snapshot. |
| **`month_close_hours`** | Total staff hours required by the accountant to perform double-entry reconciliation and finalize the monthly close report pack. | **< 4 hours** | `north_star_month_close_duration` | Wall-clock elapsed duration between close initiation and final report freeze. |
| **`onboarding_days`** | Working days elapsed between empty tenant provisioning and the school recording its first live classroom attendance. | **≤ 1 working day** | `north_star_onboarding_duration` | Timestamp delta from tenant creation to first active attendance record. |
| **`parent_fee_seconds`** | Total seconds elapsed from parent opening the portal to receiving an authenticated gateway receipt confirmation. | **< 90 seconds** | `north_star_parent_fee_duration` | Direct client-to-server timing from payment intent to receipt display. |
| **`journey_completion_rate`** | Proportion of initiated primary workflows (J1–J10) that terminate in a verified finished state rather than abandonment. | **≥ 95%** | `north_star_journey_completion` | Tracked journey start events vs matching finished state event emissions. |

---

## Telemetry Integrity & DPDP Safeguards
1. **Zero PII**: No student names, admission numbers, guardian contact numbers, or financial amounts in clear text. All payloads contain only identifiers, elapsed durations, status codes, and aggregate counts.
2. **First-Party Only**: All events are stored in the school's local database instance (`usage_events` table). Zero third-party trackers or external analytics vendors.
3. **Tenant Isolated**: All events are scoped strictly by `school_id` under tenant context validation (`withTenant`).

