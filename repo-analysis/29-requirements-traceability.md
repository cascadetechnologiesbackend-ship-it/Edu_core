# 29 — Requirements Traceability Matrix
## SchoolMitra ERP

*Requirements are reconstructed from codebase evidence. No formal requirements document exists.*

---

## Traceability Matrix

| ID | Requirement | Source | Implementation | Test | Status | Risk |
|----|------------|--------|---------------|------|--------|------|
| REQ-001 | Multi-tenant school provisioning from templates | superadmin.ts schema | global_template_* tables; onboard route | multitenancy.spec.ts (partial) | PARTIAL | Medium |
| REQ-002 | Email + password authentication | auth/index.ts | CredentialsProvider, bcrypt, lockout | auth.spec.ts | PARTIAL | High (secrets) |
| REQ-003 | Account lockout after 5 failed attempts | accountLockout.ts | Redis + memory fallback | security.spec.ts (skipped) | PARTIAL | Medium |
| REQ-004 | Role-based access control (11 roles) | roleConfig.ts, trpc.ts | withRole middleware, requireAuth() | rbac.spec.ts | PARTIAL | High (SA coverage) |
| REQ-005 | Student PII encryption | encryption.ts, students.ts | AES-256-CBC field-level | NONE FOUND | PARTIAL | High (key fallback) |
| REQ-006 | Admission application (public online form) | admissions.ts, admissions router | submitApplication publicProcedure | admission.spec.ts | BROKEN | High (unauthorized) |
| REQ-007 | Admission workflow (9 states) | admissions.ts schema | admission_workflow_steps table | NONE FOUND | PARTIAL | Medium |
| REQ-008 | Fee structure + invoice generation | fees.ts, feeAssignmentEngine.ts | autoAssignFeeStructuresToStudent() | fee.spec.ts | PARTIAL | High (no transaction) |
| REQ-009 | Online payment via Razorpay | fees.ts, payment_gateway_logs | payment gateway tables; webhook bypass | NONE FOUND | PARTIAL | High (webhook unverified) |
| REQ-010 | Indian payroll (PF, ESI, PT, LWP) | payrollEngine.ts, hr.ts | calculateStaffPayroll() pure engine | NONE FOUND | PARTIAL (engine complete) | Low |
| REQ-011 | Leave request workflow (3-step approval) | hr.ts | leaveRequests table; leaveStatusEnum | NONE FOUND | PARTIAL | Medium |
| REQ-012 | Student + staff attendance | attendance.ts | student_attendance, staff_attendance | attendance.spec.ts | PARTIAL | Medium |
| REQ-013 | Grade calculation (CBSE rules) | gradeEngine.ts | calculateGrade(), aggregateSubjectGrades() | NONE FOUND (engine testable) | PARTIAL | Low |
| REQ-014 | Report card generation (PDF, async) | reportCard.ts worker | BullMQ job; @react-pdf/renderer | report-card.spec.ts | PARTIAL | Medium |
| REQ-015 | DPDP consent collection | dpdp.ts, consent_records | consent workflow schema | dpdp.spec.ts | PARTIAL | Medium |
| REQ-016 | DPDP rights requests (30-day SLA) | dpdp.ts | rights_requests table | dpdp.spec.ts | PARTIAL | Medium |
| REQ-017 | DPDP data breach log (72-hour notification) | dpdp.ts | data_breach_log table | NONE FOUND | PARTIAL | High |
| REQ-018 | Immutable audit log | migration 0009 | audit_logs + PG trigger | security.spec.ts (partial) | VERIFIED | Low |
| REQ-019 | Super admin impersonation | impersonation.ts, superadmin.ts | HMAC-signed cookie, impersonation_sessions | NONE FOUND | PARTIAL | Medium |
| REQ-020 | Platform template management | superadmin.ts | global_template_* tables | NONE FOUND | PARTIAL | Low |
| REQ-021 | Parent portal (fees, attendance, bus) | roleConfig.ts, parent routes | routes present; implementation UNKNOWN | NONE FOUND | UNKNOWN | Medium |
| REQ-022 | Teacher gradebook | teacher routes | routes present; implementation UNKNOWN | NONE FOUND | UNKNOWN | Medium |
| REQ-023 | Transport management | transport.ts schema, transport routes | schema present; implementation UNKNOWN | transport.spec.ts | UNKNOWN | Low |
| REQ-024 | Library management | library.ts schema, library routes | schema present; implementation UNKNOWN | library.spec.ts | UNKNOWN | Low |
| REQ-025 | DPDP data retention enforcement | retention.ts worker | BullMQ worker; data_retention_policies | NONE FOUND | PARTIAL | High |
| REQ-026 | TOTP/2FA authentication | core.ts (schema) | Schema present; enforcement MISSING | NONE FOUND | BROKEN | High |
| REQ-027 | Security headers (CSP, HSTS, etc.) | next.config.mjs | headers() function | NONE FOUND | VERIFIED | Low |
| REQ-028 | Rate limiting on API | rateLimiter.ts | Redis sliding window, memory fallback | security.spec.ts (partial) | PARTIAL | Medium |
| REQ-029 | Force password change on first login | serverAuth.ts, auth.config.ts | mustChangePassword flag + redirect | auth.spec.ts | VERIFIED | Low |
| REQ-030 | Fee concession workflow | fees.ts, feeAssignmentEngine.ts | feeConcessions table; recalculate | NONE FOUND | PARTIAL | Medium |

---

## Unspecified Capabilities

Features implemented without identified requirements documentation:

| Feature | Evidence | Risk |
|---------|---------|------|
| Subscription tier system | schools.subscriptionTier + expiresAt columns | No enforcement found |
| School slug/subdomain routing | schools.slug; multitenancy.spec.ts | Incomplete infra setup |
| Waitlist management | waitlist table | Implementation extent UNKNOWN |
| Legal hold on students/staff | students.legalHold; staff.legalHold | Enforcement unclear |
| Alumni tracking | alumni table | Implementation UNKNOWN |
| Hostel management | hostel.ts schema referenced | Schema present; implementation UNKNOWN |
| ECR file generation | payrollEngine.generatePfEcrFile() | Export endpoint UNKNOWN |
| Topper certificate PDF | TopperCertificate.tsx template | Generation workflow UNKNOWN |
| Platform announcements | platform_announcements table | UI implementation UNKNOWN |

---

## Coverage Summary

| Status | Count | % |
|--------|-------|---|
| VERIFIED / COMPLETE | 3 | 10% |
| PARTIAL | 19 | 63% |
| UNKNOWN | 5 | 17% |
| BROKEN | 3 | 10% |
| MISSING | 0 | 0% |

**Note:** "PARTIAL" is the dominant status because most features have working database schemas and business logic engines but unverified Server Action authorization coverage and incomplete E2E test suites.
