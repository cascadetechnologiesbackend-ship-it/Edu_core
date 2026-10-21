# Spec-Driven Role Architecture & Zero-Clutter Event Engine Guardrails

## 1. Zero-Clutter, High-Intent Event Feed Principle
All role applications (Parent, Teacher, Student, Driver, Admin) must prioritize high-intent, calm interfaces over static data dashboards.
- **The Zero-Clutter Invariant**:
  - A feed card exists ONLY when a real data condition or upcoming deadline requires attention.
  - When all conditions are calm (e.g., student present, invoices paid, no active pass, no pending notices/consents), the home feed MUST render only the calm Today strip and identity header.
  - No feed card may render unconditionally.
- **Tiered Urgency Hierarchy**:
  - **Tier 0 (Emergency)**: Priority 100. Bypasses quiet hours, pinned until expired/resolved, red alert styling (e.g. school closures, emergency broadcasts).
  - **Tier 1 (Urgent Action Required)**: Priority 80–90. Day-of Absence, Unpaid Overdue Invoice, Live Bus in Transit.
  - **Tier 2 (Actionable / Informational)**: Priority 50–75. Homework assigned, PTM scheduled, Weekly Digest, Leave Approved/Rejected, Routine Notices.
- **Automated Event Suppression Rules**:
  - *Absence Suppression*: If a student has an active approved leave for the date, day-of `ABSENT` feed cards and SMS alarms must be suppressed. In the teacher attendance register, attendance must automatically resolve to `LEAVE`.
  - *Fee Escalation Suppression*: If an open fee query or dispute exists on an invoice, overdue fee alerts and escalation warnings must be suppressed.
  - *Trip Lifecycle Suppression*: When a transport trip completes or the student deboards, the live tracking card must automatically dismiss or transition to a calm summary state.

## 2. Multi-Entity & Multi-Ward Feeds
- **Pure Feed Interleaving**:
  - Multi-entity/ward feeds must be merged using pure engine functions (`mergeMultiWardFeeds(feeds, now)`) sorting chronologically and by urgency tier.
  - Sibling urgency takes precedence: a critical Tier 1 alert for Child B surfaces above a routine Tier 2 notice for Child A.
- **Entity & Ward Chips**:
  - In multi-ward/multi-entity view, every card must render `<span data-testid="ward-chip">{entityName}</span>`.
  - In single-ward view, card headers remain clean without redundant entity labels.

## 3. Consolidated Notification Matrix
- **Sibling & Event Consolidation**:
  - Multiple notifications occurring within a 30-minute window for the same parent across siblings (e.g. multiple homework assignments, general notices) MUST be consolidated into a single digest push/SMS.
  - Deduplication key format: `parent:${parentUserId}:${eventKind}:${calendarDay}`.
- **Quiet Hours Enforcement**:
  - Routine informational events ($T2$) are muted during school-defined quiet hours (e.g. 21:00 to 07:00 IST). Emergency events ($T0$) strictly bypass quiet hours.

## 4. Two-Way Workflows Hub & Click Budgets
- **Requests & Records Hub**:
  - All interactive workflows (Leaves, Stop Changes, Document Requests, PTM Bookings, Fee Queries) must be accessible from a central `/more` Workflows Hub.
  - Must provide debounced search, category filters, status filters, and live status chips.
- **Strict Click Budgets**:
  - Fee Payment: $\le 2$ taps (Card $\to$ Razorpay modal).
  - Leave Application: $\le 4$ taps (Open $\to$ Dates $\to$ Type $\to$ Submit).
  - PTM Slot Booking: $\le 3$ taps (Card $\to$ Select Slot $\to$ Confirm).
  - Bus Stop Change: $\le 4$ taps (Open $\to$ New Stop $\to$ Effective Date $\to$ Submit).
  - Profile Update: $\le 3$ taps (Section $\to$ Edit Field $\to$ Submit).

## 5. Database Schema Catalog & DPDP Privacy Invariants
- **Schema Catalog Registration (`@schoolmitra/entity-engine`)**:
  - Every database table MUST be registered in `packages/entity-engine/src/catalog/entityGraph.ts` with its domain, foreign keys, and relations.
  - **Zero Duplicate Keys**: Always check that entities are not declared multiple times in `entityGraph.ts` (prevents TS1117).
- **DPDP Act 2023 Compliance**:
  - Tables storing PII (Aadhaar, PAN, phone, banking, medical, biometric) must declare `piiColumns`.
  - Sensitive government identifiers must pass Verhoeff checksum validation (Aadhaar) and strict regex validation before persistence.
  - Parent/Student profile access and document downloads must record an immutable audit log.
- **Language & Dignity Standard**:
  - Full bilingual capability (English + Hindi) across all user-facing strings.
  - **Strict prohibition of shame words**: Never use words like "defaulter", "churn", "risk score", or "delinquent" in parent or student facing UI. All copy must remain calm, dignified, and explainable.

## 6. TypeScript & Full-Stack Monorepo Invariants
- **`exactOptionalPropertyTypes: true` Compliance**:
  - Interfaces with optional properties that might receive `undefined` must explicitly type `prop?: Type | undefined`.
  - Drizzle query options cannot receive `{ limit: undefined }`. Use conditional object spreading: `...(limit ? { limit } : {})`.
- **Drizzle Transaction Relational Inference**:
  - In server actions and routes, explicitly type transaction callbacks as `tx: Db` (imported from `@/db`). This preserves relational inference across all `tx.query.*` calls and prevents TS7006 implicit `any` errors.
- **Tenant Context Isolation**:
  - Every server action and query on tenant-scoped tables must be wrapped inside `withTenant(school.id)` or explicitly enforce `eq(table.schoolId, school.id)`.
