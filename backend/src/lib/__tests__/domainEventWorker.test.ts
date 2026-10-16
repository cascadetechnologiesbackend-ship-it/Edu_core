/**
 * S13 Layer 6 Test Suite: Durable Domain Events Outbox Worker
 *
 * Verifies:
 * 1. Transactional outbox pattern: Events inserted as PENDING are consumed and transitioned to PROCESSED.
 * 2. Event handlers execution: Handlers receive the complete typed payload and aggregate identifiers.
 * 3. Resilient retry & failure recording: When a handler fails, the outbox record transitions to FAILED,
 *    increments retry_count, and logs the error forensics.
 * 4. Multi-tenant isolation: Events for School A cannot be drained or mutated under School B's context.
 * 5. Default handlers: StudentEnrolledEvent, AttendanceMarkedEvent, and FeePaidEvent execute successfully.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { db } from "@/db";
import { domainEvents } from "@schoolmitra/database";
import { eq, and } from "drizzle-orm";
import { withTenant } from "../tenant";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import {
  drainPendingDomainEvents,
  registerDomainEventHandler,
  clearDomainEventHandlers,
  DomainEventRecord,
} from "../../workers/domainEventWorker";

describe("S13 Layer 6: Durable Domain Events Outbox Worker", () => {
  let schoolAId: string;
  let schoolBId: string;

  beforeAll(async () => {
    await seedIsolationSchools();
    schoolAId = ISOLATION_IDS.schoolA.id;
    schoolBId = ISOLATION_IDS.schoolB.id;
  });

  afterEach(() => {
    clearDomainEventHandlers();
  });

  it("6.1: Pending outbox events are drained, handlers are executed, and event transitions to PROCESSED", async () => {
    const runId = Math.random().toString(36).substring(2, 7);
    const testEventType = `TestCustomEvent_${runId}`;
    let handlerExecuted = false;
    let receivedPayload: any = null;

    // Register test handler
    registerDomainEventHandler(testEventType, async (event: DomainEventRecord) => {
      handlerExecuted = true;
      receivedPayload = event.payload;
    });

    // 1. Insert PENDING event inside tenant boundary
    let insertedEventId = "";
    await withTenant(schoolAId, async (tx) => {
      const [inserted] = await tx
        .insert(domainEvents)
        .values({
          schoolId: schoolAId,
          aggregateId: `agg-${runId}`,
          eventType: testEventType,
          payload: { runId, message: "Hello Outbox" },
          status: "PENDING",
        })
        .returning();
      insertedEventId = inserted!.id;
    });

    expect(insertedEventId).toBeTruthy();

    // 2. Drain pending events for School A
    const drainResult = await drainPendingDomainEvents({
      targetSchoolId: schoolAId,
      batchSize: 50,
    });

    expect(drainResult.processedCount).toBeGreaterThanOrEqual(1);
    expect(handlerExecuted).toBe(true);
    expect(receivedPayload).toEqual({ runId, message: "Hello Outbox" });

    // 3. Verify outbox DB row updated to PROCESSED
    const eventRow = await withTenant(schoolAId, async (tx) => {
      return await tx.query.domainEvents.findFirst({
        where: and(
          eq(domainEvents.id, insertedEventId),
          eq(domainEvents.schoolId, schoolAId),
        ),
      });
    });

    expect(eventRow).toBeDefined();
    expect(eventRow!.status).toBe("PROCESSED");
    expect(eventRow!.processedAt).toBeInstanceOf(Date);
    expect(eventRow!.error).toBeNull();
  });

  it("6.2: When handler throws, event transitions to FAILED, increments retry_count, and logs error", async () => {
    const runId = Math.random().toString(36).substring(2, 7);
    const failingEventType = `FailingEvent_${runId}`;

    registerDomainEventHandler(failingEventType, async () => {
      throw new Error("Simulated Outbox Handler Network Timeout");
    });

    let insertedEventId = "";
    await withTenant(schoolAId, async (tx) => {
      const [inserted] = await tx
        .insert(domainEvents)
        .values({
          schoolId: schoolAId,
          aggregateId: `agg-fail-${runId}`,
          eventType: failingEventType,
          payload: { runId, willFail: true },
          status: "PENDING",
        })
        .returning();
      insertedEventId = inserted!.id;
    });

    // Drain events
    const drainResult = await drainPendingDomainEvents({
      targetSchoolId: schoolAId,
      batchSize: 50,
    });

    expect(drainResult.failedCount).toBeGreaterThanOrEqual(1);

    // Verify row transitioned to FAILED with error forensic details
    const failedRow = await withTenant(schoolAId, async (tx) => {
      return await tx.query.domainEvents.findFirst({
        where: and(
          eq(domainEvents.id, insertedEventId),
          eq(domainEvents.schoolId, schoolAId),
        ),
      });
    });

    expect(failedRow).toBeDefined();
    expect(failedRow!.status).toBe("FAILED");
    expect(failedRow!.retryCount).toBe(1);
    expect(failedRow!.error).toContain("Simulated Outbox Handler Network Timeout");
  });

  it("6.3: Strict multi-tenant isolation: draining School B does not process or mutate School A events", async () => {
    const runId = Math.random().toString(36).substring(2, 7);
    const isolatedEventType = `IsolatedEvent_${runId}`;

    let schoolAHandled = false;
    registerDomainEventHandler(isolatedEventType, async (event) => {
      if (event.schoolId === schoolAId) {
        schoolAHandled = true;
      }
    });

    // Insert event for School A
    let eventAId = "";
    await withTenant(schoolAId, async (tx) => {
      const [inserted] = await tx
        .insert(domainEvents)
        .values({
          schoolId: schoolAId,
          aggregateId: `agg-iso-${runId}`,
          eventType: isolatedEventType,
          payload: { school: "A" },
          status: "PENDING",
        })
        .returning();
      eventAId = inserted!.id;
    });

    // Drain only for School B
    await drainPendingDomainEvents({
      targetSchoolId: schoolBId,
      batchSize: 50,
    });

    expect(schoolAHandled).toBe(false);

    // Event A must still be PENDING
    const eventARow = await withTenant(schoolAId, async (tx) => {
      return await tx.query.domainEvents.findFirst({
        where: and(
          eq(domainEvents.id, eventAId),
          eq(domainEvents.schoolId, schoolAId),
        ),
      });
    });

    expect(eventARow).toBeDefined();
    expect(eventARow!.status).toBe("PENDING");
  });

  it("6.4: Default handlers for StudentEnrolledEvent, AttendanceMarkedEvent, and FeePaidEvent execute without error", async () => {
    const runId = Math.random().toString(36).substring(2, 7);

    // Insert 3 normative events
    await withTenant(schoolAId, async (tx) => {
      await tx.insert(domainEvents).values([
        {
          schoolId: schoolAId,
          aggregateId: `student-${runId}`,
          eventType: "StudentEnrolledEvent",
          payload: { studentId: `student-${runId}`, admissionNumber: "ADM-TEST" },
          status: "PENDING",
        },
        {
          schoolId: schoolAId,
          aggregateId: `sec-${runId}`,
          eventType: "AttendanceMarkedEvent",
          payload: { sectionId: `sec-${runId}`, totalPresent: 25 },
          status: "PENDING",
        },
        {
          schoolId: schoolAId,
          aggregateId: `pay-${runId}`,
          eventType: "FeePaidEvent",
          payload: { paymentId: `pay-${runId}`, amountPaid: 15000 },
          status: "PENDING",
        },
      ]);
    });

    const result = await drainPendingDomainEvents({
      targetSchoolId: schoolAId,
      batchSize: 50,
    });

    expect(result.processedCount).toBeGreaterThanOrEqual(3);
    expect(result.failedCount).toBe(0);
  });
});
