// ─── SchoolOS Domain Events Core Engine ───────────────────────────────────────

export interface DomainEvent<T = any> {
  eventId: string;
  eventType: string;
  aggregateId: string;
  tenantId: string;
  occurredOn: Date;
  payload: T;
}

// ─── Standard Event Types ─────────────────────────────────────────────────────

export interface ApplicationSubmittedPayload {
  applicationId: string;
  applicantName: string;
  gradeAppliedFor: string;
  primaryContactEmail: string;
  primaryContactMobile: string;
}

export interface StudentEnrolledPayload {
  studentId: string;
  personId: string;
  admissionNumber: string;
  classId: string;
  sectionId: string;
  academicYearId: string;
}

export interface FeePaidPayload {
  paymentId: string;
  invoiceId: string;
  studentId: string;
  amountPaid: number;
  paymentMode: string;
  transactionReference: string;
}

export interface AttendanceMarkedPayload {
  sectionId: string;
  date: string;
  totalPresent: number;
  totalAbsent: number;
  markedByUserId: string;
}

export interface UserProvisionedPayload {
  userId: string;
  personId: string;
  email: string;
  role: string;
}

// ─── Durable Outbox Architecture Note ──────────────────────────────────────────
// S13 Layer 6: In-memory DomainEventPublisher with 0 subscribers has been purged.
// All domain events are now transactionally persisted into the `domain_events` outbox table
// (Migration 0042) and asynchronously consumed by the BullMQ/Valkey worker
// in `backend/src/workers/domainEventWorker.ts` with strict tenant isolation.
