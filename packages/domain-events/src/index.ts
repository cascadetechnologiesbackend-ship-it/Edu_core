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

// ─── Event Handler Interface ──────────────────────────────────────────────────

export interface EventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
}

// ─── Domain Event Publisher (In-Memory + Redis Bridge Ready) ─────────────────

export class DomainEventPublisher {
  private static handlers: Map<string, EventHandler[]> = new Map();

  /**
   * Registers a subscriber for a specific domain event type.
   */
  public static subscribe(eventType: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) || [];
    this.handlers.set(eventType, [...existing, handler]);
  }

  /**
   * Publishes an event to all registered local in-memory subscribers.
   */
  public static async publish<T = any>(event: DomainEvent<T>): Promise<void> {
    const handlers = this.handlers.get(event.eventType) || [];
    await Promise.all(
      handlers.map(async (h) => {
        try {
          await h.handle(event);
        } catch (error) {
          console.error(
            `[DomainEventPublisher] Error handling event ${event.eventType} (${event.eventId}):`,
            error,
          );
        }
      }),
    );
  }

  /**
   * Clears all subscribers (useful for test isolation).
   */
  public static clearAllSubscribers(): void {
    this.handlers.clear();
  }
}
