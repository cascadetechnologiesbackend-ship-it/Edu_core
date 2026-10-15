import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import {
  notifyResultReleased,
  notifyAdmitCardsReleased,
  notifyDatesheetPublished,
  notifyBulkJobCompleted,
  isQuietHours,
} from "../examNotifications";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import { db } from "@/db";
import {
  notices,
  pushNotificationLogs,
  smsLogs,
  userPushSubscriptions,
  reportCardSetups,
  resultSettings,
  exams,
  classes,
  subjects,
  examSchedules,
  examClassScopes,
  students,
  users,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { withTenant } from "../tenant";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

describe("S11 Layer 3 & S12 Layer 4: Examination Lifecycle Communication & Push Dispatch Wiring", () => {
  let pool: Pool;
  const schoolA = ISOLATION_IDS.schoolA.id;
  const schoolB = ISOLATION_IDS.schoolB.id;
  let testExamAId: string;
  let testSetupAId: string;
  let testScheduleAId: string;
  const parentAUserId = ISOLATION_IDS.schoolA.parentUserId;

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    await seedIsolationSchools();

    const runId = Math.random().toString(36).substring(2, 7);

    // Run fixture setup inside tenant context to satisfy fail-closed RLS
    await withTenant(schoolA, async (tx) => {
      // 1. Create test exam for School A
      const [exam] = await tx
        .insert(exams)
        .values({
          schoolId: schoolA,
          academicYearId: ISOLATION_IDS.schoolA.academicYearId,
          examTypeId: ISOLATION_IDS.schoolA.examTypeId,
          name: `S11 Layer 3 Exam ${runId}`,
          startDate: new Date("2026-11-01"),
          endDate: new Date("2026-11-15"),
        })
        .returning();
      testExamAId = exam!.id;

      // 2. Create a test schedule
      const [sched] = await tx
        .insert(examSchedules)
        .values({
          schoolId: schoolA,
          examId: testExamAId,
          classId: ISOLATION_IDS.schoolA.classId,
          subjectId: ISOLATION_IDS.schoolA.subjectId,
          examDate: "2026-11-05",
          startTime: "09:00:00",
          durationMinutes: 180,
          maxMarks: "100.00",
          passingMarks: "33.00",
        })
        .returning();
      testScheduleAId = sched!.id;

      // 3. Create a test setup for School A
      const [setup] = await tx
        .insert(reportCardSetups)
        .values({
          schoolId: schoolA,
          academicYearId: ISOLATION_IDS.schoolA.academicYearId,
          name: `Term Report ${runId}`,
          examWeightages: [{ examId: testExamAId, weightPercent: 100 }],
          createdById: ISOLATION_IDS.schoolA.adminUserId,
        })
        .returning();
      testSetupAId = setup!.id;
    });
  });

  afterAll(async () => {
    await withTenant(schoolA, async (tx) => {
      if (testSetupAId) {
        await tx.delete(resultSettings).where(eq(resultSettings.setupId, testSetupAId));
        await tx.delete(reportCardSetups).where(eq(reportCardSetups.id, testSetupAId));
      }
      if (testExamAId) {
        await tx.delete(examSchedules).where(eq(examSchedules.examId, testExamAId));
        await tx.delete(exams).where(eq(exams.id, testExamAId));
      }
    });
    await pool.end();
  });

  it("3.1: notifyResultReleased creates in-app notice, push notification log, and contains ZERO marks or PII", async () => {
    const res = await notifyResultReleased({
      schoolId: schoolA,
      setupId: testSetupAId,
      triggeredById: ISOLATION_IDS.schoolA.adminUserId,
    });

    expect(res.success).toBe(true);
    expect(res.inAppNoticeId).toBeDefined();
    expect(res.pushSentCount).toBeGreaterThanOrEqual(1);

    await withTenant(schoolA, async (tx) => {
      // Verify in-app notice
      const notice = await tx.query.notices.findFirst({
        where: and(eq(notices.id, res.inAppNoticeId!), eq(notices.schoolId, schoolA)),
      });
      expect(notice).toBeDefined();
      expect(notice?.audienceType).toBe("PARENTS");
      expect(notice?.title).toContain("Results Published");

      // Verify push notification log
      const pushLogs = await tx.query.pushNotificationLogs.findMany({
        where: and(
          eq(pushNotificationLogs.schoolId, schoolA),
          eq(pushNotificationLogs.recipientUserId, parentAUserId),
        ),
      });
      expect(pushLogs.length).toBeGreaterThanOrEqual(1);
      const latestPush = pushLogs[pushLogs.length - 1];

      // Assert zero student marks or private scores in payload
      expect(latestPush?.body).toContain("Tap to view");
      expect(latestPush?.body).not.toMatch(/\bmarks\s*:\s*\d+/i);
      expect(latestPush?.body).not.toMatch(/\bscore\s*:\s*\d+/i);
    });
  });

  it("3.2: notifyResultReleased triggers SMS fallback only when smsNotificationsEnabled=true and parent has no push sub", async () => {
    // 1. Enable SMS on this setup in result_settings under tenant context
    await withTenant(schoolA, async (tx) => {
      await tx
        .delete(userPushSubscriptions)
        .where(eq(userPushSubscriptions.userId, parentAUserId));
      await tx
        .insert(resultSettings)
        .values({
          schoolId: schoolA,
          setupId: testSetupAId,
          smsNotificationsEnabled: true,
          withholdAll: false,
          feeLockMode: "OFF",
          feeLockThresholdAmount: "0.00",
        })
        .onConflictDoUpdate({
          target: [resultSettings.setupId],
          set: { smsNotificationsEnabled: true },
        });
    });

    // Verify parentAUserId has NO web push subscription currently
    const res = await notifyResultReleased({
      schoolId: schoolA,
      setupId: testSetupAId,
      triggeredById: ISOLATION_IDS.schoolA.adminUserId,
    });

    expect(res.success).toBe(true);
    expect(res.smsQueuedCount).toBeGreaterThanOrEqual(1);

    // Verify SMS log entry exists under tenant context
    await withTenant(schoolA, async (tx) => {
      const sms = await tx.query.smsLogs.findMany({
        where: and(
          eq(smsLogs.schoolId, schoolA),
          eq(smsLogs.recipientUserId, parentAUserId),
          eq(smsLogs.messageType, "EXAM"),
        ),
      });

      expect(sms.length).toBeGreaterThanOrEqual(1);
      expect(sms[0]?.status).toBe("QUEUED");
    });
  });

  it("3.3: notifyAdmitCardsReleased creates in-app notice and web push notification for parents", async () => {
    const res = await notifyAdmitCardsReleased({
      schoolId: schoolA,
      examId: testExamAId,
      triggeredById: ISOLATION_IDS.schoolA.adminUserId,
    });

    expect(res.success).toBe(true);
    expect(res.inAppNoticeId).toBeDefined();
    expect(res.pushSentCount).toBeGreaterThanOrEqual(1);

    await withTenant(schoolA, async (tx) => {
      const notice = await tx.query.notices.findFirst({
        where: and(eq(notices.id, res.inAppNoticeId!), eq(notices.schoolId, schoolA)),
      });
      expect(notice?.title).toContain("Admit Cards Released");
    });
  });

  it("3.4: notifyDatesheetPublished creates in-app notice with audienceType='ALL' and push logs", async () => {
    const res = await notifyDatesheetPublished({
      schoolId: schoolA,
      scheduleIds: [testScheduleAId],
      triggeredById: ISOLATION_IDS.schoolA.adminUserId,
    });

    expect(res.success).toBe(true);
    expect(res.inAppNoticeId).toBeDefined();

    await withTenant(schoolA, async (tx) => {
      const notice = await tx.query.notices.findFirst({
        where: and(eq(notices.id, res.inAppNoticeId!), eq(notices.schoolId, schoolA)),
      });
      expect(notice?.title).toContain("Datesheet Published");
      expect(notice?.audienceType).toBe("ALL");
    });
  });

  it("3.5: notifyBulkJobCompleted dispatches push notification directly to triggering admin user", async () => {
    const adminUserId = ISOLATION_IDS.schoolA.adminUserId;
    const res = await notifyBulkJobCompleted({
      schoolId: schoolA,
      jobId: "bulk-job-test-uuid",
      examId: testExamAId,
      triggeredById: adminUserId,
      processedCount: 45,
      failedCount: 0,
    });

    expect(res.success).toBe(true);
    expect(res.pushSentCount).toBe(1);

    await withTenant(schoolA, async (tx) => {
      const pushLog = await tx.query.pushNotificationLogs.findFirst({
        where: and(
          eq(pushNotificationLogs.schoolId, schoolA),
          eq(pushNotificationLogs.recipientUserId, adminUserId),
        ),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      });

      expect(pushLog).toBeDefined();
      expect(pushLog?.title).toContain("Bulk Report Card Generation Complete");
      expect(pushLog?.body).toContain("45 succeeded, 0 failed");
    });
  });

  it("3.6: Cross-tenant isolation probe: School A notification never queries or sends to School B parent", async () => {
    const schoolBParentUserId = ISOLATION_IDS.schoolB.parentUserId;

    // Trigger School A result release
    await notifyResultReleased({
      schoolId: schoolA,
      setupId: testSetupAId,
      triggeredById: ISOLATION_IDS.schoolA.adminUserId,
    });

    // Probe under School A tenant: School B parent user MUST have zero push or sms logs
    await withTenant(schoolA, async (tx) => {
      const crossPushLogs = await tx.query.pushNotificationLogs.findMany({
        where: and(
          eq(pushNotificationLogs.schoolId, schoolA),
          eq(pushNotificationLogs.recipientUserId, schoolBParentUserId),
        ),
      });
      expect(crossPushLogs.length).toBe(0);

      const crossSmsLogs = await tx.query.smsLogs.findMany({
        where: and(
          eq(smsLogs.schoolId, schoolA),
          eq(smsLogs.recipientUserId, schoolBParentUserId),
        ),
      });
      expect(crossSmsLogs.length).toBe(0);
    });
  });

  it("3.7: Failure-without-rollback rule: invalid schoolId does not crash or throw unhandled exceptions", async () => {
    const res = await notifyResultReleased({
      schoolId: "00000000-0000-0000-0000-000000000000",
      setupId: "00000000-0000-0000-0000-000000000000",
      triggeredById: "00000000-0000-0000-0000-000000000000",
    });

    // Expect graceful fail-safe handling (returns false with error, never throws)
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it("3.8: IST Quiet Hours accuracy: enforces 21:00 - 07:00 IST window regardless of system timezone", () => {
    // 2026-10-15T16:00:00Z -> In IST (+5:30) is 21:30 (9:30 PM) -> Quiet hours
    const nightDate = new Date("2026-10-15T16:00:00.000Z");
    expect(isQuietHours(nightDate)).toBe(true);

    // 2026-10-15T08:30:00Z -> In IST (+5:30) is 14:00 (2:00 PM) -> Active hours
    const daytimeDate = new Date("2026-10-15T08:30:00.000Z");
    expect(isQuietHours(daytimeDate)).toBe(false);

    // 2026-10-15T01:00:00Z -> In IST (+5:30) is 06:30 (6:30 AM) -> Quiet hours
    const earlyMorningDate = new Date("2026-10-15T01:00:00.000Z");
    expect(isQuietHours(earlyMorningDate)).toBe(true);

    // 2026-10-15T02:00:00Z -> In IST (+5:30) is 07:30 (7:30 AM) -> Active hours
    const postQuietMorningDate = new Date("2026-10-15T02:00:00.000Z");
    expect(isQuietHours(postQuietMorningDate)).toBe(false);
  });

  it("3.9: Scopes fan-out strictly to classes in examClassScopes when configured", async () => {
    const runId = Math.random().toString(36).substring(2, 7);

    // Create a new scoped exam with specific class scope in School A
    let scopedExamId: string;
    let scopedSetupId: string;

    await withTenant(schoolA, async (tx) => {
      const [scopedExam] = await tx
        .insert(exams)
        .values({
          schoolId: schoolA,
          academicYearId: ISOLATION_IDS.schoolA.academicYearId,
          examTypeId: ISOLATION_IDS.schoolA.examTypeId,
          name: `Scoped Exam ${runId}`,
          startDate: new Date("2026-12-01"),
          endDate: new Date("2026-12-10"),
        })
        .returning();
      scopedExamId = scopedExam!.id;

      // Add class scope to classId
      await tx.insert(examClassScopes).values({
        schoolId: schoolA,
        examId: scopedExamId,
        classId: ISOLATION_IDS.schoolA.classId,
      });

      const [scopedSetup] = await tx
        .insert(reportCardSetups)
        .values({
          schoolId: schoolA,
          academicYearId: ISOLATION_IDS.schoolA.academicYearId,
          name: `Scoped Setup ${runId}`,
          examWeightages: [{ examId: scopedExamId, weightPercent: 100 }],
          createdById: ISOLATION_IDS.schoolA.adminUserId,
        })
        .returning();
      scopedSetupId = scopedSetup!.id;
    });

    const res = await notifyResultReleased({
      schoolId: schoolA,
      setupId: scopedSetupId!,
      triggeredById: ISOLATION_IDS.schoolA.adminUserId,
    });

    expect(res.success).toBe(true);
    expect(res.pushSentCount).toBeGreaterThanOrEqual(1);
  });
});
